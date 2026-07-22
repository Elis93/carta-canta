'use client'

// Freccia "indietro" per la pagina pubblica /professionisti (feedback Eli 22 lug #3).
// Pagina raggiungibile sia dall'app (Fatti trovare) sia da link esterni: se c'è
// una cronologia si torna indietro, altrimenti si va alla home del sito.

import { ArrowLeft } from 'lucide-react'

export function BackChip() {
  return (
    <button
      type="button"
      aria-label="Torna indietro"
      onClick={() => {
        if (window.history.length > 1) window.history.back()
        else window.location.href = '/'
      }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 36, height: 36, borderRadius: 10, border: '1px solid #e3e3e6',
        background: '#fff', color: '#1a1a2e', cursor: 'pointer', flexShrink: 0,
      }}
    >
      <ArrowLeft size={18} />
    </button>
  )
}
