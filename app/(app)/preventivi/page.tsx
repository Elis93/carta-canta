import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { SearchBar } from '@/components/shared/SearchBar'
import { Plus, FileText, Inbox, Eye } from 'lucide-react'
import { StatusBadge } from './_components/StatusBadge'
import { KanbanView } from './_components/KanbanView'
import { ViewToggle } from './_components/ViewToggle'

interface Props {
  searchParams: Promise<{ q?: string; status?: string; view?: string }>
}

const STATUS_TABS = [
  { value: '',         label: 'Tutti' },
  { value: 'draft',    label: 'Bozze' },
  { value: 'sent',     label: 'Inviati' },
  { value: 'viewed',   label: 'Visti' },
  { value: 'accepted', label: 'Accettati' },
  { value: 'rejected', label: 'Rifiutati' },
]

export default async function PreventiviPage({ searchParams }: Props) {
  const { q, status, view } = await searchParams
  const isKanban = view === 'kanban'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, plan')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) redirect('/login')

  // Query preventivi — ordinamento per anno e numero progressivo (colonne generate),
  // poi created_at come tiebreaker per documenti senza numerazione.
  let query = supabase
    .from('documents')
    .select(`
      id, title, doc_number, status, total, currency,
      created_at, sent_at, expires_at,
      clients(id, name)
    `)
    .eq('workspace_id', workspace.id)
    .order('doc_year', { ascending: false, nullsFirst: false })
    .order('doc_seq', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status as 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired')

  if (q) {
    query = query.textSearch('search_vector', q, { type: 'websearch', config: 'italian' })
  } else {
    query = query.limit(50)
  }

  const { data: documents } = await query

  // Contatori aperture per documento (una sola query per tutti)
  const docIds = (documents ?? []).map((d) => d.id)
  const { data: viewRows } = docIds.length > 0
    ? await supabase
        .from('document_views')
        .select('document_id')
        .in('document_id', docIds)
    : { data: [] as Array<{ document_id: string }> }

  const viewCountMap = (viewRows ?? []).reduce<Record<string, number>>((acc, v) => {
    acc[v.document_id] = (acc[v.document_id] ?? 0) + 1
    return acc
  }, {})

  // KPI rapidi
  const { data: counts } = await supabase
    .from('documents')
    .select('status, total')
    .eq('workspace_id', workspace.id)

  const kpi = {
    total: counts?.length ?? 0,
    sent: counts?.filter((d) => d.status === 'sent' || d.status === 'viewed').length ?? 0,
    viewed: counts?.filter((d) => d.status === 'viewed').length ?? 0,
    accepted: counts?.filter((d) => d.status === 'accepted').length ?? 0,
    valore: counts?.filter((d) => d.status === 'accepted')
      .reduce((s, d) => s + (d.total ?? 0), 0) ?? 0,
  }

  const atLimit = workspace.plan === 'free' && kpi.total >= 10

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Preventivi</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {kpi.total} totali · {kpi.sent} in attesa · {kpi.viewed > 0 ? `${kpi.viewed} visti · ` : ''}{kpi.accepted} accettati
          </p>
        </div>
        <Button asChild disabled={atLimit}>
          <Link href="/preventivi/nuovo">
            <Plus className="size-4" /> Nuovo preventivo
          </Link>
        </Button>
      </div>

      {/* Paywall Free */}
      {atLimit && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Hai raggiunto il limite di 10 preventivi del piano Free.{' '}
          <Link href="/abbonamento" className="font-semibold underline underline-offset-2">
            Passa a Pro
          </Link>{' '}
          per preventivi illimitati.
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Totali</p>
          <p className="text-2xl font-bold mt-1">{kpi.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">In attesa</p>
          <p className="text-2xl font-bold mt-1">{kpi.sent}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Accettati</p>
          <p className="text-2xl font-bold mt-1 text-green-600">{kpi.accepted}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-xs text-muted-foreground">Valore accettati</p>
          <p className="text-2xl font-bold mt-1">
            €{kpi.valore.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Filtri + Cerca + ViewToggle */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Tab status (nascosti in kanban) */}
        {!isKanban && (
          <nav className="flex gap-1 flex-wrap">
            {STATUS_TABS.map((tab) => (
              <Link
                key={tab.value}
                href={tab.value ? `/preventivi?status=${tab.value}` : '/preventivi'}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  (status ?? '') === tab.value
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </Link>
            ))}
          </nav>
        )}
        <div className={`flex items-center gap-2 ${!isKanban ? 'sm:ml-auto' : ''}`}>
          {!isKanban && (
            <div className="w-full sm:w-64">
              <SearchBar placeholder="Cerca preventivo…" paramName="q" />
            </div>
          )}
          <ViewToggle
            currentView={isKanban ? 'kanban' : 'list'}
            listHref={status ? `/preventivi?status=${status}` : '/preventivi'}
            kanbanHref="/preventivi?view=kanban"
          />
        </div>
      </div>

      {/* Kanban view */}
      {isKanban && documents && documents.length > 0 && (
        <KanbanView
          documents={(documents ?? []).map((doc) => {
            const client = doc.clients as { id: string; name: string } | null
            const isExpired = !!(doc.expires_at
              && (doc.status === 'sent' || doc.status === 'viewed')
              && new Date(doc.expires_at) < new Date())
            return {
              id: doc.id,
              doc_number: doc.doc_number ?? null,
              title: doc.title ?? '',
              status: doc.status,
              total: doc.total ?? null,
              created_at: doc.created_at ?? '',
              sent_at: doc.sent_at ?? null,
              expires_at: doc.expires_at ?? null,
              clients: client,
              viewCount: viewCountMap[doc.id] ?? 0,
              isExpired,
            }
          })}
        />
      )}

      {/* Lista */}
      {!isKanban && (!documents || documents.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Inbox className="size-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">
            {q ? `Nessun risultato per "${q}"` : 'Nessun preventivo ancora'}
          </p>
          {!q && (
            <Button asChild className="mt-4" disabled={atLimit}>
              <Link href="/preventivi/nuovo">
                <Plus className="size-4" /> Crea il primo preventivo
              </Link>
            </Button>
          )}
        </div>
      ) : !isKanban ? (
        <div className="divide-y divide-border rounded-lg border bg-card overflow-hidden">
          {(documents ?? []).map((doc) => {
            const client = doc.clients as { id: string; name: string } | null
            const isExpired = doc.expires_at
              && (doc.status === 'sent' || doc.status === 'viewed')
              && new Date(doc.expires_at) < new Date()
            const viewCount = viewCountMap[doc.id] ?? 0

            return (
              <Link
                key={doc.id}
                href={`/preventivi/${doc.id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors group"
              >
                <FileText className="size-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-semibold text-sm group-hover:text-primary transition-colors shrink-0">
                      {doc.doc_number ?? '—'}
                    </span>
                    {doc.title && (
                      <span className="text-sm text-muted-foreground truncate">
                        {doc.title}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    {client && <span>{client.name}</span>}
                    {client && <span>·</span>}
                    <span>
                      {new Date(doc.created_at!).toLocaleDateString('it-IT', {
                        day: '2-digit', month: 'short', year: 'numeric'
                      })}
                    </span>
                    {isExpired && (
                      <>
                        <span>·</span>
                        <span className="text-amber-600">Scaduto</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {viewCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Eye className="size-3.5" />
                      {viewCount}
                    </span>
                  )}
                  <span className="font-semibold">
                    €{(doc.total ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </span>
                  <StatusBadge status={isExpired ? 'expired' : doc.status} showTooltip={false} />
                </div>
              </Link>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
