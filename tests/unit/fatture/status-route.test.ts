// ── Mocks (hoistati da Vitest prima degli import) ──────────────────────────
import { vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

// ── Import ─────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { PATCH } from '@/app/api/fatture/[id]/status/route'

// Congela i fix dell'audit fatture del 25 lug 2026:
//  · reset pagamento con 'unpaid' (non null — NOT NULL della 038)
//  · uscita da "pagata" (accepted → sent) e atterraggio in BOZZA se mai inviata
//  · guardia SdI trasmessa su annulla/riattiva
//  · lock ottimistico su cambio stato e acconti (0 righe → 409)
//  · riattiva scartata azzera lo stato SdI

// ── Helper: client Supabase finto a catena "coda di risultati" ─────────────
// Ogni await sulla catena (o maybeSingle) consuma il PROSSIMO risultato.
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
  for (const m of ['select', 'eq', 'neq', 'in', 'is', 'not', 'lt', 'limit', 'order']) {
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

function makeRequest(body: unknown) {
  // La route usa solo request.json()
  return { json: async () => body } as unknown as Parameters<typeof PATCH>[0]
}
const ctx = (id = 'doc-1') => ({ params: Promise.resolve({ id }) })

const DOC = {
  id: 'doc-1', status: 'sent', doc_type: 'fattura', workspace_id: 'ws-1',
  total: 1000, sent_at: '2026-07-01T00:00:00Z', sdi_status: null,
}

beforeEach(() => { vi.clearAllMocks() })

describe('PATCH /api/fatture/[id]/status — matrice movimenti (audit 25 lug)', () => {
  it('NOTA DI CREDITO: «Segna pagata» rifiutato — il denaro torna, non arriva', async () => {
    // Revisione 10 ago: la route filtrava doc_type='fattura' e a una NC
    // rispondeva 404 «Fattura non trovata» — l'unico comando di stato
    // offerto sulla nota falliva SEMPRE. Ora la NC entra, ma «pagata» resta
    // vietato: nel Bilancio entrerebbe col segno OPPOSTO al suo.
    const { supabase } = buildSupabase([
      { data: { ...DOC, doc_type: 'nota_credito' } },
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await PATCH(makeRequest({ status: 'accepted' }), ctx())
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(String(body.error)).toContain('non si incassa')
  })

  it('NOTA DI CREDITO trasmessa: annullamento bloccato col messaggio della nota di DEBITO', async () => {
    const { supabase } = buildSupabase([
      { data: { ...DOC, doc_type: 'nota_credito', sdi_status: 'consegnata' } },
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await PATCH(makeRequest({ status: 'rejected' }), ctx())
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(String(body.error)).toContain('nota di debito')
  })

  it('transizione vietata (sent → draft) risponde 409', async () => {
    const { supabase } = buildSupabase([
      { data: DOC },                    // select doc
      { data: true },                   // rpc is_workspace_member
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await PATCH(makeRequest({ status: 'draft' }), ctx())
    expect(res.status).toBe(409)
  })

  it('fattura TRASMESSA allo SdI: annullamento bloccato con messaggio nota di credito', async () => {
    const { supabase } = buildSupabase([
      { data: { ...DOC, sdi_status: 'consegnata' } },
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await PATCH(makeRequest({ status: 'rejected' }), ctx())
    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toContain('nota di credito')
  })

  it('"Segna non pagata" (accepted → sent): azzera accettazione e pagamento con \'unpaid\'', async () => {
    const { supabase, updates } = buildSupabase([
      { data: { ...DOC, status: 'accepted' } },   // select doc (sent_at presente)
      { data: true },                              // rpc member
      { data: { payment_status: 'paid', paid_amount: 1000 } }, // select paid
      { data: [{ id: 'doc-1' }] },                 // update status (lock ok)
      { data: null },                              // reset payment
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await PATCH(makeRequest({ status: 'sent' }), ctx())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, status: 'sent' })

    const statusPatch = updates[0] as Record<string, unknown>
    expect(statusPatch.status).toBe('sent')
    expect(statusPatch.accepted_at).toBeNull()
    // Reset con 'unpaid', MAI null (NOT NULL della 038 — il bug storico)
    const resetPatch = updates[1] as Record<string, unknown>
    expect(resetPatch.payment_status).toBe('unpaid')
    expect(resetPatch.paid_amount).toBeNull()
  })

  it('"Segna non pagata" su fattura MAI inviata atterra in BOZZA, non su "Inviata"', async () => {
    const { supabase, updates } = buildSupabase([
      { data: { ...DOC, status: 'accepted', sent_at: null } },
      { data: true },
      { data: { payment_status: 'paid', paid_amount: 1000 } },
      { data: [{ id: 'doc-1' }] },
      { data: null },
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await PATCH(makeRequest({ status: 'sent' }), ctx())
    expect(await res.json()).toMatchObject({ status: 'draft' })
    expect((updates[0] as Record<string, unknown>).status).toBe('draft')
  })

  it('lock ottimistico: stato cambiato da un\'altra finestra → 409, niente falso successo', async () => {
    const { supabase } = buildSupabase([
      { data: DOC },
      { data: true },
      { data: { payment_status: 'unpaid' } },
      { data: [] },                                // update status: 0 righe (race)
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await PATCH(makeRequest({ status: 'rejected' }), ctx())
    expect(res.status).toBe(409)
  })

  it('acconto oltre il residuo → 422 col residuo indicato', async () => {
    const { supabase } = buildSupabase([
      { data: DOC },
      { data: true },
      { data: { payment_status: 'partial', paid_amount: 800 } },
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await PATCH(makeRequest({ status: 'accepted', paid_amount: 300 }), ctx())
    expect(res.status).toBe(422)
    expect((await res.json()).error).toContain('200')
  })

  it('doppio submit dello stesso acconto: lock su paid_amount → 409, non somma due volte', async () => {
    const { supabase } = buildSupabase([
      { data: DOC },
      { data: true },
      { data: { payment_status: 'partial', paid_amount: 500 } },
      { data: [] },                                // update partial: 0 righe (race)
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await PATCH(makeRequest({ status: 'accepted', paid_amount: 200 }), ctx())
    expect(res.status).toBe(409)
  })

  it('riattiva una SCARTATA (rejected → draft): azzera anche lo stato SdI del tentativo rifiutato', async () => {
    const { supabase, updates } = buildSupabase([
      { data: { ...DOC, status: 'rejected', sdi_status: 'scartata' } },
      { data: true },
      { data: { payment_status: 'unpaid' } },
      { data: [{ id: 'doc-1' }] },                 // update status
      { data: null },                              // reset payment
      { data: null },                              // reset sdi
      { data: null },                              // reset snapshot (best-effort)
    ])
    vi.mocked(createClient).mockResolvedValue(supabase as never)

    const res = await PATCH(makeRequest({ status: 'draft' }), ctx())
    expect(res.status).toBe(200)
    const sdiReset = updates.find((u) => (u as Record<string, unknown>).sdi_status === null && 'sdi_provider_id' in (u as object))
    expect(sdiReset).toBeDefined()
    expect((sdiReset as Record<string, unknown>).sdi_sent_at).toBeNull()
  })
})
