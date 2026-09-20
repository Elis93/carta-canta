// La dicitura di verità della copia nel PDF (Fase 0 copia di cortesia, 20 set).
// Verifica sull'HTML REALE di buildPdfHtml: la dicitura giusta compare UNA
// volta per documento, nello stato giusto, su tutti e 4 i preset — e MAI sui
// preventivi (client-first intatto).

import { describe, it, expect } from 'vitest'
import { buildPdfHtml } from '@/lib/pdf/template'
import { makeTestData } from './fixture'

const PRESETS = ['classico', 'bold', 'tecnico', 'elegante'] as const

function count(html: string, needle: string): number {
  return html.split(needle).length - 1
}

function conSdi(preset: (typeof PRESETS)[number], docType: string, sdiStatus: string | null) {
  const data = makeTestData({ preset, doc_type: docType, status: 'sent' })
  ;(data.document as unknown as { sdi_status: string | null }).sdi_status = sdiStatus
  return buildPdfHtml(data)
}

describe('buildPdfHtml — dicitura della copia rispetto allo SdI', () => {
  it('fattura MAI trasmessa → dicitura «non costituisce fattura valida», una volta, in tutti i preset', () => {
    for (const preset of PRESETS) {
      const html = conSdi(preset, 'fattura', null)
      expect(count(html, 'non costituisce fattura valida ai fini del DPR 633/1972'), preset).toBe(1)
      expect(count(html, 'Copia di cortesia non valida'), preset).toBe(0)
    }
  })

  it('fattura SCARTATA → come mai trasmessa (per legge non è mai stata emessa)', () => {
    const html = conSdi('classico', 'fattura', 'scartata')
    expect(count(html, 'non costituisce fattura valida')).toBe(1)
  })

  it('fattura trasmessa in attesa di esito → «in attesa di esito», nessuna promessa', () => {
    const html = conSdi('classico', 'fattura', 'inviata')
    expect(count(html, 'in attesa di esito')).toBe(1)
    expect(count(html, 'non costituisce')).toBe(0)
    expect(count(html, 'Copia di cortesia non valida')).toBe(0)
  })

  it('fattura con esito positivo → dicitura di cortesia (standard FiC), una volta, in tutti i preset', () => {
    for (const preset of PRESETS) {
      const html = conSdi(preset, 'fattura', 'consegnata')
      expect(count(html, 'Copia di cortesia non valida ai fini fiscali'), preset).toBe(1)
      expect(count(html, 'non costituisce'), preset).toBe(0)
    }
    expect(count(conSdi('classico', 'fattura', 'mancata_consegna'), 'Copia di cortesia non valida')).toBe(1)
  })

  it('PREVENTIVO → nessuna dicitura SdI, in nessuno stato', () => {
    for (const s of [null, 'inviata', 'consegnata']) {
      const html = conSdi('classico', 'preventivo', s)
      expect(count(html, 'non costituisce')).toBe(0)
      expect(count(html, 'Copia di cortesia non valida')).toBe(0)
      expect(count(html, 'in attesa di esito')).toBe(0)
    }
  })

  it('nota di credito → le parole della nota, mai «fattura valida»', () => {
    const html = conSdi('classico', 'nota_credito', null)
    expect(count(html, 'non costituisce nota di credito valida')).toBe(1)
    expect(count(html, 'non costituisce fattura valida')).toBe(0)
  })
})
