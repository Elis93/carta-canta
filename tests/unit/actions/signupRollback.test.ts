// ── Mocks (hoistati da Vitest prima degli import) ──────────────────────────
import { vi } from 'vitest'

vi.mock('next/navigation',                   () => ({ redirect: vi.fn() }))
vi.mock('@/lib/supabase/server',             () => ({ createClient:      vi.fn() }))
vi.mock('@/lib/supabase/admin',              () => ({ createAdminClient: vi.fn() }))
vi.mock('@/lib/email/send',                  () => ({ sendEmail:         vi.fn().mockResolvedValue({}) }))
vi.mock('@/lib/email/templates/welcome',     () => ({ WelcomeEmail:      vi.fn() }))
// isAuthRateLimited usa headers() (request scope) — mock per non bloccare il test
vi.mock('@/lib/auth-rate-limit',             () => ({ isAuthRateLimited: vi.fn().mockResolvedValue(false) }))

// ── Import ─────────────────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from 'vitest'
import { createClient }      from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { signupAction }      from '@/app/(auth)/actions'

// ── Helper: FormData valida di default, sovrascrivibile ────────────────────
function makeFormData(overrides: Partial<Record<string, string>> = {}): FormData {
  const fd = new FormData()
  const defaults: Record<string, string> = {
    nome:           'Mario',
    cognome:        'Rossi',
    email:          'mario@esempio.it',
    // Password forte: maiuscola + minuscola + numero + simbolo (requisiti sessione 22)
    password:       'Password123!',
    workspace_name: 'Idraulica Rossi',
    ...overrides,
  }
  Object.entries(defaults).forEach(([k, v]) => fd.append(k, v))
  return fd
}

// ── Helper: mock del client Supabase standard (solo auth.signUp) ───────────
function buildClient(opts: {
  signUpError?: { message: string } | null
  user?: { id: string; identities?: unknown[] } | null
} = {}) {
  // identities non vuoto = email NON già registrata (controllo anti-enumeration sessione 21p2)
  const { signUpError = null, user = { id: 'user-1', identities: [{ id: 'idy-1' }] } } = opts
  return {
    auth: {
      signUp: vi.fn().mockResolvedValue({
        data:  { user: signUpError ? null : user },
        error: signUpError,
      }),
    },
  }
}

// ── Helper: mock dell'admin client (slug-check + insert + deleteUser) ──────
//
// Il flow usa adminClient.from() due volte:
//   1° chiamata: .from('workspaces').select('id').eq('slug', slug).maybeSingle()
//   2° chiamata: .from('workspaces').insert({ ... })
//
function buildAdminClient(opts: {
  insertError?:  { message: string } | null
  deleteError?:  { message: string } | null
  slugExists?:   boolean
} = {}) {
  const { insertError = null, deleteError = null, slugExists = false } = opts

  const deleteUserSpy = vi.fn().mockResolvedValue({ error: deleteError })
  const insertSpy     = vi.fn().mockResolvedValue({ error: insertError })

  let fromCallCount = 0
  const fromSpy = vi.fn().mockImplementation(() => {
    fromCallCount++
    if (fromCallCount === 1) {
      // Prima chiamata: verifica slug duplicato
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: slugExists ? { id: 'existing-ws' } : null,
            }),
          }),
        }),
      }
    }
    // Seconda chiamata: insert workspace
    return { insert: insertSpy }
  })

  const admin = {
    from: fromSpy,
    auth: { admin: { deleteUser: deleteUserSpy } },
  }
  return { admin, insertSpy, deleteUserSpy, fromSpy }
}

// ── Suite ──────────────────────────────────────────────────────────────────
describe('signupAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  // ── Validazione input ──────────────────────────────────────────────────

  it('ritorna errore se nome manca', async () => {
    const fd = makeFormData({ nome: '' })
    const result = await signupAction(null, fd)
    expect(result).toEqual({ error: 'Tutti i campi sono obbligatori.' })
  })

  it('ritorna errore se cognome manca', async () => {
    const fd = makeFormData({ cognome: '' })
    const result = await signupAction(null, fd)
    expect(result).toEqual({ error: 'Tutti i campi sono obbligatori.' })
  })

  it('ritorna errore se password troppo corta', async () => {
    const fd = makeFormData({ password: 'Ab1!' })
    const result = await signupAction(null, fd)
    expect(result).toEqual({ error: 'La password deve avere almeno 8 caratteri.' })
  })

  it('ritorna errore se password senza requisiti (no maiuscola/numero/simbolo)', async () => {
    const fd = makeFormData({ password: 'solominuscole' })
    const result = await signupAction(null, fd)
    // Il primo requisito che fallisce è la maiuscola
    expect(result?.error).toContain('maiuscola')
  })

  // NB: workspace_name non è più un campo validato — viene costruito da nome+cognome.
  // (test rimosso in sessione 24)

  // ── Errori signUp ──────────────────────────────────────────────────────

  it('ritorna errore localizzato se email già registrata', async () => {
    vi.mocked(createClient).mockResolvedValue(
      buildClient({ signUpError: { message: 'User already registered' } }) as never
    )
    vi.mocked(createAdminClient).mockReturnValue(
      buildAdminClient().admin as never
    )

    const result = await signupAction(null, makeFormData())
    expect(result).toEqual({ error: 'Esiste già un account con questa email.' })
  })

  it('ritorna errore generico per altri errori signUp', async () => {
    vi.mocked(createClient).mockResolvedValue(
      buildClient({ signUpError: { message: 'Internal server error' } }) as never
    )
    vi.mocked(createAdminClient).mockReturnValue(
      buildAdminClient().admin as never
    )

    const result = await signupAction(null, makeFormData())
    expect(result).toEqual({ error: 'Errore durante la registrazione. Riprova.' })
  })

  // ── Rollback workspace ─────────────────────────────────────────────────

  it('chiama deleteUser con l\'userId corretto quando l\'insert workspace fallisce', async () => {
    vi.mocked(createClient).mockResolvedValue(
      buildClient({ user: { id: 'user-abc', identities: [{ id: 'idy-1' }] } }) as never
    )
    const { admin, deleteUserSpy } = buildAdminClient({
      insertError: { message: 'constraint violation' },
      deleteError: null,
    })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    await signupAction(null, makeFormData())

    expect(deleteUserSpy).toHaveBeenCalledOnce()
    expect(deleteUserSpy).toHaveBeenCalledWith('user-abc')
  })

  it('ritorna "workspace non creato" quando rollback va a buon fine', async () => {
    vi.mocked(createClient).mockResolvedValue(buildClient() as never)
    const { admin } = buildAdminClient({
      insertError: { message: 'constraint violation' },
      deleteError: null,
    })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const result = await signupAction(null, makeFormData())
    expect(result).toEqual({ error: 'Errore nella creazione del workspace. Riprova.' })
  })

  it('chiama console.error quando anche il rollback deleteUser fallisce', async () => {
    vi.mocked(createClient).mockResolvedValue(
      buildClient({ user: { id: 'user-xyz', identities: [{ id: 'idy-1' }] } }) as never
    )
    const { admin } = buildAdminClient({
      insertError: { message: 'db error' },
      deleteError: { message: 'network error' },
    })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    await signupAction(null, makeFormData())

    expect(console.error).toHaveBeenCalledOnce()
    const [label, payload] = (console.error as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(label).toBe('[signupAction] Rollback deleteUser failed')
    expect(payload).toMatchObject({
      userId:        'user-xyz',
      email:         'mario@esempio.it',
      wsError:       'db error',
      rollbackError: 'network error',
    })
  })

  it('ritorna messaggio "contatta il supporto" quando rollback fallisce', async () => {
    vi.mocked(createClient).mockResolvedValue(buildClient() as never)
    const { admin } = buildAdminClient({
      insertError: { message: 'db error' },
      deleteError: { message: 'network error' },
    })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const result = await signupAction(null, makeFormData())
    expect(result).toEqual({
      error: 'Errore tecnico durante la registrazione. Contatta il supporto.',
    })
  })

  // ── Path di successo ───────────────────────────────────────────────────

  it('ritorna { success: "verifica-email" } quando tutto va a buon fine (conferma email attiva)', async () => {
    // Con la conferma email attiva, signUp non restituisce una sessione →
    // l'utente viene mandato alla pagina "controlla la tua email".
    vi.mocked(createClient).mockResolvedValue(buildClient() as never)
    const { admin } = buildAdminClient({ insertError: null })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    const result = await signupAction(null, makeFormData())
    expect(result).toEqual({ success: 'verifica-email' })
  })

  it('NON chiama deleteUser nel path di successo', async () => {
    vi.mocked(createClient).mockResolvedValue(buildClient() as never)
    const { admin, deleteUserSpy } = buildAdminClient({ insertError: null })
    vi.mocked(createAdminClient).mockReturnValue(admin as never)

    await signupAction(null, makeFormData())

    expect(deleteUserSpy).not.toHaveBeenCalled()
  })
})
