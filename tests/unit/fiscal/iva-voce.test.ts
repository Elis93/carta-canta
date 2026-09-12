import { describe, it, expect } from 'vitest'
import { ivaEffettivaVoci, notaBeneSplit } from '@/lib/fiscal/iva-voce'
import type { VoceSplittabile } from '@/lib/fiscal/beni-significativi'

// La regola unica del 12 set (mockup «Sconto e IVA voce per voce»): la pillola
// dell'IVA su ogni voce mostra l'aliquota EFFETTIVA dopo lo split dei beni
// significativi. Questi test fissano i tre casi che il collaudo di Eli toccava.

// Il documento di prova del collaudo: Bagno 15×1,00 −10% (IVA 22) · Cucina
// 10×5,00 −9% (IVA 10, bene significativo) · Sala 1×100 (IVA 22). La Cucina è
// l'unica voce al 10% → per la regola dei beni significativi va per intero al 22.
const DOC_PROVA: VoceSplittabile[] = [
  { description: 'Bagno', quantity: 15, unit_price: 1, discount_pct: 10, vat_rate: 22 },
  { description: 'Cucina', quantity: 10, unit_price: 5, discount_pct: 9, vat_rate: 10, bene_significativo: true },
  { description: 'Sala', quantity: 1, unit_price: 100, vat_rate: 22 },
]

describe('ivaEffettivaVoci — la pillola mostra l\'aliquota vera', () => {
  it('voce normale: la pillola è l\'aliquota impostata', () => {
    const info = ivaEffettivaVoci(DOC_PROVA, 'ordinario', 22)
    expect(info[0].etichetta).toBe('22%') // Bagno
    expect(info[0].split).toBeNull()
    expect(info[2].etichetta).toBe('22%') // Sala
  })

  it('bene significativo che va TUTTO al 22 (P=0): pillola «22%», split solo al 22', () => {
    const info = ivaEffettivaVoci(DOC_PROVA, 'ordinario', 22)
    // La Cucina è l'unica al 10% → prestazione 0 → intero bene al 22%
    expect(info[1].etichetta).toBe('22%')
    expect(info[1].split).not.toBeNull()
    expect(info[1].split!.al10).toBe(0)
    expect(info[1].split!.al22).toBeCloseTo(45.5, 2)
  })

  it('bene significativo che si DIVIDE 10/22: pillola «10% + 22%»', () => {
    // Posa 100 al 10% + caldaia 150 al 10% (bene): prestazione 100, bene 150 →
    // 100 al 10% + 50 al 22% (mockup panel 7).
    const voci: VoceSplittabile[] = [
      { description: 'Posa e materiali', quantity: 1, unit_price: 100, vat_rate: 10 },
      { description: 'Caldaia', quantity: 1, unit_price: 150, vat_rate: 10, bene_significativo: true },
    ]
    const info = ivaEffettivaVoci(voci, 'ordinario', 22)
    expect(info[0].etichetta).toBe('10%') // la posa resta al 10
    expect(info[0].split).toBeNull()
    expect(info[1].etichetta).toBe('10% + 22%') // la caldaia si divide
    expect(info[1].split!.al10).toBeCloseTo(100, 2)
    expect(info[1].split!.al22).toBeCloseTo(50, 2)
  })

  it('bene che resta INTERO al 10% (prestazione ≥ bene): pillola «10%», nessuno split', () => {
    // Posa 200 al 10% + caldaia 150 (bene): bene ≤ prestazione → tutto al 10%.
    const voci: VoceSplittabile[] = [
      { description: 'Posa', quantity: 1, unit_price: 200, vat_rate: 10 },
      { description: 'Caldaia', quantity: 1, unit_price: 150, vat_rate: 10, bene_significativo: true },
    ]
    const info = ivaEffettivaVoci(voci, 'ordinario', 22)
    expect(info[1].etichetta).toBe('10%')
    // Nessuna eccedenza → la voce non è stata spezzata → niente riga di dettaglio.
    expect(info[1].split).toBeNull()
  })

  it('forfettario: nessuna pillola (l\'IVA non si addebita)', () => {
    const info = ivaEffettivaVoci(DOC_PROVA, 'forfettario', 22)
    expect(info.every((i) => i.etichetta === null)).toBe(true)
    expect(info.every((i) => i.split === null)).toBe(true)
  })

  it('reverse charge: nessuna pillola (l\'IVA la versa il committente, natura N6.7)', () => {
    const info = ivaEffettivaVoci(DOC_PROVA, 'ordinario', 22, true)
    expect(info.every((i) => i.etichetta === null)).toBe(true)
    expect(info.every((i) => i.split === null)).toBe(true)
  })

  it('IVA «predefinita» (null) → l\'etichetta usa il default del documento', () => {
    const voci: VoceSplittabile[] = [{ description: 'Voce', quantity: 1, unit_price: 100, vat_rate: null }]
    expect(ivaEffettivaVoci(voci, 'ordinario', 22)[0].etichetta).toBe('22%')
    expect(ivaEffettivaVoci(voci, 'ordinario', 10)[0].etichetta).toBe('10%')
  })

  it('un bene marcato ma NON più al 10% (aliquota cambiata a 22): pillola «22%», nessuno split', () => {
    // Il flag resta nel dato anche quando l'artigiano riporta la voce al 22:
    // non è più un bene agevolato, la pillola dice semplicemente 22 (stessa
    // guardia eBene del motore).
    const voci: VoceSplittabile[] = [
      { description: 'Caldaia', quantity: 1, unit_price: 150, vat_rate: 22, bene_significativo: true },
    ]
    const info = ivaEffettivaVoci(voci, 'ordinario', 22)
    expect(info[0].etichetta).toBe('22%')
    expect(info[0].split).toBeNull()
  })

  it('mai una lunghezza diversa dall\'input (una info per voce)', () => {
    expect(ivaEffettivaVoci(DOC_PROVA, 'ordinario', 22)).toHaveLength(3)
    expect(ivaEffettivaVoci([], 'ordinario', 22)).toHaveLength(0)
  })
})

describe('notaBeneSplit — la riga grigia di dettaglio', () => {
  it('tutto al 22 (P=0): dice «per intero al 22%»', () => {
    expect(notaBeneSplit({ al10: 0, al22: 45.5 })).toContain('per intero al 22%')
  })
  it('diviso 10/22: mostra le due quote', () => {
    const s = notaBeneSplit({ al10: 100, al22: 50 })
    expect(s).toContain('al 10%')
    expect(s).toContain('al 22%')
  })
})
