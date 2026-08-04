// ============================================================
// Storia degli incassi per il Bilancio (criterio di cassa).
//
// Il PROBLEMA storico: il Bilancio attribuiva ogni fattura a UN solo mese
// (quello di `paid_at`) con l'intero `paid_amount`. Ma `paid_at`/`paid_amount`
// sono denormalizzati: quando si incassa il SALDO, `paid_at` viene sovrascritto
// con la data del saldo e `paid_amount` diventa il totale → l'acconto incassato
// mesi prima "migrava" nel mese del saldo, falsando le entrate mensili.
//
// La SOLUZIONE: il `document_log` è append-only e registra GIÀ ogni movimento
// di denaro come voce propria — `payment` (kind acconto/saldo) con la data e
// l'importo del SINGOLO incasso, e `payment_reset` con l'importo azzerato.
// Quindi la storia esiste già: qui la trasformiamo negli eventi di cassa
// (uno per incasso, ciascuno nel suo mese), con i reset che sottraggono.
//
// Funzione PURA e testata: nessun accesso al DB, così il Bilancio la usa sui
// documenti già caricati e resta tollerante ai documenti storici (pre-log).
// ============================================================

export interface IncassoEvent {
  when: Date
  amount: number
}

interface LogEntryLike {
  type?: string
  at?: string
  amount?: number
}

export interface IncassoDocLike {
  document_log?: unknown
  paid_at?: string | null
  paid_amount?: number | null
  payment_status?: string | null
  accepted_at?: string | null
  updated_at?: string | null
  total?: number | null
}

/**
 * Eventi di incasso di un documento, ciascuno nel mese in cui il denaro è
 * arrivato davvero. Preferisce la storia nel `document_log`; se il documento
 * non ha voci di incasso nel log (documenti storici o pre-migration), ripiega
 * sul singolo evento denormalizzato — esattamente la vecchia logica.
 */
export function incassiFromDoc(doc: IncassoDocLike): IncassoEvent[] {
  const log = Array.isArray(doc.document_log) ? (doc.document_log as LogEntryLike[]) : []
  const payments = log.filter((e) => e && e.type === 'payment' && typeof e.at === 'string')
  const resets = log.filter((e) => e && e.type === 'payment_reset' && typeof e.at === 'string')

  if (payments.length > 0) {
    const events: IncassoEvent[] = []
    for (const p of payments) {
      const amt = Number(p.amount ?? 0)
      if (amt) events.push({ when: new Date(p.at as string), amount: amt })
    }
    // I reset (correzione / annullamento / non pagata) tolgono denaro già
    // registrato: sottraggono nel mese in cui sono avvenuti.
    for (const r of resets) {
      const amt = Number(r.amount ?? 0)
      if (amt) events.push({ when: new Date(r.at as string), amount: -amt })
    }
    return events
  }

  // Solo reset senza alcun payment (caso anomalo): il denaro è stato azzerato,
  // non c'è nulla da contare.
  if (resets.length > 0) return []

  // Fallback storico: nessuna voce di incasso nel log → un solo evento dai
  // campi denormalizzati (replica esatta della vecchia logica del Bilancio).
  const when = new Date(doc.paid_at ?? doc.accepted_at ?? doc.updated_at ?? 0)
  const amount = doc.payment_status === 'partial'
    ? Number(doc.paid_amount ?? 0)
    : Number(doc.paid_amount ?? doc.total ?? 0)
  return [{ when, amount }]
}
