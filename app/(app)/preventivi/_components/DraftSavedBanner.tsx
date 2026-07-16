'use client'

// Pop-up "Bozza salvata" mostrato sulla lista dopo la creazione di un nuovo
// documento (redirect con ?bozza=<numero assegnato>).
// Richiesta Eli (4 lug): il numero assegnato deve essere BEN VISIBILE e il
// pop-up NON deve sparire da solo — resta finché l'utente non lo chiude.

import { useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { formatDocNumber } from '@/lib/utils'

interface DraftSavedBannerProps {
  /** Numero documento assegnato (es. "001/2026") — null per i redirect legacy ?bozza=1 */
  docNumber?: string | null
  docType?: 'preventivo' | 'fattura'
}

export function DraftSavedBanner({ docNumber = null, docType = 'preventivo' }: DraftSavedBannerProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [visible, setVisible] = useState(true)

  if (!visible) return null

  const isFattura = docType === 'fattura'

  function close() {
    setVisible(false)
    // Rimuovi ?bozza= dall'URL sostituendo la history entry
    router.replace(pathname)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm" onClick={close}>
      <div
        className="bg-white rounded-2xl shadow-2xl px-8 py-8 flex flex-col items-center gap-3 max-w-xs w-full mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        <CheckCircle2 className="size-12 text-green-500" />
        <p className="text-lg font-semibold text-center">Bozza salvata</p>
        {docNumber && (
          <div style={{ background: '#f4f4f5', borderRadius: 10, padding: '8px 18px', textAlign: 'center' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cc-muted)' }}>
              Numero assegnato
            </div>
            <div className="font-mono" style={{ fontSize: 20, fontWeight: 700, color: '#161616', marginTop: 2 }}>
              {formatDocNumber(docNumber, docType)}
            </div>
          </div>
        )}
        <p className="text-sm text-muted-foreground text-center">
          {isFattura
            ? 'La fattura è stata salvata come bozza.'
            : 'Il preventivo è stato salvato come bozza.'}
        </p>
        <button
          type="button"
          onClick={close}
          style={{ marginTop: 4, width: '100%', height: 44, borderRadius: 11, background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer' }}
        >
          Chiudi
        </button>
      </div>
    </div>
  )
}
