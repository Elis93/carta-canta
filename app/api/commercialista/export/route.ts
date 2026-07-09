// ============================================================
// GET /api/commercialista/export?from=YYYY-MM-DD&to=YYYY-MM-DD
// "Pacchetto commercialista": registro delle FATTURE emesse nel periodo,
// in CSV con le colonne che servono alla prima nota dello studio —
// data emissione, numero, cliente con P.IVA/CF, imponibile netto sconti,
// IVA, bollo, totale, stato incasso, totale incassato e data ultimo incasso.
//
// Formato "Excel italiano": separatore ";", BOM UTF-8, importi con virgola.
// Modello "consegna file" (alla Danea): l'artigiano lo scarica e lo manda
// al suo commercialista. Disponibile a tutti i piani (sono i SUOI dati,
// come l'export fatture esistente).
//
// Limiti dichiarati nel file stesso (verifica adversariale 9 lug):
// - "Data emissione" = data di invio; se mai inviata, data di creazione.
// - Il modello dati registra UN incasso cumulativo per fattura → le colonne
//   sono "Incassato (totale)" + "Data ultimo incasso", NON un registro
//   movimento-per-movimento.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { formatDocNumber } from '@/lib/utils'
import { imponibileNettoSconti } from '@/lib/fiscal/imponibile'
import { csvCell, itAmount, itDate } from '@/lib/csv'

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

type FatturaRow = {
  id: string
  doc_number: string | null
  status: string
  subtotal: number | null
  tax_amount: number | null
  bollo_amount: number | null
  total: number | null
  discount_pct: number | null
  discount_fixed: number | null
  sent_at: string | null
  created_at: string | null
  paid_at: string | null
  paid_amount: number | null
  payment_status: string | null
  clients: { name: string | null; surname: string | null; piva: string | null; codice_fiscale: string | null } | null
}

function statoIncasso(f: FatturaRow): string {
  if (f.status === 'rejected') return 'Annullata'
  if (f.payment_status === 'paid') return 'Incassata'
  if (f.payment_status === 'partial') return 'Acconto ricevuto'
  // Pre-migration 038 / fallback legacy: accepted = pagata
  if (!f.payment_status && f.status === 'accepted') return 'Incassata'
  return 'Da incassare'
}

export async function GET(request: NextRequest) {
  const { user, workspace, supabase } = await getSessionWorkspace()
  if (!user || !workspace) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })

  const from = request.nextUrl.searchParams.get('from') ?? ''
  const to = request.nextUrl.searchParams.get('to') ?? ''
  if (!DATE_RE.test(from) || !DATE_RE.test(to) || from > to) {
    return NextResponse.json({ error: 'Intervallo di date non valido.' }, { status: 400 })
  }
  const fromDate = new Date(`${from}T00:00:00`)
  const toDateExcl = new Date(`${to}T00:00:00`)
  toDateExcl.setDate(toDateExcl.getDate() + 1)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 (paid_*) non in types/database.ts
  const db = supabase as any

  // Tutte le fatture NON bozza del workspace (bozze = non emesse, escluse;
  // le annullate restano nel registro: spiegano i "buchi" di numerazione).
  const baseSelect =
    'id, doc_number, status, subtotal, tax_amount, bollo_amount, total, discount_pct, discount_fixed, sent_at, created_at, clients ( name, surname, piva, codice_fiscale )'
  let fatture: FatturaRow[] = []
  const { data: rich, error: richErr } = await db
    .from('documents')
    .select(`${baseSelect}, paid_at, paid_amount, payment_status`)
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'fattura')
    .neq('status', 'draft')
    .is('deleted_at', null)
  if (!richErr && rich) {
    fatture = rich as FatturaRow[]
  } else {
    // Tolleranza pre-migration 038: senza le colonne paid_*
    const { data: base } = await db
      .from('documents')
      .select(baseSelect)
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'fattura')
      .neq('status', 'draft')
      .is('deleted_at', null)
    fatture = ((base ?? []) as FatturaRow[]).map((f) => ({
      ...f, paid_at: null, paid_amount: null, payment_status: null,
    }))
  }

  // Filtro per data di emissione (sent_at, fallback created_at) + ordinamento
  const rows = fatture
    .map((f) => ({ f, emessa: new Date(f.sent_at ?? f.created_at ?? 0) }))
    .filter(({ emessa }) => emessa >= fromDate && emessa < toDateExcl)
    .sort((a, b) => a.emessa.getTime() - b.emessa.getTime())

  // ── CSV ──────────────────────────────────────────────────────────────────
  const wsName = workspace.ragione_sociale ?? workspace.name
  const wsPiva = (workspace as { piva?: string | null }).piva ?? ''
  const out: string[] = []
  out.push(`Registro fatture emesse;${csvCell(wsName)}${wsPiva ? `;P.IVA ${csvCell(wsPiva)}` : ';'};;;;;;;;;`)
  out.push(`Periodo;${itDate(fromDate)} - ${itDate(new Date(`${to}T00:00:00`))};;;;;;;;;;`)
  out.push(`Generato con Carta Canta il ${itDate(new Date())};;;;;;;;;;;`)
  out.push(';;;;;;;;;;;')
  out.push('Data emissione;Numero;Cliente;P.IVA;Codice fiscale;Imponibile (EUR);IVA (EUR);Bollo (EUR);Totale (EUR);Stato incasso;Incassato totale (EUR);Data ultimo incasso')

  let totImponibile = 0, totIva = 0, totBollo = 0, totTotale = 0, totIncassato = 0
  for (const { f, emessa } of rows) {
    // Imponibile NETTO degli sconti globali (subtotal a DB è pre-sconto):
    // stessa formula del motore fiscale (afterDiscount) — testata in
    // tests/unit/fiscal/imponibile.test.ts.
    const imponibile = imponibileNettoSconti(Number(f.subtotal ?? 0), f.discount_pct, f.discount_fixed)
    const iva = Number(f.tax_amount ?? 0)
    const bollo = Number(f.bollo_amount ?? 0)
    const totale = Number(f.total ?? 0)
    const stato = statoIncasso(f)
    const annullata = stato === 'Annullata'
    const incassato = annullata ? 0 : Number(f.paid_amount ?? (stato === 'Incassata' ? totale : 0))
    const cliente = [f.clients?.name, f.clients?.surname].filter(Boolean).join(' ')

    if (!annullata) {
      totImponibile += imponibile; totIva += iva; totBollo += bollo; totTotale += totale; totIncassato += incassato
    }
    out.push([
      itDate(emessa),
      csvCell(formatDocNumber(f.doc_number, 'fattura')),
      csvCell(cliente),
      csvCell(f.clients?.piva ?? ''),
      csvCell(f.clients?.codice_fiscale ?? ''),
      itAmount(imponibile),
      itAmount(iva),
      itAmount(bollo),
      itAmount(totale),
      stato,
      incassato > 0 ? itAmount(incassato) : '',
      f.paid_at && !annullata ? itDate(new Date(f.paid_at)) : '',
    ].join(';'))
  }

  out.push(';;;;;;;;;;;')
  out.push(`Totali (escluse annullate);;;;;${itAmount(totImponibile)};${itAmount(totIva)};${itAmount(totBollo)};${itAmount(totTotale)};;${itAmount(totIncassato)};`)
  out.push(';;;;;;;;;;;')
  out.push('Note:;;;;;;;;;;;')
  out.push(`${csvCell('Data emissione = data di invio della fattura; se mai inviata, data di creazione.')};;;;;;;;;;;`)
  out.push(`${csvCell("Incassato = totale registrato a oggi sulla fattura, con la data dell'ultimo incasso (acconti e saldo si sommano).")};;;;;;;;;;;`)
  out.push(`${csvCell("Le fatture annullate restano nel registro (giustificano i salti di numerazione) e sono escluse dai totali.")};;;;;;;;;;;`)
  out.push(`${csvCell('Per le entrate/uscite complete per cassa usare anche: Bilancio > Esporta CSV.')};;;;;;;;;;;`)

  const csv = '﻿' + out.join('\r\n')
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="registro_fatture_${from}_${to}.csv"`,
    },
  })
}
