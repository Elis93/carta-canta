// ============================================================
// POST /api/fatture/[id]/sdi/reclaim — sblocca una fattura "orfana"
// (scelta Eli 25 lug 2026).
// Caso: un crash tecnico tra il claim ('inviata') e l'invio effettivo lascia
// la fattura bloccata su 'Inviata' SENZA che nulla sia stato trasmesso
// (sdi_sent_at e sdi_provider_id restano NULL). Senza questa via l'utente
// non potrebbe più né trasmettere né correggere.
//
// SICUREZZA anti doppia-trasmissione: lo sblocco è consentito SOLO se non
// c'è NESSUNA traccia di invio riuscito (sia sdi_sent_at sia sdi_provider_id
// devono essere NULL). Se uno dei due è valorizzato, la fattura È stata
// trasmessa → NON si sblocca (si usa "Controlla l'esito ora").
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceForUser } from '@/lib/actions/resolve-workspace'

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
    .select('id, sdi_status, sdi_sent_at, sdi_provider_id')
    .eq('id', id)
    .eq('workspace_id', ws.id)
    .eq('doc_type', 'fattura')
    .is('deleted_at', null)
    .maybeSingle()
  if (!doc) return NextResponse.json({ error: 'Fattura non trovata' }, { status: 404 })

  if (doc.sdi_status !== 'inviata') {
    return NextResponse.json({ error: 'La fattura non è in stato "Inviata": non c’è nulla da sbloccare.' }, { status: 409 })
  }
  // Traccia di invio riuscito → NON sbloccare (eviterebbe una doppia trasmissione).
  if (doc.sdi_sent_at || doc.sdi_provider_id) {
    return NextResponse.json(
      { error: 'La fattura risulta trasmessa allo SDI: usa "Controlla l’esito ora" invece di sbloccarla.' },
      { status: 409 }
    )
  }

  // Reset condizionato (anti-race): solo se è ancora 'inviata' e senza provider_id.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
  const { data: updated, error } = await (supabase as any)
    .from('documents')
    .update({ sdi_status: null, sdi_error: null, sdi_updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('sdi_status', 'inviata')
    .is('sdi_provider_id', null)
    .is('sdi_sent_at', null)
    .select('id')
  if (error || !updated || updated.length === 0) {
    return NextResponse.json({ error: 'Sblocco non riuscito: la fattura risulta già in trasmissione.' }, { status: 409 })
  }

  return NextResponse.json({ success: true })
}
