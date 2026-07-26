// ── Mocks (hoistati da Vitest prima degli import) ──────────────────────────
import { vi } from 'vitest'

const constructEvent = vi.fn()
vi.mock('@/lib/stripe/stripe', () => ({
  getStripe: () => ({ webhooks: { constructEvent } }),
  planFromPriceId: () => 'pro',
}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/email/send', () => ({ sendEmail: vi.fn() }))

// ── Import ─────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest'
import { createAdminClient } from '@/lib/supabase/admin'
import { POST } from '@/app/api/webhooks/stripe/route'

// Congela la deduplica degli eventi Stripe (migration 060) e — soprattutto —
// la sua rete di sicurezza: se l'elaborazione fallisce, la riga di dedup va
// RIMOSSA, altrimenti il retry di Stripe verrebbe scambiato per un doppione
// e l'evento andrebbe perso per sempre (utente pagante lasciato su Free).

interface Op { table: string; op: string; arg?: unknown }

function buildAdmin(opts: {
  insertError?: { code: string } | null
  updateError?: { message: string } | null
  /** riga già presente nel registro (per i casi di retry) */
  existing?: { status: string; started_at: string } | null
  /** lettura del registro in errore (blip di rete) */
  existingError?: { code: string } | null
  /** ripresa della prenotazione appesa in errore */
  claimError?: { code: string } | null
} = {}) {
  const ops: Op[] = []
  const make = (table: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      insert: (arg: unknown) => {
        ops.push({ table, op: 'insert', arg })
        return Promise.resolve({ error: opts.insertError ?? null })
      },
      delete: () => { ops.push({ table, op: 'delete' }); return chain },
      update: (arg: unknown) => { ops.push({ table, op: 'update', arg }); return chain },
      select: () => chain,
      or: () => chain,
      eq: (col: string, val: unknown) => { ops.push({ table, op: 'eq', arg: [col, val] }); return chain },
      neq: () => chain,
      maybeSingle: () => Promise.resolve(
        table === 'stripe_webhook_events'
          ? { data: opts.existingError ? null : (opts.existing ?? null), error: opts.existingError ?? null }
          : { data: { id: 'ws-1' }, error: null }
      ),
      then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
        Promise.resolve(
          table === 'stripe_webhook_events'
            ? { data: opts.claimError ? null : [{ event_id: 'evt' }], error: opts.claimError ?? null }
            : { data: null, error: opts.updateError ?? null }
        ).then(res, rej),
    }
    return chain
  }
  return { admin: { from: (t: string) => make(t) }, ops }
}

const req = (): Parameters<typeof POST>[0] => ({
  text: async () => '{}',
  headers: { get: () => 'sig' },
} as unknown as Parameters<typeof POST>[0])

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test')
})

describe('POST /api/webhooks/stripe — deduplica eventi (060)', () => {
  it('evento NUOVO: viene registrato e poi elaborato', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_1', type: 'customer.subscription.deleted', created: 1_700_000_000,
      data: { object: { id: 'sub_1', customer: 'cus_1' } },
    })
    const { admin, ops } = buildAdmin()
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ received: true })
    // l'event.id è stato registrato
    expect(ops.some((o) => o.table === 'stripe_webhook_events' && o.op === 'insert')).toBe(true)
  })

  it('RETRY dello stesso evento (23505): ignorato, nessuna rielaborazione', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_1', type: 'customer.subscription.deleted', created: 1_700_000_000,
      data: { object: { id: 'sub_1', customer: 'cus_1' } },
    })
    const { admin, ops } = buildAdmin({
      insertError: { code: '23505' },
      existing: { status: 'done', started_at: new Date().toISOString() },
    })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ duplicate: true })
    // nessun update sui workspaces: l'evento non è stato rielaborato
    expect(ops.some((o) => o.table === 'workspaces' && o.op === 'update')).toBe(false)
  })

  it('elaborazione FALLITA: la riga di dedup viene rimossa (il retry deve funzionare)', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_2', type: 'customer.subscription.deleted', created: 1_700_000_000,
      data: { object: { id: 'sub_2', customer: 'cus_2' } },
    })
    // update del workspace in errore → l'handler lancia
    const { admin, ops } = buildAdmin({ updateError: { message: 'boom' } })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const res = await POST(req())
    expect(res.status).toBe(500) // Stripe ritenterà
    // ⚠️ il punto chiave: la riga di dedup è stata cancellata
    expect(ops.some((o) => o.table === 'stripe_webhook_events' && o.op === 'delete')).toBe(true)
  })

  it('prenotazione APPESA (lambda morta): l\'evento viene ripreso, non perso', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_hang', type: 'customer.subscription.deleted', created: 1_700_000_000,
      data: { object: { id: 'sub_h', customer: 'cus_h' } },
    })
    const { admin, ops } = buildAdmin({
      insertError: { code: '23505' },
      // 'processing' da 30 minuti = la lambda precedente è morta
      existing: { status: 'processing', started_at: new Date(Date.now() - 30 * 60_000).toISOString() },
    })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const res = await POST(req())
    expect(res.status).toBe(200)
    // l'evento è stato RIELABORATO (update sul workspace), non scartato
    expect(ops.some((o) => o.table === 'workspaces' && o.op === 'update')).toBe(true)
  })

  it('elaborazione in CORSO da un\'altra esecuzione: 409, niente lavoro in parallelo', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_busy', type: 'customer.subscription.deleted', created: 1_700_000_000,
      data: { object: { id: 'sub_b', customer: 'cus_b' } },
    })
    const { admin, ops } = buildAdmin({
      insertError: { code: '23505' },
      existing: { status: 'processing', started_at: new Date().toISOString() },
    })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const res = await POST(req())
    expect(res.status).toBe(409)
    expect(ops.some((o) => o.table === 'workspaces' && o.op === 'update')).toBe(false)
  })

  it('la ripresa è condizionata allo started_at letto (niente doppia elaborazione)', async () => {
    const started = new Date(Date.now() - 30 * 60_000).toISOString()
    constructEvent.mockReturnValue({
      id: 'evt_lock', type: 'customer.subscription.deleted', created: 1_700_000_000,
      data: { object: { id: 'sub_l', customer: 'cus_l' } },
    })
    const { admin, ops } = buildAdmin({
      insertError: { code: '23505' },
      existing: { status: 'processing', started_at: started },
    })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    await POST(req())
    // ⚠️ senza questa condizione due retry sulla stessa prenotazione scaduta
    // vincono ENTRAMBI la ripresa (verificato su Postgres 16).
    expect(ops.some((o) =>
      o.table === 'stripe_webhook_events' && o.op === 'eq' &&
      Array.isArray(o.arg) && o.arg[0] === 'started_at' && o.arg[1] === started
    )).toBe(true)
  })

  it('registro ILLEGGIBILE sul retry: 409, l\'evento non viene scartato', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_blip', type: 'customer.subscription.deleted', created: 1_700_000_000,
      data: { object: { id: 'sub_x', customer: 'cus_x' } },
    })
    const { admin, ops } = buildAdmin({
      insertError: { code: '23505' },
      existingError: { code: '08006' }, // blip di rete sulla lettura
    })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const res = await POST(req())
    // ⚠️ 200 "duplicate" qui perderebbe l'evento PER SEMPRE
    expect(res.status).toBe(409)
    expect(ops.some((o) => o.table === 'workspaces' && o.op === 'update')).toBe(false)
  })

  it('ripresa della prenotazione in ERRORE: 409, non scambiata per doppione', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_claimfail', type: 'customer.subscription.deleted', created: 1_700_000_000,
      data: { object: { id: 'sub_y', customer: 'cus_y' } },
    })
    const { admin } = buildAdmin({
      insertError: { code: '23505' },
      existing: { status: 'processing', started_at: new Date(Date.now() - 30 * 60_000).toISOString() },
      claimError: { code: '08006' },
    })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const res = await POST(req())
    expect(res.status).toBe(409)
  })

  it('tabella assente (pre-060, 42P01): si prosegue senza deduplica', async () => {
    constructEvent.mockReturnValue({
      id: 'evt_3', type: 'customer.subscription.deleted', created: 1_700_000_000,
      data: { object: { id: 'sub_3', customer: 'cus_3' } },
    })
    const { admin } = buildAdmin({ insertError: { code: '42P01' } })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const res = await POST(req())
    expect(res.status).toBe(200) // comportamento invariato rispetto a prima
  })

  it('firma non valida → 400, nessun accesso al database', async () => {
    constructEvent.mockImplementation(() => { throw new Error('bad signature') })
    const { admin, ops } = buildAdmin()
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const res = await POST(req())
    expect(res.status).toBe(400)
    expect(ops.length).toBe(0)
  })
})
