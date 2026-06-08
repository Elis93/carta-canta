'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, Mail, Phone } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AcceptModal } from './AcceptModal'
import { DeclineModal } from './DeclineModal'

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
          Accetto il preventivo
        </Button>

        <Button
          size="lg"
          variant="outline"
          className="flex-1 gap-2 text-destructive border-destructive/30 hover:bg-destructive/5 hover:border-destructive/50"
          onClick={() => setDeclineOpen(true)}
        >
          <XCircle className="size-5" />
          Rifiuto
        </Button>
      </div>

      {/* Contatto — separato, più sottile. Niente indirizzo email in chiaro:
          apre direttamente il client di posta (FIX-12 — non esporre l'email
          personale dell'account al cliente). */}
      {(contactEmail || contactPhone) && (
        <div className="flex items-center justify-center gap-1.5 pt-1 text-sm text-muted-foreground">
          <span>Hai domande?</span>
          {contactEmail && (
            <a
              href={`mailto:${contactEmail}`}
              className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
            >
              <Mail className="size-3.5" />
              Contatta {workspaceName}
            </a>
          )}
          {contactEmail && contactPhone && (
            <span className="text-muted-foreground/50">·</span>
          )}
          {contactPhone && (
            <a
              href={`tel:${contactPhone}`}
              className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
            >
              <Phone className="size-3.5" />
              {contactPhone}
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
