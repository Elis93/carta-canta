// ============================================================
// POST /api/webhooks/sdi?secret=...
// Riceve gli esiti SDI dal provider e li mappa sugli stati della fattura:
// consegnata · mancata_consegna (valida comunque) · scartata (→ email).
//
// Accetta DUE forme di payload:
//  1) normalizzata (mock/prove a mano):
//     { provider_id, esito: 'consegnata'|'mancata_consegna'|'scartata', message? }
//  2) reale OpenAPI (adattatore tollerante, lib/sdi/esito.ts): ogni notifica
//     viene ACCOPPIATA all'UUID presente nello stesso oggetto — un payload
//     con più notifiche (NS per X, RC per Y) non incrocia mai esito e
//     fattura (review 23 lug M1). Ciò che non si riconosce → log troncato
//     (calibrazione sandbox) + 422 (il retry del provider ci riprova dopo
//     un'eventuale correzione dell'adattatore).
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { z } from 'zod/v4'
import { createAdminClient } from '@/lib/supabase/admin'
import { extractNotificationEvents, extractUuidCandidates } from '@/lib/sdi/esito'
import { sendSdiScartataEmail } from '@/lib/sdi/scartata-email'

const BodySchema = z.object({
  provider_id: z.string().min(1),
  esito: z.enum(['consegnata', 'mancata_consegna', 'scartata']),
  message: z.string().max(500).optional(),
})

// Tetto anti-abuso: mai più di 10 notifiche/candidati per chiamata
// (una query DB per candidato — review 23 lug B1).
const MAX_JOBS = 10

interface Job {
  candidates: string[]
  esito: 'consegnata' | 'mancata_consegna' | 'scartata'
  message: string | null
}

// Confronto a tempo costante: non rivela la lunghezza/prefisso del segreto
// tramite differenze di tempo di risposta.
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ba.length !== bb.length) return false
  return timingSafeEqual(ba, bb)
}

export async function POST(request: NextRequest) {
  const secret = process.env.SDI_WEBHOOK_SECRET
  // Segreto preferibilmente in header (X-Webhook-Secret): a differenza della
  // query string non finisce nei log di proxy/CDN. La query string resta
  // accettata per retrocompatibilità col provider finché non si configura l'header.
  const provided =
    request.headers.get('x-webhook-secret') ??
    request.nextUrl.searchParams.get('secret') ??
    ''
  if (!secret || !safeEqual(provided, secret)) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  let raw: unknown
  try {
    raw = await request.json()
  } catch {
    return NextResponse.json({ error: 'Payload non valido' }, { status: 400 })
  }

  // ── Costruzione dei job (forma normalizzata O adattatore OpenAPI) ──
  let jobs: Job[]
  const parsed = BodySchema.safeParse(raw)
  if (parsed.success) {
    jobs = [{ candidates: [parsed.data.provider_id], esito: parsed.data.esito, message: parsed.data.message ?? null }]
  } else {
    const events = extractNotificationEvents(raw).filter((e) => e.esito !== null)
    const paired = events.filter((e) => e.uuid)
    if (paired.length > 0) {
      // Ogni notifica lavora SOLO col suo uuid accoppiato.
      jobs = paired.slice(0, MAX_JOBS).map((e) => ({
        candidates: [e.uuid as string],
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- filtrato sopra
        esito: e.esito!,
        message: e.message,
      }))
    } else if (events.length === 1) {
      // Una sola notifica senza uuid accoppiato: si può usare l'insieme
      // dei candidati globali senza rischio di incrocio.
      const candidates = extractUuidCandidates(raw).slice(0, MAX_JOBS)
      if (candidates.length === 0) {
        console.warn('[webhooks/sdi] notifica senza uuid:', JSON.stringify(raw).slice(0, 500))
        return NextResponse.json({ error: 'Payload senza identificativo fattura' }, { status: 422 })
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- filtrato sopra
      jobs = [{ candidates, esito: events[0].esito!, message: events[0].message }]
    } else {
      // Zero notifiche riconosciute, o PIÙ notifiche senza uuid accoppiati
      // (ambiguo: applicarle a caso rischierebbe l'incrocio esito↔fattura).
      console.warn('[webhooks/sdi] payload non riconosciuto o ambiguo:', JSON.stringify(raw).slice(0, 500))
      return NextResponse.json({ error: 'Payload non riconosciuto' }, { status: 422 })
    }
  }

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
  const db = admin as any

  let processed = 0
  let skipped = 0
  for (const job of jobs) {
    // Primo candidato che corrisponde a una fattura trasmessa da noi.
    let doc: { id: string; doc_number: string | null; workspace_id: string; sdi_status: string | null } | null = null
    for (const candidate of job.candidates) {
      const { data } = await db
        .from('documents')
        .select('id, doc_number, workspace_id, sdi_provider_id, sdi_status')
        .eq('sdi_provider_id', candidate)
        .maybeSingle()
      if (data) { doc = data; break }
    }
    if (!doc) {
      console.warn('[webhooks/sdi] nessuna fattura per gli id:', job.candidates.join(', ').slice(0, 200))
      skipped++
      continue
    }

    // Solo la transizione da 'inviata' è valida: un webhook duplicato o in
    // ritardo non deve riportare indietro un esito già registrato
    // (es. 'consegnata' che torna 'scartata' per un retry del provider).
    if (doc.sdi_status !== 'inviata') { skipped++; continue }

    const { error } = await db
      .from('documents')
      .update({
        sdi_status: job.esito,
        sdi_updated_at: new Date().toISOString(),
        sdi_error: job.esito === 'scartata' ? (job.message ?? 'Scartata dallo SDI') : null,
      })
      .eq('id', doc.id)
      .eq('sdi_status', 'inviata')
    if (error) {
      console.error('[webhooks/sdi] update fallito:', error)
      return NextResponse.json({ error: 'Aggiornamento non riuscito' }, { status: 500 })
    }
    processed++

    // Scartata → anche EMAIL all'artigiano (decisione Eli; la notifica in
    // app la calcola la campanella dai dati)
    if (job.esito === 'scartata') {
      await sendSdiScartataEmail(admin, doc.workspace_id, doc.id, doc.doc_number, job.message)
    }
  }

  if (processed === 0 && skipped > 0) {
    // Tutto già registrato o fatture non nostre: idempotente, nessun retry.
    return NextResponse.json({ success: true, skipped })
  }
  if (processed === 0) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })
  return NextResponse.json({ success: true, processed, skipped })
}
