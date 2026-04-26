// ── Mocks (hoistati da Vitest prima degli import) ──────────────────────────
import { vi } from 'vitest'

vi.mock('next/cache',      () => ({ revalidatePath: vi.fn() }))
vi.mock('next/navigation', () => ({ redirect: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn() }))

// ── Import ─────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest'
import { revalidatePath } from 'next/cache'
import { redirect }       from 'next/navigation'
import { createClient }   from '@/lib/supabase/server'
import {
  createClientAction,
  updateClientAction,
} from '@/lib/actions/clients'

// ── Helper: FormData con valori validi di default ─────────────────────────
function makeFormData(overrides: Partial<Record<string, string>> = {}): FormData {
  const fd = new FormData()
  const defaults: Record<string, string> = {
    name:           'Mario Rossi',
    email:          '',
    phone:          '',
    piva:           '',
    codice_fiscale: '',
    indirizzo:      '',
    cap:            '',
    citta:          '',
    provincia:      '',
    paese:          'IT',
    notes:          '',
    ...overrides,
  }
  Object.entries(defaults).forEach(([k, v]) => fd.append(k, v))
  return fd
}

// ── Helper: mock Supabase configurabile ───────────────────────────────────
//
// createClient() viene chiamato DUE volte per action:
//   1. nel corpo dell'action → auth.getUser() + from('clients')
//   2. dentro getWorkspaceId() → auth.getUser() + from('workspaces')
// mockResolvedValue restituisce lo stesso client per entrambe le chiamate.
//
// Struttura catene:
//   INSERT: .from('clients').insert({}).select('id').single()
//   UPDATE: .from('clients').update({}).eq(clientId).eq(workspaceId)
//   WS:     .from('workspaces').select('id').eq('owner_id', uid).maybeSingle()
//
function buildClient(opts: {
  user?:         { id: string } | null
  workspaceId?:  string | null
  insertResult?: { data: { id: string } | null; error: { message: string } | null }
  updateResult?: { error: { message: string } | null }
} = {}) {
  const {
    user          = { id: 'user-1' },
    workspaceId   = 'ws-1',
    insertResult  = { data: { id: 'client-new' }, error: null },
    updateResult  = { error: null },
  } = opts

  // insert chain
  const insertSpy = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue(insertResult),
    }),
  })

  // update chain
  const updateSpy = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue(updateResult),
    }),
  })

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user } }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'workspaces') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: workspaceId ? { id: workspaceId } : null,
              }),
            }),
          }),
        }
      }
      // clients
      return { insert: insertSpy, update: updateSpy }
    }),
  }

  return { client, insertSpy, updateSpy }
}

// ── createClientAction ────────────────────────────────────────────────────
describe('createClientAction', () => {
  beforeEach(() => vi.clearAllMocks())

  // Guard auth / workspace

  it('ritorna errore se utente non autenticato', async () => {
    const { client } = buildClient({ user: null })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createClientAction(null, makeFormData())
    expect(result).toEqual({ error: 'Non autenticato.' })
  })

  it('ritorna errore se workspace non trovato', async () => {
    const { client } = buildClient({ workspaceId: null })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createClientAction(null, makeFormData())
    expect(result).toEqual({ error: 'Workspace non trovato.' })
  })

  // Validazione Zod

  it('ritorna errore se nome mancante (null → stringa vuota)', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)
    const fd = makeFormData({ name: '' })

    const result = await createClientAction(null, fd)
    expect(result?.error).toBeTruthy()
  })

  it('ritorna errore se nome < 2 caratteri', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createClientAction(null, makeFormData({ name: 'A' }))
    expect(result).toEqual({ error: 'Il nome deve essere di almeno 2 caratteri' })
  })

  it('ritorna errore se email non valida', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createClientAction(null, makeFormData({ email: 'non-una-email' }))
    expect(result).toEqual({ error: 'Email non valida' })
  })

  it('ritorna errore se P.IVA non è 11 cifre', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createClientAction(null, makeFormData({ piva: '123' }))
    expect(result).toEqual({ error: 'P.IVA: 11 cifre senza prefisso IT' })
  })

  it('ritorna errore se CAP non è 5 cifre', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createClientAction(null, makeFormData({ cap: '201' }))
    expect(result).toEqual({ error: 'CAP: 5 cifre' })
  })

  it('ritorna errore se codice fiscale non è 16 caratteri alfanumerici', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createClientAction(null, makeFormData({ codice_fiscale: 'CORTO' }))
    expect(result).toEqual({ error: 'Codice fiscale non valido' })
  })

  // Errore DB

  it('ritorna errore se insert DB fallisce', async () => {
    const { client } = buildClient({
      insertResult: { data: null, error: { message: 'db error' } },
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createClientAction(null, makeFormData())
    expect(result).toEqual({ error: 'Errore nel salvataggio del cliente. Riprova.' })
  })

  // Successo

  it('chiama redirect verso /clienti/<id> dopo insert riuscito', async () => {
    const { client } = buildClient({
      insertResult: { data: { id: 'client-abc' }, error: null },
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    await createClientAction(null, makeFormData())

    expect(redirect).toHaveBeenCalledWith('/clienti/client-abc')
  })

  it('chiama revalidatePath dopo insert riuscito', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    await createClientAction(null, makeFormData())

    expect(revalidatePath).toHaveBeenCalledWith('/(app)/clienti', 'page')
  })

  it('passa workspace_id corretto all\'insert', async () => {
    const { client, insertSpy } = buildClient({ workspaceId: 'ws-xyz' })
    vi.mocked(createClient).mockResolvedValue(client as never)

    await createClientAction(null, makeFormData())

    expect(insertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ workspace_id: 'ws-xyz' })
    )
  })

  it('accetta P.IVA valida da 11 cifre', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    await createClientAction(null, makeFormData({ piva: '12345678901' }))

    expect(redirect).toHaveBeenCalled()
  })

  it('accetta email vuota (campo opzionale)', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    await createClientAction(null, makeFormData({ email: '' }))

    expect(redirect).toHaveBeenCalled()
  })
})

// ── updateClientAction ────────────────────────────────────────────────────
describe('updateClientAction', () => {
  beforeEach(() => vi.clearAllMocks())

  const CLIENT_ID = 'client-123'

  // Guard auth / workspace

  it('ritorna errore se utente non autenticato', async () => {
    const { client } = buildClient({ user: null })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await updateClientAction(CLIENT_ID, null, makeFormData())
    expect(result).toEqual({ error: 'Non autenticato.' })
  })

  it('ritorna errore se workspace non trovato', async () => {
    const { client } = buildClient({ workspaceId: null })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await updateClientAction(CLIENT_ID, null, makeFormData())
    expect(result).toEqual({ error: 'Workspace non trovato.' })
  })

  // Validazione Zod

  it('ritorna errore se nome < 2 caratteri', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await updateClientAction(CLIENT_ID, null, makeFormData({ name: 'X' }))
    expect(result).toEqual({ error: 'Il nome deve essere di almeno 2 caratteri' })
  })

  it('ritorna errore se codice fiscale non valido', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await updateClientAction(
      CLIENT_ID, null, makeFormData({ codice_fiscale: 'TROPPO_CORTO' })
    )
    expect(result).toEqual({ error: 'Codice fiscale non valido' })
  })

  it('ritorna errore se provincia non è 2 lettere', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await updateClientAction(
      CLIENT_ID, null, makeFormData({ provincia: 'MIL' })
    )
    expect(result).toEqual({ error: 'Sigla provincia: 2 lettere' })
  })

  // Errore DB

  it('ritorna errore se update DB fallisce', async () => {
    const { client } = buildClient({
      updateResult: { error: { message: 'constraint' } },
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await updateClientAction(CLIENT_ID, null, makeFormData())
    expect(result).toEqual({ error: 'Errore nel salvataggio. Riprova.' })
  })

  // Successo

  it('ritorna { success } dopo update riuscito', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await updateClientAction(CLIENT_ID, null, makeFormData())
    expect(result).toEqual({ success: 'Cliente aggiornato.' })
  })

  it('chiama revalidatePath per la pagina lista e per il cliente', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    await updateClientAction(CLIENT_ID, null, makeFormData())

    expect(revalidatePath).toHaveBeenCalledWith(`/clienti/${CLIENT_ID}`)
    expect(revalidatePath).toHaveBeenCalledWith('/(app)/clienti', 'page')
  })

  it('passa clientId e workspaceId corretti ai filtri eq', async () => {
    const { client, updateSpy } = buildClient({ workspaceId: 'ws-xyz' })
    vi.mocked(createClient).mockResolvedValue(client as never)

    await updateClientAction('client-abc', null, makeFormData())

    // Il primo .eq() riceve clientId
    const firstEq = updateSpy.mock.results[0].value.eq
    expect(firstEq).toHaveBeenCalledWith('id', 'client-abc')

    // Il secondo .eq() riceve workspaceId
    const secondEq = firstEq.mock.results[0].value.eq
    expect(secondEq).toHaveBeenCalledWith('workspace_id', 'ws-xyz')
  })
})
