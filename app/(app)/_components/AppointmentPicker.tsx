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

import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock } from 'lucide-react'

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
  // Segnala al form quando è stato scelto un giorno ma NON l'ora: in quel caso
  // l'appuntamento non viene passato (value resta ''), e senza questo avviso il
  // form salverebbe in silenzio senza appuntamento (finding M4). Il form usa
  // questo flag per bloccare il salvataggio con un messaggio chiaro.
  onIncompleteChange?: (incomplete: boolean) => void
}

const WEEKDAYS = ['L', 'M', 'M', 'G', 'V', 'S', 'D']

// Ore 00–23 e minuti a passi di 5 per le due tendine dell'orario.
const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'))
const MINUTES_5 = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))
const selStyle = (active: boolean): CSSProperties => ({
  flex: 1, minWidth: 0, border: '1px solid #e3e3e6', borderRadius: 10, padding: '9px 10px',
  fontSize: 16, fontFamily: 'inherit', background: '#fff',
  color: active ? '#161616' : 'var(--cc-muted)',
})

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

export function AppointmentPicker({ value, onChange, excludeKind, excludeId, onIncompleteChange }: Props) {
  const todayKey = dayKeyRome(new Date())
  const currentMonth = todayKey.slice(0, 7)

  // Giorno e ora scelti (stato interno): l'ora NON è precompilata — la scegli
  // tu cliccando (hh:mm). L'appuntamento viene passato al form solo quando ci
  // sono ENTRAMBI; un giorno senza ora resta "in scelta" (mostra l'avviso ma
  // non salva nulla finché non metti l'ora).
  const [selDay, setSelDay] = useState(value.includes('T') ? value.slice(0, 10) : '')
  const [selTime, setSelTime] = useState(value.includes('T') ? value.slice(11, 16) : '')
  // Le due tendine (ore/minuti) hanno uno stato proprio: l'utente può scegliere
  // prima l'ora e poi i minuti. L'ora "completa" (selTime) esiste solo quando
  // ENTRAMBE sono valorizzate — così l'avviso "manca l'ora" resta corretto.
  const [selHour, setSelHour] = useState(selTime ? selTime.slice(0, 2) : '')
  const [selMin, setSelMin]   = useState(selTime ? selTime.slice(3, 5) : '')
  const [viewMonth, setViewMonth] = useState(selDay ? selDay.slice(0, 7) : currentMonth)
  const [busy, setBusy] = useState<Busy[]>([])

  // Carica gli impegni per il mese VISUALIZZATO (con un mese di margine da entrambi
  // i lati). Deve dipendere da viewMonth, non da currentMonth: altrimenti navigando
  // col chevron oltre la finestra iniziale i pallini sparirebbero e — peggio — un
  // giorno con appuntamento mostrerebbe "✓ Quel giorno è libero" (falso).
  useEffect(() => {
    const from = `${shiftMonth(viewMonth, -1)}-01`
    const to = `${shiftMonth(viewMonth, 2)}-01`
    let alive = true
    fetch(`/api/agenda/busy?from=${from}&to=${to}`)
      .then((r) => (r.ok ? r.json() : { appointments: [] }))
      .then((d) => { if (alive) setBusy(Array.isArray(d.appointments) ? d.appointments : []) })
      .catch(() => { /* rete: nessun pallino, il campo resta usabile */ })
    return () => { alive = false }
  }, [viewMonth])

  const busyByDay = useMemo(() => {
    const map: Record<string, Busy[]> = {}
    for (const b of busy) (map[b.day] ??= []).push(b)
    return map
  }, [busy])

  const cells = useMemo(() => monthGrid(viewMonth), [viewMonth])

  // Minuti a passi di 5; se l'ora salvata cade fuori griglia (es. :37 messo
  // prima con l'orologio nativo) aggiungo quel minuto così non si perde.
  const minuteOptions = useMemo(
    () => (selMin && !MINUTES_5.includes(selMin) ? [...MINUTES_5, selMin].sort() : MINUTES_5),
    [selMin],
  )

  function emit(d: string, t: string) {
    onChange(d && t ? `${d}T${t}` : '')
  }
  function selectDay(k: string) {
    // Ri-toccando lo stesso giorno lo si DESELEZIONA (così si toglie
    // l'appuntamento senza un bottone dedicato). Azzero ANCHE l'ora: senza
    // questo l'ora restava visibile in grigio dopo la deselezione (sub-nota M5).
    if (k === selDay) { setSelDay(''); setSelTime(''); setSelHour(''); setSelMin(''); emit('', ''); return }
    setSelDay(k); emit(k, selTime)
  }
  // Compone l'ora dalle due tendine: completa solo con ore E minuti.
  function changeHM(h: string, m: string) {
    setSelHour(h)
    setSelMin(h ? m : '')
    const t = h && m ? `${h}:${m}` : ''
    setSelTime(t); emit(selDay, t)
  }

  // Avvisa il form quando c'è un giorno ma non l'ora (appuntamento non salvato).
  const incomplete = !!selDay && !selTime
  useEffect(() => { onIncompleteChange?.(incomplete) }, [incomplete, onIncompleteChange])

  // Avviso: appuntamenti del giorno scelto, escluso quello in modifica.
  const sameDay = selDay
    ? (busyByDay[selDay] ?? []).filter((b) => !(b.kind === excludeKind && b.id === excludeId))
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
          const isSel = k === selDay
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

      {/* Ora — due tendine ore/minuti invece dell'orologio nativo (feedback Eli
          22 lug #7: sul telefono i bottoni dell'orologio di sistema — Cancella/
          Annulla/Imposta — venivano tagliati, "Impo…"). Le <select> aprono una
          lista nativa pulita, non l'orologio a lancette. Minuti a passi di 5;
          se l'ora salvata cade fuori griglia (es. :37 messo prima con l'orologio),
          quel minuto viene aggiunto in coda così non si perde. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <Clock size={15} style={{ color: 'var(--cc-muted)', flexShrink: 0 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
          <select
            value={selHour}
            disabled={!selDay}
            onChange={(e) => changeHM(e.target.value, selMin || '00')}
            aria-label="Ora dell'appuntamento"
            style={selStyle(!!selDay)}
          >
            <option value="">Ora</option>
            {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--cc-muted)' }}>:</span>
          <select
            value={selMin}
            disabled={!selDay || !selHour}
            onChange={(e) => changeHM(selHour, e.target.value)}
            aria-label="Minuti dell'appuntamento"
            style={selStyle(!!selDay && !!selHour)}
          >
            <option value="">Min</option>
            {minuteOptions.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      </div>
      {selDay && !selTime && (
        <p style={{ marginTop: 6, fontSize: 12, color: '#8a6c33', background: '#faf7f0', border: '1px solid #eee3cc', borderRadius: 8, padding: '7px 10px', lineHeight: 1.5 }}>
          Manca l&rsquo;ora: finché non la scegli dalle tendine qui sopra,
          l&rsquo;appuntamento non viene salvato.
        </p>
      )}
      {selDay && selTime && (
        <p style={{ marginTop: 6, fontSize: 12, color: 'var(--cc-muted)' }}>Per togliere l&rsquo;appuntamento tocca di nuovo il giorno scelto.</p>
      )}

      {/* Avviso: cosa c'è già quel giorno */}
      {selDay && sameDay.length > 0 && (
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
      {selDay && sameDay.length === 0 && (
        <p style={{ marginTop: 8, fontSize: 12, color: '#2f8a63', fontWeight: 600 }}>
          ✓ Quel giorno è libero.
        </p>
      )}
    </div>
  )
}
