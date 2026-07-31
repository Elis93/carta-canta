'use client'

// Freccia "indietro" per la pagina pubblica /professionisti (feedback Eli 22 lug #3).
// Riscritta il 29 lug (Eli: "clicco indietro e non succede nulla"): il vecchio
// history.back() cieco, dopo ricerche e "Vicino a me", ripercorreva le varianti
// della STESSA pagina una a una. Ora:
//  · chi arriva DALL'APP (NavTracker ha registrato l'ultima pagina in-app in
//    sessionStorage) torna DRITTO a quella pagina (es. Fatti trovare);
//  · chi arriva da fuori (Google, link) ha il normale back del browser;
//  · senza cronologia si va alla home del sito.

import { ArrowLeft } from 'lucide-react'
import { useRouter } from 'next/navigation'

export function BackChip() {
  const router = useRouter()
  return (
    <button
      type="button"
      aria-label="Torna indietro"
      onClick={() => {
        let prev: string | null = null
        try {
          prev = sessionStorage.getItem('cc_last_path') ?? sessionStorage.getItem('cc_prev_path')
        } catch { /* storage bloccato */ }
        if (prev && prev !== '/professionisti') router.push(prev)
        else if (window.history.length > 1) window.history.back()
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
