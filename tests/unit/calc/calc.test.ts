import { describe, it, expect } from 'vitest'
import { roundTo, applicaScarto, areaMq, volumeMc, piastrelle, verniceLitri } from '@/lib/calc/calc'

describe('roundTo', () => {
  it('arrotonda a 2 decimali di default (half-up)', () => {
    expect(roundTo(12.605)).toBe(12.61)
    expect(roundTo(12.604)).toBe(12.6)
  })
})

describe('applicaScarto', () => {
  // NB: applicaScarto NON arrotonda (l'arrotondamento lo fanno areaMq/volumeMc):
  // 100×1,1 in floating point è 110.00000000000001 → confronto ravvicinato.
  it('aggiunge la percentuale', () => {
    expect(applicaScarto(100, 10)).toBeCloseTo(110, 6)
  })
  it('ignora scarti negativi o non validi (0%)', () => {
    expect(applicaScarto(100, -5)).toBe(100)
    expect(applicaScarto(100, NaN)).toBe(100)
  })
})

describe('areaMq', () => {
  it('lunghezza × larghezza', () => {
    expect(areaMq(4.2, 3)).toBe(12.6)
  })
  it('applica lo scarto e arrotonda a 2 decimali', () => {
    expect(areaMq(4.2, 3, 10)).toBe(13.86)
  })
  it('misura mancante o nulla → 0', () => {
    expect(areaMq(0, 3)).toBe(0)
    expect(areaMq(4.2, 0)).toBe(0)
  })
})

describe('volumeMc', () => {
  it('lunghezza × larghezza × altezza (3 decimali)', () => {
    expect(volumeMc(2, 1.5, 0.1)).toBe(0.3)
  })
  it('serve anche l\'altezza', () => {
    expect(volumeMc(2, 1.5, 0)).toBe(0)
  })
})

describe('piastrelle', () => {
  it('pezzi per eccesso dal formato (60×60) e m² con scarto', () => {
    // 12,6 m² + 10% = 13,86 m²; piastrella 60×60 = 0,36 m² → ceil(13,86/0,36)=39
    expect(piastrelle(12.6, 60, 60, 10)).toEqual({ mq: 13.86, pezzi: 39 })
  })
  it('formato mancante → pezzi 0 (nessuna divisione per zero)', () => {
    expect(piastrelle(12.6, 0, 60)).toEqual({ mq: 12.6, pezzi: 0 })
  })
  it('area mancante → tutto 0', () => {
    expect(piastrelle(0, 60, 60)).toEqual({ mq: 0, pezzi: 0 })
  })
})

describe('verniceLitri', () => {
  it('(superficie × mani) / resa, arrotondato a 1 decimale', () => {
    // 45 m² × 2 mani / 10 = 9 litri
    expect(verniceLitri(45, 2, 10)).toBe(9)
  })
  it('parametri mancanti → 0', () => {
    expect(verniceLitri(45, 0, 10)).toBe(0)
    expect(verniceLitri(0, 2, 10)).toBe(0)
    expect(verniceLitri(45, 2, 0)).toBe(0)
  })
})
