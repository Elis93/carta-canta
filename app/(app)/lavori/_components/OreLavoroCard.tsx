'use client'

// ============================================================
// OreLavoroCard — ore di manodopera sul Lavoro (migration 052).
// Timer start/stop dal cantiere + aggiunta manuale. Se in Impostazioni
// c'è il costo orario, le ore entrano nel "Speso" dell'Economia del
// lavoro: il margine diventa quello VERO, non solo materiali.
// ============================================================

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Pause, Play, Plus } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { startTimerAction, stopTimerAction, addLaborMinutesAction } from '@/lib/actions/lavori'
import { formatCurrency } from '@/lib/utils'
import { parseManualHours } from '@/lib/lavori/parse-hours'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  return `${h} h ${String(m).padStart(2, '0')} min`
}

export function OreLavoroCard({ lavoroId, minutes, timerStartedAt, hourlyCost }: {
  lavoroId: string
  minutes: number
  timerStartedAt: string | null
  hourlyCost: number | null
}) {
  const [pending, startTransition] = useTransition()
  const [action, setAction] = useState<string | null>(null)
  const [manualHours, setManualHours] = useState('')
  // Tick del timer in corso (solo display: il conteggio vero lo fa il server)
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!timerStartedAt) return
    const t = setInterval(() => setTick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [timerStartedAt])

  const runningMin = timerStartedAt
    ? Math.max(0, Math.floor((Date.now() - new Date(timerStartedAt).getTime()) / 60000))
    : 0
  const totalMin = minutes + runningMin
  const cost = hourlyCost != null && hourlyCost > 0 ? (totalMin / 60) * hourlyCost : null

  function run(fn: () => Promise<{ error?: string; success?: string } | null>, key: string) {
    setAction(key)
    startTransition(async () => {
      try {
        const res = await fn()
        if (res?.error) { toast.error(res.error); return }
        if (res?.success) toast.success(res.success)
        setManualHours('')
      } finally {
        setAction(null)
      }
    })
  }

  function handleAddManual() {
    const parsed = parseManualHours(manualHours)
    if ('error' in parsed) { toast.error(parsed.error); return }
    run(() => addLaborMinutesAction(lavoroId, parsed.minutes), 'manual')
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 10 }}>
        Ore di lavoro
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#161616' }}>
            {fmtMinutes(totalMin)}
            {timerStartedAt && (
              <span style={{ fontSize: 12, fontWeight: 600, color: '#2f8a63', marginLeft: 8 }}>
                ● in corso
              </span>
            )}
          </div>
          {cost != null && (
            <div style={{ fontSize: 12, color: '#8a887f', marginTop: 2 }}>
              Manodopera {formatCurrency(cost)}
            </div>
          )}
        </div>
        {timerStartedAt ? (
          <button
            type="button"
            onClick={() => run(() => stopTimerAction(lavoroId), 'stop')}
            disabled={pending}
            style={{ flexShrink: 0, border: 'none', borderRadius: 11, background: '#b05656', color: '#fff', fontSize: 13, fontWeight: 600, padding: '11px 16px', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: pending ? 0.6 : 1 }}
          >
            {action === 'stop' ? <Loader2 size={15} className="animate-spin" /> : <Pause size={15} />} Ferma
          </button>
        ) : (
          <button
            type="button"
            onClick={() => run(() => startTimerAction(lavoroId), 'start')}
            disabled={pending}
            style={{ flexShrink: 0, border: 'none', borderRadius: 11, background: '#1a1a2e', color: '#fff', fontSize: 13, fontWeight: 600, padding: '11px 16px', cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 6, opacity: pending ? 0.6 : 1, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)' }}
          >
            {action === 'start' ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />} Avvia
          </button>
        )}
      </div>

      {/* Aggiunta manuale */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          value={manualHours}
          onChange={(e) => setManualHours(e.target.value.replace(/[^\d.,-]/g, ''))}
          inputMode="decimal"
          placeholder="Ore fatte (es. 1,5 — o -1 per correggere)"
          disabled={pending}
          style={{ flex: 1, minWidth: 0, border: '1px solid #e3e3e6', borderRadius: 10, padding: '0 12px', height: 42, boxSizing: 'border-box', fontSize: 14, fontFamily: 'inherit', color: '#161616', background: '#fff' }}
        />
        <button
          type="button"
          onClick={handleAddManual}
          disabled={pending || !manualHours.trim()}
          style={{ flexShrink: 0, border: '1px solid #e7e7ea', borderRadius: 10, background: '#fff', color: '#1a1a2e', fontSize: 13, fontWeight: 600, padding: '0 14px', height: 42, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5, opacity: (pending || !manualHours.trim()) ? 0.6 : 1 }}
        >
          {action === 'manual' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />} Aggiungi
        </button>
      </div>

      {cost == null && totalMin > 0 && (
        <p style={{ fontSize: 12, color: '#8a887f', marginTop: 8, lineHeight: 1.5 }}>
          Imposta il tuo costo orario in{' '}
          <Link href="/impostazioni?tab=fiscale" style={{ color: '#1a1a2e', fontWeight: 600 }}>Impostazioni › Fiscale</Link>{' '}
          per vedere il costo della manodopera nel margine.
        </p>
      )}
    </div>
  )
}
