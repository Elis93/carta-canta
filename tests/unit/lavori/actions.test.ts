// ── Mocks (hoistati da Vitest prima degli import) ──────────────────────────
import { vi } from 'vitest'

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

// ── Import ─────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createClient } from '@/lib/supabase/server'
import {
  setRecallAction,
  startTimerAction,
  stopTimerAction,
  addLaborMinutesAction,
} from '@/lib/actions/lavori'

// Le azioni di richiamo/ore (migration 052) hanno guardie precise emerse dal
// QA del 14 lug: rowcount verificato (niente falsi "salvato"), timer in corso
// che blocca la correzione manuale, clamp a zero, anti doppio start.

// ── Helper: client Supabase finto a catena "registra tutto" ────────────────
// Ogni metodo di query ritorna la stessa catena; il risultato del PROSSIMO
// await (o maybeSingle) esce da una coda `results`, in ordine.
// getWorkspace() dentro lavori.ts consuma il primo risultato (workspaces).
interface Call { method: string; args: unknown[] }
function buildSupabase(results: Array<{ data?: unknown; error?: unknown; count?: number }>, user: { id: string } | null = { id: 'user-1' }) {
  const calls: Call[] = []
  const queue = [...results]
  const next = () => queue.shift() ?? { data: null, error: null }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain: any = {}
  for (const m of ['select', 'update', 'insert', 'eq', 'neq', 'is', 'not', 'limit', 'order']) {
    chain[m] = (...args: unknown[]) => { calls.push({ method: m, args }); return chain }
  }
  chain.maybeSingle = () => { calls.push({ method: 'maybeSingle', args: [] }); return Promise.resolve(next()) }
  // La catena è "thenable": un await su di essa consuma il prossimo risultato
  chain.then = (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
    Promise.resolve(next()).then(res, rej)

  const client = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: (table: string) => { calls.push({ method: 'from', args: [table] }); return chain },
  }
  return { client, calls }
}

function updatePayload(calls: Call[]): Record<string, unknown> | undefined {
  return calls.find((c) => c.method === 'update')?.args[0] as Record<string, unknown> | undefined
}

const WS = { data: { id: 'ws-1' }, error: null } // risultato di getWorkspace()

beforeEach(() => { vi.mocked(createClient).mockReset() })
afterEach(() => { vi.useRealTimers() })

// ── setRecallAction ─────────────────────────────────────────────────────────
describe('setRecallAction', () => {
  it('senza sessione → errore chiaro, niente query', async () => {
    const { client } = buildSupabase([], null)
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await setRecallAction('lav-1', '2026-10-01')
    expect(res?.error).toMatch(/Sessione scaduta/)
  })

  it('data malformata → "Data non valida" (es. mese 13)', async () => {
    const { client } = buildSupabase([WS])
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await setRecallAction('lav-1', '2026-13-99')
    expect(res?.error).toBe('Data non valida.')
  })

  it('imposta il promemoria alle 08:00 di Roma e tronca la nota a 300 caratteri', async () => {
    const { client, calls } = buildSupabase([WS, { data: [{ id: 'lav-1' }], error: null }])
    vi.mocked(createClient).mockResolvedValue(client as never)

    const notaLunga = 'x'.repeat(400)
    const res = await setRecallAction('lav-1', '2026-10-01', notaLunga)
    expect(res?.success).toBe('Promemoria impostato')

    const payload = updatePayload(calls)!
    // Ottobre (ora legale): Roma = UTC+2 → l'ISO porta l'offset locale
    expect(payload.recall_at).toMatch(/^2026-10-01T08:00:00\+02:00$/)
    expect((payload.recall_note as string).length).toBe(300)
  })

  it('data null → rimuove promemoria e nota', async () => {
    const { client, calls } = buildSupabase([WS, { data: [{ id: 'lav-1' }], error: null }])
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await setRecallAction('lav-1', null, 'nota che va ignorata')
    expect(res?.success).toBe('Promemoria rimosso')
    const payload = updatePayload(calls)!
    expect(payload.recall_at).toBeNull()
    expect(payload.recall_note).toBeNull()
  })

  it('zero righe aggiornate (lavoro eliminato altrove) → NON dichiara "impostato"', async () => {
    const { client } = buildSupabase([WS, { data: [], error: null }])
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await setRecallAction('lav-1', '2026-10-01')
    expect(res?.error).toMatch(/Lavoro non trovato/)
  })

  it('colonna mancante (pre-migration 052) → messaggio dedicato', async () => {
    const { client } = buildSupabase([WS, { data: null, error: { code: '42703', message: 'column recall_at does not exist' } }])
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await setRecallAction('lav-1', '2026-10-01')
    expect(res?.error).toMatch(/migration 052/)
  })
})

// ── startTimerAction ────────────────────────────────────────────────────────
describe('startTimerAction', () => {
  it('avvia il timer (update condizionale su timer_started_at IS NULL)', async () => {
    const { client, calls } = buildSupabase([WS, { data: [{ id: 'lav-1' }], error: null }])
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await startTimerAction('lav-1')
    expect(res?.success).toBe('Timer avviato')
    // La guardia anti doppio-start deve essere nella query
    expect(calls.some((c) => c.method === 'is' && c.args[0] === 'timer_started_at' && c.args[1] === null)).toBe(true)
  })

  it('timer già in corso (zero righe) → errore, niente falso avvio', async () => {
    const { client } = buildSupabase([WS, { data: [], error: null }])
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await startTimerAction('lav-1')
    expect(res?.error).toMatch(/già in corso/)
  })
})

// ── stopTimerAction ─────────────────────────────────────────────────────────
describe('stopTimerAction', () => {
  it('nessun timer in corso → errore', async () => {
    const { client } = buildSupabase([WS, { data: { timer_started_at: null, labor_minutes: 30 }, error: null }])
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await stopTimerAction('lav-1')
    expect(res?.error).toBe('Nessun timer in corso.')
  })

  it('somma i minuti trascorsi al totale e azzera il timer', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T10:00:00Z'))
    const startedAt = '2026-07-15T09:35:00Z' // 25 minuti fa
    const { client, calls } = buildSupabase([
      WS,
      { data: { timer_started_at: startedAt, labor_minutes: 100 }, error: null },
      { data: null, error: null }, // update finale
    ])
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await stopTimerAction('lav-1')
    expect(res?.success).toBe('Timer fermato')
    const payload = updatePayload(calls)!
    expect(payload.labor_minutes).toBe(125)
    expect(payload.timer_started_at).toBeNull()
  })

  it('start/stop immediato → conta comunque ALMENO 1 minuto', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T10:00:05Z'))
    const { client, calls } = buildSupabase([
      WS,
      { data: { timer_started_at: '2026-07-15T10:00:00Z', labor_minutes: 0 }, error: null },
      { data: null, error: null },
    ])
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await stopTimerAction('lav-1')
    expect(res?.success).toBe('Timer fermato')
    expect(updatePayload(calls)!.labor_minutes).toBe(1)
  })
})

// ── addLaborMinutesAction ───────────────────────────────────────────────────
describe('addLaborMinutesAction', () => {
  it.each([
    [0, 'zero'],
    [Number.NaN, 'NaN'],
    [24 * 60 * 30 + 1, 'oltre il tetto'],
  ])('input non valido (%s, %s) → errore senza query', async (minutes) => {
    const res = await addLaborMinutesAction('lav-1', minutes as number)
    expect(res?.error).toBe('Inserisci un numero di ore valido.')
    expect(createClient).not.toHaveBeenCalled()
  })

  it('timer in corso → chiede di fermarlo prima (niente correzione parziale)', async () => {
    const { client } = buildSupabase([
      WS,
      { data: { labor_minutes: 60, timer_started_at: '2026-07-15T09:00:00Z' }, error: null },
    ])
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await addLaborMinutesAction('lav-1', -30)
    expect(res?.error).toBe('Ferma il timer prima di correggere le ore a mano.')
  })

  it('correzione negativa oltre il totale → clamp a 0 (mai sotto zero)', async () => {
    const { client, calls } = buildSupabase([
      WS,
      { data: { labor_minutes: 45, timer_started_at: null }, error: null },
      { data: null, error: null },
    ])
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await addLaborMinutesAction('lav-1', -120)
    expect(res?.success).toBe('Ore aggiornate')
    expect(updatePayload(calls)!.labor_minutes).toBe(0)
  })

  it('aggiunta positiva → somma al totale persistito', async () => {
    const { client, calls } = buildSupabase([
      WS,
      { data: { labor_minutes: 45, timer_started_at: null }, error: null },
      { data: null, error: null },
    ])
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await addLaborMinutesAction('lav-1', 90)
    expect(res?.success).toBe('Ore aggiornate')
    expect(updatePayload(calls)!.labor_minutes).toBe(135)
  })

  it('lavoro inesistente → errore', async () => {
    const { client } = buildSupabase([WS, { data: null, error: null }])
    vi.mocked(createClient).mockResolvedValue(client as never)

    const res = await addLaborMinutesAction('lav-1', 30)
    expect(res?.error).toBe('Lavoro non trovato.')
  })
})
