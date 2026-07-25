// ============================================================
// POST /api/p/[token]/accept
// Pubblica — no auth richiesta.
// Accetta un preventivo: salva IP, UA, timestamp, cambia status.
// Invia email di notifica all'artigiano (best-effort).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { createElement } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { PreventivoAccettatoEmail } from '@/lib/email/templates/preventivo_accettato'
import { checkPublicRateLimit, rateLimitResponse } from '@/lib/public-rate-limit'
import { clientIpFrom } from '@/lib/client-ip'

const BodySchema = z.object({
  signer_name: z.string().min(2, 'Nome obbligatorio (min. 2 caratteri)').max(120),
  // PNG base64 della firma grafica — opzionale per retrocompatibilità
  signature_image: z.string().startsWith('data:image/png;base64,').max(65536).nullish(),
  // Opzioni a livelli (041): proposta scelta dal cliente
  tier: z.enum(['base', 'consigliata', 'premium']).nullish(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // ── Rate limit: 5 tentativi / ora per token ──────────────
  // Scoped al singolo documento — non impatta altri preventivi.
  const rl = await checkPublicRateLimit({ key: `accept:${token}`, limit: 5, window: '1 h', windowMs: 3_600_000 })
  if (rl.blocked) {
    return rateLimitResponse(rl.resetAt, 'Troppi tentativi. Attendi qualche minuto e riprova.')
  }

  // ── Valida body ──────────────────────────────────────────
  let body: z.infer<typeof BodySchema>
  try {
    const raw = await request.json()
    body = BodySchema.parse(raw)
  } catch (e) {
    // Messaggio per CAMPO (review 25 lug M6, come il gemello /r/[token]/sign):
    // prima qualsiasi errore diceva "Nome firma obbligatorio" anche quando a
    // sforare era l'immagine della firma — il cliente riscriveva il nome
    // invano e in 5 tentativi bruciava il rate-limit del preventivo.
    if (e instanceof z.ZodError) {
      const field = e.issues[0]?.path[0]
      if (field === 'signature_image') {
        return NextResponse.json({ error: 'La firma disegnata è troppo pesante: rifalla con un tratto più semplice.' }, { status: 400 })
      }
      if (field === 'tier') {
        return NextResponse.json({ error: 'Scegli una delle proposte prima di accettare.' }, { status: 400 })
      }
    }
    return NextResponse.json({ error: 'Nome firma obbligatorio (min. 2 caratteri)' }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── Carica documento via token ───────────────────────────
  const { data: doc, error: fetchError } = await admin
    .from('documents')
    .select(`
      id,
      title,
      doc_number,
      status,
      expires_at,
      workspace_id,
      workspaces!workspace_id (
        owner_id,
        ragione_sociale,
        name,
        notification_prefs
      )
    `)
    .eq('public_token', token)
    .is('deleted_at', null)
    .maybeSingle()

  if (fetchError || !doc) {
    return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })
  }

  // ── Verifica stato ───────────────────────────────────────
  // Oltre la data di scadenza il preventivo non è più accettabile anche se
  // il cron non l'ha ancora marcato 'expired'.
  const docExpiry = (doc as Record<string, unknown>).expires_at as string | null
  if (docExpiry && new Date(docExpiry) < new Date()) {
    return NextResponse.json({ error: 'Preventivo scaduto' }, { status: 409 })
  }
  if (doc.status !== 'sent' && doc.status !== 'viewed') {
    const msg =
      doc.status === 'accepted' ? 'Preventivo già accettato' :
      doc.status === 'rejected' ? 'Preventivo già rifiutato' :
      doc.status === 'expired'  ? 'Preventivo scaduto'      :
      'Preventivo non disponibile'
    return NextResponse.json({ error: msg }, { status: 409 })
  }

  // ── Opzioni a livelli: il cliente ha scelto UNA proposta ──
  // Dopo l'accettazione il documento tiene SOLO le voci della proposta
  // scelta (così PDF, dettaglio e conversione in fattura sono coerenti)
  // e i totali vengono ricalcolati col motore fiscale.
  // NB: qui si PREPARA soltanto — la cancellazione delle altre proposte
  // avviene DOPO che lo status è passato ad accepted, così un update
  // fallito o un doppio submit non lasciano il documento mutilato.
  let tierUpdate: Record<string, unknown> | null = null
  let tierOtherIds: string[] = []
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 041 non ancora in types/database.ts
    const db = admin as any
    const { data: opt } = await db
      .from('documents')
      .select('options_enabled, discount_pct, discount_fixed, vat_rate_default')
      .eq('id', doc.id)
      .maybeSingle()
    if (opt?.options_enabled) {
      const { data: allItems } = await db
        .from('document_items')
        .select('*')
        .eq('document_id', doc.id)
      const presentTiers = [...new Set(
        ((allItems ?? []) as Array<Record<string, unknown>>).map((i) => (i.option_tier as string | null) ?? 'base')
      )]
      // Con UNA sola proposta il TierPicker non compare (e non manda il tier):
      // quella proposta È la scelta — senza questo default il preventivo
      // sarebbe inaccettabile (400 a ogni tentativo).
      const tier = body.tier ?? (presentTiers.length === 1 ? presentTiers[0] : null)
      if (!tier) {
        return NextResponse.json({ error: 'Scegli una proposta prima di accettare.' }, { status: 400 })
      }
      const chosen = ((allItems ?? []) as Array<Record<string, unknown>>).filter(
        (i) => ((i.option_tier as string | null) ?? 'base') === tier
      )
      if (chosen.length === 0) {
        return NextResponse.json({ error: 'Proposta non valida.' }, { status: 400 })
      }
      tierOtherIds = ((allItems ?? []) as Array<Record<string, unknown>>)
        .filter((i) => ((i.option_tier as string | null) ?? 'base') !== tier)
        .map((i) => i.id as string)
      const { calcolaDocumento } = await import('@/lib/fiscal/calcoli')
      const { data: ws } = await admin
        .from('workspaces')
        .select('fiscal_regime')
        .eq('id', doc.workspace_id)
        .maybeSingle()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- voci lette con select('*') dinamico
      const fiscal = calcolaDocumento(chosen as any, {
        fiscal_regime: (ws?.fiscal_regime ?? 'forfettario') as 'forfettario' | 'ordinario' | 'minimi',
        currency: 'EUR',
        discount_pct: (opt.discount_pct as number | null) ?? undefined,
        discount_fixed: (opt.discount_fixed as number | null) ?? undefined,
        vat_rate_default: (opt.vat_rate_default as number | null) ?? undefined,
      })
      tierUpdate = {
        accepted_tier: tier,
        subtotal: fiscal.subtotal,
        tax_amount: fiscal.taxAmount,
        bollo_amount: fiscal.bollo,
        total: fiscal.total,
      }
    }
  } catch { /* colonne 041 mancanti — accettazione classica */ }

  // ── Raccoglie IP e UA (per firma digitale semplice) ──────
  // x-real-ip primario (non spoofabile su Vercel): l'IP è anche PROVA
  // della firma (accepted_ip) — vedi lib/client-ip.ts
  const ip = clientIpFrom(request.headers)
  const ua = request.headers.get('user-agent') ?? null

  // ── Aggiorna documento ───────────────────────────────────
  // Update condizionale sullo stato: un doppio submit concorrente non può
  // accettare due volte (il secondo non trova più righe sent/viewed).
  const { data: updatedRows, error: updateError } = await admin
    .from('documents')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_ip: ip,
      accepted_ua: ua,
      signer_name: body.signer_name,
      signature_image: body.signature_image ?? null,
    })
    .eq('id', doc.id)
    .in('status', ['sent', 'viewed'])
    .select('id')

  if (updateError) {
    console.error('[accept] DB update error:', updateError)
    return NextResponse.json({ error: 'Errore nel salvataggio' }, { status: 500 })
  }
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json({ error: 'Preventivo già accettato' }, { status: 409 })
  }

  // Opzione scelta: SOLO ora (status già accepted) si tolgono le altre
  // proposte e si scrivono i totali ricalcolati (update separato — colonne 041)
  if (tierUpdate) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 041 non ancora in types/database.ts
    const db = admin as any
    if (tierOtherIds.length > 0) {
      const { error: delError } = await db.from('document_items').delete().in('id', tierOtherIds)
      if (delError) console.error('[accept] cleanup proposte non scelte fallito:', delError)
    }
    const { error: tierError } = await db.from('documents').update(tierUpdate).eq('id', doc.id)
    if (tierError) console.error('[accept] update totali proposta scelta fallito:', tierError)
  }

  // ── Email all'artigiano (best-effort, non blocca) ────────
  try {
    const workspace = doc.workspaces as {
      owner_id: string
      ragione_sociale: string | null
      name: string
      notification_prefs: Record<string, boolean> | null
    } | null

    // Rispetta preferenza notifiche
    const prefs = workspace?.notification_prefs ?? {}

    if (workspace?.owner_id && prefs['preventivo_accettato'] !== false) {
      const { data: ownerData } = await admin.auth.admin.getUserById(workspace.owner_id)
      const ownerEmail = ownerData?.user?.email

      if (ownerEmail) {
        const workspaceName = workspace.ragione_sociale ?? workspace.name
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'

        await sendEmail({
          to: ownerEmail,
          subject: `${body.signer_name} ha accettato il preventivo${doc.title ? ` "${doc.title}"` : doc.doc_number ? ` ${doc.doc_number}` : ''}`,
          react: createElement(PreventivoAccettatoEmail, {
            documentTitle: doc.title ?? doc.doc_number ?? 'Preventivo',
            documentNumber: doc.doc_number ?? undefined,
            signerName: body.signer_name,
            workspaceName,
            acceptedAt: new Date().toLocaleString('it-IT', {
              day: '2-digit', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
              timeZone: 'Europe/Rome', // il server è UTC: senza, l'ora è indietro di 1-2h
            }),
            // Usa l'URL pubblico (/p/token) così l'artigiano può aprire il documento
            // anche se loggato con un account diverso sul dispositivo.
            documentUrl: `${appUrl}/p/${token}`,
          }),
        })
      }
    }
  } catch (err) {
    // Non blocca: il documento è già marcato come accettato
    console.warn('[accept] Email notification failed (non bloccante):', err)
  }

  return NextResponse.json({ success: true })
}
