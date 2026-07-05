// ============================================================
// GET /api/p/[token]/pdf
// Pubblica — no auth richiesta.
// Restituisce la vista di stampa del documento (HTML → stampa browser).
// Non espone documenti in stato 'draft'.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { buildPdfHtml } from '@/lib/pdf/template'
import { fetchLogoBase64, preparePrintHtml } from '@/lib/pdf/logo'
import type { PdfDocumentData } from '@/lib/pdf/template'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params
  const preview = request.nextUrl.searchParams.get('preview') === '1'
  const admin = createAdminClient()

  // ── Carica documento via token pubblico ───────────────────
  const { data: doc } = await admin
    .from('documents')
    .select(`
      *,
      document_items(*),
      clients!client_id(name, email, phone, piva, codice_fiscale, indirizzo, cap, citta, provincia, paese)
    `)
    .eq('public_token', token)
    .maybeSingle()

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

  // ── Template: snapshot → assegnato → default → qualsiasi ──
  let template: PdfDocumentData['template'] = null
  if (doc.template_snapshot) {
    const snap = doc.template_snapshot as Record<string, unknown>
    template = {
      preset_key:     (snap.preset_key     as string)  ?? 'classico',
      color_primary:  (snap.color_primary  as string)  ?? '#374151',
      font_family:    (snap.font_family    as string)  ?? 'Inter',
      show_logo:      (snap.show_logo      as boolean) ?? true,
      show_watermark: (snap.show_watermark as boolean) ?? true,
      legal_notice:   (snap.legal_notice   as string)  ?? null,
      logo_position:  (snap.logo_position  as string)  ?? 'left',
    }
  } else {
    const templateId = (doc as Record<string, unknown>).template_id as string | null
    if (templateId) {
      const { data: t } = await admin
        .from('templates')
        .select('preset_key, color_primary, font_family, show_logo, show_watermark, legal_notice, logo_position')
        .eq('id', templateId)
        .eq('workspace_id', doc.workspace_id)
        .maybeSingle()
      if (t) template = t
    }
    if (!template) {
      const { data: t } = await admin
        .from('templates')
        .select('preset_key, color_primary, font_family, show_logo, show_watermark, legal_notice, logo_position')
        .eq('workspace_id', doc.workspace_id)
        .eq('is_default', true)
        .maybeSingle()
      if (t) template = t
    }
    if (!template) {
      const { data: t } = await admin
        .from('templates')
        .select('preset_key, color_primary, font_family, show_logo, show_watermark, legal_notice, logo_position')
        .eq('workspace_id', doc.workspace_id)
        .limit(1)
        .maybeSingle()
      if (t) template = t
    }
  }

  // ── Canali "Come pagare" (colonne 038 — tollerante se mancano) ──────────
  let payment: PdfDocumentData['payment'] = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
    const { data: payWs } = await (admin as any)
      .from('workspaces')
      .select('payment_iban, payment_iban_holder, payment_paypal_url, payment_satispay_url, payment_notes')
      .eq('id', doc.workspace_id)
      .maybeSingle()
    if (payWs) {
      payment = {
        iban: payWs.payment_iban ?? null,
        ibanHolder: payWs.payment_iban_holder ?? null,
        paypalUrl: payWs.payment_paypal_url ?? null,
        satispayUrl: payWs.payment_satispay_url ?? null,
        notes: payWs.payment_notes ?? null,
      }
    }
  } catch { /* migration non ancora applicata */ }

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      fiscal_regime:   workspace.fiscal_regime as any,
    },
    client: doc.clients as PdfDocumentData['client'],
    template,
    payment,
  }

  // ── Genera HTML per stampa ────────────────────────────────
  // preview=1 → solo visualizzazione (no dialogo stampa)
  // default  → apre dialogo stampa automaticamente
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
