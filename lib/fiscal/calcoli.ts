// ============================================================
// CARTA CANTA — Motore Fiscale
// Implementazione completa arriva allo Step 6.
// Qui le costanti e l'arrotondamento base.
// ============================================================

import type { FiscalOptions, FiscalResult } from '@/types/index'
import type { Database } from '@/types/database'

type DocumentItemRow = Database['public']['Tables']['document_items']['Row']

// ── ARROTONDAMENTO ────────────────────────────────────────────
// Round half up — MAI toFixed() — MAI banker's rounding
export function roundFiscale(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// ── STRINGA LEGALE FORFETTARIO ────────────────────────────────
// Non modificabile — obbligatoria per legge IT
export const FORFETTARIO_LEGAL_NOTICE =
  "Operazione effettuata ai sensi dell'art. 1, commi 54-89, L. 190/2014 " +
  '(Regime Forfettario) – Operazione fuori campo IVA ai sensi del comma 58, ' +
  "lettera a), del medesimo articolo"

// ── ALIQUOTE IVA DISPONIBILI ──────────────────────────────────
export const VAT_RATES = [
  { value: 22, label: '22% — Standard' },
  { value: 10, label: '10% — Ristrutturazioni su abitazioni' },
  { value: 5,  label: '5% — Servizi sociali' },
  { value: 4,  label: '4% — Prima necessità' },
  { value: 0,  label: '0% — Esente' },
] as const

// ── CALCOLO DOCUMENTO ─────────────────────────────────────────
// Ordine OBBLIGATORIO per conformità legge IT
export function calcolaDocumento(
  items: DocumentItemRow[],
  opts: FiscalOptions
): FiscalResult {
  // 1. Totale per voce
  const itemTotals = items.map((item) => ({
    ...item,
    total: roundFiscale(
      item.quantity * item.unit_price * (1 - ((item.discount_pct ?? 0) / 100))
    ),
  }))

  // 2. Subtotale
  const subtotal = roundFiscale(itemTotals.reduce((s, i) => s + i.total, 0))

  // 3. Sconto globale
  const afterDiscount = roundFiscale(
    subtotal * (1 - ((opts.discount_pct ?? 0) / 100)) - (opts.discount_fixed ?? 0)
  )

  // 4. IVA PER VOCE (non sul totale — obbligatorio per legge IT)
  const taxAmount =
    opts.fiscal_regime === 'forfettario'
      ? 0
      : roundFiscale(
          itemTotals.reduce(
            (s, i) =>
              s +
              roundFiscale(
                i.total * ((i.vat_rate ?? opts.vat_rate_default ?? 22) / 100)
              ),
            0
          )
        )

  // 5. Ritenuta d'acconto (opzionale)
  const ritenuta = opts.ritenuta_pct
    ? roundFiscale(afterDiscount * opts.ritenuta_pct / 100)
    : 0

  // 6. Marca da bollo (forfettari con totale > 77.47)
  const bollo =
    opts.fiscal_regime === 'forfettario' && afterDiscount > 77.47 ? 2.0 : 0

  // 7. Totale finale
  const total = roundFiscale(afterDiscount + taxAmount + bollo - ritenuta)

  return { subtotal, afterDiscount, taxAmount, ritenuta, bollo, total, itemTotals }
}
