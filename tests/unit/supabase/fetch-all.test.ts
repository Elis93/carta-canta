import { describe, it, expect } from 'vitest'
import { fetchAllRows } from '@/lib/supabase/fetch-all'

// L'helper esiste per NON perdere righe: se sbaglia la paginazione fa
// esattamente il danno che deve evitare (registro fiscale incompleto).

/** Costruisce un finto builder PostgREST su un dataset noto. */
function fakeDb(total: number, opts: { error?: unknown } = {}) {
  const ranges: Array<[number, number]> = []
  const orders: Array<[string, unknown]> = []
  const rows = Array.from({ length: total }, (_, i) => ({ id: `r${String(i).padStart(5, '0')}` }))
  const make = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      order: (col: string, o: unknown) => { orders.push([col, o]); return chain },
      range: (from: number, to: number) => {
        ranges.push([from, to])
        if (opts.error) return Promise.resolve({ data: null, error: opts.error })
        return Promise.resolve({ data: rows.slice(from, to + 1), error: null })
      },
    }
    return chain
  }
  return { make, ranges, orders }
}

describe('fetchAllRows — paginazione senza perdere righe', () => {
  it('meno di una pagina: una sola richiesta, tutte le righe', async () => {
    const { make, ranges } = fakeDb(42)
    const { data, error } = await fetchAllRows<{ id: string }>(make)
    expect(error).toBeNull()
    expect(data).toHaveLength(42)
    expect(ranges).toEqual([[0, 999]])
  })

  it('più pagine: le righe si sommano, nessun buco e nessun doppione', async () => {
    const { make, ranges } = fakeDb(2500)
    const { data } = await fetchAllRows<{ id: string }>(make)
    expect(data).toHaveLength(2500)
    expect(new Set(data!.map((r) => r.id)).size).toBe(2500) // niente duplicati
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it('multiplo esatto della pagina: serve un giro in più per sapere che è finita', async () => {
    const { make, ranges } = fakeDb(2000)
    const { data } = await fetchAllRows<{ id: string }>(make)
    expect(data).toHaveLength(2000)
    // 2 pagine piene + 1 vuota: senza il terzo giro non si saprebbe se
    // mancano righe.
    expect(ranges).toHaveLength(3)
  })

  it('ordine stabile applicato a ogni pagina (senza, le pagine si sovrappongono)', async () => {
    const { make, orders } = fakeDb(1500)
    await fetchAllRows(make)
    expect(orders.every(([col]) => col === 'id')).toBe(true)
    expect(orders).toHaveLength(2)
  })

  it('colonna d\'ordine personalizzabile', async () => {
    const { make, orders } = fakeDb(10)
    await fetchAllRows(make, 'created_at')
    expect(orders[0][0]).toBe('created_at')
  })

  it('errore: data null e errore propagato (mai dati parziali spacciati per completi)', async () => {
    const { make } = fakeDb(5000, { error: { code: '42P01' } })
    const { data, error } = await fetchAllRows(make)
    expect(data).toBeNull()
    expect(error).toMatchObject({ code: '42P01' })
  })
})
