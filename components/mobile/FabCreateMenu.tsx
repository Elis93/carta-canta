'use client'

// ============================================================
// FabCreateMenu — il tasto centrale «+» della BottomNav con DUE scelte.
//
// Richiesta Eli (14 ago): rendere veloci le due creazioni più usate —
// «nuovo preventivo» e «nuovo sopralluogo». Toccando il + si apre una
// piccola scelta; «Nuovo preventivo» è primo e in evidenza (il più
// frequente), il sopralluogo appena sotto. Così il sopralluogo smette di
// essere sepolto in Altro.
//
// ⚠️ Overlay in PORTAL su <body> (regola B.2): un `position: fixed` dentro
// la nav sarebbe ritagliato/posizionato male. Chiude su: tocco sullo sfondo,
// Esc, scelta di un'opzione, cambio pagina. `data-tour="fab"` conservato sul
// bottone (il tutorial lo evidenzia).
// ============================================================

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus, FileText, HardHat } from 'lucide-react'

const OPT: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 13,
  borderRadius: 15, padding: '14px 16px', textDecoration: 'none',
  boxShadow: '0 10px 30px -10px rgba(20,20,40,.4)',
}
const OI: React.CSSProperties = {
  width: 40, height: 40, borderRadius: 11, flexShrink: 0,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

export function FabCreateMenu() {
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const pathname = usePathname()

  useEffect(() => setMounted(true), [])
  // Cambio pagina (dopo aver scelto un'opzione) → chiudi
  useEffect(() => { setOpen(false) }, [pathname])
  // Esc chiude + blocca lo scroll di fondo mentre è aperto
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open])

  return (
    <>
      <button
        type="button"
        data-tour="fab"
        aria-label="Crea nuovo"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {/* Solo il CERCHIO sporge (marginTop negativo qui, non sull'intero
            bottone): così l'etichetta «Crea» resta in basso, allineata con le
            altre della barra (Eli 15 ago: «stessa distanza col + al centro»
            — le scritte devono stare tutte sulla stessa riga). */}
        <div
          style={{
            width: 50, height: 50, borderRadius: '50%',
            background: 'var(--cc-navy)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: 'var(--cc-shadow-fab)',
            transition: 'transform .18s ease',
            transform: open ? 'rotate(45deg)' : 'none',
            marginTop: -22,
          }}
        >
          <Plus size={24} strokeWidth={2} />
        </div>
        <span style={{ fontSize: 12, lineHeight: 1, color: 'var(--cc-text-3)' }}>Crea</span>
      </button>

      {mounted && open && createPortal(
        <div role="menu" aria-label="Crea nuovo" style={{ position: 'fixed', inset: 0, zIndex: 60 }}>
          {/* Sfondo — un tocco chiude */}
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'absolute', inset: 0, background: 'rgba(20,20,30,.34)' }}
          />
          {/* Foglio sopra la barra */}
          <div style={{ position: 'absolute', left: 16, right: 16, bottom: 'calc(84px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link
              href="/preventivi/nuovo"
              role="menuitem"
              onClick={() => setOpen(false)}
              style={{ ...OPT, background: 'var(--cc-navy)', color: '#fff' }}
            >
              <span style={{ ...OI, background: 'rgba(255,255,255,.15)' }}><FileText size={20} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 15.5, fontWeight: 600 }}>Nuovo preventivo</b>
                <span style={{ fontSize: 12, opacity: .75 }}>Voci, cliente, invio in un tocco</span>
              </span>
            </Link>
            <Link
              href="/sopralluoghi/nuovo"
              role="menuitem"
              onClick={() => setOpen(false)}
              style={{ ...OPT, background: '#fff' }}
            >
              <span style={{ ...OI, background: '#f4efe3' }}><HardHat size={20} style={{ color: 'var(--cc-navy)' }} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 15.5, fontWeight: 600, color: '#161616' }}>Nuovo sopralluogo</b>
                <span style={{ fontSize: 12, color: 'var(--cc-muted)' }}>Foto e appunti presi presso il cliente</span>
              </span>
            </Link>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
