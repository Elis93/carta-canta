'use client'

import { CheckCircle2, Send, Eye, FileText, XCircle, Clock, AlertTriangle, Link2, Pencil, RotateCcw, Banknote } from 'lucide-react'

export interface DocumentLogEntry {
  // 'payment'/'payment_reset' (26 lug, feedback Eli dal collaudo A1): gli
  // incassi non comparivano da nessuna parte. Restano qui PER SEMPRE, anche
  // dopo un annullamento o una riattivazione che azzerano i campi
  // dell'incasso: il registro è la memoria di cosa è successo davvero.
  type: 'modified' | 'restored' | 'resent' | 'payment' | 'payment_reset'
  at: string
  /** solo payment/payment_reset: importo in euro */
  amount?: number
  /** solo payment: acconto (parziale) o saldo (chiude la fattura) */
  kind?: 'acconto' | 'saldo'
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
}: DocumentTimelineProps) {
  const isFattura = docType === 'fattura'
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

  if (sentAt) {
    events.push({
      key: 'sent',
      icon: <Send className="size-3" />,
      label: isFattura ? 'Inviata al cliente' : 'Inviato al cliente',
      badgeBg: '#d8e8fb', badgeColor: '#3f6fb0',
      date: sentAt,
    })
  }

  // First view only (earliest viewed_at)
  if (views.length > 0) {
    const sorted = [...views].sort(
      (a, b) => new Date(a.viewed_at).getTime() - new Date(b.viewed_at).getTime()
    )
    const firstView = sorted[0]
    events.push({
      key: 'viewed',
      icon: <Eye className="size-3" />,
      label: `Prima apertura${views.length > 1 ? ` · ${views.length} visualizzazioni totali` : ''}`,
      badgeBg: '#fbe1ee', badgeColor: '#c25b91',
      date: firstView.viewed_at,
    })
  }

  if (acceptedAt) {
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
        : 'Segnato come accettato manualmente',
      badgeBg: '#d4efe2', badgeColor: '#2f8a63',
      date: acceptedAt,
    })
  }

  if (status === 'rejected') {
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

  if (status === 'expired' && expiresAt) {
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
      events.push({
        key: `payment-reset-${i}`,
        icon: <Banknote className="size-3" />,
        label: `Incasso azzerato${importo}`,
        badgeBg: '#f5e9d0', badgeColor: '#b0863e',
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
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 12 }}>
        Cronologia
      </div>
      {events.map((ev, i) => {
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
