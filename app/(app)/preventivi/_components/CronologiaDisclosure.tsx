'use client'

// ============================================================
// CronologiaDisclosure — tendina apri/chiudi per la cronologia
// (richiesta Eli 27 lug). Stesso header del DocumentTimeline:
// "CRONOLOGIA · N eventi" + chevron, chiusa di default. Usata
// dalla card cronologia MOBILE del dettaglio preventivo, che
// costruisce la sua lista inline (non passa da DocumentTimeline).
// ============================================================

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

export function CronologiaDisclosure({ count, children }: { count: number; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', background: 'none', border: 'none', padding: 0,
          cursor: 'pointer', fontFamily: 'inherit', minHeight: 32,
          marginBottom: open ? 12 : 0,
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64' }}>
          Cronologia{' '}
          <span style={{ fontWeight: 500, letterSpacing: 0, textTransform: 'none', color: 'var(--cc-muted)' }}>
            · {count} {count === 1 ? 'evento' : 'eventi'}
          </span>
        </span>
        <ChevronDown
          className="size-4"
          style={{ color: '#6f6d64', flex: '0 0 auto', transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }}
        />
      </button>
      {open && children}
    </div>
  )
}
