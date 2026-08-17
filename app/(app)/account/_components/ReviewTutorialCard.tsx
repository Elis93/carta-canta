'use client'

// ============================================================
// Scheda «Tutorial» di /aiuto — RIDOTTA AL MINIMO (Eli, 17 ago: «è
// confusionaria e ci sono troppe informazioni, lasciamole al minimo.
// I tutorial stessi, come sono ora, vanno bene»).
//
// Tre righe toccabili, stesse forme delle voci di menu: il giro guidato
// del primo preventivo + le guide di sezione. Niente paragrafi introduttivi:
// il titolo di ogni riga dice già tutto.
// ============================================================

import { GraduationCap, Compass, ChevronRight } from 'lucide-react'
import { SECTION_TOURS, SECTION_TOUR_REQUEST } from '@/components/tour/section-tours'

// ⚠️ Queste navigazioni sono a PAGINA INTERA (window.location.href, serve uno
// stato pulito per driver.js). Ma una navigazione dura non fa girare i cleanup
// di React: la grazia `cc_lock_nav` — che AppLock scrive allo smontaggio — non
// veniva mai scritta, e sul documento nuovo il blocco app chiedeva l'IMPRONTA
// a chi stava già usando l'app sbloccata (Eli, 17 ago). La si scrive QUI,
// prima di navigare — MAI col lucchetto a schermo (AppLock non ha focus trap:
// un Invio «alla cieca» da tastiera fisica non deve aprire il documento nuovo
// senza blocco). A scheda chiusa sessionStorage muore: la vera riapertura
// resta bloccata come prima.
function conGraziaLucchetto(vai: () => void) {
  try {
    if (!document.querySelector('[aria-label="App bloccata"]')) {
      sessionStorage.setItem('cc_lock_nav', String(Date.now()))
    }
  } catch { /* noop */ }
  vai()
}

const rowStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left',
  background: 'none', border: 'none', padding: '14px 0', cursor: 'pointer',
  fontFamily: 'inherit',
}

export function ReviewTutorialCard() {
  function apriGuida(key: string, path: string) {
    try {
      sessionStorage.setItem(SECTION_TOUR_REQUEST, key)
    } catch { /* senza storage la guida non parte: si apre comunque la pagina */ }
    conGraziaLucchetto(() => { window.location.href = path })
  }

  function apriTourPrincipale() {
    try {
      sessionStorage.setItem('cc_tour_restart', '1')
      sessionStorage.removeItem('cc_tour_step')
    } catch { /* noop */ }
    conGraziaLucchetto(() => { window.location.href = '/dashboard' })
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)', padding: '2px 15px' }}>
      <button type="button" onClick={apriTourPrincipale} style={{ ...rowStyle, borderBottom: '0.5px solid #eee' }}>
        <GraduationCap size={20} strokeWidth={1.75} style={{ flexShrink: 0, color: '#1a1a2e' }} aria-hidden />
        <span style={{ flex: 1, fontSize: 15, color: '#161616' }}>Il primo preventivo · 5 passi</span>
        <ChevronRight size={18} strokeWidth={1.5} style={{ flexShrink: 0, color: 'var(--cc-muted)' }} aria-hidden />
      </button>
      {Object.entries(SECTION_TOURS).map(([key, tour], i, arr) => (
        <button
          key={key}
          type="button"
          onClick={() => apriGuida(key, tour.path)}
          style={{ ...rowStyle, borderBottom: i < arr.length - 1 ? '0.5px solid #eee' : 'none' }}
        >
          <Compass size={20} strokeWidth={1.75} style={{ flexShrink: 0, color: '#1a1a2e' }} aria-hidden />
          <span style={{ flex: 1, fontSize: 15, color: '#161616' }}>{tour.label}</span>
          <ChevronRight size={18} strokeWidth={1.5} style={{ flexShrink: 0, color: 'var(--cc-muted)' }} aria-hidden />
        </button>
      ))}
    </div>
  )
}
