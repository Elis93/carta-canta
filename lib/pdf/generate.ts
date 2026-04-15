// ============================================================
// CARTA CANTA — PDF Generator
// Usa Playwright Chromium headless per convertire HTML → PDF.
// Il PDF viene cachato su Supabase Storage e riutilizzato.
// ============================================================

import { chromium } from '@playwright/test'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildPdfHtml } from './template'
import type { PdfDocumentData } from './template'

const STORAGE_BUCKET = 'pdfs'
const SIGNED_URL_EXPIRES_IN = 3600 // 1 ora

// ── Fetch logo come base64 ─────────────────────────────────────────────────
// Playwright gira in un contesto isolato e potrebbe non riuscire a
// raggiungere URL Supabase — pre-carichiamo il logo come data URL.

async function fetchLogoBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    const mime = res.headers.get('content-type') ?? 'image/png'
    const b64 = Buffer.from(buf).toString('base64')
    return `data:${mime};base64,${b64}`
  } catch {
    return null
  }
}

// ── Genera PDF via Playwright ──────────────────────────────────────────────

export async function generatePdfBuffer(data: PdfDocumentData): Promise<Buffer> {
  // Pre-carica logo come base64 se disponibile
  let logoBase64: string | null = null
  if (data.workspace.logo_url) {
    logoBase64 = await fetchLogoBase64(data.workspace.logo_url)
  }

  const html = buildPdfHtml({ ...data, logoBase64 })

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  })

  try {
    const page = await browser.newPage()

    await page.setContent(html, {
      waitUntil: 'networkidle',
      timeout: 15_000,
    })

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', bottom: '0', left: '0', right: '0' },
    })

    return Buffer.from(pdfBuffer)
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
  documentId: string
): Promise<string> {
  const admin = createAdminClient()

  // Genera il PDF
  const pdfBuffer = await generatePdfBuffer(data)

  const path = storagePath(workspaceId, documentId)

  // Upload su Supabase Storage (upsert — sovrascrive se già esiste)
  const { error: uploadError } = await admin.storage
    .from(STORAGE_BUCKET)
    .upload(path, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    })

  if (uploadError) {
    // Se il bucket non esiste o upload fallisce, ritorniamo il Buffer
    // direttamente senza cache (degradazione graziosa)
    throw new Error(`Upload PDF fallito: ${uploadError.message}`)
  }

  // Aggiorna pdf_url nel documento con il path di Storage
  await admin
    .from('documents')
    .update({ pdf_url: path })
    .eq('id', documentId)

  // Genera signed URL (1h)
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
  documentId: string
): Promise<string | null> {
  const admin = createAdminClient()
  const path = storagePath(workspaceId, documentId)

  const { data: signed, error } = await admin.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_IN)

  if (error || !signed?.signedUrl) return null
  return signed.signedUrl
}
