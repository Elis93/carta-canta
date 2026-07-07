// ============================================================
// GET /api/bilancio/export?from=YYYY-MM-DD&to=YYYY-MM-DD
// Esporta il bilancio (entrate + uscite) in CSV per il periodo scelto —
// formato pensato per il commercialista: separatore ";" (Excel italiano),
// BOM UTF-8, importi con la virgola. Feature Pro come il Bilancio.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { formatDocNumber } from '@/lib/utils'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

function csvCell(v: string): string {
  return /[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v
}
function itAmount(n: number): string {
  return n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function itDate(d: Date): string {
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export async function GET(request: NextRequest) {
  const { user, workspace, supabase } = await getSessionWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (workspace.plan === 'free') {
    return NextResponse.json({ error: 'Il Bilancio è una funzione Pro.' }, { status: 403 })
  }

  const from = request.nextUrl.searchParams.get('from') ?? ''
  const to = request.nextUrl.searchParams.get('to') ?? ''
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    return NextResponse.json({ error: 'Intervallo di date non valido.' }, { status: 400 })
  }
  const fromDate = new Date(`${from}T00:00:00`)
  const toDateExcl = new Date(`${to}T00:00:00`)
  toDateExcl.setDate(toDateExcl.getDate() + 1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne/tabella 038 non ancora in types/database.ts
  const db = supabase as any

  // ── Entrate (criterio di cassa — stessa logica della pagina Bilancio) ──
  type EntrataDoc = {
    id: string; doc_type: string; status: string; doc_number: string | null
    total: number | null; paid_at: string | null; paid_amount: number | null
    payment_status: string | null; accepted_at: string | null; updated_at: string | null
    clients: { name: string | null; surname: string | null } | null
  }
  let entrateDocs: EntrataDoc[] = []
  const { data: richDocs, error: richError } = await db
    .from('documents')
    .select('id, doc_type, status, doc_number, total, paid_at, paid_amount, payment_status, accepted_at, updated_at, clients ( name, surname )')
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .or('and(doc_type.eq.fattura,status.eq.accepted),payment_status.in.(partial,paid)')
  if (!richError && richDocs) {
    entrateDocs = richDocs as EntrataDoc[]
  } else {
    const { data: baseDocs } = await db
      .from('documents')
      .select('id, doc_type, status, doc_number, total, accepted_at, updated_at, clients ( name, surname )')
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'fattura')
      .eq('status', 'accepted')
      .is('deleted_at', null)
    entrateDocs = ((baseDocs ?? []) as EntrataDoc[]).map((d) => ({
      ...d, paid_at: null, paid_amount: null, payment_status: null,
    }))
  }

  const entrate = entrateDocs
    .map((doc) => {
      const when = new Date(doc.paid_at ?? doc.accepted_at ?? doc.updated_at ?? 0)
      const amount = doc.payment_status === 'partial'
        ? Number(doc.paid_amount ?? 0)
        : Number(doc.paid_amount ?? doc.total ?? 0)
      const clientName = [doc.clients?.name, doc.clients?.surname].filter(Boolean).join(' ')
      return {
        when,
        descr: doc.payment_status === 'partial' ? 'Acconto' : doc.doc_type === 'fattura' ? 'Fattura incassata' : 'Incasso',
        rif: formatDocNumber(doc.doc_number, doc.doc_type),
        cliente: clientName,
        amount,
      }
    })
    .filter((e) => e.amount > 0 && e.when >= fromDate && e.when < toDateExcl)
    .sort((a, b) => a.when.getTime() - b.when.getTime())

  // ── Uscite ──────────────────────────────────────────────────────────────
  let uscite: Array<{ when: Date; categoria: string; descr: string; amount: number }> = []
  try {
    const { data: expenseRows } = await db
      .from('expenses')
      .select('date, description, amount, category')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })
    uscite = ((expenseRows ?? []) as Array<{ date: string; description: string | null; amount: number; category: string | null }>).map((e) => ({
      when: new Date(`${e.date}T00:00:00`),
      categoria: e.category ?? 'Altro',
      descr: e.description ?? '',
      amount: Number(e.amount ?? 0),
    }))
  } catch { /* migration 038 non ancora applicata */ }

  const totEntrate = entrate.reduce((s, e) => s + e.amount, 0)
  const totUscite = uscite.reduce((s, e) => s + e.amount, 0)

  // ── CSV (separatore ; — si apre pulito in Excel italiano) ───────────────
  const rows: string[] = []
  const wsName = workspace.ragione_sociale ?? workspace.name
  rows.push(`Bilancio ${csvCell(wsName)};Periodo;${itDate(fromDate)} - ${itDate(new Date(`${to}T00:00:00`))};;`)
  rows.push(';;;;')
  rows.push('Tipo;Data;Riferimento;Descrizione;Importo (EUR)')
  for (const e of entrate) {
    rows.push(['Entrata', itDate(e.when), csvCell(e.rif), csvCell([e.descr, e.cliente].filter(Boolean).join(' - ')), itAmount(e.amount)].join(';'))
  }
  for (const u of uscite) {
    rows.push(['Uscita', itDate(u.when), csvCell(u.categoria), csvCell(u.descr), itAmount(-u.amount)].join(';'))
  }
  rows.push(';;;;')
  rows.push(`Totale entrate;;;;${itAmount(totEntrate)}`)
  rows.push(`Totale uscite;;;;${itAmount(-totUscite)}`)
  rows.push(`Utile;;;;${itAmount(totEntrate - totUscite)}`)

  const csv = '﻿' + rows.join('\r\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bilancio_${from}_${to}.csv"`,
    },
  })
}
