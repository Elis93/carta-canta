// ============================================================
// POST /api/p/[token]/decline
// Pubblica — no auth richiesta.
// Rifiuta un preventivo e notifica l'artigiano via email.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { PreventivoRifiutatoEmail } from '@/lib/email/templates/preventivo_rifiutato'
import { checkPublicRateLimit, rateLimitResponse } from '@/lib/public-rate-limit'
import { logRifiutoCliente } from '@/lib/documents/log-cliente'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // ── Rate limit: 5 tentativi / ora per token ──────────────
  const rl = await checkPublicRateLimit({ key: `decline:${token}`, limit: 5, window: '1 h', windowMs: 3_600_000 })
  if (rl.blocked) {
    return rateLimitResponse(rl.resetAt, 'Troppi tentativi. Attendi qualche minuto e riprova.')
  }

  // ── Leggi body opzionale ─────────────────────────────────
  let reason: string | null = null
  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body.reason === 'string' && body.reason.trim().length > 0) {
      reason = body.reason.trim().slice(0, 500)
    }
  } catch { /* body assente — ok */ }

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
        name,
        notification_prefs
      )
    `)
    .eq('public_token', token)
    // SOLO preventivi (review 25 lug A1): le fatture condividono /p/[token]
    // come copia di cortesia ma NON hanno accettazione/rifiuto pubblici —
    // senza questo filtro chiunque avesse il link poteva segnare una fattura
    // "Pagata" (entrata fantasma nel Bilancio) o "Annullata" via POST diretta.
    .eq('doc_type', 'preventivo')
    .is('deleted_at', null)
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

  // ── Aggiorna documento ───────────────────────────────────
  // Update CONDIZIONATO sullo stato (come accept): senza, un accept e un
  // decline concorrenti (doppio device, o chiunque abbia il token) potevano
  // marcare 'rejected' un preventivo appena ACCETTATO+firmato, lasciando
  // signer_name/signature_image su un documento "rifiutato" — record
  // contraddittorio e prova FES sporcata (audit probatorio 24 lug).
  const { data: rejected, error: updateError } = await admin
    .from('documents')
    .update({ status: 'rejected', rejection_reason: reason })
    .eq('id', doc.id)
    .in('status', ['sent', 'viewed'])
    .select('id')

  if (updateError) {
    console.error('[decline] DB update error:', updateError)
    return NextResponse.json({ error: 'Errore nel salvataggio' }, { status: 500 })
  }
  if (!rejected || rejected.length === 0) {
    // Un'altra azione (accept/scadenza) ha già mosso lo stato nel frattempo.
    return NextResponse.json({ error: 'Il preventivo è già stato aggiornato. Ricarica la pagina.' }, { status: 409 })
  }

  // ── Cronologia: il rifiuto resta scritto (Eli 26 ago) ────
  // Best-effort: senza questa voce, alla riapertura del preventivo l'evento
  // «Rifiutato» — derivato dallo stato — spariva dalla storia.
  await logRifiutoCliente(admin, doc.id, reason)

  // ── Email all'artigiano (best-effort) ────────────────────
  try {
    const workspace = doc.workspaces as {
      owner_id: string
      ragione_sociale: string | null
      name: string
      notification_prefs: Record<string, boolean> | null
    } | null

    // Rispetta preferenza notifiche
    const prefs = workspace?.notification_prefs ?? {}

    if (workspace?.owner_id && prefs['preventivo_rifiutato'] !== false) {
      const { data: ownerData } = await admin.auth.admin.getUserById(workspace.owner_id)
      const ownerEmail = ownerData?.user?.email

      if (ownerEmail) {
        const workspaceName = workspace.ragione_sociale ?? workspace.name
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'

        await sendEmail({
          to: ownerEmail,
          subject: `Il cliente ha rifiutato il preventivo${doc.title ? ` "${doc.title}"` : doc.doc_number ? ` ${doc.doc_number}` : ''}`,
          react: createElement(PreventivoRifiutatoEmail, {
            documentTitle: doc.title ?? doc.doc_number ?? 'Preventivo',
            documentNumber: doc.doc_number ?? undefined,
            workspaceName,
            declinedAt: new Date().toLocaleString('it-IT', {
              day: '2-digit', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
        timeZone: 'Europe/Rome', // il server è UTC
            }),
            documentUrl: `${appUrl}/preventivi/${doc.id}`,
          }),
        })
      }
    }
  } catch (err) {
    console.warn('[decline] Email notification failed (non bloccante):', err)
  }

  return NextResponse.json({ success: true })
}
