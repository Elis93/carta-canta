'use client'

// "Apri lavoro" sul preventivo ACCETTATO: crea (o riapre) il Lavoro
// collegato — sezione Lavori, decisione Eli 7 lug 2026. Idempotente:
// se il lavoro esiste già si viene portati lì.

import { useState, useTransition } from 'react'
import { runAction } from '@/lib/run-action'
import { Hammer, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { createLavoroFromPreventivoAction } from '@/lib/actions/lavori'

export function ApriLavoroButton({ documentId, fullWidth = false, compact = false, triggerStyle }: { documentId: string; fullWidth?: boolean; /** Una riga sola (menu «⋯» e tendina Collegati). */ compact?: boolean; triggerStyle?: React.CSSProperties }) {
  const [pending, startTransition] = useTransition()
  const [clicked, setClicked] = useState(false)

  function handleClick() {
    setClicked(true)
    startTransition(async () => {
      // Il redirect a /lavori/[id] avviene nella server action (NEXT_REDIRECT)
      const result = await runAction(() => createLavoroFromPreventivoAction(documentId), 'aprire il lavoro')
      if (result?.error) {
        toast.error(result.error, { duration: 10_000, closeButton: true })
        setClicked(false)
      }
    })
  }

  // 19 lug (Eli: "non si capisce che cosa bisogna farci"): etichetta estesa
  // con la riga che spiega a cosa serve la scheda lavoro.
  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={pending}
      style={{
        width: fullWidth ? '100%' : undefined,
        minHeight: 54, borderRadius: 12, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e',
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(20,20,40,.05)',
        opacity: pending ? 0.7 : 1, padding: fullWidth ? '8px 12px' : '8px 16px',
        ...triggerStyle,
      }}
    >
      {pending && clicked ? <Loader2 size={18} className="animate-spin" style={{ flexShrink: 0 }} /> : <Hammer size={18} style={{ flexShrink: 0 }} />}
      {compact ? (
        <span style={{ fontSize: 14, fontWeight: 600 }}>Apri la scheda lavoro</span>
      ) : (
      <span style={{ textAlign: 'left' }}>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 600, lineHeight: 1.25 }}>Apri la scheda lavoro</span>
        <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: 'var(--cc-muted)', lineHeight: 1.3, marginTop: 1 }}>
          Ore in cantiere, foto e rapportino di fine lavoro
        </span>
      </span>
      )}
    </button>
  )
}
