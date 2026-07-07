import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, Search, CheckCircle2, ChevronRight } from 'lucide-react'
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
  clients: { name: string | null; surname: string | null } | null
}

function timeAgo(iso: string): string {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days <= 0) return 'oggi'
  if (days === 1) return 'ieri'
  if (days < 7) return `${days} giorni fa`
  if (days < 30) return `${Math.floor(days / 7)} sett. fa`
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '')
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
  try {
    let query = db
      .from('sopralluoghi')
      .select('id, title, address, notes, document_id, updated_at, clients ( name, surname )')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(100)
    if (q.trim()) {
      // Virgole/parentesi romperebbero la sintassi del filtro .or() di PostgREST
      const safe = q.trim().replace(/[,()]/g, ' ').replace(/[%_\\]/g, (c) => `\\${c}`)
      query = query.or(`title.ilike.%${safe}%,address.ilike.%${safe}%`)
    }
    const { data } = await query
    rows = (data ?? []) as SopralluogoRow[]

    if (rows.length > 0) {
      const { data: photos } = await db
        .from('work_photos')
        .select('sopralluogo_id')
        .in('sopralluogo_id', rows.map((r: SopralluogoRow) => r.id))
      photoCounts = ((photos ?? []) as Array<{ sopralluogo_id: string }>).reduce((acc, p) => {
        acc.set(p.sopralluogo_id, (acc.get(p.sopralluogo_id) ?? 0) + 1)
        return acc
      }, new Map<string, number>())
    }
  } catch { /* migration 041 non ancora applicata → lista vuota */ }

  return (
    <div className="max-w-3xl mx-auto" style={{ position: 'relative', minHeight: '70vh' }}>
      {/* Header — fascia bianca */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #eeeeee', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: '#161616' }}>Sopralluoghi</span>
        <span style={{ width: 24 }} />
      </div>

      {/* Ricerca */}
      <form method="get" style={{ margin: '14px 15px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, background: '#fff', border: '1px solid #e3e3e6', boxShadow: '0 1px 2px rgba(20,20,40,.04)', borderRadius: 11, padding: '11px 13px' }}>
          <Search size={18} style={{ color: '#8a887f', flexShrink: 0 }} />
          <input
            name="q"
            defaultValue={q}
            placeholder="Cerca titolo o indirizzo…"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#161616', fontSize: 16 }}
          />
        </div>
      </form>

      {rows.length > 0 ? (
        <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '4px 15px' }}>
          {rows.map((row, idx) => {
            const clientName = [row.clients?.name, row.clients?.surname].filter(Boolean).join(' ')
            const nPhotos = photoCounts.get(row.id) ?? 0
            const subParts = [
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
                    {row.title}{clientName ? ` — ${clientName}` : ''}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: '#8a887f', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {subParts.join(' · ')}
                  </span>
                </span>
                {row.document_id ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '1px solid #bce3d2', color: '#2f8a63', borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 600, flexShrink: 0, whiteSpace: 'nowrap' }}>
                    <CheckCircle2 size={12} /> Preventivo creato
                  </span>
                ) : (
                  <span style={{ border: '1px solid #e3e3e6', color: '#8a887f', borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
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
          <p style={{ fontSize: 13, color: '#8a887f', marginTop: 4, lineHeight: 1.5 }}>
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
