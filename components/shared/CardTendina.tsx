'use client'

// ============================================================
// CardTendina — card bianca con la testata che apre e chiude il contenuto
// (Eli 25 ago: «foto lavoro, cliente e fattura elettronica che si possono
// chiudere e aprire come menu a tendina» nel riepilogo del documento).
//
// Chiusa mostra il riepilogo (`summary`) accanto all'etichetta, così
// l'informazione essenziale resta a colpo d'occhio. Con `anchorId` la card
// si apre da sola quando l'indirizzo porta la sua ancora (deep-link dalla
// campanella — stesso schema di MessaggiCard).
// ============================================================

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'

export function CardTendina({
  label,
  summary,
  defaultOpen = false,
  anchorId,
  children,
  style,
  className,
}: {
  label: string
  /** Riepilogo mostrato accanto all'etichetta quando la card è CHIUSA. */
  summary?: React.ReactNode
  defaultOpen?: boolean
  /** Ancora per i deep-link: arrivando con #anchorId la card si apre da sola. */
  anchorId?: string
  children: React.ReactNode
  style?: React.CSSProperties
  className?: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  // Dopo il mount (window non esiste sul server): il deep-link deve trovare
  // la card APERTA, non solo la pagina scrollata al punto giusto (25 ago).
  useEffect(() => {
    if (!anchorId) return
    const check = () => { if (window.location.hash === `#${anchorId}`) setOpen(true) }
    check()
    // Anche un link «#ancora» nella STESSA pagina (es. il navy «Rapportino
    // di fine lavoro» sulla scheda Lavoro) deve aprire la tendina.
    window.addEventListener('hashchange', check)
    return () => window.removeEventListener('hashchange', check)
  }, [anchorId])

  return (
    <div
      id={anchorId}
      className={className}
      style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '13px 15px', scrollMarginTop: anchorId ? 80 : undefined, ...style }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', padding: 0, marginBottom: open ? 10 : 0, cursor: 'pointer', fontFamily: 'inherit', minHeight: 28 }}
      >
        <span style={{ flexShrink: 0, fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64' }}>{label}</span>
        {!open && summary != null && (
          <span style={{ flex: 1, minWidth: 0, textAlign: 'right', fontSize: 13.5, fontWeight: 600, color: '#161616', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {summary}
          </span>
        )}
        {(open || summary == null) && <span style={{ flex: 1 }} />}
        <ChevronDown size={18} style={{ color: '#1a1a2e', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }} />
      </button>
      {open && children}
    </div>
  )
}
