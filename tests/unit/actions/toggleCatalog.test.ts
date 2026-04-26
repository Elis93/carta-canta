// ── Mocks (hoistati da Vitest prima degli import) ──────────────────────────
import { vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

// ── Import ─────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { toggleCatalogItemAction } from '@/app/(app)/catalogo/actions'

// ── Helper: costruisce un mock Supabase configurabile ──────────────────────
//
// Struttura delle chiamate dentro toggleCatalogItemAction:
//   createClient()
//   └─ auth.getUser()                                   → { data: { user } }
//   └─ from('workspaces').select('id')
//        .eq('owner_id', userId).maybeSingle()          → { data: { id: 'ws-1' } }
//   └─ from('catalog_items').update({ is_active })
//        .eq('id', itemId).eq('workspace_id', wsId)     → { error }
//
function buildMockSupabase(updateError: { message: string } | null = null) {
  const updateSpy   = vi.fn()
  const eq1Spy      = vi.fn()  // .eq('id', ...)
  const eq2Spy      = vi.fn().mockResolvedValue({ error: updateError }) // .eq('workspace_id', ...)

  eq1Spy.mockReturnValue({ eq: eq2Spy })
  updateSpy.mockReturnValue({ eq: eq1Spy })

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'ws-1' } }),
            }),
          }),
        }
      }
      // catalog_items
      return { update: updateSpy }
    }),
  }

  return { client, updateSpy, eq1Spy, eq2Spy }
}

// ── Suite ──────────────────────────────────────────────────────────────────
describe('toggleCatalogItemAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ── Path di successo ───────────────────────────────────────────────────

  it('ritorna { success: true } quando il DB update va a buon fine', async () => {
    const { client } = buildMockSupabase(null)
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await toggleCatalogItemAction('item-1', true)

    expect(result).toEqual({ success: true })
  })

  it('chiama revalidatePath("/catalogo") dopo un update riuscito', async () => {
    const { client } = buildMockSupabase(null)
    vi.mocked(createClient).mockResolvedValue(client as never)

    await toggleCatalogItemAction('item-1', true)

    expect(revalidatePath).toHaveBeenCalledOnce()
    expect(revalidatePath).toHaveBeenCalledWith('/catalogo')
  })

  // ── Path di errore ─────────────────────────────────────────────────────

  it('ritorna { error } quando il DB update fallisce', async () => {
    const { client } = buildMockSupabase({ message: 'violazione RLS' })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await toggleCatalogItemAction('item-1', true)

    expect(result).toEqual({ error: 'Errore aggiornamento voce catalogo' })
  })

  it('NON chiama revalidatePath se il DB update fallisce', async () => {
    const { client } = buildMockSupabase({ message: 'violazione RLS' })
    vi.mocked(createClient).mockResolvedValue(client as never)

    await toggleCatalogItemAction('item-1', true)

    expect(revalidatePath).not.toHaveBeenCalled()
  })

  // ── Valori passati al DB ───────────────────────────────────────────────

  it('passa is_active=true correttamente all\'update', async () => {
    const { client, updateSpy } = buildMockSupabase(null)
    vi.mocked(createClient).mockResolvedValue(client as never)

    await toggleCatalogItemAction('item-1', true)

    expect(updateSpy).toHaveBeenCalledWith({ is_active: true })
  })

  it('passa is_active=false correttamente all\'update', async () => {
    const { client, updateSpy } = buildMockSupabase(null)
    vi.mocked(createClient).mockResolvedValue(client as never)

    await toggleCatalogItemAction('item-1', false)

    expect(updateSpy).toHaveBeenCalledWith({ is_active: false })
  })

  // ── Filtri WHERE ───────────────────────────────────────────────────────

  it('filtra per id corretto', async () => {
    const { client, eq1Spy } = buildMockSupabase(null)
    vi.mocked(createClient).mockResolvedValue(client as never)

    await toggleCatalogItemAction('item-xyz', true)

    expect(eq1Spy).toHaveBeenCalledWith('id', 'item-xyz')
  })

  it('filtra per workspace_id dell\'utente autenticato', async () => {
    const { client, eq2Spy } = buildMockSupabase(null)
    vi.mocked(createClient).mockResolvedValue(client as never)

    await toggleCatalogItemAction('item-xyz', true)

    // ws-1 è l'id restituito dal mock getWorkspace
    expect(eq2Spy).toHaveBeenCalledWith('workspace_id', 'ws-1')
  })
})
