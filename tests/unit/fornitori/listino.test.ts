import { describe, it, expect } from 'vitest'
import { prezzoProposto, matchRinnovo, riepilogoRinnovo, giorniAllaScadenza } from '@/lib/fornitori/listino'

describe('prezzoProposto', () => {
  it('applica il ricarico % al costo, arrotondato a 2 decimali', () => {
    expect(prezzoProposto(100, 25)).toBe(125)
    expect(prezzoProposto(12.4, 25)).toBe(15.5)
    expect(prezzoProposto(33.33, 10)).toBe(36.66) // 36.663 → 36.66
  })

  it('ricarico 0 → prezzo = costo (proposta valida, non null)', () => {
    expect(prezzoProposto(80, 0)).toBe(80)
  })

  it('senza ricarico o con input non validi → null (nessuna proposta)', () => {
    expect(prezzoProposto(100, null)).toBeNull()
    expect(prezzoProposto(100, undefined)).toBeNull()
    expect(prezzoProposto(100, -5)).toBeNull()
    expect(prezzoProposto(-1, 25)).toBeNull()
    expect(prezzoProposto(NaN, 25)).toBeNull()
  })
})

describe('matchRinnovo', () => {
  const esistenti = [
    { id: 'a', code: 'TB-20', description: 'Tubo multistrato 20mm', unit_cost: 2.5 },
    { id: 'b', code: null, description: 'Raccordo a T', unit_cost: 1.0 },
    { id: 'c', code: 'VLV-1', description: 'Valvola a sfera 1"', unit_cost: 8.0 },
  ]

  it('abbina per codice, poi per descrizione; il resto è nuovo', () => {
    const esito = matchRinnovo(esistenti, [
      { code: 'TB-20', description: 'Tubo multistrato 20 millimetri', unit: 'ml', unit_cost: 2.75 }, // per codice
      { code: null, description: '  raccordo a  t ', unit: 'pz', unit_cost: 1.1 },                   // per descrizione normalizzata
      { code: 'NEW-9', description: 'Curva 90°', unit: 'pz', unit_cost: 0.8 },                       // nuova
    ])
    expect(esito.updates).toEqual([
      { id: 'a', unit_cost: 2.75 },
      { id: 'b', unit_cost: 1.1 },
    ])
    expect(esito.additions).toHaveLength(1)
    expect(esito.additions[0]!.description).toBe('Curva 90°')
    expect(esito.stats).toEqual({ matched: 2, added: 1, increased: 2, avgIncreasePct: 10 })
  })

  it('una voce esistente non viene abbinata due volte (la seconda è nuova)', () => {
    const esito = matchRinnovo(esistenti, [
      { code: 'TB-20', description: 'Tubo', unit: 'ml', unit_cost: 3 },
      { code: 'TB-20', description: 'Tubo bis', unit: 'ml', unit_cost: 4 },
    ])
    expect(esito.updates).toHaveLength(1)
    expect(esito.additions).toHaveLength(1)
  })

  it('costo invariato o in calo: aggiornato ma NON conta come rincaro', () => {
    const esito = matchRinnovo(esistenti, [
      { code: 'TB-20', description: 'x', unit: 'ml', unit_cost: 2.5 },  // invariato
      { code: 'VLV-1', description: 'y', unit: 'pz', unit_cost: 7.0 },  // ribasso
    ])
    expect(esito.stats.matched).toBe(2)
    expect(esito.stats.increased).toBe(0)
    expect(esito.stats.avgIncreasePct).toBeNull()
  })

  it('listino vuoto → tutte nuove (primo import)', () => {
    const esito = matchRinnovo([], [{ code: null, description: 'Voce', unit: 'pz', unit_cost: 5 }])
    expect(esito.updates).toHaveLength(0)
    expect(esito.additions).toHaveLength(1)
  })
})

describe('riepilogoRinnovo', () => {
  it('frasi al singolare/plurale con e senza rincari', () => {
    expect(riepilogoRinnovo({ matched: 3, added: 1, increased: 2, avgIncreasePct: 6 }))
      .toBe('3 voci aggiornate (2 rincarate, media +6,0%) · 1 voce nuova')
    expect(riepilogoRinnovo({ matched: 1, added: 0, increased: 0, avgIncreasePct: null }))
      .toBe('1 voce aggiornata')
    expect(riepilogoRinnovo({ matched: 0, added: 2, increased: 0, avgIncreasePct: null }))
      .toBe('2 voci nuove')
    expect(riepilogoRinnovo({ matched: 0, added: 0, increased: 0, avgIncreasePct: null }))
      .toBe('Nessuna voce importata')
  })
})

describe('giorniAllaScadenza', () => {
  it('conta i giorni da oggi alla fine del giorno di scadenza', () => {
    const oggi = new Date('2026-08-02T10:00:00')
    expect(giorniAllaScadenza('2026-08-12', oggi)).toBe(10)
    expect(giorniAllaScadenza('2026-08-02', oggi)).toBe(0)   // scade oggi
    expect(giorniAllaScadenza('2026-08-01', oggi)).toBe(-1)  // scaduto ieri
  })
})
