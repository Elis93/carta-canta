// ============================================================
// Imponibile netto degli sconti globali di un documento.
// documents.subtotal a DB è PRE-sconto: l'imponibile da esporre al
// commercialista è il subtotale al netto di sconto % e sconto fisso —
// stessa formula (e stesso arrotondamento) del passo "afterDiscount"
// del motore fiscale (lib/fiscal/calcoli.ts, calcolaDocumento).
// Mai negativo: uno sconto che supera il subtotale azzera l'imponibile.
// ============================================================

import { roundFiscale } from './calcoli'

export function imponibileNettoSconti(
  subtotal: number,
  discountPct?: number | null,
  discountFixed?: number | null
): number {
  return Math.max(
    0,
    roundFiscale(subtotal * (1 - ((discountPct ?? 0) / 100)) - (discountFixed ?? 0))
  )
}
