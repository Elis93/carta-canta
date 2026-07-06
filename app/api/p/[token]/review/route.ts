// ============================================================
// POST /api/p/[token]/review
// Pubblica — il cliente lascia la recensione (SOLO domande chiuse).
// Consentita SOLO se la fattura è pagata PER INTERO (verificata da un
// lavoro reale — direttiva Omnibus). Una recensione per fattura.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'

const BodySchema = z.object({
  rating_puntualita: z.number().int().min(1).max(5),
  rating_qualita: z.number().int().min(1).max(5),
  rating_preventivo: z.number().int().min(1).max(5),
  rating_pulizia: z.number().int().min(1).max(5),
  recommends: z.boolean(),
})

/** "Mario Rossi" → "Mario R." (minimizzazione dei dati) */
function dottedName(full: string | null | undefined): string | null {
  const parts = (full ?? '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return null
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[parts.length - 1][0].toUpperCase()}.`
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params

  const rl = checkRateLimit(`review:${token}`, { limit: 5, windowMs: 3_600_000 })
  if (!rl.success) {
    return rateLimitResponse(rl.resetAt, 'Troppi tentativi. Riprova più tardi.')
  }

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ error: 'Compila tutte le valutazioni.' }, { status: 400 })
  }

  const admin = createAdminClient()

  const { data: doc } = await admin
    .from('documents')
    .select('id, workspace_id, doc_type, status, clients!client_id ( name, surname, citta )')
    .eq('public_token', token)
    .is('deleted_at', null)
    .maybeSingle()

  if (!doc || doc.doc_type !== 'fattura') {
    return NextResponse.json({ error: 'Documento non trovato.' }, { status: 404 })
  }

  // ── Sblocco: SOLO fattura pagata per intero (mai acconti) ──
  let fullyPaid = false
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
    const { data: pay } = await (admin as any)
      .from('documents')
      .select('payment_status')
      .eq('id', doc.id)
      .maybeSingle()
    fullyPaid = pay?.payment_status === 'paid' || (doc.status === 'accepted' && pay?.payment_status !== 'partial')
  } catch {
    fullyPaid = doc.status === 'accepted'
  }
  if (!fullyPaid) {
    return NextResponse.json({ error: 'La recensione si sblocca quando la fattura è pagata per intero.' }, { status: 403 })
  }

  const client = doc.clients as { name: string | null; surname: string | null; citta: string | null } | null
  const fullName = [client?.name, client?.surname].filter(Boolean).join(' ')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 042 non ancora in types/database.ts
  const { error } = await (admin as any).from('reviews').insert({
    workspace_id: doc.workspace_id,
    document_id: doc.id,
    rating_puntualita: body.rating_puntualita,
    rating_qualita: body.rating_qualita,
    rating_preventivo: body.rating_preventivo,
    rating_pulizia: body.rating_pulizia,
    recommends: body.recommends,
    reviewer_name: dottedName(fullName),
    reviewer_city: client?.citta ?? null,
  })

  if (error) {
    // 23505 = già recensita
    if ((error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Hai già lasciato una recensione per questo lavoro. Grazie!' }, { status: 409 })
    }
    return NextResponse.json({ error: 'Invio non riuscito. Riprova.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
