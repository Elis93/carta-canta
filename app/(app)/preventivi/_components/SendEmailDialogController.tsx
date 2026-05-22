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
  initialHasClient: boolean
  senderName: string
  isResend?: boolean
  initialOpen?: boolean
  hasVoci?: boolean
  docType?: 'preventivo' | 'fattura'
}

export function SendEmailDialogController({
  initialClientEmail,
  initialHasClient,
  initialOpen = false,
  ...rest
}: Props) {
  const [clientEmail, setClientEmail] = useState(initialClientEmail)
  const [hasClient, setHasClient]     = useState(initialHasClient)

  useEffect(() => {
    function handleClientChanged(e: Event) {
      const { email, hasClient: hc } = (e as CustomEvent<{ email: string | null; hasClient: boolean }>).detail
      setClientEmail(email)
      setHasClient(hc)
    }
    window.addEventListener('cartacanta:client-changed', handleClientChanged)
    return () => window.removeEventListener('cartacanta:client-changed', handleClientChanged)
  }, [])

  return (
    <SendEmailDialog
      {...rest}
      clientEmail={clientEmail}
      hasClient={hasClient}
      initialOpen={initialOpen}
    />
  )
}
