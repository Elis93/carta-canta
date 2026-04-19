// POST /api/preventivi/[id]/converti-fattura
// Converte un preventivo accettato in fattura (bozza).
// Richiede autenticazione — usa RLS-aware client.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })

  // Verifica workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 })

  // Verifica che il documento esista, sia del workspace e sia accettato
  const { data: doc } = await supabase
    .from('documents')
    .select('id, status, doc_type')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (!doc) return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })
  if (doc.doc_type !== 'preventivo') return NextResponse.json({ error: 'Non è un preventivo' }, { status: 400 })
  if (doc.status !== 'accepted') return NextResponse.json({ error: 'Il preventivo deve essere accettato per convertirlo in fattura' }, { status: 400 })

  // Chiama la funzione PG
  const { data: newId, error } = await supabase.rpc('convert_preventivo_to_fattura', { p_doc_id: id })

  if (error) {
    console.error('[converti-fattura]', error)
    return NextResponse.json({ error: error.message ?? 'Errore nella conversione' }, { status: 500 })
  }

  return NextResponse.json({ success: true, fattura_id: newId })
}
