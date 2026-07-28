// ── Mocks (hoistati da Vitest prima degli import) ──────────────────────────
import { vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { PATCH } from '@/app/api/fatture/[id]/status/route'

// Cronologia degli incassi (feedback Eli 26 lug dal collaudo A1): registrare
// un acconto non lasciava traccia da nessuna parte, e annullare/riattivare
// faceva sparire anche la memoria dei soldi ricevuti.
// Il log vive nel `document_log`, che è append-only e non viene MAI ripulito.

interface Call { method: string; args: unknown[] }
function buildSupabase(results: Array<{ data?: unknown; error?: unknown }>) {
  const calls: Call[] = []
  const updates: Record<string, unknown>[] = []
  const queue = [...results]
  const next = () => queue.shift() ?? { data: null, error: null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {}
  for (const m of ['select', 'eq', 'neq', 'is', 'not', 'lt', 'limit', 'order']) {
    chain[m] = (...args: unknown[]) => { calls.push({ method: m, args }); return chain }
  }
  chain.update = (arg: unknown) => {
    calls.push({ method: 'update', args: [arg] })
    updates.push(arg as Record<string, unknown>)
    return chain
  }
  chain.maybeSingle = () => Promise.resolve(next())
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(next()).then(res, rej)

  const supabase = {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
    from: (t: string) => { calls.push({ method: 'from', args: [t] }); return chain },
    rpc: () => Promise.resolve(next()),
  }
  return { supabase, updates }
}

const makeRequest = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof PATCH>[0]
const ctx = () => ({ params: Promise.resolve({ id: 'doc-1' }) })

/** Estrae il document_log scritto da un update. */
function logOf(updates: Record<string, unknown>[]): Array<Record<string, unknown>> {
  const u = updates.find((x) => Array.isArray(x.document_log))
  return (u?.document_log as Array<Record<string, unknown>>) ?? []
}

const STORICO = [{ type: 'resent', at: '2026-07-01T10:00:00.000Z' }]

beforeEach(() => { vi.clearAllMocks() })

describe('cronologia incassi nel document_log', () => {
  it('ACCONTO: scrive l’importo di QUESTO incasso, non il cumulato', async () => {
    const { supabase, updates } = buildSupabase([
      { data: { id: 'doc-1', status: 'sent', doc_type: 'fattura', workspace_id: 'ws-1', total: 1000, sent_at: '2026-07-01T00:00:00Z', sdi_status: null, document_log: STORICO } },
      { data: true },                                   // is_workspace_member
      { data: { paid_amount: 300, payment_status: 'partial' } }, // acconto già presente
      { data: [{ id: 'doc-1' }] },                      // update acconto
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    // riceve altri 200 su un acconto di 300 → cumulato 500, evento 200
    const res = await PATCH(makeRequest({ status: 'accepted', paid_amount: 200 }), ctx())
    expect(res.status).toBe(200)

    const log = logOf(updates)
    expect(log[0]).toMatchObject({ type: 'resent' })    // storico preservato
    const pay = log.find((e) => e.type === 'payment')
    expect(pay).toMatchObject({ kind: 'acconto', amount: 200 })
  })

  it('AZZERAMENTO: resta la riga in cronologia con l’importo cancellato', async () => {
    const { supabase, updates } = buildSupabase([
      { data: { id: 'doc-1', status: 'accepted', doc_type: 'fattura', workspace_id: 'ws-1', total: 1000, sent_at: '2026-07-01T00:00:00Z', sdi_status: null, document_log: STORICO } },
      { data: true },
      { data: { paid_amount: 300, payment_status: 'partial' } },
      { data: [{ id: 'doc-1' }] },
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    // accepted → sent = "Segna come non pagata": azzera l'incasso
    await PATCH(makeRequest({ status: 'sent' }), ctx())

    const log = logOf(updates)
    const reset = log.find((e) => e.type === 'payment_reset')
    // il MOTIVO dell'azzeramento resta scritto (richiesta Eli 27 lug)
    expect(reset).toMatchObject({ amount: 300, reason: 'non_pagata' })
    // ⚠️ il punto della richiesta di Eli: la storia NON si perde
    expect(log.some((e) => e.type === 'resent')).toBe(true)
  })

  it('AZZERAMENTO di una fattura PAGATA PER INTERO: l’importo c’è comunque', async () => {
    // Bug del 27 lug: leggevo solo il caso 'partial' → riattivare una
    // fattura saldata scriveva "Incasso azzerato" SENZA importo.
    const { supabase, updates } = buildSupabase([
      { data: { id: 'doc-1', status: 'accepted', doc_type: 'fattura', workspace_id: 'ws-1', total: 1000, sent_at: '2026-07-01T00:00:00Z', sdi_status: null, document_log: STORICO } },
      { data: true },
      { data: { paid_amount: 1000, payment_status: 'paid' } },
      { data: [{ id: 'doc-1' }] },
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    await PATCH(makeRequest({ status: 'sent' }), ctx())

    const reset = logOf(updates).find((e) => e.type === 'payment_reset')
    expect(reset).toMatchObject({ amount: 1000 })
  })

  it('AZZERAMENTO a vuoto: NESSUNA riga (la cronologia non si riempie di rumore)', async () => {
    // Annulla+riattiva senza soldi registrati scriveva "Incasso azzerato"
    // a ogni passaggio (screenshot Eli 27 lug: 4 righe a vuoto).
    const { supabase, updates } = buildSupabase([
      { data: { id: 'doc-1', status: 'sent', doc_type: 'fattura', workspace_id: 'ws-1', total: 1000, sent_at: '2026-07-01T00:00:00Z', sdi_status: null, document_log: STORICO } },
      { data: true },
      { data: { paid_amount: null, payment_status: 'unpaid' } },
      { data: [{ id: 'doc-1' }] },
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    await PATCH(makeRequest({ status: 'rejected' }), ctx())

    expect(logOf(updates).some((e) => e.type === 'payment_reset')).toBe(false)
  })

  it('ANNULLA con acconto: in cronologia restano SIA "Annullata" SIA l\'azzeramento', async () => {
    // Feedback Eli 27 lug: "non compare che ho annullato e riattivato".
    // Due update in sequenza scrivono il log nella stessa richiesta: senza
    // la base cumulativa il secondo cancellerebbe la voce del primo.
    const { supabase, updates } = buildSupabase([
      { data: { id: 'doc-1', status: 'sent', doc_type: 'fattura', workspace_id: 'ws-1', total: 1000, sent_at: '2026-07-01T00:00:00Z', sdi_status: null, document_log: STORICO } },
      { data: true },
      { data: { paid_amount: 300, payment_status: 'partial' } },
      { data: [{ id: 'doc-1' }] }, // update stato (rejected)
      { data: [{ id: 'doc-1' }] }, // update azzeramento
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    await PATCH(makeRequest({ status: 'rejected' }), ctx())

    const logs = updates.filter((u) => Array.isArray(u.document_log))
    const ultimo = logs[logs.length - 1].document_log as Array<Record<string, unknown>>
    expect(ultimo.some((e) => e.type === 'cancelled')).toBe(true)
    expect(ultimo.find((e) => e.type === 'payment_reset')).toMatchObject({ amount: 300, reason: 'annullamento' })
    expect(ultimo.some((e) => e.type === 'resent')).toBe(true) // storico intatto
  })

  it('RIATTIVA (rejected → draft): la cronologia lo racconta', async () => {
    const { supabase, updates } = buildSupabase([
      { data: { id: 'doc-1', status: 'rejected', doc_type: 'fattura', workspace_id: 'ws-1', total: 1000, sent_at: '2026-07-01T00:00:00Z', sdi_status: null, document_log: STORICO } },
      { data: true },
      { data: { paid_amount: null, payment_status: 'unpaid' } },
      { data: [{ id: 'doc-1' }] },
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    await PATCH(makeRequest({ status: 'draft' }), ctx())

    expect(logOf(updates).some((e) => e.type === 'reactivated')).toBe(true)
  })

  it('incasso con data FUTURA: rifiutato con 422', async () => {
    const domani = new Date(Date.now() + 48 * 3600_000).toISOString().slice(0, 10)
    const { supabase } = buildSupabase([
      { data: { id: 'doc-1', status: 'sent', doc_type: 'fattura', workspace_id: 'ws-1', total: 1000, sent_at: '2026-07-01T00:00:00Z', sdi_status: null, document_log: [] } },
      { data: true },
      { data: { paid_amount: null, payment_status: 'unpaid' } },
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await PATCH(makeRequest({ status: 'accepted', paid_amount: 100, paid_date: domani }), ctx())
    expect(res.status).toBe(422)
  })

  it('AZZERA ACCONTO SBAGLIATO (reset_payment): importo in cronologia, stato invariato', async () => {
    // Feedback Eli 27 lug: "se un artigiano avesse sbagliato a inserire
    // l'acconto come fa a cambiarlo?" — su una fattura non saldata non
    // c'era NESSUNA uscita ("Segna non pagata" esiste solo su accepted).
    const { supabase, updates } = buildSupabase([
      { data: { id: 'doc-1', status: 'sent', doc_type: 'fattura', workspace_id: 'ws-1', total: 1000, sent_at: '2026-07-01T00:00:00Z', sdi_status: null, document_log: STORICO } },
      { data: true },                                            // is_workspace_member
      { data: { paid_amount: 300, payment_status: 'partial' } }, // acconto registrato
      { data: [{ id: 'doc-1' }] },                               // update azzeramento
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await PATCH(makeRequest({ reset_payment: true }), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ reset: true, status: 'sent' })

    const reset = logOf(updates).find((e) => e.type === 'payment_reset')
    expect(reset).toMatchObject({ amount: 300, reason: 'correzione' })
    // lo STATO della fattura non è stato toccato (resta da incassare)
    expect(updates.some((u) => 'status' in u)).toBe(false)
    // e lo storico è intatto
    expect(logOf(updates).some((e) => e.type === 'resent')).toBe(true)
  })

  it('reset_payment senza nessun acconto: 409, niente scritture', async () => {
    const { supabase, updates } = buildSupabase([
      { data: { id: 'doc-1', status: 'sent', doc_type: 'fattura', workspace_id: 'ws-1', total: 1000, sent_at: '2026-07-01T00:00:00Z', sdi_status: null, document_log: [] } },
      { data: true },
      { data: { paid_amount: null, payment_status: 'unpaid' } },
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await PATCH(makeRequest({ reset_payment: true }), ctx())
    expect(res.status).toBe(409)
    expect(updates).toHaveLength(0)
  })

  it('reset_payment su fattura SALDATA: 409 (si usa "Segna come non pagata")', async () => {
    const { supabase, updates } = buildSupabase([
      { data: { id: 'doc-1', status: 'accepted', doc_type: 'fattura', workspace_id: 'ws-1', total: 1000, sent_at: '2026-07-01T00:00:00Z', sdi_status: null, document_log: [] } },
      { data: true },
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await PATCH(makeRequest({ reset_payment: true }), ctx())
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(String(body.error)).toContain('Segna come non pagata')
    expect(updates).toHaveLength(0)
  })

  it('sbagliato → azzerato → reinserito: TUTTE le voci restano in fila (richiesta Eli)', async () => {
    // La cronologia deve raccontare l'intera storia: acconto sbagliato,
    // azzeramento per correzione, acconto reinserito — ognuno con la sua data.
    const storiaPrecedente = [
      ...STORICO,
      { type: 'payment', at: '2026-07-27T09:00:00.000Z', amount: 300, kind: 'acconto' },
      { type: 'payment_reset', at: '2026-07-27T09:05:00.000Z', amount: 300, reason: 'correzione' },
    ]
    const { supabase, updates } = buildSupabase([
      { data: { id: 'doc-1', status: 'sent', doc_type: 'fattura', workspace_id: 'ws-1', total: 1000, sent_at: '2026-07-01T00:00:00Z', sdi_status: null, document_log: storiaPrecedente } },
      { data: true },
      { data: { paid_amount: null, payment_status: 'unpaid' } }, // dopo l'azzeramento
      { data: [{ id: 'doc-1' }] },
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    // reinserisce l'acconto giusto
    await PATCH(makeRequest({ status: 'accepted', paid_amount: 250 }), ctx())

    const log = logOf(updates)
    const types = log.map((e) => e.type)
    expect(types).toEqual(['resent', 'payment', 'payment_reset', 'payment'])
    expect(log[1]).toMatchObject({ amount: 300 })                      // acconto sbagliato: resta
    expect(log[2]).toMatchObject({ amount: 300, reason: 'correzione' }) // azzeramento: resta col motivo
    expect(log[3]).toMatchObject({ amount: 250, kind: 'acconto' })      // acconto reinserito
  })

  it('il log non viene mai sovrascritto: le voci si accodano', async () => {
    const { supabase, updates } = buildSupabase([
      { data: { id: 'doc-1', status: 'sent', doc_type: 'fattura', workspace_id: 'ws-1', total: 1000, sent_at: '2026-07-01T00:00:00Z', sdi_status: null, document_log: [...STORICO, { type: 'payment', at: '2026-07-02T10:00:00.000Z', amount: 300, kind: 'acconto' }] } },
      { data: true },
      { data: { paid_amount: 300, payment_status: 'partial' } },
      { data: [{ id: 'doc-1' }] },
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    await PATCH(makeRequest({ status: 'accepted', paid_amount: 200 }), ctx())

    const log = logOf(updates)
    expect(log).toHaveLength(3) // resent + acconto vecchio + acconto nuovo
    expect(log.filter((e) => e.type === 'payment')).toHaveLength(2)
  })
})
