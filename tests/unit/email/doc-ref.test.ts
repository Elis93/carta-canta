// Il riferimento al documento nelle email (bug 12 set 2026: oggetto
// «Il preventivo "" scade tra 3 giorni» e corpo «#003/2026 — » col
// trattino appeso quando il titolo era vuoto).
import { describe, it, expect } from 'vitest'
import { emailDocRef, emailDocRefOggetto } from '@/lib/email/doc-ref'

describe('emailDocRef (corpo)', () => {
  it('numero + titolo → «003/2026 — Titolo»', () => {
    expect(emailDocRef('003/2026', 'Rifacimento bagno')).toBe('003/2026 — Rifacimento bagno')
  })

  it('solo numero → niente trattino appeso (il caso della foto di Eli)', () => {
    expect(emailDocRef('003/2026', '')).toBe('003/2026')
    expect(emailDocRef('003/2026', null)).toBe('003/2026')
    expect(emailDocRef('003/2026', undefined)).toBe('003/2026')
  })

  it('titolo fatto di soli spazi conta come vuoto', () => {
    expect(emailDocRef('003/2026', '   ')).toBe('003/2026')
  })

  it('solo titolo → il titolo', () => {
    expect(emailDocRef(null, 'Rifacimento bagno')).toBe('Rifacimento bagno')
  })

  it('niente di niente → stringa vuota (il chiamante omette il riferimento)', () => {
    expect(emailDocRef(null, null)).toBe('')
    expect(emailDocRef('', '')).toBe('')
  })

  it('toglie i prefissi storici Prev/Fatt dal numero', () => {
    expect(emailDocRef('Prev001/2026', 'Bagno')).toBe('001/2026 — Bagno')
    expect(emailDocRef('Fatt014/2026', null)).toBe('014/2026')
  })
})

describe('emailDocRefOggetto (oggetto, con lo spazio davanti)', () => {
  it('col titolo → « "Titolo"» (il titolo resta il preferito)', () => {
    expect(emailDocRefOggetto('003/2026', 'Rifacimento bagno')).toBe(' "Rifacimento bagno"')
  })

  it('senza titolo → « 003/2026», MAI virgolette vuote', () => {
    expect(emailDocRefOggetto('003/2026', '')).toBe(' 003/2026')
    expect(emailDocRefOggetto('003/2026', null)).toBe(' 003/2026')
  })

  it("l'oggetto composto resta ben formato in ogni caso", () => {
    expect(`Il preventivo${emailDocRefOggetto('003/2026', '')} scade tra 3 giorni`)
      .toBe('Il preventivo 003/2026 scade tra 3 giorni')
    expect(`Il preventivo${emailDocRefOggetto(null, null)} scade tra 3 giorni`)
      .toBe('Il preventivo scade tra 3 giorni')
  })

  it('numero legacy ripulito anche qui', () => {
    expect(emailDocRefOggetto('Prev003/2026', null)).toBe(' 003/2026')
  })
})
