import { describe, it, expect } from 'vitest'
import { buildFatturaPaXml, soloLatin1 } from '@/lib/sdi/xml'
import type { SdiInvoice } from '@/lib/sdi/types'

// Collaudo T25 (26 set 2026): la fattura di acconto veniva RIFIUTATA con
// «The value can only contains Basic Latin and Latin-1 Supplement characters»
// perché la descrizione conteneva «—». I campi di testo FatturaPA ammettono
// solo U+0000-U+00FF: l'XML non deve contenere NESSUN carattere oltre.

function makeInvoice(overrides: Partial<SdiInvoice> = {}): SdiInvoice {
  return {
    numero: 'ACC 001/2026',
    data: '2026-09-24',
    cedente: {
      denominazione: 'Elettrica D’Amico',
      piva: '12345678903',
      codiceFiscale: null,
      indirizzo: 'Via Roma 1',
      cap: '20100',
      citta: 'Milano',
      provincia: 'MI',
      regimeFiscale: 'RF01',
      email: null,
    },
    cessionario: {
      denominazione: 'Condominio “Le Rose”',
      piva: '00743110157',
      codiceFiscale: null,
      indirizzo: 'Via Verdi 8',
      cap: '20121',
      citta: 'Milano',
      provincia: 'MI',
      codiceDestinatario: 'ABCDEFG',
      pec: null,
    },
    righe: [
      { descrizione: 'Acconto su rifacimento bagno — preventivo 012/2026 del 14/09/2026 — quota con IVA 10%', quantita: 1, prezzoUnitario: 409.84, totale: 409.84, aliquotaIva: 22 },
      { descrizione: 'Posa… 2 ore × 30 € – ok 👍', quantita: 1, prezzoUnitario: 0.01, totale: 0.01, aliquotaIva: 22 },
    ],
    imponibile: 409.85,
    imposta: 90.17,
    totale: 500.02,
    bollo: 0,
    causale: null,
    tipoDocumento: 'TD02',
    ...overrides,
  }
}

describe('XML FatturaPA — solo caratteri Latin-1', () => {
  it('nessun carattere oltre U+00FF nell\'intero XML', () => {
    const xml = buildFatturaPaXml(makeInvoice())
    const fuori = [...xml].filter((c) => (c.codePointAt(0) ?? 0) > 0xff)
    expect(fuori).toEqual([])
  })

  it('traduce trattini, apostrofi, virgolette, puntini ed euro', () => {
    const xml = buildFatturaPaXml(makeInvoice())
    expect(xml).toContain('Acconto su rifacimento bagno - preventivo 012/2026 del 14/09/2026 - quota con IVA 10%')
    expect(xml).toContain('Elettrica D&apos;Amico')
    expect(xml).toContain('Condominio &quot;Le Rose&quot;')
    expect(xml).toContain('Posa... 2 ore × 30 EUR - ok ')
  })

  it('lascia intatti accenti italiani e caratteri Latin-1', () => {
    expect(soloLatin1('città perché è già × ° ½ « »')).toBe('città perché è già × ° ½ « »')
  })

  it('lettere accentate fuori tabella → lettera base; emoji tolte', () => {
    expect(soloLatin1('Dvořák ✅')).toBe('Dvorák ')
  })
})
