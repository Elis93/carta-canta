import Link from 'next/link'
import { CalendarDays, ChevronRight, Hammer, HardHat, Plus } from 'lucide-react'
import { romeTime, type TodayAgenda } from '@/lib/agenda'

// ── "Oggi in agenda" (Home) — richiesta Eli 18 lug ─────────────────────────
// Gli appuntamenti della giornata, leggeri ma utili: ora + titolo + cliente.
// Tocco sulla riga → dettaglio (sopralluogo/lavoro); "Agenda →" → /calendario.
// 18 lug sera (Eli): la card compare SEMPRE — se l'agenda è vuota del tutto
// invita ad aggiungere il primo appuntamento; se oggi è libero ma c'è altro
// in agenda, lo dice senza fronzoli.

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

export function TodayAgendaCard({ agenda, style }: { agenda: TodayAgenda; style?: React.CSSProperties }) {
  const { events, hasUpcoming } = agenda
  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '4px 15px', ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 0 2px' }}>
        <CalendarDays size={15} style={{ color: '#b0863e', flexShrink: 0 }} aria-hidden />
        <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#161616' }}>Oggi in agenda</span>
        <Link href="/calendario" style={{ fontSize: 12, fontWeight: 600, color: '#b0863e', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          Agenda →
        </Link>
      </div>
      {events.length === 0 && (
        !hasUpcoming ? (
          <Link
            href="/sopralluoghi/nuovo"
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 0 12px', textDecoration: 'none', color: 'inherit' }}
          >
            <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#f3ede0', color: '#b0863e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Plus size={15} />
            </span>
            <span style={{ flex: 1, fontSize: 14, fontWeight: 500, color: '#161616' }}>
              Aggiungi il tuo primo appuntamento
            </span>
            <ChevronRight size={16} style={{ color: '#c2c1bd', flexShrink: 0 }} aria-hidden />
          </Link>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--cc-muted)', margin: 0, padding: '8px 0 12px' }}>
            Nessun impegno oggi.
          </p>
        )
      )}
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
