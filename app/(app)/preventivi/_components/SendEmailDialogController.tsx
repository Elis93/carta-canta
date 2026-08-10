'use client'

// ============================================================
// SendEmailDialogController
//
// Thin wrapper attorno a SendEmailDialog che:
// 1. Mantiene in stato locale l'email e il flag hasClient del cliente
// 2. Ascolta l'evento CustomEvent "cartacanta:client-changed" emesso da
//    PreventivoForm quando l'utente aggiunge/rimuove il cliente nel form
// 3. Aggiorna lo stato in tempo reale → il dialog riflette sempre il
//    cliente correntemente selezionato, senza refresh della pagina
// ============================================================

import { useState, useEffect } from 'react'
import { SendEmailDialog } from './SendEmailDialog'

interface Props {
  documentId: string
  docNumber: string | null
  initialClientEmail: string | null
  initialClientName: string | null
  initialHasClient: boolean
  senderName: string
  isResend?: boolean
  initialOpen?: boolean
  hasVoci?: boolean
  docType?: string
  hideTrigger?: boolean
}

export function SendEmailDialogController({
  initialClientEmail,
  initialClientName,
  initialHasClient,
  initialOpen = false,
  hasVoci: initialHasVoci = true,
  ...rest
}: Props) {
  const [clientEmail, setClientEmail] = useState(initialClientEmail)
  const [clientName,  setClientName]  = useState(initialClientName)
  const [hasClient,   setHasClient]   = useState(initialHasClient)
  // hasVoci vivo: la prop server-side è stale se l'utente aggiunge voci nel form
  // senza salvare — PreventivoForm emette "cartacanta:voci-changed" a ogni modifica
  // (stesso meccanismo usato da ShareButton).
  const [hasVoci, setHasVoci] = useState(initialHasVoci)

  useEffect(() => {
    function handleClientChanged(e: Event) {
      const { email, hasClient: hc, name } = (e as CustomEvent<{
        email: string | null
        hasClient: boolean
        name?: string | null
      }>).detail
      setClientEmail(email)
      setHasClient(hc)
      if (name !== undefined) setClientName(name)
    }
    function handleVociChanged(e: Event) {
      const { hasVoci: hv } = (e as CustomEvent<{ hasVoci: boolean }>).detail
      setHasVoci(hv)
    }
    window.addEventListener('cartacanta:client-changed', handleClientChanged)
    window.addEventListener('cartacanta:voci-changed', handleVociChanged)
    return () => {
      window.removeEventListener('cartacanta:client-changed', handleClientChanged)
      window.removeEventListener('cartacanta:voci-changed', handleVociChanged)
    }
  }, [])

  return (
    <SendEmailDialog
      {...rest}
      clientEmail={clientEmail}
      recipientName={clientName}
      hasClient={hasClient}
      hasVoci={hasVoci}
      initialOpen={initialOpen}
    />
  )
}
