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
    .select('id, name, ragione_sociale, piva, indirizzo, cap, citta, provincia, logo_url, fiscal_regime')
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
      { error: 'Impossibile inviare un preventivo senza voci' },
      { status: 422 }
    )
  }

  // ── Template ────────────────────────────────────────────────
  let template: PdfDocumentData['template'] = null

  if (doc.template_snapshot) {
    const snap = doc.template_snapshot as Record<string, unknown>
    template = {
      color_primary: (snap.color_primary as string) ?? '#1a1a2e',
      font_family:   (snap.font_family   as string) ?? 'Inter',
      show_logo:     (snap.show_logo     as boolean) ?? true,
      show_watermark:(snap.show_watermark as boolean) ?? false,
      legal_notice:  (snap.legal_notice  as string) ?? null,
    }
  } else {
    const { data: defaultTmpl } = await supabase
      .from('templates')
      .select('color_primary, font_family, show_logo, show_watermark, legal_notice')
      .eq('workspace_id', workspace.id)
      .eq('is_default', true)
      .maybeSingle()
    template = defaultTmpl ?? null
  }

  // ── Genera PDF ──────────────────────────────────────────────
  const pdfData: PdfDocumentData = {
    document:  doc as PdfDocumentData['document'],
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

  const fileSlug = (doc.doc_number ?? id).replace(/\//g, '-')

  // ── Invia email ─────────────────────────────────────────────
  const result = await sendEmail({
    to:      body.to,
    subject: body.subject,
    react: React.createElement(PreventivoEmail, {
      senderName,
      recipientName: clientName,
      docNumber:     doc.doc_number,
      totalFormatted,
      message:       body.message,
      publicUrl,
    }),
    replyTo: undefined, // usa il FROM_EMAIL di default
    attachments: [
      {
        filename: `preventivo-${fileSlug}.pdf`,
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

  // ── Aggiorna stato documento ────────────────────────────────
  // Per i draft: transizione a 'sent' + sent_at.
  // Per sent/viewed (reinvio): non tocca lo stato, aggiorna solo sent_at.
  const updatePayload = doc.status === 'draft'
    ? { status: 'sent' as const, sent_at: new Date().toISOString() }
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

  revalidatePath('/preventivi')
  revalidatePath(`/preventivi/${id}`)

  return NextResponse.json({ ok: true })
}
