import { describe, it, expect } from 'vitest'
import { causaleBeniSignificativi, unisciCausale } from '@/lib/sdi/causale'
import { buildFatturaPaXml, spezzaCausale } from '@/lib/sdi/xml'
import type { VoceSplittabile } from '@/lib/fiscal/beni-significativi'
import type { SdiInvoice } from '@/lib/sdi/types'

// Collaudo T25 (26 set 2026): la dicitura dei beni significativi (art. 1
// c.19 L. 205/2017) stava solo sul PDF. La fattura, per il Fisco, è l'XML:
// ora la stessa frase entra anche in <Causale>.

const voci = [
  { description: 'Posa caldaia', quantity: 1, unit_price: 600, discount_pct: 0, vat_rate: 10, total: 600, bene_significativo: false },
  { description: 'Caldaia', quantity: 1, unit_price: 1200, unit_cost: 1000, discount_pct: 0, vat_rate: 10, total: 1200, bene_significativo: true },
] as unknown as VoceSplittabile[]

describe('causaleBeniSignificativi', () => {
  it('fattura con bene e costo: valore 1000, prestazione 800, 1600 al 10% e 200 al 22%', () => {
    const t = causaleBeniSignificativi('fattura', voci, 'ordinario', 22, null)
    expect(t).toContain('valore dei beni significativi 1000,00 €')
    expect(t).toContain('corrispettivo al netto dei beni significativi 800,00 €')
    expect(t).toContain('IVA 10% 1600,00 €')
    expect(t).toContain('IVA 22% 200,00 €')
  })

  it('niente dicitura su forfettario, preventivo e fatture senza beni', () => {
    expect(causaleBeniSignificativi('fattura', voci, 'forfettario', 22, null)).toBeNull()
    expect(causaleBeniSignificativi('preventivo', voci, 'ordinario', 22, null)).toBeNull()
    expect(causaleBeniSignificativi('fattura', [voci[0]], 'ordinario', 22, null)).toBeNull()
  })

  it('fattura di acconto: riprende la dicitura in quota dalle note, e solo quella', () => {
    const nota = 'Beni significativi (art. 1, comma 19, L. 205/2017): valore complessivo dei beni 1000,00 €; in questa fattura di acconto se ne riporta la quota di 300,00 €.'
    expect(causaleBeniSignificativi('fattura_acconto', [], 'ordinario', 22, nota)).toBe(nota)
    expect(causaleBeniSignificativi('fattura_acconto', [], 'ordinario', 22, 'nota qualsiasi')).toBeNull()
  })

  it('unisciCausale salta le righe vuote', () => {
    expect(unisciCausale(null, 'a', '', 'b')).toBe('a\nb')
    expect(unisciCausale(null, undefined)).toBeNull()
  })
})

describe('Causale oltre i 200 caratteri', () => {
  it('spezzaCausale taglia fra le parole, mai oltre il limite, senza perdere testo', () => {
    const lungo = 'parola '.repeat(80).trim()
    const pezzi = spezzaCausale(lungo, 200)
    expect(pezzi.every((p) => p.length <= 200)).toBe(true)
    expect(pezzi.join(' ')).toBe(lungo)
  })

  it('nell\'XML la dicitura dei beni esce intera, su più <Causale> da ≤200 caratteri', () => {
    const dicitura = causaleBeniSignificativi('fattura', voci, 'ordinario', 22, null)!
    const inv: SdiInvoice = {
      numero: '001/2026', data: '2026-09-26',
      cedente: { denominazione: 'Eli Impianti', piva: '12345678903', codiceFiscale: null, indirizzo: 'Via Roma 1', cap: '22100', citta: 'Como', provincia: 'CO', regimeFiscale: 'RF01', email: null },
      cessionario: { denominazione: 'Mario Rossi', piva: null, codiceFiscale: 'RSSMRA80A01H501U', indirizzo: 'Via Verdi 8', cap: '22100', citta: 'Como', provincia: 'CO', codiceDestinatario: '0000000', pec: null },
      righe: [{ descrizione: 'Posa caldaia', quantita: 1, prezzoUnitario: 1800, totale: 1800, aliquotaIva: 10 }],
      imponibile: 1800, imposta: 180, totale: 1980, bollo: 0,
      causale: dicitura, tipoDocumento: 'TD01',
    }
    const xml = buildFatturaPaXml(inv)
    const causali = [...xml.matchAll(/<Causale>([^<]*)<\/Causale>/g)].map((m) => m[1])
    expect(causali.length).toBeGreaterThan(1)
    expect(causali.every((c) => c.replace(/&apos;/g, "'").length <= 200)).toBe(true)
    const unita = causali.join(' ').replace(/&apos;/g, "'")
    expect(unita).toContain('valore dei beni significativi 1000,00 EUR')
    expect(unita).toContain('IVA 22% 200,00 EUR.')
  })
})
