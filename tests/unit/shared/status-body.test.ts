import { describe, it, expect } from 'vitest'
import { StatusBodySchema } from '@/lib/documents/status-body'

// Il difetto del 9 agosto, in una riga: lo schema non dichiarava `tier`, Zod
// lo scartava in silenzio, e toccare «Base» nel pannello «Quale proposta ha
// accettato?» NON FACEVA NULLA — il server rispondeva sempre «dimmi quale».
// Questo test è la sentinella: se qualcuno toglie il campo dallo schema,
// diventa rosso invece di lasciare un tasto morto in produzione.

describe('StatusBodySchema — la proposta scelta deve ARRIVARE al server', () => {
  it('conserva `tier` accanto a `status`', () => {
    const out = StatusBodySchema.parse({ status: 'accepted', tier: 'base' })
    expect(out.tier).toBe('base')
    expect(out.status).toBe('accepted')
  })

  it('vale per qualunque proposta, non solo per la Base', () => {
    expect(StatusBodySchema.parse({ status: 'accepted', tier: 'premium' }).tier).toBe('premium')
  })

  it('senza proposta resta valido (preventivo con una proposta sola)', () => {
    const out = StatusBodySchema.parse({ status: 'accepted' })
    expect(out.tier).toBeUndefined()
  })

  it('rifiuta uno stato inventato', () => {
    expect(() => StatusBodySchema.parse({ status: 'pagata_forse' })).toThrow()
  })

  it('rifiuta un tier vuoto o assurdamente lungo', () => {
    expect(() => StatusBodySchema.parse({ status: 'accepted', tier: '' })).toThrow()
    expect(() => StatusBodySchema.parse({ status: 'accepted', tier: 'x'.repeat(41) })).toThrow()
  })
})
