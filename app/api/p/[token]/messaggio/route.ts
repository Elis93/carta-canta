// ============================================================
// POST /api/p/[token]/messaggio
// Pubblica — no auth. Il cliente scrive un messaggio all'artigiano
// DALLA PAGINA DEL DOCUMENTO (richiesta Eli 4 ago: "aggiungerei un tasto
// per le richieste tramite app e non solo email").
//
// Dove finisce: nel `document_log` del documento (voce `client_message`)
// → compare nella CRONOLOGIA di quel preventivo/fattura e nella campanella.
// Scelta deliberata: il messaggio riguarda QUEL documento, quindi vive lì —
// /richieste resta per i contatti di sconosciuti dalla vetrina.
// Nessuna migration: il document_log esiste dalla 034.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { ClientMessageEmail } from '@/lib/email/templates/client_message'
import { checkPublicRateLimit, rateLimitResponse } from '@/lib/public-rate-limit'
import { clientIpFrom } from '@/lib/client-ip'
import { formatDocNumber, docTypeLabel, docTypePath } from '@/lib/utils'

const MAX_LEN = 1000

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  // ⚠️ Prima il limite per CHI scrive, poi quello per documento. Il limite per
  // token da solo non basta: chi ha più documenti dello stesso artigiano (un
  // condominio, un cliente abituale) può moltiplicare le email restando nei
  // limiti di ciascun link. E siccome questo controllo viene prima della
  // ricerca del documento, martellare indirizzi inventati non lascia in giro
  // una chiave nuova a ogni tentativo.
  const ip = clientIpFrom(request.headers)
  const rlIp = await checkPublicRateLimit({ key: `msgip:${ip ?? 'sconosciuto'}`, limit: 10, window: '1 h', windowMs: 3_600_000 })
  if (rlIp.blocked) {
    return rateLimitResponse(rlIp.resetAt, 'Hai già inviato alcuni messaggi. Riprova più tardi.')
  }

  let text = ''
  try {
    const body = await request.json().catch(() => ({}))
    if (typeof body.message === 'string') text = body.message.trim().slice(0, MAX_LEN)
  } catch { /* body illeggibile */ }
  if (text.length < 3) {
    return NextResponse.json({ error: 'Scrivi il tuo messaggio prima di inviarlo.' }, { status: 400 })
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- document_log (034) non ancora in types/database.ts
  const db = admin as any

  const { data: doc } = await db
    .from('documents')
    .select('id, doc_type, doc_number, status, workspace_id, document_log, workspaces!workspace_id ( owner_id, ragione_sociale, name )')
    .eq('public_token', token)
    .is('deleted_at', null)
    .maybeSingle()

  if (!doc) return NextResponse.json({ error: 'Documento non trovato.' }, { status: 404 })
  // Documenti chiusi (accettato/rifiutato/annullato): il canale resta aperto
  // solo finché il documento è vivo — dopo, il cliente ha i recapiti diretti.
  if (doc.status === 'draft') {
    return NextResponse.json({ error: 'Documento non disponibile.' }, { status: 404 })
  }

  // Limite per documento: un link condiviso non deve diventare un canale di spam.
  const rl = await checkPublicRateLimit({ key: `msg:${token}`, limit: 5, window: '1 h', windowMs: 3_600_000 })
  if (rl.blocked) {
    return rateLimitResponse(rl.resetAt, 'Hai già inviato alcuni messaggi. Riprova più tardi.')
  }

  const at = new Date().toISOString()
  const current = Array.isArray(doc.document_log) ? doc.document_log : []
  const { error: logErr } = await db
    .from('documents')
    .update({ document_log: [...current, { type: 'client_message', at, text }] })
    .eq('id', doc.id)

  if (logErr) {
    console.error('[p/messaggio] scrittura messaggio fallita:', logErr)
    return NextResponse.json({ error: 'Invio non riuscito. Riprova.' }, { status: 500 })
  }

  // Avviso all'artigiano via email (best-effort: il messaggio è già salvato
  // e compare comunque in app, nella cronologia e nella campanella).
  try {
    const ws = doc.workspaces as { owner_id: string; ragione_sociale: string | null; name: string | null } | null
    if (ws?.owner_id) {
      const { data: ownerData } = await admin.auth.admin.getUserById(ws.owner_id)
      const ownerEmail = ownerData?.user?.email
      if (ownerEmail) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'
        // Tipo VERO, mai per esclusione (regola 9 ago): la nota di credito
        // usciva come «preventivo» e l'URL della nota era comunque /fatture.
        const label = docTypeLabel(doc.doc_type).toLowerCase()
        const laLabel = /^(fattur|nota)/.test(label) ? `la ${label}` : `il ${label}`
        await sendEmail({
          to: ownerEmail,
          subject: `Messaggio dal cliente su ${laLabel} ${doc.doc_number ? formatDocNumber(doc.doc_number) : ''}`.trim(),
          react: createElement(ClientMessageEmail, {
            docLabel: label,
            docNumber: doc.doc_number ? formatDocNumber(doc.doc_number) : null,
            message: text,
            docUrl: `${appUrl}/${docTypePath(doc.doc_type)}/${doc.id}#messaggi`,
          }),
        })
      }
    }
  } catch (err) {
    console.warn('[p/messaggio] email di avviso non inviata (non bloccante):', err)
  }

  return NextResponse.json({ success: true })
}
