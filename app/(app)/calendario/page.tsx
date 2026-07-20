import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, ChevronRight, ChevronLeft, Hammer } from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BackButton } from '@/components/shared/BackButton'
import { normalizePhoneForWhatsApp } from '@/lib/whatsapp'
import { MonthAgenda, type AgendaItem } from './_components/MonthAgenda'

// 18 lug (decisione con Eli): la pagina si chiama "Agenda". La ROTTA resta
// /calendario (cambiarla romperebbe i link salvati). 19 lug: da lista
// settimanale a CALENDARIO MENSILE (griglia dei giorni + appuntamenti del
// giorno selezionato).
export const metadata = { title: 'Agenda' }

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

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })
}

function mapsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

function arrivingUrl(row: EventRow, workspaceName: string): string | null {
  const digits = row.clients?.phone ? normalizePhoneForWhatsApp(row.clients.phone) : ''
  if (!digits) return null
  const nome = row.clients?.name ? ` ${row.clients.name}` : ''
  const msg = `Buongiorno${nome}! Sto arrivando per l'appuntamento delle ${timeOf(row.scheduled_at)}. A tra poco. — ${workspaceName}`
  return `https://wa.me/${digits}?text=${encodeURIComponent(msg)}`
}

function addDays(dateKey: string, n: number): string {
  return dayKeyOf(new Date(new Date(`${dateKey}T12:00:00Z`).getTime() + n * 86_400_000))
}

/** Lunedì (chiave sv-SE, giorno Roma) della settimana che contiene dateKey. */
function mondayKeyOf(dateKey: string): string {
  const noon = new Date(`${dateKey}T12:00:00Z`)
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Rome', weekday: 'short' }).format(noon)
  const idx = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(wd)
  return dayKeyOf(new Date(noon.getTime() - Math.max(0, idx) * 86_400_000))
}

/** Sposta un "YYYY-MM" di `delta` mesi. */
function shiftMonth(monthParam: string, delta: number): string {
  const y = Number(monthParam.slice(0, 4))
  const m = Number(monthParam.slice(5, 7))
  const d = new Date(Date.UTC(y, m - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

function monthLabel(monthParam: string): string {
  const y = Number(monthParam.slice(0, 4))
  const m = Number(monthParam.slice(5, 7))
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('it-IT', { timeZone: 'UTC', month: 'long', year: 'numeric' })
}

export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>
}) {
  const { m } = await searchParams
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  const todayKey = dayKeyOf(new Date())
  const currentMonth = todayKey.slice(0, 7)
  const monthParam = m && /^\d{4}-\d{2}$/.test(m) ? m : currentMonth
  const isCurrentMonth = monthParam === currentMonth

  // Griglia: dal lunedì della settimana che contiene il giorno 1, per settimane
  // intere fino a coprire l'ultimo giorno del mese (5 o 6 righe).
  const firstKey = `${monthParam}-01`
  const y = Number(monthParam.slice(0, 4))
  const mo = Number(monthParam.slice(5, 7))
  const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  const lastKey = `${monthParam}-${String(daysInMonth).padStart(2, '0')}`
  const gridStart = mondayKeyOf(firstKey)
  const cells: string[] = []
  {
    let cur = gridStart
    do {
      cells.push(cur)
      cur = addDays(cur, 1)
    } while (!(cells.length % 7 === 0 && cells[cells.length - 1] >= lastKey) && cells.length < 43)
  }
  const weeks: string[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  // Range query = intera griglia (margine ±36h per il fuso, poi filtro per giorno Roma)
  const queryFrom = new Date(`${cells[0]}T12:00:00Z`).getTime() - 36 * 3_600_000
  const queryTo = new Date(`${cells[cells.length - 1]}T12:00:00Z`).getTime() + 36 * 3_600_000

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 047/048/049 non ancora in types/database.ts
  const db = supabase as any
  const events: EventRow[] = []
  let inCorso: Array<{ id: string; title: string }> = []
  const [sopralluoghiRes, lavoriRes, inCorsoRes] = await Promise.all([
    db.from('sopralluoghi')
      .select('id, title, address, scheduled_at, clients ( name, surname, phone )')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .not('scheduled_at', 'is', null)
      .gte('scheduled_at', new Date(queryFrom).toISOString())
      .lte('scheduled_at', new Date(queryTo).toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(300)
      .then((r: { data: unknown[] | null }) => r.data)
      .catch(() => null),
    db.from('lavori')
      .select('id, title, address, scheduled_at, clients ( name, surname, phone )')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .not('scheduled_at', 'is', null)
      .gte('scheduled_at', new Date(queryFrom).toISOString())
      .lte('scheduled_at', new Date(queryTo).toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(300)
      .then((r: { data: unknown[] | null }) => r.data)
      .catch(() => null),
    db.from('lavori')
      .select('id, title')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .eq('status', 'in_corso')
      .order('updated_at', { ascending: false })
      .limit(10)
      .then((r: { data: unknown[] | null }) => r.data)
      .catch(() => null),
  ])
  for (const r of ((sopralluoghiRes ?? []) as Array<Omit<EventRow, 'kind'>>)) events.push({ kind: 'sopralluogo', ...r })
  for (const r of ((lavoriRes ?? []) as Array<Omit<EventRow, 'kind'>>)) events.push({ kind: 'lavoro', ...r })
  inCorso = (inCorsoRes ?? []) as typeof inCorso

  const workspaceName: string = workspace.ragione_sociale ?? workspace.name

  // Eventi pronti per il client, raggruppati per giorno (Roma), ordinati per ora.
  const cellSet = new Set(cells)
  const byDay: Record<string, AgendaItem[]> = {}
  for (const e of events.sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())) {
    const key = dayKeyOf(new Date(e.scheduled_at))
    if (!cellSet.has(key)) continue
    ;(byDay[key] ??= []).push({
      kind: e.kind,
      id: e.id,
      title: e.title,
      address: e.address,
      time: timeOf(e.scheduled_at),
      clientName: [e.clients?.name, e.clients?.surname].filter(Boolean).join(' '),
      href: e.kind === 'lavoro' ? `/lavori/${e.id}` : `/sopralluoghi/${e.id}`,
      waHref: arrivingUrl(e, workspaceName),
      mapsHref: e.address ? mapsUrl(e.address) : null,
    })
  }

  // Giorno selezionato di default: oggi (se siamo nel mese corrente), altrimenti
  // il primo giorno del mese con appuntamenti, altrimenti il giorno 1.
  const monthDayKeys = cells.filter((k) => k.slice(0, 7) === monthParam)
  const defaultSelected = isCurrentMonth
    ? todayKey
    : (monthDayKeys.find((k) => (byDay[k]?.length ?? 0) > 0) ?? firstKey)

  return (
    <div className="max-w-3xl mx-auto" style={{ position: 'relative', minHeight: '70vh' }}>
      {/* Header */}
      <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Agenda</span>
        <span style={{ width: 24 }} />
      </div>

      {/* Navigazione mese */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, margin: '13px 15px 0', fontSize: 15, fontWeight: 600, color: '#161616' }}>
        <Link href={`/calendario?m=${shiftMonth(monthParam, -1)}`} replace aria-label="Mese precedente" style={{ color: 'var(--cc-muted)', display: 'flex', padding: 4 }}>
          <ChevronLeft size={18} />
        </Link>
        <span style={{ minWidth: 150, textAlign: 'center', textTransform: 'capitalize' }}>{monthLabel(monthParam)}</span>
        <Link href={`/calendario?m=${shiftMonth(monthParam, 1)}`} replace aria-label="Mese successivo" style={{ color: 'var(--cc-muted)', display: 'flex', padding: 4 }}>
          <ChevronRight size={18} />
        </Link>
      </div>
      {!isCurrentMonth && (
        <div style={{ textAlign: 'center', marginTop: 6 }}>
          <Link href="/calendario" replace style={{ fontSize: 12, fontWeight: 600, color: '#b0863e', textDecoration: 'none' }}>
            ↩ Torna a questo mese
          </Link>
        </div>
      )}

      {/* Calendario mensile + appuntamenti del giorno.
          key={monthParam}: al cambio mese con destinazione in router cache il
          client rimonta il componente, così il giorno selezionato riparte dal
          default del nuovo mese invece di restare su quello vecchio (M3). */}
      <MonthAgenda
        key={monthParam}
        weeks={weeks}
        monthParam={monthParam}
        todayKey={todayKey}
        byDay={byDay}
        defaultSelected={defaultSelected}
      />

      {/* Lavori in corso (senza orario) */}
      {inCorso.length > 0 && (
        <div style={{ margin: '16px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '12px 15px' }}>
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

      <p style={{ margin: '14px 15px 0', fontSize: 12, color: '#767676', textAlign: 'center' }}>
        Il pallino oro segna i giorni con appuntamenti · tocca un giorno per vederli
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
