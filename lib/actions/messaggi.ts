'use server'

// ============================================================
// Risposta dell'ARTIGIANO al messaggio che il cliente ha scritto dalla
// pagina pubblica del documento (Eli 5 ago: "l'artigiano riesce a rispondere
// e far comparire al cliente il messaggio?").
//
// Dove vive: nel `document_log` come voce `owner_message` — la stessa
// conversazione che il cliente vede su /p/[token]. Nessuna migration.
//
// ⚠️ Come fa il cliente ad accorgersene: NON esiste alcun canale di notifica
// verso il cliente (non ha l'app e non è registrato). L'unico avviso possibile
// è l'EMAIL, e solo se il cliente ne ha una in rubrica: per questo l'email
// contiene il TESTO della risposta e non solo il link. Se l'email manca,
// l'interfaccia lo dice all'artigiano invece di far finta di niente.
// ============================================================

import { createElement } from 'react'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { resolveWorkspaceForUser } from '@/lib/actions/resolve-workspace'
import { sendEmail } from '@/lib/email/send'
import { OwnerMessageEmail } from '@/lib/email/templates/owner_message'
import { checkPublicRateLimit } from '@/lib/public-rate-limit'
import { formatDocNumber, docTypePath } from '@/lib/utils'

const MAX_LEN = 1000

export interface SendOwnerMessageResult {
  error?: string
  ok?: boolean
  /** true = il cliente ha ricevuto anche l'email con la risposta */
  emailed?: boolean
  /** avviso non bloccante (messaggio salvato, email non partita) */
  warning?: string
}

export async function sendOwnerMessageAction(
  documentId: string,
  message: string,
): Promise<SendOwnerMessageResult> {
  const text = (message ?? '').trim().slice(0, MAX_LEN)
  if (text.length < 2) return { error: 'Scrivi la risposta prima di inviarla.' }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato' }

  const workspace = await resolveWorkspaceForUser<{ id: string; ragione_sociale: string | null; name: string | null }>(
    supabase, user.id, 'id, ragione_sociale, name'
  )
  if (!workspace) return { error: 'Workspace non trovato' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- document_log (034) non ancora in types/database.ts
  const db = supabase as any

  const { data: doc, error: readErr } = await db
    .from('documents')
    .select('id, doc_type, doc_number, status, public_token, client_id, document_log')
    .eq('id', documentId)
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .maybeSingle()

  if (readErr) return { error: 'Non riesco a leggere il documento: riprova tra qualche secondo.' }
  if (!doc) return { error: 'Documento non trovato' }
  if (doc.status === 'draft') {
    return { error: 'Il documento è ancora una bozza: il cliente non ha un link dove leggere la risposta.' }
  }

  // Ogni risposta può far partire un'email verso una persona esterna: il tetto
  // impedisce che un account compromesso la usi come canale di spam.
  const rl = await checkPublicRateLimit({
    key: `ownermsg:${documentId}`, limit: 20, window: '1 h', windowMs: 3_600_000,
  })
  if (rl.blocked) {
    return { error: 'Hai inviato molte risposte su questo documento. Riprova tra un po\'.' }
  }

  const at = new Date().toISOString()
  const current = Array.isArray(doc.document_log) ? doc.document_log : []
  const { error: logErr } = await db
    .from('documents')
    .update({ document_log: [...current, { type: 'owner_message', at, text }] })
    .eq('id', doc.id)
    .eq('workspace_id', workspace.id)

  if (logErr) {
    console.error('[messaggi] scrittura risposta fallita:', logErr)
    return { error: 'Invio non riuscito. Riprova.' }
  }

  const path = docTypePath(doc.doc_type)
  revalidatePath(`/${path}/${doc.id}`)

  // ── Avviso al cliente (l'unico possibile: l'email) ──────────────────────
  let clientEmail: string | null = null
  if (doc.client_id) {
    const { data: client } = await supabase
      .from('clients')
      .select('email')
      .eq('id', doc.client_id)
      .maybeSingle()
    clientEmail = client?.email ?? null
  }

  if (!clientEmail) {
    return {
      ok: true,
      emailed: false,
      warning: 'Risposta salvata. Questo cliente non ha un\'email in rubrica: la vedrà solo riaprendo il link, quindi conviene avvisarlo tu.',
    }
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'
    const isFattura = doc.doc_type === 'fattura'
    const wsName = workspace.ragione_sociale || workspace.name || 'Carta Canta'
    const num = doc.doc_number ? formatDocNumber(doc.doc_number) : null
    const result = await sendEmail({
      to: clientEmail,
      subject: `Risposta da ${wsName}${num ? ` — ${isFattura ? 'fattura' : 'preventivo'} ${num}` : ''}`,
      react: createElement(OwnerMessageEmail, {
        workspaceName: wsName,
        docLabel: isFattura ? 'fattura' : 'preventivo',
        docNumber: num,
        message: text,
        publicUrl: doc.public_token ? `${appUrl}/p/${doc.public_token}` : appUrl,
      }),
    })
    if (result?.error) {
      return { ok: true, emailed: false, warning: 'Risposta salvata, ma l\'email di avviso al cliente non è partita: la vedrà riaprendo il link.' }
    }
  } catch (err) {
    console.warn('[messaggi] email al cliente non inviata (non bloccante):', err)
    return { ok: true, emailed: false, warning: 'Risposta salvata, ma l\'email di avviso al cliente non è partita: la vedrà riaprendo il link.' }
  }

  return { ok: true, emailed: true }
}
