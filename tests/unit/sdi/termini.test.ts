import { describe, it, expect } from 'vitest'
import {
  riferimentoTrasmissione,
  termineTrasmissione,
  scadenzaLabel,
  GIORNI_TRASMISSIONE,
} from '@/lib/sdi/termini'

// I 12 giorni per la trasmissione allo SdI (art. 21 c.4 DPR 633/1972).
// Il riferimento è la più vecchia fra data del documento e primo incasso
// (art. 6: fattura e pagamento anticipano entrambi l'effettuazione).

describe('riferimentoTrasmissione', () => {
  it('senza incasso vale la data del documento', () => {
    expect(riferimentoTrasmissione('2026-08-01T10:00:00Z', null)).toBe('2026-08-01')
  })

  it('un incasso PRECEDENTE alla data del documento anticipa il riferimento', () => {
    expect(riferimentoTrasmissione('2026-08-10T10:00:00Z', '2026-08-03T09:00:00Z')).toBe('2026-08-03')
  })

  it('un incasso successivo NON sposta il riferimento in avanti', () => {
    expect(riferimentoTrasmissione('2026-08-01T10:00:00Z', '2026-08-20T09:00:00Z')).toBe('2026-08-01')
  })

  it('senza nessuna data → null (mai un countdown inventato)', () => {
    expect(riferimentoTrasmissione(null, null)).toBeNull()
    expect(riferimentoTrasmissione('non-una-data', null)).toBeNull()
  })

  it('il giorno è quello ITALIANO: mezzanotte UTC d’estate è già domani a Roma', () => {
    // 2026-08-01T23:30Z = 2026-08-02 01:30 a Roma (UTC+2)
    expect(riferimentoTrasmissione('2026-08-01T23:30:00Z', null)).toBe('2026-08-02')
  })
})

describe('termineTrasmissione', () => {
  const oggi = (s: string) => new Date(`${s}T10:00:00Z`)

  it('la scadenza è il riferimento + 12 giorni', () => {
    const t = termineTrasmissione('2026-08-01', oggi('2026-08-01'))
    expect(t.scadenza).toBe('2026-08-13')
    expect(t.giorniRimasti).toBe(GIORNI_TRASMISSIONE)
    expect(t.fuoriTermine).toBe(false)
  })

  it('l’ultimo giorno utile: 0 giorni rimasti, NON fuori termine', () => {
    const t = termineTrasmissione('2026-08-01', oggi('2026-08-13'))
    expect(t.giorniRimasti).toBe(0)
    expect(t.fuoriTermine).toBe(false)
  })

  it('il giorno dopo la scadenza è fuori termine', () => {
    const t = termineTrasmissione('2026-08-01', oggi('2026-08-14'))
    expect(t.giorniRimasti).toBe(-1)
    expect(t.fuoriTermine).toBe(true)
  })

  it('attraversa i mesi senza inciampare', () => {
    const t = termineTrasmissione('2026-08-25', oggi('2026-08-30'))
    expect(t.scadenza).toBe('2026-09-06')
    expect(t.giorniRimasti).toBe(7)
  })
})

describe('scadenzaLabel', () => {
  it('la data in parole, senza sorprese di fuso', () => {
    expect(scadenzaLabel('2026-08-13')).toBe('13 agosto')
    expect(scadenzaLabel('2026-09-06')).toBe('6 settembre')
  })
})
