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
import { isFreePlan } from '@/lib/plan/gate'
import type { PdfDocumentData } from '@/lib/pdf/template'
import { resolveWorkspaceForUser } from '@/lib/actions/resolve-workspace'

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

  // Prima come titolare, poi come collaboratore invitato (piano Team).
  const workspace = await resolveWorkspaceForUser(supabase, user.id,
    'id, ragione_sociale, name, piva, indirizzo, cap, citta, provincia, logo_url, fiscal_regime, plan, free_trial_expires_at, sent_quota_used')

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
    .is('deleted_at', null)
    .maybeSingle()

  if (!doc) {
    return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })
  }

  // ── Blocco Free: apertura bozza (solo PREVENTIVI) ─────
  // Le fatture non hanno tetto sull'anteprima/PDF: il limite fatture (083)
  // morde solo sull'invio al cliente, mai su creazione/PDF/SdI.
  if (doc.status === 'draft' && doc.doc_type === 'preventivo' && workspace.plan === 'free') {
    const trial = checkFreeBlock(workspace)
    if (trial.blocked) {
      // Il link Anteprima è un <a target="_blank">: un JSON grezzo in un tab
      // nuovo è illeggibile per l'utente → meglio la pagina abbonamento.
      return NextResponse.redirect(new URL('/abbonamento', request.url))
    }
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

  // ── Canali "Come pagare" (colonne 038 — tollerante se mancano) ──────────
  let payment: PdfDocumentData['payment'] = null
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
    const { data: payWs } = await (supabase as any)
      .from('workspaces')
      .select('payment_iban, payment_iban_holder, payment_paypal_url, payment_satispay_url, payment_notes')
      .eq('id', workspace.id)
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
      fiscal_regime:   workspace.fiscal_regime,
    },
    client: doc.clients as PdfDocumentData['client'],
    template,
    payment,
  }

  // ── Genera HTML per stampa ────────────────────────────────
  // preview=true → solo visualizzazione (no dialogo stampa)
  // preview=false → apre dialogo stampa automaticamente
  const logoBase64 = await fetchLogoBase64(workspace.logo_url)
  const html = buildPdfHtml({ ...pdfData, logoBase64, isFree: isFreePlan(workspace.plan) })
  const printHtml = preparePrintHtml(html, !preview)

  return new NextResponse(printHtml, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  })
}
