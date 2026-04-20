'use client'

import { useState } from 'react'
import { CheckCircle2, XCircle, MessageCircle, Download } from 'lucide-react'
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

  // Link di contatto: preferisce email, poi telefono
  const contactHref = contactEmail
    ? `mailto:${contactEmail}`
    : contactPhone
    ? `tel:${contactPhone}`
    : null

  const contactLabel = contactEmail ?? contactPhone

  return (
    <>
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        {/* Accetta */}
        <Button
          size="lg"
          className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
          onClick={() => setAcceptOpen(true)}
        >
          <CheckCircle2 className="size-5" />
          Accetto il preventivo
        </Button>

        {/* Rifiuta */}
        <Button
          size="lg"
          variant="outline"
          className="flex-1 gap-2 text-destructive border-destructive/40 hover:bg-destructive/5"
          onClick={() => setDeclineOpen(true)}
        >
          <XCircle className="size-5" />
          Rifiuto
        </Button>

        {/* Contatta */}
        {contactHref && (
          <Button
            size="lg"
            variant="secondary"
            className="gap-2"
            asChild
          >
            <a href={contactHref}>
              <MessageCircle className="size-5" />
              <span className="hidden sm:inline">Hai domande?</span>
              <span className="sm:hidden">Contatta</span>
            </a>
          </Button>
        )}

        {/* Scarica PDF */}
        <Button
          size="lg"
          variant="outline"
          className="gap-2"
          asChild
        >
          <a href={`/api/p/${token}/pdf`} target="_blank" rel="noopener noreferrer">
            <Download className="size-5" />
            <span className="hidden sm:inline">Scarica PDF</span>
            <span className="sm:hidden">PDF</span>
          </a>
        </Button>
      </div>

      {contactLabel && (
        <p className="text-xs text-muted-foreground text-center mt-1">
          Dubbi sul preventivo?{' '}
          <a href={contactHref ?? '#'} className="underline hover:text-foreground">
            Contatta {workspaceName}
          </a>
          {contactEmail && ` (${contactEmail})`}
        </p>
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
