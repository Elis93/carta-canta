import { describe, it, expect } from 'vitest'
import { buildPdfHtml } from '@/lib/pdf/template'
import { makeTestData } from './fixture'

// 26 set 2026 (collaudo T23): il PDF stampava il solo `name` del cliente —
// «PER Giorgio» su un privato registrato «Giorgio» + «Galeazzi». L'art. 21
// c.2 lett. e DPR 633/1972 chiede nome E cognome; l'XML SdI li univa già.
describe('PDF — nome e cognome del cliente', () => {
  const presets = ['classico', 'bold', 'tecnico', 'elegante'] as const

  for (const preset of presets) {
    it(`${preset}: stampa nome e cognome`, () => {
      const base = makeTestData({ preset })
      const html = buildPdfHtml({
        ...base,
        client: { ...base.client!, name: 'Giorgio', surname: 'Galeazzi' },
      })
      expect(html).toContain('Giorgio Galeazzi')
    })
  }

  it('senza cognome (azienda) stampa la sola ragione sociale, senza spazi appesi', () => {
    const base = makeTestData({ preset: 'classico' })
    const html = buildPdfHtml({
      ...base,
      client: { ...base.client!, name: 'Edil Rossi Srl', surname: null },
    })
    expect(html).toContain('>Edil Rossi Srl<')
  })
})
