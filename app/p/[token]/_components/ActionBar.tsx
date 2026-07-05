'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, Mail, MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AcceptModal } from './AcceptModal'
import { DeclineModal } from './DeclineModal'

/**
 * Normalizza un numero di telefono per il formato wa.me (solo cifre, con prefisso internazionale).
 * Supporta numeri italiani (mobili +39 3xx, fissi 0xx) e numeri già in formato internazionale.
 */
function normalizePhoneForWhatsApp(phone: string): string {
  // Rimuovi tutto tranne cifre e il + iniziale
  const stripped = phone.replace(/[^\d+]/g, '')
  // Se già in formato internazionale con +, rimuovi solo il +
  if (stripped.startsWith('+')) return stripped.slice(1)
  // Se già con prefisso 00, togli i due zero
  if (stripped.startsWith('00')) return stripped.slice(2)
  // Numeri italiani: mobile 3xx (10 cifre) → prependi 39
  if (/^3\d{9}$/.test(stripped)) return `39${stripped}`
  // Fissi italiani: 0x... → prependi 39 (rimuovendo lo 0 iniziale, ma li lasciamo così)
  return stripped
}

interface ActionBarProps {
  token: string
  documentTitle: string
  workspaceName: string
  contactEmail: string | null
  contactPhone: string | null
}

export function ActionBar({
  token,
  documentTitle,
  workspaceName,
  contactEmail,
  contactPhone,
}: ActionBarProps) {
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [declineOpen, setDeclineOpen] = useState(false)

  return (
    <>
      {/* Pulsanti principali */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <Button
          size="lg"
          className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white shadow-sm"
          onClick={() => setAcceptOpen(true)}
        >
          <CheckCircle2 className="size-5" />
          Accetta e firma
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="flex-1 gap-2 text-destructive border-destructive/30 hover:bg-destructive/5 hover:border-destructive/50"
          onClick={() => setDeclineOpen(true)}
        >
          <XCircle className="size-5" />
          Rifiuta
        </Button>
      </div>

      {/* Contatto — separato, più sottile.
          FIX-12: niente indirizzo email in chiaro (apre solo il client di posta).
          FIX-06: se il workspace ha un telefono, mostra WhatsApp come canale preferito. */}
      {(contactEmail || contactPhone) && (
        <div className="flex items-center justify-center gap-1.5 pt-1 text-sm text-muted-foreground flex-wrap">
          <span>Hai domande?</span>
          {contactPhone && (
            <a
              href={`https://wa.me/${normalizePhoneForWhatsApp(contactPhone)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
            >
              <MessageCircle className="size-3.5 text-green-600" />
              Scrivi su WhatsApp
            </a>
          )}
          {contactPhone && contactEmail && (
            <span className="text-muted-foreground/50">·</span>
          )}
          {contactEmail && (
            <a
              href={`mailto:${contactEmail}`}
              className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
            >
              <Mail className="size-3.5" />
              Contatta {workspaceName}
            </a>
          )}
        </div>
      )}

      <AcceptModal
        open={acceptOpen}
        onClose={() => setAcceptOpen(false)}
        token={token}
        documentTitle={documentTitle}
        workspaceName={workspaceName}
      />
      <DeclineModal
        open={declineOpen}
        onClose={() => setDeclineOpen(false)}
        token={token}
        documentTitle={documentTitle}
        workspaceName={workspaceName}
      />
    </>
  )
}
