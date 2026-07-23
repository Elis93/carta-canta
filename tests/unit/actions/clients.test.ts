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
    // Email o telefono obbligatori (sessione 23) — di default un contatto valido
    email:          'cliente@esempio.it',
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
//   UPDATE: .from('clients').update({}).eq(clientId).eq(workspaceId).select('id')
//   WS:     .from('workspaces').select('id').eq('owner_id', uid).maybeSingle()
//
function buildClient(opts: {
  user?:         { id: string } | null
  workspaceId?:  string | null
  insertResult?: { data: { id: string } | null; error: { message: string } | null }
  updateResult?: { data?: Array<{ id: string }> | null; error: { message: string } | null }
} = {}) {
  const {
    user          = { id: 'user-1' },
    workspaceId   = 'ws-1',
    insertResult  = { data: { id: 'client-new' }, error: null },
    // .select('id') post-update: di default 1 riga toccata (guardia rowcount #14)
    updateResult  = { data: [{ id: 'client-1' }], error: null },
  } = opts

  // insert chain
  const insertSpy = vi.fn().mockReturnValue({
    select: vi.fn().mockReturnValue({
      single: vi.fn().mockResolvedValue(insertResult),
    }),
  })

  // update chain — .eq().eq().select('id') (guardia rowcount #14); l'await
  // diretto dopo il secondo eq resta supportato (thenable) per robustezza.
  const updateSpy = vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue(updateResult),
        then: (resolve: (v: unknown) => void) => resolve(updateResult),
      }),
    }),
  })

  // Catena "nessun duplicato" per il rilevamento duplicati di createClientAction.
  // Supporta .eq().or().ilike().limit().maybeSingle() e l'await diretto della catena.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function noDupSelectChain(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const chain: any = {
      eq:         vi.fn(() => chain),
      or:         vi.fn(() => chain),
      ilike:      vi.fn(() => chain),
      not:        vi.fn(() => chain),
      limit:      vi.fn(() => chain),
      maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      // thenable: `await chain` (query nome con .limit(10) senza maybeSingle) → array vuoto
      then: (resolve: (v: { data: unknown[] }) => void) => resolve({ data: [] }),
    }
    return chain
  }

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
      // clients: select (per duplicati) + insert + update
      return {
        select: vi.fn(() => noDupSelectChain()),
        insert: insertSpy,
        update: updateSpy,
      }
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

  it('ritorna errore se nome mancante (vuoto)', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createClientAction(null, makeFormData({ name: '' }))
    expect(result).toEqual({ error: 'Il nome / ragione sociale è obbligatorio.' })
  })

  it('ritorna errore se manca sia email che telefono', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createClientAction(null, makeFormData({ email: '', phone: '' }))
    expect(result).toEqual({ error: 'Inserisci almeno un contatto: email o telefono.' })
  })

  // softValidate è LENIENTE: i campi opzionali con formato errato vengono
  // azzerati con un avviso, non bloccano il salvataggio (sessione pre-24).

  it('email non valida → stripped, cliente creato comunque', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    // phone valido garantisce che il contatto non sia vuoto dopo lo strip dell'email
    const result = await createClientAction(null, makeFormData({ email: 'non-una-email', phone: '3331234567' }))
    expect(result).toMatchObject({ success: 'created' })
  })

  it('P.IVA non valida → stripped, cliente creato comunque', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createClientAction(null, makeFormData({ piva: '123' }))
    expect(result).toMatchObject({ success: 'created' })
  })

  it('CAP non valido → stripped, cliente creato comunque', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createClientAction(null, makeFormData({ cap: '201' }))
    expect(result).toMatchObject({ success: 'created' })
  })

  it('codice fiscale non valido → stripped, cliente creato comunque', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createClientAction(null, makeFormData({ codice_fiscale: 'CORTO' }))
    expect(result).toMatchObject({ success: 'created' })
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

  it('ritorna { success: created, clientId } dopo insert riuscito', async () => {
    const { client } = buildClient({
      insertResult: { data: { id: 'client-abc' }, error: null },
    })
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createClientAction(null, makeFormData())
    expect(result).toMatchObject({ success: 'created', clientId: 'client-abc' })
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

    const result = await createClientAction(null, makeFormData({ piva: '12345678901' }))
    expect(result).toMatchObject({ success: 'created' })
  })

  it('accetta cliente con solo telefono (email vuota)', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await createClientAction(null, makeFormData({ email: '', phone: '3331234567' }))
    expect(result).toMatchObject({ success: 'created' })
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

  // Validazione soft (leniente)

  it('ritorna errore se nome vuoto', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await updateClientAction(CLIENT_ID, null, makeFormData({ name: '' }))
    expect(result).toEqual({ error: 'Il nome / ragione sociale è obbligatorio.' })
  })

  it('codice fiscale non valido → stripped, update riuscito', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await updateClientAction(
      CLIENT_ID, null, makeFormData({ codice_fiscale: 'TROPPO_CORTO' })
    )
    expect(result).toMatchObject({ success: 'updated' })
  })

  it('provincia non valida → stripped, update riuscito', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await updateClientAction(
      CLIENT_ID, null, makeFormData({ provincia: 'MIL' })
    )
    expect(result).toMatchObject({ success: 'updated' })
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

  it('ritorna { success: updated } dopo update riuscito', async () => {
    const { client } = buildClient()
    vi.mocked(createClient).mockResolvedValue(client as never)

    const result = await updateClientAction(CLIENT_ID, null, makeFormData())
    expect(result).toMatchObject({ success: 'updated' })
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
