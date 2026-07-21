// PATCH /api/fatture/[id]/status
// Cambia stato di una fattura manualmente.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { createClient } from '@/lib/supabase/server'
import { isMissingColumnError } from '@/lib/supabase/errors'
import { revalidatePath } from 'next/cache'

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft:   ['accepted', 'rejected'],
  sent:    ['accepted', 'rejected'],
  viewed:  ['accepted', 'rejected'],
  // Una fattura SCADUTA è proprio quella da incassare (pagamento in ritardo)
  // o da annullare: senza questa riga l'incasso tardivo era impossibile.
  expired: ['accepted', 'rejected'],
  // Riattiva una fattura annullata (19 lug) → torna in BOZZA, modificabile e
  // reinviabile. Consentito SOLO finché la fattura NON è stata trasmessa allo
  // SdI (guardia più sotto): prassi dei gestionali — prima dello SdI la
  // fattura è una copia di cortesia senza valore fiscale; dopo la trasmissione
  // si corregge solo con nota di credito.
  rejected: ['draft'],
}

const BodySchema = z.object({
  status: z.enum(['accepted', 'rejected', 'draft']),
  // Pagamenti F1: importo ricevuto e data incasso (dialog "Segna come pagata").
  // Importo più basso del totale = acconto → payment_status 'partial',
  // lo stato della fattura NON cambia (resta da incassare per il saldo).
  paid_amount: z.number().positive().optional(),
  paid_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
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

  // RLS garantisce già che solo i workspace_members vedano il documento.
  // sdi_status incluso in modo TOLLERANTE: se la migration 044 non è applicata
  // la colonna non esiste → riproviamo senza (nessuna guardia SdI, coerente
  // con lo SdI spento oggi).
  type FatturaRow = { id: string; status: string; doc_type: string; workspace_id: string; total: number | null; sdi_status?: string | null }
  let doc: FatturaRow | null = null
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- select dinamico + colonna 044 tollerante
    const db = supabase as any
    const runSelect = (cols: string) => db
      .from('documents')
      .select(cols)
      .eq('id', id)
      .eq('doc_type', 'fattura')
      .is('deleted_at', null)
      .maybeSingle()
    let res = await runSelect('id, status, doc_type, workspace_id, total, sdi_status')
    if (res.error && isMissingColumnError(res.error)) {
      res = await runSelect('id, status, doc_type, workspace_id, total')
    }
    doc = (res.data as FatturaRow | null)
  }

  if (!doc) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })

  // ⚖️ Guardia fiscale: una fattura già TRASMESSA allo SdI (stato diverso da
  // "scartata") non si può più annullare né riattivare — è emessa. Si corregge
  // solo con una nota di credito (funzione della fase SdI). Oggi lo SdI è
  // spento → sdi_status resta null → nessun blocco.
  const sdiTransmitted = !!doc.sdi_status && doc.sdi_status !== 'scartata'
  if (sdiTransmitted && (body.status === 'rejected' || body.status === 'draft')) {
    return NextResponse.json(
      { error: 'Questa fattura è già stata trasmessa allo SdI: non si può annullare né riattivare. Per correggerla serve una nota di credito.' },
      { status: 409 }
    )
  }

  // Verifica membership esplicita (coerente con RLS is_workspace_member)
  const { data: isMember } = await supabase
    .rpc('is_workspace_member', { p_workspace_id: doc.workspace_id })
  if (!isMember) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  }

  const allowed = ALLOWED_TRANSITIONS[doc.status] ?? []
  if (!allowed.includes(body.status)) {
    return NextResponse.json(
      { error: `Transizione da "${doc.status}" a "${body.status}" non consentita` },
      { status: 409 }
    )
  }

  // ── Incasso (Pagamenti F1) ────────────────────────────────────────────
  // Un acconto precedente si SOMMA al nuovo incasso (prima veniva
  // sovrascritto: due acconti da 500 € risultavano 500 € invece di 1000 €).
  let alreadyPaid = 0
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
    const { data: payRow } = await (supabase as any)
      .from('documents')
      .select('paid_amount, payment_status')
      .eq('id', id)
      .maybeSingle()
    if (payRow?.payment_status === 'partial') alreadyPaid = Number(payRow.paid_amount ?? 0)
  } catch { /* colonne mancanti pre-migration */ }

  const total = Number(doc.total ?? 0)
  const received = body.status === 'accepted'
    ? (body.paid_amount ?? Math.max(total - alreadyPaid, 0))
    : null
  const paidAmount = received !== null
    ? Math.round((alreadyPaid + received) * 100) / 100
    : null
  if (paidAmount !== null && total > 0 && paidAmount > total + 0.005) {
    const residuo = Math.round((total - alreadyPaid) * 100) / 100
    return NextResponse.json(
      {
        error: alreadyPaid > 0
          ? `L'importo supera quanto resta da incassare (${residuo.toLocaleString('it-IT', { minimumFractionDigits: 2 })}\u00A0€ dopo l'acconto già registrato).`
          : 'L\'importo supera il totale della fattura.',
      },
      { status: 422 }
    )
  }
  const isPartial =
    body.status === 'accepted' && paidAmount !== null && total > 0 && paidAmount < total - 0.005
  const paidAtIso = body.paid_date
    ? new Date(`${body.paid_date}T12:00:00`).toISOString()
    : new Date().toISOString()

  if (isPartial) {
    // Acconto: registra l'incasso parziale SENZA cambiare lo stato —
    // la fattura resta da incassare per il saldo.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
    const { error: partialError } = await supabase
      .from('documents')
      .update({
        payment_status: 'partial',
        paid_amount: paidAmount,
        paid_at: paidAtIso,
      } as any)
      .eq('id', id)

    if (partialError) {
      console.error('[fatture/status] partial payment error:', partialError)
      return NextResponse.json(
        { error: 'Registrazione acconto non riuscita. La migration 038 potrebbe non essere ancora applicata.' },
        { status: 500 }
      )
    }

    revalidatePath('/fatture')
    revalidatePath(`/fatture/${id}`)
    return NextResponse.json({ success: true, status: doc.status, partial: true })
  }

  const { error } = await supabase
    .from('documents')
    .update({
      status: body.status,
      // Imposta accepted_at quando la fattura viene marcata come pagata,
      // così il KPI "valore fatturato" nella dashboard funziona correttamente.
      ...(body.status === 'accepted' ? { accepted_at: new Date().toISOString() } : {}),
    })
    .eq('id', id)

  if (error) {
    console.error('[fatture/status] DB update error:', error)
    return NextResponse.json({ error: 'Errore nel salvataggio' }, { status: 500 })
  }

  // Azzera i dati di pagamento (038) su RIATTIVAZIONE (rejected → draft) e su
  // ANNULLAMENTO (→ rejected). Senza questo:
  //  · in bozza riattivata resterebbe l'acconto stantio e "Segna pagata" andrebbe in 422;
  //  · una fattura ANNULLATA con acconto continuerebbe a contare nelle Entrate del
  //    Bilancio, che seleziona anche `payment_status in (partial,paid)` a prescindere
  //    dallo stato → incasso fantasma di un documento annullato.
  // Best-effort e tollerante pre-migration (colonne 038 assenti → nessun errore bloccante).
  if (body.status === 'draft' || body.status === 'rejected') {
    const resetPatch = {
      payment_status: null,
      paid_amount: null,
      paid_at: null,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
    } as any
    const { error: resetErr } = await supabase.from('documents').update(resetPatch).eq('id', id)
    if (resetErr && !isMissingColumnError(resetErr)) {
      console.error('[fatture/status] azzeramento pagamento in riattivazione non riuscito:', resetErr)
    }
  }

  // Pagamento pieno: registra anche i campi incasso. Senza payment_status
  // 'paid' la recensione non si sblocca e il Bilancio ripiega su accepted_at:
  // un errore REALE qui va riprovato subito (un solo retry), non inghiottito.
  if (body.status === 'accepted') {
    const paidPatch = {
      payment_status: 'paid',
      paid_amount: paidAmount,
      paid_at: paidAtIso,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
    } as any
    const { error: payErr } = await supabase.from('documents').update(paidPatch).eq('id', id)
    if (payErr && !isMissingColumnError(payErr)) {
      const { error: retryErr } = await supabase.from('documents').update(paidPatch).eq('id', id)
      if (retryErr) console.error('[fatture/status] incasso non registrato dopo retry:', retryErr)
    }
  }

  revalidatePath('/fatture')
  revalidatePath(`/fatture/${id}`)

  return NextResponse.json({ success: true, status: body.status })
}
