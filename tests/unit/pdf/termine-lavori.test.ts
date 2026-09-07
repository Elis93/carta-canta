import { describe, it, expect } from 'vitest'
import { buildPdfHtml } from '@/lib/pdf/template'
import { makeTestData } from './fixture'

// Termine dei lavori (088): la riga «Tempi di esecuzione» esce in TUTTI e 4 i
// preset, solo sui preventivi, solo se indicato; accettato → data concreta.
const PRESETS = ['classico', 'bold', 'tecnico', 'elegante'] as const

describe('PDF — termine dei lavori', () => {
  for (const preset of PRESETS) {
    it(`${preset}: senza work_days la sezione NON c'è`, () => {
      const d = makeTestData({ preset })
      const html = buildPdfHtml(d)
      expect(html).not.toContain('Tempi di esecuzione')
    })
    it(`${preset}: con work_days=30 e non accettato → dicitura contrattuale, una volta sola`, () => {
      const d = makeTestData({ preset, work_days: 30 })
      const html = buildPdfHtml(d)
      expect(html.split('Tempi di esecuzione').length - 1).toBe(1)
      expect(html).toContain('Indicativamente entro 30 giorni dalla conferma del preventivo, salvo imprevisti o cause non dipendenti dall&#39;impresa.')
    })
    it(`${preset}: accettato → «Lavori entro il …» con la data (Europe/Rome)`, () => {
      const d = makeTestData({ preset, work_days: 30, accepted_at: '2026-09-07T10:00:00.000Z', status: 'accepted' })
      const html = buildPdfHtml(d)
      expect(html).toContain('Lavori entro il 7 ottobre 2026 (30 giorni dalla conferma).')
    })
  }
  it('su una FATTURA il termine non esce mai, anche se la colonna è valorizzata', () => {
    const d = makeTestData({ preset: 'classico', work_days: 30, doc_type: 'fattura' })
    expect(buildPdfHtml(d)).not.toContain('Tempi di esecuzione')
  })
})
