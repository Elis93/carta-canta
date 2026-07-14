import { describe, it, expect } from 'vitest'
import { parseManualHours } from '@/lib/lavori/parse-hours'

// L'input ore è il "guardiano" delle ore di manodopera: questi test provano
// che i valori validi diventano minuti corretti e che i malformati (che
// parseImportoIt leggerebbe in silenzio) vengono rifiutati.

describe('parseManualHours', () => {
  it('converte le ore decimali in minuti (virgola italiana)', () => {
    expect(parseManualHours('1,5')).toEqual({ minutes: 90 })
    expect(parseManualHours('2')).toEqual({ minutes: 120 })
    expect(parseManualHours('0,25')).toEqual({ minutes: 15 })
  })

  it('accetta il punto come separatore decimale', () => {
    expect(parseManualHours('1.5')).toEqual({ minutes: 90 })
  })

  it('accetta le correzioni negative (segno meno)', () => {
    expect(parseManualHours('-2')).toEqual({ minutes: -120 })
    expect(parseManualHours('-1,5')).toEqual({ minutes: -90 })
  })

  it('ignora gli spazi attorno al numero', () => {
    expect(parseManualHours('  1,5  ')).toEqual({ minutes: 90 })
  })

  it('RIFIUTA input malformato con più separatori ("1.5.5" ≠ 155 ore)', () => {
    const r = parseManualHours('1.5.5')
    expect(r).toHaveProperty('error')
  })

  it('rifiuta testo non numerico', () => {
    expect(parseManualHours('abc')).toHaveProperty('error')
    expect(parseManualHours('1h30')).toHaveProperty('error')
  })

  it('rifiuta stringa vuota', () => {
    expect(parseManualHours('')).toHaveProperty('error')
    expect(parseManualHours('   ')).toHaveProperty('error')
  })

  it('rifiuta lo zero (nessuna ora da aggiungere)', () => {
    expect(parseManualHours('0')).toHaveProperty('error')
    expect(parseManualHours('0,0')).toHaveProperty('error')
  })

  it('arrotonda i minuti al valore intero più vicino', () => {
    // parseImportoIt arrotonda prima a 2 decimali: 1,555 → 1,56 h → 93,6 min → 94
    expect(parseManualHours('1,555')).toEqual({ minutes: 94 })
    // 1,5 h esatte = 90 min (nessun arrotondamento)
    expect(parseManualHours('1,5')).toEqual({ minutes: 90 })
  })
})
