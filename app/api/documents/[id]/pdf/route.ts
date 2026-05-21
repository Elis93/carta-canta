// ============================================================
// GET /api/documents/[id]/pdf
// Genera o restituisce il PDF cachato di un preventivo.
//
// Query params:
//   ?force=1  → rigenera anche se già cachato
//   ?inline=1 → visualizza nel browser invece di scaricare
//
// Logica blocco Free:
//   - Download di una bozza: controlla blocco Free (trial scaduto o quota 8 raggiunta).
//     Se bloccato → 403. Se ok → segna pdf_downloaded_at (atomico), watermark BOZZA.
//   - Documenti già inviati (status != draft): nessun controllo blocco.
// ============================================================

// Vercel Pro: aumenta il timeout a 60 s per generazione PDF con Chromium headless.
export const maxDuration = 60

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  generateAndCachePdf,
  generatePdfBuffer,
  getCachedPdfSignedUrl,
} from '@/lib/pdf/generate'
import { checkFreeBlock } from '@/lib/free-trial'
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
    .select('id, ragione_sociale, name, piva, indirizzo, cap, citta, provincia, logo_url, fiscal_regime, plan, free_trial_expires_at, sent_quota_used')
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

  // ── Blocco Free: controllo al download di qualsiasi bozza ────
  // Le bozze successive (pdf_downloaded_at già settato) non ri-controllano.
  // I documenti già inviati (status != draft) non controllano mai.
  const isFirstDraftDownload = doc.status === 'draft' && !doc.pdf_downloaded_at

  if (isFirstDraftDownload && workspace.plan === 'free') {
    const trial = checkFreeBlock(workspace)
    if (trial.blocked) {
      return NextResponse.json(
        {
          error: 'trial_blocked',
          message: trial.reason === 'trial_expired'
            ? 'Il periodo di prova Free è terminato. Passa a Pro per continuare.'
            : `Hai raggiunto il limite di ${trial.docsUsed} preventivi del piano Free. Passa a Pro per preventivi illimitati.`,
        },
        { status: 403 }
      )
    }
  }

  // ── Segna pdf_downloaded_at al primo download (atomico) ───
  // UPDATE ... WHERE pdf_downloaded_at IS NULL garantisce che venga
  // eseguito una sola volta anche in caso di richieste parallele.
  if (isFirstDraftDownload) {
    const { data: updated } = await supabase
      .from('documents')
      .update({ pdf_downloaded_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .is('pdf_downloaded_at', null)
      .select('pdf_downloaded_at')
      .maybeSingle()

    if (updated) {
      // Aggiorna l'oggetto locale per il watermark corretto nel PDF generato
      ;(doc as Record<string, unknown>).pdf_downloaded_at = updated.pdf_downloaded_at
    }
  }

  // ── Nota: il numero documento NON viene assegnato al download PDF ─────────
  // Il numero viene assegnato solo all'invio (sendDocumentAction)
  // o alla registrazione dell'invio manuale (registerManualSendAction).
  // Il PDF mostra "BOZZA" come numero se doc_number è null.

  // ── Template snapshot ─────────────────────────────────────
  // Priorità: snapshot salvato → template assegnato al doc → template default → primo disponibile
  let template: PdfDocumentData['template'] = null
  if (doc.template_snapshot) {
    const snap = doc.template_snapshot as Record<string, unknown>
    template = {
      preset_key: (snap.preset_key as string) ?? 'classico',
      color_primary: (snap.color_primary as string) ?? '#1a1a2e',
      font_family: (snap.font_family as string) ?? 'Inter',
      show_logo: (snap.show_logo as boolean) ?? true,
      show_watermark: (snap.show_watermark as boolean) ?? true,
      legal_notice: (snap.legal_notice as string) ?? null,
      logo_position: (snap.logo_position as string) ?? 'left',
    }
  } else {
    // 1. Template assegnato al documento
    const templateId = (doc as Record<string, unknown>).template_id as string | null
    if (templateId) {
      const { data: assignedTmpl } = await supabase
        .from('templates')
        .select('preset_key, color_primary, font_family, show_logo, show_watermark, legal_notice, logo_position')
        .eq('id', templateId)
        .eq('workspace_id', workspace.id)
        .maybeSingle()
      if (assignedTmpl) template = assignedTmpl
    }
    // 2. Template default del workspace
    if (!template) {
      const { data: defaultTmpl } = await supabase
        .from('templates')
        .select('preset_key, color_primary, font_family, show_logo, show_watermark, legal_notice, logo_position')
        .eq('workspace_id', workspace.id)
        .eq('is_default', true)
        .maybeSingle()
      if (defaultTmpl) template = defaultTmpl
    }
    // 3. Qualsiasi template disponibile
    if (!template) {
      const { data: anyTmpl } = await supabase
        .from('templates')
        .select('preset_key, color_primary, font_family, show_logo, show_watermark, legal_notice, logo_position')
        .eq('workspace_id', workspace.id)
        .limit(1)
        .maybeSingle()
      if (anyTmpl) template = anyTmpl
    }
    // FIX-32: salva snapshot per documenti già inviati (status != draft) così i PDF futuri sono coerenti
    if (template && doc.status !== 'draft') {
      await supabase
        .from('documents')
        .update({ template_snapshot: template })
        .eq('id', id)
        .eq('workspace_id', workspace.id)
        .is('template_snapshot', null) // non sovrascrivere se è stato salvato da un altro path
    }
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

  const fileName = `preventivo-${doc.doc_number ?? 'bozza'}.pdf`
  const disposition = inline
    ? `inline; filename="${fileName}"`
    : `attachment; filename="${fileName}"`

  // ── Cache: se già esiste e non forzato, usa signed URL ────
  // Per bozze: invalida sempre la cache (il watermark può cambiare tra BOZZA e NON ANCORA INVIATO)
  const useCache = !forceRegen && doc.pdf_url && doc.status !== 'draft'
  if (useCache) {
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
    // Per i documenti inviati, usa la cache Storage
    if (doc.status !== 'draft') {
      const signedUrl = await generateAndCachePdf(pdfData, workspace.id, id)
      return NextResponse.redirect(signedUrl)
    }

    // Per le bozze: sempre stream diretto (watermark dipende dallo stato, no cache)
    const pdfBuffer = await generatePdfBuffer(pdfData)
    return new NextResponse(pdfBuffer.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': disposition,
        'Content-Length': String(pdfBuffer.length),
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (storageError) {
    // Storage non disponibile — fallback stream diretto
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
