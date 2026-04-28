// PATCH /api/preventivi/[id]/status
// Autenticato — cambia stato di un documento manualmente.

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod/v4'
import { createClient } from '@/lib/supabase/server'

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  sent:     ['rejected', 'expired'],
  viewed:   ['rejected', 'expired'],
  rejected: ['sent'],
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
    .select('id, status, workspace_id')
    .eq('id', id)
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

  const { error } = await supabase
    .from('documents')
    .update({ status: body.status })
    .eq('id', id)

  if (error) {
    console.error('[status] DB update error:', error)
    return NextResponse.json({ error: 'Errore nel salvataggio' }, { status: 500 })
  }

  return NextResponse.json({ success: true, status: body.status })
}
