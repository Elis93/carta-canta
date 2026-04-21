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
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

const BodySchema = z.object({
  signer_name: z.string().min(2, 'Nome obbligatorio (min. 2 caratteri)').max(120),
  // PNG base64 della firma grafica — opzionale per retrocompatibilità
  signature_image: z.string().startsWith('data:image/png;base64,').max(65536).nullish(),
})

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // ── Rate limit: 5 tentativi / ora per token ──────────────
  // Scoped al singolo documento — non impatta altri preventivi.
  const rl = checkRateLimit(`accept:${token}`, { limit: 5, windowMs: 3_600_000 })
  if (!rl.success) {
    return rateLimitResponse(rl.resetAt, 'Troppi tentativi. Attendi qualche minuto e riprova.')
  }

  // ── Valida body ──────────────────────────────────────────
  let body: z.infer<typeof BodySchema>
  try {
    const raw = await request.json()
    body = BodySchema.parse(raw)
  } catch {
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
      workspace_id,
      workspaces!workspace_id (
        owner_id,
        ragione_sociale,
        name
      )
    `)
    .eq('public_token', token)
    .maybeSingle()

  if (fetchError || !doc) {
    return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })
  }

  // ── Verifica stato ───────────────────────────────────────
  if (doc.status !== 'sent' && doc.status !== 'viewed') {
    const msg =
      doc.status === 'accepted' ? 'Preventivo già accettato' :
      doc.status === 'rejected' ? 'Preventivo già rifiutato' :
      doc.status === 'expired'  ? 'Preventivo scaduto'      :
      'Preventivo non disponibile'
    return NextResponse.json({ error: msg }, { status: 409 })
  }

  // ── Raccoglie IP e UA (per firma digitale semplice) ──────
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    null
  const ua = request.headers.get('user-agent') ?? null

  // ── Aggiorna documento ───────────────────────────────────
  const { error: updateError } = await admin
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

  if (updateError) {
    console.error('[accept] DB update error:', updateError)
    return NextResponse.json({ error: 'Errore nel salvataggio' }, { status: 500 })
  }

  // ── Email all'artigiano (best-effort, non blocca) ────────
  try {
    const workspace = doc.workspaces as {
      owner_id: string
      ragione_sociale: string | null
      name: string
    } | null

    if (workspace?.owner_id) {
      const { data: ownerData } = await admin.auth.admin.getUserById(workspace.owner_id)
      const ownerEmail = ownerData?.user?.email

      if (ownerEmail) {
        const workspaceName = workspace.ragione_sociale ?? workspace.name
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.it'

        await sendEmail({
          to: ownerEmail,
          subject: `🎉 ${body.signer_name} ha accettato il preventivo "${doc.title ?? ''}"`,
          react: createElement(PreventivoAccettatoEmail, {
            documentTitle: doc.title ?? '',
            documentNumber: doc.doc_number ?? undefined,
            signerName: body.signer_name,
            workspaceName,
            acceptedAt: new Date().toLocaleString('it-IT', {
              day: '2-digit', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            }),
            documentUrl: `${appUrl}/preventivi/${doc.id}`,
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
