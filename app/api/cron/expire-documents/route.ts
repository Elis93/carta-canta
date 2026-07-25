// GET /api/cron/expire-documents
// Chiamato dal cron Vercel ogni notte (es. alle 02:00 Europe/Rome).
// Protetto da CRON_SECRET.
//
// Fa due cose:
// 1. Scade i documenti overdue → chiama expire_overdue_documents()
// 2. Invia reminder email per documenti che scadono tra 1 e 3 giorni

import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { PreventivoInScadenzaEmail } from '@/lib/email/templates/preventivo_in_scadenza'
import { PreventivoInScadenzaClienteEmail } from '@/lib/email/templates/preventivo_in_scadenza_cliente'
import { PreventivoScadutoEmail } from '@/lib/email/templates/preventivo_scaduto'
import { SollecitoClienteEmail } from '@/lib/email/templates/sollecito_cliente'

export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  // Fail-CLOSED: se CRON_SECRET manca dall'env, l'endpoint resta chiuso
  // (undefined !== undefined passerebbe e chiunque potrebbe far partire
  // le email ai clienti degli artigiani).
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const admin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'
  const results = { expired: 0, reminders_sent: 0, reminders_errors: 0, client_reminders_sent: 0, expired_notified: 0, expired_notify_errors: 0, followups_sent: 0 }

  // ── 0. Cattura i documenti che stanno per essere scaduti (prima dell'RPC) ──
  // Così sappiamo esattamente chi notificare dopo la transizione di stato.
  const nowIso = new Date().toISOString()
  const { data: aboutToExpire } = await admin
    .from('documents')
    .select(`
      id, title, doc_number, expires_at, workspace_id,
      workspaces!workspace_id (
        owner_id,
        ragione_sociale,
        name,
        notification_prefs
      )
    `)
    .in('status', ['sent', 'viewed'])
    // Solo PREVENTIVI (review 25 lug A5): le fatture usano expires_at come
    // scadenza di PAGAMENTO — senza questo filtro il cliente riceveva "hai
    // ancora 1 giorno per rispondere al preventivo" per una fattura da pagare.
    .eq('doc_type', 'preventivo')
    .is('deleted_at', null)
    .lt('expires_at', nowIso)
    .not('expires_at', 'is', null)

  // ── 1. Scade documenti overdue ─────────────────────────────────────────────
  const { data: expiredCount, error: expireError } = await admin.rpc('expire_overdue_documents')
  if (expireError) {
    console.error('[cron/expire] RPC error:', expireError)
  } else {
    results.expired = expiredCount ?? 0
    console.log(`[cron/expire] Scaduti ${results.expired} documenti`)
  }

  // ── 2. Reminder: scadenza tra 1-3 giorni ──────────────────────────────────
  const now = new Date()
  const in1Day  = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  const in3Days = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  // Documenti inviati/visti che scadono entro 3 giorni
  const { data: expiringSoon } = await admin
    .from('documents')
    .select(`
      id, title, doc_number, expires_at, workspace_id, public_token,
      workspaces!workspace_id (
        owner_id,
        ragione_sociale,
        name,
        notification_prefs
      ),
      clients!client_id (
        email,
        name
      )
    `)
    .in('status', ['sent', 'viewed'])
    // Solo PREVENTIVI (review 25 lug A5) — vedi commento sulla query sopra.
    .eq('doc_type', 'preventivo')
    .is('deleted_at', null)
    .gte('expires_at', `${in1Day}T00:00:00Z`)
    .lte('expires_at', `${in3Days}T23:59:59Z`)
    .not('expires_at', 'is', null)

  for (const doc of expiringSoon ?? []) {
    const workspace = doc.workspaces as {
      owner_id: string
      ragione_sociale: string | null
      name: string
      notification_prefs: Record<string, boolean> | null
    } | null

    if (!workspace) continue

    // Rispetta la preferenza utente
    const prefs = workspace.notification_prefs ?? {}
    if (prefs['preventivo_scaduto'] === false) continue

    const expiresDate = new Date(doc.expires_at!)
    const daysLeft = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const workspaceName = workspace.ragione_sociale ?? workspace.name
    const expiresAtFormatted = expiresDate.toLocaleDateString('it-IT', {
      day: '2-digit', month: 'long', year: 'numeric',
     timeZone: 'Europe/Rome' })

    // Fetch owner email una volta sola — usata sia per il reminder owner che come replyTo cliente
    const { data: ownerData } = await admin.auth.admin.getUserById(workspace.owner_id)
    const ownerEmail = ownerData?.user?.email

    // ── Reminder all'owner ─────────────────────────────────
    try {
      if (ownerEmail) {
        await sendEmail({
          to: ownerEmail,
          subject: `Il preventivo "${doc.title ?? ''}" scade tra ${daysLeft} ${daysLeft === 1 ? 'giorno' : 'giorni'}`,
          react: createElement(PreventivoInScadenzaEmail, {
            documentTitle: doc.title ?? '',
            documentNumber: doc.doc_number ?? undefined,
            workspaceName,
            expiresAt: expiresAtFormatted,
            daysLeft,
            documentUrl: `${appUrl}/preventivi/${doc.id}`,
          }),
        })
        results.reminders_sent++
      }
    } catch (err) {
      console.warn(`[cron/expire] Reminder owner failed for doc ${doc.id}:`, err)
      results.reminders_errors++
    }

    // ── Reminder al cliente — solo quando daysLeft === 1 ──
    if (daysLeft === 1 && prefs['reminder_cliente'] !== false) {
      const client = doc.clients as { email: string | null; name: string | null } | null
      const clientEmail = client?.email
      const publicToken = doc.public_token

      if (clientEmail && publicToken) {
        try {
          await sendEmail({
            to: clientEmail,
            subject: `Hai ancora 1 giorno per rispondere al preventivo di ${workspaceName}`,
            react: createElement(PreventivoInScadenzaClienteEmail, {
              documentTitle: doc.title ?? '',
              documentNumber: doc.doc_number ?? undefined,
              workspaceName,
              expiresAt: expiresAtFormatted,
              daysLeft,
              publicUrl: `${appUrl}/p/${publicToken}`,
            }),
            replyTo: ownerEmail ?? undefined,
          })
          results.client_reminders_sent++
        } catch (err) {
          console.warn(`[cron/expire] Reminder cliente failed for doc ${doc.id}:`, err)
        }
      }
    }
  }

  console.log(`[cron/expire] Reminder owner: ${results.reminders_sent} inviati, ${results.reminders_errors} errori — Reminder cliente: ${results.client_reminders_sent} inviati`)

  // ── 3. Notifica scadenza avvenuta ─────────────────────────────────────────
  for (const doc of aboutToExpire ?? []) {
    const workspace = doc.workspaces as {
      owner_id: string
      ragione_sociale: string | null
      name: string
      notification_prefs: Record<string, boolean> | null
    } | null

    if (!workspace) continue

    // Rispetta la preferenza utente (stessa chiave del reminder)
    const prefs = workspace.notification_prefs ?? {}
    if (prefs['preventivo_scaduto'] === false) continue

    try {
      const { data: ownerData } = await admin.auth.admin.getUserById(workspace.owner_id)
      const ownerEmail = ownerData?.user?.email
      if (!ownerEmail) continue

      const workspaceName = workspace.ragione_sociale ?? workspace.name
      const expiredAt = new Date(doc.expires_at!).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric',
       timeZone: 'Europe/Rome' })

      await sendEmail({
        to: ownerEmail,
        subject: `Il preventivo "${doc.title ?? ''}" è scaduto senza risposta`,
        react: createElement(PreventivoScadutoEmail, {
          documentTitle: doc.title ?? '',
          documentNumber: doc.doc_number ?? undefined,
          workspaceName,
          expiredAt,
          documentUrl: `${appUrl}/preventivi/${doc.id}`,
        }),
      })

      results.expired_notified++
    } catch (err) {
      console.warn(`[cron/expire] Notifica scadenza fallita per doc ${doc.id}:`, err)
      results.expired_notify_errors++
    }
  }

  console.log(`[cron/expire] Scadenza notificata: ${results.expired_notified}, errori: ${results.expired_notify_errors}`)

  // ── 4. Follow-up automatico (opt-in: notification_prefs.followup_auto) ─────
  // Se un preventivo/fattura è "sent/viewed" da ≥3 giorni, non è mai stato
  // sollecitato (last_reminder_at null) e NON è vicino alla scadenza (quella
  // la gestisce il reminder sopra), invia UN promemoria al cliente e segna
  // last_reminder_at per non ripetere.
  const threeDaysAgoIso = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const thirtyDaysAgoIso = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const in3DaysIso = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString()
  const { data: followupCandidates } = await admin
    .from('documents')
    .select(`
      id, doc_type, title, doc_number, public_token, expires_at,
      workspaces!workspace_id (
        owner_id, ragione_sociale, name, notification_prefs
      ),
      clients!client_id ( email, name )
    `)
    .in('status', ['sent', 'viewed'])
    .eq('doc_type', 'preventivo')
    .is('deleted_at', null)
    .is('last_reminder_at', null)
    .not('sent_at', 'is', null)
    .lte('sent_at', threeDaysAgoIso)
    // Finestra: niente follow-up su preventivi più vecchi di 30 giorni
    // (evita l'ondata iniziale quando si attiva l'opzione).
    .gte('sent_at', thirtyDaysAgoIso)

  for (const doc of followupCandidates ?? []) {
    const workspace = doc.workspaces as {
      owner_id: string
      ragione_sociale: string | null
      name: string
      notification_prefs: Record<string, boolean> | null
    } | null
    if (!workspace) continue

    // Opt-in esplicito
    if ((workspace.notification_prefs ?? {})['followup_auto'] !== true) continue

    // Salta i documenti in scadenza entro 3 giorni: li copre già il reminder scadenza
    if (doc.expires_at && new Date(doc.expires_at) <= new Date(in3DaysIso)) continue

    const client = doc.clients as { email: string | null; name: string | null } | null
    if (!client?.email || !doc.public_token) continue

    try {
      const { data: ownerData } = await admin.auth.admin.getUserById(workspace.owner_id)
      const numClean = doc.doc_number ? doc.doc_number.replace(/^[A-Za-z]+/, '') : ''
      await sendEmail({
        to: client.email,
        subject: `Promemoria: preventivo${numClean ? ` #${numClean}` : ''} in attesa di risposta`,
        react: createElement(SollecitoClienteEmail, {
          clientName: client.name ?? 'Gentile cliente',
          documentTitle: doc.title ?? '',
          documentNumber: numClean || undefined,
          workspaceName: workspace.ragione_sociale ?? workspace.name,
          publicUrl: `${appUrl}/p/${doc.public_token}`,
          docType: 'preventivo',
        }),
        replyTo: ownerData?.user?.email ?? undefined,
      })
      await admin.from('documents').update({ last_reminder_at: nowIso }).eq('id', doc.id)
      results.followups_sent++
    } catch (err) {
      console.warn(`[cron/expire] Follow-up automatico fallito per doc ${doc.id}:`, err)
    }
  }

  console.log(`[cron/expire] Follow-up automatici inviati: ${results.followups_sent}`)

  // ── Purge cestino: cancella definitivamente i documenti eliminati da >15 giorni ──
  const fifteenDaysAgo = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000).toISOString()

  // Foto dei documenti in purge — PRIMA del delete (la FK SET NULL le
  // renderebbe irrintracciabili): file nel bucket + righe, escluse le foto
  // che vivono anche su un sopralluogo. Senza questo blocco i file non
  // venivano MAI rimossi (retention/GDPR).
  try {
    const { data: docsToPurge } = await admin
      .from('documents')
      .select('id')
      .not('deleted_at', 'is', null)
      .lt('deleted_at', fifteenDaysAgo)
    const purgeIds = ((docsToPurge ?? []) as Array<{ id: string }>).map((d) => d.id)
    if (purgeIds.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 041 non ancora in types/database.ts
      const { data: photos } = await (admin as any)
        .from('work_photos')
        .select('id, storage_path')
        .in('document_id', purgeIds)
        .is('sopralluogo_id', null)
      const rows = (photos ?? []) as Array<{ id: string; storage_path: string | null }>
      if (rows.length > 0) {
        const paths = rows.map((p) => p.storage_path).filter((p): p is string => !!p)
        if (paths.length > 0) await admin.storage.from('work-photos').remove(paths)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 041 non ancora in types/database.ts
        await (admin as any).from('work_photos').delete().in('id', rows.map((p) => p.id))
        console.log(`[cron/expire] Cestino: rimosse ${rows.length} foto orfane dei documenti in purge`)
      }
    }
  } catch (e) {
    console.warn('[cron/expire] pulizia foto pre-purge fallita (non blocca):', e)
  }

  const { count: purged } = await admin
    .from('documents')
    .delete({ count: 'exact' })
    .not('deleted_at', 'is', null)
    .lt('deleted_at', fifteenDaysAgo)

  if (purged && purged > 0) {
    console.log(`[cron/expire] Cestino: eliminati definitivamente ${purged} documenti (>15 giorni)`)
  }

  // ── Minimizzazione GDPR: aperture link pubblico (IP) oltre 12 mesi ──
  // document_views conserva IP/UA/paese a ogni apertura; non serve tenerli
  // a tempo indeterminato. 12 mesi copre prova e statistiche.
  let viewsPurged = 0
  try {
    const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (admin as any)
      .from('document_views')
      .delete({ count: 'exact' })
      .lt('viewed_at', twelveMonthsAgo)
    viewsPurged = count ?? 0
  } catch { /* tabella/colonna assenti */ }

  // ── Minimizzazione GDPR: richieste marketplace (dati di consumatori) oltre 12 mesi ──
  let requestsPurged = 0
  try {
    const twelveMonthsAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count } = await (admin as any)
      .from('marketplace_requests')
      .delete({ count: 'exact' })
      .lt('created_at', twelveMonthsAgo)
    requestsPurged = count ?? 0
  } catch { /* tabella 043 non applicata */ }

  return NextResponse.json({
    success: true, ...results,
    purged: purged ?? 0, viewsPurged, requestsPurged,
  })
}
