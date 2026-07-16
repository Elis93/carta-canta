'use client'

// ============================================================
// RichiamoCard — promemoria manutenzione sul Lavoro (migration 052).
// "Richiama il cliente tra 3/6/12 mesi" (es. manutenzione caldaia):
// alla data scelta compare la notifica in campanella. Un richiamo per
// lavoro; il fatturato ricorrente è il motivo per cui esiste la card.
// ============================================================

import { useState, useTransition } from 'react'
import { BellRing, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { setRecallAction } from '@/lib/actions/lavori'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

function plusMonths(months: number): string {
  const d = new Date()
  d.setMonth(d.getMonth() + months)
  return d.toLocaleDateString('sv-SE') // YYYY-MM-DD, fuso del telefono
}

export function RichiamoCard({ lavoroId, recallAt, recallNote }: {
  lavoroId: string
  recallAt: string | null
  recallNote: string | null
}) {
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()
  // Spinner solo sull'azione premuta
  const [action, setAction] = useState<string | null>(null)

  function save(dateStr: string | null, noteStr?: string, actionKey?: string) {
    setAction(actionKey ?? 'save')
    startTransition(async () => {
      try {
        const res = await setRecallAction(lavoroId, dateStr, noteStr)
        if (res?.error) { toast.error(res.error); return }
        toast.success(res?.success ?? 'Fatto')
        setDate(''); setNote('')
      } finally {
        setAction(null)
      }
    })
  }

  const active = recallAt ? new Date(recallAt) : null
  const due = active !== null && active.getTime() <= Date.now()

  const pillStyle: React.CSSProperties = {
    border: '1px solid #e7e7ea', borderRadius: 999, background: '#fff', color: '#1a1a2e',
    fontSize: 13, fontWeight: 600, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', gap: 5, opacity: pending ? 0.6 : 1,
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 4 }}>
        Richiama il cliente
      </div>
      <p style={{ fontSize: 12, color: '#767676', margin: '0 0 12px', lineHeight: 1.5 }}>
        Per manutenzioni e controlli periodici (caldaia, condizionatori…): alla data scelta ti
        arriva un promemoria nella campanella nella Home.
      </p>

      {active ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: due ? '#fdf9ef' : '#fafafa', border: due ? '1px solid #ecdfc0' : '1px solid #f0f0f2', borderRadius: 10, padding: '10px 12px' }}>
          <BellRing size={16} style={{ color: due ? '#b0863e' : 'var(--cc-muted)', flexShrink: 0 }} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#161616' }}>
            {due ? 'Da richiamare dal ' : 'Richiamo il '}
            <strong>{active.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' })}</strong>
            {recallNote && <span style={{ display: 'block', fontSize: 12, color: 'var(--cc-muted)', marginTop: 1 }}>{recallNote}</span>}
          </span>
          <button
            type="button"
            onClick={() => save(null, undefined, 'remove')}
            disabled={pending}
            aria-label="Rimuovi promemoria"
            style={{ flexShrink: 0, border: 'none', background: 'none', color: '#b05656', cursor: 'pointer', padding: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}
          >
            {action === 'remove' ? <Loader2 size={14} className="animate-spin" /> : <X size={15} />} Rimuovi
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[3, 6, 12].map((m) => (
              <button key={m} type="button" style={pillStyle} disabled={pending} onClick={() => save(plusMonths(m), note, `m${m}`)}>
                {action === `m${m}` ? <Loader2 size={13} className="animate-spin" /> : null} Tra {m} mesi
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              type="date"
              value={date}
              min={new Date().toLocaleDateString('sv-SE')}
              onChange={(e) => setDate(e.target.value)}
              disabled={pending}
              aria-label="Data del richiamo"
              style={{ flex: 1, minWidth: 0, border: '1px solid #e3e3e6', borderRadius: 10, padding: '0 12px', height: 42, boxSizing: 'border-box', fontSize: 14, fontFamily: 'inherit', color: '#161616', background: '#fff' }}
            />
            <button
              type="button"
              onClick={() => { if (date) save(date, note, 'save') }}
              disabled={pending || !date}
              style={{ flexShrink: 0, border: 'none', borderRadius: 10, background: '#1a1a2e', color: '#fff', fontSize: 13, fontWeight: 600, padding: '0 16px', height: 42, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, opacity: (pending || !date) ? 0.6 : 1 }}
            >
              {action === 'save' ? <Loader2 size={14} className="animate-spin" /> : null} Imposta
            </button>
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota (es. manutenzione caldaia annuale)"
            maxLength={300}
            disabled={pending}
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px', fontSize: 14, fontFamily: 'inherit', color: '#161616', background: '#fff', marginTop: 8 }}
          />
        </>
      )}
    </div>
  )
}
