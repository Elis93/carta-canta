// ============================================================
// GET /api/documents/[id]/pdf
// Restituisce la vista di stampa del documento (HTML → stampa browser).
// L'utente apre la tab, il browser mostra il dialogo di stampa,
// salva come PDF. Nessun binario nativo richiesto.
//
// Logica blocco Free:
//   - Prima apertura di una bozza: controlla blocco Free.
//     Se bloccato → 403.
//   - Documenti già inviati: nessun controllo.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { buildPdfHtml } from '@/lib/pdf/template'
import { fetchLogoBase64, preparePrintHtml } from '@/lib/pdf/logo'
import { checkFreeBlock } from '@/lib/free-trial'
import type { PdfDocumentData } from '@/lib/pdf/template'

interface Params {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params
  const preview = request.nextUrl.searchParams.get('preview') === '1'

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
      clients(name, email, phone, piva, codice_fiscale, indirizzo, cap, citta, provincia, paese)
    `)
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (!doc) {
    return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })
  }

  // ── Blocco Free: prima apertura bozza ──────────────────────
  const isFirstDraftView = doc.status === 'draft' && !doc.pdf_downloaded_at

  if (isFirstDraftView && workspace.plan === 'free') {
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

  // ── Segna pdf_downloaded_at al primo accesso (atomico) ────
  if (isFirstDraftView) {
    const { data: updated } = await supabase
      .from('documents')
      .update({ pdf_downloaded_at: new Date().toISOString() })
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .is('pdf_downloaded_at', null)
      .select('pdf_downloaded_at')
      .maybeSingle()

    if (updated) {
      ;(doc as Record<string, unknown>).pdf_downloaded_at = updated.pdf_downloaded_at
    }
  }

  // ── Template: snapshot → assegnato → default → qualsiasi ──
  let template: PdfDocumentData['template'] = null
  if (doc.template_snapshot) {
    const snap = doc.template_snapshot as Record<string, unknown>
    template = {
      preset_key:     (snap.preset_key     as string)  ?? 'classico',
      color_primary:  (snap.color_primary  as string)  ?? '#1a1a2e',
      font_family:    (snap.font_family    as string)  ?? 'Inter',
      show_logo:      (snap.show_logo      as boolean) ?? true,
      show_watermark: (snap.show_watermark as boolean) ?? true,
      legal_notice:   (snap.legal_notice   as string)  ?? null,
      logo_position:  (snap.logo_position  as string)  ?? 'left',
    }
  } else {
    const templateId = (doc as Record<string, unknown>).template_id as string | null
    if (templateId) {
      const { data: t } = await supabase
        .from('templates')
        .select('preset_key, color_primary, font_family, show_logo, show_watermark, legal_notice, logo_position')
        .eq('id', templateId)
        .eq('workspace_id', workspace.id)
        .maybeSingle()
      if (t) template = t
    }
    if (!template) {
      const { data: t } = await supabase
        .from('templates')
        .select('preset_key, color_primary, font_family, show_logo, show_watermark, legal_notice, logo_position')
        .eq('workspace_id', workspace.id)
        .eq('is_default', true)
        .maybeSingle()
      if (t) template = t
    }
    if (!template) {
      const { data: t } = await supabase
        .from('templates')
        .select('preset_key, color_primary, font_family, show_logo, show_watermark, legal_notice, logo_position')
        .eq('workspace_id', workspace.id)
        .limit(1)
        .maybeSingle()
      if (t) template = t
    }
    // Salva snapshot per documenti già inviati
    if (template && doc.status !== 'draft') {
      await supabase
        .from('documents')
        .update({ template_snapshot: template })
        .eq('id', id)
        .eq('workspace_id', workspace.id)
        .is('template_snapshot', null)
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

  // ── Genera HTML per stampa ────────────────────────────────
  // preview=true → solo visualizzazione (no dialogo stampa)
  // preview=false → apre dialogo stampa automaticamente
  const logoBase64 = await fetchLogoBase64(workspace.logo_url)
  const html = buildPdfHtml({ ...pdfData, logoBase64 })
  const printHtml = preparePrintHtml(html, !preview)

  return new NextResponse(printHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  })
}
