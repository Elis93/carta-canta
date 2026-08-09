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
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { isMissingColumnError } from '@/lib/supabase/errors'

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
  // Paginato: il registro deve essere COMPLETO. Una query secca oltre il
  // tetto righe dell'API restituirebbe le prime N fatture senza errore →
  // registro fiscale incompleto consegnato al commercialista.
  let fatture: FatturaRow[] = []
  const { data: rich, error: richErr } = await fetchAllRows<FatturaRow>(() =>
    db
      .from('documents')
      .select(`${baseSelect}, doc_type, paid_at, paid_amount, payment_status`)
      .eq('workspace_id', workspaceId)
      // ⚠️ Anche le NOTE DI CREDITO: il registro delle fatture emesse è
      // l'annotazione di OGNI documento emesso, note comprese. Un registro
      // che le omette gonfia il fatturato di tutto ciò che è stato stornato.
      .in('doc_type', ['fattura', 'nota_credito'])
      .neq('status', 'draft')
      .is('deleted_at', null)
  )
  // Il fallback senza le colonne 038 è legittimo SOLO se quelle colonne non
  // esistono. Su un errore vero (rete, RLS) proseguire darebbe un registro
  // FISCALE incompleto al commercialista senza dirlo a nessuno: meglio
  // fermarsi (26 lug).
  if (richErr && !isMissingColumnError(richErr as { code?: string; message?: string })) {
    throw new Error('Non è stato possibile leggere tutte le fatture: riprova tra qualche secondo. Il registro non viene creato incompleto.')
  }
  if (!richErr && rich) {
    fatture = rich
  } else {
    const { data: base, error: baseErr } = await fetchAllRows<FatturaRow>(() =>
      db
        .from('documents')
        .select(`${baseSelect}, doc_type`)
        .eq('workspace_id', workspaceId)
        .in('doc_type', ['fattura', 'nota_credito'])
        .neq('status', 'draft')
        .is('deleted_at', null)
    )
    if (baseErr) {
      throw new Error('Non è stato possibile leggere tutte le fatture: riprova tra qualche secondo. Il registro non viene creato incompleto.')
    }
    fatture = (base ?? []).map((f) => ({ ...f, paid_at: null, paid_amount: null, payment_status: null }))
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
    const stato = (f as { doc_type?: string }).doc_type === 'nota_credito'
      ? 'Nota di credito'
      : statoIncasso(f)
    const annullata = stato === 'Annullata'
    const incassato = annullata ? 0 : Number(f.paid_amount ?? (stato === 'Incassata' ? totale : 0))
    const cliente = [f.clients?.name, f.clients?.surname].filter(Boolean).join(' ')
    // ⚠️ La NOTA DI CREDITO si annota COL SEGNO MENO sullo stesso registro
    // dove stava l'operazione che rettifica: è così che il registro torna.
    // (In alternativa la norma ammette un sezionale dedicato alle variazioni;
    // per un artigiano un registro solo è più semplice da leggere.)
    const segno = (f as { doc_type?: string }).doc_type === 'nota_credito' ? -1 : 1

    if (!annullata) {
      totImponibile += segno * imponibile
      totIva += segno * iva
      totBollo += segno * bollo
      totTotale += segno * totale
      totIncassato += incassato
    }
    out.push([
      itDate(emessa),
      csvCell(formatDocNumber(f.doc_number, (f as { doc_type?: string }).doc_type ?? 'fattura')),
      csvCell(cliente),
      csvCell(f.clients?.piva ?? ''),
      csvCell(f.clients?.codice_fiscale ?? ''),
      itAmount(segno * imponibile),
      itAmount(segno * iva),
      itAmount(segno * bollo),
      itAmount(segno * totale),
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
