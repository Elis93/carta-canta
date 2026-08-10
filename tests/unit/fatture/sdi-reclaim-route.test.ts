// ── Mocks (hoistati da Vitest prima degli import) ──────────────────────────
import { vi } from 'vitest'

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/actions/resolve-workspace', () => ({ resolveWorkspaceForUser: vi.fn() }))
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn(() => ({ success: true, resetAt: 0 })),
  rateLimitResponse: vi.fn(() => new Response(JSON.stringify({ error: 'rate limited' }), { status: 429 })),
}))

// ── Import ─────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceForUser } from '@/lib/actions/resolve-workspace'
import { checkRateLimit } from '@/lib/rate-limit'
import { SDI_SEND_ATTEMPT_MARKER } from '@/lib/sdi/types'

// Congela la CATENA DI GUARDIE anti doppia-trasmissione dello sblocco
// fattura orfana (review 25 lug): lo sblocco passa SOLO quando è certo che
// nulla è partito — ogni guardia qui è una difesa contro una seconda
// trasmissione fiscale della stessa fattura.

// ⚠️ NEXT_PUBLIC_SDI_ENABLED è letto all'IMPORT del modulo → import dinamico
// con vi.resetModules + stubEnv (stesso pattern di extract-photos-route.test).
async function loadRoute(sdiEnabled = true) {
  vi.resetModules()
  vi.stubEnv('NEXT_PUBLIC_SDI_ENABLED', sdiEnabled ? 'true' : '')
  return await import('@/app/api/fatture/[id]/sdi/reclaim/route')
}

// ── Helper: client Supabase finto a catena "coda di risultati" ─────────────
function buildSupabase(results: Array<{ data?: unknown; error?: unknown }>, user: { id: string } | null = { id: 'user-1' }) {
  const calls: Array<{ method: string; args: unknown[] }> = []
  const queue = [...results]
  const next = () => queue.shift() ?? { data: null, error: null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {}
  for (const m of ['select', 'update', 'eq', 'neq', 'in', 'is', 'not', 'lt', 'limit', 'order']) {
    chain[m] = (...args: unknown[]) => { calls.push({ method: m, args }); return chain }
  }
  chain.maybeSingle = () => { calls.push({ method: 'maybeSingle', args: [] }); return Promise.resolve(next()) }
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(next()).then(res, rej)

  const supabase = {
    auth: { getUser: () => Promise.resolve({ data: { user } }) },
    from: (table: string) => { calls.push({ method: 'from', args: [table] }); return chain },
  }
  return { supabase, calls }
}

const req = {} as never
const ctx = (id = 'fatt-1') => ({ params: Promise.resolve({ id }) })

const OLD = new Date(Date.now() - 30 * 60_000).toISOString()   // ferma da 30 min
const FRESH = new Date(Date.now() - 2 * 60_000).toISOString()  // ferma da 2 min

function orphanDoc(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fatt-1', sdi_status: 'inviata', sdi_sent_at: null,
    sdi_provider_id: null, sdi_updated_at: OLD, sdi_error: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(resolveWorkspaceForUser).mockResolvedValue({ id: 'ws-1' } as never)
  vi.mocked(checkRateLimit).mockReturnValue({ success: true, resetAt: 0 } as never)
})

describe('POST /api/fatture/[id]/sdi/reclaim — catena anti doppia-trasmissione', () => {
  it('SdI spento → 403 (gate come le route sorelle)', async () => {
    const { POST } = await loadRoute(false)
    const res = await POST(req, ctx())
    expect(res.status).toBe(403)
  })

  it('fattura non in stato "inviata" → 409 "non è bloccata"', async () => {
    const { supabase } = buildSupabase([{ data: orphanDoc({ sdi_status: 'consegnata' }) }])
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    const { POST } = await loadRoute()

    const res = await POST(req, ctx())
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('non è bloccata')
  })

  it('TRACCIA di invio (sent_at presente) → 409, mai sbloccare una trasmessa', async () => {
    const { supabase } = buildSupabase([{ data: orphanDoc({ sdi_sent_at: OLD }) }])
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    const { POST } = await loadRoute()

    const res = await POST(req, ctx())
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('trasmessa')
  })

  it('MARKER "tentativo avviato" → 409 con invito al supporto (la trasmissione POTREBBE essere partita)', async () => {
    const { supabase } = buildSupabase([{ data: orphanDoc({ sdi_error: SDI_SEND_ATTEMPT_MARKER }) }])
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    const { POST } = await loadRoute()

    const res = await POST(req, ctx())
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('Aiuto')
  })

  it('ferma da MENO di 10 minuti → 409 (potrebbe essere un invio in volo)', async () => {
    const { supabase } = buildSupabase([{ data: orphanDoc({ sdi_updated_at: FRESH }) }])
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    const { POST } = await loadRoute()

    const res = await POST(req, ctx())
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('in corso')
  })

  it('sdi_updated_at ASSENTE (riga anomala) → 409, fail-closed', async () => {
    const { supabase } = buildSupabase([{ data: orphanDoc({ sdi_updated_at: null }) }])
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    const { POST } = await loadRoute()

    const res = await POST(req, ctx())
    expect(res.status).toBe(409)
  })

  it('orfana VERA (nessuna traccia, niente marker, ferma >10 min) → sbloccata con reset CONDIZIONATO', async () => {
    const { supabase, calls } = buildSupabase([
      { data: orphanDoc() },            // select doc
      { data: [{ id: 'fatt-1' }] },     // update reset (rowcount 1)
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    const { POST } = await loadRoute()

    const res = await POST(req, ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true })

    // Il reset deve essere CONDIZIONATO: stato ancora 'inviata', nessuna
    // traccia di invio, e riga ancora "vecchia" (lt sul cutoff) — un invio
    // concorrente rifà il claim → updated_at fresco → 0 righe.
    const update = calls.find((c) => c.method === 'update')?.args[0] as Record<string, unknown>
    expect(update.sdi_status).toBeNull()
    const conds = calls.filter((c) => ['eq', 'is', 'lt'].includes(c.method)).map((c) => c.args[0])
    expect(conds).toContain('sdi_provider_id')
    expect(conds).toContain('sdi_sent_at')
    expect(conds).toContain('sdi_updated_at')
  })

  it('race: un invio concorrente ha rifatto il claim (0 righe) → 409, niente reset', async () => {
    const { supabase } = buildSupabase([
      { data: orphanDoc() },
      { data: [] },                     // update reset: 0 righe
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    const { POST } = await loadRoute()

    const res = await POST(req, ctx())
    expect(res.status).toBe(409)
  })

  it('fattura inesistente o di un altro workspace → 404', async () => {
    const { supabase } = buildSupabase([{ data: null }])
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    const { POST } = await loadRoute()

    const res = await POST(req, ctx())
    expect(res.status).toBe(404)
  })
})
