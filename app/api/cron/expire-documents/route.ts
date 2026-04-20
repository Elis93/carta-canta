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
import { PreventivoScadutoEmail } from '@/lib/email/templates/preventivo_scaduto'

export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  const admin = createAdminClient()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.it'
  const results = { expired: 0, reminders_sent: 0, reminders_errors: 0, expired_notified: 0, expired_notify_errors: 0 }

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
      id, title, doc_number, expires_at, workspace_id,
      workspaces!workspace_id (
        owner_id,
        ragione_sociale,
        name,
        notification_prefs
      )
    `)
    .in('status', ['sent', 'viewed'])
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

    try {
      const { data: ownerData } = await admin.auth.admin.getUserById(workspace.owner_id)
      const ownerEmail = ownerData?.user?.email
      if (!ownerEmail) continue

      const expiresDate = new Date(doc.expires_at!)
      const daysLeft = Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      const workspaceName = workspace.ragione_sociale ?? workspace.name

      await sendEmail({
        to: ownerEmail,
        subject: `⏰ Il preventivo "${doc.title ?? ''}" scade tra ${daysLeft} ${daysLeft === 1 ? 'giorno' : 'giorni'}`,
        react: createElement(PreventivoInScadenzaEmail, {
          documentTitle: doc.title ?? '',
          documentNumber: doc.doc_number ?? undefined,
          workspaceName,
          expiresAt: expiresDate.toLocaleDateString('it-IT', {
            day: '2-digit', month: 'long', year: 'numeric',
          }),
          daysLeft,
          documentUrl: `${appUrl}/preventivi/${doc.id}`,
        }),
      })

      results.reminders_sent++
    } catch (err) {
      console.warn(`[cron/expire] Reminder failed for doc ${doc.id}:`, err)
      results.reminders_errors++
    }
  }

  console.log(`[cron/expire] Reminder inviati: ${results.reminders_sent}, errori: ${results.reminders_errors}`)

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
      })

      await sendEmail({
        to: ownerEmail,
        subject: `📭 Il preventivo "${doc.title ?? ''}" è scaduto senza risposta`,
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
  return NextResponse.json({ success: true, ...results })
}
