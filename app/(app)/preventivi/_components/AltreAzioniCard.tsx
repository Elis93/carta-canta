'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

interface AltreAzioniCardProps {
  children: React.ReactNode
}

export function AltreAzioniCard({ children }: AltreAzioniCardProps) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '4px 15px' }}>
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
        <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#8a887f' }}>Altre azioni</span>
        <ChevronDown
          size={18}
          style={{
            color: '#8a887f',
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.2s',
          }}
        />
      </button>
      {open && (
        <div className="cc-altre-rows" style={{ paddingBottom: 4 }}>
          {children}
        </div>
      )}
    </div>
  )
}
