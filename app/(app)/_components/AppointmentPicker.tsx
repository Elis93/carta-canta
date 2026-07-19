'use client'

// ============================================================
// AppointmentPicker — scelta data/ora appuntamento con MINI-CALENDARIO
// coi pallini (19 lug 2026, richiesta Eli: "quando creo un appuntamento
// voglio vedere il calendario coi puntini per capire giorno e a che ora
// sono impegnato" + un avviso). Sostituisce l'input datetime-local nei
// form Sopralluogo/Lavoro. Legge gli impegni da /api/agenda/busy e:
//  - segna col pallino oro i giorni già occupati (nella griglia mensile);
//  - scelto un giorno, mostra un AVVISO con gli appuntamenti di quel giorno
//    (ora + titolo), escluso quello che si sta modificando.
// ============================================================

import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock, X } from 'lucide-react'

interface Busy {
  kind: 'sopralluogo' | 'lavoro'
  id: string
  title: string
  day: string   // YYYY-MM-DD (ora Roma)
  time: string  // HH:MM
}

interface Props {
  value: string                       // "YYYY-MM-DDTHH:MM" | ''
  onChange: (v: string) => void
  excludeKind?: 'sopralluogo' | 'lavoro'
  excludeId?: string | null
}

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

const dayKeyRome = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
function addDaysKey(k: string, n: number): string {
  return dayKeyRome(new Date(new Date(`${k}T12:00:00Z`).getTime() + n * 86_400_000))
}
function mondayOf(k: string): string {
  const noon = new Date(`${k}T12:00:00Z`)
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', weekday: 'short' }).format(noon)
  const idx = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(wd)
  return addDaysKey(k, -Math.max(0, idx))
}
function shiftMonth(monthParam: string, delta: number): string {
  const y = Number(monthParam.slice(0, 4)); const m = Number(monthParam.slice(5, 7))
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}
function monthLabel(monthParam: string): string {
  const y = Number(monthParam.slice(0, 4)); const m = Number(monthParam.slice(5, 7))
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('it-IT', { timeZone: 'UTC', month: 'long', year: 'numeric' })
}
function monthGrid(monthParam: string): string[] {
  const y = Number(monthParam.slice(0, 4)); const m = Number(monthParam.slice(5, 7))
  const firstKey = `${monthParam}-01`
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const lastKey = `${monthParam}-${String(daysInMonth).padStart(2, '0')}`
  const cells: string[] = []
  let cur = mondayOf(firstKey)
  do { cells.push(cur); cur = addDaysKey(cur, 1) }
  while (!(cells.length % 7 === 0 && cells[cells.length - 1] >= lastKey) && cells.length < 43)
  return cells
}

export function AppointmentPicker({ value, onChange, excludeKind, excludeId }: Props) {
  const day = value.includes('T') ? value.slice(0, 10) : ''
  const time = value.includes('T') ? value.slice(11, 16) : ''
  const todayKey = dayKeyRome(new Date())
  const currentMonth = todayKey.slice(0, 7)

  const [viewMonth, setViewMonth] = useState(day ? day.slice(0, 7) : currentMonth)
  const [busy, setBusy] = useState<Busy[]>([])

  // Carica gli impegni una volta, su una finestra ampia (−1 → +13 mesi).
  useEffect(() => {
    const from = `${shiftMonth(currentMonth, -1)}-01`
    const to = `${shiftMonth(currentMonth, 13)}-01`
    let alive = true
    fetch(`/api/agenda/busy?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : { appointments: [] }))
      .then((d) => { if (alive) setBusy(Array.isArray(d.appointments) ? d.appointments : []) })
      .catch(() => { /* rete: nessun pallino, il campo resta usabile */ })
    return () => { alive = false }
  }, [currentMonth])

  const busyByDay = useMemo(() => {
    const map: Record<string, Busy[]> = {}
    for (const b of busy) (map[b.day] ??= []).push(b)
    return map
  }, [busy])

  const cells = useMemo(() => monthGrid(viewMonth), [viewMonth])

  function selectDay(k: string) {
    onChange(`${k}T${time || '09:00'}`)
  }
  function changeTime(t: string) {
    if (day) onChange(`${day}T${t}`)
  }

  // Avviso: appuntamenti del giorno scelto, escluso quello in modifica.
  const sameDay = day
    ? (busyByDay[day] ?? []).filter((b) => !(b.kind === excludeKind && b.id === excludeId))
    : []

  return (
    <div>
      {/* Navigazione mese */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <button type="button" onClick={() => setViewMonth(shiftMonth(viewMonth, -1))} aria-label="Mese precedente"
          style={{ border: 'none', background: 'transparent', color: 'var(--cc-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#161616', textTransform: 'capitalize' }}>{monthLabel(viewMonth)}</span>
        <button type="button" onClick={() => setViewMonth(shiftMonth(viewMonth, 1))} aria-label="Mese successivo"
          style={{ border: 'none', background: 'transparent', color: 'var(--cc-muted)', cursor: 'pointer', padding: 4, display: 'flex' }}>
          <ChevronRight size={18} />
        </button>
      </div>

      {/* Intestazione giorni */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 2 }}>
        {WEEKDAYS.map((d, i) => (
          <div key={i} style={{ textAlign: 'center', fontSize: 10, fontWeight: 700, color: 'var(--cc-muted)' }}>{d}</div>
        ))}
      </div>
      {/* Griglia */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {cells.map((k) => {
          const inMonth = k.slice(0, 7) === viewMonth
          const isToday = k === todayKey
          const isSel = k === day
          const has = (busyByDay[k]?.length ?? 0) > 0
          const dayNum = Number(k.slice(8, 10))
          return (
            <button
              key={k}
              type="button"
              onClick={() => selectDay(k)}
              aria-label={`${dayNum}${has ? ' — hai già un appuntamento' : ''}`}
              aria-pressed={isSel}
              style={{
                position: 'relative', aspectRatio: '1 / 1', minHeight: 34, border: 'none', cursor: 'pointer',
                borderRadius: 8, fontFamily: 'inherit', padding: 0,
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                background: isSel ? '#1a1a2e' : isToday ? '#f5e9d0' : 'transparent',
                color: isSel ? '#fff' : inMonth ? '#161616' : '#c8c7c2',
                fontSize: 13, fontWeight: isToday || isSel ? 700 : 500,
                outline: isToday && !isSel ? '1px solid #e5d3a1' : 'none',
              }}
            >
              {dayNum}
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: has ? (isSel ? '#fff' : '#c9a44c') : 'transparent' }} />
            </button>
          )
        })}
      </div>

      {/* Ora + azzeramento */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <Clock size={15} style={{ color: 'var(--cc-muted)', flexShrink: 0 }} />
        <input
          type="time"
          value={time}
          onChange={(e) => changeTime(e.target.value)}
          disabled={!day}
          aria-label="Ora dell'appuntamento"
          style={{ flex: 1, border: '1px solid #e3e3e6', borderRadius: 10, padding: '9px 11px', fontSize: 16, fontFamily: 'inherit', color: day ? '#161616' : 'var(--cc-muted)', background: '#fff' }}
        />
        {value && (
          <button type="button" onClick={() => onChange('')} aria-label="Togli l'appuntamento"
            style={{ border: '1px solid #e7e7ea', background: '#fff', borderRadius: 10, padding: '9px 11px', fontSize: 13, fontWeight: 600, color: '#55534b', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, fontFamily: 'inherit' }}>
            <X size={14} /> Togli
          </button>
        )}
      </div>

      {/* Avviso: cosa c'è già quel giorno */}
      {day && sameDay.length > 0 && (
        <div style={{ marginTop: 10, background: '#faf7f0', border: '1px solid #eee3cc', borderRadius: 10, padding: '9px 12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color: '#8a6c33', marginBottom: 4 }}>
            <CalendarDays size={13} /> Quel giorno hai già {sameDay.length === 1 ? 'un appuntamento' : `${sameDay.length} appuntamenti`}
          </div>
          {sameDay.map((b) => (
            <div key={`${b.kind}-${b.id}`} style={{ fontSize: 13, color: '#6b5626', lineHeight: 1.5 }}>
              <b>{b.time}</b>{b.title ? ` — ${b.title}` : ''}
            </div>
          ))}
        </div>
      )}
      {day && sameDay.length === 0 && (
        <p style={{ marginTop: 8, fontSize: 12, color: '#2f8a63', fontWeight: 600 }}>
          ✓ Quel giorno è libero.
        </p>
      )}
    </div>
  )
}
