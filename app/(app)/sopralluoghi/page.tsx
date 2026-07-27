import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, CheckCircle2, ChevronRight, CalendarDays, Navigation } from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BackButton } from '@/components/shared/BackButton'

export const metadata = { title: 'Sopralluoghi' }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

interface SopralluogoRow {
  id: string
  title: string
  address: string | null
  notes: string | null
  document_id: string | null
  updated_at: string
  scheduled_at?: string | null
  clients: { name: string | null; surname: string | null } | null
}

/** "Oggi · 15:30", "Domani · 09:00" o "mer 15 lug · 15:30" (ora italiana). */
function fmtAppointment(iso: string): string {
  const d = new Date(iso)
  const dayKey = (x: Date) => x.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
  const time = d.toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' })
  const today = new Date()
  const tomorrow = new Date(today.getTime() + 86_400_000)
  if (dayKey(d) === dayKey(today)) return `Oggi · ${time}`
  if (dayKey(d) === dayKey(tomorrow)) return `Domani · ${time}`
  const date = d.toLocaleDateString('it-IT', { timeZone: 'Europe/Rome', weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '')
  return `${date} · ${time}`
}

function mapsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`
}

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'oggi'
  if (days === 1) return 'ieri'
  if (days < 7) return `${days} giorni fa`
  if (days < 30) return `${Math.floor(days / 7)} sett. fa`
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' , timeZone: 'Europe/Rome' }).replace('.', '')
}

function initials(row: SopralluogoRow): string {
  const source = [row.clients?.name, row.clients?.surname].filter(Boolean).join(' ') || row.title
  return source.split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase() || 'S'
}

export default async function SopralluoghiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const { q = '' } = await searchParams
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 041 non ancora in types/database.ts
  const db = supabase as any
  let rows: SopralluogoRow[] = []
  let photoCounts = new Map<string, number>()
  let agendaRows: SopralluogoRow[] = []
  try {
    // Prima con scheduled_at (047); se la colonna manca, retry senza.
    const buildQuery = (withScheduled: boolean) => {
      let query = db
        .from('sopralluoghi')
        .select(`id, title, address, notes, document_id, updated_at${withScheduled ? ', scheduled_at' : ''}, clients ( name, surname )`)
        .eq('workspace_id', workspace.id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(100)
      if (q.trim()) {
        // Virgole/parentesi romperebbero la sintassi del filtro .or() di PostgREST
        const safe = q.trim().replace(/[,()"]/g, ' ').replace(/[%_\\]/g, (c) => `\\${c}`)
        query = query.or(`title.ilike.%${safe}%,address.ilike.%${safe}%`)
      }
      return query
    }
    // PERF: lista, conteggio foto e agenda sono indipendenti → un solo round
    // trip invece di tre in serie. Le foto sono scoped al workspace (superset
    // delle righe in lista: la mappa serve solo per le righe mostrate).
    const [mainData, photosData, agendaData] = await Promise.all([
      buildQuery(true).then((r: { data: unknown[] | null }) => r.data, () => null),
      db
        .from('work_photos')
        .select('sopralluogo_id')
        .eq('workspace_id', workspace.id)
        .not('sopralluogo_id', 'is', null)
        .then((r: { data: unknown[] | null }) => r.data, () => null),
      // Agenda: query DEDICATA (indipendente da ricerca e dal limite 100 per
      // updated_at) — appuntamenti da ieri in poi, poi filtrati per giorno Roma.
      db
        .from('sopralluoghi')
        .select('id, title, address, notes, document_id, updated_at, scheduled_at, clients ( name, surname )')
        .eq('workspace_id', workspace.id)
        .is('deleted_at', null)
        .not('scheduled_at', 'is', null)
        .gte('scheduled_at', new Date(Date.now() - 86_400_000).toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(20)
        .then((r: { data: unknown[] | null }) => r.data, () => null), // migration 047 non applicata → agenda vuota
    ])
    let data = mainData
    if (!data) ({ data } = await buildQuery(false))
    rows = (data ?? []) as SopralluogoRow[]

    photoCounts = ((photosData ?? []) as Array<{ sopralluogo_id: string }>).reduce((acc, p) => {
      acc.set(p.sopralluogo_id, (acc.get(p.sopralluogo_id) ?? 0) + 1)
      return acc
    }, new Map<string, number>())
    agendaRows = (agendaData ?? []) as SopralluogoRow[]
  } catch { /* migration 041 non ancora applicata → lista vuota */ }

  // Appuntamenti di oggi e futuri (ora italiana), dal più vicino
  const dayKey = (x: Date) => x.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
  const todayKey = dayKey(new Date())
  const upcoming = agendaRows
    .filter((r) => r.scheduled_at && dayKey(new Date(r.scheduled_at)) >= todayKey)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())

  return (
    <div className="max-w-3xl mx-auto" style={{ position: 'relative', minHeight: '70vh' }}>
      {/* Header — fascia bianca */}
      <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Sopralluoghi</span>
        <span style={{ width: 24 }} />
      </div>

      {/* Ricerca */}
      <form method="get" style={{ margin: '14px 15px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#fff', border: '1px solid #e3e3e6', boxShadow: '0 1px 2px rgba(20,20,40,.04)', borderRadius: 11, padding: '11px 13px' }}>
          <Search size={18} style={{ color: 'var(--cc-muted)', flexShrink: 0 }} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Cerca titolo o indirizzo…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#161616', fontSize: 16 }}
          />
        </div>
      </form>

      {/* Agenda — prossimi appuntamenti (calendario sopralluoghi) */}
      {upcoming.length > 0 && (
        <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '13px 15px' }}>
          {/* Tocco sull'intestazione → apre l'Agenda (feedback Eli 22 lug #8) */}
          <Link href="/calendario" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 4, textDecoration: 'none' }}>
            <CalendarDays size={15} /> Prossimi appuntamenti
            <ChevronRight size={15} style={{ marginLeft: 'auto' }} />
          </Link>
          {upcoming.map((row, idx) => {
            const clientName = [row.clients?.name, row.clients?.surname].filter(Boolean).join(' ')
            return (
              <div key={row.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: idx < upcoming.length - 1 ? '0.5px solid #eee' : 'none' }}>
                <Link href={`/sopralluoghi/${row.id}`} style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
                  <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#1a1a2e' }}>
                    {fmtAppointment(row.scheduled_at!)}
                  </span>
                  <span style={{ display: 'block', fontSize: 13, color: '#161616', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.title}{clientName ? ` — ${clientName}` : ' — Senza cliente'}
                  </span>
                  {row.address && (
                    <span style={{ display: 'block', fontSize: 12, color: 'var(--cc-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.address}
                    </span>
                  )}
                </Link>
                {row.address && (
                  <a
                    href={mapsUrl(row.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Naviga verso ${row.address}`}
                    style={{ width: 42, height: 42, borderRadius: 12, background: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px -4px rgba(26,26,46,.45)' }}
                  >
                    <Navigation size={18} />
                  </a>
                )}
              </div>
            )
          })}
        </div>
      )}

      {rows.length > 0 ? (
        <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '4px 15px' }}>
          {rows.map((row, idx) => {
            const clientName = [row.clients?.name, row.clients?.surname].filter(Boolean).join(' ')
            const nPhotos = photoCounts.get(row.id) ?? 0
            const subParts = [
              row.scheduled_at ? `📅 ${fmtAppointment(row.scheduled_at)}` : null,
              row.address,
              nPhotos > 0 ? `${nPhotos} foto` : (row.notes ? 'solo testo' : null),
              timeAgo(row.updated_at),
            ].filter(Boolean)
            return (
              <Link
                key={row.id}
                href={`/sopralluoghi/${row.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '12px 0', borderBottom: idx < rows.length - 1 ? '0.5px solid #eee' : 'none', textDecoration: 'none', color: 'inherit' }}
              >
                <span style={{ width: 36, height: 36, borderRadius: '50%', background: '#f2f2f5', color: '#55534b', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {initials(row)}
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#161616', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.title}{clientName ? ` — ${clientName}` : ' — Senza cliente'}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--cc-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {subParts.join(' · ')}
                  </span>
                </span>
                {row.document_id ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #bce3d2', color: '#2f8a63', borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <CheckCircle2 size={12} /> Preventivo creato
                  </span>
                ) : (
                  <span style={{ border: '1px solid #e3e3e6', color: 'var(--cc-muted)', borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
                    Bozza
                  </span>
                )}
                <ChevronRight size={16} style={{ color: '#c2c1bd', flexShrink: 0 }} />
              </Link>
            )
          })}
        </div>
      ) : (
        <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '30px 15px', textAlign: 'center' }}>
          <p style={{ fontWeight: 600, color: '#161616', fontSize: 14 }}>
            {q ? 'Nessun sopralluogo trovato' : 'Nessun sopralluogo'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 4, lineHeight: 1.5 }}>
            Prendi appunti in cantiere (testo, foto, dettatura) e trasformali in preventivo con un tocco.
          </p>
        </div>
      )}

      <p style={{ margin: '12px 15px 0', fontSize: 12, color: '#767676', textAlign: 'center' }}>
        I sopralluoghi restano tuoi: il cliente non li vede mai.
      </p>

      {/* FAB nuovo sopralluogo */}
      <Link
        href="/sopralluoghi/nuovo"
        aria-label="Nuovo sopralluogo"
        style={{ position: 'fixed', right: 18, bottom: 84, width: 54, height: 54, borderRadius: '50%', background: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px -6px rgba(26,26,46,.55)', zIndex: 30 }}
      >
        <Plus size={24} />
      </Link>

      <div style={{ height: 90 }} />
    </div>
  )
}
