import { describe, it, expect } from 'vitest'
import { margineVoce, margineDocumento } from '@/lib/margine/calcolo'

describe('margineVoce', () => {
  it('senza costo (null o 0) non traccia il margine', () => {
    expect(margineVoce({ quantity: 2, unit_price: 50, unit_cost: null })).toBeNull()
    expect(margineVoce({ quantity: 2, unit_price: 50 })).toBeNull()
    expect(margineVoce({ quantity: 2, unit_price: 50, unit_cost: 0 })).toBeNull()
  })

  it('calcola costo, vendita, margine, ricarico e margine %', () => {
    // Caldaia del mockup: costo 780, vendita 975 → margine 195, ricarico 25%, margine 20%
    const m = margineVoce({ quantity: 1, unit_price: 975, unit_cost: 780 })
    expect(m).toEqual({ costo: 780, vendita: 975, margine: 195, ricaricoPct: 25, marginePct: 20 })
  })

  it('lo sconto della VOCE riduce la vendita e quindi il margine (regola: lo sconto voce vive sulla voce)', () => {
    const m = margineVoce({ quantity: 1, unit_price: 100, discount_pct: 10, unit_cost: 80 })
    expect(m!.vendita).toBe(90)
    expect(m!.margine).toBe(10)
    expect(m!.ricaricoPct).toBe(12.5)
  })

  it('sotto costo: margine negativo, mai mascherato', () => {
    const m = margineVoce({ quantity: 2, unit_price: 30, unit_cost: 40 })
    expect(m!.margine).toBe(-20)
    expect(m!.ricaricoPct).toBe(-25)
  })

  it('quantità moltiplica anche il costo', () => {
    const m = margineVoce({ quantity: 3, unit_price: 10, unit_cost: 6 })
    expect(m).toMatchObject({ costo: 18, vendita: 30, margine: 12 })
  })
})

describe('margineDocumento', () => {
  const caldaia = { quantity: 1, unit_price: 975, unit_cost: 780 }
  const manodopera = { quantity: 6, unit_price: 65, unit_cost: null }

  it('somma i margini delle voci con costo e conta quelle senza', () => {
    const d = margineDocumento([caldaia, manodopera])
    expect(d.margineVoci).toBe(195)
    expect(d.vociConCosto).toBe(1)
    expect(d.vociSenzaCosto).toBe(1)
    expect(d.scontoDocumento).toBe(0)
    expect(d.margineFinale).toBe(195)
  })

  it('lo sconto DOCUMENTO si sottrae una volta sola dal totale, mai spalmato', () => {
    const d = margineDocumento([caldaia, manodopera], { discount_fixed: 50 })
    expect(d.scontoDocumento).toBe(50)
    expect(d.margineFinale).toBe(145)
  })

  it('sconto percentuale calcolato sul subtotale (formula del motore fiscale)', () => {
    // subtotale 975 + 390 = 1365 → 10% = 136,5
    const d = margineDocumento([caldaia, manodopera], { discount_pct: 10 })
    expect(d.scontoDocumento).toBe(136.5)
    expect(d.margineFinale).toBe(58.5)
  })

  it('la % di documento compare SOLO se tutte le voci hanno un costo', () => {
    const misto = margineDocumento([caldaia, manodopera])
    expect(misto.marginePct).toBeNull()
    const completo = margineDocumento([caldaia, { quantity: 6, unit_price: 65, unit_cost: 40 }])
    // margine 195 + 150 = 345 su 1365 → 25,27%
    expect(completo.marginePct).toBe(25.27)
  })

  it('uno sconto oltre il subtotale non produce numeri assurdi (clamp a zero come il fiscale)', () => {
    const d = margineDocumento([{ quantity: 1, unit_price: 100, unit_cost: 60 }], { discount_fixed: 500 })
    expect(d.scontoDocumento).toBe(100)
    expect(d.margineFinale).toBe(-60)
    expect(d.marginePct).toBeNull()
  })

  it('documento vuoto: tutto a zero, niente divisioni per zero', () => {
    const d = margineDocumento([])
    expect(d).toMatchObject({ margineVoci: 0, scontoDocumento: 0, margineFinale: 0, marginePct: null })
  })
})
