// ============================================================
// CARTA CANTA — PDF Generator
//
// Genera PDF con @react-pdf/renderer (server-side, puro JS).
// Non richiede binari nativi — funziona su Vercel, Lambda, locale.
//
// Il layout PDF è definito in components/pdf/PreventivoPDF.tsx
// e usa gli stessi dati di buildPdfHtml() in lib/pdf/template.ts.
// ============================================================

import { renderToBuffer } from '@react-pdf/renderer'
import { PreventivoPDF } from '@/components/pdf/PreventivoPDF'
import type { PdfData, PdfDocumentItem } from '@/components/pdf/PreventivoPDF'
import { createAdminClient } from '@/lib/supabase/admin'
import type { PdfDocumentData } from './template'

const STORAGE_BUCKET = 'pdfs'
const SIGNED_URL_EXPIRES_IN = 3600

// ── Mappa PdfDocumentData → PdfData (formato PreventivoPDF) ───────────────

function mapToPdfData(data: PdfDocumentData): PdfData {
  const { document: doc, workspace, client, template } = data

  const items: PdfDocumentItem[] = (doc.document_items ?? []).map(item => ({
    sort_order:   item.sort_order   ?? 0,
    description:  item.description  ?? '',
    unit:         item.unit         ?? null,
    quantity:     item.quantity     ?? 0,
    unit_price:   item.unit_price   ?? 0,
    discount_pct: item.discount_pct ?? null,
    vat_rate:     item.vat_rate     ?? null,
    total:        item.total        ?? 0,
  }))

  return {
    doc: {
      doc_number:       doc.doc_number       ?? null,
      title:            doc.title            ?? null,
      notes:            doc.notes            ?? null,
      created_at:       doc.created_at       ?? null,
      expires_at:       doc.expires_at       ?? null,
      payment_terms:    doc.payment_terms    ?? null,
      subtotal:         doc.subtotal         ?? null,
      discount_pct:     doc.discount_pct     ?? null,
      discount_fixed:   doc.discount_fixed   ?? null,
      tax_amount:       doc.tax_amount       ?? null,
      bollo_amount:     doc.bollo_amount     ?? null,
      total:            doc.total            ?? null,
      vat_rate_default: doc.vat_rate_default ?? null,
      document_items:   items,
      status:           doc.status           ?? null,
    },
    workspace: {
      ragione_sociale: workspace.ragione_sociale ?? null,
      name:            workspace.name,
      piva:            workspace.piva            ?? null,
      indirizzo:       workspace.indirizzo       ?? null,
      cap:             workspace.cap             ?? null,
      citta:           workspace.citta           ?? null,
      provincia:       workspace.provincia       ?? null,
      logo_url:        workspace.logo_url        ?? null,
      fiscal_regime:   workspace.fiscal_regime   ?? 'ordinario',
    },
    client: client ? {
      name:      client.name,
      email:     client.email     ?? null,
      phone:     client.phone     ?? null,
      piva:      client.piva      ?? null,
      indirizzo: client.indirizzo ?? null,
      cap:       client.cap       ?? null,
      citta:     client.citta     ?? null,
      provincia: client.provincia ?? null,
    } : null,
    template: template ? {
      color_primary:  template.color_primary  ?? null,
      show_logo:      template.show_logo      ?? null,
      show_watermark: template.show_watermark ?? null,
      legal_notice:   template.legal_notice   ?? null,
    } : null,
  }
}

// ── Genera PDF buffer ──────────────────────────────────────────────────────

export async function generatePdfBuffer(data: PdfDocumentData): Promise<Buffer> {
  const pdfData = mapToPdfData(data)
  const arrayBuffer = await renderToBuffer(PreventivoPDF(pdfData))
  return Buffer.from(arrayBuffer)
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
