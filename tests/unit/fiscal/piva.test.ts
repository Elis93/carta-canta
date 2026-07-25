import { describe, it, expect } from 'vitest'
import { isValidPivaFormat } from '@/lib/fiscal/piva'

// La P.IVA sbagliata è tra le prime cause di scarto SdI: questi test
// congelano il pre-check che la intercetta PRIMA della trasmissione.

describe('isValidPivaFormat', () => {
  it('accetta P.IVA reali/valide', () => {
    // P.IVA di test dell'Agenzia usata anche nella sandbox SdI
    expect(isValidPivaFormat('12345678903')).toBe(true)
    // Altre combinazioni con cifra di controllo corretta
    expect(isValidPivaFormat('00000000000'.slice(0, 0) + '01234567897')).toBe(true)
  })

  it('accetta formati "sporchi" (spazi, punti, prefisso IT)', () => {
    expect(isValidPivaFormat('IT 12345678903')).toBe(true)
    expect(isValidPivaFormat('123.456.789-03')).toBe(true)
  })

  it('rifiuta lunghezze diverse da 11 cifre', () => {
    expect(isValidPivaFormat('1234567890')).toBe(false)   // 10
    expect(isValidPivaFormat('123456789012')).toBe(false) // 12
    expect(isValidPivaFormat('')).toBe(false)
    expect(isValidPivaFormat(null)).toBe(false)
    expect(isValidPivaFormat(undefined)).toBe(false)
  })

  it('rifiuta la cifra di controllo sbagliata (il typo tipico)', () => {
    expect(isValidPivaFormat('12345678901')).toBe(false)
    expect(isValidPivaFormat('12345678902')).toBe(false)
    expect(isValidPivaFormat('12345678904')).toBe(false)
  })

  it('rifiuta le sequenze tutte uguali (00000000000, 11111111111)', () => {
    expect(isValidPivaFormat('00000000000')).toBe(false)
    expect(isValidPivaFormat('11111111111')).toBe(false)
    expect(isValidPivaFormat('99999999999')).toBe(false)
  })

  it('rifiuta stringhe non numeriche', () => {
    expect(isValidPivaFormat('ABCDEFGHILM')).toBe(false)
    expect(isValidPivaFormat('non una piva')).toBe(false)
  })
})
