import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, ChevronRight, Hammer } from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BackButton } from '@/components/shared/BackButton'
import { LAVORO_STATUS_META } from './_components/lavoro-status'

export const metadata = { title: 'Lavori' }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

interface LavoroRow {
  id: string
  title: string
  address: string | null
  status: 'da_iniziare' | 'in_corso' | 'finito' | 'fatturato'
  updated_at: string
  document_id: string | null
  clients: { name: string | null; surname: string | null } | null
}


// "Da fare" (non "Da iniziare"): con l'etichetta corta tutti e 5 i filtri
// entrano su 360px senza scroll (scelta Eli 14 lug, mockup 1A)
const FILTERS: Array<{ key: string; label: string }> = [
  { key: 'tutti', label: 'Tutti' },
  { key: 'da_iniziare', label: 'Da fare' },
  { key: 'in_corso', label: 'In corso' },
  { key: 'finito', label: 'Finiti' },
  { key: 'fatturato', label: 'Fatturati' },
]

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'oggi'
  if (days === 1) return 'ieri'
  if (days < 7) return `${days} giorni fa`
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' , timeZone: 'Europe/Rome' }).replace('.', '')
}

export default async function LavoriPage({
  searchParams,
}: {
  searchParams: Promise<{ stato?: string }>
}) {
  const { stato = 'tutti' } = await searchParams
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 048 non ancora in types/database.ts
  const db = supabase as any
  let rows: LavoroRow[] = []
  try {
    let query = db
      .from('lavori')
      .select('id, title, address, status, updated_at, document_id, clients ( name, surname )')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(150)
    if (stato !== 'tutti' && ['da_iniziare', 'in_corso', 'finito', 'fatturato'].includes(stato)) {
      query = query.eq('status', stato)
    }
    const { data } = await query
    rows = (data ?? []) as LavoroRow[]
  } catch { /* migration 048 non ancora applicata → lista vuota */ }

  return (
    <div className="max-w-3xl mx-auto" style={{ position: 'relative', minHeight: '70vh' }}>
      {/* Header — fascia bianca */}
      <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Lavori</span>
        <span style={{ width: 24 }} />
      </div>

      {/* Filtri stato — stesso stile tab di Preventivi/Fatture (mockup 1A,
          Eli 14 lug): larghezze naturali + vuoti uguali, niente scroll */}
      <div className="cc-tabs cc-filter-scroll" style={{ padding: '10px 15px 15px' }}>
        {FILTERS.map((f) => {
          const active = stato === f.key
          return (
            <Link
              key={f.key}
              href={f.key === 'tutti' ? '/lavori' : `/lavori?stato=${f.key}`}
              replace
              className={active ? 'cc-tab-active' : 'cc-tab'}
            >
              {f.label}
            </Link>
          )
        })}
      </div>

      {rows.length > 0 ? (
        <div style={{ margin: '0 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '4px 15px' }}>
          {rows.map((row, idx) => {
            const clientName = [row.clients?.name, row.clients?.surname].filter(Boolean).join(' ')
            const meta = LAVORO_STATUS_META[row.status]
            return (
              <Link
                key={row.id}
                href={`/lavori/${row.id}`}
                style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '13px 0', borderBottom: idx < rows.length - 1 ? '0.5px solid #eee' : 'none', textDecoration: 'none', color: 'inherit' }}
              >
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#161616', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.title}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: 'var(--cc-muted)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {[clientName || null, row.address, timeAgo(row.updated_at)].filter(Boolean).join(' · ')}
                  </span>
                </span>
                <span style={{ background: meta.bg, color: meta.color, borderRadius: 999, padding: '3px 10px', fontSize: 11, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
                  {meta.label}
                </span>
                <ChevronRight size={16} style={{ color: '#c2c1bd', flexShrink: 0 }} />
              </Link>
            )
          })}
        </div>
      ) : (
        <div style={{ margin: '0 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '30px 15px', textAlign: 'center' }}>
          <Hammer size={26} style={{ color: '#c2c1bd', margin: '0 auto 8px' }} />
          <p style={{ fontWeight: 600, color: '#161616', fontSize: 14 }}>
            {stato === 'tutti' ? 'Nessun lavoro' : 'Nessun lavoro in questo stato'}
          </p>
          <p style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 4, lineHeight: 1.5 }}>
            Apri un lavoro da un preventivo accettato (bottone &laquo;Apri lavoro&raquo;) o creane uno col +.
            Qui segui il cantiere: da fare, in corso, finito, fatturato.
          </p>
        </div>
      )}

      {/* FAB nuovo lavoro */}
      <Link
        href="/lavori/nuovo"
        aria-label="Nuovo lavoro"
        style={{ position: 'fixed', right: 18, bottom: 84, width: 54, height: 54, borderRadius: '50%', background: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 8px 20px -6px rgba(26,26,46,.55)', zIndex: 30 }}
      >
        <Plus size={24} />
      </Link>

      <div style={{ height: 90 }} />
    </div>
  )
}
