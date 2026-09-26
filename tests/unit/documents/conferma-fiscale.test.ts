import { describe, it, expect } from 'vitest'
import { registraConfermaFiscale } from '@/lib/documents/conferma-fiscale'
import { giornoItaliano } from '@/lib/sdi/termini'

// Circ. 14/E/2019: il campo «Data» della fattura elettronica è la data di
// EFFETTUAZIONE dell'operazione — per i servizi, il pagamento se viene prima.
// La conferma deve quindi scrivere il giorno più vecchio fra oggi e gli incassi.

function fakeSupabase(paidAt: string | null) {
  const scritti: Array<Record<string, unknown>> = []
  const chain = (tipo: 'select' | 'update', patch?: Record<string, unknown>) => {
    const q: Record<string, unknown> = {}
    q.eq = () => q
    q.is = () => q
    q.maybeSingle = async () => ({ data: { paid_at: paidAt }, error: null })
    q.then = (ok: (v: unknown) => void) => {
      if (tipo === 'update' && patch) scritti.push(patch)
      ok({ error: null })
      return Promise.resolve()
    }
    return q
  }
  return {
    scritti,
    from: () => ({
      select: () => chain('select'),
      update: (patch: Record<string, unknown>) => chain('update', patch),
    }),
  }
}

describe('registraConfermaFiscale — data della fattura', () => {
  const oggi = giornoItaliano(new Date())

  it('senza incassi: oggi', async () => {
    const sb = fakeSupabase(null)
    await registraConfermaFiscale(sb, 'ws', 'doc', 'fattura')
    expect(sb.scritti).toEqual([{ doc_date: oggi }])
  })

  it('«Segna pagata» con incasso retrodatato: la data dell\'incasso', async () => {
    const sb = fakeSupabase(null)
    await registraConfermaFiscale(sb, 'ws', 'doc', 'fattura', '2026-09-10')
    expect(sb.scritti).toEqual([{ doc_date: '2026-09-10' }])
  })

  it('acconto già registrato sulla bozza: la data dell\'acconto', async () => {
    const sb = fakeSupabase('2026-09-05T10:00:00.000Z')
    await registraConfermaFiscale(sb, 'ws', 'doc', 'fattura', '2026-09-10')
    expect(sb.scritti).toEqual([{ doc_date: '2026-09-05' }])
  })

  it('preventivo: nessuna data fiscale', async () => {
    const sb = fakeSupabase('2026-09-05T10:00:00.000Z')
    await registraConfermaFiscale(sb, 'ws', 'doc', 'preventivo')
    expect(sb.scritti).toEqual([])
  })
})
