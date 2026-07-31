import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { checkCompanyRegistry } from '@/lib/marketplace/company-check'

// Seconda possibilità dopo il VIES (decisione Eli 29 lug): il VIES non
// contiene molti artigiani italiani con P.IVA valida — il Registro
// Imprese sì. Senza chiave configurata il comportamento resta solo-VIES.

const okBody = { data: [{ companyName: 'Eli Impianti', vatCode: '12345678903' }] }

function stubFetch(status: number, body?: unknown) {
  const fn = vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body ?? {},
  })
  vi.stubGlobal('fetch', fn)
  return fn
}

beforeEach(() => vi.stubEnv('OPENAPI_COMPANY_API_KEY', 'tok-123'))
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals() })

describe('checkCompanyRegistry', () => {
  it('senza chiave configurata: unconfigured, NESSUNA chiamata (niente costi)', async () => {
    vi.stubEnv('OPENAPI_COMPANY_API_KEY', '')
    const fetchSpy = stubFetch(200, okBody)
    expect(await checkCompanyRegistry('12345678903')).toBe('unconfigured')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('impresa trovata nel registro: valid (e il token viaggia come Bearer)', async () => {
    const fetchSpy = stubFetch(200, okBody)
    expect(await checkCompanyRegistry('12345678903')).toBe('valid')
    const [url, opts] = fetchSpy.mock.calls[0]
    expect(String(url)).toBe('https://company.openapi.com/IT-start/12345678903')
    expect((opts as { headers: Record<string, string> }).headers.Authorization).toBe('Bearer tok-123')
  })

  it('P.IVA non presente (404): invalid', async () => {
    stubFetch(404)
    expect(await checkCompanyRegistry('12345678903')).toBe('invalid')
  })

  it('token senza scope (401/403): unavailable, MAI "invalid" (non è un giudizio sulla P.IVA)', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    stubFetch(401)
    expect(await checkCompanyRegistry('12345678903')).toBe('unavailable')
    expect(errSpy).toHaveBeenCalled()
  })

  it('errore server (500) o rete giù: unavailable', async () => {
    stubFetch(500)
    expect(await checkCompanyRegistry('12345678903')).toBe('unavailable')
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rete giù')))
    expect(await checkCompanyRegistry('12345678903')).toBe('unavailable')
  })

  it('formato P.IVA impossibile: invalid senza chiamare (e pagare) il servizio', async () => {
    const fetchSpy = stubFetch(200, okBody)
    expect(await checkCompanyRegistry('abc')).toBe('invalid')
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('200 con data vuota: invalid', async () => {
    stubFetch(200, { data: [] })
    expect(await checkCompanyRegistry('12345678903')).toBe('invalid')
  })
})
