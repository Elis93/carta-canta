import { describe, it, expect } from 'vitest'
import {
  DOC_NUMBER_RE,
  formatNotaCreditoNumber,
  docNumberSlug,
  numeroVarianti,
} from '@/lib/documents/numero'

// Eli, 10 ago: *"preferito che NC abbia uno spazio di separazione dal numero,
// ovunque"*. Lo spazio è consentito — nel tracciato FatturaPA il campo `Numero`
// è String20Type, pattern `(\p{IsBasicLatin}{1,20})`, e lo spazio (U+0020) sta
// nel blocco Basic Latin; l'unico vincolo di contenuto è il controllo 00425
// (almeno un carattere numerico). Ma il formato era validato da una regex
// scritta a mano in DUE punti che lo SPAZIO NON LO AMMETTEVA: senza questi
// test la nota nasceva e poi il form la rifiutava come «formato non valido».

describe('DOC_NUMBER_RE — cosa è un numero di documento valido', () => {
  it('accetta il sezionale con lo spazio', () => {
    expect(DOC_NUMBER_RE.test('NC 001/2026')).toBe(true)
    expect(DOC_NUMBER_RE.test('NC 12/2026')).toBe(true)
  })

  it('accetta ancora tutto ciò che accettava prima', () => {
    expect(DOC_NUMBER_RE.test('001/2026')).toBe(true)
    expect(DOC_NUMBER_RE.test('NC001/2026')).toBe(true)
    expect(DOC_NUMBER_RE.test('Prev001/2026')).toBe(true)
    expect(DOC_NUMBER_RE.test('Fatt014/2026')).toBe(true)
    expect(DOC_NUMBER_RE.test('123456/2026')).toBe(true)
  })

  it('continua a respingere ciò che non è un numero', () => {
    expect(DOC_NUMBER_RE.test('NC/2026')).toBe(false)        // nessuna cifra: scarto 00425
    expect(DOC_NUMBER_RE.test('NC 001')).toBe(false)         // manca l'anno
    expect(DOC_NUMBER_RE.test('NC  001/2026')).toBe(false)   // due spazi
    expect(DOC_NUMBER_RE.test('NC 001/26')).toBe(false)      // anno a due cifre
    expect(DOC_NUMBER_RE.test('001 / 2026')).toBe(false)     // spazi attorno allo slash
    expect(DOC_NUMBER_RE.test('1234567/2026')).toBe(false)   // sette cifre
  })

  it('lo spazio vive solo DOPO un sezionale, e il sezionale sta nei 20 caratteri', () => {
    // « 001/2026» con lo spazio orfano passava la vecchia regex (revisione
    // 10 ago) e finiva salvato nel database.
    expect(DOC_NUMBER_RE.test(' 001/2026')).toBe(false)
    // Un sezionale di 9+ lettere sfonderebbe lo String20Type FatturaPA.
    expect(DOC_NUMBER_RE.test('ABCDEFGHI 001/2026')).toBe(false)
    expect(DOC_NUMBER_RE.test('ABCDEFGH 123456/2026')).toBe(true) // esattamente 20
  })
})

describe('formatNotaCreditoNumber — il numero della nota', () => {
  it('scrive il sezionale staccato e il progressivo a tre cifre', () => {
    expect(formatNotaCreditoNumber(1, 2026)).toBe('NC 001/2026')
    expect(formatNotaCreditoNumber(14, 2026)).toBe('NC 014/2026')
  })

  it('oltre le tre cifre non tronca', () => {
    expect(formatNotaCreditoNumber(1234, 2026)).toBe('NC 1234/2026')
  })

  it('quello che produce è accettato dalla validazione del form', () => {
    // ⚠️ È il test che sarebbe mancato: il numero nasceva valido lato server e
    // veniva poi rifiutato dal form, che aveva la sua copia della regola.
    for (const n of [1, 9, 10, 999, 1000]) {
      expect(DOC_NUMBER_RE.test(formatNotaCreditoNumber(n, 2026))).toBe(true)
    }
  })

  it('sta entro i 20 caratteri del campo Numero della fattura elettronica', () => {
    expect(formatNotaCreditoNumber(999999, 2026).length).toBeLessThanOrEqual(20)
  })
})

describe('docNumberSlug — il numero dentro un nome di file', () => {
  it('toglie sia lo slash sia lo spazio', () => {
    expect(docNumberSlug('NC 001/2026')).toBe('NC-001-2026')
    expect(docNumberSlug('001/2026')).toBe('001-2026')
  })
})

describe('numeroVarianti — le due grafie convivono nella ricerca', () => {
  it('«nc001» trova anche «nc 001», e viceversa', () => {
    expect(numeroVarianti('nc001')).toContain('nc 001')
    expect(numeroVarianti('NC 001')).toContain('NC001')
  })

  it('la query digitata resta sempre la prima', () => {
    expect(numeroVarianti('nc001')[0]).toBe('nc001')
  })

  it('su una query normale non aggiunge rumore', () => {
    expect(numeroVarianti('caldaia')).toEqual(['caldaia'])
    expect(numeroVarianti('001/2026')).toEqual(['001/2026'])
    expect(numeroVarianti('')).toEqual([])
  })
})
