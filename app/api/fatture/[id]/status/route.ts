// PATCH /api/fatture/[id]/status
// Cambia stato di una fattura manualmente.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  draft:   ['accepted', 'rejected'],
  sent:    ['accepted', 'rejected'],
  viewed:  ['accepted', 'rejected'],
}

const BodySchema = z.object({
  status: z.enum(['accepted', 'rejected']),
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

  // RLS garantisce già che solo i workspace_members vedano il documento
  const { data: doc } = await supabase
    .from('documents')
    .select('id, status, doc_type, workspace_id, total')
    .eq('id', id)
    .eq('doc_type', 'fattura')
    .maybeSingle()

  if (!doc) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })

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
  const total = Number(doc.total ?? 0)
  const paidAmount = body.status === 'accepted' ? (body.paid_amount ?? total) : null
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

  // Pagamento pieno: registra anche i campi incasso (tollerante pre-migration —
  // lo stato è già salvato, il Bilancio ha comunque il fallback su accepted_at).
  if (body.status === 'accepted') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
      await supabase
        .from('documents')
        .update({
          payment_status: 'paid',
          paid_amount: paidAmount,
          paid_at: paidAtIso,
        } as any)
        .eq('id', id)
    } catch { /* colonne mancanti */ }
  }

  revalidatePath('/fatture')
  revalidatePath(`/fatture/${id}`)

  return NextResponse.json({ success: true, status: body.status })
}
