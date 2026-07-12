// ============================================================
// Registro fatture emesse → CSV "pacchetto commercialista".
// Logica condivisa tra l'export dell'artigiano (/api/commercialista/export)
// e l'area /studio del commercialista (/api/studio/[id]/export).
// Il chiamante passa un client Supabase (di sessione o admin) GIÀ
// autorizzato ad accedere a quel workspace.
// ============================================================

import { formatDocNumber } from '@/lib/utils'
import { imponibileNettoSconti } from '@/lib/fiscal/imponibile'
import { csvCell, itAmount, itDate, romeDayStart } from '@/lib/csv'

export interface RegistroWorkspace {
  name: string
  ragione_sociale?: string | null
  piva?: string | null
}

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
  if (!f.payment_status && f.status === 'accepted') return 'Incassata'
  return 'Da incassare'
}

/**
 * Costruisce il CSV del registro fatture per il periodo [from,to] (inclusi).
 * @param db  client Supabase già autorizzato sul workspace (cast any per le colonne 038)
 */
export async function buildRegistroFattureCsv(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 (paid_*) non in types/database.ts
  db: any,
  workspaceId: string,
  ws: RegistroWorkspace,
  from: string,
  to: string
): Promise<string> {
  const fromDate = romeDayStart(from)
  const toDateExcl = romeDayStart(to)
  toDateExcl.setDate(toDateExcl.getDate() + 1)

  const baseSelect =
    'id, doc_number, status, subtotal, tax_amount, bollo_amount, total, discount_pct, discount_fixed, sent_at, created_at, clients ( name, surname, piva, codice_fiscale )'
  let fatture: FatturaRow[] = []
  const { data: rich, error: richErr } = await db
    .from('documents')
    .select(`${baseSelect}, paid_at, paid_amount, payment_status`)
    .eq('workspace_id', workspaceId)
    .eq('doc_type', 'fattura')
    .neq('status', 'draft')
    .is('deleted_at', null)
  if (!richErr && rich) {
    fatture = rich as FatturaRow[]
  } else {
    const { data: base } = await db
      .from('documents')
      .select(baseSelect)
      .eq('workspace_id', workspaceId)
      .eq('doc_type', 'fattura')
      .neq('status', 'draft')
      .is('deleted_at', null)
    fatture = ((base ?? []) as FatturaRow[]).map((f) => ({ ...f, paid_at: null, paid_amount: null, payment_status: null }))
  }

  const rows = fatture
    .map((f) => ({ f, emessa: new Date(f.sent_at ?? f.created_at ?? 0) }))
    .filter(({ emessa }) => emessa >= fromDate && emessa < toDateExcl)
    .sort((a, b) => a.emessa.getTime() - b.emessa.getTime())

  const wsName = ws.ragione_sociale ?? ws.name
  const wsPiva = ws.piva ?? ''
  const out: string[] = []
  out.push(`Registro fatture emesse;${csvCell(wsName)}${wsPiva ? `;${csvCell(`P.IVA ${wsPiva}`)}` : ';'};;;;;;;;;`)
  out.push(`Periodo;${itDate(fromDate)} - ${itDate(romeDayStart(to))};;;;;;;;;;`)
  out.push(`Generato con Carta Canta il ${itDate(new Date())};;;;;;;;;;;`)
  out.push(';;;;;;;;;;;')
  out.push('Data emissione;Numero;Cliente;P.IVA;Codice fiscale;Imponibile (EUR);IVA (EUR);Bollo (EUR);Totale (EUR);Stato incasso;Incassato totale (EUR);Data ultimo incasso')

  let totImponibile = 0, totIva = 0, totBollo = 0, totTotale = 0, totIncassato = 0
  for (const { f, emessa } of rows) {
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
  out.push(`${csvCell('Le fatture annullate restano nel registro (giustificano i salti di numerazione) e sono escluse dai totali.')};;;;;;;;;;;`)
  out.push(`${csvCell('Per le entrate/uscite complete per cassa usare anche: Bilancio > Esporta CSV.')};;;;;;;;;;;`)

  return '﻿' + out.join('\r\n')
}
