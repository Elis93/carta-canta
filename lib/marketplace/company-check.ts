// ── Verifica P.IVA sul Registro Imprese (OpenAPI, company.openapi.com) ──
// Seconda possibilità DOPO il VIES (decisione Eli 29 lug, "opzione 1"):
// il VIES contiene solo le P.IVA registrate per operazioni con l'estero,
// quindi molti artigiani e forfettari italiani con P.IVA valida NON ci
// sono. Il Registro Imprese li copre. Endpoint a pagamento (pochi
// centesimi a chiamata) → si interroga SOLO quando il VIES non conferma.
//
// Config (Vercel):
//   OPENAPI_COMPANY_API_KEY   token OpenAPI con scope GET company.openapi.com/IT-start
//   OPENAPI_COMPANY_BASE_URL  default https://company.openapi.com
// Senza chiave la funzione risponde 'unconfigured' e il comportamento
// resta quello di prima (solo VIES): rollout sicuro, zero sorprese.

export type CompanyCheckResult = 'valid' | 'invalid' | 'unavailable' | 'unconfigured'

export async function checkCompanyRegistry(piva: string): Promise<CompanyCheckResult> {
  const apiKey = process.env.OPENAPI_COMPANY_API_KEY
  if (!apiKey) return 'unconfigured'

  const digits = piva.replace(/\D/g, '')
  if (!/^\d{11}$/.test(digits)) return 'invalid'

  const baseUrl = (process.env.OPENAPI_COMPANY_BASE_URL ?? 'https://company.openapi.com').replace(/\/$/, '')
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(`${baseUrl}/IT-start/${digits}`, {
      signal: controller.signal,
      headers: { Accept: 'application/json', Authorization: `Bearer ${apiKey}` },
    })
    clearTimeout(timer)

    // 404/204 = P.IVA non presente nel registro → non verificabile.
    if (res.status === 404 || res.status === 204) return 'invalid'
    // 401/403 = token senza scope o API non attivata in console: NON è un
    // giudizio sulla P.IVA → 'unavailable' (e il log dice cosa sistemare).
    if (res.status === 401 || res.status === 403) {
      console.error('[marketplace] Registro Imprese: token OpenAPI rifiutato — attivare l\'API Company e lo scope GET /IT-start in console.openapi.com')
      return 'unavailable'
    }
    if (!res.ok) return 'unavailable'

    // Risposta OpenAPI: { data: [...] } o { data: {...} } con i dati
    // dell'impresa. Tollerante sullo schema: basta un elemento non vuoto.
    const body = (await res.json()) as { data?: unknown }
    const data = Array.isArray(body.data) ? body.data[0] : body.data
    if (data && typeof data === 'object' && Object.keys(data).length > 0) return 'valid'
    return 'invalid'
  } catch {
    return 'unavailable'
  }
}
