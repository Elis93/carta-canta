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
import { isDocFreeLocked } from '@/lib/plan/free-lock'
import { allocateDocNumber, allocateInvoiceNumber } from '@/lib/actions/documents'
import { registraConfermaFiscale } from '@/lib/documents/conferma-fiscale'
import { tierDuplicateSendError } from '@/lib/documents/tier-check'
import { resolveWorkspaceForUser } from '@/lib/actions/resolve-workspace'
import { stripPrefissoLegacy } from '@/lib/utils'

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
  /** Id di un cliente selezionato esplicitamente dall'autocomplete — nessuna ambiguità, si associa direttamente */
  clientId?: string
  /** true = l'utente ha confermato di voler usare un cliente esistente con la stessa email */
  confirmClientMatch?: boolean
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

  const clientId = typeof b.clientId === 'string' && b.clientId.trim()
    ? b.clientId.trim()
    : undefined

  const confirmClientMatch = b.confirmClientMatch === true

  return { to, subject, message, clientName, clientId, confirmClientMatch }
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
  // Prima come titolare, poi come collaboratore invitato (piano Team).
  const workspace = await resolveWorkspaceForUser(supabase, user.id,
    'id, name, ragione_sociale, piva, indirizzo, cap, citta, provincia, logo_url, fiscal_regime, plan, free_trial_expires_at, sent_quota_used, sent_invoice_quota_used')

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
    .is('deleted_at', null)
    .maybeSingle()

  if (!doc) {
    return NextResponse.json({ error: 'Documento non trovato' }, { status: 404 })
  }

  // Accetta draft (primo invio) e sent/viewed (reinvio link al cliente).
  // Per le FATTURE anche expired e accepted (review 25 lug #2): "scaduta" è
  // solo il pagamento in ritardo (il sollecito via email è proprio il caso
  // d'uso) e "pagata" è la copia di cortesia/quietanza — non ha senso vietarle.
  const resendable = doc.doc_type === 'fattura'
    ? ['draft', 'sent', 'viewed', 'expired', 'accepted']
    : ['draft', 'sent', 'viewed']
  if (!resendable.includes(doc.status)) {
    return NextResponse.json(
      {
        error: doc.doc_type === 'fattura'
          ? 'Impossibile inviare: la fattura è annullata.'
          : 'Impossibile inviare: il documento è già stato accettato, rifiutato o scaduto.',
      },
      { status: 422 }
    )
  }

  // ── Downgrade Pro→Free: documento bloccato (oltre gli 8 inviati) ──────
  // La sola lettura vieta anche il REINVIO (Eli, 12 ago). Le bozze non sono
  // mai bloccate qui (il primo invio della 9ª è già fermato dal contatore
  // Free più sotto): isDocFreeLocked ritorna false per le bozze.
  if (await isDocFreeLocked(supabase, { plan: workspace.plan, id: workspace.id }, doc)) {
    return NextResponse.json(
      { error: 'Documento bloccato: è oltre gli 8 del piano gratuito. Torna a Pro per inviarlo.' },
      { status: 403 }
    )
  }

  // T-20 (sessione FIX-13): guardia server-side robusta — replica la stessa
  // condizione di `hasVoci` calcolata lato pagina (preventivi/[id] e fatture/[id]):
  // almeno una voce con descrizione non vuota + prezzo > 0 + quantità > 0.
  // Il vecchio controllo `doc.total === 0` non bastava: il toolbar/SendEmailDialog
  // valida `hasVoci` sullo stato SALVATO nel DB al caricamento della pagina, non
  // sullo stato corrente (non salvato) del form — se l'utente svuota le voci nel
  // form senza salvare e poi invia dalla toolbar, la richiesta arriva qui con il
  // documento DB ancora con le voci precedenti. Questo controllo è quindi
  // l'ultima linea di difesa indipendente dal client per QUALSIASI percorso di invio.
  const docItemsForCheck = Array.isArray((doc as Record<string, unknown>).document_items)
    ? (doc as Record<string, unknown>).document_items as Array<Record<string, unknown>>
    : []
  const hasCompleteVoce = docItemsForCheck.some(item =>
    String(item.description ?? '').trim() !== '' &&
    Number(item.unit_price ?? 0) > 0 &&
    Number(item.quantity ?? 0) > 0
  )
  if (!hasCompleteVoce) {
    return NextResponse.json(
      { error: 'Impossibile inviare un documento senza voci' },
      { status: 422 }
    )
  }
  // PRIMO INVIO di una bozza: TUTTE le voci devono essere complete. Le bozze
  // possono contenere voci "da completare" (prezzo/quantità 0, es. proposte
  // dall'AI dalle foto) e non devono partire verso il cliente con totali a 0.
  // Sui re-invii il controllo resta il precedente (documenti storici).
  if (doc.status === 'draft') {
    const hasIncompleteVoce = docItemsForCheck.some(item =>
      String(item.description ?? '').trim() === '' ||
      Number(item.unit_price ?? 0) <= 0 ||
      Number(item.quantity ?? 0) <= 0
    )
    if (hasIncompleteVoce) {
      return NextResponse.json(
        { error: 'Una o più voci sono ancora da completare (prezzo o quantità a zero). Completale prima di inviare.' },
        { status: 422 }
      )
    }
    // Proposte identiche (l'auto-save aggira il blocco client): niente
    // primo invio finché Base e Premium non si differenziano.
    const tierDupErr = tierDuplicateSendError(docItemsForCheck)
    if (tierDupErr) {
      return NextResponse.json({ error: tierDupErr }, { status: 422 })
    }
  }

  // ── Auto-crea contatto se il documento non ha ancora un cliente ───────────
  // Se clientName è fornito e il documento non ha ancora client_id:
  // trova un contatto esistente per email o ne crea uno nuovo, poi
  // aggiorna il documento. Il client join (doc.clients) viene sovrascritto
  // da pdfClientOverride per il resto della route.
  type ClientRow = { name: string; email: string | null; phone: string | null; piva: string | null; indirizzo: string | null; cap: string | null; citta: string | null; provincia: string | null; paese: string | null }
  let pdfClientOverride: ClientRow | null = doc.clients as ClientRow | null

  // Se il documento non ha ancora un cliente e l'email di invio è fornita,
  // creiamo/associamo il cliente automaticamente — anche senza un nome esplicito.
  // Questo garantisce che il destinatario appaia sempre nel documento (PDF + detail page).
  if (!doc.client_id && body.clientId) {
    // ── Cliente scelto esplicitamente dall'autocomplete (CHECK-1) ──────────
    // Nessuna ambiguità: l'utente ha selezionato un contatto preciso.
    // Associamo direttamente, dopo aver verificato che appartenga al workspace,
    // e saltiamo del tutto il controllo conflitto (non serve: la scelta è esplicita).
    const { data: chosenClient } = await supabase
      .from('clients')
      .select('id, name, email, phone, piva, indirizzo, cap, citta, provincia, paese')
      .eq('id', body.clientId)
      .eq('workspace_id', workspace.id)
      .maybeSingle()

    if (chosenClient) {
      pdfClientOverride = chosenClient as ClientRow
      const { error: assocErr } = await supabase
        .from('documents')
        .update({ client_id: chosenClient.id })
        .eq('id', id)
        .eq('workspace_id', workspace.id)

      if (assocErr) {
        console.error('[send-email] Client association failed:', assocErr)
      }
    }
  } else if (!doc.client_id && body.to) {
    // Il nome cliente: dall'input del dialog oppure usiamo l'email come fallback
    const resolvedClientName = body.clientName?.trim() || body.to

    // Cerca un contatto esistente per email nel workspace
    const { data: existingClient } = await supabase
      .from('clients')
      .select('id, name, surname, email, phone, piva, indirizzo, cap, citta, provincia, paese')
      .eq('workspace_id', workspace.id)
      .eq('email', body.to)
      .maybeSingle()

    // ── Conflitto cliente: stessa email, nome diverso ──────────
    // Se l'utente ha digitato un nome esplicito e quell'email appartiene già
    // a un contatto con nome (e cognome) diverso, chiediamo conferma prima di
    // procedere (non si possono creare due clienti con la stessa email).
    // Confrontiamo il nome COMPLETO (nome + cognome): la select includeva solo
    // 'name' e veniva confrontata con "Nome Cognome" digitato nel dialog,
    // generando falsi conflitti per ogni contatto con cognome valorizzato.
    const existingFullName = existingClient
      ? [existingClient.name, existingClient.surname].filter(Boolean).join(' ').trim().toLowerCase()
      : ''
    if (
      existingClient &&
      body.clientName &&
      !body.confirmClientMatch &&
      existingFullName !== body.clientName.trim().toLowerCase()
    ) {
      return NextResponse.json(
        {
          ok: false,
          clientConflict: {
            id:    existingClient.id,
            name:  [existingClient.name, existingClient.surname].filter(Boolean).join(' '),
            email: existingClient.email,
          },
        },
        { status: 200 }
      )
    }

    let resolvedClientId: string
    if (existingClient) {
      resolvedClientId = existingClient.id
      pdfClientOverride = existingClient as unknown as ClientRow
    } else {
      const { data: newClient, error: insertErr } = await supabase
        .from('clients')
        .insert({ workspace_id: workspace.id, name: resolvedClientName, email: body.to })
        .select('id, name, email, phone, piva, indirizzo, cap, citta, provincia, paese')
        .single()

      if (insertErr || !newClient) {
        console.error('[send-email] Client creation failed:', insertErr)
        // Non blocchiamo l'invio per un errore di creazione contatto
      } else {
        resolvedClientId = newClient.id
        pdfClientOverride = newClient as ClientRow
      }
    }

    // Associa il cliente al documento (il client_id aggiornato è visibile nelle
    // pagine di dettaglio e nel link pubblico che ricaricano il documento dal DB)
    if (resolvedClientId!) {
      const { error: assocErr } = await supabase
        .from('documents')
        .update({ client_id: resolvedClientId })
        .eq('id', id)
        .eq('workspace_id', workspace.id)

      if (assocErr) {
        console.error('[send-email] Client association failed:', assocErr)
      }
    }
  }

  // ── Template ────────────────────────────────────────────────
  // Priorità: snapshot salvato → template assegnato al doc → template default → primo disponibile
  let template: PdfDocumentData['template'] = null

  if (doc.template_snapshot) {
    const snap = doc.template_snapshot as Record<string, unknown>
    template = {
      preset_key:    (snap.preset_key    as string) ?? 'classico',
      color_primary: (snap.color_primary as string) ?? '#374151',
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
  // Preventivi e fatture: 8 ciascuno, contatori separati (083). Le note di
  // credito non consumano quota → nessun blocco.
  if (doc.status === 'draft' && workspace.plan === 'free' && (doc.doc_type === 'preventivo' || doc.doc_type === 'fattura')) {
    const trial = checkFreeBlock(workspace, doc.doc_type)
    if (trial.blocked) {
      return NextResponse.json(
        {
          error: 'trial_blocked',
          message: doc.doc_type === 'fattura'
            ? 'Hai inviato le 8 fatture del piano gratuito. Torna a Pro per inviarne altre.'
            : trial.reason === 'trial_expired'
              ? 'Il periodo di prova Free è terminato. Passa a Pro per continuare.'
              : `Hai raggiunto il limite di ${trial.docsUsed} preventivi del piano gratuito. Passa a Pro per preventivi illimitati.`,
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
  // Con un ACCONTO gia incassato il badge dell'email mostra il RESIDUO
  // (review 25 lug C3): il totale pieno contraddiceva il "Saldo da pagare"
  // che il cliente trova aprendo il link.
  const docPay = doc as Record<string, unknown>
  const emailAmount = doc.doc_type === 'fattura' && docPay.payment_status === 'partial'
    ? Math.max(0, Number(doc.total ?? 0) - Number(docPay.paid_amount ?? 0))
    : Number(doc.total ?? 0)
  const totalFormatted = `€\u00A0${emailAmount.toLocaleString('it-IT', {
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
      docNumber:     finalDocNumber ? stripPrefissoLegacy(finalDocNumber) : finalDocNumber,
      totalFormatted,
      message:       body.message,
      publicUrl,
      docType:       (doc.doc_type === 'fattura' ? 'fattura' : 'preventivo') as 'preventivo' | 'fattura',
      ownerEmail:    user.email ?? null,
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
    console.log(`[send-email] Accepted by Resend — messageId: ${result.messageId} — doc: ${id}`)
  }

  // ── Aggiorna stato documento ────────────────────────────────
  // Primo invio (draft): transizione 'sent', assegna sent_at, doc_number, expires_at.
  // Reinvio (sent/viewed): NON sovrascrive sent_at (per conservare il timestamp originale
  //   nella cronologia). Appende un evento 'resent' al document_log.
  const isFirstSend = doc.status === 'draft'
  const sentAt = new Date()

  const docItems = Array.isArray((doc as Record<string, unknown>).document_items)
    ? (doc as Record<string, unknown>).document_items as unknown[]
    : []
  const snapshot = buildSentSnapshot(doc as Record<string, unknown>, docItems)

  // Aggiorna document_log con evento 'resent' (solo sui reinvii)
  const existingLog = Array.isArray((doc as Record<string, unknown>).document_log)
    ? (doc as Record<string, unknown>).document_log as Array<{ type: string; at: string }>
    : []
  // Scadenze calcolate PRIMA del log: ogni nuovo termine è anche una voce di
  // cronologia (`expiry_set`, Eli 25 ago), scritta nella stessa update.
  const firstValidity = ((doc as Record<string, unknown>).validity_days as number | null) ?? 30
  const firstExpiry = new Date(sentAt)
  firstExpiry.setDate(firstExpiry.getDate() + firstValidity)
  // Al REINVIO la scadenza riparte (decisione: expires_at riparte SOLO
  // al (re)invio, mai al semplice salvataggio)
  const newExpiry = new Date()
  newExpiry.setDate(newExpiry.getDate() + firstValidity)
  // Fattura PAGATA reinviata = copia di cortesia/quietanza: la scadenza
  // di pagamento NON deve ripartire (review 25 lug C1 — su una fattura
  // incassata una nuova scadenza è un controsenso).
  const keepExpiry = doc.doc_type === 'fattura' && doc.status === 'accepted'

  const updatedLog = isFirstSend
    ? [...existingLog, { type: 'expiry_set', at: sentAt.toISOString(), expires: firstExpiry.toISOString() }]
    : [
        ...existingLog,
        { type: 'resent', at: sentAt.toISOString() },
        ...(keepExpiry ? [] : [{ type: 'expiry_set', at: sentAt.toISOString(), expires: newExpiry.toISOString() }]),
      ]

  const { error: updateError } = isFirstSend
    ? await (() => {
        return supabase
          .from('documents')
          .update({
            status: 'sent' as const,
            sent_at: sentAt.toISOString(),
            doc_number: finalDocNumber,
            expires_at: firstExpiry.toISOString(),
            pdf_url: null,
            sent_snapshot: snapshot as unknown as Json,
            updated_after_send_at: null,
            document_log: updatedLog as unknown as Json,
          })
          .eq('id', id)
          .eq('workspace_id', workspace.id)
      })()
    : await (async () => {
        return supabase
          .from('documents')
          .update({
            // sent_at NON viene sovrascritto: il timestamp originale resta in cronologia
            // Fattura SCADUTA reinviata (sollecito): torna "inviata, da
            // incassare" con la nuova scadenza — restare 'expired' con
            // expires_at nel futuro sarebbe incoerente (review 25 lug #2).
            ...(doc.doc_type === 'fattura' && doc.status === 'expired' ? { status: 'sent' } : {}),
            sent_snapshot: snapshot as unknown as Json,
            updated_after_send_at: null,
            ...(keepExpiry ? {} : { expires_at: newExpiry.toISOString() }),
            document_log: updatedLog as unknown as Json,
          })
          .eq('id', id)
          .eq('workspace_id', workspace.id)
      })()

  if (updateError) {
    // L'email è già partita: logghiamo l'errore con tutti i dettagli per il debug.
    console.error('[send-email] CRITICAL: status update failed after successful email send:', updateError)
    console.error('[send-email] Document id:', id, '| finalDocNumber:', finalDocNumber)
    // Risposta ONESTA (review 25 lug #3): l'email è partita ma lo stato non è
    // stato salvato — senza questo warning l'utente vedeva "inviato" e il
    // documento restava una bozza (per poi ricevere aperture su un documento
    // "mai inviato").
    return NextResponse.json({
      ok: true,
      warning: 'L’email è partita, ma non sono riuscito a salvare lo stato del documento: ricarica la pagina e, se risulta ancora bozza, NON reinviarla — scrivici da Aiuto.',
    })
  }

  // Conferma della bozza (080): data fiscale + eventuale pilota automatico
  if (isFirstSend) {
    await registraConfermaFiscale(supabase, workspace.id, id, doc.doc_type)
  }

  // Incrementa il contatore storico solo al primo invio (draft → sent).
  // Non decrementato mai: sopravvive alle delete del documento.
  // I reinvii (sent/viewed) non consumano un nuovo slot.
  // Preventivi e fatture: contatori SEPARATI, 8 ciascuno (083). La nota di
  // credito non consuma. Solo al primo invio ASSOLUTO (sent_at null): un
  // accettato ri-editato (torna draft) non viene contato due volte.
  if (isFirstSend && workspace.plan === 'free' && !(doc as Record<string, unknown>).sent_at) {
    // Incremento ATOMICO via RPC (059/083): il read-modify-write perdeva
    // incrementi con invii concorrenti. Fallback pre-migration al vecchio metodo.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC non ancora in types/database.ts
    const sb = supabase as any
    if (doc.doc_type === 'preventivo') {
      const { error: rpcErr } = await sb.rpc('increment_sent_quota', { p_workspace_id: workspace.id })
      if (rpcErr) await supabase.from('workspaces').update({ sent_quota_used: workspace.sent_quota_used + 1 }).eq('id', workspace.id)
    } else if (doc.doc_type === 'fattura') {
      const { error: rpcErr } = await sb.rpc('increment_invoice_quota', { p_workspace_id: workspace.id })
      if (rpcErr) await supabase.from('workspaces').update({ sent_invoice_quota_used: ((workspace as { sent_invoice_quota_used?: number }).sent_invoice_quota_used ?? 0) + 1 }).eq('id', workspace.id)
    }
  }

  revalidatePath('/preventivi')
  revalidatePath(`/preventivi/${id}`)
  revalidatePath('/fatture')
  revalidatePath(`/fatture/${id}`)

  return NextResponse.json({ ok: true })
}
