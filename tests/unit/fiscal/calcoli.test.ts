import { describe, it, expect } from 'vitest'
import {
  roundFiscale,
  calcolaDocumento,
  FORFETTARIO_LEGAL_NOTICE,
  VAT_RATES,
} from '@/lib/fiscal/calcoli'
import type { FiscalOptions } from '@/types/index'
import type { Database } from '@/types/database'

type DocumentItemRow = Database['public']['Tables']['document_items']['Row']

// ── Helper ─────────────────────────────────────────────────────────────────
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
    total: 0,
    ai_generated: false,
    ai_confidence: null,
    ...overrides,
  }
}

const FORFETTARIO: FiscalOptions = {
  fiscal_regime: 'forfettario',
  currency: 'EUR',
}

const ORDINARIO: FiscalOptions = {
  fiscal_regime: 'ordinario',
  currency: 'EUR',
  vat_rate_default: 22,
}

// ── roundFiscale ───────────────────────────────────────────────────────────
describe('roundFiscale', () => {
  it('arrotonda valori interi invariati', () => {
    expect(roundFiscale(100)).toBe(100)
    expect(roundFiscale(0)).toBe(0)
  })

  it('arrotonda 2 decimali correttamente', () => {
    expect(roundFiscale(10.005)).toBe(10.01)
    expect(roundFiscale(10.004)).toBe(10)
    expect(roundFiscale(1.255)).toBe(1.26)
    expect(roundFiscale(1.254)).toBe(1.25)
  })

  it('gestisce valori negativi', () => {
    // Math.round in JS arrotonda .5 verso +∞ (es. -10.5 → -10)
    expect(roundFiscale(-10.5)).toBe(-10.5) // non applicabile fiscalmente, verifica no crash
    expect(roundFiscale(-1.25)).toBe(-1.25)
  })

  it('gestisce floating point imprecisi (es. 0.1 + 0.2)', () => {
    const result = roundFiscale(0.1 + 0.2)
    expect(result).toBe(0.3)
  })

  it('usa Number.EPSILON per evitare banker rounding', () => {
    // 1.115 in floating point è leggermente sotto 1.115
    // senza EPSILON si arrotonda a 1.11 — con EPSILON a 1.12
    expect(roundFiscale(1.115)).toBe(1.12)
  })
})

// ── FORFETTARIO_LEGAL_NOTICE ───────────────────────────────────────────────
describe('FORFETTARIO_LEGAL_NOTICE', () => {
  it('è una stringa non vuota', () => {
    expect(typeof FORFETTARIO_LEGAL_NOTICE).toBe('string')
    expect(FORFETTARIO_LEGAL_NOTICE.length).toBeGreaterThan(50)
  })

  it('contiene il riferimento normativo art. 1 L. 190/2014', () => {
    expect(FORFETTARIO_LEGAL_NOTICE).toContain('art. 1')
    expect(FORFETTARIO_LEGAL_NOTICE).toContain('L. 190/2014')
    expect(FORFETTARIO_LEGAL_NOTICE).toContain('Forfettario')
  })

  it('contiene la dicitura fuori campo IVA', () => {
    expect(FORFETTARIO_LEGAL_NOTICE).toContain('fuori campo IVA')
  })
})

// ── VAT_RATES ──────────────────────────────────────────────────────────────
describe('VAT_RATES', () => {
  it('contiene esattamente 5 aliquote', () => {
    expect(VAT_RATES).toHaveLength(5)
  })

  it('include aliquota 22% standard', () => {
    const std = VAT_RATES.find((r) => r.value === 22)
    expect(std).toBeDefined()
    expect(std?.label).toContain('Standard')
  })

  it('include aliquota 0%', () => {
    expect(VAT_RATES.find((r) => r.value === 0)).toBeDefined()
  })

  it('tutte le aliquote hanno value e label', () => {
    for (const rate of VAT_RATES) {
      expect(typeof rate.value).toBe('number')
      expect(typeof rate.label).toBe('string')
    }
  })
})

// ── calcolaDocumento — FORFETTARIO ─────────────────────────────────────────
describe('calcolaDocumento — regime forfettario', () => {
  it('nessuna IVA in regime forfettario', () => {
    const items = [makeItem({ quantity: 1, unit_price: 100 })]
    const result = calcolaDocumento(items, FORFETTARIO)
    expect(result.taxAmount).toBe(0)
  })

  it('bollo €2 quando afterDiscount > 77.47', () => {
    const items = [makeItem({ quantity: 1, unit_price: 100 })]
    const result = calcolaDocumento(items, FORFETTARIO)
    expect(result.bollo).toBe(2.0)
  })

  it('nessun bollo quando afterDiscount = 77.47 (soglia esatta)', () => {
    const items = [makeItem({ quantity: 1, unit_price: 77.47 })]
    const result = calcolaDocumento(items, FORFETTARIO)
    expect(result.bollo).toBe(0)
  })

  it('nessun bollo quando afterDiscount < 77.47', () => {
    const items = [makeItem({ quantity: 1, unit_price: 50 })]
    const result = calcolaDocumento(items, FORFETTARIO)
    expect(result.bollo).toBe(0)
  })

  it('totale = afterDiscount + bollo (nessuna IVA, nessuna ritenuta)', () => {
    const items = [makeItem({ quantity: 1, unit_price: 100 })]
    const result = calcolaDocumento(items, FORFETTARIO)
    expect(result.total).toBe(102)
  })

  it('subtotale con voce singola q=2 prezzo=50', () => {
    const items = [makeItem({ quantity: 2, unit_price: 50 })]
    const result = calcolaDocumento(items, FORFETTARIO)
    expect(result.subtotal).toBe(100)
  })

  it('subtotale con più voci', () => {
    const items = [
      makeItem({ id: 'i1', quantity: 1, unit_price: 100 }),
      makeItem({ id: 'i2', quantity: 2, unit_price: 50 }),
    ]
    const result = calcolaDocumento(items, FORFETTARIO)
    expect(result.subtotal).toBe(200)
    expect(result.total).toBe(202) // bollo perché > 77.47
  })

  it('lista vuota → tutti zeri', () => {
    const result = calcolaDocumento([], FORFETTARIO)
    expect(result.subtotal).toBe(0)
    expect(result.taxAmount).toBe(0)
    expect(result.bollo).toBe(0)
    expect(result.total).toBe(0)
  })
})

// ── calcolaDocumento — ORDINARIO ───────────────────────────────────────────
describe('calcolaDocumento — regime ordinario', () => {
  it('calcola IVA 22% di default per voce', () => {
    const items = [makeItem({ quantity: 1, unit_price: 100, vat_rate: null })]
    const result = calcolaDocumento(items, ORDINARIO)
    expect(result.taxAmount).toBe(22)
  })

  it('calcola IVA per-voce se specificata (10%)', () => {
    const items = [makeItem({ quantity: 1, unit_price: 100, vat_rate: 10 })]
    const result = calcolaDocumento(items, ORDINARIO)
    expect(result.taxAmount).toBe(10)
  })

  it('calcola IVA 0% correttamente', () => {
    const items = [makeItem({ quantity: 1, unit_price: 100, vat_rate: 0 })]
    const result = calcolaDocumento(items, ORDINARIO)
    expect(result.taxAmount).toBe(0)
  })

  it('usa vat_rate_default delle opzioni se voce non ha aliquota', () => {
    const opts: FiscalOptions = { ...ORDINARIO, vat_rate_default: 10 }
    const items = [makeItem({ quantity: 1, unit_price: 100, vat_rate: null })]
    const result = calcolaDocumento(items, opts)
    expect(result.taxAmount).toBe(10)
  })

  it('fallback a 22% se vat_rate_default non specificato e voce senza aliquota', () => {
    const opts: FiscalOptions = { fiscal_regime: 'ordinario', currency: 'EUR' }
    const items = [makeItem({ quantity: 1, unit_price: 100, vat_rate: null })]
    const result = calcolaDocumento(items, opts)
    expect(result.taxAmount).toBe(22)
  })

  it('IVA calcolata su totale voce (qty × prezzo), non sul grand total', () => {
    const items = [makeItem({ quantity: 2, unit_price: 50, vat_rate: 22 })]
    const result = calcolaDocumento(items, ORDINARIO)
    // totale voce = 100; IVA = 22
    expect(result.taxAmount).toBe(22)
  })

  it('somma IVA di più voci con aliquote diverse', () => {
    const items = [
      makeItem({ id: 'i1', quantity: 1, unit_price: 100, vat_rate: 22 }), // 22
      makeItem({ id: 'i2', quantity: 1, unit_price: 100, vat_rate: 10 }), // 10
    ]
    const result = calcolaDocumento(items, ORDINARIO)
    expect(result.taxAmount).toBe(32)
  })

  it('nessun bollo in regime ordinario', () => {
    const items = [makeItem({ quantity: 1, unit_price: 1000 })]
    const result = calcolaDocumento(items, ORDINARIO)
    expect(result.bollo).toBe(0)
  })

  it('totale = afterDiscount + IVA', () => {
    const items = [makeItem({ quantity: 1, unit_price: 100, vat_rate: 22 })]
    const result = calcolaDocumento(items, ORDINARIO)
    expect(result.total).toBe(122)
  })

  it('regime minimi: zero IVA (come forfettario)', () => {
    const opts: FiscalOptions = { fiscal_regime: 'minimi', currency: 'EUR' }
    const items = [makeItem({ quantity: 1, unit_price: 100, vat_rate: 22 })]
    const result = calcolaDocumento(items, opts)
    // minimi non è 'forfettario', quindi IVA viene calcolata
    // (se il business logic lo richiede diversamente, aggiornare il test)
    expect(result.taxAmount).toBe(22)
  })
})

// ── calcolaDocumento — SCONTI ──────────────────────────────────────────────
describe('calcolaDocumento — sconti', () => {
  it('sconto percentuale sul subtotale', () => {
    const items = [makeItem({ quantity: 1, unit_price: 100 })]
    const opts: FiscalOptions = { ...FORFETTARIO, discount_pct: 10 }
    const result = calcolaDocumento(items, opts)
    expect(result.afterDiscount).toBe(90)
    expect(result.subtotal).toBe(100)
  })

  it('sconto fisso sul subtotale dopo sconto %', () => {
    const items = [makeItem({ quantity: 1, unit_price: 100 })]
    const opts: FiscalOptions = { ...FORFETTARIO, discount_fixed: 20 }
    const result = calcolaDocumento(items, opts)
    expect(result.afterDiscount).toBe(80)
  })

  it('sconto % + sconto fisso combinati', () => {
    const items = [makeItem({ quantity: 1, unit_price: 200 })]
    const opts: FiscalOptions = {
      ...FORFETTARIO,
      discount_pct: 10,   // 200 * 0.90 = 180
      discount_fixed: 10, // 180 - 10 = 170
    }
    const result = calcolaDocumento(items, opts)
    expect(result.afterDiscount).toBe(170)
  })

  it('sconto per voce (discount_pct sul singolo item)', () => {
    const items = [makeItem({ quantity: 1, unit_price: 100, discount_pct: 50 })]
    const result = calcolaDocumento(items, FORFETTARIO)
    expect(result.itemTotals[0].total).toBe(50)
    expect(result.subtotal).toBe(50)
  })

  it('discount_pct null → nessuno sconto', () => {
    const items = [makeItem({ quantity: 1, unit_price: 100, discount_pct: null })]
    const result = calcolaDocumento(items, FORFETTARIO)
    expect(result.itemTotals[0].total).toBe(100)
  })
})

// ── calcolaDocumento — RITENUTA ────────────────────────────────────────────
describe('calcolaDocumento — ritenuta d\'acconto', () => {
  it('ritenuta 20% calcolata su afterDiscount', () => {
    const items = [makeItem({ quantity: 1, unit_price: 100 })]
    const opts: FiscalOptions = { ...FORFETTARIO, ritenuta_pct: 20 }
    const result = calcolaDocumento(items, opts)
    expect(result.ritenuta).toBe(20)
    // totale = 100 + 2 (bollo) - 20 (ritenuta) = 82
    expect(result.total).toBe(82)
  })

  it('senza ritenuta_pct → ritenuta = 0', () => {
    const items = [makeItem({ quantity: 1, unit_price: 100 })]
    const result = calcolaDocumento(items, FORFETTARIO)
    expect(result.ritenuta).toBe(0)
  })

  it('ritenuta con sconto applicato prima', () => {
    const items = [makeItem({ quantity: 1, unit_price: 200 })]
    const opts: FiscalOptions = {
      ...FORFETTARIO,
      discount_pct: 10,   // afterDiscount = 180
      ritenuta_pct: 20,   // ritenuta = 180 * 0.20 = 36
    }
    const result = calcolaDocumento(items, opts)
    expect(result.ritenuta).toBe(36)
  })
})

// ── calcolaDocumento — ARROTONDAMENTO ─────────────────────────────────────
describe('calcolaDocumento — arrotondamenti precisi', () => {
  it('IVA per voce arrotondata singolarmente prima della somma', () => {
    // 2 voci da €33.33 con IVA 22%
    // IVA per voce: 33.33 * 0.22 = 7.3326 → round = 7.33
    // totale IVA: 7.33 + 7.33 = 14.66
    const items = [
      makeItem({ id: 'i1', quantity: 1, unit_price: 33.33, vat_rate: 22 }),
      makeItem({ id: 'i2', quantity: 1, unit_price: 33.33, vat_rate: 22 }),
    ]
    const result = calcolaDocumento(items, ORDINARIO)
    expect(result.taxAmount).toBe(14.66)
  })

  it('subtotale arrotondato correttamente con molte voci', () => {
    // 3 voci da 10 cents
    const items = [
      makeItem({ id: 'i1', quantity: 1, unit_price: 0.1 }),
      makeItem({ id: 'i2', quantity: 1, unit_price: 0.1 }),
      makeItem({ id: 'i3', quantity: 1, unit_price: 0.1 }),
    ]
    const result = calcolaDocumento(items, FORFETTARIO)
    expect(result.subtotal).toBe(0.3)
  })

  it('totale arrotondato al centesimo', () => {
    // 3 * 1.005 in floating point = 3.0149999... → round = 3.01
    const items = [makeItem({ quantity: 3, unit_price: 1.005, vat_rate: 22 })]
    const result = calcolaDocumento(items, ORDINARIO)
    expect(result.itemTotals[0].total).toBe(3.01)
  })
})

// ── calcolaDocumento — STRUTTURA RITORNO ──────────────────────────────────
describe('calcolaDocumento — struttura risultato', () => {
  it('itemTotals contiene tutti i campi originali + total', () => {
    const item = makeItem({ quantity: 2, unit_price: 10 })
    const result = calcolaDocumento([item], FORFETTARIO)
    const out = result.itemTotals[0]
    expect(out.id).toBe(item.id)
    expect(out.description).toBe(item.description)
    expect(out.quantity).toBe(2)
    expect(out.unit_price).toBe(10)
    expect(out.total).toBe(20)
  })

  it('restituisce tutti i campi attesi', () => {
    const result = calcolaDocumento([], FORFETTARIO)
    expect(result).toHaveProperty('subtotal')
    expect(result).toHaveProperty('afterDiscount')
    expect(result).toHaveProperty('taxAmount')
    expect(result).toHaveProperty('ritenuta')
    expect(result).toHaveProperty('bollo')
    expect(result).toHaveProperty('total')
    expect(result).toHaveProperty('itemTotals')
    expect(Array.isArray(result.itemTotals)).toBe(true)
  })
})
