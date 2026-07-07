'use client'

// "Apri lavoro" sul preventivo ACCETTATO: crea (o riapre) il Lavoro
// collegato — sezione Lavori, decisione Eli 7 lug 2026. Idempotente:
// se il lavoro esiste già si viene portati lì.

import { useState, useTransition } from 'react'
import { Hammer, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createLavoroFromPreventivoAction } from '@/lib/actions/lavori'

export function ApriLavoroButton({ documentId, fullWidth = false }: { documentId: string; fullWidth?: boolean }) {
  const [pending, startTransition] = useTransition()
  const [clicked, setClicked] = useState(false)

  function handleClick() {
    setClicked(true)
    startTransition(async () => {
      // Il redirect a /lavori/[id] avviene nella server action (NEXT_REDIRECT)
      const result = await createLavoroFromPreventivoAction(documentId)
      if (result?.error) {
        toast.error(result.error, { duration: 10_000, closeButton: true })
        setClicked(false)
      }
    })
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      style={{
        width: fullWidth ? '100%' : undefined,
        height: 48, borderRadius: 12, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e',
        fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(20,20,40,.05)',
        opacity: pending ? 0.7 : 1, padding: fullWidth ? undefined : '0 16px',
      }}
    >
      {pending && clicked ? <Loader2 size={17} className="animate-spin" /> : <Hammer size={17} />}
      Apri lavoro
    </button>
  )
}
