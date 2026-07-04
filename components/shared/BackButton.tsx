'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

/**
 * Freccia "indietro" degli header mobile: torna alla pagina precedente della
 * cronologia (come il back del browser); se non c'è cronologia (link diretto),
 * va alla pagina di fallback.
 */
export function BackButton({ fallback, ariaLabel = 'Indietro' }: { fallback: string; ariaLabel?: string }) {
  const router = useRouter()
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) router.back()
        else router.push(fallback)
      }}
      style={{ color: '#55534b', display: 'flex', alignItems: 'center', background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
    >
      <ChevronLeft size={25} />
    </button>
  )
}
