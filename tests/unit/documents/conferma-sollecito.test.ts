import { describe, it, expect } from 'vitest'
import { testoConfermaSollecito } from '@/lib/documents/conferma-sollecito'

// La conferma prima del sollecito (18 set): una frase sola per tutte le
// superfici. Questi test fissano le tre cose che contano — dice A CHI
// parte, dice che parte SUBITO, e sulla fattura parla di pagamento.

describe('testoConfermaSollecito', () => {
  it('col nome del cliente dice a chi parte', () => {
    const t = testoConfermaSollecito('preventivo', 'Mario Rossi')
    expect(t).toContain('a Mario Rossi')
    expect(t).toContain('Parte subito')
  })

  it('senza nome (o solo spazi) ricade su "al cliente"', () => {
    expect(testoConfermaSollecito('preventivo', null)).toContain('al cliente')
    expect(testoConfermaSollecito('preventivo', '   ')).toContain('al cliente')
    expect(testoConfermaSollecito('preventivo')).toContain('al cliente')
  })

  it('sulla fattura parla del pagamento, sul preventivo no', () => {
    expect(testoConfermaSollecito('fattura', 'Anna')).toContain('sollecito del pagamento')
    expect(testoConfermaSollecito('preventivo', 'Anna')).not.toContain('pagamento')
  })
})
