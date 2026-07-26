// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { runAction, runActionVoid } from '@/lib/run-action'

// runAction è la rete di sicurezza attorno a OGNI Server Action chiamata dal
// client. Due cose non devono sbagliarsi mai:
//  · un guasto di rete diventa `{ error }` (niente bottone bloccato per
//    sempre, niente pagina di errore che si porta via il testo scritto);
//  · gli errori di CONTROLLO di Next (redirect) devono passare intatti,
//    altrimenti si rompono le navigazioni (es. il checkout Stripe).

afterEach(() => vi.restoreAllMocks())

function nextRedirect() {
  const e = new Error('NEXT_REDIRECT') as Error & { digest: string }
  e.digest = 'NEXT_REDIRECT;replace;/abbonamento;307;'
  return e
}

describe('runAction', () => {
  it('successo: restituisce il risultato dell’action, intatto', async () => {
    const out = await runAction(async () => ({ success: true, id: 'doc-1' }), 'salvare il preventivo')
    expect(out).toEqual({ success: true, id: 'doc-1' })
  })

  it('errore applicativo: passa attraverso senza essere mascherato', async () => {
    const out = await runAction(async () => ({ error: 'Cliente obbligatorio' }), 'salvare il preventivo')
    expect(out).toEqual({ error: 'Cliente obbligatorio' })
  })

  it('guasto di rete: diventa { error } leggibile invece di lanciare', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const out = await runAction<{ error?: string }>(async () => {
      throw new TypeError('Failed to fetch')
    }, 'salvare il preventivo')
    expect(out.error?.toLowerCase()).toContain('non è stato possibile salvare il preventivo')
  })

  it('redirect di Next: RILANCIATO (altrimenti il checkout non naviga più)', async () => {
    await expect(
      runAction(async () => { throw nextRedirect() }, 'aprire il pagamento')
    ).rejects.toThrow('NEXT_REDIRECT')
  })

  it('notFound di Next: rilanciato anche lui', async () => {
    const e = new Error('NEXT_HTTP_ERROR_FALLBACK;404') as Error & { digest: string }
    e.digest = 'NEXT_HTTP_ERROR_FALLBACK;404'
    await expect(runAction(async () => { throw e }, 'aprire il documento')).rejects.toThrow()
  })

  it('un errore con digest NON-Next viene comunque gestito, non propagato', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const e = new Error('boom') as Error & { digest: string }
    e.digest = 'qualcosa-altro'
    const out = await runAction<{ error?: string }>(async () => { throw e }, 'eliminare la voce')
    expect(out.error).toContain('eliminare la voce')
  })
})

describe('runActionVoid', () => {
  it('successo: null', async () => {
    expect(await runActionVoid(async () => undefined, 'aprire il pagamento')).toBeNull()
  })

  it('guasto di rete: messaggio da mostrare', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const msg = await runActionVoid(async () => { throw new TypeError('Failed to fetch') }, 'aprire il pagamento')
    expect(msg).toContain('aprire il pagamento')
  })

  it('redirect di Next: rilanciato', async () => {
    await expect(
      runActionVoid(async () => { throw nextRedirect() }, 'aprire il pagamento')
    ).rejects.toThrow('NEXT_REDIRECT')
  })
})
