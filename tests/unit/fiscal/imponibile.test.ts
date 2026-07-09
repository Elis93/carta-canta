import { describe, it, expect } from 'vitest'
import { imponibileNettoSconti } from '@/lib/fiscal/imponibile'
import { calcolaDocumento } from '@/lib/fiscal/calcoli'
import type { FiscalOptions } from '@/types/index'
import type { Database } from '@/types/database'

type DocumentItemRow = Database['public']['Tables']['document_items']['Row']

function makeItem(overrides: Partial<DocumentItemRow> = {}): DocumentItemRow {
  return {
    id: 'item-1',
    document_id: 'doc-1',
    sort_order: 0,
    description: 'Voce di test',
    unit: 'pz',
    quantity: 1,
    unit_price: 100,
    discount_pct: null,
    vat_rate: null,
    bonus_tipo: null,
    total: null,
    ai_confidence: null,
    ai_generated: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- campi extra (041) non usati dal motore
  } as any
}

const OPTS_BASE: FiscalOptions = { fiscal_regime: 'ordinario', currency: 'EUR' }

describe('imponibileNettoSconti', () => {
  it('senza sconti restituisce il subtotale', () => {
    expect(imponibileNettoSconti(100)).toBe(100)
    expect(imponibileNettoSconti(85.5, null, null)).toBe(85.5)
    expect(imponibileNettoSconti(0)).toBe(0)
  })

  it('applica lo sconto percentuale con arrotondamento fiscale', () => {
    expect(imponibileNettoSconti(100, 10)).toBe(90)
    expect(imponibileNettoSconti(33.33, 50)).toBe(16.67) // round half up: 16.665 → 16.67
  })

  it('applica lo sconto fisso dopo il percentuale', () => {
    expect(imponibileNettoSconti(100, 10, 5)).toBe(85)
    expect(imponibileNettoSconti(200, null, 20)).toBe(180)
  })

  it('non scende mai sotto zero', () => {
    expect(imponibileNettoSconti(50, 0, 100)).toBe(0)
    expect(imponibileNettoSconti(50, 100, 0)).toBe(0)
    expect(imponibileNettoSconti(50, 100, 10)).toBe(0)
  })

  it('coincide con afterDiscount del motore fiscale (proprietà di coerenza)', () => {
    // Griglia di casi: (voci → subtotal) × sconti — il valore esposto al
    // commercialista deve essere esattamente l'afterDiscount di calcolaDocumento.
    const cases: Array<{ qty: number; price: number; pct?: number; fixed?: number }> = [
      { qty: 1, price: 100 },
      { qty: 3, price: 33.33, pct: 10 },
      { qty: 2, price: 85.5, fixed: 12.75 },
      { qty: 5, price: 19.99, pct: 15, fixed: 7.5 },
      { qty: 1, price: 77.47, pct: 50, fixed: 50 }, // sconti oltre il subtotale → 0
    ]
    for (const c of cases) {
      const items = [makeItem({ quantity: c.qty, unit_price: c.price })]
      const opts: FiscalOptions = { ...OPTS_BASE, discount_pct: c.pct, discount_fixed: c.fixed }
      const res = calcolaDocumento(items, opts)
      expect(imponibileNettoSconti(res.subtotal, c.pct, c.fixed)).toBe(res.afterDiscount)
    }
  })
})
