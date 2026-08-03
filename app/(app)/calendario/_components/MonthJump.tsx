'use client'

// ============================================================
// MonthJump — il "mese anno" in testa all'Agenda diventa un bottone:
// al tocco si apre il salto rapido (anno con frecce + griglia dei 12
// mesi) per raggiungere mesi lontani senza premere la freccia N volte
// (richiesta Eli 2 ago sera). Naviga con replace come le frecce.
// ============================================================

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'

const MESI = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']

export function MonthJump({ monthParam, label }: { monthParam: string; label: string }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const selYear = Number(monthParam.slice(0, 4))
  const selMonth = Number(monthParam.slice(5, 7))
  const [year, setYear] = useState(selYear)

  function go(month: number) {
    setOpen(false)
    router.replace(`/calendario?m=${year}-${String(month).padStart(2, '0')}`)
  }

  return (
    <span style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => { setYear(selYear); setOpen((o) => !o) }}
        aria-expanded={open}
        aria-label="Scegli mese e anno"
        style={{
          minWidth: 150, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          background: 'none', border: 'none', padding: 4, cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 15, fontWeight: 600, color: '#161616', textTransform: 'capitalize',
        }}
      >
        {label}
        <ChevronDown size={15} style={{ color: 'var(--cc-muted)', transition: 'transform .15s', transform: open ? 'rotate(180deg)' : 'none' }} />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: '50%', transform: 'translateX(-50%)',
            zIndex: 30, width: 264, background: '#fff', borderRadius: 14,
            boxShadow: '0 1px 3px rgba(20,20,40,.08), 0 14px 34px -10px rgba(20,20,40,.3)',
            border: '0.5px solid #e6e6e6', padding: '10px 12px 12px',
          }}
        >
          {/* Anno con frecce */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <button type="button" onClick={() => setYear((y) => y - 1)} aria-label="Anno precedente" style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', color: '#55534b', display: 'flex' }}>
              <ChevronLeft size={17} />
            </button>
            <span style={{ fontSize: 15, fontWeight: 700, color: '#161616' }}>{year}</span>
            <button type="button" onClick={() => setYear((y) => y + 1)} aria-label="Anno successivo" style={{ background: 'none', border: 'none', padding: 6, cursor: 'pointer', color: '#55534b', display: 'flex' }}>
              <ChevronRight size={17} />
            </button>
          </div>
          {/* Griglia dei 12 mesi */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 6 }}>
            {MESI.map((nome, idx) => {
              const m = idx + 1
              const attivo = year === selYear && m === selMonth
              return (
                <button
                  key={nome}
                  type="button"
                  onClick={() => go(m)}
                  style={{
                    padding: '9px 0', borderRadius: 9, fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
                    border: attivo ? 'none' : '1px solid #eeeeee',
                    background: attivo ? '#1a1a2e' : '#fff',
                    color: attivo ? '#fff' : '#55534b',
                    cursor: 'pointer',
                  }}
                >
                  {nome}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </span>
  )
}
