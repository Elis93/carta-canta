// ============================================================
// POST /api/documents/[id]/send-email
//
// Invia al destinatario l'email con il link pubblico al documento.
// Non allega PDF: il cliente visualizza il preventivo/fattura
// direttamente nel browser via /p/[token] (buildPdfHtml).
// Aggiorna lo stato del documento a "sent" e salva uno snapshot.
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
import { sendEmail } from '@/lib/email/send'
import { PreventivoEmail } from '@/components/email/PreventivoEmail'
import type { PdfDocumentData } from '@/lib/pdf/template'
import type { Json } from '@/types/database'
import { revalidatePath } from 'next/cache'
import React from 'react'
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit'
import { checkFreeBlock } from '@/lib/free-trial'
import { allocateDocNumber, allocateInvoiceNumber } from '@/lib/actions/documents'

interface Params {
  params: Promise<{ id: string }>
}

// ── Helper: costruisce lo snapshot da salvare al momento dell'invio ─────────
function buildSentSnapshot(
  doc: Record<string, unknown>,
  docItems: unknown[]
) {
  return {
    fields: {
      title:            doc.title            ?? null,
      notes:            doc.notes            ?? null,
      internal_notes:   doc.internal_notes   ?? null,
      discount_pct:     doc.discount_pct     ?? null,
      discount_fixed:   doc.discount_fixed   ?? null,
      vat_rate_default: doc.vat_rate_default ?? null,
      validity_days:    doc.validity_days    ?? 30,
      payment_terms:    doc.payment_terms    ?? null,
    },
    items: docItems,
  }
}

// ── Validazione body ───────────────────────────────────────────────────────

interface SendEmailBody {
  to: string
  subject: string
  message: string
  /** Nome/ragione sociale del cliente — opzionale, solo se non c'è ancora un contatto associato */
  clientName?: string
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

  const clientName = typeof b.clientName === 'string' && b.clientName.trim()
    ? b.clientName.trim()
    : undefined

  return { to, subject, message, clientName }
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

  // ── Auto-crea contatto se il documento non ha ancora un cliente ───────────
  // Se clientName è fornito e il documento non ha ancora client_id:
  // trova un contatto esistente per email o ne crea uno nuovo, poi
  // aggiorna il documento. Il client join (doc.clients) viene sovrascritto
  // da pdfClientOverride per il resto della route.
  type ClientRow = { name: string; email: string | null; phone: string | null; piva: string | null; indirizzo: string | null; cap: string | null; citta: string | null; provincia: string | null; paese: string | null }
  let pdfClientOverride: ClientRow | null = doc.clients as ClientRow | null

  if (!doc.client_id && body.clientName) {
    // Cerca per email nel workspace
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id, name, email, phone, piva, indirizzo, cap, citta, provincia, paese')
      .eq('workspace_id', workspace.id)
      .eq('email', body.to)
      .maybeSingle()

    let resolvedClientId: string
    if (existingClient) {
      resolvedClientId = existingClient.id
      pdfClientOverride = existingClient as ClientRow
    } else {
      const { data: newClient, error: insertErr } = await supabase
        .from('clients')
        .insert({ workspace_id: workspace.id, name: body.clientName, email: body.to })
        .select('id, name, email, phone, piva, indirizzo, cap, citta, provincia, paese')
        .single()

      if (insertErr || !newClient) {
        console.error('[send-email] Client creation failed:', insertErr)
        return NextResponse.json(
          { error: 'Impossibile creare il contatto cliente. Riprova.' },
          { status: 500 }
        )
      }
      resolvedClientId = newClient.id
      pdfClientOverride = newClient as ClientRow
    }

    // Associa il cliente al documento
    const { error: assocErr } = await supabase
      .from('documents')
      .update({ client_id: resolvedClientId })
      .eq('id', id)
      .eq('workspace_id', workspace.id)

    if (assocErr) {
      console.error('[send-email] Client association failed:', assocErr)
      // Non blocchiamo l'invio: il contatto è creato, l'associazione si può ritentare
    }
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

  // ── Alloca numero documento se ancora null ─────────────────
  // Usa gli stessi helper di sendDocumentAction e registerManualSendAction
  // (allocateDocNumber / allocateInvoiceNumber), che lanciano eccezione in caso
  // di errore e garantiscono che il numero sia sempre assegnato prima dell'invio.
  let finalDocNumber = doc.doc_number
  if (!finalDocNumber && doc.status === 'draft') {
    try {
      finalDocNumber = doc.doc_type === 'fattura'
        ? await allocateInvoiceNumber(workspace.id)
        : await allocateDocNumber(workspace.id)
    } catch {
      return NextResponse.json(
        { error: 'Impossibile generare il numero documento. Riprova.' },
        { status: 500 }
      )
    }
  }
  // Documento in-memory con il numero aggiornato (usato per PDF e email)
  const docWithNumber = finalDocNumber !== doc.doc_number
    ? { ...doc, doc_number: finalDocNumber }
    : doc

  // ── Prepara email ───────────────────────────────────────────
  const senderName = workspace.ragione_sociale ?? workspace.name
  const clientName = pdfClientOverride?.name ?? null
  const totalFormatted = `€ ${Number(doc.total ?? 0).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`

  // URL pubblico (se il documento ha un public_token)
  const appOrigin = new URL(request.url).origin
  const publicUrl = doc.public_token
    ? `${appOrigin}/p/${doc.public_token}`
    : null

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
  // Per i draft: transizione a 'sent' + sent_at + doc_number + expires_at + pdf_url null.
  // Per sent/viewed (reinvio): aggiorna solo sent_at.
  const isFirstSend = doc.status === 'draft'
  const sentAt = new Date()

  const docItems = Array.isArray((doc as Record<string, unknown>).document_items)
    ? (doc as Record<string, unknown>).document_items as unknown[]
    : []
  const snapshot = buildSentSnapshot(doc as Record<string, unknown>, docItems)

  const { error: updateError } = isFirstSend
    ? await (() => {
        const validityDays = (doc as Record<string, unknown>).validity_days as number ?? 30
        const expiresAt = new Date(sentAt)
        expiresAt.setDate(expiresAt.getDate() + validityDays)
        return supabase
          .from('documents')
          .update({
            status: 'sent' as const,
            sent_at: sentAt.toISOString(),
            doc_number: finalDocNumber,
            expires_at: expiresAt.toISOString(),
            pdf_url: null, // invalida cache PDF (watermark bozza → rimuovere)
            sent_snapshot: snapshot as unknown as Json,
            updated_after_send_at: null,
          })
          .eq('id', id)
          .eq('workspace_id', workspace.id)
      })()
    : await supabase
        .from('documents')
        .update({
          sent_at: sentAt.toISOString(),
          sent_snapshot: snapshot as unknown as Json,
          updated_after_send_at: null,
        })
        .eq('id', id)
        .eq('workspace_id', workspace.id)

  if (updateError) {
    // L'email è già partita: logghiamo l'errore con tutti i dettagli per il debug.
    console.error('[send-email] CRITICAL: status update failed after successful email send:', updateError)
    console.error('[send-email] Document id:', id, '| finalDocNumber:', finalDocNumber)
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
