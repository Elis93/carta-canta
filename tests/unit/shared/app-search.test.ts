import { describe, it, expect } from 'vitest'
import { cercaFunzioni, normalizza, VOCI_APP } from '@/lib/app-search'

// Il cerca serve a chi NON ricorda dove sta una funzione. Se risponde "niente"
// alla parola che l'artigiano userebbe, smette di essere riaperto: questi test
// fissano proprio le parole sue, non i nomi interni.

const primo = (q: string) => cercaFunzioni(q)[0]?.label
const etichette = (q: string) => cercaFunzioni(q).map((v) => v.label)

describe('normalizza', () => {
  it('appiattisce accenti, maiuscole e punteggiatura', () => {
    expect(normalizza('P.IVA')).toBe('p iva')
    expect(normalizza('Novità')).toBe('novita')
    expect(normalizza('  Blocco   dell’app ')).toBe('blocco dell app')
  })
})

describe('cercaFunzioni — le parole dell’artigiano', () => {
  it('trova le coordinate di pagamento cercando "iban" o "bonifico"', () => {
    expect(primo('iban')).toBe('Come farti pagare')
    expect(primo('bonifico')).toBe('Come farti pagare')
  })

  it('trova il blocco dell’app cercando "impronta"', () => {
    expect(primo('impronta')).toBe('Blocco dell’app')
  })

  it('trova il cestino con le parole del ripensamento', () => {
    expect(etichette('buttato')).toContain('Cestino')
    expect(etichette('per sbaglio')).toContain('Cestino')
    expect(etichette('recuperare')).toContain('Cestino')
  })

  it('trova i calcoli cercando "metri quadri" o "piastrelle"', () => {
    expect(primo('piastrelle')).toBe('Calcoli')
    expect(etichette('metri quadri')).toContain('Calcoli')
  })

  it('trova il commercialista', () => {
    expect(primo('commercialista')).toBe('Il tuo commercialista')
  })
})

describe('cercaFunzioni — comportamento', () => {
  it('sotto i due caratteri non risponde: mezza lettera non è una ricerca', () => {
    expect(cercaFunzioni('')).toEqual([])
    expect(cercaFunzioni('i')).toEqual([])
  })

  it('più parole RESTRINGONO, non allargano', () => {
    const una = cercaFunzioni('costo')
    const due = cercaFunzioni('costo orario')
    expect(due.length).toBeLessThanOrEqual(una.length)
    expect(due.every((v) => una.some((u) => u.label === v.label))).toBe(true)
  })

  it('il nome esatto vince sui sinonimi', () => {
    expect(primo('bilancio')).toBe('Bilancio')
    expect(primo('cestino')).toBe('Cestino')
  })

  it('non inventa risultati per parole che non c’entrano', () => {
    expect(cercaFunzioni('trattoreagricolo')).toEqual([])
  })

  it('non restituisce mai più del limite', () => {
    expect(cercaFunzioni('a', 5).length).toBeLessThanOrEqual(5)
    expect(cercaFunzioni('fattura', 3).length).toBeLessThanOrEqual(3)
  })
})

describe('VOCI_APP — igiene del dizionario', () => {
  it('ogni voce ha destinazione, etichetta e almeno una parola di ricerca', () => {
    for (const v of VOCI_APP) {
      expect(v.label.trim().length).toBeGreaterThan(0)
      expect(v.href.startsWith('/')).toBe(true)
      expect(v.parole.length).toBeGreaterThan(0)
    }
  })

  it('nessuna etichetta duplicata (due righe identiche nei risultati confondono)', () => {
    const viste = VOCI_APP.map((v) => v.label)
    expect(new Set(viste).size).toBe(viste.length)
  })
})
