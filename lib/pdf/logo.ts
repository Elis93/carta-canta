// ============================================================
// CARTA CANTA — Logo fetcher + print helpers
// ============================================================

/**
 * Prepara l'HTML di buildPdfHtml() per la stampa browser.
 * - Inietta print-color-adjust: exact per forzare sfondi e colori anche
 *   quando "Grafica in background" non è spuntata nel dialogo di stampa.
 * - Se print=true: inietta window.print() on load (apre dialogo stampa).
 * - Se print=false: mostra il documento senza aprire il dialogo.
 */
export function preparePrintHtml(html: string, triggerPrint: boolean): string {
  const printCss = `<style>
@media print {
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
@media screen {
  html, body { background: #e5e7eb; min-height: 100vh; }
  .page {
    margin: 16px auto;
    box-shadow: 0 4px 24px rgba(0,0,0,0.15);
  }
}
</style>`
  const printScript = triggerPrint
    ? `<script>window.onload=function(){window.print()}</script>`
    : ''
  return html
    .replace('</head>', `${printCss}</head>`)
    .replace('</body>', `${printScript}</body>`)
}

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
