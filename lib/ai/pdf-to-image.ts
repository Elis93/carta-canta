// ============================================================
// CARTA CANTA — PDF → PNG via Playwright
// Converte la prima pagina di un PDF in un'immagine PNG base64
// per passarla all'API vision di OpenAI / Mistral.
// ============================================================

import { chromium } from '@playwright/test'

/**
 * Converte un PDF (Buffer) in una screenshot PNG della prima pagina.
 * Usa Playwright Chromium che può renderizzare PDF nativamente.
 *
 * @returns base64 della PNG (senza prefisso data:)
 */
export async function pdfToImageBase64(pdfBuffer: Buffer): Promise<string> {
  // Crea un data URL per il PDF
  const pdfBase64 = pdfBuffer.toString('base64')
  const pdfDataUrl = `data:application/pdf;base64,${pdfBase64}`

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  try {
    const page = await browser.newPage()

    // Imposta viewport A4 landscape per la prima pagina
    await page.setViewportSize({ width: 794, height: 1123 })

    // Naviga al PDF via data URL — Chromium lo renderizza nativamente
    await page.goto(pdfDataUrl, { waitUntil: 'networkidle', timeout: 15_000 })

    // Breve attesa per il rendering del PDF
    await page.waitForTimeout(1000)

    // Screenshot della prima pagina
    const screenshotBuffer = await page.screenshot({
      type: 'png',
      fullPage: false,   // solo il viewport (prima pagina)
      clip: { x: 0, y: 0, width: 794, height: 1123 },
    })

    return Buffer.from(screenshotBuffer).toString('base64')
  } finally {
    await browser.close()
  }
}
