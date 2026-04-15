// ============================================================
// GET /api/documents/[id]/pdf
// Genera o restituisce il PDF cachato di un preventivo.
//
// Query params:
//   ?force=1  → rigenera anche se già cachato
//   ?inline=1 → visualizza nel browser invece di scaricare
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  generateAndCachePdf,
  generatePdfBuffer,
  getCachedPdfSignedUrl,
} from '@/lib/pdf/generate'
import type { PdfDocumentData } from '@/lib/pdf/template'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params
  const { searchParams } = request.nextUrl
  const forceRegen = searchParams.get('force') === '1'
  const inline = searchParams.get('inline') === '1'

  // ── Auth ──────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, ragione_sociale, name, piva, indirizzo, cap, citta, provincia, logo_url, fiscal_regime')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 })
  }

  // ── Fetch documento ───────────────────────────────────────
  const { data: doc } = await supabase
    .from('documents')
    .select(`
      *,
      document_items(*),
      clients(name, email, phone, piva, indirizzo, cap, citta, provincia, paese)
    `)
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (!doc) {
    return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })
  }

  // ── Template snapshot ─────────────────────────────────────
  let template: PdfDocumentData['template'] = null
  if (doc.template_snapshot) {
    const snap = doc.template_snapshot as Record<string, unknown>
    template = {
      color_primary: (snap.color_primary as string) ?? '#1a1a2e',
      font_family: (snap.font_family as string) ?? 'Inter',
      show_logo: (snap.show_logo as boolean) ?? true,
      show_watermark: (snap.show_watermark as boolean) ?? false,
      legal_notice: (snap.legal_notice as string) ?? null,
    }
  } else {
    // Usa il template default del workspace
    const { data: defaultTmpl } = await supabase
      .from('templates')
      .select('color_primary, font_family, show_logo, show_watermark, legal_notice')
      .eq('workspace_id', workspace.id)
      .eq('is_default', true)
      .maybeSingle()
    template = defaultTmpl ?? null
  }

  const pdfData: PdfDocumentData = {
    document: doc as PdfDocumentData['document'],
    workspace: {
      ragione_sociale: workspace.ragione_sociale,
      name: workspace.name,
      piva: workspace.piva,
      indirizzo: workspace.indirizzo,
      cap: workspace.cap,
      citta: workspace.citta,
      provincia: workspace.provincia,
      logo_url: workspace.logo_url,
      fiscal_regime: workspace.fiscal_regime,
    },
    client: doc.clients as PdfDocumentData['client'],
    template,
  }

  const fileName = `preventivo-${doc.doc_number ?? id}.pdf`
  const disposition = inline
    ? `inline; filename="${fileName}"`
    : `attachment; filename="${fileName}"`

  // ── Cache: se già esiste e non forzato, usa signed URL ────
  if (!forceRegen && doc.pdf_url) {
    try {
      const signedUrl = await getCachedPdfSignedUrl(workspace.id, id)
      if (signedUrl) {
        return NextResponse.redirect(signedUrl)
      }
    } catch {
      // Cache miss o errore Storage — procede a rigenerare
    }
  }

  // ── Genera PDF ────────────────────────────────────────────
  try {
    // Prova prima con cache su Storage
    const signedUrl = await generateAndCachePdf(pdfData, workspace.id, id)
    return NextResponse.redirect(signedUrl)
  } catch (storageError) {
    // Storage non disponibile (bucket mancante, env non configurato, etc.)
    // Fallback: stream il PDF direttamente senza cacharlo
    console.error('[PDF] Storage unavailable, streaming directly:', storageError)

    try {
      const pdfBuffer = await generatePdfBuffer(pdfData)
      return new NextResponse(pdfBuffer.buffer as ArrayBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': disposition,
          'Content-Length': String(pdfBuffer.length),
          'Cache-Control': 'private, max-age=3600',
        },
      })
    } catch (genError) {
      console.error('[PDF] Generation failed:', genError)
      return NextResponse.json(
        { error: 'Errore durante la generazione del PDF. Riprova tra qualche istante.' },
        { status: 500 }
      )
    }
  }
}
