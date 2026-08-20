import Link from 'next/link'
import { ChevronRight, Navigation, PenLine, Plus } from 'lucide-react'
import { romeTime, type TodayAgenda } from '@/lib/agenda'

// ── «Appuntamenti di oggi» (Home mobile, redesign 19-20 ago) ────────────────
// Una RIGA per appuntamento: ora (serif) · cliente · due tasti quadrati —
// Naviga (navigatore con l'indirizzo del cantiere già inserito, solo se c'è)
// e la matita (apre il sopralluogo/lavoro per scrivere). Il corpo della riga
// apre l'agenda su oggi (decisione Eli: via il link «Agenda →» in testata).
// Nome lungo → puntini: scelta Eli («appuntamenti a una riga»).

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

const sqStyle: React.CSSProperties = {
  width: 40, height: 40, flexShrink: 0, borderRadius: 10,
  border: '1px solid #d9d7d0', background: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#1a1a2e', textDecoration: 'none',
}

export function AppuntamentiOggiCard({ agenda, style }: { agenda: TodayAgenda; style?: React.CSSProperties }) {
  const { events, hasUpcoming } = agenda
  return (
    <div style={style}>
      <div className="cc-section-label" style={{ margin: '0 2px 8px' }}>
        Appuntamenti di oggi{events.length > 0 ? ` · ${events.length}` : ''}
      </div>

      {events.length === 0 && (
        <div style={{ background: '#fff', borderRadius: 13, boxShadow: SH, padding: '4px 15px' }}>
          {!hasUpcoming ? (
            <Link
              href="/sopralluoghi/nuovo"
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 0', textDecoration: 'none', color: 'inherit' }}
            >
              <span style={{ width: 26, height: 26, borderRadius: '50%', background: '#f3ede0', color: '#b0863e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Plus size={15} />
              </span>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 600, color: '#161616' }}>
                Aggiungi il tuo primo appuntamento
              </span>
              <ChevronRight size={16} style={{ color: '#c2c1bd', flexShrink: 0 }} aria-hidden />
            </Link>
          ) : (
            <Link
              href="/calendario"
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 0', textDecoration: 'none' }}
            >
              <span style={{ flex: 1, fontSize: 13.5, color: 'var(--cc-muted)' }}>Nessun impegno oggi.</span>
              <ChevronRight size={16} style={{ color: '#c2c1bd', flexShrink: 0 }} aria-hidden />
            </Link>
          )}
        </div>
      )}

      {events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map((ev) => {
            const clientName = [ev.clients?.name, ev.clients?.surname].filter(Boolean).join(' ')
            const detailHref = ev.kind === 'lavoro' ? `/lavori/${ev.id}` : `/sopralluoghi/${ev.id}`
            const address = ev.address?.trim() || null
            return (
              <div
                key={`${ev.kind}-${ev.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#fff', borderRadius: 13, boxShadow: SH, padding: '7px 8px 7px 13px' }}
              >
                {/* Il corpo della riga apre l'AGENDA su oggi (via il vecchio
                    link in testata); le azioni sul singolo appuntamento sono
                    i due quadrati. */}
                <Link
                  href="/calendario"
                  style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', color: 'inherit', padding: '6px 0' }}
                >
                  <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 15, fontWeight: 600, color: '#1a1a2e', flexShrink: 0 }}>
                    {romeTime(ev.scheduled_at)}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 600, color: '#161616', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {clientName || ev.title}
                  </span>
                </Link>
                {address && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Naviga verso ${address}`}
                    style={{ ...sqStyle, border: '1px solid #e0c98a', color: '#b0863e' }}
                  >
                    <Navigation size={17} aria-hidden />
                  </a>
                )}
                <Link
                  href={detailHref}
                  aria-label={ev.kind === 'lavoro' ? 'Apri il lavoro' : 'Apri il sopralluogo'}
                  style={sqStyle}
                >
                  <PenLine size={17} aria-hidden />
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
