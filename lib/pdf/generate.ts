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
// ============================================================

import chromium from '@sparticuz/chromium'
import { chromium as playwrightChromium } from 'playwright-core'
import { buildPdfHtml } from './template'
import { fetchLogoBase64 } from './logo'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PdfDocumentData } from './template'

const STORAGE_BUCKET = 'pdfs'
const SIGNED_URL_EXPIRES_IN = 3600

// ── Genera PDF buffer da buildPdfHtml() ────────────────────────────────────
// Lancia Chromium headless, carica l'HTML e stampa formato A4.
// Il browser viene sempre chiuso nel finally.

export async function generatePdfBuffer(data: PdfDocumentData): Promise<Buffer> {
  const logoBase64 = await fetchLogoBase64(data.workspace.logo_url)
  const html = buildPdfHtml({ ...data, logoBase64 })

  const executablePath = await chromium.executablePath()

  const browser = await playwrightChromium.launch({
    args: chromium.args,
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
