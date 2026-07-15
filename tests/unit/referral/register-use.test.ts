// ── Mocks (hoistati da Vitest prima degli import) ──────────────────────────
import { vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))

// ── Import ─────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest'
import { createAdminClient } from '@/lib/supabase/admin'
import { registerReferralUse } from '@/lib/referral/register-use'

// registerReferralUse è BEST-EFFORT: non deve mai lanciare (bloccherebbe la
// registrazione). Regole: codice vuoto/inesistente → no-op; auto-invito
// (stesso workspace) → no-op; happy path → insert in referral_uses.

// ── Helper: admin client finto e configurabile ──────────────────────────────
// Sequenza di chiamate dentro registerReferralUse:
//   from('referral_codes').select('workspace_id').eq('code', X).maybeSingle()
//   from('workspaces').select('id').eq('owner_id', Y).maybeSingle()
//   from('referral_uses').insert({...})
function buildAdmin(opts: {
  refCodeRow?: { workspace_id: string } | null
  newWs?: { id: string } | null
}) {
  const inserts: Array<Record<string, unknown>> = []
  const codeLookups: string[] = []

  const client = {
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'referral_codes') {
        return {
          select: () => ({
            eq: (_col: string, val: string) => {
              codeLookups.push(val)
              return { maybeSingle: async () => ({ data: opts.refCodeRow ?? null }) }
            },
          }),
        }
      }
      if (table === 'workspaces') {
        return {
          select: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: opts.newWs ?? null }) }),
          }),
        }
      }
      if (table === 'referral_uses') {
        return {
          insert: async (row: Record<string, unknown>) => { inserts.push(row); return { error: null } },
        }
      }
      throw new Error(`tabella inattesa: ${table}`)
    }),
  }
  return { client, inserts, codeLookups }
}

beforeEach(() => { vi.mocked(createAdminClient).mockReset() })

describe('registerReferralUse', () => {
  it('codice vuoto o solo spazi → non tocca nemmeno il client', async () => {
    await registerReferralUse('   ', 'user-1')
    expect(createAdminClient).not.toHaveBeenCalled()
  })

  it('normalizza il codice (trim + maiuscolo) prima della ricerca', async () => {
    const { client, codeLookups } = buildAdmin({ refCodeRow: null })
    vi.mocked(createAdminClient).mockReturnValue(client as never)

    await registerReferralUse('  ab12cd ', 'user-1')
    expect(codeLookups).toEqual(['AB12CD'])
  })

  it('codice inesistente → nessun insert', async () => {
    const { client, inserts } = buildAdmin({ refCodeRow: null, newWs: { id: 'ws-new' } })
    vi.mocked(createAdminClient).mockReturnValue(client as never)

    await registerReferralUse('CODICE1', 'user-1')
    expect(inserts).toHaveLength(0)
  })

  it('workspace del nuovo iscritto non ancora creato → nessun insert', async () => {
    const { client, inserts } = buildAdmin({ refCodeRow: { workspace_id: 'ws-ref' }, newWs: null })
    vi.mocked(createAdminClient).mockReturnValue(client as never)

    await registerReferralUse('CODICE1', 'user-1')
    expect(inserts).toHaveLength(0)
  })

  it('auto-invito (stesso workspace del referrer) → nessun insert', async () => {
    const { client, inserts } = buildAdmin({ refCodeRow: { workspace_id: 'ws-1' }, newWs: { id: 'ws-1' } })
    vi.mocked(createAdminClient).mockReturnValue(client as never)

    await registerReferralUse('CODICE1', 'user-1')
    expect(inserts).toHaveLength(0)
  })

  it('happy path → insert con referrer, referee e codice normalizzato', async () => {
    const { client, inserts } = buildAdmin({ refCodeRow: { workspace_id: 'ws-ref' }, newWs: { id: 'ws-new' } })
    vi.mocked(createAdminClient).mockReturnValue(client as never)

    await registerReferralUse('ab12cd', 'user-1')
    expect(inserts).toEqual([{
      referrer_workspace_id: 'ws-ref',
      referee_workspace_id: 'ws-new',
      code: 'AB12CD',
    }])
  })

  it('errore interno (client che esplode) → NON propaga (best-effort)', async () => {
    vi.mocked(createAdminClient).mockImplementation(() => { throw new Error('boom') })
    await expect(registerReferralUse('CODICE1', 'user-1')).resolves.toBeUndefined()
  })
})
