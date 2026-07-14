import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Navigation, Plus, ChevronRight, ChevronLeft, MessageCircle, Hammer, HardHat } from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BackButton } from '@/components/shared/BackButton'
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp'

export const metadata = { title: 'Calendario' }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

interface EventRow {
  kind: 'sopralluogo' | 'lavoro'
  id: string
  title: string
  address: string | null
  scheduled_at: string
  clients: { name: string | null; surname: string | null; phone: string | null } | null
}

const dayKeyOf = (x: Date) => x.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })

/** "Oggi", "Domani" o "mercoledì 15 luglio" (ora italiana). */
function dayLabel(key: string): string {
  const today = dayKeyOf(new Date())
  const tomorrow = dayKeyOf(new Date(Date.now() + 86_400_000))
  if (key === today) return 'Oggi'
  if (key === tomorrow) return 'Domani'
  return new Date(`${key}T12:00:00Z`).toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long' })
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })
}

function mapsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

/** Link WhatsApp "sto arrivando" precompilato (null se manca il telefono). */
function arrivingUrl(row: EventRow, workspaceName: string): string | null {
  const digits = row.clients?.phone ? normalizePhoneForWhatsApp(row.clients.phone) : ''
  if (!digits) return null
  const nome = row.clients?.name ? ` ${row.clients.name}` : ''
  const msg = `Buongiorno${nome}! Sto arrivando per l'appuntamento delle ${timeOf(row.scheduled_at)}. A tra poco. — ${workspaceName}`
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
}

/** Lunedì (chiave sv-SE, giorno Roma) della settimana che contiene dateKey. */
function mondayKeyOf(dateKey: string): string {
  const noon = new Date(`${dateKey}T12:00:00Z`)
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', weekday: 'short' }).format(noon)
  const idx = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(wd)
  return dayKeyOf(new Date(noon.getTime() - Math.max(0, idx) * 86_400_000))
}

function addDays(dateKey: string, n: number): string {
  return dayKeyOf(new Date(new Date(`${dateKey}T12:00:00Z`).getTime() + n * 86_400_000))
}

function weekLabel(mondayKey: string): string {
  const start = new Date(`${mondayKey}T12:00:00Z`)
  const end = new Date(`${addDays(mondayKey, 6)}T12:00:00Z`)
  const fmt = (d: Date, withMonth: boolean) =>
    d.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', day: 'numeric', ...(withMonth ? { month: 'long' } : {}) })
  const sameMonth = start.getUTCMonth() === end.getUTCMonth()
  return sameMonth ? `${fmt(start, false)}–${fmt(end, true)}` : `${fmt(start, true)} – ${fmt(end, true)}`
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ w?: string }>
}) {
  const { w } = await searchParams
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  // Settimana selezionata (?w=YYYY-MM-DD → normalizzata al suo lunedì)
  const todayKey = dayKeyOf(new Date())
  const currentMonday = mondayKeyOf(todayKey)
  const monday = w && /^\d{4}-\d{2}-\d{2}$/.test(w) ? mondayKeyOf(w) : currentMonday
  const weekKeys = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const isCurrentWeek = monday === currentMonday

  // Range query con margine di fuso (poi si filtra per giorno Roma)
  const queryFrom = new Date(`${monday}T12:00:00Z`).getTime() - 36 * 3_600_000
  const queryTo = new Date(`${addDays(monday, 6)}T12:00:00Z`).getTime() + 36 * 3_600_000

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 041/047/048/049 non ancora in types/database.ts
  const db = supabase as any
  const events: EventRow[] = []
  let inCorso: Array<{ id: string; title: string }> = []
  // PERF: le tre query sono indipendenti → un solo round trip invece di tre.
  // Ogni ramo resta tollerante pre-migration (047/048/049) con catch dedicato.
  const [sopralluoghiRes, lavoriRes, inCorsoRes] = await Promise.all([
    db
      .from('sopralluoghi')
      .select('id, title, address, scheduled_at, clients ( name, surname, phone )')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .not('scheduled_at', 'is', null)
      .gte('scheduled_at', new Date(queryFrom).toISOString())
      .lte('scheduled_at', new Date(queryTo).toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(100)
      .then((r: { data: unknown[] | null }) => r.data)
      .catch(() => null), // migration 047 non applicata
    db
      .from('lavori')
      .select('id, title, address, scheduled_at, clients ( name, surname, phone )')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .not('scheduled_at', 'is', null)
      .gte('scheduled_at', new Date(queryFrom).toISOString())
      .lte('scheduled_at', new Date(queryTo).toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(100)
      .then((r: { data: unknown[] | null }) => r.data)
      .catch(() => null), // migration 048/049 non applicata
    db
      .from('lavori')
      .select('id, title')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .eq('status', 'in_corso')
      .order('updated_at', { ascending: false })
      .limit(10)
      .then((r: { data: unknown[] | null }) => r.data)
      .catch(() => null), // migration 048 non applicata
  ])
  for (const r of ((sopralluoghiRes ?? []) as Array<Omit<EventRow, 'kind'>>)) events.push({ kind: 'sopralluogo', ...r })
  for (const r of ((lavoriRes ?? []) as Array<Omit<EventRow, 'kind'>>)) events.push({ kind: 'lavoro', ...r })
  inCorso = (inCorsoRes ?? []) as typeof inCorso

  const workspaceName: string = workspace.ragione_sociale ?? workspace.name

  // Eventi della settimana, raggruppati per giorno (ordine cronologico)
  const weekSet = new Set(weekKeys)
  const inWeek = events
    .filter((e) => weekSet.has(dayKeyOf(new Date(e.scheduled_at))))
    .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
  const groups: Array<{ key: string; items: EventRow[] }> = []
  for (const ev of inWeek) {
    const key = dayKeyOf(new Date(ev.scheduled_at))
    const last = groups[groups.length - 1]
    if (last && last.key === key) last.items.push(ev)
    else groups.push({ key, items: [ev] })
  }

  return (
    <div className="max-w-3xl mx-auto" style={{ position: 'relative', minHeight: '70vh' }}>
      {/* Header — fascia bianca */}
      <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Calendario</span>
        <span style={{ width: 24 }} />
      </div>

      {/* Navigazione settimana */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, margin: '13px 15px 0', fontSize: 14, fontWeight: 600, color: '#161616' }}>
        <Link href={`/calendario?w=${addDays(monday, -7)}`} replace aria-label="Settimana precedente" style={{ color: '#8a887f', display: 'flex', padding: 4 }}>
          <ChevronLeft size={18} />
        </Link>
        <span style={{ minWidth: 150, textAlign: 'center' }}>{weekLabel(monday)}</span>
        <Link href={`/calendario?w=${addDays(monday, 7)}`} replace aria-label="Settimana successiva" style={{ color: '#8a887f', display: 'flex', padding: 4 }}>
          <ChevronRight size={18} />
        </Link>
      </div>
      {!isCurrentWeek && (
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <Link href="/calendario" replace style={{ fontSize: 12, fontWeight: 600, color: '#b0863e', textDecoration: 'none' }}>
            ↩ Torna a questa settimana
          </Link>
        </div>
      )}

      {/* Lavori in corso (senza orario) */}
      {inCorso.length > 0 && (
        <div style={{ margin: '13px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '12px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 8 }}>
            <Hammer size={14} /> Lavori in corso
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {inCorso.map((l) => (
              <Link key={l.id} href={`/lavori/${l.id}`} style={{ textDecoration: 'none', background: '#d8e8fb', color: '#3f6fb0', borderRadius: 999, padding: '6px 12px', fontSize: 12, fontWeight: 600, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {l.title}
              </Link>
            ))}
          </div>
        </div>
      )}

      {groups.length > 0 ? (
        groups.map((group) => (
          <div key={group.key} style={{ margin: '14px 15px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: group.key === todayKey ? '#b0863e' : '#6f6d64', margin: '0 2px 7px' }}>
              <CalendarDays size={14} /> {dayLabel(group.key)}
            </div>
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '2px 15px' }}>
              {group.items.map((row, idx) => {
                const clientName = [row.clients?.name, row.clients?.surname].filter(Boolean).join(' ')
                const href = row.kind === 'lavoro' ? `/lavori/${row.id}` : `/sopralluoghi/${row.id}`
                const wa = arrivingUrl(row, workspaceName)
                return (
                  <div key={`${row.kind}-${row.id}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: idx < group.items.length - 1 ? '0.5px solid #eee' : 'none' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', width: 46, flexShrink: 0 }}>
                      {timeOf(row.scheduled_at)}
                    </span>
                    <Link href={href} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, fontWeight: 600, color: '#161616', overflow: 'hidden' }}>
                        {row.kind === 'lavoro' ? <Hammer size={13} style={{ color: '#8a887f', flexShrink: 0 }} /> : <HardHat size={13} style={{ color: '#8a887f', flexShrink: 0 }} />}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.title}{clientName ? ` — ${clientName}` : ''}
                        </span>
                      </span>
                      {row.address && (
                        <span style={{ display: 'block', fontSize: 12, color: '#8a887f', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.address}
                        </span>
                      )}
                    </Link>
                    {wa && (
                      <a
                        href={wa}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Avvisa il cliente che stai arrivando (WhatsApp)"
                        title="Sto arrivando"
                        style={{ width: 40, height: 40, borderRadius: 11, background: '#fff', border: '1px solid #bce3d2', color: '#2f8a63', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >
                        <MessageCircle size={17} />
                      </a>
                    )}
                    {row.address ? (
                      <a
                        href={mapsUrl(row.address)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Naviga verso ${row.address}`}
                        style={{ width: 40, height: 40, borderRadius: 11, background: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px -4px rgba(26,26,46,.45)' }}
                      >
                        <Navigation size={17} />
                      </a>
                    ) : (
                      <ChevronRight size={16} style={{ color: '#c2c1bd', flexShrink: 0 }} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))
      ) : (
        <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '30px 15px', textAlign: 'center' }}>
          <CalendarDays size={26} style={{ color: '#c2c1bd', margin: '0 auto 8px' }} />
          <p style={{ fontWeight: 600, color: '#161616', fontSize: 14 }}>Nessun impegno in questa settimana</p>
          <p style={{ fontSize: 13, color: '#8a887f', marginTop: 4, lineHeight: 1.5 }}>
            Imposta l&rsquo;<b>Appuntamento</b> su un sopralluogo o il <b>Prossimo intervento</b> su un lavoro:
            li ritroverai qui, con la navigazione verso il cantiere.
          </p>
        </div>
      )}

      <p style={{ margin: '12px 15px 0', fontSize: 12, color: '#767676', textAlign: 'center' }}>
        <HardHat size={12} style={{ display: 'inline', verticalAlign: '-2px' }} /> sopralluogo · <Hammer size={12} style={{ display: 'inline', verticalAlign: '-2px' }} /> lavoro
      </p>

      {/* FAB nuovo sopralluogo (con appuntamento) */}
      <Link
        href="/sopralluoghi/nuovo"
        aria-label="Nuovo sopralluogo con appuntamento"
        style={{ position: 'fixed', right: 18, bottom: 84, width: 54, height: 54, borderRadius: '50%', background: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px -6px rgba(26,26,46,.55)', zIndex: 30 }}
      >
        <Plus size={24} />
      </Link>

      <div style={{ height: 90 }} />
    </div>
  )
}
