'use client'

// ============================================================
// OpenSendDialogButton
//
// Bottone che apre il popup di invio email (SendEmailDialog) SENZA navigare.
// Serve quando il dialog è già montato sulla stessa pagina: una soft-navigation
// a ?send=1 non lo riaprirebbe (initialOpen viene letto solo al mount).
// Il dialog ascolta l'evento "cartacanta:open-send-dialog" e si apre se il
// documentId corrisponde.
// ============================================================

interface OpenSendDialogButtonProps {
  documentId: string
  style?: React.CSSProperties
  className?: string
  children: React.ReactNode
}

export function OpenSendDialogButton({ documentId, style, className, children }: OpenSendDialogButtonProps) {
  return (
    <button
      type="button"
      className={className}
      style={style}
      onClick={() => {
        window.dispatchEvent(new CustomEvent('cartacanta:open-send-dialog', { detail: { documentId } }))
      }}
    >
      {children}
    </button>
  )
}
