import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CalendarDays, Navigation, Plus, ChevronRight } from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BackButton } from '@/components/shared/BackButton'

export const metadata = { title: 'Calendario' }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

interface AppointmentRow {
  id: string
  title: string
  address: string | null
  scheduled_at: string
  clients: { name: string | null; surname: string | null } | null
}

const dayKeyOf = (x: Date) => x.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })

/** "Oggi", "Domani" o "mercoledì 15 luglio" (ora italiana). */
function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const tomorrow = new Date(today.getTime() + 86_400_000)
  if (dayKeyOf(d) === dayKeyOf(today)) return 'Oggi'
  if (dayKeyOf(d) === dayKeyOf(tomorrow)) return 'Domani'
  return d.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long' })
}

function timeOf(iso: string): string {
  return new Date(iso).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })
}

function mapsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

export default async function CalendarioPage() {
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonna 047 non ancora in types/database.ts
  const db = supabase as any
  let rows: AppointmentRow[] = []
  try {
    const { data } = await db
      .from('sopralluoghi')
      .select('id, title, address, scheduled_at, clients ( name, surname )')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .not('scheduled_at', 'is', null)
      .gte('scheduled_at', new Date(Date.now() - 86_400_000).toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(60)
    rows = ((data ?? []) as AppointmentRow[])
      // solo oggi e futuri (in ora italiana)
      .filter((r) => dayKeyOf(new Date(r.scheduled_at)) >= dayKeyOf(new Date()))
  } catch { /* migration 047 non ancora applicata → vuoto */ }

  // Raggruppa per giorno mantenendo l'ordine cronologico
  const groups: Array<{ label: string; items: AppointmentRow[] }> = []
  for (const row of rows) {
    const label = dayLabel(row.scheduled_at)
    const last = groups[groups.length - 1]
    if (last && last.label === label) last.items.push(row)
    else groups.push({ label, items: [row] })
  }

  return (
    <div className="max-w-3xl mx-auto" style={{ position: 'relative', minHeight: '70vh' }}>
      {/* Header — fascia bianca */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #eeeeee', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: '#161616' }}>Calendario</span>
        <span style={{ width: 24 }} />
      </div>

      {groups.length > 0 ? (
        groups.map((group) => (
          <div key={group.label} style={{ margin: '14px 15px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', margin: '0 2px 7px' }}>
              <CalendarDays size={14} /> {group.label}
            </div>
            <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '2px 15px' }}>
              {group.items.map((row, idx) => {
                const clientName = [row.clients?.name, row.clients?.surname].filter(Boolean).join(' ')
                return (
                  <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 0', borderBottom: idx < group.items.length - 1 ? '0.5px solid #eee' : 'none' }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#1a1a2e', width: 46, flexShrink: 0 }}>
                      {timeOf(row.scheduled_at)}
                    </span>
                    <Link href={`/sopralluoghi/${row.id}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                      <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#161616', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {row.title}{clientName ? ` — ${clientName}` : ''}
                      </span>
                      {row.address && (
                        <span style={{ display: 'block', fontSize: 12, color: '#8a887f', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.address}
                        </span>
                      )}
                    </Link>
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
          <p style={{ fontWeight: 600, color: '#161616', fontSize: 14 }}>Nessun appuntamento in programma</p>
          <p style={{ fontSize: 13, color: '#8a887f', marginTop: 4, lineHeight: 1.5 }}>
            Imposta data e ora nel campo <b>Appuntamento</b> di un sopralluogo: lo ritroverai qui, con la navigazione verso il cantiere.
          </p>
        </div>
      )}

      <p style={{ margin: '12px 15px 0', fontSize: 12, color: '#767676', textAlign: 'center' }}>
        Gli appuntamenti vengono dai tuoi sopralluoghi.
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
