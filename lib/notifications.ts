// ============================================================
// Notifiche in Home (campanella) — calcolate dai dati esistenti.
// Nessun sistema push: la lista si ricava dai documenti; lo stato di
// lettura sta in notification_reads (migration 040, tollerante).
//
// Tipi attivi oggi:
//  - 'viewed'  → preventivo visto dal cliente (in attesa di risposta)
//  - 'acconto' → acconto richiesto ma non ancora ricevuto (preventivo accettato)
// I tipi SdI (pagate non trasmesse, scarti) arrivano col blocco SdI.
// Ogni tipo è disattivabile da Impostazioni → Notifiche (notification_prefs).
// ============================================================

import type { createClient } from '@/lib/supabase/server'
import { documentiSenzaPromemoria } from '@/lib/documents/archivio'
import { docTypeLabel, docTypePath, stripPrefissoLegacy } from '@/lib/utils'
import { riferimentoTrasmissione, termineTrasmissione, scadenzaLabel } from '@/lib/sdi/termini'

type ServerClient = Awaited<ReturnType<typeof createClient>>

export interface AppNotification {
  key: string
  type: 'viewed' | 'acconto' | 'richiamo' | 'richiesta' | 'preventivo_fermo' | 'messaggio' | 'sdi_scartata' | 'sdi_da_trasmettere' | 'listino_scaduto'
  title: string
  body: string
  when: string | null
  href: string
  read: boolean
}

const SDI_ENABLED = process.env.NEXT_PUBLIC_SDI_ENABLED === 'true'

function clientDisplayName(c: { name: string | null; surname: string | null } | null): string {
  if (!c) return 'il cliente'
  return [c.name, c.surname].filter(Boolean).join(' ') || 'il cliente'
}

export async function getAppNotifications(
  supabase: ServerClient,
  workspaceId: string,
  prefs: Record<string, unknown> | null
): Promise<AppNotification[]> {
  const showViewed = prefs?.inapp_visto !== false
  const showFermo = prefs?.inapp_preventivo_fermo !== false
  // ⚠️ SEMPRE attivi, senza interruttore (Eli 15 ago, #7): perderli costa —
  // un messaggio del cliente senza risposta, o una fattura scartata dallo SdI
  // che nessuno corregge. Il resto degli avvisi resta un'opzione.
  const showMessaggi = true
  const showAcconto = prefs?.inapp_acconto !== false
  const showRichiamo = prefs?.inapp_richiamo !== false
  const showRichieste = prefs?.inapp_richiesta !== false
  const showSdiScarto = SDI_ENABLED
  const showSdiPending = SDI_ENABLED && prefs?.inapp_sdi_trasmissione !== false
  const showListinoScaduto = prefs?.inapp_listino_scaduto !== false

  const notifications: AppNotification[] = []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne/tabelle 038-044 non ancora in types/database.ts
  const db = supabase as any

  // Soglia "preventivo fermo": 7 giorni senza risposta dall'invio (o
  // dall'ultimo sollecito). Promemoria INTERNO all'artigiano — nessuna
  // email al cliente (B.0), solo campanella.
  const FERMO_GIORNI = 7
  const fermoCutoff = new Date(Date.now() - FERMO_GIORNI * 24 * 60 * 60 * 1000).toISOString()

  // Messaggi scritti dai clienti dalla pagina pubblica del documento: vivono
  // nel document_log (voce `client_message`). Finestra 60 giorni sui documenti
  // toccati di recente — la scrittura del log aggiorna updated_at.
  const msgCutoff = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

  // Oggi come data pura (YYYY-MM-DD): un listino con `valid_until` PRIMA di oggi
  // è scaduto. Confronto per data di calendario, senza fuso (valid_until è DATE).
  const oggiData = new Date().toISOString().slice(0, 10)

  const [viewedRes, accontoRes, sdiRes, convertedRes, richiamiRes, richiesteRes, fermoRes, messaggiRes, readsRes, senzaPromemoria, listiniScadutiRes, listiniUsatiRes] = await Promise.all([
    showViewed
      ? supabase
          .from('documents')
          .select('id, doc_number, doc_type, updated_at, clients ( name, surname )')
          .eq('workspace_id', workspaceId)
          .eq('status', 'viewed')
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(20)
      : Promise.resolve({ data: null }),
    showAcconto
      ? (async () => {
          try {
            return await db
              .from('documents')
              .select('id, doc_number, doc_type, accepted_at, total, deposit_type, deposit_value, payment_status, clients ( name, surname )')
              .eq('workspace_id', workspaceId)
              .eq('doc_type', 'preventivo')
              .eq('status', 'accepted')
              .is('deleted_at', null)
              .not('deposit_type', 'is', null)
              .order('accepted_at', { ascending: false })
              .limit(20)
          } catch {
            return { data: null }
          }
        })()
      : Promise.resolve({ data: null }),
    // Fatture con esito/da trasmettere allo SdI (colonne 044 — tollerante)
    SDI_ENABLED && (showSdiScarto || showSdiPending)
      ? (async () => {
          try {
            return await db
              .from('documents')
              .select('id, doc_number, doc_type, status, payment_status, sdi_status, sdi_error, sdi_updated_at, paid_at, accepted_at, created_at, doc_date')
              .eq('workspace_id', workspaceId)
              .in('doc_type', ['fattura', 'nota_credito', 'nota_debito'])
              .is('deleted_at', null)
              // scartate + non trasmesse fuori bozza: le seconde servono al
              // promemoria dei 12 giorni (art. 21 c.4), non solo se pagate
              .or('sdi_status.eq.scartata,and(sdi_status.is.null,status.in.(sent,viewed,accepted,expired))')
              .limit(30)
          } catch {
            return { data: null }
          }
        })()
      : Promise.resolve({ data: null }),
    // Preventivi già convertiti: l'acconto vive sulla fattura, la notifica
    // sul preventivo sarebbe un doppione fuorviante
    (async () => {
      try {
        return await supabase
          .from('documents')
          .select('origin_document_id')
          .eq('workspace_id', workspaceId)
          .eq('doc_type', 'fattura')
          .not('origin_document_id', 'is', null)
          .is('deleted_at', null)
      } catch {
        return { data: null }
      }
    })(),
    // Lavori da richiamare (recall_at raggiunto — colonne 052, tollerante)
    showRichiamo
      ? (async () => {
          try {
            return await db
              .from('lavori')
              .select('id, title, recall_at, recall_note, clients ( name, surname )')
              .eq('workspace_id', workspaceId)
              .is('deleted_at', null)
              .not('recall_at', 'is', null)
              .lte('recall_at', new Date().toISOString())
              .order('recall_at', { ascending: false })
              .limit(20)
          } catch {
            return { data: null }
          }
        })()
      : Promise.resolve({ data: null }),
    // Richieste NUOVE dalla vetrina (tabella 043, tollerante) — richiesta
    // Eli 29 lug: "se qualcuno mi manda una richiesta dalla vetrina, deve
    // comparire la notifica in Home".
    showRichieste
      ? (async () => {
          try {
            return await db
              .from('marketplace_requests')
              .select('id, customer_name, customer_city, message, created_at')
              .eq('workspace_id', workspaceId)
              .eq('status', 'new')
              .order('created_at', { ascending: false })
              .limit(20)
          } catch {
            return { data: null }
          }
        })()
      : Promise.resolve({ data: null }),
    // Preventivi FERMI: inviati da almeno 7 giorni senza risposta del
    // cliente. Il filtro grezzo è su sent_at; il riferimento vero (ultimo
    // sollecito compreso) si valuta dopo in JS.
    showFermo
      ? supabase
          .from('documents')
          .select('id, doc_number, sent_at, last_reminder_at, expires_at, clients ( name, surname )')
          .eq('workspace_id', workspaceId)
          .eq('doc_type', 'preventivo')
          .in('status', ['sent', 'viewed'])
          .is('deleted_at', null)
          .not('sent_at', 'is', null)
          .lte('sent_at', fermoCutoff)
          // ASC: coi 20 slot disponibili si privilegiano i più FERMI (review
          // 4 ago: col DESC i più vecchi — i più bisognosi — restavano fuori)
          .order('sent_at', { ascending: true })
          .limit(20)
      : Promise.resolve({ data: null }),
    // Documenti con messaggi del cliente (document_log, tollerante pre-034)
    showMessaggi
      ? (async () => {
          try {
            return await db
              .from('documents')
              .select('id, doc_number, doc_type, document_log, clients ( name, surname )')
              .eq('workspace_id', workspaceId)
              .is('deleted_at', null)
              .gte('updated_at', msgCutoff)
              .order('updated_at', { ascending: false })
              .limit(60)
          } catch {
            return { data: null }
          }
        })()
      : Promise.resolve({ data: null }),
    (async () => {
      try {
        return await db
          .from('notification_reads')
          .select('notif_key')
          .eq('workspace_id', workspaceId)
      } catch {
        return { data: null }
      }
    })(),
    // Documenti fuori dai promemoria: sollecito posticipato (074), solleciti
    // spenti o archiviati (075). ⚠️ Se la campanella suonasse per un documento
    // che l'artigiano ha messo via, il comando «non ricordarmelo più» non
    // manterrebbe la promessa che fa.
    documentiSenzaPromemoria(supabase, workspaceId),
    // Listini fornitori SCADUTI (valid_until passata) — tabella 063, tollerante.
    showListinoScaduto
      ? (async () => {
          try {
            return await db
              .from('supplier_lists')
              .select('id, name, valid_until')
              .eq('workspace_id', workspaceId)
              .not('valid_until', 'is', null)
              .lt('valid_until', oggiData)
              .limit(50)
          } catch {
            return { data: null }
          }
        })()
      : Promise.resolve({ data: null }),
    // Quali listini sono USATI da un preventivo ancora aperto (sent/viewed):
    // solo su quelli l'avviso è urgente — il cliente potrebbe accettare un
    // prezzo che il fornitore non fa più. Join document_items → documents.
    showListinoScaduto
      ? (async () => {
          try {
            return await db
              .from('document_items')
              .select('supplier_list_id, documents!inner(workspace_id, status, deleted_at)')
              .not('supplier_list_id', 'is', null)
              .eq('documents.workspace_id', workspaceId)
              .in('documents.status', ['sent', 'viewed'])
              .is('documents.deleted_at', null)
              .limit(500)
          } catch {
            return { data: null }
          }
        })()
      : Promise.resolve({ data: null }),
  ])

  const readKeys = new Set<string>(
    ((readsRes?.data ?? []) as Array<{ notif_key: string }>).map((r) => r.notif_key)
  )
  const convertedIds = new Set<string>(
    ((convertedRes?.data ?? []) as Array<{ origin_document_id: string | null }>)
      .map((r) => r.origin_document_id)
      .filter((v): v is string => !!v)
  )

  // ── Preventivi visti dal cliente ──────────────────────────────────────
  for (const doc of (viewedRes?.data ?? []) as Array<{
    id: string
    doc_number: string | null
    doc_type: string
    updated_at: string | null
    clients: { name: string | null; surname: string | null } | null
  }>) {
    if (doc.doc_type !== 'preventivo') continue
    const key = `viewed:${doc.id}`
    const num = doc.doc_number ? stripPrefissoLegacy(doc.doc_number) : null
    notifications.push({
      key,
      type: 'viewed',
      title: `Preventivo ${num ?? ''} visto dal cliente`.replace('  ', ' '),
      body: `${clientDisplayName(doc.clients)} ha aperto il preventivo.`,
      when: doc.updated_at,
      href: `/preventivi/${doc.id}`,
      read: readKeys.has(key),
    })
  }

  // ── Acconti in attesa ─────────────────────────────────────────────────
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
  for (const doc of (accontoRes?.data ?? []) as Array<{
    id: string
    doc_number: string | null
    accepted_at: string | null
    total: number | null
    deposit_type: string | null
    deposit_value: number | null
    payment_status: string | null
    clients: { name: string | null; surname: string | null } | null
  }>) {
    if (doc.payment_status === 'partial' || doc.payment_status === 'paid') continue
    if (convertedIds.has(doc.id)) continue
    const total = Number(doc.total ?? 0)
    const v = Number(doc.deposit_value)
    if (total <= 0 || !Number.isFinite(v) || v <= 0) continue
    const acconto = doc.deposit_type === 'percent'
      ? round2((total * Math.min(v, 100)) / 100)
      : round2(Math.min(v, total))
    if (acconto <= 0) continue
    const key = `acconto:${doc.id}`
    const num = doc.doc_number ? stripPrefissoLegacy(doc.doc_number) : null
    notifications.push({
      key,
      type: 'acconto',
      title: 'Acconto in attesa',
      body: `Preventivo ${num ?? ''} (${clientDisplayName(doc.clients)}): acconto €\u00A0${acconto.toLocaleString('it-IT', { minimumFractionDigits: 2 })} non ancora ricevuto.`.replace('  ', ' '),
      when: doc.accepted_at,
      href: `/preventivi/${doc.id}`,
      read: readKeys.has(key),
    })
  }

    // ── Lavori da richiamare (manutenzioni ricorrenti, 052) ───────────────
  for (const lav of (richiamiRes?.data ?? []) as Array<{
    id: string
    title: string | null
    recall_at: string | null
    recall_note: string | null
    clients: { name: string | null; surname: string | null } | null
  }>) {
    const key = `richiamo:${lav.id}:${lav.recall_at ?? ''}`
    notifications.push({
      key,
      type: 'richiamo',
      title: `Da richiamare: ${lav.title ?? 'lavoro'}`,
      body: lav.recall_note ?? `Promemoria per ${clientDisplayName(lav.clients)}.`,
      when: lav.recall_at,
      href: `/lavori/${lav.id}`,
      read: readKeys.has(key),
    })
  }

  // ── Preventivi fermi da giorni (promemoria sollecito, 3 ago) ──────────
  const nowMs = Date.now()
  const fuoriDaiPromemoria = new Set(senzaPromemoria.map((d) => d.id))
  for (const doc of (fermoRes?.data ?? []) as Array<{
    id: string
    doc_number: string | null
    sent_at: string | null
    last_reminder_at: string | null
    expires_at: string | null
    clients: { name: string | null; surname: string | null } | null
  }>) {
    // Riferimento = l'evento PIÙ RECENTE tra invio e ultimo sollecito: dopo
    // un sollecito (o un REINVIO, che aggiorna sent_at senza toccare
    // last_reminder_at — review 4 ago) il promemoria riparte da zero, e la
    // chiave cambia → torna "non letto" solo alla scadenza successiva.
    // Rinviato, senza solleciti o archiviato: la campanella tace.
    if (fuoriDaiPromemoria.has(doc.id)) continue
    const candidates = [doc.sent_at, doc.last_reminder_at]
      .filter((x): x is string => !!x && Number.isFinite(new Date(x).getTime()))
    if (candidates.length === 0) continue
    const ref = candidates.sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[candidates.length - 1]
    const refMs = new Date(ref).getTime()
    if (!Number.isFinite(refMs) || nowMs - refMs < FERMO_GIORNI * 24 * 60 * 60 * 1000) continue
    // Già oltre la scadenza → ci pensano il flusso "scaduto" e la card
    // In scadenza della Home, niente doppione.
    if (doc.expires_at && new Date(doc.expires_at).getTime() < nowMs) continue
    const days = Math.floor((nowMs - refMs) / (24 * 60 * 60 * 1000))
    const key = `fermo:${doc.id}:${ref}`
    const num = doc.doc_number ? stripPrefissoLegacy(doc.doc_number) : null
    notifications.push({
      key,
      type: 'preventivo_fermo',
      title: `Preventivo ${num ?? ''} fermo da ${days} giorni`.replace('  ', ' '),
      body: `${clientDisplayName(doc.clients)} non ha ancora risposto: un sollecito?`,
      when: ref,
      href: `/preventivi/${doc.id}`,
      read: readKeys.has(key),
    })
  }

  // ── Messaggi dei clienti dalla pagina del documento (4 ago) ───────────
  for (const doc of (messaggiRes?.data ?? []) as Array<{
    id: string
    doc_number: string | null
    doc_type: string
    document_log: unknown
    clients: { name: string | null; surname: string | null } | null
  }>) {
    const log = Array.isArray(doc.document_log)
      ? (doc.document_log as Array<{ type?: string; at?: string; text?: string }>)
      : []
    // «Da rispondere»: un messaggio del cliente resta marcato finché non c'è
    // una TUA risposta successiva (annotato il 5 ago, cablato l'11 ago).
    let lastOwnerAt = ''
    for (const e of log) {
      if (e?.type === 'owner_message' && typeof e.at === 'string' && e.at > lastOwnerAt) lastOwnerAt = e.at
    }
    for (const e of log) {
      if (e?.type !== 'client_message' || typeof e.at !== 'string') continue
      const key = `msg:${doc.id}:${e.at}`
      const num = doc.doc_number ? stripPrefissoLegacy(doc.doc_number) : null
      const excerpt = (e.text ?? '').length > 90 ? `${(e.text ?? '').slice(0, 90)}…` : (e.text ?? '')
      const daRispondere = e.at > lastOwnerAt
      notifications.push({
        key,
        type: 'messaggio',
        title: `Messaggio da ${clientDisplayName(doc.clients)}${daRispondere ? ' · da rispondere' : ''}`,
        body: `${num ? `${docTypeLabel(doc.doc_type)} ${num}: ` : ''}${excerpt}`,
        when: e.at,
        href: `/${docTypePath(doc.doc_type)}/${doc.id}`,
        read: readKeys.has(key),
      })
    }
  }

  // ── Richieste dalla vetrina dei professionisti (043) ──────────────────
  for (const r of (richiesteRes?.data ?? []) as Array<{
    id: string
    customer_name: string
    customer_city: string | null
    message: string
    created_at: string
  }>) {
    const key = `mkreq:${r.id}`
    const who = r.customer_city ? `${r.customer_name} (${r.customer_city})` : r.customer_name
    const excerpt = r.message.length > 80 ? `${r.message.slice(0, 80)}…` : r.message
    notifications.push({
      key,
      type: 'richiesta',
      title: 'Nuova richiesta dalla vetrina',
      body: `${who}: ${excerpt}`,
      when: r.created_at,
      href: '/richieste',
      read: readKeys.has(key),
    })
  }

// ── SdI: scarti + pagate non trasmesse + termine dei 12 giorni ─────
  for (const doc of (sdiRes?.data ?? []) as Array<{
    id: string
    doc_number: string | null
    doc_type: string
    status: string
    payment_status: string | null
    sdi_status: string | null
    sdi_error: string | null
    sdi_updated_at: string | null
    paid_at: string | null
    accepted_at: string | null
    created_at: string | null
    doc_date: string | null
  }>) {
    const num = doc.doc_number ? stripPrefissoLegacy(doc.doc_number) : null
    if (doc.sdi_status === 'scartata' && showSdiScarto) {
      const key = `sdi_scarto:${doc.id}`
      notifications.push({
        key,
        type: 'sdi_scartata',
        title: `Fattura ${num ?? ''} scartata dallo SdI`.replace('  ', ' '),
        body: `${doc.sdi_error ?? 'Controlla i dati'}. Correggi e reinvia. Ti abbiamo mandato anche un'email.`,
        when: doc.sdi_updated_at,
        href: `/fatture/${doc.id}`,
        read: readKeys.has(key),
      })
    } else if (!doc.sdi_status && doc.status === 'accepted' && showSdiPending) {
      const key = `sdi_pending:${doc.id}`
      notifications.push({
        key,
        type: 'sdi_da_trasmettere',
        title: `Fattura ${num ?? ''} pagata ma non trasmessa allo SdI`.replace('  ', ' '),
        body: 'Tocca per trasmetterla al Sistema di Interscambio.',
        when: doc.paid_at ?? doc.accepted_at,
        href: `/fatture/${doc.id}`,
        read: readKeys.has(key),
      })
    } else if (!doc.sdi_status && showSdiPending) {
      // ── Termine dei 12 giorni (art. 21 c.4 — 11 ago): una fattura non
      // trasmessa il cui termine si avvicina (≤3 giorni) o è passato suona
      // anche se non è stata pagata: l'orologio corre dalla data del
      // documento (o dal primo incasso, se precedente).
      // La data FISCALE (doc_date, nasce alla conferma — 080) con fallback
      // legacy sulla data di creazione.
      const rif = riferimentoTrasmissione(doc.doc_date ?? doc.created_at, doc.paid_at)
      const termine = rif ? termineTrasmissione(rif) : null
      if (termine && termine.giorniRimasti <= 3) {
        const key = `sdi_termine:${doc.id}`
        const cosa = doc.doc_type === 'nota_credito' ? 'Nota di credito' : 'Fattura'
        notifications.push({
          key,
          type: 'sdi_da_trasmettere',
          title: termine.fuoriTermine
            ? `${cosa} ${num ?? ''} oltre i 12 giorni per la trasmissione`.replace('  ', ' ')
            : `${cosa} ${num ?? ''} da trasmettere entro il ${scadenzaLabel(termine.scadenza)}`.replace('  ', ' '),
          body: termine.fuoriTermine
            ? 'Il termine di trasmissione allo SdI è passato: trasmettila comunque e parlane col commercialista.'
            : termine.giorniRimasti === 0
              ? 'Oggi è l’ultimo giorno utile per trasmetterla allo SdI.'
              : `Restano ${termine.giorniRimasti} giorni per la trasmissione allo SdI.`,
          when: doc.created_at,
          href: `/fatture/${doc.id}`,
          read: readKeys.has(key),
        })
      }
    }
  }

  // ── Listini fornitori SCADUTI usati da un preventivo ancora aperto (fase 3) ─
  if (showListinoScaduto) {
    const listiniUsati = new Set<string>(
      ((listiniUsatiRes?.data ?? []) as Array<{ supplier_list_id: string | null }>)
        .map((r) => r.supplier_list_id)
        .filter((x): x is string => !!x),
    )
    for (const l of (listiniScadutiRes?.data ?? []) as Array<{ id: string; name: string; valid_until: string }>) {
      // Solo se un preventivo APERTO lo usa: un listino scaduto ma non in uso
      // non è urgente, e la campanella non deve diventare un elenco di rumore.
      if (!listiniUsati.has(l.id)) continue
      const key = `listino_scaduto:${l.id}`
      const dataIt = l.valid_until.split('-').reverse().join('/')
      notifications.push({
        key,
        type: 'listino_scaduto',
        title: `Listino «${l.name}» scaduto`,
        body: `I prezzi del fornitore sono scaduti il ${dataIt} e un preventivo ancora aperto li usa: rinnova il listino per non promettere un prezzo che il fornitore potrebbe non fare più.`,
        when: `${l.valid_until}T00:00:00`,
        href: `/catalogo/fornitori/${l.id}`,
        read: readKeys.has(key),
      })
    }
  }

  notifications.sort((a, b) => new Date(b.when ?? 0).getTime() - new Date(a.when ?? 0).getTime())
  return notifications
}
