import { describe, it, expect } from 'vitest'
import { messaggioPreventivoCollegato } from '@/lib/documents/collegati'

describe('messaggioPreventivoCollegato', () => {
  it('nessuna fattura collegata → eliminabile', () => {
    expect(messaggioPreventivoCollegato([])).toBeNull()
  })
  it('fattura di acconto → divieto col suo numero e l’invito ad archiviare', () => {
    const m = messaggioPreventivoCollegato([{ doc_type: 'fattura_acconto', doc_number: 'ACC 002/2026' }])
    expect(m).toContain('Preventivo non eliminabile')
    expect(m).toContain('fattura di acconto ACC 002/2026')
    expect(m).toContain('«Archivia»')
  })
  it('fattura in bozza senza numero → «una bozza di fattura»', () => {
    expect(messaggioPreventivoCollegato([{ doc_type: 'fattura', doc_number: null }])).toContain('una bozza di fattura')
  })
  it('più fatture → cita la prima e conta le altre', () => {
    const m = messaggioPreventivoCollegato([
      { doc_type: 'fattura_acconto', doc_number: 'ACC 001/2026' },
      { doc_type: 'fattura', doc_number: '004/2026' },
    ])
    expect(m).toContain('ACC 001/2026')
    expect(m).toContain('(e un’altra fattura)')
  })
})
