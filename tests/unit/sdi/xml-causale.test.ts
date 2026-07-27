import { describe, it, expect } from 'vitest'
import { buildFatturaPaXml } from '@/lib/sdi/xml'
import { forfettarioCausale, CAUSALE_FORFETTARIO_IVA, CAUSALE_FORFETTARIO_RITENUTA } from '@/lib/sdi/causale'
import type { SdiInvoice } from '@/lib/sdi/types'

// Fase 1 ritenuta (27 lug): la fattura del forfettario deve dichiarare
// l'esenzione dal comma 67, altrimenti un condominio trattiene il 4% per
// errore. Il campo <Causale> è max 200 caratteri e RIPETIBILE: le due
// diciture viaggiano come due elementi separati.

function makeInvoice(overrides: Partial<SdiInvoice> = {}): SdiInvoice {
  return {
    numero: '001/2026',
    data: '2026-07-27',
    cedente: {
      denominazione: 'Elettrica Rossi',
      piva: '12345678903',
      codiceFiscale: null,
      indirizzo: 'Via Roma 1',
      cap: '20100',
      citta: 'Milano',
      provincia: 'MI',
      regimeFiscale: 'RF19',
      email: null,
    },
    cessionario: {
      denominazione: 'Condominio Via Verdi 8',
      piva: null,
      codiceFiscale: '97712730155',
      indirizzo: 'Via Verdi 8',
      cap: '20121',
      citta: 'Milano',
      provincia: 'MI',
      codiceDestinatario: '0000000',
      pec: null,
    },
    righe: [{ descrizione: 'Rifacimento impianto', quantita: 1, prezzoUnitario: 100, totale: 100, aliquotaIva: 0 }],
    imponibile: 100,
    imposta: 0,
    totale: 100,
    bollo: 2,
    causale: forfettarioCausale(),
    ...overrides,
  }
}

describe('XML FatturaPA — causale forfettario con esenzione ritenuta', () => {
  it('emette DUE <Causale>: fuori campo IVA + esenzione comma 67', () => {
    const xml = buildFatturaPaXml(makeInvoice())
    const causali = xml.match(/<Causale>([^<]*)<\/Causale>/g) ?? []
    expect(causali).toHaveLength(2)
    expect(xml).toContain('comma 67')
    expect(xml).toContain('regime forfettario')
  })

  it('ogni <Causale> resta nei 200 caratteri del tracciato', () => {
    expect(CAUSALE_FORFETTARIO_IVA.length).toBeLessThanOrEqual(200)
    expect(CAUSALE_FORFETTARIO_RITENUTA.length).toBeLessThanOrEqual(200)
    const xml = buildFatturaPaXml(makeInvoice())
    for (const m of xml.matchAll(/<Causale>([^<]*)<\/Causale>/g)) {
      expect(m[1].length).toBeLessThanOrEqual(200)
    }
  })

  it('senza causale (regime ordinario): nessun <Causale>', () => {
    const xml = buildFatturaPaXml(makeInvoice({
      causale: null,
      cedente: { ...makeInvoice().cedente, regimeFiscale: 'RF01' },
      righe: [{ descrizione: 'Lavoro', quantita: 1, prezzoUnitario: 100, totale: 100, aliquotaIva: 22 }],
      imposta: 22, totale: 122, bollo: 0,
    }))
    expect(xml).not.toContain('<Causale>')
  })

  it('una causale su una riga sola resta un solo <Causale> (retrocompatibilità)', () => {
    const xml = buildFatturaPaXml(makeInvoice({ causale: 'Nota semplice' }))
    const causali = xml.match(/<Causale>([^<]*)<\/Causale>/g) ?? []
    expect(causali).toHaveLength(1)
    expect(xml).toContain('<Causale>Nota semplice</Causale>')
  })
})
