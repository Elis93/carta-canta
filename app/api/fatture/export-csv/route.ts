// ============================================================
// GET /api/fatture/export-csv
// Esporta tutte le fatture del workspace come CSV.
// Richiede sessione autenticata.
//
// Colonne: numero, titolo, cliente, totale, valuta, stato, data creazione
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const STATUS_LABELS: Record<string, string> = {
  draft:    'Bozza',
  sent:     'Inviata',
  viewed:   'Visualizzata',
  accepted: 'Pagata',
  rejected: 'Annullata',
  expired:  'Scaduta',
}

function escapeCsv(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) {
    // Fallback: utente membro invitato
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

  const { data: fatture } = await supabase
    .from('documents')
    .select(`
      doc_number,
      title,
      status,
      total,
      currency,
      created_at,
      clients(name)
    `)
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'fattura')
    .order('created_at', { ascending: false })

  // ── Costruisci CSV ───────────────────────────────────────
  const header = ['Numero', 'Titolo', 'Cliente', 'Totale', 'Valuta', 'Stato', 'Data creazione']
  const rows = (fatture ?? []).map((ft) => {
    const client = ft.clients as { name: string } | null
    const date = ft.created_at
      ? new Date(ft.created_at).toLocaleDateString('it-IT', {
          day: '2-digit', month: '2-digit', year: 'numeric',
        })
      : ''
    return [
      escapeCsv(ft.doc_number),
      escapeCsv(ft.title),
      escapeCsv(client?.name),
      escapeCsv(ft.total != null ? String(Number(ft.total).toFixed(2)) : ''),
      escapeCsv(ft.currency),
      escapeCsv(STATUS_LABELS[ft.status] ?? ft.status),
      escapeCsv(date),
    ].join(',')
  })

  const csv = [header.join(','), ...rows].join('\r\n')

  const today = new Date().toISOString().split('T')[0]
  const filename = `fatture-${today}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
