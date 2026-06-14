import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Inbox, Download, Plus, FileInput, MoreVertical, ArrowUpDown } from 'lucide-react'
import { AdvancedFilters } from '../preventivi/_components/AdvancedFilters'
import { SearchBar } from '@/components/shared/SearchBar'
import { StatusBadge } from '../preventivi/_components/StatusBadge'
import { formatDocNumber } from '@/lib/utils'
import { getContextualDate } from '@/lib/utils/document-date'

export const metadata = { title: 'Fatture' }

interface Props {
  searchParams: Promise<{ q?: string; status?: string; date_from?: string; date_to?: string; amount_min?: string; amount_max?: string }>
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
  const { q, status, date_from, date_to, amount_min, amount_max } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
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
        .from('workspaces').select('id')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }
  if (!workspace) redirect('/login')

  let query = supabase
    .from('documents')
    .select('id, doc_number, title, status, total, currency, created_at, sent_at, expires_at, accepted_at, updated_at, updated_after_send_at, clients(id, name)')
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'fattura')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

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

    if (statusMatch) {
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
  } else if (!hasFilters && !status) {
    query = query.limit(100)
  }

  const { data: fatture } = await query

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 500, color: 'var(--cc-text)' }}>Fatture</h1>
          <p className="hidden lg:block text-sm text-muted-foreground mt-0.5">
            {(() => {
              const n = fatture?.length ?? 0
              if (q || hasFilters || status) return `${n} ${n === 1 ? 'risultato' : 'risultati'}`
              return `${n} ${n === 1 ? 'fattura' : 'fatture'}`
            })()}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {/* Mobile: ⋮ icon */}
          <a href="/api/fatture/export-csv" download className="lg:hidden" style={{ color: 'var(--cc-text-2)', display: 'flex', alignItems: 'center', padding: 4 }} title="Esporta CSV">
            <MoreVertical size={22} />
          </a>
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
        <SearchBar placeholder="Cerca numero, cliente, stato…" paramName="q" />
      </div>

      {/* ── AZIONI RAPIDE MOBILE (lg:hidden) ── */}
      <div className="flex mb-0 lg:hidden" style={{ gap: 9 }}>
        <Link
          href="/fatture/nuovo"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            background: 'var(--cc-navy)',
            color: '#fff',
            borderRadius: 9,
            padding: '11px 10px',
            fontSize: 14,
            fontWeight: 500,
            textDecoration: 'none',
            boxShadow: 'var(--cc-shadow-btn)',
          }}
        >
          <Plus size={18} strokeWidth={2} />
          Nuova fattura
        </Link>
        <Link
          href="/fatture/nuovo?from=preventivo"
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 7,
            border: '0.5px solid var(--cc-border-strong)',
            color: 'var(--cc-navy)',
            borderRadius: 9,
            padding: '11px 10px',
            fontSize: 14,
            fontWeight: 500,
            textDecoration: 'none',
          }}
        >
          Da preventivo
        </Link>
      </div>

      {/* ── FILTRI ── */}
      <div className="mb-4">
        {/* Tab di stato — testo + sottolineatura sull'attivo, space-between */}
        <div className="cc-tabs" style={{ marginTop: 16, marginBottom: 2 }}>
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

        {/* Sort row mobile */}
        <div className="flex items-center justify-end gap-1.5 py-3 lg:hidden" style={{ paddingTop: 16, paddingBottom: 10 }}>
          <ArrowUpDown size={15} style={{ color: 'var(--cc-text-2)' }} />
          <span style={{ fontSize: 13, color: 'var(--cc-text-2)' }}>
            Ordina: <span style={{ fontWeight: 500, color: 'var(--cc-text)' }}>Più recenti</span>
          </span>
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
      {!fatture || fatture.length === 0 ? (
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
          {fatture.map((ft) => {
            const client = ft.clients as { id: string; name: string } | null
            const isModified = !!(ft as Record<string, unknown>).updated_after_send_at
            const dateInfo = getContextualDate(ft, 'fattura')

            return (
              <Link
                key={ft.id}
                href={`/fatture/${ft.id}`}
                className="cc-card"
                style={{ display: 'block', textDecoration: 'none', padding: '14px 15px', marginBottom: 12, borderRadius: 9 }}
              >
                {/* Riga 1: numero · cliente | badge stato */}
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
                  <StatusBadge status={ft.status as 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'} docType="fattura" showTooltip={false} />
                </div>

                {/* Riga 2: data contestuale · importo | badge Modificata */}
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 11, gap: 8 }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: dateInfo.urgent ? 'var(--cc-danger)' : 'var(--cc-text-2)' }}>
                    {dateInfo.text}
                    {' · '}
                    <span style={{ fontWeight: 500, color: 'var(--cc-text)' }}>
                      €{(ft.total ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                    </span>
                  </span>
                  {isModified && (
                    <span style={{ fontSize: 11, fontWeight: 500, color: '#7c3aed', background: '#f3e8ff', borderRadius: 999, padding: '2px 7px', flexShrink: 0, whiteSpace: 'nowrap' }}>
                      Modificata
                    </span>
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
