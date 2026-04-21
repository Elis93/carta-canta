// ============================================================
// GET /api/p/[token]/pdf
// Pubblica — no auth richiesta.
// Genera o restituisce il PDF cachato di un documento via token.
// Non espone documenti in stato 'draft'.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  generateAndCachePdf,
  generatePdfBuffer,
  getCachedPdfSignedUrl,
} from '@/lib/pdf/generate'
import type { PdfDocumentData } from '@/lib/pdf/template'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const admin = createAdminClient()

  // ── Carica documento via token pubblico ───────────────────
  const { data: doc } = await admin
    .from('documents')
    .select(`
      *,
      document_items(*),
      clients!client_id(name, email, phone, piva, indirizzo, cap, citta, provincia, paese)
    `)
    .eq('public_token', token)
    .maybeSingle()

  // Non esporre bozze o documenti inesistenti
  if (!doc || doc.status === 'draft') {
    return NextResponse.json({ error: 'Documento non disponibile' }, { status: 404 })
  }

  // ── Carica workspace ──────────────────────────────────────
  const { data: workspace } = await admin
    .from('workspaces')
    .select('ragione_sociale, name, piva, indirizzo, cap, citta, provincia, logo_url, fiscal_regime')
    .eq('id', doc.workspace_id)
    .maybeSingle()

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 })
  }

  // ── Cache: se già esiste, usa signed URL ─────────────────
  if (doc.pdf_url) {
    try {
      const signedUrl = await getCachedPdfSignedUrl(doc.workspace_id, doc.id)
      if (signedUrl) return NextResponse.redirect(signedUrl)
    } catch {
      // Cache miss — procede a rigenerare
    }
  }

  // ── Template: snapshot → assegnato → default → qualsiasi ────
  let template: PdfDocumentData['template'] = null
  if (doc.template_snapshot) {
    const snap = doc.template_snapshot as Record<string, unknown>
    template = {
      color_primary: (snap.color_primary as string) ?? '#1a1a2e',
      font_family:   (snap.font_family as string)   ?? 'Inter',
      show_logo:     (snap.show_logo as boolean)     ?? true,
      show_watermark:(snap.show_watermark as boolean)?? false,
      legal_notice:  (snap.legal_notice as string)   ?? null,
    }
  } else {
    const templateId = (doc as Record<string, unknown>).template_id as string | null

    // 1. Template assegnato al documento
    if (templateId) {
      const { data: t } = await admin
        .from('templates')
        .select('color_primary, font_family, show_logo, show_watermark, legal_notice')
        .eq('id', templateId)
        .eq('workspace_id', doc.workspace_id)
        .maybeSingle()
      if (t) template = t
    }
    // 2. Template default del workspace
    if (!template) {
      const { data: t } = await admin
        .from('templates')
        .select('color_primary, font_family, show_logo, show_watermark, legal_notice')
        .eq('workspace_id', doc.workspace_id)
        .eq('is_default', true)
        .maybeSingle()
      if (t) template = t
    }
    // 3. Qualsiasi template — altrimenti resta null (defaults hardcoded)
    if (!template) {
      const { data: t } = await admin
        .from('templates')
        .select('color_primary, font_family, show_logo, show_watermark, legal_notice')
        .eq('workspace_id', doc.workspace_id)
        .limit(1)
        .maybeSingle()
      if (t) template = t
    }
  }

  const pdfData: PdfDocumentData = {
    document: doc as PdfDocumentData['document'],
    workspace: {
      ragione_sociale: workspace.ragione_sociale,
      name:            workspace.name,
      piva:            workspace.piva,
      indirizzo:       workspace.indirizzo,
      cap:             workspace.cap,
      citta:           workspace.citta,
      provincia:       workspace.provincia,
      logo_url:        workspace.logo_url,
      fiscal_regime:   workspace.fiscal_regime,
    },
    client: doc.clients as PdfDocumentData['client'],
    template,
  }

  const fileName = `preventivo-${(doc.doc_number ?? doc.id).replace(/\//g, '-')}.pdf`

  // ── Genera e cача (con fallback stream diretto) ───────────
  try {
    const signedUrl = await generateAndCachePdf(pdfData, doc.workspace_id, doc.id)
    return NextResponse.redirect(signedUrl)
  } catch {
    // Storage non disponibile — stream diretto
    try {
      const pdfBuffer = await generatePdfBuffer(pdfData)
      return new NextResponse(pdfBuffer.buffer as ArrayBuffer, {
        status: 200,
        headers: {
          'Content-Type':        'application/pdf',
          'Content-Disposition': `inline; filename="${fileName}"`,
          'Content-Length':      String(pdfBuffer.length),
          'Cache-Control':       'private, max-age=3600',
        },
      })
    } catch {
      return NextResponse.json(
        { error: 'Errore nella generazione del PDF. Riprova tra qualche istante.' },
        { status: 500 }
      )
    }
  }
}
