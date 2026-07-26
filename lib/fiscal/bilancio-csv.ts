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

export interface BilancioWorkspace {
  name: string
  ragione_sociale?: string | null
}

type EntrataDoc = {
  id: string; doc_type: string; status: string; doc_number: string | null
  total: number | null; paid_at: string | null; paid_amount: number | null
  payment_status: string | null; accepted_at: string | null; updated_at: string | null
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
      .select('id, doc_type, status, doc_number, total, paid_at, paid_amount, payment_status, accepted_at, updated_at, clients ( name, surname )')
      .eq('workspace_id', workspaceId)
      .is('deleted_at', null)
      .or('and(doc_type.eq.fattura,status.eq.accepted),payment_status.in.(partial,paid)')
  )
  if (!richError && richDocs) {
    entrateDocs = richDocs
  } else {
    const { data: baseDocs } = await fetchAllRows<EntrataDoc>(() =>
      db
        .from('documents')
        .select('id, doc_type, status, doc_number, total, accepted_at, updated_at, clients ( name, surname )')
        .eq('workspace_id', workspaceId)
        .eq('doc_type', 'fattura')
        .eq('status', 'accepted')
        .is('deleted_at', null)
    )
    entrateDocs = (baseDocs ?? []).map((d) => ({
      ...d, paid_at: null, paid_amount: null, payment_status: null,
    }))
  }

  const entrate = entrateDocs
    // Le fatture ANNULLATE non sono entrate (il registro fatture le esclude
    // dai totali: i due export devono raccontare la stessa storia)
    .filter((doc) => doc.status !== 'rejected')
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
      .eq('workspace_id', workspaceId)
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
  const wsName = ws.ragione_sociale ?? ws.name
  rows.push(`${csvCell(`Bilancio ${wsName}`)};Periodo;${itDate(fromDate)} - ${itDate(romeDayStart(to))};;`)
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

  return '﻿' + rows.join('\r\n')
}
