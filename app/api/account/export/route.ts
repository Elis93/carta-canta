// ============================================================
// GET /api/account/export
// Portabilità dei dati (GDPR art. 20): scarica in un unico file JSON
// TUTTI i dati dell'utente/workspace — account, clienti, preventivi e
// fatture (con le voci), spese del bilancio.
//
// Sola lettura: non cancella e non modifica nulla. La cancellazione
// dell'account resta gestita via email (nodo conservazione fiscale).
// Richiede sessione autenticata; esporta solo il proprio workspace.
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { guardExport } from '@/lib/security/export-guard'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  // ── Risolvi il workspace (owner, poi membro invitato) ───────────────────
  let { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
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
        .from('workspaces').select('*')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }

  if (!workspace) return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 })

  // Freno e traccia sugli export massivi (audit 5 ago): prima di leggere
  // qualsiasi dato. Non cambia cosa esce, solo quante volte può uscire.
  const bloccato = await guardExport({ userId: user.id, workspaceId: workspace.id, what: 'account' })
  if (bloccato) return bloccato

  const wsId = workspace.id

  // ── Clienti ─────────────────────────────────────────────────────────────
  // Paginati (26 lug): l'export GDPR deve essere COMPLETO — oltre il tetto
  // righe dell'API una query secca ne restituirebbe solo una parte, senza
  // errore, e l'artigiano crederebbe di avere tutti i suoi dati.
  const { data: clients, error: clientsErr } = await fetchAllRows(() => supabase
    .from('clients')
    .select('*')
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: true }))

  // ── Documenti (preventivi + fatture) con le voci ────────────────────────
  const { data: documents, error: docsErr } = await fetchAllRows<{ id: string }>(() => supabase
    .from('documents')
    .select('*')
    .eq('workspace_id', wsId)
    .order('created_at', { ascending: true }))

  // Un export GDPR parziale è peggio di nessun export: l'artigiano crederebbe
  // di avere tutti i suoi dati. Meglio fermarsi e dirlo (26 lug).
  if (clientsErr || docsErr) {
    console.error('[account/export] lettura non riuscita:', clientsErr ?? docsErr)
    return NextResponse.json(
      { error: 'Non è stato possibile leggere tutti i tuoi dati: riprova tra qualche secondo. Il file non è stato creato per non dartelo incompleto.' },
      { status: 500 },
    )
  }

  const docIds = (documents ?? []).map((d) => d.id)

  // Voci: chunk per evitare .in() troppo grandi
  type Item = Record<string, unknown> & { document_id: string }
  const itemsByDoc: Record<string, Item[]> = {}
  for (let i = 0; i < docIds.length; i += 200) {
    const slice = docIds.slice(i, i + 200)
    if (slice.length === 0) break
    const { data: items } = await supabase
      .from('document_items')
      .select('*')
      .in('document_id', slice)
      .order('sort_order', { ascending: true })
    for (const it of (items ?? []) as Item[]) {
      ;(itemsByDoc[it.document_id] ??= []).push(it)
    }
  }

  const documentsWithItems = (documents ?? []).map((d) => ({
    ...d,
    voci: itemsByDoc[d.id] ?? [],
  }))

  // ── Spese del bilancio (tabella 038, tollerante se assente) ─────────────
  let expenses: unknown[] = []
  try {
    const { data } = await fetchAllRows(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 038 non in types/database.ts
      (supabase as any)
        .from('expenses')
        .select('*')
        .eq('workspace_id', wsId)
        .order('spent_at', { ascending: true }))
    expenses = data ?? []
  } catch { /* tabella spese non presente */ }

  // ── Componi il pacchetto ────────────────────────────────────────────────
  const payload = {
    _info: {
      descrizione: 'Esportazione completa dei tuoi dati da Carta Canta (portabilità GDPR, art. 20).',
      esportato_il: new Date().toISOString(),
      formato: 'JSON',
    },
    account: {
      email: user.email ?? null,
      user_id: user.id,
      registrato_il: user.created_at ?? null,
    },
    attivita: workspace,
    clienti: clients ?? [],
    preventivi_e_fatture: documentsWithItems,
    spese: expenses,
  }

  const json = JSON.stringify(payload, null, 2)
  const today = new Date().toISOString().split('T')[0]

  return new NextResponse(json, {
    status: 200,
    headers: {
      'Content-Type':        'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="carta-canta-dati-${today}.json"`,
      'Cache-Control':       'no-store',
    },
  })
}
