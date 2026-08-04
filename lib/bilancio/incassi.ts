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
// (uno per incasso, ciascuno nel suo mese).
//
// I RESET (decisione Eli 4 ago: "un mese con entrate negative dà fastidio"):
// un azzeramento ANNULLA gli incassi che cancella NEL LORO MESE D'ORIGINE —
// come se non fossero mai stati registrati — invece di sottrarre nel mese
// della correzione. Nessun mese può andare in negativo; il netto resta giusto.
//
// Funzione PURA e testata: nessun accesso al DB, così il Bilancio la usa sui
// documenti già caricati e resta tollerante ai documenti storici (pre-log).
// ============================================================

export interface IncassoEvent {
  when: Date
  amount: number
  /** 'acconto' | 'saldo' dagli eventi del log; null quando l'origine non lo
      dice (fallback denormalizzato). */
  kind?: 'acconto' | 'saldo' | null
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
  const moneyEntries = log.filter(
    (e) => e && (e.type === 'payment' || e.type === 'payment_reset') && typeof e.at === 'string'
  )
  const hasPayments = moneyEntries.some((e) => e.type === 'payment')
  const hasResets = moneyEntries.some((e) => e.type === 'payment_reset')

  if (hasPayments || hasResets) {
    // Rilettura CRONOLOGICA del log: gli incassi si accumulano; un reset
    // azzera l'intero cumulato di quel momento → CANCELLA gli incassi che
    // lo precedono (nel loro mese d'origine, "mai esistiti"), non produce
    // un evento negativo nel mese della correzione.
    const sorted = [...moneyEntries].sort(
      (a, b) => new Date(a.at as string).getTime() - new Date(b.at as string).getTime()
    )
    let active: IncassoEvent[] = []
    for (const e of sorted) {
      if (e.type === 'payment') {
        const amt = Number(e.amount ?? 0)
        const kind = (e as { kind?: string }).kind
        if (amt) active.push({ when: new Date(e.at as string), amount: amt, kind: kind === 'acconto' || kind === 'saldo' ? kind : null })
      } else {
        // payment_reset: azzera TUTTO il registrato fino a quel momento
        // (correzione / annullamento / riattivazione / non pagata).
        active = []
      }
    }

    // ── RETE DI SICUREZZA (review 4 ago, ALTA): esistono acconti registrati
    // SOLO nei campi denormalizzati, senza voce `payment` nel log — l'acconto
    // TRASFERITO dalla conversione preventivo→fattura e gli incassi
    // precedenti alla nascita del log (26 lug 2026). Al saldo, il log riceve
    // solo il residuo: contare "solo il log" farebbe SPARIRE l'acconto dal
    // totale. Se il cumulato registrato (paid_amount) supera il netto degli
    // eventi sopravvissuti, la differenza viene reintegrata con un evento
    // datato come la vecchia logica (mese approssimato, totale GIUSTO).
    // Mai correzioni negative: il totale non scende sotto ciò che il log
    // racconta.
    if (doc.payment_status === 'partial' || doc.payment_status === 'paid') {
      const net = active.reduce((s, e) => s + e.amount, 0)
      const registered = Number(doc.paid_amount ?? 0)
      const delta = Math.round((registered - net) * 100) / 100
      if (delta > 0.005) {
        const when = new Date(doc.paid_at ?? doc.accepted_at ?? doc.updated_at ?? 0)
        active.push({ when, amount: delta, kind: 'acconto' })
      }
    }
    return active
  }

  // Fallback storico: nessuna voce di incasso nel log → un solo evento dai
  // campi denormalizzati (replica esatta della vecchia logica del Bilancio).
  const when = new Date(doc.paid_at ?? doc.accepted_at ?? doc.updated_at ?? 0)
  const amount = doc.payment_status === 'partial'
    ? Number(doc.paid_amount ?? 0)
    : Number(doc.paid_amount ?? doc.total ?? 0)
  return [{ when, amount, kind: doc.payment_status === 'partial' ? 'acconto' : null }]
}
