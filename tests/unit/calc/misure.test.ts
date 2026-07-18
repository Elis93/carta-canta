import { describe, it, expect } from 'vitest'
import { parseMisure, misuraText, misureToNotes, MAX_MISURE, type Misura } from '@/lib/calc/misure'

const valida: Misura = {
  id: 'm-1',
  tab: 'superficie',
  fields: { lungh: '4', largh: '3,5', scarto: '10' },
  label: 'Superficie',
  detail: '4 × 3,5 m +10% scarto',
  value: 15.4,
  unit: 'm²',
  decimals: 2,
}

describe('parseMisure', () => {
  it('round-trip: JSON.stringify → parse restituisce la misura', () => {
    const out = parseMisure(JSON.stringify([valida]))
    expect(out).toHaveLength(1)
    expect(out[0]).toEqual(valida)
  })

  it('accetta anche il valore già deserializzato (JSONB dal DB)', () => {
    expect(parseMisure([valida])).toHaveLength(1)
  })

  it('input non validi → lista vuota, senza lanciare', () => {
    expect(parseMisure('')).toEqual([])
    expect(parseMisure('non-json{')).toEqual([])
    expect(parseMisure(null)).toEqual([])
    expect(parseMisure(42)).toEqual([])
    expect(parseMisure({ a: 1 })).toEqual([])
  })

  it('scarta le voci malformate ma tiene quelle valide', () => {
    const out = parseMisure([
      valida,
      { ...valida, id: 2 },                 // id non stringa
      { ...valida, tab: 'altro' },          // tab sconosciuta
      { ...valida, value: 'NaN' },          // valore non numerico
      null,
    ])
    expect(out).toHaveLength(1)
  })

  it('tronca oltre MAX_MISURE e limita le lunghezze dei campi', () => {
    const tante = Array.from({ length: MAX_MISURE + 10 }, (_, i) => ({ ...valida, id: `m-${i}` }))
    expect(parseMisure(tante)).toHaveLength(MAX_MISURE)
    const lunga = parseMisure([{ ...valida, detail: 'x'.repeat(500) }])
    expect(lunga[0].detail).toHaveLength(160)
  })

  it('decimals fuori range → clampati (0-3), default 2', () => {
    expect(parseMisure([{ ...valida, decimals: 9 }])[0].decimals).toBe(3)
    expect(parseMisure([{ ...valida, decimals: -1 }])[0].decimals).toBe(0)
    expect(parseMisure([{ ...valida, decimals: undefined }])[0].decimals).toBe(2)
  })
})

describe('misuraText / misureToNotes', () => {
  it('riga leggibile con numero in formato italiano', () => {
    expect(misuraText(valida)).toBe('Superficie: 4 × 3,5 m +10% scarto = 15,4 m²')
  })

  it('blocco note con intestazione e un bullet per misura', () => {
    const txt = misureToNotes([valida, { ...valida, id: 'm-2', label: 'Vernice', unit: 'litri', value: 3.5, decimals: 1, detail: '14 m², 2 mani' }])
    expect(txt).toContain('Misure calcolate:')
    expect(txt).toContain('• Superficie:')
    expect(txt).toContain('• Vernice: 14 m², 2 mani = 3,5 litri')
  })

  it('lista vuota → stringa vuota (nessuna intestazione orfana)', () => {
    expect(misureToNotes([])).toBe('')
  })
})
