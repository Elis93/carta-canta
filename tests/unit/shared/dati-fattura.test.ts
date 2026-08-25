import { describe, it, expect } from 'vitest'
import { datiFatturaMancanti, messaggioDatiFattura, richiedeDatiFattura } from '@/lib/documents/dati-fattura'

const completo = {
  name: 'Giorgio', surname: 'G.',
  indirizzo: 'Via Roma 1', citta: 'Como',
  piva: null, codice_fiscale: 'GRGGRG80A01C933X',
}

describe('richiedeDatiFattura', () => {
  it('vale per fattura, nota di credito e nota di debito — mai per il preventivo', () => {
    expect(richiedeDatiFattura('fattura')).toBe(true)
    expect(richiedeDatiFattura('nota_credito')).toBe(true)
    expect(richiedeDatiFattura('nota_debito')).toBe(true)
    expect(richiedeDatiFattura('preventivo')).toBe(false)
    expect(richiedeDatiFattura(null)).toBe(false)
  })
})

describe('datiFatturaMancanti (art. 21 c.2 lett. e-f DPR 633/1972)', () => {
  it('cliente completo → nessuna mancanza', () => {
    expect(datiFatturaMancanti(completo)).toEqual([])
  })

  it('basta la P.IVA come identificativo (impresa)', () => {
    expect(datiFatturaMancanti({ ...completo, codice_fiscale: null, piva: '12345678901' })).toEqual([])
  })

  it('senza NÉ P.IVA NÉ codice fiscale la fattura non parte', () => {
    expect(datiFatturaMancanti({ ...completo, codice_fiscale: null, piva: null }))
      .toEqual(['partita IVA o codice fiscale'])
    // Una P.IVA di soli caratteri non numerici non conta come identificativo
    expect(datiFatturaMancanti({ ...completo, codice_fiscale: '', piva: 'abc' }))
      .toEqual(['partita IVA o codice fiscale'])
  })

  it('residenza o domicilio: servono indirizzo E città', () => {
    expect(datiFatturaMancanti({ ...completo, indirizzo: '  ' })).toEqual(['indirizzo'])
    expect(datiFatturaMancanti({ ...completo, citta: null })).toEqual(['città'])
  })

  it('nessun cliente → «il cliente»', () => {
    expect(datiFatturaMancanti(null)).toEqual(['il cliente'])
  })

  it('tutto mancante → elenco completo, nell’ordine dei campi', () => {
    expect(datiFatturaMancanti({})).toEqual([
      'nome o ragione sociale', 'indirizzo', 'città', 'partita IVA o codice fiscale',
    ])
  })
})

describe('messaggioDatiFattura', () => {
  it('singolare/plurale e congiunzione corretti', () => {
    expect(messaggioDatiFattura(['città'])).toContain('manca città')
    const msg = messaggioDatiFattura(['indirizzo', 'città', 'partita IVA o codice fiscale'])
    expect(msg).toContain('mancano indirizzo, città e partita IVA o codice fiscale')
    expect(msg).toContain('art. 21 DPR 633/1972')
    expect(msg).toContain('rubrica')
  })

  it('la nota di credito parla da nota, non da fattura', () => {
    expect(messaggioDatiFattura(['città'], 'nota_credito')).toMatch(/^Nota di credito non inviabile/)
    expect(messaggioDatiFattura(['città'], 'fattura')).toMatch(/^Fattura non inviabile/)
  })
})
