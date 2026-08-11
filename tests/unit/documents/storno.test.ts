import { describe, it, expect } from 'vitest'
import {
  baseStornabile,
  sommaNoteAttive,
  residuoStornabile,
  superaIlTetto,
  scalaPrezzo,
  TOLLERANZA_STORNO,
} from '@/lib/documents/storno'

// L'invariante del multi-nota (decisione Eli, 10 ago): la somma delle note
// ATTIVE di una fattura non supera il totale della fattura. La ricognizione
// aveva scoperto che il tetto non esisteva nemmeno per la nota singola.

describe('sommaNoteAttive — chi conta nel tetto', () => {
  it('le note annullate NON contano', () => {
    expect(sommaNoteAttive([
      { total: 100, status: 'draft' },
      { total: 50, status: 'rejected' },
      { total: 30, status: 'sent' },
    ])).toBe(130)
  })

  it('lista vuota → zero', () => {
    expect(sommaNoteAttive([])).toBe(0)
  })

  it('totali null valgono zero, non NaN', () => {
    expect(sommaNoteAttive([{ total: null, status: 'draft' }])).toBe(0)
  })

  it('il bollo DELLA NOTA non conta come storno (N4, 11 ago)', () => {
    // Nota forfettaria da 100 € di operazioni + 2 € di bollo: nel tetto
    // pesano solo i 100 — sommare i totali farebbe sembrare stornati 102.
    expect(sommaNoteAttive([
      { total: 102, bollo_amount: 2, status: 'sent' },
    ])).toBe(100)
  })

  it('fattura 102 (100+2 bollo) stornata da nota 102 (100+2 bollo) → residuo ZERO', () => {
    // Il giro completo del caso forfettario: entrambe le basi sono 100,
    // il residuo si chiude esattamente — niente residui fantasma né
    // sforamenti da imposta.
    const baseFattura = baseStornabile(102, 2)
    const somma = sommaNoteAttive([{ total: 102, bollo_amount: 2, status: 'sent' }])
    expect(residuoStornabile(baseFattura, somma)).toBe(0)
    expect(superaIlTetto(0, somma, baseFattura)).toBe(false)
  })
})

describe('residuoStornabile', () => {
  it('è il totale meno le note, mai negativo', () => {
    expect(residuoStornabile(1000, 400)).toBe(600)
    expect(residuoStornabile(1000, 1000)).toBe(0)
    expect(residuoStornabile(1000, 1200)).toBe(0)
  })

  it('gli arrotondamenti non producono residui fantasma', () => {
    expect(residuoStornabile(100, 99.999999)).toBe(0)
  })
})

describe('superaIlTetto — il blocco della trasmissione', () => {
  it('dentro il totale: passa', () => {
    expect(superaIlTetto(400, 600, 1000)).toBe(false)
  })

  it('oltre il totale: blocca', () => {
    expect(superaIlTetto(500, 600, 1000)).toBe(true)
  })

  it('un centesimo di arrotondamento NON blocca (stessa tolleranza dello SdI)', () => {
    expect(superaIlTetto(500.01, 500, 1000)).toBe(false)
    expect(superaIlTetto(500 + TOLLERANZA_STORNO + 0.01, 500, 1000)).toBe(true)
  })

  it('il caso di oggi: nota singola gonfiata oltre la fattura → blocca', () => {
    // Prima del tetto si poteva: la nota nasceva piena e si poteva ALZARE.
    expect(superaIlTetto(1200, 0, 1000)).toBe(true)
  })
})

describe('scalaPrezzo — la seconda nota nasce DENTRO il residuo', () => {
  it('riduce in proporzione, arrotondando PER DIFETTO', () => {
    // 100 × 0.333 = 33.3 → 33.30; 99.99 × 0.5 = 49.995 → 49.99 (non 50.00)
    expect(scalaPrezzo(100, 0.333)).toBe(33.3)
    expect(scalaPrezzo(99.99, 0.5)).toBe(49.99)
  })

  it('fattore 1 o più: prezzo intatto', () => {
    expect(scalaPrezzo(80, 1)).toBe(80)
  })

  it('fattore zero, negativo o rotto: prezzo a zero, mai NaN', () => {
    expect(scalaPrezzo(80, 0)).toBe(0)
    expect(scalaPrezzo(80, -1)).toBe(0)
    expect(scalaPrezzo(80, NaN)).toBe(0)
  })

  it('il rumore binario dei float non fa arrotondare in giù un valore esatto', () => {
    // 0.29 × 0.1... senza EPSILON, floor(28.999999...) darebbe 28.99
    expect(scalaPrezzo(289.9, 0.1)).toBe(28.99)
    expect(scalaPrezzo(100, 0.29)).toBe(29)
  })
})


describe('baseStornabile — il bollo non è un\u2019operazione stornabile', () => {
  it('forfettario: fattura 100 + 2 di bollo → base 100', () => {
    // Il caso del ricontrollo 10 ago: col tetto sul TOTALE, la prima nota
    // «piena» (100 €, bollo 0) lasciava un residuo fantasma di 2 € — tasto
    // acceso a fattura già stornata per intero.
    expect(baseStornabile(102, 2)).toBe(100)
    expect(residuoStornabile(baseStornabile(102, 2), 100)).toBe(0)
  })

  it('ordinario senza bollo: base = totale', () => {
    expect(baseStornabile(122, 0)).toBe(122)
  })

  it('bollo negativo o sporco non gonfia la base', () => {
    expect(baseStornabile(100, -5)).toBe(100)
  })
})
