import { describe, it, expect } from 'vitest'
import {
  normalizzaWorkDays,
  dataFineLavori,
  termineSuperato,
  fraseTermineLavori,
  fraseLavoriEntro,
  terminePrevisto,
} from '@/lib/documents/termine-lavori'

// Termine dei lavori (088, Eli 6 set): giorni di CALENDARIO dalla conferma.

describe('normalizzaWorkDays — cosa è un termine valido', () => {
  it('vuoto, null, undefined → null (non indicato)', () => {
    expect(normalizzaWorkDays('')).toBeNull()
    expect(normalizzaWorkDays(null)).toBeNull()
    expect(normalizzaWorkDays(undefined)).toBeNull()
  })
  it('accetta i bordi 1 e 365, respinge 0 e 366', () => {
    expect(normalizzaWorkDays(1)).toBe(1)
    expect(normalizzaWorkDays(365)).toBe(365)
    expect(normalizzaWorkDays(0)).toBeNull()
    expect(normalizzaWorkDays(366)).toBeNull()
    expect(normalizzaWorkDays(-5)).toBeNull()
  })
  it('legge le stringhe del form (anche con spazi) e tronca i decimali', () => {
    expect(normalizzaWorkDays(' 30 ')).toBe(30)
    expect(normalizzaWorkDays('30.7')).toBe(30)
    expect(normalizzaWorkDays('abc')).toBeNull()
  })
})

describe('dataFineLavori — conferma + N giorni', () => {
  it('30 giorni dal 7 set 2026 = 7 ott 2026', () => {
    const d = dataFineLavori('2026-09-07T10:00:00.000Z', 30)
    expect(d?.toISOString()).toBe('2026-10-07T10:00:00.000Z')
  })
  it('senza conferma → null (il preventivo non è ancora accettato)', () => {
    expect(dataFineLavori(null, 30)).toBeNull()
    expect(dataFineLavori(undefined, 30)).toBeNull()
  })
  it('senza giorni validi → null', () => {
    expect(dataFineLavori('2026-09-07T10:00:00.000Z', null)).toBeNull()
    expect(dataFineLavori('2026-09-07T10:00:00.000Z', 0)).toBeNull()
  })
  it('data di conferma malformata → null, mai una data inventata', () => {
    expect(dataFineLavori('non-una-data', 30)).toBeNull()
  })
  it('giorni di calendario: 1 giorno = 24 ore anche a cavallo del cambio d\'ora', () => {
    // 24 ott 2026 → 25 ott 2026 (fine ora legale in Europa)
    const d = dataFineLavori('2026-10-24T12:00:00.000Z', 1)
    expect(d?.toISOString()).toBe('2026-10-25T12:00:00.000Z')
  })
})

describe('termineSuperato', () => {
  const now = new Date('2026-10-10T00:00:00.000Z')
  it('data passata → vero; futura → falso; null → falso', () => {
    expect(termineSuperato(new Date('2026-10-01T00:00:00.000Z'), now)).toBe(true)
    expect(termineSuperato(new Date('2026-10-20T00:00:00.000Z'), now)).toBe(false)
    expect(termineSuperato(null, now)).toBe(false)
  })
})

describe('le due frasi (una sola fonte per PDF, pagina cliente, foglio interno)', () => {
  it('prima dell\'accettazione: dicitura contrattuale con «indicativamente» e la riserva', () => {
    const f = fraseTermineLavori(30)
    expect(f).toBe('Indicativamente entro 30 giorni dalla conferma del preventivo, salvo imprevisti o cause non dipendenti dall\'impresa.')
    expect(fraseTermineLavori(1)).toContain('entro 1 giorno dalla')
  })
  it('dopo l\'accettazione: «Lavori entro il …» in Europe/Rome', () => {
    // 23:30 UTC del 6 ott = 7 ott a Roma (ora legale): la data mostrata è quella italiana
    expect(fraseLavoriEntro(new Date('2026-10-06T23:30:00.000Z'))).toBe('Lavori entro il 7 ottobre 2026')
  })
})

describe('terminePrevisto — il riepilogo per chi mostra il termine', () => {
  it('documento senza termine → null', () => {
    expect(terminePrevisto({ work_days: null, accepted_at: '2026-09-07T10:00:00.000Z' })).toBeNull()
    expect(terminePrevisto({})).toBeNull()
  })
  it('non accettato → giorni + frase contrattuale, nessuna data', () => {
    const t = terminePrevisto({ work_days: 30, accepted_at: null })
    expect(t?.giorni).toBe(30)
    expect(t?.dataFine).toBeNull()
    expect(t?.testo).toContain('Indicativamente entro 30 giorni')
  })
  it('accettato → la data concreta e «Lavori entro il …»', () => {
    const t = terminePrevisto({ work_days: 30, accepted_at: '2026-09-07T10:00:00.000Z' })
    expect(t?.dataFine?.toISOString()).toBe('2026-10-07T10:00:00.000Z')
    expect(t?.testo).toBe('Lavori entro il 7 ottobre 2026')
  })
})
