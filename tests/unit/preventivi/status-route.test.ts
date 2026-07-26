// ── Mocks (hoistati da Vitest prima degli import) ──────────────────────────
import { vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

// ── Import ─────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { PATCH } from '@/app/api/preventivi/[id]/status/route'

// Congela il fix del 26 lug: questa route serve SOLO i preventivi.
// Senza il filtro doc_type una FATTURA poteva essere mossa da qui saltando
// le guardie della sua route — in particolare il blocco "fattura trasmessa
// allo SdI: serve una nota di credito".

interface Call { method: string; args: unknown[] }
function buildSupabase(
  results: Array<{ data?: unknown; error?: unknown }>,
  user: { id: string } | null = { id: 'user-1' },
) {
  const calls: Call[] = []
  const updates: unknown[] = []
  const queue = [...results]
  const next = () => queue.shift() ?? { data: null, error: null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {}
  for (const m of ['select', 'eq', 'neq', 'is', 'not', 'lt', 'limit', 'order']) {
    chain[m] = (...args: unknown[]) => { calls.push({ method: m, args }); return chain }
  }
  chain.update = (...args: unknown[]) => { calls.push({ method: 'update', args }); updates.push(args[0]); return chain }
  chain.maybeSingle = () => { calls.push({ method: 'maybeSingle', args: [] }); return Promise.resolve(next()) }
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(next()).then(res, rej)

  const supabase = {
    auth: { getUser: () => Promise.resolve({ data: { user } }) },
    from: (table: string) => { calls.push({ method: 'from', args: [table] }); return chain },
    rpc: (name: string, args: unknown) => { calls.push({ method: 'rpc', args: [name, args] }); return Promise.resolve(next()) },
  }
  return { supabase, calls, updates }
}

const makeRequest = (body: unknown) => ({ json: async () => body }) as unknown as Parameters<typeof PATCH>[0]
const ctx = (id = 'doc-1') => ({ params: Promise.resolve({ id }) })

const PREV = {
  id: 'doc-1', status: 'sent', workspace_id: 'ws-1', validity_days: 30,
  doc_type: 'preventivo', signer_name: null, accepted_ip: null,
}

beforeEach(() => { vi.clearAllMocks() })

describe('PATCH /api/preventivi/[id]/status — solo preventivi (fix 26 lug)', () => {
  it('FATTURA: rifiutata con 409, nessuna scrittura', async () => {
    const { supabase, updates } = buildSupabase([
      { data: { ...PREV, doc_type: 'fattura' } },
      { data: true }, // is_workspace_member (non dovrebbe nemmeno servire)
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    // Una fattura TRASMESSA allo SdI si annulla solo con nota di credito:
    // da qui non deve passare in nessun caso.
    const res = await PATCH(makeRequest({ status: 'rejected' }), ctx())
    expect(res.status).toBe(409)
    expect(await res.json()).toMatchObject({ error: expect.stringContaining('fattura') })
    expect(updates.length).toBe(0)
  })

  it('FATTURA: nemmeno "Pagata" (accepted) passa da qui', async () => {
    const { supabase, updates } = buildSupabase([
      { data: { ...PREV, doc_type: 'fattura' } },
      { data: true },
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await PATCH(makeRequest({ status: 'accepted' }), ctx())
    expect(res.status).toBe(409)
    expect(updates.length).toBe(0)
  })

  it('PREVENTIVO: la transizione normale continua a funzionare', async () => {
    const { supabase, updates } = buildSupabase([
      { data: PREV },
      { data: true },              // is_workspace_member
      { data: [] },                // option_tier: nessuna proposta multipla
      { data: [{ id: 'doc-1' }] }, // update condizionato → 1 riga
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await PATCH(makeRequest({ status: 'accepted' }), ctx())
    expect(res.status).toBe(200)
    expect(updates[0]).toMatchObject({ status: 'accepted' })
  })

  it('PREVENTIVO non trovato: 404', async () => {
    const { supabase } = buildSupabase([{ data: null }])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await PATCH(makeRequest({ status: 'accepted' }), ctx())
    expect(res.status).toBe(404)
  })
})
