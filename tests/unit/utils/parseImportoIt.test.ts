import { describe, it, expect } from 'vitest'
import { parseImportoIt } from '@/lib/utils'

// parseImportoIt — parser condiviso degli importi in formato italiano.
// Nato dall'audit 6 lug 2026: le 5 copie locali leggevano "85.50" come 8550.

describe('parseImportoIt', () => {
  it('interpreta la virgola come separatore decimale', () => {
    expect(parseImportoIt('85,50')).toBe(85.5)
    expect(parseImportoIt('0,99')).toBe(0.99)
  })

  it('interpreta migliaia col punto + virgola decimale', () => {
    expect(parseImportoIt('1.500,50')).toBe(1500.5)
    expect(parseImportoIt('12.345.678,90')).toBe(12345678.9)
  })

  it('interpreta il punto decimale da tastierino (bug storico: 85.50 → 8550)', () => {
    expect(parseImportoIt('85.50')).toBe(85.5)
    expect(parseImportoIt('85.5')).toBe(85.5)
    expect(parseImportoIt('1234.56')).toBe(1234.56)
  })

  it('interpreta il punto come migliaia quando seguito da 3 cifre senza virgola', () => {
    expect(parseImportoIt('1.500')).toBe(1500)
    expect(parseImportoIt('12.500')).toBe(12500)
  })

  it('gestisce interi semplici e spazi', () => {
    expect(parseImportoIt('300')).toBe(300)
    expect(parseImportoIt('  300 ')).toBe(300)
  })

  it('arrotonda a 2 decimali', () => {
    expect(parseImportoIt('10,999')).toBe(11)
    expect(parseImportoIt('10,994')).toBe(10.99)
  })

  it('ritorna NaN su input non interpretabile o vuoto', () => {
    expect(Number.isNaN(parseImportoIt(''))).toBe(true)
    expect(Number.isNaN(parseImportoIt('abc'))).toBe(true)
    expect(Number.isNaN(parseImportoIt(null))).toBe(true)
    expect(Number.isNaN(parseImportoIt(undefined))).toBe(true)
  })
})
