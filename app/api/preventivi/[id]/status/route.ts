// PATCH /api/preventivi/[id]/status
// Autenticato — cambia stato di un documento manualmente.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { createClient } from '@/lib/supabase/server'
import { isMissingColumnError } from '@/lib/supabase/errors'

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  sent:     ['accepted', 'rejected', 'expired'],
  viewed:   ['accepted', 'rejected', 'expired'],
  rejected: ['sent'],
  // "Riapri (torna a Inviato)" dal dropdown — senza questa chiave il bottone
  // esisteva ma la PATCH rispondeva sempre 409.
  expired:  ['sent'],
  // "Riporta in bozza" (22 lug 2026): SOLO per accettazioni MANUALI
  // ("Segna accettato" per errore) — guardie più sotto: mai se il cliente
  // ha accettato/firmato dalla pagina pubblica (signer_name/accepted_ip =
  // prova FES da non distruggere) e mai con una fattura collegata.
  accepted: ['draft'],
}

const BodySchema = z.object({
  status: z.enum(['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired']),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Stato non valido' }, { status: 400 })
  }

  // Carica documento — RLS garantisce già che solo i workspace_members lo vedano
  const { data: doc } = await supabase
    .from('documents')
    .select('id, status, workspace_id, validity_days, doc_type, signer_name, accepted_ip')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!doc) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })

  // Verifica membership esplicita (coerente con RLS is_workspace_member)
  const { data: isMember } = await supabase
    .rpc('is_workspace_member', { p_workspace_id: doc.workspace_id })
  if (!isMember) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  // Verifica transizione consentita
  const allowed = ALLOWED_TRANSITIONS[doc.status] ?? []
  if (!allowed.includes(body.status)) {
    return NextResponse.json(
      { error: `Transizione da "${doc.status}" a "${body.status}" non consentita` },
      { status: 409 }
    )
  }

  // ── "Riporta in bozza" da accettato: SOLO accettazioni manuali ──
  const unaccepting = doc.status === 'accepted' && body.status === 'draft'
  if (unaccepting) {
    // Questa route serve i PREVENTIVI: una fattura 'accepted' (= pagata)
    // non si riporta in bozza da qui (ha il suo flusso con azzeramento
    // dei dati di pagamento).
    if (doc.doc_type !== 'preventivo') {
      return NextResponse.json({ error: 'Operazione non disponibile per questo documento' }, { status: 409 })
    }
    // Accettato/firmato DAL CLIENTE dalla pagina pubblica → prova FES
    // (firma, IP): non si annulla da qui.
    if (doc.signer_name || doc.accepted_ip != null) {
      return NextResponse.json(
        { error: 'Questo preventivo è stato accettato dal cliente: l’accettazione registrata non si può annullare.' },
        { status: 409 }
      )
    }
    // Fattura collegata (anche in bozza): riportare il preventivo in bozza
    // lascerebbe una fattura che nasce da un documento non più accettato.
    // Guardia di coerenza → FAIL-CLOSED: se la verifica stessa fallisce
    // non si procede (review 22 lug B1).
    const { data: linkedFattura, error: linkErr } = await supabase
      .from('documents')
      .select('id')
      .eq('origin_document_id', id)
      .eq('doc_type', 'fattura')
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()
    if (linkErr) {
      console.error('[preventivi/status] verifica fattura collegata fallita:', linkErr)
      return NextResponse.json({ error: 'Verifica non riuscita. Riprova.' }, { status: 500 })
    }
    if (linkedFattura) {
      return NextResponse.json(
        { error: 'C’è una fattura collegata a questo preventivo: eliminala (o scollegala) prima di riportarlo in bozza.' },
        { status: 409 }
      )
    }

    // Update DEDICATO e condizionato sullo stato (anti-race con un "Converti
    // in fattura" concorrente, review 22 lug B2): se un'altra richiesta ha
    // già mosso lo stato, qui 0 righe → 409.
    const { data: reverted, error: revErr } = await supabase
      .from('documents')
      .update({ status: 'draft', accepted_at: null })
      .eq('id', id)
      .eq('status', 'accepted')
      .select('id')
    if (revErr) {
      console.error('[preventivi/status] riporta in bozza fallito:', revErr)
      return NextResponse.json({ error: 'Errore nel salvataggio' }, { status: 500 })
    }
    if (!reverted || reverted.length === 0) {
      return NextResponse.json({ error: 'Lo stato del preventivo è cambiato nel frattempo: ricarica la pagina.' }, { status: 409 })
    }

    // Azzera l'eventuale ACCONTO registrato sull'accettazione (M1 review 22
    // lug, gemello del riattiva-fattura): senza, l'acconto resterebbe
    // invisibile in bozza ma contato nelle Entrate del Bilancio, e
    // riapparirebbe stantio alla ri-accettazione. Best-effort, tollerante
    // pre-migration 038.
    const resetPatch = {
      payment_status: null,
      paid_amount: null,
      paid_at: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
    } as any
    const { error: resetErr } = await supabase.from('documents').update(resetPatch).eq('id', id)
    if (resetErr && !isMissingColumnError(resetErr)) {
      console.error('[preventivi/status] azzeramento acconto al riporta-in-bozza non riuscito:', resetErr)
    }

    return NextResponse.json({ success: true, status: 'draft' })
  }

  // Riapertura di uno scaduto: senza rinnovare expires_at il cron lo
  // rimarcherebbe 'expired' la notte stessa (la scadenza è nel passato).
  const reopening = doc.status === 'expired' && body.status === 'sent'
  const renewDays = Number(doc.validity_days) > 0 ? Math.floor(Number(doc.validity_days)) : 30
  const renewedExpiry = new Date(Date.now() + renewDays * 24 * 60 * 60 * 1000).toISOString()

  const { error } = await supabase
    .from('documents')
    .update(
      body.status === 'accepted'
        ? { status: body.status, accepted_at: new Date().toISOString() }
        : reopening
          ? { status: body.status, expires_at: renewedExpiry }
          : { status: body.status }
    )
    .eq('id', id)

  if (error) {
    console.error('[status] DB update error:', error)
    return NextResponse.json({ error: 'Errore nel salvataggio' }, { status: 500 })
  }

  return NextResponse.json({ success: true, status: body.status })
}
