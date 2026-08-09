// ============================================================
// Bilancio (entrate + uscite, criterio di cassa) → CSV.
// Logica condivisa tra l'export dell'artigiano (/api/bilancio/export)
// e l'area /studio del commercialista (/api/studio/[id]/export-bilancio).
// Il chiamante passa un client Supabase (di sessione o admin) GIÀ
// autorizzato ad accedere a quel workspace.
// ============================================================

import { formatDocNumber } from '@/lib/utils'
import { csvCell, itAmount, itDate, romeDayStart } from '@/lib/csv'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { isMissingColumnError } from '@/lib/supabase/errors'
import { incassiFromDoc } from '@/lib/bilancio/incassi'

export interface BilancioWorkspace {
  name: string
  ragione_sociale?: string | null
}

type EntrataDoc = {
  id: string; doc_type: string; status: string; doc_number: string | null
  total: number | null; paid_at: string | null; paid_amount: number | null
  payment_status: string | null; accepted_at: string | null; updated_at: string | null
  document_log?: unknown
  origin_document_id?: string | null
  clients: { name: string | null; surname: string | null } | null
}

/**
 * Costruisce il CSV del bilancio (entrate/uscite per cassa) per [from,to].
 * @param db  client Supabase già autorizzato sul workspace (cast any per le colonne 038)
 */
export async function buildBilancioCsv(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne/tabelle 038 non in types/database.ts
  db: any,
  workspaceId: string,
  ws: BilancioWorkspace,
  from: string,
  to: string
): Promise<string> {
  const fromDate = romeDayStart(from)
  const toDateExcl = romeDayStart(to)
  toDateExcl.setDate(toDateExcl.getDate() + 1)

  // ── Entrate (criterio di cassa — stessa logica della pagina Bilancio) ──
  // Paginato: oltre il tetto righe dell'API una query secca restituirebbe
  // solo le prime N entrate, senza errore → bilancio incompleto per il
  // commercialista (26 lug).
  let entrateDocs: EntrataDoc[] = []
  const { data: richDocs, error: richError } = await fetchAllRows<EntrataDoc>(() =>
    db
      .from('documents')
      .select('id, doc_type, status, doc_number, total, paid_at, paid_amount, payment_status, accepted_at, updated_at, document_log, origin_document_id, clients ( name, surname )')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .or('and(doc_type.eq.fattura,status.eq.accepted),payment_status.in.(partial,paid)')
      // Mai le note di credito fra le entrate (vedi bilancio/page.tsx)
      .neq('doc_type', 'nota_credito')
  )
  if (richError && !isMissingColumnError(richError as { code?: string; message?: string })) {
    throw new Error('Non è stato possibile leggere tutte le entrate: riprova tra qualche secondo. Il bilancio non viene creato incompleto.')
  }
  if (!richError && richDocs) {
    entrateDocs = richDocs
  } else {
    const { data: baseDocs, error: baseErr } = await fetchAllRows<EntrataDoc>(() =>
      db
        .from('documents')
        .select('id, doc_type, status, doc_number, total, accepted_at, updated_at, clients ( name, surname )')
        .eq('workspace_id', workspaceId)
        .eq('doc_type', 'fattura')
        .eq('status', 'accepted')
        .is('deleted_at', null)
    )
    if (baseErr) {
      throw new Error('Non è stato possibile leggere tutte le entrate: riprova tra qualche secondo. Il bilancio non viene creato incompleto.')
    }
    entrateDocs = (baseDocs ?? []).map((d) => ({
      ...d, paid_at: null, paid_amount: null, payment_status: null,
    }))
  }

  // ── Lavoro collegato (colonna "Lavoro", 5 ago) ─────────────────────────
  // Stessa attribuzione della pagina Bilancio: il lavoro nasce dal preventivo
  // accettato (lavori.document_id) e la fattura porta origin_document_id =
  // quel preventivo. Tollerante: senza la tabella 048 la colonna resta vuota
  // (l'export non si rompe mai per una migration mancante).
  const lavoroByDoc = new Map<string, string>()
  const lavoroById = new Map<string, string>()
  {
    // Paginato: oltre il tetto righe dell'API i lavori più vecchi mancherebbero
    // dalla mappa e le loro spese uscirebbero etichettate "Lavoro eliminato",
    // che è falso.
    const { data: lavoriRows } = await fetchAllRows<{ id: string; title: string | null; document_id: string | null }>(() => db
      .from('lavori')
      .select('id, title, document_id')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null))
    for (const l of lavoriRows ?? []) {
      const title = l.title?.trim() || 'Lavoro senza titolo'
      lavoroById.set(l.id, title)
      if (l.document_id) lavoroByDoc.set(l.document_id, title)
    }
  }

  const entrate = entrateDocs
    // Le fatture ANNULLATE non sono entrate (il registro fatture le esclude
    // dai totali: i due export devono raccontare la stessa storia)
    .filter((doc) => doc.status !== 'rejected')
    // STORIA degli incassi (allineata alla pagina Bilancio, 4 ago): una riga
    // per OGNI incasso — acconto e saldo nei rispettivi giorni, dagli eventi
    // del document_log; gli incassi poi azzerati NON compaiono (annullati
    // alla fonte, decisione Eli: mai importi negativi). Prima l'export
    // attribuiva l'intero cumulato al giorno del saldo e divergeva dalla
    // pagina in app.
    .flatMap((doc) => {
      const clientName = [doc.clients?.name, doc.clients?.surname].filter(Boolean).join(' ')
      const lavoro = lavoroByDoc.get(doc.id)
        ?? (doc.origin_document_id ? lavoroByDoc.get(doc.origin_document_id) : undefined)
        ?? ''
      return incassiFromDoc(doc).map((ev) => ({
        when: ev.when,
        descr: ev.kind === 'acconto'
          ? 'Acconto'
          : doc.doc_type === 'fattura' ? 'Fattura incassata' : 'Incasso',
        rif: formatDocNumber(doc.doc_number, doc.doc_type),
        cliente: clientName,
        lavoro,
        amount: ev.amount,
      }))
    })
    .filter((e) => e.amount > 0 && e.when >= fromDate && e.when < toDateExcl)
    .sort((a, b) => a.when.getTime() - b.when.getTime())

  // ── Uscite ──────────────────────────────────────────────────────────────
  let uscite: Array<{ when: Date; categoria: string; descr: string; lavoro: string; amount: number }> = []
  try {
    const expenseSelect = (cols: string) => db
      .from('expenses')
      .select(cols)
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })
    let { data: expenseRows, error: expErr } = await expenseSelect('date, description, amount, category, lavoro_id')
    // Colonna 049 assente: si riprova senza, così l'export resta completo
    // (solo la colonna Lavoro resta vuota) invece di uscire senza uscite.
    if (expErr) ({ data: expenseRows } = await expenseSelect('date, description, amount, category'))
    uscite = ((expenseRows ?? []) as Array<{ date: string; description: string | null; amount: number; category: string | null; lavoro_id?: string | null }>).map((e) => ({
      when: new Date(`${e.date}T00:00:00`),
      categoria: e.category ?? 'Altro',
      descr: e.description ?? '',
      // Lavoro cancellato: la spesa resta nei conti con un'etichetta onesta
      lavoro: e.lavoro_id ? (lavoroById.get(e.lavoro_id) ?? 'Lavoro eliminato') : '',
      amount: Number(e.amount ?? 0),
    }))
  } catch { /* migration 038 non ancora applicata */ }

  const totEntrate = entrate.reduce((s, e) => s + e.amount, 0)
  const totUscite = uscite.reduce((s, e) => s + e.amount, 0)

  // ── CSV (separatore ; — si apre pulito in Excel italiano) ───────────────
  const rows: string[] = []
  const wsName = ws.ragione_sociale ?? ws.name
  // ⚠️ 6 colonne (la 5ª "Lavoro" è nuova, 5 ago): le righe vuote e i totali
  // devono avere lo stesso numero di ";" delle righe di dettaglio, altrimenti
  // Excel disallinea gli importi.
  rows.push(`${csvCell(`Bilancio ${wsName}`)};Periodo;${itDate(fromDate)} - ${itDate(romeDayStart(to))};;;`)
  rows.push(';;;;;')
  rows.push('Tipo;Data;Riferimento;Descrizione;Lavoro;Importo (EUR)')
  for (const e of entrate) {
    rows.push(['Entrata', itDate(e.when), csvCell(e.rif), csvCell([e.descr, e.cliente].filter(Boolean).join(' - ')), csvCell(e.lavoro), itAmount(e.amount)].join(';'))
  }
  for (const u of uscite) {
    rows.push(['Uscita', itDate(u.when), csvCell(u.categoria), csvCell(u.descr), csvCell(u.lavoro), itAmount(-u.amount)].join(';'))
  }
  rows.push(';;;;;')
  rows.push(`Totale entrate;;;;;${itAmount(totEntrate)}`)
  rows.push(`Totale uscite;;;;;${itAmount(-totUscite)}`)
  rows.push(`Utile;;;;;${itAmount(totEntrate - totUscite)}`)

  return '﻿' + rows.join('\r\n')
}
