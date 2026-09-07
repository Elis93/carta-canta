import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, ChevronRight, CalendarDays, Navigation } from 'lucide-react'
import { formatDocNumber } from '@/lib/utils'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BackButton } from '@/components/shared/BackButton'
import { CestinoToggle } from '../_components/CestinoToggle'
import { CestinoInline } from '../_components/CestinoInline'

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

/** Titolo dato dall'app («Lavoro 05.09 Giorgio G.», «Sopralluogo 2»): in
    lista non si mostra, ripete il cliente. Uno scritto a mano sì. */
function isTitoloAutomatico(title: string): boolean {
  return /^(Lavoro \d{2}\.\d{2}\b|Sopralluogo\b)/.test(title.trim())
}

export default async function SopralluoghiPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>
}) {
  const { q = '', status } = await searchParams
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  // CESTINO (#10, 15 ago): il tab «Cestino» mostra i sopralluoghi eliminati,
  // con ripristino ed eliminazione definitiva. Vista a sé (client component),
  // come nelle liste Preventivi/Fatture.
  if (status === 'cestino') {
    // Vista a sé (Eli, 17 ago): solo il cestino, la freccia riporta alla
    // lista. Niente più il tasto «Cestino» ridondante qui.
    return (
      <div className="max-w-3xl mx-auto">
        <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
          <BackButton fallback="/sopralluoghi" ariaLabel="Torna ai sopralluoghi" />
          <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Cestino</span>
          <span style={{ width: 24 }} />
        </div>
        <div style={{ padding: '14px 15px 90px' }}>
          <CestinoInline scope="sopralluogo" workspaceId={workspace.id} />
        </div>
      </div>
    )
  }

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

  // Il numero del preventivo nato dal sopralluogo («Preventivo 012/2026
  // creato», 7 set): una query a sé, tollerante — senza, la riga dice solo
  // «Preventivo creato».
  const docNumbers = new Map<string, string | null>()
  const docIds = rows.map((r) => r.document_id).filter((x): x is string => !!x)
  if (docIds.length > 0) {
    try {
      const { data } = await supabase.from('documents').select('id, doc_number').in('id', docIds)
      for (const d of data ?? []) docNumbers.set(d.id, d.doc_number)
    } catch { /* best-effort */ }
  }

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

      {/* Accesso al cestino dei sopralluoghi (#10) */}
      <div className="flex flex-wrap items-center gap-2" style={{ margin: '12px 15px 0' }}>
        <CestinoToggle base="/sopralluoghi" attivo={false} />
      </div>

      {/* Agenda — prossimi appuntamenti (calendario sopralluoghi) */}
      {upcoming.length > 0 && (
        <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '13px 15px' }}>
          {/* Tocco sull'intestazione → apre l'Agenda (feedback Eli 22 lug #8) */}
          <Link href="/calendario" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 4, textDecoration: 'none' }}>
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
        /* ── Variante B del mockup «Riordino di settembre» (scelta Eli 7 set):
           via il cerchio con le iniziali («GG», «S2» non dicevano niente e due
           sopralluoghi dello stesso cliente erano identici). Riga 1 = cliente ·
           indirizzo del cantiere (o il titolo scritto a mano) con le foto in
           Georgia a destra; riga 2 = appuntamento · aggiornato; riga 3 = lo
           stato in parole. Il filetto a sinistra dice lo stato a colpo
           d'occhio: verde = preventivo creato · oro = foto da lavorare ·
           grigio = solo appunti. Stessi quattro livelli di testo della Home. */
        <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '4px 0' }}>
          {rows.map((row, idx) => {
            const clientName = [row.clients?.name, row.clients?.surname].filter(Boolean).join(' ')
            const nPhotos = photoCounts.get(row.id) ?? 0
            const manuale = !isTitoloAutomatico(row.title)
            const titolo = manuale ? row.title : (clientName || 'Senza cliente')
            const sotto = [
              manuale ? (clientName || 'Senza cliente') : null,
              row.address,
            ].filter(Boolean).join(' · ')
            const riga1 = sotto && !manuale ? `${titolo} · ${sotto}` : titolo
            const riga2 = [
              row.scheduled_at ? fmtAppointment(row.scheduled_at) : null,
              manuale && sotto ? sotto : null,
              `aggiornato ${timeAgo(row.updated_at)}`,
            ].filter(Boolean).join(' · ')
            const numero = row.document_id ? docNumbers.get(row.document_id) : null
            const stato = row.document_id
              ? `Preventivo ${numero ? formatDocNumber(numero) : ''} creato`.replace('  ', ' ')
              : 'Da trasformare in preventivo'
            const filetto = row.document_id ? '#2f8a63' : nPhotos > 0 ? '#c9a44c' : '#c9c7c0'
            return (
              <Link
                key={row.id}
                href={`/sopralluoghi/${row.id}`}
                style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 15px', borderBottom: idx < rows.length - 1 ? '1px solid #ededea' : 'none', textDecoration: 'none', color: 'inherit' }}
              >
                <span aria-hidden style={{ position: 'absolute', left: 0, top: 14, bottom: 14, width: 2, borderRadius: 2, background: filetto }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                    <span className="cc-t-main" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{riga1}</span>
                    {nPhotos > 0 ? (
                      <span className="cc-t-num" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
                        {nPhotos} <span className="cc-t-sub">foto</span>
                      </span>
                    ) : row.notes ? (
                      <span className="cc-t-sub" style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>solo appunti</span>
                    ) : null}
                  </span>
                  <span className="cc-t-sub" style={{ display: 'block', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{riga2}</span>
                  <span className={row.document_id ? 'cc-t-sub-strong' : 'cc-t-sub'} style={{ display: 'block', marginTop: 2, color: row.document_id ? '#2f8a63' : undefined, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stato}</span>
                </span>
                <ChevronRight size={16} style={{ color: '#c2c1bd', flexShrink: 0, marginTop: 2 }} />
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
