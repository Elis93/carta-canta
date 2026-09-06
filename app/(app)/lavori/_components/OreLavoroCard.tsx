'use client'

// ============================================================
// OreLavoroCard — ore di manodopera sul Lavoro (migration 052), in UN
// riquadro solo (scheda Lavoro B, scelta di Eli 5 set 2026: «la parte che
// conteggia le ore sia una sezione unica con unico riquadro bianco»).
//
// Sopra: il totale grande in Georgia, «timer in corso da 09:40» e la
// manodopera; a destra, DENTRO la card, il tasto del timer — «Avvia» navy
// da fermo (l'unico navy della schermata quando il lavoro è in corso),
// «Ferma» bianco con testo rosso mentre gira: il navy non resta acceso
// per ore su un tasto che vuol dire «interrompi». Sotto un filetto, la
// riga per aggiungere ore a mano e «Correggi il totale». Niente tendina:
// le ore si vedono sempre. Se in Impostazioni c'è il costo orario, le ore
// entrano nel «Speso» dell'economia in testata.
// ============================================================

import { useEffect, useRef, useState, useTransition } from 'react'
import { runAction } from '@/lib/run-action'
import { Loader2, Pause, Play, Plus, Pencil, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { startTimerAction, stopTimerAction, addLaborMinutesAction, setLaborMinutesAction } from '@/lib/actions/lavori'
import { formatCurrency } from '@/lib/utils'
import { parseManualHours, parseTotalHours } from '@/lib/lavori/parse-hours'
import { VaiA } from '@/components/shared/VaiA'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

/** «1 h 30» · «25 min» · «0 min» — il totale grande. */
function fmtMinutesBig(min: number): string {
  const h = Math.floor(min / 60)
  const m = min % 60
  if (h === 0) return `${m} min`
  return `${h} h ${String(m).padStart(2, '0')}`
}

// Minuti → ore in formato italiano per pre-riempire il campo "correggi totale"
// (es. 90 → "1,5", 120 → "2", 9 → "0,15").
function minutesToHoursInput(min: number): string {
  return (Math.round((min / 60) * 100) / 100).toString().replace('.', ',')
}

const fieldStyle: React.CSSProperties = {
  flex: 1, minWidth: 0, border: '1px solid #e3e3e6', borderRadius: 10, padding: '0 12px', height: 42,
  boxSizing: 'border-box', fontSize: 14, fontFamily: 'inherit', color: '#161616', background: '#fff',
}
const smallBtn: React.CSSProperties = {
  flexShrink: 0, borderRadius: 10, height: 42, padding: '0 14px', fontSize: 13, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5,
  boxSizing: 'border-box',
}

export function OreLavoroCard({ lavoroId, minutes, timerStartedAt, hourlyCost, countLabor = true }: {
  lavoroId: string
  minutes: number
  timerStartedAt: string | null
  hourlyCost: number | null
  /** false = la manodopera NON entra nel margine (interruttore 085): le ore restano un'informazione. */
  countLabor?: boolean
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
  const startedLabel = timerStartedAt
    ? new Date(timerStartedAt).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })
    : null

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
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '13px 15px' }}>
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64' }}>
        Ore di lavoro
      </div>

      {/* Totale grande + timer, sulla stessa riga */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10, marginTop: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 30, color: '#161616', lineHeight: 1 }}>
            {fmtMinutesBig(totalMin)}
          </div>
          {timerStartedAt && (
            <div style={{ fontSize: 12, fontWeight: 600, color: '#2f8a63', marginTop: 5 }}>
              ● timer in corso{startedLabel ? ` da ${startedLabel}` : ''}
            </div>
          )}
          <div style={{ fontSize: 12.5, color: 'var(--cc-muted)', marginTop: timerStartedAt ? 4 : 6, lineHeight: 1.4 }}>
            {cost != null
              ? (countLabor
                ? <>Manodopera {formatCurrency(cost)} · {hourlyCost!.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}&nbsp;€/h</>
                : <>Manodopera {formatCurrency(cost)} · non contata nel margine</>)
              : <>Costo orario non impostato: <VaiA a="impFiscale">Impostazioni › Fiscale</VaiA></>}
          </div>
        </div>
        {timerStartedAt ? (
          <button
            type="button"
            onClick={() => run(() => stopTimerAction(lavoroId), 'stop')}
            disabled={pending}
            style={{ flexShrink: 0, height: 44, padding: '0 18px', borderRadius: 12, background: '#fff', color: '#b05656', border: '1px solid #e7e7ea', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7, opacity: pending ? 0.6 : 1, boxShadow: SH }}
          >
            {action === 'stop' ? <Loader2 size={16} className="animate-spin" /> : <Pause size={16} />} Ferma
          </button>
        ) : (
          <button
            type="button"
            onClick={() => run(() => startTimerAction(lavoroId), 'start')}
            disabled={pending}
            style={{ flexShrink: 0, height: 44, padding: '0 18px', borderRadius: 12, background: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 7, opacity: pending ? 0.6 : 1, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)' }}
          >
            {action === 'start' ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />} Avvia
          </button>
        )}
      </div>

      {/* Sotto un filetto: aggiunta a mano, oppure la correzione del totale */}
      <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid #eeece6' }}>
        {editing ? (
          <>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value.replace(/[^\d.,]/g, ''))}
                inputMode="decimal"
                autoFocus
                placeholder="Totale ore (esempio: 3)"
                disabled={pending}
                style={{ ...fieldStyle, border: '1px solid #c9a44c' }}
              />
              <button
                type="button"
                onClick={handleSaveTotal}
                disabled={pending || !editValue.trim()}
                style={{ ...smallBtn, border: '1px solid #1a1a2e', background: '#1a1a2e', color: '#fff', opacity: (pending || !editValue.trim()) ? 0.6 : 1 }}
              >
                {action === 'edit' ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />} Salva
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                disabled={pending}
                aria-label="Annulla"
                style={{ ...smallBtn, border: '1px solid #e7e7ea', background: '#fff', color: 'var(--cc-muted)', width: 42, padding: 0, justifyContent: 'center' }}
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
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                ref={manualRef}
                value={manualHours}
                onChange={(e) => setManualHours(e.target.value.replace(/[^\d.,-]/g, ''))}
                inputMode="decimal"
                placeholder="Ore (esempio: 1,5)"
                disabled={pending}
                style={fieldStyle}
              />
              <button
                type="button"
                onClick={handleAddManual}
                disabled={pending || !manualHours.trim()}
                style={{ ...smallBtn, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e', boxShadow: SH, opacity: (pending || !manualHours.trim()) ? 0.6 : 1 }}
              >
                {action === 'manual' ? <Loader2 size={14} className="animate-spin" /> : <Plus size={15} />} Aggiungi
              </button>
            </div>
            {!timerStartedAt && totalMin > 0 && (
              <button
                type="button"
                onClick={openEdit}
                disabled={pending}
                style={{ marginTop: 9, border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#1a1a2e' }}
              >
                <Pencil size={12} /> Correggi il totale
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
