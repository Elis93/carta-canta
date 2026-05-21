'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, Phone, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { sendReminderAction } from '@/lib/actions/documents'
import { formatCurrency } from '@/lib/utils'

interface PendingDocCardProps {
  documentId: string
  docNumber: string | null
  title: string | null
  total: number | null
  sentAt: string | null
  lastReminderAt: string | null
  updatedAfterSendAt?: string | null
  clientName: string | null
  clientEmail: string | null
  clientPhone: string | null
}

export function PendingDocCard({
  documentId,
  docNumber,
  title,
  total,
  sentAt,
  lastReminderAt,
  updatedAfterSendAt,
  clientName,
  clientEmail,
  clientPhone,
}: PendingDocCardProps) {
  const [sending, setSending]     = useState(false)
  const [sent, setSent]           = useState(false)
  const [justSentAt, setJustSentAt] = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)

  async function handleSollecita() {
    setSending(true)
    setError(null)
    const result = await sendReminderAction(documentId)
    if (result.error) {
      setError(result.error)
    } else {
      setSent(true)
      setJustSentAt(new Date().toISOString())
    }
    setSending(false)
  }

  const sentDate = sentAt
    ? new Date(sentAt).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })
    : null

  // Usa il timestamp appena inviato (ottimistico) oppure quello dal DB
  const effectiveReminderAt = justSentAt ?? lastReminderAt

  const reminderLabel = effectiveReminderAt
    ? `Ultimo sollecito: ${new Date(effectiveReminderAt).toLocaleString('it-IT', {
        day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
      })}`
    : 'Nessun sollecito inviato'

  const docLabel = docNumber ?? title ?? 'Preventivo'

  return (
    <div className="space-y-3">
      {/* Info documento */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            href={`/preventivi/${documentId}`}
            className="text-sm font-semibold hover:underline underline-offset-2 truncate block"
          >
            {docLabel}
          </Link>
          {clientName && (
            <p className="text-xs text-muted-foreground truncate">{clientName}</p>
          )}
          {sentDate && (
            <p className="text-xs text-muted-foreground">Inviato il {sentDate}</p>
          )}
        </div>
        <p className="text-base font-bold shrink-0 tabular-nums">
          {formatCurrency(total ?? 0)}
        </p>
      </div>

      {/* Indicatore: preventivo modificato dopo l'invio */}
      {updatedAfterSendAt && (
        <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
          <AlertTriangle className="size-3 shrink-0" />
          <span>Modificato — cliente non aggiornato</span>
        </div>
      )}

      {/* Stato ultimo sollecito */}
      <p className={`text-xs ${effectiveReminderAt ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
        {reminderLabel}
      </p>

      {/* Errore sollecito */}
      {error && (
        <p className="text-xs text-destructive bg-destructive/10 rounded px-2 py-1">{error}</p>
      )}

      {/* Azioni */}
      <div className="flex flex-col gap-1.5">
        {clientEmail && (
          <Button
            variant="outline"
            size="sm"
            className="justify-start text-xs h-8"
            disabled={sending || sent}
            onClick={handleSollecita}
          >
            {sending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : sent ? (
              <CheckCircle2 className="size-3.5 text-green-500" />
            ) : (
              <Mail className="size-3.5" />
            )}
            {sent ? 'Sollecito inviato ✓' : 'Sollecita via email'}
          </Button>
        )}

        {clientPhone && (
          <Button
            variant="outline"
            size="sm"
            className="justify-start text-xs h-8"
            asChild
          >
            <a href={`tel:${clientPhone.replace(/\s/g, '')}`}>
              <Phone className="size-3.5" />
              {clientPhone}
            </a>
          </Button>
        )}
      </div>
    </div>
  )
}
