// ============================================================
// GET /api/catalogo/export-csv
// Esporta tutto il catalogo del workspace come CSV (formato
// italiano: BOM + ';' + virgola decimale, come gli altri export).
// Portabilità dei dati (ricerca 2 ago: "dati intrappolati" è tra
// le lamentele più comuni sui gestionali) — il listino è
// dell'artigiano e se lo porta via quando vuole.
// Include il costo d'acquisto (062): è il SUO file privato —
// la regola B.2 vieta il costo al CLIENTE, non al titolare.
// ============================================================

import { NextResponse } from 'next/server'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { createClient } from '@/lib/supabase/server'
import { guardExport } from '@/lib/security/export-guard'

function escapeCsv(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const raw = String(value)
  const str = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw
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

  // Freno e traccia sugli export massivi (audit 5 ago): prima di leggere
  // qualsiasi dato. Non cambia cosa esce, solo quante volte può uscire.
  const bloccato = await guardExport({ userId: user.id, workspaceId: workspace.id, what: 'catalogo' })
  if (bloccato) return bloccato

  const { data: items, error: itemsErr } = await fetchAllRows(() =>
    supabase
      .from('catalog_items')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('category', { ascending: true, nullsFirst: false })
      .order('name', { ascending: true })
  )
  if (itemsErr) {
    console.error('[export catalogo] lettura non riuscita:', itemsErr)
    return NextResponse.json(
      { error: 'Non è stato possibile leggere tutto il catalogo: riprova tra qualche secondo. Il file non è stato creato per non dartelo incompleto.' },
      { status: 500 },
    )
  }

  const eur = (v: number | null | undefined) =>
    v != null ? Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : ''

  const header = ['Nome', 'Descrizione', 'Categoria', 'Unità', 'Prezzo', 'Costo (solo per te)', 'IVA %', 'Visibile']
  interface CatRow {
    name: string; description: string | null; category: string | null; unit: string
    unit_price: number | null; vat_rate: number | null; is_active: boolean | null
    unit_cost?: number | null
  }
  const rows = ((items ?? []) as CatRow[]).map((it) => [
    escapeCsv(it.name),
    escapeCsv(it.description),
    escapeCsv(it.category),
    escapeCsv(it.unit),
    escapeCsv(eur(it.unit_price)),
    escapeCsv(it.unit_cost != null && Number(it.unit_cost) > 0 ? eur(Number(it.unit_cost)) : ''),
    escapeCsv(it.vat_rate != null ? String(it.vat_rate) : ''),
    escapeCsv(it.is_active === false ? 'No' : 'Sì'),
  ].join(';'))

  const csv = '\ufeff' + [header.join(';'), ...rows].join('\r\n')

  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
  const filename = `catalogo-${today}.csv`

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type':        'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
