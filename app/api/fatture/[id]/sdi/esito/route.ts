// ============================================================
// POST /api/fatture/[id]/sdi/esito — "Controlla l'esito ora"
// PULL dell'esito SdI direttamente dal provider (23 lug 2026):
// complementare al webhook — recupera l'esito anche se i callback
// non sono configurati o non arrivano (com'è successo con la prima
// trasmissione sandbox: evento callback sbagliato, mai chiamati).
// Nessuna trasmissione: sola lettura dello stato presso il provider.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceForUser } from '@/lib/actions/resolve-workspace'
import { getSdiProvider } from '@/lib/sdi'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const ws = await resolveWorkspaceForUser<{ id: string }>(supabase, user.id, 'id')
  if (!ws) return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
  const { data: doc } = await (supabase as any)
    .from('documents')
    .select('id, sdi_status, sdi_provider_id')
    .eq('id', id)
    .eq('workspace_id', ws.id)
    .eq('doc_type', 'fattura')
    .is('deleted_at', null)
    .maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })

  // Esito già registrato (dal webhook o da un pull precedente) → riportalo.
  if (doc.sdi_status && doc.sdi_status !== 'inviata') {
    return NextResponse.json({ esito: doc.sdi_status, already: true })
  }
  if (doc.sdi_status !== 'inviata' || !doc.sdi_provider_id) {
    return NextResponse.json({ error: 'Questa fattura non risulta trasmessa allo SDI.' }, { status: 409 })
  }

  const result = await getSdiProvider().fetchEsito(String(doc.sdi_provider_id))
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })
  if (!result.esito) return NextResponse.json({ esito: null, pending: true })

  // Stessa transizione del webhook: solo da 'inviata', mai regressioni.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044
  const { error } = await (supabase as any)
    .from('documents')
    .update({
      sdi_status: result.esito,
      sdi_updated_at: new Date().toISOString(),
      sdi_error: result.esito === 'scartata' ? (result.message ?? 'Scartata dallo SDI') : null,
    })
    .eq('id', id)
    .eq('sdi_status', 'inviata')
  if (error) {
    console.error('[sdi/esito] update fallito:', error)
    return NextResponse.json({ error: 'Aggiornamento non riuscito. Riprova.' }, { status: 500 })
  }

  return NextResponse.json({ esito: result.esito, message: result.message })
}
