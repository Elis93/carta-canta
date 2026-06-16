import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { SearchBar } from '@/components/shared/SearchBar'
import { Plus, FileCheck2, Inbox, Eye, Download, AlertTriangle, ArrowUpDown } from 'lucide-react'
import { StatusBadge } from './_components/StatusBadge'
import { AdvancedFilters } from './_components/AdvancedFilters'
import { DocumentRowActions } from './_components/DocumentRowActions'
import { DraftSavedBanner } from './_components/DraftSavedBanner'
import { SortSelect } from './_components/SortSelect'
import { checkFreeBlock, FREE_DOC_LIMIT } from '@/lib/free-trial'
import { formatDocNumber } from '@/lib/utils'
import { getContextualDate } from '@/lib/utils/document-date'

interface Props {
  searchParams: Promise<{ q?: string; status?: string; date_from?: string; date_to?: string; amount_min?: string; amount_max?: string; client_id?: string; bozza?: string; sort?: string }>
}

const STATUS_TABS = [
  { value: '',         label: 'Tutti' },
  { value: 'draft',    label: 'Bozze' },
  { value: 'attesa',   label: 'In attesa' },
  { value: 'accepted', label: 'Accettati' },
  { value: 'rejected', label: 'Rifiutati' },
]

export default async function PreventiviPage({ searchParams }: Props) {
  const { q, status, date_from, date_to, amount_min, amount_max, client_id, bozza, sort } = await searchParams
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

  // Query preventivi — ordinamento configurabile tramite ?sort=
  let query = supabase
    .from('documents')
    .select(`
      id, title, doc_number, status, total, currency,
      created_at, sent_at, expires_at, accepted_at, updated_at, updated_after_send_at,
      clients(id, name, surname, email)
    `)
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'preventivo')
    .is('deleted_at', null)

  // Applica ordinamento
  // DEFAULT (nessun parametro o 'oldest'): "Meno recenti" → updated_at ASC.
  // Così non c'è più il "flip" all'apertura della pagina.
  if (sort === 'recent') {
    query = query.order('updated_at', { ascending: false }) // Ultima modifica
  } else if (sort === 'expiry') {
    query = query
      .order('expires_at', { ascending: true, nullsFirst: false })
      .order('updated_at', { ascending: false })
  } else if (sort === 'amount_desc') {
    query = query.order('total', { ascending: false, nullsFirst: false })
  } else if (sort === 'amount_asc') {
    query = query.order('total', { ascending: true, nullsFirst: false })
  } else {
    // default ('oldest' o nessun parametro): meno recenti per primi
    query = query.order('updated_at', { ascending: true })
  }

  if (status === 'attesa') {
    query = query.in('status', ['sent', 'viewed', 'expired'])
  } else if (status) {
    query = query.eq('status', status as 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired')
  }
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
    // Mappa keyword stato (italiano) → filtro
    const qLow = q.trim().toLowerCase()
    const STATUS_KEYWORDS: Record<string, string | string[]> = {
      'bozza': 'draft', 'bozze': 'draft',
      'inviato': 'sent', 'inviata': 'sent', 'inviati': 'sent',
      'visto': 'viewed', 'vista': 'viewed', 'visti': 'viewed',
      'accettato': 'accepted', 'accettata': 'accepted', 'accettati': 'accepted',
      'rifiutato': 'rejected', 'rifiutata': 'rejected', 'rifiutati': 'rejected',
      'scaduto': 'expired', 'scaduta': 'expired', 'scaduti': 'expired',
      'attesa': ['sent', 'viewed', 'expired'], 'in attesa': ['sent', 'viewed', 'expired'],
    }
    // Ricerca esatta prima, poi prefisso (min 3 caratteri) per es. "inv" → "inviato"
    let statusMatch: string | string[] | undefined = STATUS_KEYWORDS[qLow]
    if (!statusMatch && qLow.length >= 3) {
      for (const [keyword, value] of Object.entries(STATUS_KEYWORDS)) {
        if (keyword.startsWith(qLow)) {
          statusMatch = value
          break
        }
      }
    }
    const MODIFIED_KW = ['modificato', 'modificata', 'modificati', 'modificate']
    const isModifiedSearch = MODIFIED_KW.includes(qLow) || (qLow.length >= 4 && MODIFIED_KW.some(k => k.startsWith(qLow)))
    if (isModifiedSearch) {
      query = query.not('updated_after_send_at', 'is', null)
    } else if (statusMatch) {
      // Ricerca per stato: applica filtro direttamente
      if (Array.isArray(statusMatch)) {
        query = query.in('status', statusMatch as ('sent' | 'viewed' | 'expired')[])
      } else {
        query = query.eq('status', statusMatch as 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired')
      }
    } else {
      // Ricerca testuale: doc_number, titolo, note + nome cliente
      const esc = q.replace(/[%_\\]/g, (c) => `\\${c}`)
      const pat = `%${esc}%`

      // Cerca clienti e voci in parallelo (query indipendenti)
      const [{ data: matchingClients }, { data: matchingItems }] = await Promise.all([
        supabase
          .from('clients')
          .select('id')
          .eq('workspace_id', workspace.id)
          .or(`name.ilike.${pat},surname.ilike.${pat},email.ilike.${pat},piva.ilike.${pat}`)
          .limit(30),
        supabase
          .from('document_items')
          .select('document_id')
          .ilike('description', pat)
          .limit(50),
      ])

      const clientIds = (matchingClients ?? []).map((c) => c.id)
      const itemDocIds = [...new Set((matchingItems ?? []).map((i) => i.document_id))]

      const orParts = [`title.ilike.${pat}`, `doc_number.ilike.${pat}`, `notes.ilike.${pat}`]
      if (clientIds.length > 0) {
        orParts.push(`client_id.in.(${clientIds.join(',')})`)
      }
      if (itemDocIds.length > 0) {
        orParts.push(`id.in.(${itemDocIds.join(',')})`)
      }
      query = query.or(orParts.join(','))
    }
  } else if (!hasAdvancedFilters) {
    query = query.limit(50)
  }

  const { data: documents } = await query

  // Preventivi collegati a una fattura, aperture e KPI — query indipendenti in parallelo
  const docIds = (documents ?? []).map((d) => d.id)
  const [{ data: convertedRows }, { data: viewRows }, { data: counts }] = await Promise.all([
    supabase
      .from('documents')
      .select('origin_document_id, status')
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'fattura')
      .not('origin_document_id', 'is', null),
    docIds.length > 0
      ? supabase
          .from('document_views')
          .select('document_id')
          .in('document_id', docIds)
      : Promise.resolve({ data: [] as Array<{ document_id: string }>, error: null }),
    supabase
      .from('documents')
      .select('status, total')
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'preventivo'),
  ])

  const convertedFattureMap = new Map<string, string>(
    (convertedRows ?? [])
      .filter((r) => r.origin_document_id)
      .map((r) => [r.origin_document_id as string, r.status])
  )

  const viewCountMap = (viewRows ?? []).reduce<Record<string, number>>((acc, v) => {
    acc[v.document_id] = (acc[v.document_id] ?? 0) + 1
    return acc
  }, {})

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
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {bozza === '1' && <DraftSavedBanner />}

      {/* ── BANNER PIANO FREE ── */}
      {isFree && freeTrialStatus?.blocked && freeTrialStatus.reason === 'trial_expired' && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-4">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <p>
            <strong>Il periodo di prova è terminato.</strong>{' '}
            Non puoi creare, scaricare o inviare nuovi preventivi.{' '}
            <Link href="/abbonamento" className="font-semibold underline underline-offset-2">Passa a Pro</Link>{' '}
            per preventivi illimitati.
          </p>
        </div>
      )}
      {isFree && freeTrialStatus?.blocked && freeTrialStatus.reason === 'doc_limit' && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 mb-4">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <p>
            <strong>Hai raggiunto il limite di {FREE_DOC_LIMIT} preventivi gratuiti.</strong>{' '}
            Non puoi creare o inviare altri preventivi.{' '}
            <Link href="/abbonamento" className="font-semibold underline underline-offset-2">Passa a Pro</Link>{' '}
            per preventivi illimitati, AI import e watermark rimovibile.
          </p>
        </div>
      )}
      {isFree && !freeTrialStatus?.blocked && freeTrialStatus && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          background: 'var(--cc-card)', borderRadius: 11, boxShadow: 'var(--cc-shadow)',
          borderLeft: '3px solid #c9a44c', padding: '10px 14px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, color: '#c9a44c' }}>♛</span>
            <span style={{ fontSize: 13, color: 'var(--cc-text-2)' }}>
              <strong style={{ color: 'var(--cc-text)', fontWeight: 600 }}>{freeTrialStatus.docsUsed}/{FREE_DOC_LIMIT}</strong> preventivi gratuiti
            </span>
          </div>
          <Link href="/abbonamento" style={{ fontSize: 13, fontWeight: 600, color: '#c9a44c', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Passa a Pro →
          </Link>
        </div>
      )}

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <h1 style={{ fontSize: 20, fontWeight: 500, color: 'var(--cc-text)' }}>Preventivi</h1>
        <div className="flex items-center gap-2 shrink-0">
          {/* Desktop: Export CSV button + Nuovo preventivo */}
          <Button variant="outline" size="sm" asChild className="hidden lg:flex">
            <a href="/api/preventivi/export-csv" download title="Esporta CSV">
              <Download className="size-4" />
              Esporta CSV
            </a>
          </Button>
          <Button asChild disabled={atLimit} className="hidden lg:flex hover:bg-primary/80 cursor-pointer">
            <Link href={client_id ? `/preventivi/nuovo?client_id=${client_id}` : '/preventivi/nuovo'}>
              <Plus className="size-4" />
              Nuovo preventivo
            </Link>
          </Button>
        </div>
      </div>

      {/* ── KPI CARDS (solo desktop) ── */}
      <div className="hidden lg:grid grid-cols-4 gap-3 mb-4">
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

      {/* ── FILTRI ── */}
      <div className="mb-4">
        {/* Mobile: search sopra i tab */}
        <div className="mb-3 lg:hidden">
          <SearchBar placeholder="Cerca numero, cliente, voce…" paramName="q" />
        </div>

        {/* Tab di stato — stile pill (classi cc-tabs / cc-tab / cc-tab-active) */}
        <div className="cc-tabs cc-filter-scroll" style={{ marginTop: 16, marginBottom: 2 }}>
          {STATUS_TABS.map((tab) => {
            const isActive = (status ?? '') === tab.value
            return (
              <Link
                key={tab.value}
                href={tab.value ? `/preventivi?status=${tab.value}` : '/preventivi'}
                className={isActive ? 'cc-tab-active' : 'cc-tab'}
                style={{ textDecoration: 'none', display: 'block' }}
              >
                {tab.label}
              </Link>
            )
          })}
        </div>

        {/* Mobile: riga Ordina (sotto i tab, allineata a dx) */}
        <div className="flex items-center justify-end gap-1.5 py-4 lg:hidden">
          <ArrowUpDown size={15} style={{ color: 'var(--cc-text-2)' }} />
          <span style={{ fontSize: 13, color: 'var(--cc-text-2)' }}>Ordina:</span>
          <SortSelect currentSort={sort} />
        </div>

        {/* Desktop: Cerca + Filtra + Ordina in una riga */}
        <div className="hidden lg:flex items-center gap-2 flex-wrap mt-3">
          <div className="flex-1 min-w-[140px]">
            <SearchBar placeholder="Cerca per numero, cliente, stato, voce…" paramName="q" />
          </div>
          <AdvancedFilters />
          <SortSelect currentSort={sort} />
        </div>
      </div>

      {/* ── LISTA ── */}
      {(!documents || documents.length === 0) ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Inbox className="size-12 text-muted-foreground/40 mb-4" />
          <p className="text-muted-foreground">
            {(() => {
              const hasActiveFilter = !!(q || status || client_id || hasAdvancedFilters)
              if (q) return `Nessun risultato per "${q}"`
              if (status) {
                const tabLabel = STATUS_TABS.find((t) => t.value === status)?.label
                const STATUS_EMPTY_LABELS: Record<string, string> = {
                  draft:    'Nessuna bozza',
                  attesa:   'Nessun preventivo in attesa',
                  accepted: 'Nessun preventivo accettato',
                  rejected: 'Nessun preventivo rifiutato',
                }
                return STATUS_EMPTY_LABELS[status] ?? `Nessun risultato per "${tabLabel ?? status}"`
              }
              if (hasActiveFilter) return 'Nessun risultato per i filtri selezionati'
              return 'Nessun preventivo ancora'
            })()}
          </p>
          {!q && !status && !client_id && !hasAdvancedFilters && (
            <Button asChild className="mt-4" disabled={atLimit}>
              <Link href="/preventivi/nuovo">
                <Plus className="size-4" /> Crea il primo preventivo
              </Link>
            </Button>
          )}
        </div>
      ) : (
        <div>
          {(documents ?? []).map((doc) => {
            const client = doc.clients as { id: string; name: string | null; surname: string | null; email: string | null } | null
            const clientFullName = client
              ? [client.name, client.surname].filter(Boolean).join(' ')
              : null
            const isExpired = !!(doc.expires_at
              && (doc.status === 'sent' || doc.status === 'viewed')
              && new Date(doc.expires_at) < new Date())
            const dateInfo = getContextualDate(doc, 'preventivo')
            const viewCount = viewCountMap[doc.id] ?? 0
            const senderName = workspace.ragione_sociale ?? workspace.name ?? ''
            const fatturaStatus = convertedFattureMap.get(doc.id)
            const isModified = !!(doc as Record<string, unknown>).updated_after_send_at

            return (
              <div key={doc.id} style={{ position: 'relative', marginBottom: 12 }}>
                {/* Scheda cliccabile — cc-card come Link */}
                <Link
                  href={`/preventivi/${doc.id}`}
                  className="cc-card"
                  style={{ display: 'block', textDecoration: 'none', padding: '14px 50px 14px 15px', borderRadius: 9 }}
                >
                  {/* Riga 1: numero · cliente | badge stato */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                      <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--cc-text)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {doc.doc_number ? formatDocNumber(doc.doc_number) : (
                          <span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--cc-text-3)' }}>Bozza senza numero</span>
                        )}
                      </span>
                      {clientFullName && (
                        <>
                          <span style={{ color: 'var(--cc-text-3)', fontSize: 14, flexShrink: 0 }}>·</span>
                          <span style={{ fontSize: 14, color: 'var(--cc-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {clientFullName}
                          </span>
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <StatusBadge status={isExpired ? 'expired' : doc.status} showTooltip={false} />
                      {isModified && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#2b2b2b', background: '#e9e0f7', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                          Modificato
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Riga 2: data contestuale · importo | info extra desktop */}
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 11, gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: dateInfo.urgent ? 'var(--cc-danger)' : 'var(--cc-text-2)', flexShrink: 0 }}>
                      {dateInfo.text}
                      {' · '}
                      <span style={{ fontWeight: 500, color: 'var(--cc-text)' }}>
                        €{(doc.total ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </span>
                    </span>
                    {fatturaStatus === 'accepted' && (
                      <span className="hidden lg:flex items-center gap-1 text-xs text-emerald-600 font-medium shrink-0">
                        <FileCheck2 className="size-3.5" />Fattura pagata
                      </span>
                    )}
                    {(fatturaStatus === 'sent' || fatturaStatus === 'viewed') && (
                      <span className="hidden lg:flex items-center gap-1 text-xs text-blue-600 font-medium shrink-0">
                        <FileCheck2 className="size-3.5" />Fattura emessa
                      </span>
                    )}
                    {fatturaStatus === 'draft' && (
                      <span className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <FileCheck2 className="size-3.5" />Bozza fattura
                      </span>
                    )}
                    {fatturaStatus === 'rejected' && (
                      <span className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground line-through shrink-0">
                        <FileCheck2 className="size-3.5" />Fattura annullata
                      </span>
                    )}
                    {viewCount > 0 && (
                      <span className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Eye className="size-3.5" />{viewCount}
                      </span>
                    )}
                  </div>
                </Link>

                {/* Menu ⋮ — fuori dal Link, sovrapposto in basso a destra */}
                <div style={{ position: 'absolute', right: 12, bottom: 12, zIndex: 10 }}>
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
      )}
    </div>
  )
}

