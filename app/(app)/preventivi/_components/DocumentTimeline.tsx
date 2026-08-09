'use client'

import { useState } from 'react'
import { CheckCircle2, Send, Eye, FileText, XCircle, Clock, AlertTriangle, Link2, Pencil, RotateCcw, Banknote, ChevronDown, MessageSquare, FileCheck2 } from 'lucide-react'

export interface DocumentLogEntry {
  // 'payment'/'payment_reset' (26 lug, feedback Eli dal collaudo A1): gli
  // incassi non comparivano da nessuna parte. Restano qui PER SEMPRE, anche
  // dopo un annullamento o una riattivazione che azzerano i campi
  // dell'incasso: il registro è la memoria di cosa è successo davvero.
  // 3 ago sera (Eli: "la cronologia deve contenere ogni minima azione, anche
  // di ritorno indietro e poi avanti"): le transizioni MANUALI dei preventivi
  // ora scrivono una voce propria — marked_accepted/marked_rejected/
  // marked_expired ("Segna come…"), unaccepted (Riporta in bozza),
  // reopened (Riapri da rifiutato/scaduto).
  type: 'modified' | 'restored' | 'resent' | 'payment' | 'payment_reset' | 'cancelled' | 'reactivated'
    | 'marked_accepted' | 'marked_rejected' | 'marked_expired' | 'unaccepted' | 'reopened'
    | 'client_message' | 'owner_message'
  at: string
  /** solo client_message/owner_message: testo del messaggio */
  text?: string
  /** solo payment/payment_reset: importo in euro */
  amount?: number
  /** solo payment: acconto (parziale) o saldo (chiude la fattura) */
  kind?: 'acconto' | 'saldo'
  /** solo payment_reset: PERCHÉ l'incasso è stato azzerato (27 lug) */
  reason?: 'correzione' | 'annullamento' | 'riattivazione' | 'non_pagata'
}

interface DocumentTimelineProps {
  createdAt: string | null
  sentAt: string | null
  acceptedAt: string | null
  status: string
  expiresAt: string | null
  rejectionReason: string | null
  views: Array<{ id: string; viewed_at: string }>
  /** Fattura collegata a questo preventivo, se esiste */
  fatturaRef?: { id: string; doc_number: string | null; created_at: string } | null
  /** Log eventi di modifica/ripristino/reinvio — ogni entry ha type e at */
  documentLog?: DocumentLogEntry[]
  /** Tipo documento — influenza le etichette ('fattura' → accordo femminile) */
  docType?: 'preventivo' | 'fattura'
  /** Firma del cliente dalla pagina pubblica — se presente, l'accettazione è del cliente */
  signerName?: string | null
  /** IP di accettazione dalla pagina pubblica — se presente, l'accettazione è del cliente */
  acceptedIp?: string | null
  /** Proposta confermata (Base/Premium) — solo con più proposte */
  acceptedTierLabel?: string | null
  /** Trasmissione allo SdI: quando è partita e com'è andata (044) */
  sdiSentAt?: string | null
  sdiStatus?: string | null
  sdiUpdatedAt?: string | null
}

function fmtDatetime(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Rome', // come il resto dell'app (review 25 lug F4)
  })
}

interface TimelineEvent {
  key: string
  icon: React.ReactNode
  label: string
  detail?: string | null
  badgeBg: string
  badgeColor: string
  date: string
  href?: string
}

export function DocumentTimeline({
  createdAt,
  sentAt,
  acceptedAt,
  status,
  expiresAt,
  rejectionReason,
  views,
  fatturaRef,
  documentLog = [],
  docType = 'preventivo',
  signerName = null,
  acceptedIp = null,
  acceptedTierLabel = null,
  sdiSentAt = null,
  sdiStatus = null,
  sdiUpdatedAt = null,
}: DocumentTimelineProps) {
  const isFattura = docType === 'fattura'
  // Tendina chiusa di default (richiesta Eli 27 lug): la cronologia si apre
  // solo quando serve, la pagina resta corta.
  const [open, setOpen] = useState(false)
  // Accettazione dal cliente (pagina pubblica) vs segnata a mano dall'artigiano:
  // la pagina pubblica salva sempre signer_name/accepted_ip, il PATCH manuale no.
  const acceptedByClient = !!signerName || !!acceptedIp
  const events: TimelineEvent[] = []

  if (createdAt) {
    events.push({
      key: 'created',
      icon: <FileText className="size-3" />,
      label: isFattura ? 'Creata' : 'Creato',
      badgeBg: '#e8e8e8', badgeColor: '#8a8a8a',
      date: createdAt,
    })
  }

  // ── Fattura elettronica: partenza ed esito (Eli, 8 ago) ──────────────────
  // ⚠️ DERIVATI dalle colonne che la trasmissione scrive già (`sdi_sent_at`,
  // `sdi_status`, `sdi_updated_at`): nessun percorso di invio è stato toccato,
  // e la cronologia non può divergere dallo stato reale della fattura.
  // Si vedono due momenti: quando è partita e com'è andata. Se lo SdI non ha
  // ancora risposto, il secondo semplicemente non c'è.
  if (sdiSentAt) {
    events.push({
      key: 'sdi-sent',
      icon: <FileCheck2 className="size-3" />,
      label: 'Inviata allo SdI',
      detail: 'Trasmessa al Sistema di Interscambio dell’Agenzia delle Entrate.',
      badgeBg: '#d8e8fb', badgeColor: '#3f6fb0',
      date: sdiSentAt,
    })
  }

  if (sdiStatus && sdiStatus !== 'inviata' && sdiUpdatedAt) {
    const esito: Record<string, { label: string; detail: string; bg: string; color: string }> = {
      consegnata: {
        label: 'Consegnata dallo SdI',
        detail: 'Lo SdI l’ha accettata e recapitata al cliente: la fattura è emessa.',
        bg: '#d4efe2', color: '#2f8a63',
      },
      mancata_consegna: {
        label: 'Emessa, non recapitata',
        detail: 'Lo SdI l’ha accettata ma non è riuscito a consegnarla: per l’Agenzia è emessa lo stesso, e il cliente la trova nel suo cassetto fiscale.',
        bg: '#f5e9d0', color: '#b0863e',
      },
      scartata: {
        label: 'Scartata dallo SdI',
        detail: 'Non ha passato i controlli: va corretta e ritrasmessa entro 5 giorni, con lo stesso numero e la stessa data.',
        bg: '#f5dede', color: '#b05656',
      },
    }
    const e = esito[sdiStatus]
    if (e) {
      events.push({
        key: `sdi-${sdiStatus}`,
        icon: <FileCheck2 className="size-3" />,
        label: e.label,
        detail: e.detail,
        badgeBg: e.bg, badgeColor: e.color,
        date: sdiUpdatedAt,
      })
    }
  }

  if (sentAt) {
    events.push({
      key: 'sent',
      icon: <Send className="size-3" />,
      label: isFattura ? 'Inviata al cliente' : 'Inviato al cliente',
      badgeBg: '#d8e8fb', badgeColor: '#3f6fb0',
      date: sentAt,
    })
  }

  // Visualizzazioni DENTRO la cronologia (Eli 3 ago sera): OGNI apertura è
  // un evento con la sua data e ora, in ordine cronologico con tutto il resto
  // ("non mi piace che il visto dica solo prima e ultima volta").
  if (views.length > 0) {
    const sorted = [...views].sort(
      (a, b) => new Date(a.viewed_at).getTime() - new Date(b.viewed_at).getTime()
    )
    sorted.forEach((v, i) => {
      events.push({
        key: `viewed-${v.id}`,
        icon: <Eye className="size-3" />,
        label: i === 0 ? 'Aperto dal cliente' : `Aperto dal cliente (${i + 1}ª volta)`,
        badgeBg: '#fbe1ee', badgeColor: '#c25b91',
        date: v.viewed_at,
      })
    })
  }

  // Le accettazioni MANUALI hanno voci di log proprie dal 3 ago (sopravvivono
  // anche al "Riporta in bozza"): l'evento derivato da accepted_at si mostra
  // solo se non c'è già la voce di log (documenti vecchi) o se ad accettare
  // è stato il CLIENTE (la pagina pubblica non scrive log).
  const hasMarkedAcceptedLog = documentLog.some((e) => e.type === 'marked_accepted')
  // ⚠️ Sulle FATTURE il saldo scrive già la sua riga nel log ("Saldo ricevuto
  // di 312,50 €"), che dice la stessa cosa dell'evento derivato dallo stato ma
  // in più porta l'importo: senza questa condizione al saldo comparivano DUE
  // righe nello stesso minuto — "Pagata — fattura saldata" e "Saldo ricevuto"
  // (feedback Eli 7 ago: "al saldo non devono esserci due righe ma una sola").
  // Si tiene quella del log, che è la più informativa; l'evento derivato resta
  // per le fatture vecchie, che il log degli incassi non ce l'hanno.
  const hasSaldoLog = isFattura && documentLog.some((e) => e.type === 'payment' && e.kind === 'saldo')
  if (acceptedAt && (acceptedByClient || !hasMarkedAcceptedLog) && !hasSaldoLog) {
    events.push({
      key: 'accepted',
      icon: isFattura ? <Banknote className="size-3" /> : <CheckCircle2 className="size-3" />,
      // Etichetta esplicita su CHI ha agito: cliente (pagina pubblica, con o
      // senza firma) oppure artigiano ("Segnato come accettato" manuale).
      label: isFattura
        ? 'Pagata — fattura saldata'
        : signerName
        ? 'Accettato e firmato dal cliente'
        : acceptedByClient
        ? 'Accettato dal cliente'
        : 'Segnato come accettato da te',
      // La proposta scelta sta nel DETTAGLIO, non nel titolo: la cronologia
      // si legge a colpo d'occhio e un'etichetta lunga la appesantirebbe.
      detail: !isFattura && acceptedTierLabel ? `Proposta ${acceptedTierLabel}` : undefined,
      badgeBg: '#d4efe2', badgeColor: '#2f8a63',
      date: acceptedAt,
    })
  }

  // Se il log ha già le righe 'cancelled' (fatture, dal 27 lug), l'evento
  // derivato dallo STATO sarebbe un doppione con una data inventata
  // (sent_at come ripiego): si mostra solo per i documenti vecchi.
  const hasCancelledLog = documentLog.some((e) => e.type === 'cancelled')
  const hasMarkedRejectedLog = documentLog.some((e) => e.type === 'marked_rejected')
  // Scappatoia "dal CLIENTE" come per accepted (review 4 ago M1): un rifiuto
  // con MOTIVAZIONE viene dalla pagina pubblica (che non scrive log) — senza
  // questa condizione, un vecchio "Segna rifiutato" manuale nel log avrebbe
  // nascosto per sempre il rifiuto vero del cliente e il suo motivo.
  if (status === 'rejected' && (!!rejectionReason || (!hasCancelledLog && !hasMarkedRejectedLog))) {
    // No specific rejection timestamp — use accepted_at slot as fallback (shouldn't coexist)
    const rejDate = sentAt ?? createdAt ?? new Date().toISOString()
    events.push({
      key: 'rejected',
      icon: <XCircle className="size-3" />,
      // Il rifiuto manuale non salva alcun campo distintivo: "dal cliente" solo
      // quando c'è il motivo indicato dalla pagina pubblica, altrimenti neutro.
      label: isFattura ? 'Annullata' : rejectionReason ? 'Rifiutato dal cliente' : 'Rifiutato',
      detail: rejectionReason ?? null,
      badgeBg: '#f5dede', badgeColor: '#b05656',
      date: rejDate,
    })
  }

  // "Segna scaduto" manuale → Riapri → ri-scadenza NATURALE (il cron non
  // scrive log): la voce marked_expired sopprime il derivato SOLO se non c'è
  // un 'reopened' più recente (review 4 ago M2) — altrimenti la scadenza
  // vera sparirebbe dalla cronologia mentre il badge dice Scaduto.
  const lastLogAt = (type: string) => documentLog
    .filter((e) => e.type === type && e.at)
    .reduce((max, e) => Math.max(max, new Date(e.at).getTime()), 0)
  const suppressExpired = lastLogAt('marked_expired') > lastLogAt('reopened')
  if (status === 'expired' && expiresAt && !suppressExpired) {
    events.push({
      key: 'expired',
      icon: <AlertTriangle className="size-3" />,
      label: isFattura ? 'Scaduta' : 'Scaduto',
      badgeBg: '#f5e9d0', badgeColor: '#b0863e',
      date: expiresAt,
    })
  } else if (!isFattura && (status === 'sent' || status === 'viewed') && expiresAt) {
    const isExpiredNow = new Date(expiresAt) < new Date()
    if (!isExpiredNow) {
      events.push({
        key: 'expires',
        icon: <Clock className="size-3" />,
        label: 'Scade il',
        badgeBg: '#f5e9d0', badgeColor: '#b0863e',
        date: expiresAt,
      })
    }
  }

  // Modifiche e ripristini dal document_log
  documentLog.forEach((entry, i) => {
    if (entry.type === 'modified') {
      events.push({
        key: `modified-${i}`,
        icon: <Pencil className="size-3" />,
        label: 'Documento aggiornato',
        badgeBg: '#ede9f7', badgeColor: '#7c3aed',
        date: entry.at,
      })
    } else if (entry.type === 'resent') {
      events.push({
        key: `resent-${i}`,
        icon: <Send className="size-3" />,
        label: isFattura ? 'Reinviata al cliente' : 'Reinviato al cliente',
        badgeBg: '#d8e8fb', badgeColor: '#3f6fb0',
        date: entry.at,
      })
    } else if (entry.type === 'payment') {
      const importo = typeof entry.amount === 'number'
        ? ` di ${entry.amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })}`
        : ''
      events.push({
        key: `payment-${i}`,
        icon: <Banknote className="size-3" />,
        label: entry.kind === 'acconto' ? `Acconto ricevuto${importo}` : `Saldo ricevuto${importo}`,
        badgeBg: '#d4efe2', badgeColor: '#2f8a63',
        date: entry.at,
      })
    } else if (entry.type === 'payment_reset') {
      const importo = typeof entry.amount === 'number'
        ? ` (${entry.amount.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' })})`
        : ''
      // Il motivo resta leggibile per sempre (richiesta Eli 27 lug: "ogni
      // minima modifica tracciata"): gli acconti registrati prima restano
      // come voci proprie, questa dice quando e perché sono stati azzerati.
      const motivo =
        entry.reason === 'correzione' ? 'Acconto azzerato per correzione'
        : entry.reason === 'annullamento' ? 'Incasso azzerato — fattura annullata'
        : entry.reason === 'riattivazione' ? 'Incasso azzerato — fattura riattivata'
        : entry.reason === 'non_pagata' ? 'Incasso azzerato — segnata come non pagata'
        : 'Incasso azzerato'
      events.push({
        key: `payment-reset-${i}`,
        icon: <Banknote className="size-3" />,
        label: `${motivo}${importo}`,
        badgeBg: '#f5e9d0', badgeColor: '#b0863e',
        date: entry.at,
      })
    } else if (entry.type === 'cancelled') {
      events.push({
        key: `cancelled-${i}`,
        icon: <XCircle className="size-3" />,
        label: isFattura ? 'Annullata' : 'Annullato',
        badgeBg: '#f5dede', badgeColor: '#b05656',
        date: entry.at,
      })
    } else if (entry.type === 'reactivated') {
      events.push({
        key: `reactivated-${i}`,
        icon: <RotateCcw className="size-3" />,
        label: isFattura ? 'Riattivata: torna in bozza' : 'Riattivato',
        badgeBg: '#d8e8fb', badgeColor: '#3f6fb0',
        date: entry.at,
      })
    } else if (entry.type === 'restored') {
      events.push({
        key: `restored-${i}`,
        icon: <RotateCcw className="size-3" />,
        label: 'Ripristinato alla versione inviata',
        badgeBg: '#d4efe2', badgeColor: '#2f8a63',
        date: entry.at,
      })
    } else if (entry.type === 'marked_accepted') {
      events.push({
        key: `marked-accepted-${i}`,
        icon: <CheckCircle2 className="size-3" />,
        label: 'Segnato come accettato da te',
        detail: acceptedTierLabel ? `Proposta ${acceptedTierLabel}` : undefined,
        badgeBg: '#d4efe2', badgeColor: '#2f8a63',
        date: entry.at,
      })
    } else if (entry.type === 'marked_rejected') {
      events.push({
        key: `marked-rejected-${i}`,
        icon: <XCircle className="size-3" />,
        label: 'Segnato come rifiutato',
        badgeBg: '#f5dede', badgeColor: '#b05656',
        date: entry.at,
      })
    } else if (entry.type === 'marked_expired') {
      events.push({
        key: `marked-expired-${i}`,
        icon: <AlertTriangle className="size-3" />,
        label: 'Segnato come scaduto',
        badgeBg: '#f5e9d0', badgeColor: '#b0863e',
        date: entry.at,
      })
    } else if (entry.type === 'unaccepted') {
      events.push({
        key: `unaccepted-${i}`,
        icon: <RotateCcw className="size-3" />,
        label: 'Riportato in bozza (accettazione annullata)',
        badgeBg: '#d8e8fb', badgeColor: '#3f6fb0',
        date: entry.at,
      })
    } else if (entry.type === 'reopened') {
      events.push({
        key: `reopened-${i}`,
        icon: <RotateCcw className="size-3" />,
        label: 'Riaperto — di nuovo in attesa del cliente',
        badgeBg: '#d8e8fb', badgeColor: '#3f6fb0',
        date: entry.at,
      })
    } else if (entry.type === 'owner_message') {
      // Risposta dell'artigiano, visibile al cliente sulla pagina del documento
      events.push({
        key: `omsg-${i}`,
        icon: <MessageSquare className="size-3" />,
        label: 'Risposta inviata al cliente',
        detail: entry.text ?? null,
        badgeBg: '#e9e0f7', badgeColor: '#6a44b5',
        date: entry.at,
      })
    } else if (entry.type === 'client_message') {
      // Messaggio scritto dal cliente dalla pagina pubblica del documento
      events.push({
        key: `msg-${i}`,
        icon: <MessageSquare className="size-3" />,
        label: 'Messaggio dal cliente',
        detail: entry.text ?? null,
        badgeBg: '#e9e0f7', badgeColor: '#6a44b5',
        date: entry.at,
      })
    }
  })

  // Fattura collegata: usa created_at della fattura come timestamp del collegamento
  if (fatturaRef?.created_at) {
    const label = fatturaRef.doc_number
      ? `Fattura ${fatturaRef.doc_number.replace(/^[A-Za-z]+/, '')} collegata`
      : 'Fattura collegata'
    events.push({
      key: 'fattura',
      icon: <Link2 className="size-3" />,
      label,
      badgeBg: '#d4efe2', badgeColor: '#2f8a63',
      date: fatturaRef.created_at,
      href: `/fatture/${fatturaRef.id}`,
    })
  }

  // Sort events chronologically
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // Always show at least the "created" event; never return null
  if (events.length === 0) return null

  return (
    <div>
      {/* Cronologia a tendina (richiesta Eli 27 lug): chiusa di default,
          si apre con un tocco sull'intestazione. Il conteggio dice quanti
          eventi ci sono senza doverla aprire. */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', padding: 0,
          cursor: 'pointer', fontFamily: 'inherit', minHeight: 32,
          marginBottom: open ? 12 : 0,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64' }}>
          Cronologia{' '}
          <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: 'none', color: 'var(--cc-muted)' }}>
            · {events.length} {events.length === 1 ? 'evento' : 'eventi'}
          </span>
        </span>
        <ChevronDown
          className="size-4"
          style={{ color: '#6f6d64', flex: '0 0 auto', transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      {open && events.map((ev, i) => {
        const isLast = i === events.length - 1
        const body = (
          <>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}>{ev.label}</div>
            <div style={{ fontSize: 12, color: 'var(--cc-muted)', marginTop: 1 }}>{fmtDatetime(ev.date)}</div>
            {ev.detail && (
              <div style={{ fontSize: 12, color: 'var(--cc-muted)', marginTop: 2, fontStyle: 'italic' }}>{ev.detail}</div>
            )}
          </>
        )
        return (
          <div key={ev.key} style={{ position: 'relative', display: 'flex', gap: 13, paddingBottom: isLast ? 0 : 16 }}>
            {!isLast && <div style={{ position: 'absolute', left: 9, top: 21, bottom: -9, width: 1.5, background: '#ececef' }} />}
            <div style={{ width: 20, height: 20, borderRadius: '50%', background: ev.badgeBg, color: ev.badgeColor, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', zIndex: 1 }}>
              {ev.icon}
            </div>
            <div>
              {ev.href ? (
                <a href={ev.href} className="hover:underline underline-offset-2">{body}</a>
              ) : body}
            </div>
          </div>
        )
      })}
    </div>
  )
}
