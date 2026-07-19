'use client'

// ============================================================
// MonthAgenda — agenda a CALENDARIO MENSILE (19 lug 2026, richiesta Eli:
// "voglio vedere i giorni del mese come un calendario, capire quali giorni
// hanno già appuntamenti, e toccando un giorno vedere cosa c'è").
// La griglia + la selezione del giorno sono client-side (istantanee); la
// navigazione tra i mesi resta server (link ?m=), come per le settimane.
// I dati di ogni evento arrivano già pronti dal server (ora, cliente, href,
// link WhatsApp/mappe) → questo componente sceglie solo il giorno e mostra.
// ============================================================

import { useState } from 'react'
import Link from 'next/link'
import { CalendarDays, Navigation, MessageCircle, Hammer, HardHat, ChevronRight } from 'lucide-react'

export interface AgendaItem {
  kind: 'sopralluogo' | 'lavoro'
  id: string
  title: string
  address: string | null
  time: string
  clientName: string
  href: string
  waHref: string | null
  mapsHref: string | null
}

interface Props {
  weeks: string[][]           // celle della griglia, in righe da 7 (chiavi YYYY-MM-DD)
  monthParam: string          // "YYYY-MM" del mese mostrato
  todayKey: string
  byDay: Record<string, AgendaItem[]>
  defaultSelected: string
}

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom']

/** "Oggi", "Domani" o "mercoledì 15 luglio". */
function dayLabel(key: string, todayKey: string): string {
  const tomorrow = new Date(`${todayKey}T12:00:00Z`)
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
  const tomorrowKey = tomorrow.toISOString().slice(0, 10)
  if (key === todayKey) return 'Oggi'
  if (key === tomorrowKey) return 'Domani'
  return new Date(`${key}T12:00:00Z`).toLocaleDateString('it-IT', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long' })
}

export function MonthAgenda({ weeks, monthParam, todayKey, byDay, defaultSelected }: Props) {
  const [selected, setSelected] = useState(defaultSelected)
  const items = byDay[selected] ?? []

  return (
    <div style={{ margin: '13px 15px 0' }}>
      {/* ── Griglia calendario ── */}
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '12px 10px 10px' }}>
        {/* Intestazione giorni della settimana */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 4 }}>
          {WEEKDAYS.map((d) => (
            <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, letterSpacing: '.03em', color: 'var(--cc-muted)', padding: '2px 0' }}>{d}</div>
          ))}
        </div>
        {/* Celle */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
          {weeks.flat().map((key) => {
            const inMonth = key.slice(0, 7) === monthParam
            const isToday = key === todayKey
            const isSel = key === selected
            const count = byDay[key]?.length ?? 0
            const dayNum = Number(key.slice(8, 10))
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelected(key)}
                aria-label={`${dayNum}${count > 0 ? ` — ${count} appuntament${count === 1 ? 'o' : 'i'}` : ''}`}
                aria-pressed={isSel}
                style={{
                  position: 'relative', aspectRatio: '1 / 1', minHeight: 40, border: 'none', cursor: 'pointer',
                  borderRadius: 10, fontFamily: 'inherit', padding: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                  background: isSel ? '#1a1a2e' : isToday ? '#f5e9d0' : 'transparent',
                  color: isSel ? '#fff' : inMonth ? '#161616' : '#c8c7c2',
                  fontSize: 14, fontWeight: isToday || isSel ? 700 : 500,
                  outline: isToday && !isSel ? '1px solid #e5d3a1' : 'none',
                }}
              >
                {dayNum}
                {/* pallino se il giorno ha appuntamenti */}
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: count > 0 ? (isSel ? '#fff' : '#c9a44c') : 'transparent',
                }} />
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Appuntamenti del giorno selezionato ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: selected === todayKey ? '#b0863e' : '#6f6d64', margin: '16px 2px 7px' }}>
        <CalendarDays size={14} /> {dayLabel(selected, todayKey)}
      </div>

      {items.length > 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '2px 15px' }}>
          {items.map((row, idx) => (
            <div key={`${row.kind}-${row.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: idx < items.length - 1 ? '0.5px solid #eee' : 'none' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', width: 46, flexShrink: 0 }}>{row.time}</span>
              <Link href={row.href} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: '#161616', overflow: 'hidden' }}>
                  {row.kind === 'lavoro' ? <Hammer size={13} style={{ color: 'var(--cc-muted)', flexShrink: 0 }} /> : <HardHat size={13} style={{ color: 'var(--cc-muted)', flexShrink: 0 }} />}
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.title}{row.clientName ? ` — ${row.clientName}` : ''}
                  </span>
                </span>
                {row.address && (
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--cc-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.address}
                  </span>
                )}
              </Link>
              {row.waHref && (
                <a href={row.waHref} target="_blank" rel="noopener noreferrer" aria-label="Avvisa il cliente che stai arrivando (WhatsApp)" title="Sto arrivando"
                  style={{ width: 40, height: 40, borderRadius: 11, background: '#fff', border: '1px solid #bce3d2', color: '#2f8a63', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MessageCircle size={17} />
                </a>
              )}
              {row.mapsHref ? (
                <a href={row.mapsHref} target="_blank" rel="noopener noreferrer" aria-label={`Naviga verso ${row.address}`}
                  style={{ width: 40, height: 40, borderRadius: 11, background: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px -4px rgba(26,26,46,.45)' }}>
                  <Navigation size={17} />
                </a>
              ) : (
                <ChevronRight size={16} style={{ color: '#c2c1bd', flexShrink: 0 }} />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '22px 15px', textAlign: 'center' }}>
          <p style={{ fontSize: 13, color: 'var(--cc-muted)', lineHeight: 1.5 }}>
            Nessun appuntamento in questo giorno.
          </p>
        </div>
      )}
    </div>
  )
}
