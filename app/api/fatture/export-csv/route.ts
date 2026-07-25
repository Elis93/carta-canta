// ============================================================
// GET /api/fatture/export-csv
// Esporta tutte le fatture del workspace come CSV.
// Richiede sessione autenticata.
//
// Colonne: numero, titolo, cliente, totale, valuta, stato, data creazione
// ============================================================

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { formatDocNumber } from '@/lib/utils'

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
  // Anti CSV/formula injection: neutralizza il prefisso di formula (= + - @)
  const raw = String(value)
  const str = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
  // Separatore ';' (formato italiano): va quotato anche quello — e la
  // virgola resta quotata perché compare negli importi it-IT.
  if (str.includes(';') || str.includes(',') || str.includes('"') || str.includes('\n')) {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
  const { data: fatture } = await (supabase as any)
    .from('documents')
    .select(`
      doc_number,
      title,
      status,
      total,
      currency,
      created_at,
      payment_status,
      paid_amount,
      clients(name, surname)
    `)
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'fattura')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  // ── Costruisci CSV — formato ITALIANO come gli altri export del repo
  // (review 25 lug D1: prima punto decimale + virgola come separatore +
  // niente BOM → Excel italiano leggeva importi come testo e corrompeva
  // gli accenti; e mancavano cognome e incassato — D2). ───────────────────
  const eur = (v: number | null | undefined) =>
    v != null ? Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''
  const header = ['Numero', 'Titolo', 'Cliente', 'Totale', 'Incassato', 'Valuta', 'Stato', 'Data creazione']
  interface FtRow {
    doc_number: string | null; title: string | null; status: string; total: number | null
    currency: string | null; created_at: string | null
    payment_status?: string | null; paid_amount?: number | null
    clients: { name: string; surname: string | null } | null
  }
  const rows = ((fatture ?? []) as FtRow[]).map((ft) => {
    const client = ft.clients
    const clientName = client ? [client.name, client.surname].filter(Boolean).join(' ') : ''
    const date = ft.created_at
      ? new Date(ft.created_at).toLocaleDateString('it-IT', {
          day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Rome',
        })
      : ''
    const incassato = ft.payment_status === 'paid'
      ? (ft.paid_amount ?? ft.total)
      : ft.payment_status === 'partial'
        ? ft.paid_amount
        : null
    return [
      escapeCsv(ft.doc_number ? formatDocNumber(ft.doc_number, 'fattura') : ''),
      escapeCsv(ft.title),
      escapeCsv(clientName),
      escapeCsv(eur(ft.total)),
      escapeCsv(eur(incassato)),
      escapeCsv(ft.currency),
      escapeCsv(STATUS_LABELS[ft.status] ?? ft.status),
      escapeCsv(date),
    ].join(';')
  })

  // BOM per Excel (accenti corretti) + separatore ';' (locale italiano)
  const csv = '\ufeff' + [header.join(';'), ...rows].join('\r\n')

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
  const filename = `fatture-${today}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
