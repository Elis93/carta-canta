import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { SearchBar } from '@/components/shared/SearchBar'
import { Plus, FileText, Inbox, Eye, Download, AlertTriangle } from 'lucide-react'
import { StatusBadge } from './_components/StatusBadge'
import { KanbanView } from './_components/KanbanView'
import { ViewToggle } from './_components/ViewToggle'
import { AdvancedFilters } from './_components/AdvancedFilters'
import { ClientFilter } from './_components/ClientFilter'
import { DocumentRowActions } from './_components/DocumentRowActions'
import { checkFreeBlock, FREE_DOC_LIMIT } from '@/lib/free-trial'

interface Props {
  searchParams: Promise<{ q?: string; status?: string; view?: string; date_from?: string; date_to?: string; amount_min?: string; amount_max?: string; client_id?: string }>
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
  const { q, status, view, date_from, date_to, amount_min, amount_max, client_id } = await searchParams
  const isKanban = view === 'kanban'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, plan, ragione_sociale, name, free_trial_expires_at, sent_quota_used')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .limit(1)
      .maybeSingle()
    if (membership) {
      const { data: mw } = await supabase
        .from('workspaces').select('id, plan, ragione_sociale, name, free_trial_expires_at, sent_quota_used')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }
  if (!workspace) redirect('/login')

  // Query preventivi — ordinamento per anno e numero progressivo (colonne generate),
  // poi created_at come tiebreaker per documenti senza numerazione.
  let query = supabase
    .from('documents')
    .select(`
      id, title, doc_number, status, total, currency,
      created_at, sent_at, expires_at, pdf_downloaded_at,
      clients(id, name, email)
    `)
    .eq('workspace_id', workspace.id)
    .order('doc_year', { ascending: false, nullsFirst: false })
    .order('doc_seq', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (status) query = query.eq('status', status as 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired')
  if (client_id) query = query.eq('client_id', client_id)

  if (date_from && /^\d{4}-\d{2}-\d{2}$/.test(date_from))
    query = query.gte('created_at', `${date_from}T00:00:00.000Z`)
  if (date_to && /^\d{4}-\d{2}-\d{2}$/.test(date_to))
    query = query.lte('created_at', `${date_to}T23:59:59.999Z`)
  if (amount_min && !isNaN(Number(amount_min)))
    query = query.gte('total', Number(amount_min))
  if (amount_max && !isNaN(Number(amount_max)))
    query = query.lte('total', Number(amount_max))

  const hasAdvancedFilters = !!(date_from || date_to || amount_min || amount_max)

  if (q) {
    query = query.textSearch('search_vector', q, { type: 'websearch', config: 'italian' })
  } else if (!hasAdvancedFilters) {
    query = query.limit(50)
  }

  const { data: documents } = await query

  // Lista clienti per il filtro (max 100, ordinati per nome)
  const { data: clientsForFilter } = await supabase
    .from('clients')
    .select('id, name')
    .eq('workspace_id', workspace.id)
    .order('name', { ascending: true })
    .limit(100)

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
    drafts: counts?.filter((d) => d.status === 'draft').length ?? 0,
    sent: counts?.filter((d) => d.status === 'sent' || d.status === 'viewed').length ?? 0,
    viewed: counts?.filter((d) => d.status === 'viewed').length ?? 0,
    accepted: counts?.filter((d) => d.status === 'accepted').length ?? 0,
    valore: counts?.filter((d) => d.status === 'accepted')
      .reduce((s, d) => s + (d.total ?? 0), 0) ?? 0,
  }

  const isFree = workspace.plan === 'free'
  const freeTrialStatus = isFree
    ? checkFreeBlock(workspace)
    : null
  const atLimit = isFree && (freeTrialStatus?.blocked ?? false)

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Preventivi</h1>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">
            {kpi.sent} inviati · {kpi.accepted} accettati{kpi.drafts > 0 ? ` · ${kpi.drafts} bozz${kpi.drafts === 1 ? 'a' : 'e'}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <a href="/api/preventivi/export-csv" download>
              <Download className="size-4" />
              <span className="hidden sm:inline">Esporta CSV</span>
            </a>
          </Button>
          <Button asChild disabled={atLimit}>
            <Link href={client_id ? `/preventivi/nuovo?client_id=${client_id}` : '/preventivi/nuovo'}>
              <Plus className="size-4" />
              <span className="hidden sm:inline">Nuovo preventivo</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Stato trial Free */}
      {isFree && freeTrialStatus?.blocked && freeTrialStatus.reason === 'trial_expired' && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <p>
            <strong>Il periodo di prova è terminato.</strong>{' '}
            Non puoi creare, scaricare o inviare nuovi preventivi.{' '}
            <Link href="/abbonamento" className="font-semibold underline underline-offset-2">
              Passa a Pro
            </Link>{' '}
            per preventivi illimitati.
          </p>
        </div>
      )}
      {isFree && freeTrialStatus?.blocked && freeTrialStatus.reason === 'doc_limit' && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <p>
            <strong>Hai raggiunto il limite di {FREE_DOC_LIMIT} preventivi del piano Free.</strong>{' '}
            Non puoi creare, scaricare o inviare altri preventivi.{' '}
            <Link href="/abbonamento" className="font-semibold underline underline-offset-2">
              Passa a Pro
            </Link>{' '}
            per preventivi illimitati.
          </p>
        </div>
      )}
      {isFree && !freeTrialStatus?.blocked && freeTrialStatus && (
        <div className="rounded-lg border border-muted bg-muted/30 px-4 py-2 text-xs text-muted-foreground">
          Piano Free · {freeTrialStatus.docsUsed}/{FREE_DOC_LIMIT} preventivi inviati
          {freeTrialStatus.daysRemaining !== null && freeTrialStatus.daysRemaining > 0 && (
            <> · {freeTrialStatus.daysRemaining} {freeTrialStatus.daysRemaining === 1 ? 'giorno' : 'giorni'} rimanenti</>
          )}
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
          <nav className="flex items-center gap-1 overflow-x-auto shrink-0 self-start">
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
        <div className={`flex items-center gap-2 flex-wrap ${!isKanban ? 'sm:ml-auto' : ''}`}>
          {!isKanban && (clientsForFilter ?? []).length > 0 && (
            <ClientFilter
              clients={clientsForFilter ?? []}
              currentClientId={client_id}
            />
          )}
          {!isKanban && (
            <div className="w-full sm:w-64">
              <SearchBar placeholder="Cerca preventivo…" paramName="q" />
            </div>
          )}
          {!isKanban && <AdvancedFilters />}
          <ViewToggle
            currentView={isKanban ? 'kanban' : 'list'}
            listHref={status ? `/preventivi?status=${status}` : '/preventivi'}
            kanbanHref="/preventivi?view=kanban"
          />
        </div>
      </div>

      {/* Kanban view */}
      {isKanban && (
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
            const client = doc.clients as { id: string; name: string; email: string | null } | null
            const isExpired = !!(doc.expires_at
              && (doc.status === 'sent' || doc.status === 'viewed')
              && new Date(doc.expires_at) < new Date())
            const viewCount = viewCountMap[doc.id] ?? 0
            const senderName = workspace.ragione_sociale ?? workspace.name ?? ''

            return (
              // Wrapper group per hover dell'icona azioni
              <div key={doc.id} className="relative group">
                <Link
                  href={`/preventivi/${doc.id}`}
                  className="flex items-center gap-3 px-4 pr-12 py-3.5 hover:bg-muted/50 transition-colors"
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
                    <StatusBadge
                      status={isExpired ? 'expired' : doc.status}
                      pdfDownloaded={doc.status === 'draft' && !!(doc as any).pdf_downloaded_at}
                      showTooltip={false}
                    />
                  </div>
                </Link>

                {/* Menu ⋮ — fuori dal Link, sovrapposto in alto a destra */}
                <div className="absolute right-3 top-1/2 -translate-y-1/2 z-10">
                  <DocumentRowActions
                    doc={{
                      id: doc.id,
                      doc_number: doc.doc_number ?? null,
                      title: doc.title ?? null,
                      status: doc.status,
                      client_email: client?.email ?? null,
                    }}
                    senderName={senderName}
                  />
                </div>
              </div>
            )
          })}
        </div>
      ) : null}
    </div>
  )
}
