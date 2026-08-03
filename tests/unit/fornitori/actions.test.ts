// ── Mocks (hoistati da Vitest prima degli import) ──────────────────────────
import { vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn(() => { throw new Error('redirect') }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/ai/quota', () => ({
  getAiImportQuota: vi.fn(),
  recordAiImportUse: vi.fn(),
  quotaExhaustedMessage: vi.fn(() => 'Quota AI esaurita.'),
}))

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { getAiImportQuota, recordAiImportUse } from '@/lib/ai/quota'
import { importSupplierItemsAction, createSupplierListAction } from '@/lib/actions/fornitori'

const LIST_ID = '22222222-2222-2222-2222-222222222222'

// Catena Supabase finta: ogni from(tabella) produce un builder che registra
// l'operazione (select/insert/update) ed è thenable — risolve in base a
// tabella+operazione, con override configurabili per i casi d'errore.
function buildClient(opts: {
  plan?: string
  list?: { id: string } | null
  listError?: { code: string } | null
  existing?: Array<{ id: string; code: string | null; description: string; unit_cost: number }>
} = {}) {
  const inserted: Array<{ table: string; rows: unknown }> = []
  const updates: Array<{ table: string; payload: Record<string, unknown> }> = []

  function makeChain(table: string) {
    let mode: 'select' | 'insert' | 'update' = 'select'
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      select: () => chain,
      eq: () => chain,
      not: () => chain,
      limit: () => chain,
      order: () => chain,
      single: () => chain.maybeSingle(),
      insert: (rows: unknown) => { mode = 'insert'; inserted.push({ table, rows }); return chain },
      update: (payload: Record<string, unknown>) => { mode = 'update'; updates.push({ table, payload }); return chain },
      maybeSingle: () => {
        if (table === 'workspaces') return Promise.resolve({ data: { id: 'ws-1', plan: opts.plan ?? 'pro' }, error: null })
        if (table === 'supplier_lists') {
          return Promise.resolve({ data: opts.list === undefined ? { id: LIST_ID } : opts.list, error: opts.listError ?? null })
        }
        return Promise.resolve({ data: null, error: null })
      },
      then: (ok: (v: unknown) => unknown) => {
        if (mode === 'insert') return Promise.resolve({ data: [{ id: 'new-1' }], error: null }).then(ok)
        if (mode === 'update') return Promise.resolve({ data: [{ id: 'x' }], error: null }).then(ok)
        if (table === 'supplier_list_items') return Promise.resolve({ data: opts.existing ?? [], error: null }).then(ok)
        return Promise.resolve({ data: [], error: null }).then(ok)
      },
    }
    return chain
  }

  const supabase = {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } } }) },
    from: (table: string) => makeChain(table),
  }
  return { supabase, inserted, updates }
}

const item = (over: Partial<{ code: string | null; description: string; unit: string; unit_cost: number }> = {}) => ({
  code: null, description: 'Tubo 20mm', unit: 'ml', unit_cost: 2.5, ...over,
})

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(getAiImportQuota).mockResolvedValue({ allowed: true, remaining: 5, isPro: true } as never)
})

describe('importSupplierItemsAction', () => {
  it('piano Free → errore Pro, nessuna scrittura', async () => {
    const { supabase, inserted, updates } = buildClient({ plan: 'free' })
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    const res = await importSupplierItemsAction(LIST_ID, [item()])
    expect(res.error).toMatch(/Pro/)
    expect(inserted).toHaveLength(0)
    expect(updates).toHaveLength(0)
    expect(recordAiImportUse).not.toHaveBeenCalled()
  })

  it('id listino non-UUID → errore senza toccare la quota', async () => {
    const { supabase } = buildClient()
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    const res = await importSupplierItemsAction('non-un-uuid', [item()])
    expect(res.error).toBe('Listino non trovato.')
    expect(getAiImportQuota).not.toHaveBeenCalled()
  })

  it('quota AI esaurita → errore, NESSUN insert/update e uso NON registrato', async () => {
    vi.mocked(getAiImportQuota).mockResolvedValue({ allowed: false, reason: 'pro_monthly' } as never)
    const { supabase, inserted, updates } = buildClient()
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    const res = await importSupplierItemsAction(LIST_ID, [item()])
    expect(res.error).toBe('Quota AI esaurita.')
    expect(inserted).toHaveLength(0)
    expect(updates).toHaveLength(0)
    expect(recordAiImportUse).not.toHaveBeenCalled()
  })

  it('tabella assente (pre-063) → messaggio migration', async () => {
    const { supabase } = buildClient({ list: null, listError: { code: '42P01' } })
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    const res = await importSupplierItemsAction(LIST_ID, [item()])
    expect(res.error).toMatch(/migration 063/)
  })

  it('primo import (listino vuoto): tutte le voci inserite, uso registrato col conteggio', async () => {
    const { supabase, inserted, updates } = buildClient({ existing: [] })
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    const res = await importSupplierItemsAction(LIST_ID, [
      item(), item({ code: 'VLV-1', description: 'Valvola', unit: 'pz', unit_cost: 8 }),
    ])
    expect(res.error).toBeUndefined()
    expect(res.matched).toBe(0)
    expect(res.added).toBe(2)
    const itemInserts = inserted.filter((i) => i.table === 'supplier_list_items')
    expect(itemInserts).toHaveLength(1)
    expect(itemInserts[0]!.rows).toHaveLength(2)
    expect(recordAiImportUse).toHaveBeenCalledWith('ws-1', 'pro', 2)
    // touch del listino (updated_at, nessuna valid_until passata)
    expect(updates.some((u) => u.table === 'supplier_lists' && 'updated_at' in u.payload)).toBe(true)
  })

  it('RINNOVO: abbina per codice, aggiorna il costo, stats dei rincari, nuova scadenza', async () => {
    const { supabase, inserted, updates } = buildClient({
      existing: [{ id: 'ex-1', code: 'TB-20', description: 'Tubo multistrato', unit_cost: 2.5 }],
    })
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    const res = await importSupplierItemsAction(LIST_ID, [
      item({ code: 'TB-20', unit_cost: 2.75 }),          // abbinata, rincarata +10%
      item({ code: 'NEW-9', description: 'Curva 90' }),  // nuova
    ], '2026-08-20')
    expect(res.error).toBeUndefined()
    expect(res.matched).toBe(1)
    expect(res.added).toBe(1)
    expect(res.increased).toBe(1)
    expect(res.avgIncreasePct).toBe(10)
    // update del costo sulla voce abbinata
    expect(updates.some((u) => u.table === 'supplier_list_items' && u.payload.unit_cost === 2.75)).toBe(true)
    // nuova scadenza del listino
    expect(updates.some((u) => u.table === 'supplier_lists' && u.payload.valid_until === '2026-08-20')).toBe(true)
    // solo la voce NUOVA viene inserita
    const itemInserts = inserted.filter((i) => i.table === 'supplier_list_items')
    expect(itemInserts).toHaveLength(1)
    expect((itemInserts[0]!.rows as Array<{ description: string }>)[0]!.description).toBe('Curva 90')
  })
})

describe('createSupplierListAction', () => {
  it('piano Free → errore Pro senza insert', async () => {
    const { supabase, inserted } = buildClient({ plan: 'free' })
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    const fd = new FormData()
    fd.set('name', 'Idrotermica Rossi')
    const res = await createSupplierListAction(fd)
    expect(res.error).toMatch(/Pro/)
    expect(inserted).toHaveLength(0)
  })

  it('nome mancante → messaggio in italiano', async () => {
    const { supabase } = buildClient()
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    const res = await createSupplierListAction(new FormData())
    expect(res.error).toBe('Il nome del fornitore è obbligatorio')
  })
})
