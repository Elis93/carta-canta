// ============================================================
// GET /api/preventivi/export-csv
// Esporta tutti i preventivi del workspace come CSV.
// Richiede sessione autenticata.
//
// Colonne: numero, titolo, cliente, totale, stato, data creazione
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

const STATUS_LABELS: Record<string, string> = {
  draft:    'Bozza',
  sent:     'Inviato',
  viewed:   'Visto',
  accepted: 'Accettato',
  rejected: 'Rifiutato',
  expired:  'Scaduto',
}

function escapeCsv(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Racchiude in virgolette se contiene virgole, virgolette o newline
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

  const { data: documents } = await supabase
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
    .order('doc_year',   { ascending: false, nullsFirst: false })
    .order('doc_seq',    { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  // ── Costruisci CSV ───────────────────────────────────────
  const header = ['Numero', 'Titolo', 'Cliente', 'Totale', 'Valuta', 'Stato', 'Data creazione']
  const rows = (documents ?? []).map((doc) => {
    const client = doc.clients as { name: string } | null
    const date = doc.created_at
      ? new Date(doc.created_at).toLocaleDateString('it-IT', {
          day: '2-digit', month: '2-digit', year: 'numeric',
        })
      : ''
    return [
      escapeCsv(doc.doc_number),
      escapeCsv(doc.title),
      escapeCsv(client?.name),
      escapeCsv(doc.total != null ? String(Number(doc.total).toFixed(2)) : ''),
      escapeCsv(doc.currency),
      escapeCsv(STATUS_LABELS[doc.status] ?? doc.status),
      escapeCsv(date),
    ].join(',')
  })

  const csv = [header.join(','), ...rows].join('\r\n')

  const today = new Date().toISOString().split('T')[0]
  const filename = `preventivi-${today}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
