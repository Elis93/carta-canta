// ============================================================
// CARTA CANTA — PDF Generator
//
// Genera PDF da buildPdfHtml() in lib/pdf/template.ts.
// buildPdfHtml() è la FONTE UNICA DI VERITÀ per tutti i template.
//
// Stack: playwright-core + @sparticuz/chromium (già in package.json).
// @sparticuz/chromium fornisce il binario Chromium compatibile con
// ambienti serverless (Vercel Pro / AWS Lambda).
// playwright-core lancia quel binario senza bundled browser discovery
// — nessun browsers.json, nessun crash su Vercel con Turbopack.
//
// Sviluppo locale (Windows/macOS): usa Chrome di sistema.
// Produzione (Vercel/Lambda): usa @sparticuz/chromium.
// ============================================================

import chromium from '@sparticuz/chromium'
import { chromium as playwrightChromium } from 'playwright-core'
import { buildPdfHtml } from './template'
import { fetchLogoBase64 } from './logo'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PdfDocumentData } from './template'

const STORAGE_BUCKET = 'pdfs'
const SIGNED_URL_EXPIRES_IN = 3600

// ── Risolve la configurazione di lancio di Chromium ───────────────────────
// In produzione (Vercel / AWS Lambda): usa @sparticuz/chromium.
// In sviluppo locale: usa CHROME_PATH env oppure auto-detect Chrome di sistema.

async function resolveLaunchConfig(): Promise<{ executablePath: string; args: string[] }> {
  const isServerless =
    !!process.env.VERCEL ||
    !!process.env.VERCEL_ENV ||
    !!process.env.AWS_LAMBDA_FUNCTION_NAME

  if (isServerless) {
    return {
      executablePath: await chromium.executablePath(),
      args: chromium.args,
    }
  }

  // Dev locale: CHROME_PATH override esplicito
  if (process.env.CHROME_PATH) {
    return {
      executablePath: process.env.CHROME_PATH,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    }
  }

  // Dev locale: auto-detect Chrome installato nel sistema
  const { existsSync } = await import('fs')

  const candidates: string[] =
    process.platform === 'win32'
      ? [
          `${process.env.PROGRAMFILES ?? 'C:\\Program Files'}\\Google\\Chrome\\Application\\chrome.exe`,
          `${process.env['PROGRAMFILES(X86)'] ?? 'C:\\Program Files (x86)'}\\Google\\Chrome\\Application\\chrome.exe`,
          `${process.env.LOCALAPPDATA ?? ''}\\Google\\Chrome\\Application\\chrome.exe`,
        ]
      : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
      : ['/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium']

  for (const p of candidates) {
    if (p && existsSync(p)) {
      return {
        executablePath: p,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
      }
    }
  }

  throw new Error(
    'Chrome non trovato. Installa Google Chrome oppure imposta CHROME_PATH in .env.local\n' +
    'Esempio: CHROME_PATH=C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
  )
}

// ── Genera PDF buffer da buildPdfHtml() ────────────────────────────────────
// Lancia Chromium headless, carica l'HTML e stampa formato A4.
// Il browser viene sempre chiuso nel finally.

export async function generatePdfBuffer(data: PdfDocumentData): Promise<Buffer> {
  const logoBase64 = await fetchLogoBase64(data.workspace.logo_url)
  const html = buildPdfHtml({ ...data, logoBase64 })

  const { executablePath, args } = await resolveLaunchConfig()

  const browser = await playwrightChromium.launch({
    args,
    executablePath,
    headless: true,
  })

  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'networkidle' })
    const buffer = await page.pdf({
      format: 'A4',
      printBackground: true,
    })
    return Buffer.from(buffer)
  } finally {
    await browser.close()
  }
}

// ── Storagepath helper ─────────────────────────────────────────────────────

function storagePath(workspaceId: string, documentId: string): string {
  return `${workspaceId}/${documentId}.pdf`
}

// ── Genera e cача su Supabase Storage ─────────────────────────────────────
// Ritorna un signed URL valido 1 ora.

export async function generateAndCachePdf(
  data: PdfDocumentData,
  workspaceId: string,
  documentId: string,
): Promise<string> {
  const admin = createAdminClient()

  const pdfBuffer = await generatePdfBuffer(data)

  const path = storagePath(workspaceId, documentId)

  const { error: uploadError } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(path, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    throw new Error(`Upload PDF fallito: ${uploadError.message}`)
  }

  await admin
    .from('documents')
    .update({ pdf_url: path })
    .eq('id', documentId)

  const { data: signed, error: signError } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_IN)

  if (signError || !signed?.signedUrl) {
    throw new Error('Impossibile generare signed URL')
  }

  return signed.signedUrl
}

// ── Ottieni signed URL da cache (se esiste) ────────────────────────────────
// Ritorna null se il documento non ha un PDF cachato.

export async function getCachedPdfSignedUrl(
  workspaceId: string,
  documentId: string,
): Promise<string | null> {
  const admin = createAdminClient()
  const path = storagePath(workspaceId, documentId)

  const { data: signed, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_IN)

  if (error || !signed?.signedUrl) return null
  return signed.signedUrl
}
