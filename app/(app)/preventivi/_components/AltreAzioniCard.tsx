'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface AltreAzioniCardProps {
  children: React.ReactNode
}

export function AltreAzioniCard({ children }: AltreAzioniCardProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="cc-card-md" style={{ padding: '4px 15px' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          padding: '13px 0',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--cc-text)' }}>Altre azioni</span>
        <ChevronDown
          size={19}
          style={{
            color: 'var(--cc-text-3)',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}
        />
      </button>
      <div className={open ? 'pb-4 flex flex-col gap-3' : 'hidden'}>
        {children}
      </div>
    </div>
  )
}
