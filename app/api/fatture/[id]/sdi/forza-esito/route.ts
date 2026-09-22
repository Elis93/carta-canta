// ============================================================
// POST /api/fatture/[id]/sdi/forza-esito — SOLO COLLAUDO/PROVA
// La sandbox OpenAPI non genera gli esiti da sola: nel collaudo di
// luglio si forzavano col curl sul webhook, impraticabile dal telefono.
// Questa route fa la STESSA transizione del webhook (update solo da
// 'inviata', scartata → email, esito positivo → copia di cortesia
// automatica) ma con la sessione dell'artigiano, da un tasto in card.
//
// ⚠️ FAIL-CLOSED IN PRODUZIONE: con sdiAmbiente() === 'reale' risponde
// 404 senza fare nulla — un esito vero lo decide SOLO lo SdI. Il tasto
// in UI è gated allo stesso modo, ma il cancello che conta è questo.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolveWorkspaceForUser } from '@/lib/actions/resolve-workspace'
import { sdiAmbiente } from '@/lib/sdi'
import { sendSdiScartataEmail } from '@/lib/sdi/scartata-email'
import { inviaCopiaCortesiaAutomatica } from '@/lib/documents/copia-cortesia'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

const SDI_ENABLED = process.env.NEXT_PUBLIC_SDI_ENABLED === 'true'

const BodySchema = z.object({
  esito: z.enum(['consegnata', 'mancata_consegna', 'scartata']),
})

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (!SDI_ENABLED) {
    return NextResponse.json({ error: 'La fatturazione elettronica non è ancora attiva.' }, { status: 403 })
  }
  // Il cancello vero: in produzione questa route NON esiste (404, come una
  // rotta mai pubblicata — non sveliamo nemmeno che c'è).
  if (sdiAmbiente() === 'reale') {
    return NextResponse.json({ error: 'Non trovato' }, { status: 404 })
  }

  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const rl = checkRateLimit(`sdi-forza:${user.id}`, { limit: 10, windowMs: 60_000 })
  if (!rl.success) return rateLimitResponse(rl.resetAt, 'Troppi tentativi ravvicinati. Attendi un momento.')

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch {
    return NextResponse.json({ error: 'Esito non valido' }, { status: 400 })
  }

  const ws = await resolveWorkspaceForUser<{ id: string }>(supabase, user.id, 'id')
  if (!ws) return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
  const { data: doc } = await (supabase as any)
    .from('documents')
    .select('id, doc_number, sdi_status')
    .eq('id', id)
    .eq('workspace_id', ws.id)
    .in('doc_type', ['fattura', 'nota_credito', 'nota_debito'])
    .is('deleted_at', null)
    .maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })

  if (doc.sdi_status !== 'inviata') {
    return NextResponse.json(
      { error: 'L’esito si può simulare solo su una fattura «Inviata, attendo esito».' },
      { status: 409 }
    )
  }

  const message = body.esito === 'scartata'
    ? 'Scarto simulato in collaudo (codice di esempio: 00311 — codice destinatario non valido)'
    : null

  // Stessa transizione del webhook: solo da 'inviata', rowcount a guardia
  // dei doppi invii (se un esito vero arrivasse nel frattempo, vince lui).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044
  const { data: changed, error } = await (supabase as any)
    .from('documents')
    .update({
      sdi_status: body.esito,
      sdi_updated_at: new Date().toISOString(),
      sdi_error: body.esito === 'scartata' ? message : null,
    })
    .eq('id', id)
    .eq('sdi_status', 'inviata')
    .select('id')
  if (error) {
    console.error('[sdi/forza-esito] update fallito:', error)
    return NextResponse.json({ error: 'Aggiornamento non riuscito. Riprova.' }, { status: 500 })
  }
  if (!changed || changed.length === 0) {
    return NextResponse.json({ error: 'Un esito è già stato registrato: ricarica la pagina.' }, { status: 409 })
  }

  // Stessi effetti del webhook, così il collaudo prova il giro VERO:
  // scartata → email di scarto · esito positivo → copia di cortesia
  // automatica (Fase 1/2, flag per cliente compreso). Best-effort.
  if (body.esito === 'scartata') {
    await sendSdiScartataEmail(createAdminClient(), ws.id, id, doc.doc_number ?? null, message)
  } else {
    await inviaCopiaCortesiaAutomatica(createAdminClient(), id)
  }

  return NextResponse.json({ success: true, esito: body.esito })
}
