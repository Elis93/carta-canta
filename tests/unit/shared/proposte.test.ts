import { describe, it, expect } from 'vitest'
import { tierOf, hasPiuProposte, totaliPerProposta } from '@/lib/documents/proposte'
import type { FiscalOptions } from '@/types/index'

// Il totale di un preventivo con due proposte non è un numero solo: Base e
// Premium sono due scenari alternativi. Sommarli darebbe una cifra che non
// esiste in nessuno dei due casi.

const ordinario: FiscalOptions = { fiscal_regime: 'ordinario', currency: 'EUR', vat_rate_default: 22 }

const voce = (tier: string | null, prezzo: number, qta = 1) => ({
  description: 'voce', unit: 'pz', quantity: qta, unit_price: prezzo,
  discount_pct: null, vat_rate: 22, option_tier: tier,
})

describe('tierOf', () => {
  it('riconosce i tre livelli', () => {
    expect(tierOf({ option_tier: 'base' })).toBe('base')
    expect(tierOf({ option_tier: 'consigliata' })).toBe('consigliata')
    expect(tierOf({ option_tier: 'premium' })).toBe('premium')
  })

  it('tutto ciò che non è riconosciuto vale Base', () => {
    expect(tierOf({ option_tier: null })).toBe('base')
    expect(tierOf({})).toBe('base')
    expect(tierOf({ option_tier: 'deluxe' })).toBe('base')
  })
})

describe('hasPiuProposte', () => {
  it('false su un preventivo normale', () => {
    expect(hasPiuProposte([voce(null, 100), voce(null, 50)])).toBe(false)
  })

  it('true quando convivono Base e Premium', () => {
    expect(hasPiuProposte([voce('base', 100), voce('premium', 200)])).toBe(true)
  })
})

describe('totaliPerProposta', () => {
  it('calcola un totale PER PROPOSTA, mai la somma delle due', () => {
    const r = totaliPerProposta([voce('base', 100), voce('premium', 300)], ordinario)
    expect(r.map((t) => t.tier)).toEqual(['base', 'premium'])
    expect(r[0].subtotal).toBe(100)
    expect(r[0].total).toBe(122)      // 100 + 22% IVA
    expect(r[1].subtotal).toBe(300)
    expect(r[1].total).toBe(366)      // 300 + 22% IVA
    // la somma 400 non compare da nessuna parte
    expect(r.some((t) => t.subtotal === 400)).toBe(false)
  })

  it('somma tutte le voci DELLA STESSA proposta', () => {
    const r = totaliPerProposta(
      [voce('base', 100), voce('base', 50), voce('premium', 300)],
      ordinario
    )
    expect(r[0].subtotal).toBe(150)
    expect(r[0].count).toBe(2)
    expect(r[1].count).toBe(1)
  })

  it('applica lo sconto globale a OGNI proposta (è uno sconto sul lavoro)', () => {
    const conSconto: FiscalOptions = { ...ordinario, discount_pct: 10 }
    const senza = totaliPerProposta([voce('base', 100), voce('premium', 300)], ordinario)
    const con = totaliPerProposta([voce('base', 100), voce('premium', 300)], conSconto)
    // Lo sconto abbassa ENTRAMBE le proposte, non solo quella che fa da totale
    expect(con[0].total).toBeLessThan(senza[0].total)
    expect(con[1].total).toBeLessThan(senza[1].total)
    // ⚠️ Numeri esatti del motore fiscale ATTUALE: l'IVA si calcola per voce
    // sugli importi PRIMA dello sconto globale (100×22% = 22), mentre lo sconto
    // abbassa solo l'imponibile (90). È esattamente la domanda D9 aperta col
    // commercialista ("IVA sullo sconto"): se un giorno la regola cambia, è
    // questo test a dirtelo — il motore non va toccato senza quella risposta.
    expect(con[0].total).toBe(112)    // 90 + 22
    expect(con[1].total).toBe(336)    // 270 + 66
  })

  it('salta le proposte senza voci e tiene l’ordine Base → Premium', () => {
    const r = totaliPerProposta([voce('premium', 300), voce('base', 100)], ordinario)
    expect(r).toHaveLength(2)
    expect(r[0].tier).toBe('base')
    expect(r[1].tier).toBe('premium')
  })

  it('su un preventivo senza proposte restituisce solo la Base', () => {
    const r = totaliPerProposta([voce(null, 100)], ordinario)
    expect(r).toHaveLength(1)
    expect(r[0].tier).toBe('base')
    expect(r[0].total).toBe(122)
  })

  it('nel forfettario niente IVA e la marca da bollo su OGNI proposta', () => {
    // Il bollo scatta sopra 77,47 € e riguarda il documento che il cliente
    // accetterà: va contato dentro ciascuna proposta, non una volta sola.
    const forfettario: FiscalOptions = { fiscal_regime: 'forfettario', currency: 'EUR' }
    const r = totaliPerProposta([voce('base', 100), voce('premium', 300)], forfettario)
    expect(r[0].taxAmount).toBe(0)
    expect(r[1].taxAmount).toBe(0)
    expect(r[0].bollo).toBe(2)
    expect(r[1].bollo).toBe(2)
    expect(r[0].total).toBe(102)
    expect(r[1].total).toBe(302)
  })

  it('sotto la soglia del bollo il forfettario non lo applica', () => {
    const forfettario: FiscalOptions = { fiscal_regime: 'forfettario', currency: 'EUR' }
    const r = totaliPerProposta([voce('base', 50)], forfettario)
    expect(r[0].bollo).toBe(0)
    expect(r[0].total).toBe(50)
  })
})
