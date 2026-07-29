// ── Mocks (hoistati da Vitest prima degli import) ──────────────────────────
import { vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/geocode', () => ({ geocodeCity: vi.fn() }))
vi.mock('@/lib/marketplace/vies', () => ({ checkViesVat: vi.fn() }))

import { describe, it, expect, beforeEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { geocodeCity } from '@/lib/geocode'
import { saveMarketplaceProfileAction } from '@/lib/actions/marketplace'

// Il "Salvataggio non riuscito" di Eli (29 lug): la 045 dà al client utente
// i permessi COLONNA PER COLONNA su marketplace_profiles, la 055 ha aggiunto
// lat/lng dopo → l'upsert utente che le includeva falliva con permission
// denied ogni volta che la geocodifica del comune riusciva. Le coordinate
// ora viaggiano SOLO con l'admin client, best-effort.

function buildUserClient(upsertResult: { error: unknown } = { error: null }) {
  const upserts: Array<Record<string, unknown>> = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    maybeSingle: () => Promise.resolve({ data: { id: 'ws-1', piva: '12345678903', plan: 'pro' } }),
    upsert: (payload: Record<string, unknown>) => {
      upserts.push(payload)
      return Promise.resolve(upsertResult)
    },
  }
  const supabase = {
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1', email_confirmed_at: 'x' } } }) },
    from: () => chain,
  }
  return { supabase, upserts }
}

function buildAdminClient(updateResult: { error: unknown } = { error: null }) {
  const updates: Array<Record<string, unknown>> = []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {
    update: (arg: Record<string, unknown>) => { updates.push(arg); return chain },
    eq: () => Promise.resolve(updateResult),
  }
  return { admin: { from: () => chain }, updates }
}

const formData = () => {
  const fd = new FormData()
  fd.set('public_name', 'Eli Impianti')
  fd.set('trade', 'Idraulico')
  fd.set('city', 'Milano')
  fd.set('phone', '333 1234567')
  return fd
}

beforeEach(() => { vi.clearAllMocks() })

describe('saveMarketplaceProfileAction — coordinate fuori dalla scrittura utente', () => {
  it('l\'upsert del client utente NON contiene mai lat/lng (grant 045)', async () => {
    const { supabase, upserts } = buildUserClient()
    const { admin } = buildAdminClient()
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)
    vi.mocked(geocodeCity).mockResolvedValue({ lat: 45.46, lng: 9.19 })

    const res = await saveMarketplaceProfileAction(formData())
    expect(res).toBeNull()
    expect(upserts).toHaveLength(1)
    expect(upserts[0]).not.toHaveProperty('lat')
    expect(upserts[0]).not.toHaveProperty('lng')
  })

  it('le coordinate arrivano via ADMIN client quando la geocodifica riesce', async () => {
    const { supabase } = buildUserClient()
    const { admin, updates } = buildAdminClient()
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)
    vi.mocked(geocodeCity).mockResolvedValue({ lat: 45.46, lng: 9.19 })

    await saveMarketplaceProfileAction(formData())
    expect(updates).toHaveLength(1)
    expect(updates[0]).toMatchObject({ lat: 45.46, lng: 9.19 })
  })

  it('admin client che ESPLODE: il profilo resta salvato lo stesso', async () => {
    const { supabase, upserts } = buildUserClient()
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    vi.mocked(createAdminClient).mockImplementation(() => { throw new Error('env mancanti') })
    vi.mocked(geocodeCity).mockResolvedValue({ lat: 45.46, lng: 9.19 })
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await saveMarketplaceProfileAction(formData())
    expect(res).toBeNull()            // nessun errore all'utente
    expect(upserts).toHaveLength(1)   // la bozza è stata salvata
    expect(errSpy).toHaveBeenCalled() // ma il problema è nei log
  })

  it('geocodifica fallita: si salva senza coordinate, nessun errore', async () => {
    const { supabase } = buildUserClient()
    const { admin, updates } = buildAdminClient()
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)
    vi.mocked(geocodeCity).mockResolvedValue(null)

    const res = await saveMarketplaceProfileAction(formData())
    expect(res).toBeNull()
    expect(updates).toHaveLength(0)
  })

  it('upsert in errore: messaggio onesto e niente scrittura coordinate', async () => {
    const { supabase } = buildUserClient({ error: { code: '42501', message: 'permission denied' } })
    const { admin, updates } = buildAdminClient()
    vi.mocked(createClient).mockResolvedValue(supabase as never)
    vi.mocked(createAdminClient).mockReturnValue(admin as never)
    vi.mocked(geocodeCity).mockResolvedValue({ lat: 1, lng: 2 })
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await saveMarketplaceProfileAction(formData())
    expect(res?.error).toContain('Salvataggio non riuscito')
    expect(updates).toHaveLength(0)
  })
})
