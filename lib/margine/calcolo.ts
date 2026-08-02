// ============================================================
// Margine stimato (PROGETTO_LISTINO_FORNITORE.md, Fase 1)
// Calcoli PURI del margine dell'artigiano — SOLO visualizzazione
// privata: questi numeri non toccano il motore fiscale
// (lib/fiscal/calcoli.ts) e non devono MAI arrivare al cliente
// (regola B.2 in CLAUDE.md).
//
// Regole (decisioni Eli 2 ago 2026):
// - il margine di una VOCE usa il prezzo GIÀ scontato dello
//   sconto di quella voce (lo sconto voce appartiene alla voce);
// - lo sconto di DOCUMENTO non si spalma sulle voci: si sottrae
//   una volta sola dal margine totale;
// - la % di margine sul documento si mostra SOLO se TUTTE le
//   voci hanno un costo (come Quotient): con voci senza costo
//   la % sarebbe una mezza verità — resta il valore in €.
// ============================================================

function round2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100
}

export interface VoceConCosto {
  quantity: number
  unit_price: number
  discount_pct?: number | null
  /** Costo d'acquisto unitario. null/0 = non tracciato (la voce non entra nel margine). */
  unit_cost?: number | null
}

export interface MargineVoce {
  /** Costo totale della voce (unit_cost × quantità) */
  costo: number
  /** Vendita della voce al netto dello sconto VOCE (niente IVA: anche i costi sono netti) */
  vendita: number
  /** vendita − costo (può essere negativo: sotto costo) */
  margine: number
  /** Ricarico % sul costo ((vendita−costo)/costo·100) */
  ricaricoPct: number
  /** Margine % sulla vendita (margine/vendita·100); null con vendita 0 */
  marginePct: number | null
}

/** Margine della singola voce. null se il costo non è tracciato (null o ≤ 0). */
export function margineVoce(v: VoceConCosto): MargineVoce | null {
  const unitCost = v.unit_cost
  if (unitCost == null || !Number.isFinite(unitCost) || unitCost <= 0) return null
  const qty = Number.isFinite(v.quantity) ? v.quantity : 0
  const costo = round2(unitCost * qty)
  const vendita = round2(qty * v.unit_price * (1 - ((v.discount_pct ?? 0) / 100)))
  const margine = round2(vendita - costo)
  return {
    costo,
    vendita,
    margine,
    ricaricoPct: round2(((vendita - costo) / costo) * 100),
    marginePct: vendita > 0 ? round2((margine / vendita) * 100) : null,
  }
}

export interface MargineDocumento {
  /** Somma dei margini delle voci con costo (prima dello sconto documento) */
  margineVoci: number
  /** Sconto di documento in € (percentuale sul subtotale + fisso, mai oltre il subtotale) */
  scontoDocumento: number
  /** margineVoci − scontoDocumento */
  margineFinale: number
  /** % sul totale scontato — SOLO se tutte le voci hanno un costo, altrimenti null */
  marginePct: number | null
  vociConCosto: number
  vociSenzaCosto: number
}

export interface ScontoDocumentoOpts {
  discount_pct?: number | null
  discount_fixed?: number | null
}

/**
 * Margine del documento. Le voci "vuote" (senza descrizione, qty e prezzo a 0)
 * vanno filtrate PRIMA dal chiamante (sono righe di form, non voci).
 */
export function margineDocumento(
  voci: VoceConCosto[],
  sconto?: ScontoDocumentoOpts
): MargineDocumento {
  let margineVoci = 0
  let subtotal = 0
  let conCosto = 0
  let senzaCosto = 0

  for (const v of voci) {
    const lineTotal = round2(v.quantity * v.unit_price * (1 - ((v.discount_pct ?? 0) / 100)))
    subtotal = round2(subtotal + lineTotal)
    const m = margineVoce(v)
    if (m) {
      conCosto++
      margineVoci = round2(margineVoci + m.margine)
    } else {
      senzaCosto++
    }
  }

  // Stessa formula del motore fiscale (calcoli.ts): % sul subtotale, poi il
  // fisso; il totale scontato non scende mai sotto zero.
  const pct = sconto?.discount_pct ?? 0
  const fixed = sconto?.discount_fixed ?? 0
  const afterDiscount = Math.max(0, round2(subtotal * (1 - pct / 100) - fixed))
  const scontoDocumento = round2(subtotal - afterDiscount)

  const margineFinale = round2(margineVoci - scontoDocumento)

  return {
    margineVoci,
    scontoDocumento,
    margineFinale,
    marginePct:
      conCosto > 0 && senzaCosto === 0 && afterDiscount > 0
        ? round2((margineFinale / afterDiscount) * 100)
        : null,
    vociConCosto: conCosto,
    vociSenzaCosto: senzaCosto,
  }
}
