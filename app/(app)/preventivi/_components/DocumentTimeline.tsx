'use client'

import { CheckCircle2, Send, Eye, FileText, XCircle, Clock, AlertTriangle, Link2, Pencil, RotateCcw } from 'lucide-react'

export interface DocumentLogEntry {
  type: 'modified' | 'restored' | 'resent'
  at: string
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
}

function fmtDatetime(iso: string): string {
  return new Date(iso).toLocaleString('it-IT', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
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
}: DocumentTimelineProps) {
  const isFattura = docType === 'fattura'
  const events: TimelineEvent[] = []

  if (createdAt) {
    events.push({
      key: 'created',
      icon: <FileText className="size-3.5" />,
      label: 'Documento creato',
      badgeBg: '#f0f0f2', badgeColor: '#b3b1ab',
      date: createdAt,
    })
  }

  if (sentAt) {
    events.push({
      key: 'sent',
      icon: <Send className="size-3.5" />,
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
      icon: <Eye className="size-3.5" />,
      label: `Prima apertura${views.length > 1 ? ` · ${views.length} visualizzazioni totali` : ''}`,
      badgeBg: '#fbe1ee', badgeColor: '#c25b91',
      date: firstView.viewed_at,
    })
  }

  if (acceptedAt) {
    events.push({
      key: 'accepted',
      icon: <CheckCircle2 className="size-3.5" />,
      label: isFattura ? 'Accettata' : 'Accettato',
      badgeBg: '#d4efe2', badgeColor: '#2f8a63',
      date: acceptedAt,
    })
  }

  if (status === 'rejected') {
    // No specific rejection timestamp — use accepted_at slot as fallback (shouldn't coexist)
    const rejDate = sentAt ?? createdAt ?? new Date().toISOString()
    events.push({
      key: 'rejected',
      icon: <XCircle className="size-3.5" />,
      label: isFattura ? 'Rifiutata dal cliente' : 'Rifiutato dal cliente',
      detail: rejectionReason ?? null,
      badgeBg: '#f5dede', badgeColor: '#b05656',
      date: rejDate,
    })
  }

  if (status === 'expired' && expiresAt) {
    events.push({
      key: 'expired',
      icon: <AlertTriangle className="size-3.5" />,
      label: isFattura ? 'Scaduta' : 'Scaduto',
      badgeBg: '#f5e9d0', badgeColor: '#b0863e',
      date: expiresAt,
    })
  } else if (!isFattura && (status === 'sent' || status === 'viewed') && expiresAt) {
    const isExpiredNow = new Date(expiresAt) < new Date()
    if (!isExpiredNow) {
      events.push({
        key: 'expires',
        icon: <Clock className="size-3.5" />,
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
        icon: <Pencil className="size-3.5" />,
        label: 'Documento aggiornato',
        badgeBg: '#ede9f7', badgeColor: '#7c3aed',
        date: entry.at,
      })
    } else if (entry.type === 'resent') {
      events.push({
        key: `resent-${i}`,
        icon: <Send className="size-3.5" />,
        label: isFattura ? 'Reinviata al cliente' : 'Reinviato al cliente',
        badgeBg: '#d8e8fb', badgeColor: '#3f6fb0',
        date: entry.at,
      })
    } else if (entry.type === 'restored') {
      events.push({
        key: `restored-${i}`,
        icon: <RotateCcw className="size-3.5" />,
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
      icon: <Link2 className="size-3.5" />,
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
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
        Cronologia
      </h3>
      <ol className="relative ml-2 space-y-4" style={{ borderLeft: '1.5px solid #e5e5ea' }}>
        {events.map((ev) => (
          <li key={ev.key} className="ml-4">
            <span
              className="absolute -left-2.5 flex size-5 items-center justify-center rounded-full"
              style={{ background: ev.badgeBg, color: ev.badgeColor, outline: '2px solid #fff' }}
            >
              {ev.icon}
            </span>
            <div>
              {ev.href ? (
                <a href={ev.href} className="text-sm font-medium leading-tight hover:underline underline-offset-2">
                  {ev.label}
                </a>
              ) : (
                <p className="text-sm font-medium leading-tight">{ev.label}</p>
              )}
              <time className="text-xs text-muted-foreground">{fmtDatetime(ev.date)}</time>
              {ev.detail && (
                <p className="mt-0.5 text-xs text-muted-foreground italic">{ev.detail}</p>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  )
}
