// POST /api/preventivi/[id]/converti-fattura
// Converte un preventivo accettato in fattura (bozza).
// Richiede autenticazione — usa RLS-aware client.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  // Leggi body opzionale
  let forceAccept = false
  try {
    const body = await req.json().catch(() => ({})) as { forceAccept?: boolean }
    forceAccept = body.forceAccept === true
  } catch { /* body assente */ }

  // Verifica workspace — supporta sia owner che workspace_members
  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .limit(1)
      .maybeSingle()
    if (membership) {
      const { data: mw } = await supabase
        .from('workspaces').select('id')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }

  if (!workspace) return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 })

  // Verifica che il documento esista e sia un preventivo del workspace
  const { data: doc } = await supabase
    .from('documents')
    .select('id, status, doc_type')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (!doc) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })
  if (doc.doc_type !== 'preventivo') return NextResponse.json({ error: 'Non è un preventivo' }, { status: 400 })

  // Se non accettato e forceAccept=true → lo segniamo accettato prima di convertire
  if (doc.status !== 'accepted') {
    if (!forceAccept) {
      return NextResponse.json(
        { error: 'Il preventivo deve essere accettato per convertirlo in fattura' },
        { status: 400 }
      )
    }
    const { error: acceptError } = await supabase
      .from('documents')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', workspace.id)
    if (acceptError) {
      console.error('[converti-fattura] accept error', acceptError)
      return NextResponse.json({ error: 'Errore durante la conferma del preventivo' }, { status: 500 })
    }
  }

  // Chiama la funzione PG
  const { data: newId, error } = await supabase.rpc('convert_preventivo_to_fattura', { p_doc_id: id })

  if (error) {
    console.error('[converti-fattura]', error)
    return NextResponse.json({ error: error.message ?? 'Errore nella conversione' }, { status: 500 })
  }

  return NextResponse.json({ success: true, fattura_id: newId })
}
