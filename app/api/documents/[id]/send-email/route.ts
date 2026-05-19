// ============================================================
// POST /api/documents/[id]/send-email
//
// Genera il PDF del preventivo, lo allega a un'email e la invia
// al destinatario indicato tramite Resend. Aggiorna poi lo stato
// del documento a "sent".
//
// Body JSON atteso:
//   {
//     to:      string   // email destinatario (obbligatorio)
//     subject: string   // oggetto email (obbligatorio)
//     message: string   // corpo testo personalizzato (obbligatorio)
//   }
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generatePdfBuffer } from '@/lib/pdf/generate'
import { sendEmail } from '@/lib/email/send'
import { PreventivoEmail } from '@/components/email/PreventivoEmail'
import type { PdfDocumentData } from '@/lib/pdf/template'
import { revalidatePath } from 'next/cache'
import React from 'react'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { checkFreeBlock } from '@/lib/free-trial'

interface Params {
  params: Promise<{ id: string }>
}

// ── Validazione body ───────────────────────────────────────────────────────

interface SendEmailBody {
  to: string
  subject: string
  message: string
}

function validateBody(raw: unknown): SendEmailBody | null {
  if (!raw || typeof raw !== 'object') return null
  const b = raw as Record<string, unknown>

  const to      = typeof b.to      === 'string' ? b.to.trim()      : ''
  const subject = typeof b.subject === 'string' ? b.subject.trim() : ''
  const message = typeof b.message === 'string' ? b.message.trim() : ''

  if (!to || !subject || !message) return null

  // Validazione email di base
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) return null

  return { to, subject, message }
}

// ── Handler ────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params

  // ── Auth ────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  }

  // ── Body ────────────────────────────────────────────────────
  let body: SendEmailBody | null = null
  try {
    body = validateBody(await request.json())
  } catch {
    return NextResponse.json({ error: 'Body non valido' }, { status: 400 })
  }
  if (!body) {
    return NextResponse.json(
      { error: 'Campi obbligatori mancanti o email non valida' },
      { status: 400 }
    )
  }

  // ── Rate limit: 10 email / ora per workspace ────────────────
  // Applicato dopo auth ma prima della query workspace per non sprecare
  // una round-trip in caso di burst. La chiave include user.id per isolamento.
  const rlEarly = checkRateLimit(`send-email:${user.id}`, { limit: 10, windowMs: 3_600_000 })
  if (!rlEarly.success) {
    return rateLimitResponse(rlEarly.resetAt, 'Hai raggiunto il limite di 10 email all\'ora. Riprova più tardi.')
  }

  // ── Workspace ───────────────────────────────────────────────
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, ragione_sociale, piva, indirizzo, cap, citta, provincia, logo_url, fiscal_regime, plan, free_trial_expires_at, sent_quota_used')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace non trovato' }, { status: 404 })
  }

  // ── Documento ───────────────────────────────────────────────
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

  // Accetta draft (primo invio) e sent/viewed (reinvio link al cliente)
  if (!['draft', 'sent', 'viewed'].includes(doc.status)) {
    return NextResponse.json(
      { error: 'Impossibile inviare: il documento è già stato accettato, rifiutato o scaduto.' },
      { status: 422 }
    )
  }

  if (!doc.total || Number(doc.total) === 0) {
    return NextResponse.json(
      { error: 'Impossibile inviare un documento senza voci' },
      { status: 422 }
    )
  }

  // ── Template ────────────────────────────────────────────────
  // Priorità: snapshot salvato → template assegnato al doc → template default → primo disponibile
  let template: PdfDocumentData['template'] = null

  if (doc.template_snapshot) {
    const snap = doc.template_snapshot as Record<string, unknown>
    template = {
      preset_key:    (snap.preset_key    as string) ?? 'classico',
      color_primary: (snap.color_primary as string) ?? '#1a1a2e',
      font_family:   (snap.font_family   as string) ?? 'Inter',
      show_logo:     (snap.show_logo     as boolean) ?? true,
      show_watermark:(snap.show_watermark as boolean) ?? true,
      legal_notice:  (snap.legal_notice  as string) ?? null,
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

    // 2. Template di default del workspace
    if (!template) {
      const { data: defaultTmpl } = await supabase
        .from('templates')
        .select('preset_key, color_primary, font_family, show_logo, show_watermark, legal_notice, logo_position')
        .eq('workspace_id', workspace.id)
        .eq('is_default', true)
        .maybeSingle()
      if (defaultTmpl) template = defaultTmpl
    }

    // 3. Qualsiasi template disponibile nel workspace
    if (!template) {
      const { data: anyTmpl } = await supabase
        .from('templates')
        .select('preset_key, color_primary, font_family, show_logo, show_watermark, legal_notice, logo_position')
        .eq('workspace_id', workspace.id)
        .limit(1)
        .maybeSingle()
      if (anyTmpl) template = anyTmpl
    }

    // 4. Se template ancora null: nessun template nel workspace.
    //    buildPdfHtml gestisce null con stili di default — l'invio procede comunque.
  }

  // ── Blocco Free: applicato solo ai draft (primo invio) ──────
  // I reinvii (sent/viewed) non consumano slot e non vengono bloccati.
  if (doc.status === 'draft' && workspace.plan === 'free') {
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

  // ── Alloca numero documento se ancora null (Fix-14) ────────
  // La route non passava per sendDocumentAction, quindi il numero
  // non veniva mai assegnato ai draft inviati via email.
  let finalDocNumber = doc.doc_number
  if (!finalDocNumber && doc.status === 'draft') {
    const year = new Date().getFullYear()
    const isFattura = doc.doc_type === 'fattura'
    const { data: seqData, error: seqError } = await supabase.rpc('next_invoice_number', {
      p_workspace: workspace.id,
      p_year: year,
      p_doc_type: isFattura ? 'fattura' : 'preventivo',
    })
    if (seqError) {
      console.error('[send-email] Sequence allocation failed:', seqError)
      return NextResponse.json(
        { error: 'Impossibile assegnare il numero documento. Riprova tra qualche istante.' },
        { status: 500 }
      )
    }
    if (seqData !== null) {
      const n = (seqData as number).toString().padStart(3, '0')
      // FIX-29: aggiunge il prefisso coerente con allocateDocNumber / allocateInvoiceNumber
      const prefix = isFattura ? 'Fatt' : 'Prev'
      finalDocNumber = `${prefix}${n}/${year}`
    }
  }
  // Documento in-memory con il numero aggiornato (usato per PDF e email)
  const docWithNumber = finalDocNumber !== doc.doc_number
    ? { ...doc, doc_number: finalDocNumber }
    : doc

  // ── Genera PDF ──────────────────────────────────────────────
  const pdfData: PdfDocumentData = {
    document:  docWithNumber as PdfDocumentData['document'],
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
    client:   doc.clients as PdfDocumentData['client'],
    template,
  }

  let pdfBuffer: Buffer
  try {
    pdfBuffer = await generatePdfBuffer(pdfData)
  } catch (err) {
    console.error('[send-email] PDF generation failed:', err)
    return NextResponse.json(
      { error: 'Errore durante la generazione del PDF. Riprova tra qualche istante.' },
      { status: 500 }
    )
  }

  // ── Prepara email ───────────────────────────────────────────
  const senderName = workspace.ragione_sociale ?? workspace.name
  const clientName = (doc.clients as { name?: string } | null)?.name ?? null
  const totalFormatted = `€ ${Number(doc.total ?? 0).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

  // URL pubblico (se il documento ha un public_token)
  const appOrigin = new URL(request.url).origin
  const publicUrl = doc.public_token
    ? `${appOrigin}/p/${doc.public_token}`
    : null

  const fileSlug = (finalDocNumber ?? id).replace(/\//g, '-')

  // ── Invia email ─────────────────────────────────────────────
  const result = await sendEmail({
    to:      body.to,
    subject: body.subject,
    react: React.createElement(PreventivoEmail, {
      senderName,
      recipientName: clientName,
      docNumber:     finalDocNumber,
      totalFormatted,
      message:       body.message,
      publicUrl,
      docType:       (doc.doc_type === 'fattura' ? 'fattura' : 'preventivo') as 'preventivo' | 'fattura',
    }),
    replyTo: user.email ?? undefined,
    attachments: [
      {
        filename: `${doc.doc_type ?? 'documento'}-${fileSlug}.pdf`,
        content: pdfBuffer,
      },
    ],
  })

  if (!result.success) {
    console.error('[send-email] Resend error:', result.error)
    return NextResponse.json(
      { error: `Invio email fallito: ${result.error ?? 'errore sconosciuto'}` },
      { status: 502 }
    )
  }

  // Log messageId per debug delivery (consultabile su Vercel logs e dashboard Resend)
  if (result.messageId) {
    console.log(`[send-email] Accepted by Resend — messageId: ${result.messageId} — to: ${body.to} — doc: ${id}`)
  }

  // ── Aggiorna stato documento ────────────────────────────────
  // Per i draft: transizione a 'sent' + sent_at + doc_number allocato.
  // Per sent/viewed (reinvio): non tocca lo stato, aggiorna solo sent_at.
  // FIX-32: salva template_snapshot al momento dell'invio se non già presente.
  // Questo congela il template usato per l'email così i PDF successivi sono coerenti.
  const isFirstSend = doc.status === 'draft'
  const snapshotToSave = (!doc.template_snapshot && template) ? template : undefined
  const updatePayload = isFirstSend
    ? {
        status: 'sent' as const,
        sent_at: new Date().toISOString(),
        doc_number: finalDocNumber,
        ...(snapshotToSave ? { template_snapshot: snapshotToSave } : {}),
      }
    : { sent_at: new Date().toISOString() }

  const { error: updateError } = await supabase
    .from('documents')
    .update(updatePayload)
    .eq('id', id)
    .eq('workspace_id', workspace.id)

  if (updateError) {
    // Email già inviata — loggiamo ma non blocchiamo la risposta
    console.error('[send-email] Status update failed:', updateError)
  }

  // Incrementa il contatore storico solo al primo invio (draft → sent).
  // Non decrementato mai: sopravvive alle delete del documento.
  // I reinvii (sent/viewed) non consumano un nuovo slot.
  if (isFirstSend && workspace.plan === 'free') {
    await supabase
      .from('workspaces')
      .update({ sent_quota_used: workspace.sent_quota_used + 1 })
      .eq('id', workspace.id)
  }

  revalidatePath('/preventivi')
  revalidatePath(`/preventivi/${id}`)
  revalidatePath('/fatture')
  revalidatePath(`/fatture/${id}`)

  return NextResponse.json({ ok: true })
}
