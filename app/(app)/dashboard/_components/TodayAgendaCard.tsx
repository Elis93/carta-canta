import Link from 'next/link'
import { CalendarDays, ChevronRight, Hammer, HardHat } from 'lucide-react'
import { romeTime, type AgendaEvent } from '@/lib/agenda'

// ── "Oggi in agenda" (Home) — richiesta Eli 18 lug ─────────────────────────
// Gli appuntamenti della giornata, leggeri ma utili: ora + titolo + cliente.
// Tocco sulla riga → dettaglio (sopralluogo/lavoro); "Agenda →" → /calendario.
// La card compare SOLO se oggi c'è almeno un impegno (niente vuoti in Home).

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

export function TodayAgendaCard({ events, style }: { events: AgendaEvent[]; style?: React.CSSProperties }) {
  if (events.length === 0) return null
  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '4px 15px', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 0 2px' }}>
        <CalendarDays size={15} style={{ color: '#b0863e', flexShrink: 0 }} aria-hidden />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#161616' }}>Oggi in agenda</span>
        <Link href="/calendario" style={{ fontSize: 12, fontWeight: 600, color: '#b0863e', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          Agenda →
        </Link>
      </div>
      {events.map((ev, idx) => {
        const clientName = [ev.clients?.name, ev.clients?.surname].filter(Boolean).join(' ')
        const href = ev.kind === 'lavoro' ? `/lavori/${ev.id}` : `/sopralluoghi/${ev.id}`
        return (
          <Link
            key={`${ev.kind}-${ev.id}`}
            href={href}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0',
              borderBottom: idx < events.length - 1 ? '0.5px solid #eee' : 'none',
              textDecoration: 'none', color: 'inherit',
            }}
          >
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', width: 44, flexShrink: 0 }}>
              {romeTime(ev.scheduled_at)}
            </span>
            {ev.kind === 'lavoro'
              ? <Hammer size={13} style={{ color: 'var(--cc-muted)', flexShrink: 0 }} aria-hidden />
              : <HardHat size={13} style={{ color: 'var(--cc-muted)', flexShrink: 0 }} aria-hidden />}
            <span style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 500, color: '#161616', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ev.title}{clientName ? ` — ${clientName}` : ''}
            </span>
            <ChevronRight size={16} style={{ color: '#c2c1bd', flexShrink: 0 }} aria-hidden />
          </Link>
        )
      })}
    </div>
  )
}
