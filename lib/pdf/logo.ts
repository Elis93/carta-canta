// ============================================================
// CARTA CANTA — Logo fetcher
// Converte un URL di logo workspace in data-URI base64 da
// passare a buildPdfHtml(). Usato sia dalla generazione PDF
// server-side sia dalla public page /p/[token].
// ============================================================

/**
 * Scarica il logo all'URL indicato e lo restituisce come data-URI base64.
 * Timeout 5 s — se fallisce (URL non raggiungibile, errore di rete, ecc.)
 * restituisce null e buildPdfHtml() userà il placeholder SVG.
 */
export async function fetchLogoBase64(
  logoUrl: string | null | undefined,
): Promise<string | null> {
  if (!logoUrl) return null
  try {
    const response = await fetch(logoUrl, {
      signal: AbortSignal.timeout(5_000),
    })
    if (!response.ok) return null
    const buffer = await response.arrayBuffer()
    const contentType = response.headers.get('content-type') ?? 'image/png'
    return `data:${contentType};base64,${Buffer.from(buffer).toString('base64')}`
  } catch {
    return null
  }
}
