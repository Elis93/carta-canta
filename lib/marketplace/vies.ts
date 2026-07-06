// ── Verifica P.IVA sul registro VIES (Commissione Europea) ─────────────
// API REST ufficiale: GET /taxation_customs/vies/rest-api/ms/{stato}/vat/{numero}
// Gratuita, senza chiavi. Timeout breve: se VIES non risponde il profilo
// resta in bozza e si riprova (mai bloccare l'app).

export type ViesResult = 'valid' | 'invalid' | 'unavailable'

export async function checkViesVat(piva: string): Promise<ViesResult> {
  const digits = piva.replace(/\D/g, '')
  if (!/^\d{11}$/.test(digits)) return 'invalid'

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(
      `https://ec.europa.eu/taxation_customs/vies/rest-api/ms/IT/vat/${digits}`,
      { signal: controller.signal, headers: { Accept: 'application/json' } }
    )
    clearTimeout(timer)
    if (!res.ok) return 'unavailable'
    const data = (await res.json()) as { isValid?: boolean; valid?: boolean }
    const valid = data.isValid ?? data.valid
    if (valid === true) return 'valid'
    if (valid === false) return 'invalid'
    return 'unavailable'
  } catch {
    return 'unavailable'
  }
}
