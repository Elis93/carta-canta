'use client'

// ============================================================
// OreLavoroCard — ore di manodopera sul Lavoro (migration 052).
// Timer start/stop dal cantiere + aggiunta manuale. Se in Impostazioni
// c'è il costo orario, le ore entrano nel "Speso" dell'Economia del
// lavoro: il margine diventa quello VERO, non solo materiali.
// ============================================================

import { useEffect, useRef, useState, useTransition } from 'react'
import { runAction } from '@/lib/run-action'
import { Loader2, Pause, Play, Plus, Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import Link from 'next/link'
import { startTimerAction, stopTimerAction, addLaborMinutesAction, setLaborMinutesAction } from '@/lib/actions/lavori'
import { formatCurrency } from '@/lib/utils'
import { parseManualHours, parseTotalHours } from '@/lib/lavori/parse-hours'
import { VaiA } from '@/components/shared/VaiA'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

function fmtMinutes(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  return `${h} h ${String(m).padStart(2, '0')} min`
}

// Minuti → ore in formato italiano per pre-riempire il campo "correggi totale"
// (es. 90 → "1,5", 120 → "2", 9 → "0,15").
function minutesToHoursInput(min: number): string {
  return (Math.round((min / 60) * 100) / 100).toString().replace('.', ',')
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
  // Arrivo dal tasto Timer della Home (`/lavori/[id]#ore`): il cursore deve
  // essere GIÀ nel campo delle ore, pronto a scrivere (Eli, 21 ago). Lo
  // scorrimento lo fa ScrollToHash: qui si dà solo il fuoco, con
  // `preventScroll` per non litigare con lui sulla posizione.
  const manualRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (window.location.hash !== '#ore') return
    // Mai rubare il fuoco (e aprire la tastiera) da sotto il lucchetto.
    if (document.querySelector('[aria-label="App bloccata"]')) return
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => manualRef.current?.focus({ preventScroll: true }))
    })
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
  }, [])
  // Modalità "correggi il totale a mano" (valore assoluto, non delta)
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState('')
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

  function openEdit() {
    setEditValue(minutesToHoursInput(minutes)) // il persistito, senza il timer in corso
    setEditing(true)
  }

  function handleSaveTotal() {
    const parsed = parseTotalHours(editValue)
    if ('error' in parsed) { toast.error(parsed.error); return }
    setAction('edit')
    startTransition(async () => {
      try {
        const res = await runAction(() => setLaborMinutesAction(lavoroId, parsed.minutes), 'aggiornare le ore')
        if (res?.error) { toast.error(res.error); return }
        if (res?.success) toast.success(res.success)
        setEditing(false)
      } finally {
        setAction(null)
      }
    })
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
            <div style={{ fontSize: 12, color: 'var(--cc-muted)', marginTop: 2 }}>
              Manodopera {formatCurrency(cost)}
            </div>
          )}
          {!timerStartedAt && !editing && totalMin > 0 && (
            <button
              type="button"
              onClick={openEdit}
              disabled={pending}
              style={{ marginTop: 4, border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}
            >
              <Pencil size={12} /> Correggi il totale
            </button>
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

      {editing ? (
        /* Correggi il totale a mano (valore assoluto) */
        <>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value.replace(/[^\d.,]/g, ''))}
              inputMode="decimal"
              autoFocus
              placeholder="Totale ore (es. 3)"
              disabled={pending}
              style={{ flex: 1, minWidth: 0, border: '1px solid #c9a44c', borderRadius: 10, padding: '0 12px', height: 42, boxSizing: 'border-box', fontSize: 14, fontFamily: 'inherit', color: '#161616', background: '#fff' }}
            />
            <button
              type="button"
              onClick={handleSaveTotal}
              disabled={pending || !editValue.trim()}
              style={{ flexShrink: 0, border: 'none', borderRadius: 10, background: '#1a1a2e', color: '#fff', fontSize: 13, fontWeight: 600, padding: '0 14px', height: 42, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5, opacity: (pending || !editValue.trim()) ? 0.6 : 1 }}
            >
              {action === 'edit' ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />} Salva
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              disabled={pending}
              aria-label="Annulla"
              style={{ flexShrink: 0, border: '1px solid #e7e7ea', borderRadius: 10, background: '#fff', color: 'var(--cc-muted)', height: 42, width: 42, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={16} />
            </button>
          </div>
          <p style={{ fontSize: 12, color: 'var(--cc-muted)', marginTop: 6, lineHeight: 1.5 }}>
            Scrivi il <b>totale</b> delle ore giuste (es. <b>3</b> o <b>3,5</b>): sostituisce il conteggio attuale.
          </p>
        </>
      ) : (
        <>
          {/* Aggiunta manuale */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <input
              ref={manualRef}
              value={manualHours}
              onChange={(e) => setManualHours(e.target.value.replace(/[^\d.,-]/g, ''))}
              inputMode="decimal"
              placeholder="Ore (es. 1,5)"
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

          {/* Suggerimento esteso (nel campo non ci sta tutto): come si scrive e come si corregge */}
          <p style={{ fontSize: 12, color: 'var(--cc-muted)', marginTop: 6, lineHeight: 1.5 }}>
            Aggiungi le ore fatte (es. <b>1,5</b>), oppure usa <b>Correggi il totale</b> per sistemare il conteggio.
          </p>
        </>
      )}

      {cost == null && totalMin > 0 && (
        <p style={{ fontSize: 12, color: 'var(--cc-muted)', marginTop: 8, lineHeight: 1.5 }}>
          Imposta il tuo costo orario in{' '}
          <VaiA a="impFiscale">Impostazioni › Fiscale</VaiA>{' '}
          per vedere il costo della manodopera nel margine.
        </p>
      )}
    </div>
  )
}
