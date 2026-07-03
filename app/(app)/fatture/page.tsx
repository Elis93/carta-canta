import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Inbox, Download, Plus, FileInput, ArrowUpDown } from 'lucide-react'
import { AdvancedFilters } from '../preventivi/_components/AdvancedFilters'
import { SearchBar } from '@/components/shared/SearchBar'
import { StatusBadge } from '../preventivi/_components/StatusBadge'
import { DocumentRowActions } from '../preventivi/_components/DocumentRowActions'
import { SortSelect } from '../preventivi/_components/SortSelect'
import { formatDocNumber } from '@/lib/utils'
import { getContextualDate } from '@/lib/utils/document-date'

export const metadata = { title: 'Fatture' }

interface Props {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; date_from?: string; date_to?: string; amount_min?: string; amount_max?: string }>
}

// Mapping keyword italiano → valore status (con prefisso per ricerca parziale)
const FATTURA_STATUS_KEYWORDS: Record<string, string | string[]> = {
  'bozza': 'draft', 'bozze': 'draft',
  'inviata': 'sent', 'inviato': 'sent', 'inviati': 'sent',
  'aperta': 'viewed', 'aperto': 'viewed',
  'pagata': 'accepted', 'pagato': 'accepted', 'pagati': 'accepted', 'pagamento': 'accepted',
  'annullata': 'rejected', 'annullato': 'rejected',
  'scaduta': 'expired', 'scaduto': 'expired',
}

const STATUS_TABS = [
  { value: '',         label: 'Tutte' },
  { value: 'draft',    label: 'Bozze' },
  { value: 'inviate',  label: 'Inviate' },
  { value: 'accepted', label: 'Pagate' },
  { value: 'rejected', label: 'Annullate' },
]

const STATUS_EMPTY_LABELS: Record<string, string> = {
  draft:    'Nessuna bozza',
  inviate:  'Nessuna fattura inviata',
  accepted: 'Nessuna fattura pagata',
  rejected: 'Nessuna fattura annullata',
}

export default async function FatturePage({ searchParams }: Props) {
  const { q, status, sort, date_from, date_to, amount_min, amount_max } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, ragione_sociale')
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
        .from('workspaces').select('id, name, ragione_sociale')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }
  if (!workspace) redirect('/login')

  let query = supabase
    .from('documents')
    .select('id, doc_number, title, status, total, currency, created_at, sent_at, expires_at, accepted_at, updated_at, updated_after_send_at, clients(id, name, email)')
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'fattura')
    .is('deleted_at', null)

  // Ordinamento — default 'oldest' (updated_at ASC), coerente con Preventivi
  if (sort === 'recent') {
    query = query.order('updated_at', { ascending: false })
  } else if (sort === 'expiry') {
    query = query
      .order('expires_at', { ascending: true, nullsFirst: false })
      .order('updated_at', { ascending: false })
  } else if (sort === 'amount_desc') {
    query = query.order('total', { ascending: false, nullsFirst: false })
  } else if (sort === 'amount_asc') {
    query = query.order('total', { ascending: true, nullsFirst: false })
  } else {
    query = query.order('updated_at', { ascending: true })
  }

  if (date_from && /^\d{4}-\d{2}-\d{2}$/.test(date_from))
    query = query.gte('created_at', `${date_from}T00:00:00.000Z`)
  if (date_to && /^\d{4}-\d{2}-\d{2}$/.test(date_to))
    query = query.lte('created_at', `${date_to}T23:59:59.999Z`)
  if (amount_min && !isNaN(Number(amount_min)))
    query = query.gte('total', Number(amount_min))
  if (amount_max && !isNaN(Number(amount_max)))
    query = query.lte('total', Number(amount_max))

  const hasFilters = !!(date_from || date_to || amount_min || amount_max)

  // Filtro tab di stato (AND con q/filtri avanzati)
  if (status === 'inviate') {
    query = query.in('status', ['sent', 'viewed'])
  } else if (status) {
    query = query.eq('status', status as 'draft' | 'accepted' | 'rejected')
  }

  if (q && q.length > 0) {
    const qLow = q.trim().toLowerCase()

    // Ricerca per stato: esatta poi prefisso (min 2 caratteri)
    let statusMatch: string | string[] | undefined = FATTURA_STATUS_KEYWORDS[qLow]
    if (!statusMatch && qLow.length >= 2) {
      for (const [keyword, value] of Object.entries(FATTURA_STATUS_KEYWORDS)) {
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
      if (Array.isArray(statusMatch)) {
        query = query.in('status', statusMatch as ('sent' | 'viewed')[])
      } else {
        query = query.eq('status', statusMatch as 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired')
      }
    } else if (q.length > 1) {
      const pat = `%${q.trim()}%`

      // Cerca clienti e voci in parallelo — query indipendenti
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

      // Costruisci OR: numero, titolo, note, client ids, voci ids
      const orParts: string[] = [
        `doc_number.ilike.${pat}`,
        `title.ilike.${pat}`,
        `notes.ilike.${pat}`,
      ]
      if (clientIds.length > 0) {
        orParts.push(`client_id.in.(${clientIds.join(',')})`)
      }
      if (itemDocIds.length > 0) {
        orParts.push(`id.in.(${itemDocIds.join(',')})`)
      }

      query = query.or(orParts.join(','))
    }
  } else if (sort === 'expiry' && !hasFilters && !status) {
    query = query.limit(200)
  } else if (!hasFilters && !status) {
    query = query.limit(100)
  }

  const { data: fatture } = await query

  // Per "Scadenza vicina": prima le fatture in attesa di pagamento (sent/viewed/expired)
  // per expires_at ASC, poi le altre (pagate/annullate/bozze) per updated_at DESC —
  // stessa logica della lista Preventivi (il DB non supporta ORDER BY CASE via Supabase).
  const PENDING_STATUSES = new Set(['sent', 'viewed', 'expired'])
  const displayFatture = (sort === 'expiry' && fatture)
    ? [...fatture].sort((a, b) => {
        const aPending = PENDING_STATUSES.has(a.status)
        const bPending = PENDING_STATUSES.has(b.status)
        if (aPending && !bPending) return -1
        if (!aPending && bPending) return 1
        if (aPending && bPending) {
          if (!a.expires_at && !b.expires_at) return 0
          if (!a.expires_at) return 1
          if (!b.expires_at) return -1
          return new Date(a.expires_at!).getTime() - new Date(b.expires_at!).getTime()
        }
        return new Date(b.updated_at!).getTime() - new Date(a.updated_at!).getTime()
      })
    : fatture ?? []

  const senderName = workspace.ragione_sociale ?? workspace.name ?? ''

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      {/* Mobile: fascia bianca titolo pagina */}
      <div className="lg:hidden -mx-4 -mt-4 mb-4" style={{ background: '#fff', borderBottom: '0.5px solid var(--cc-border-color)', padding: '15px 15px 13px' }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--cc-text)' }}>Fatture</h1>
      </div>

      {/* ── HEADER (desktop only) ── */}
      <div className="hidden lg:flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: 'var(--cc-text)' }}>Fatture</h1>
          <p className="hidden lg:block text-sm text-muted-foreground mt-0.5">
            {(() => {
              const n = fatture?.length ?? 0
              if (q || hasFilters || status) return `${n} ${n === 1 ? 'risultato' : 'risultati'}`
              return `${n} ${n === 1 ? 'fattura' : 'fatture'}`
            })()}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Desktop: bottoni */}
          <Button variant="outline" size="sm" asChild className="hidden lg:flex">
            <Link href="/fatture/nuovo?from=preventivo" title="Importa da preventivo">
              <FileInput className="size-4" />
              <span>Importa da preventivo</span>
            </Link>
          </Button>
          <Button size="sm" asChild className="hidden lg:flex hover:bg-primary/80 cursor-pointer">
            <Link href="/fatture/nuovo" title="Nuova fattura">
              <Plus className="size-4" />
              Nuova fattura
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild className="hidden lg:flex">
            <a href="/api/fatture/export-csv" download title="Esporta CSV">
              <Download className="size-4" />
              <span>Esporta CSV</span>
            </a>
          </Button>
        </div>
      </div>

      {/* ── SEARCH MOBILE (sopra i bottoni, lg:hidden) ── */}
      <div className="mb-3 lg:hidden">
        <SearchBar placeholder="Cerca numero, cliente, voce…" paramName="q" />
      </div>

      {/* ── AZIONI RAPIDE MOBILE (lg:hidden) ── */}
      <div className="lg:hidden" style={{ display: 'flex', gap: 10, padding: '2px 0 8px' }}>
        <Link
          href="/fatture/nuovo?from=preventivo"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: 'var(--cc-navy)',
            color: '#fff',
            borderRadius: 14,
            padding: '13px 10px',
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: '0 4px 14px -5px rgba(26,26,46,.42)',
          }}
        >
          <FileInput size={18} />
          Da preventivo
        </Link>
        <Link
          href="/fatture/nuovo"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            background: '#fff',
            color: 'var(--cc-navy)',
            border: '1px solid #ededf0',
            borderRadius: 14,
            padding: '13px 10px',
            fontSize: 14,
            fontWeight: 600,
            textDecoration: 'none',
            boxShadow: 'var(--cc-shadow)',
          }}
        >
          <Plus size={18} />
          Nuova fattura
        </Link>
      </div>

      {/* ── FILTRI ── */}
      <div className="mb-4">
        {/* Tab di stato — stile pill */}
        <div className="cc-tabs cc-filter-scroll" style={{ marginTop: 16, marginBottom: 2 }}>
          {STATUS_TABS.map((tab) => {
            const isActive = (status ?? '') === tab.value
            return (
              <Link
                key={tab.value}
                href={tab.value ? `/fatture?status=${tab.value}` : '/fatture'}
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

        {/* Cerca + Filtra (desktop) */}
        <div className="hidden lg:flex items-center gap-2 flex-wrap mt-3">
          <div className="flex-1 min-w-[140px]">
            <SearchBar placeholder="Cerca per numero, cliente, stato, voce…" paramName="q" />
          </div>
          <AdvancedFilters basePath="/fatture" />
        </div>
      </div>

      {/* ── LISTA ── */}
      {displayFatture.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Inbox className="size-12 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            {q
              ? `Nessun risultato per "${q}"`
              : status
                ? (STATUS_EMPTY_LABELS[status] ?? 'Nessuna fattura in questo stato')
                : hasFilters
                  ? 'Nessun risultato per i filtri selezionati'
                  : <>Nessuna fattura ancora.<br />Converti un preventivo accettato in fattura per iniziare.</>}
          </p>
          {!q && !status && !hasFilters && (
            <Button asChild variant="outline" size="sm">
              <Link href="/preventivi?status=accepted">Vai ai preventivi accettati →</Link>
            </Button>
          )}
        </div>
      ) : (
        <div>
          {displayFatture.map((ft) => {
            const client = ft.clients as { id: string; name: string; email: string | null } | null
            const isModified = !!(ft as Record<string, unknown>).updated_after_send_at
            const dateInfo = getContextualDate(ft, 'fattura')

            return (
              <div key={ft.id} style={{ position: 'relative', marginBottom: 16 }}>
                <Link
                  href={`/fatture/${ft.id}`}
                  className="cc-card"
                  style={{ display: 'block', textDecoration: 'none', padding: '14px 50px 14px 15px', borderRadius: 9 }}
                >
                  {/* Riga 1: numero · cliente | badge stato + Modificata */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                      <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--cc-text)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {ft.doc_number ? formatDocNumber(ft.doc_number, 'fattura') : (
                          <span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--cc-text-3)' }}>Bozza senza numero</span>
                        )}
                      </span>
                      {client && (
                        <>
                          <span style={{ color: 'var(--cc-text-3)', fontSize: 14, flexShrink: 0 }}>·</span>
                          <span style={{ fontSize: 14, color: 'var(--cc-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {client.name}
                          </span>
                        </>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <StatusBadge status={ft.status as 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'} docType="fattura" showTooltip={false} />
                      {isModified && (
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#2b2b2b', background: '#e9e0f7', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap' }}>
                          Modificata
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Riga 2: data contestuale · importo */}
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 11, gap: 8 }}>
                    <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: dateInfo.urgent ? 'var(--cc-danger)' : 'var(--cc-text-2)' }}>
                      {dateInfo.text}
                      {' · '}
                      <span style={{ fontWeight: 500, color: 'var(--cc-text)' }}>
                        €{(ft.total ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </span>
                    </span>
                  </div>
                </Link>

                {/* Azioni ⋮ — fuori dal Link per evitare navigazione al tap */}
                <div style={{ position: 'absolute', top: 10, right: 6 }}>
                  <DocumentRowActions
                    doc={{
                      id: ft.id,
                      doc_number: ft.doc_number,
                      title: ft.title,
                      status: ft.status,
                      client_email: client?.email ?? null,
                    }}
                    senderName={senderName}
                    docType="fattura"
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
