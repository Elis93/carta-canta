// ── FASE 1 della copia di cortesia (modello Aruba — Eli, 21 set 2026) ────────
//
// Con la fatturazione elettronica ATTIVA il flusso delle fatture si inverte:
// prima la trasmissione allo SdI (gesto esplicito), poi — all'esito POSITIVO —
// la copia di cortesia al cliente. È lo standard FiC/Aruba/WindDoc: «la copia
// parte solo dopo che lo SdI ha accettato la fattura» (una scartata è una
// fattura MAI esistita: se la copia fosse già in mano al cliente, avrebbe un
// documento che fiscalmente non esiste). Fonti: PROGETTO_COPIA_CORTESIA.md.
//
// Due pezzi:
//  · bloccoInvioCliente()          — la guardia dei percorsi di invio: con SdI
//    acceso, una fattura/nota senza esito positivo NON si manda al cliente.
//  · inviaCopiaCortesiaAutomatica() — la copia che PARTE DA SOLA all'esito
//    positivo (decisione D4, «come i competitors»): email col link, se il
//    cliente ha un'email in rubrica; altrimenti resta l'invito manuale in app.
//
// ⚠️ Questo modulo NON è 'use server': i helper prendono il client Supabase
// come argomento (session o admin) e li chiamano action e route — un file
// 'use server' esporrebbe ogni export async come endpoint richiamabile.
// Tutte le letture SdI sono TOLLERANTI pre-044 (colonne non nei tipi).

import React from 'react'
import { copiaCortesiaBloccata, esitoPositivoSdi } from '@/lib/documents/copia-sdi'
import { checkFreeBlock } from '@/lib/free-trial'
import { sendEmail } from '@/lib/email/send'
import { PreventivoEmail } from '@/components/email/PreventivoEmail'
import { stripPrefissoLegacy } from '@/lib/utils'

const SDI_ON = () => process.env.NEXT_PUBLIC_SDI_ENABLED === 'true'

/** Il messaggio della guardia: cosa non si può fare, perché, cosa fare invece
 *  (schema §B.2). */
export function messaggioCopiaBloccata(docType: string | null | undefined): string {
  const nome = docType === 'nota_credito' ? 'nota di credito' : docType === 'nota_debito' ? 'nota di debito' : 'fattura'
  return `Prima la trasmissione, poi la copia: con la fatturazione elettronica attiva, la ${nome} si invia allo SdI dalla card «Fattura elettronica». Appena arriva l'esito positivo, la copia di cortesia per il cliente si sblocca — e parte da sola se il cliente ha un'email in rubrica.`
}

/**
 * La GUARDIA dei percorsi di invio al cliente (sendDocumentAction,
 * registerManualSendAction, registerManualResendAction, route send-email).
 * Ritorna il messaggio d'errore se l'invio va bloccato, altrimenti null.
 *
 * ⚠️ Un sdi_status ILLEGGIBILE (blip, pre-044) vale «non trasmessa» → blocco:
 * è lo stesso valore (null) di una fattura mai trasmessa, e sbloccare su un
 * errore di lettura manderebbe in giro copie proprio quando non possiamo
 * dimostrare l'esito. Il caso non esiste in pratica: con SdI acceso la 044
 * c'è, e un blip si risolve riprovando.
 */
export async function bloccoInvioCliente(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non nei tipi generati
  supabase: any,
  docId: string,
  docType: string | null | undefined,
): Promise<string | null> {
  if (!SDI_ON()) return null
  if (docType !== 'fattura' && docType !== 'nota_credito' && docType !== 'nota_debito') return null
  const sdiStatus: string | null = await supabase
    .from('documents')
    .select('sdi_status')
    .eq('id', docId)
    .maybeSingle()
    .then(
      (r: { data: { sdi_status?: string | null } | null; error: unknown }) =>
        r.error ? null : (r.data?.sdi_status ?? null),
      () => null,
    )
  return copiaCortesiaBloccata(docType, sdiStatus) ? messaggioCopiaBloccata(docType) : null
}

/**
 * La copia di cortesia AUTOMATICA all'esito positivo (webhook o pull).
 * Best-effort: non lancia MAI — un problema qui non deve far fallire la
 * registrazione dell'esito, che è il fatto fiscale.
 *
 * Parte SOLO se:
 *  · SdI attivo (col flag spento vale il flusso client-first: nessuna email
 *    a sorpresa) · esito positivo · documento in BOZZA mai inviato al cliente
 *    (se una copia è già in giro — caso legacy — non si manda due volte:
 *    la dicitura della Fase 0 sul link si aggiorna da sola) · il cliente ha
 *    un'email in rubrica · la quota Free lo consente (l'invio della fattura
 *    consuma il contatore delle 8, come ogni primo invio).
 *
 * Il CLAIM è atomico (update condizionato su status='draft'): webhook e pull
 * concorrenti non mandano due email. Se l'email poi non parte, si torna
 * indietro e resta l'invito manuale in app.
 */
export async function inviaCopiaCortesiaAutomatica(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044/080 non nei tipi generati
  admin: any,
  docId: string,
): Promise<void> {
  try {
    if (!SDI_ON()) return
    const { data: doc } = await admin
      .from('documents')
      .select('*, document_items(*), clients!client_id(*)')
      .eq('id', docId)
      .is('deleted_at', null)
      .in('doc_type', ['fattura', 'nota_credito', 'nota_debito'])
      .maybeSingle()
    if (!doc) return
    const d = doc as Record<string, unknown>
    if (!esitoPositivoSdi(d.sdi_status as string | null)) return
    // Mai inviata al cliente: la copia automatica è il PRIMO invio.
    if (d.status !== 'draft' || d.sent_at) return
    const client = d.clients as Record<string, unknown> | null
    const clientEmail = String(client?.email ?? '').trim()
    if (!clientEmail) return

    const { data: ws } = await admin
      .from('workspaces')
      .select('id, name, ragione_sociale, plan, owner_id, free_trial_expires_at, sent_quota_used, sent_invoice_quota_used')
      .eq('id', d.workspace_id as string)
      .maybeSingle()
    if (!ws) return

    // Quota Free: l'invio di una FATTURA consuma il contatore delle 8 — a
    // quota piena la copia non parte (resta l'invito, che mostra il paywall).
    const docType = String(d.doc_type)
    if (ws.plan === 'free' && docType === 'fattura') {
      const trial = checkFreeBlock(ws, 'fattura')
      if (trial.blocked) {
        console.warn('[copia-cortesia] quota Free esaurita: copia automatica non inviata', docId)
        return
      }
    }

    // ── CLAIM atomico + stato d'invio (come i percorsi di invio manuali) ──
    const now = new Date()
    const validity = Number(d.validity_days ?? 30)
    const expiresAt = new Date(now)
    expiresAt.setDate(expiresAt.getDate() + validity)
    const items = Array.isArray(d.document_items) ? (d.document_items as unknown[]) : []
    const snapshot = {
      fields: {
        title: d.title ?? null,
        notes: d.notes ?? null,
        internal_notes: d.internal_notes ?? null,
        discount_pct: d.discount_pct ?? null,
        discount_fixed: d.discount_fixed ?? null,
        vat_rate_default: d.vat_rate_default ?? null,
        validity_days: d.validity_days ?? 30,
        payment_terms: d.payment_terms ?? null,
      },
      items,
    }
    const prevLog = Array.isArray(d.document_log) ? (d.document_log as unknown[]) : []
    const updatedLog = [
      ...prevLog,
      { type: 'copia_cortesia', at: now.toISOString() },
      { type: 'expiry_set', at: now.toISOString(), expires: expiresAt.toISOString() },
    ]
    const { data: claimed, error: claimErr } = await admin
      .from('documents')
      .update({
        status: 'sent',
        sent_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        pdf_url: null,
        sent_snapshot: snapshot,
        updated_after_send_at: null,
        document_log: updatedLog,
      })
      .eq('id', docId)
      .eq('status', 'draft')
      .select('id')
    if (claimErr || !claimed || claimed.length === 0) return // un altro percorso l'ha già inviata

    // ── L'email col link (la stessa forma dell'invio manuale) ──
    const senderName = String(ws.ragione_sociale ?? ws.name)
    const ownerEmail: string | null = await admin.auth.admin
      .getUserById(ws.owner_id as string)
      .then((r: { data: { user?: { email?: string | null } | null } }) => r.data.user?.email ?? null, () => null)
    const numero = d.doc_number ? stripPrefissoLegacy(String(d.doc_number)) : null
    const nomeDoc = docType === 'nota_credito' ? 'nota di credito' : docType === 'nota_debito' ? 'nota di debito' : 'fattura'
    const recipientName = String(client?.name ?? '').trim() || null
    const totale = Number(d.total ?? 0)
    const totalFormatted = `€ ${totale.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'
    const publicUrl = d.public_token ? `${appUrl}/p/${d.public_token}` : null
    // Registro formale col cliente finale (Lei). Il rimando al cassetto
    // fiscale è l'obbligo informativo di prassi; la stessa dicitura sta già
    // sul documento (Fase 0).
    const message = `Le facciamo avere la copia di cortesia della ${nomeDoc}${numero ? ` n. ${numero}` : ''}. L'originale è stato trasmesso al Sistema di Interscambio ed è disponibile nella Sua area riservata del sito dell'Agenzia delle Entrate.`

    const result = await sendEmail({
      to: clientEmail,
      subject: `${docType === 'nota_credito' ? 'Nota di credito' : docType === 'nota_debito' ? 'Nota di debito' : 'Fattura'}${numero ? ` ${numero}` : ''} da ${senderName}`,
      react: React.createElement(PreventivoEmail, {
        senderName,
        recipientName,
        docNumber: numero,
        totalFormatted,
        message,
        publicUrl,
        docType: 'fattura',
        ownerEmail,
      }),
      replyTo: ownerEmail ?? undefined,
    })

    if (!result.success) {
      // L'email non è partita: si torna alla bozza (l'invito manuale in app
      // resta la strada) e si logga — mai un fallimento silenzioso.
      console.error('[copia-cortesia] email non inviata, ripristino la bozza:', result.error, docId)
      await admin
        .from('documents')
        .update({ status: 'draft', sent_at: null, expires_at: null, document_log: prevLog })
        .eq('id', docId)
        .eq('status', 'sent')
        .then(() => {}, () => {})
      return
    }

    // Quota Free della fattura: primo invio → incremento atomico (083).
    if (ws.plan === 'free' && docType === 'fattura') {
      const { error: rpcErr } = await admin.rpc('increment_invoice_quota', { p_workspace_id: ws.id })
      if (rpcErr) {
        await admin
          .from('workspaces')
          .update({ sent_invoice_quota_used: Number(ws.sent_invoice_quota_used ?? 0) + 1 })
          .eq('id', ws.id)
          .then(() => {}, () => {})
      }
    }
    console.log('[copia-cortesia] copia automatica inviata', docId)
  } catch (e) {
    console.error('[copia-cortesia] errore imprevisto (la registrazione dell’esito non è toccata):', e)
  }
}
