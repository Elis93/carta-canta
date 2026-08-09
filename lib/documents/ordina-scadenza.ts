// ============================================================
// «Ordina: Scadenza più vicina» — l'ordine di UTILITÀ, non della data.
//
// PERCHÉ ESISTE (Eli, 9 ago 2026): *"ad oggi guarda la data di creazione
// delle fatture e non le mette in senso logico di utilità"*. Il vecchio
// ordinamento era un semplice `expires_at ASC`: una fattura GIÀ PAGATA con
// scadenza vicina finiva sopra una ancora da incassare con scadenza più
// lontana. Una lista ordinata "per scadenza" che mette in cima ciò che non
// devi più guardare non serve a niente.
//
// L'ordine è quello che ha dettato Eli — prima ciò che richiede un'azione,
// e più è in ritardo più sta in alto:
//
//   0. SCADUTE      — inviate, scadenza passata, mai incassate. Le più urgenti.
//   1. IN ATTESA    — inviate o viste, per scadenza più vicina.
//   2. BOZZE        — devi ancora finirle, ma non hanno una scadenza.
//   3. CHIUSE BENE  — pagate (fatture) / accettate (preventivi).
//   4. ANNULLATE    — rifiutate: non c'è più niente da fare.
//
// ⚠️ Le BOZZE non erano nell'elenco di Eli: le ho messe al 3° posto perché
// sono l'unica cosa che richiede ancora un'azione TUA, ma non hanno una
// scadenza — quindi non possono stare fra i documenti in ritardo. Se il
// posto giusto è un altro, si cambia UN numero qui sotto.
//
// ⚠️ Ordinare qui e non in SQL è una scelta: PostgREST non sa ordinare per
// un'espressione (serve un CASE). Chi chiama deve quindi leggere TUTTE le
// righe filtrate e paginare DOPO aver ordinato — altrimenti si riordina solo
// la finestra che si sta guardando, che è il difetto trovato l'8 agosto e
// non è un ordinamento.
// ============================================================

export interface DocOrdinabile {
  status: string
  expires_at?: string | null
  created_at?: string | null
  updated_at?: string | null
}

export const GRUPPO = {
  scadute: 0,
  inAttesa: 1,
  bozze: 2,
  chiuse: 3,
  annullate: 4,
} as const

/** In quale fascia di urgenza cade il documento. */
export function gruppoUrgenza(doc: DocOrdinabile): number {
  switch (doc.status) {
    case 'expired':  return GRUPPO.scadute
    case 'sent':
    case 'viewed':   return GRUPPO.inAttesa
    case 'draft':    return GRUPPO.bozze
    case 'accepted': return GRUPPO.chiuse
    case 'rejected': return GRUPPO.annullate
    // Uno stato che non conosciamo NON si intrufola fra le cose urgenti:
    // finisce in fondo, dove al massimo si nota che c'è.
    default:         return GRUPPO.annullate
  }
}

const ms = (v: string | null | undefined): number | null => {
  if (!v) return null
  const t = Date.parse(v)
  return Number.isFinite(t) ? t : null
}

/**
 * Confronto completo. Da passare a `Array.prototype.sort`.
 *
 * Dentro ogni fascia:
 *  · scadute e in attesa → **scadenza più vicina prima** (le scadute sono già
 *    tutte nel passato, quindi la più vecchia è anche la più in ritardo);
 *  · bozze → la più toccata di recente prima (è quella su cui stavi lavorando);
 *  · chiuse e annullate → la più recente prima (è storia: conta l'ordine
 *    cronologico inverso, non una scadenza che non ha più significato).
 *
 * ⚠️ Chi non ha una data di scadenza va IN FONDO alla sua fascia, non in cima:
 * `null` non è "scade subito".
 */
export function confrontaPerUrgenza(a: DocOrdinabile, b: DocOrdinabile): number {
  const ga = gruppoUrgenza(a)
  const gb = gruppoUrgenza(b)
  if (ga !== gb) return ga - gb

  if (ga === GRUPPO.scadute || ga === GRUPPO.inAttesa) {
    const sa = ms(a.expires_at)
    const sb = ms(b.expires_at)
    if (sa !== sb) {
      if (sa === null) return 1
      if (sb === null) return -1
      return sa - sb
    }
  } else {
    const ra = ms(a.updated_at) ?? ms(a.created_at)
    const rb = ms(b.updated_at) ?? ms(b.created_at)
    if (ra !== rb) {
      if (ra === null) return 1
      if (rb === null) return -1
      return rb - ra
    }
  }

  // Spareggio stabile: senza, due documenti identici possono scambiarsi di
  // posto fra un caricamento e l'altro e la lista "balla".
  const ca = ms(a.created_at) ?? 0
  const cb = ms(b.created_at) ?? 0
  return cb - ca
}

/** Ordina una copia dell'elenco. Non tocca l'array originale. */
export function ordinaPerUrgenza<T extends DocOrdinabile>(docs: readonly T[]): T[] {
  return [...docs].sort(confrontaPerUrgenza)
}
