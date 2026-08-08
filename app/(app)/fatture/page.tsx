import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { Button } from '@/components/ui/button'
import { Inbox, Download, Plus, FileInput, ArrowUpDown, FileCheck2 } from 'lucide-react'
import { AdvancedFilters } from '../preventivi/_components/AdvancedFilters'
import { SearchBar } from '@/components/shared/SearchBar'
import { ExportCommercialistaButton } from '@/components/shared/ExportCommercialistaButton'
import { StatusBadge } from '../preventivi/_components/StatusBadge'
import { DocumentRowActions } from '../preventivi/_components/DocumentRowActions'
import { archivioDisponibile } from '@/lib/documents/archivio'
import { SortSelect } from '../preventivi/_components/SortSelect'
import { ListPager } from '../_components/ListPager'
import { DraftSavedBanner } from '../preventivi/_components/DraftSavedBanner'
import { formatDocNumber } from '@/lib/utils'
import { getContextualDate } from '@/lib/utils/document-date'
import { statusesFromQuery, coreQuery, sdiEsitoQuery, FATTURA_STATUS_KEYWORDS } from '@/lib/documents/status-search'
import { CsvDownloadButton } from '@/components/shared/CsvDownloadButton'

export const metadata = { title: 'Fatture' }

interface Props {
  searchParams: Promise<{ q?: string; status?: string; sort?: string; date_from?: string; date_to?: string; amount_min?: string; amount_max?: string; bozza?: string; page?: string }>
}

// Mapping keyword italiano → valore status (con prefisso per ricerca parziale)
// FATTURA_STATUS_KEYWORDS ora vive in lib/documents/status-search.ts
// (fonte unica: la usa anche la ricerca "fattura collegata" dei preventivi)

// Dicitura SdI in lista con l'ESITO leggibile (Eli 3 ago sera/notte) — stesso
// stile della "fattura collegata" nella lista preventivi (testo colorato con
// iconcina, non un badge). Stesse diciture della card SdI: consegnata = verde,
// inviata = blu,
// emessa da ritirare = ambra, scartata = rosso.
const SDI_LABEL: Record<string, { text: string; color: string }> = {
  'inviata':          { text: 'SdI · Inviata',    color: '#3f6fb0' },
  'consegnata':       { text: 'SdI · Consegnata', color: '#2f8a63' },
  'mancata_consegna': { text: 'SdI · Emessa',     color: '#b0863e' },
  'scartata':         { text: 'SdI · Scartata',   color: '#b05656' },
}

const STATUS_TABS = [
  { value: '',         label: 'Tutte' },
  { value: 'draft',    label: 'Bozze' },
  { value: 'inviate',  label: 'Inviate' },
  { value: 'accepted', label: 'Pagate' },
  { value: 'rejected', label: 'Annullate' },
  // «Archiviate» in fondo: è il posto dove si va a cercare, non uno stato in cui
  // si lavora. ⚠️ Non è uno stato del documento — è un filtro a sé (075).
  { value: 'archiviati', label: 'Archiviate' },
]

const STATUS_EMPTY_LABELS: Record<string, string> = {
  draft:    'Nessuna bozza',
  inviate:  'Nessuna fattura inviata',
  accepted: 'Nessuna fattura pagata',
  rejected: 'Nessuna fattura annullata',
  archiviati: 'Nessuna fattura archiviata',
}

export default async function FatturePage({ searchParams }: Props) {
  const { q, status, sort: sortParam, date_from, date_to, amount_min, amount_max, bozza, page: pageParam } = await searchParams
  const PAGE_SIZE = 20
  const requestedPage = Math.max(1, Math.floor(Number(pageParam)) || 1)
  // Preferenza di ordinamento: ?sort= nell'URL, altrimenti il cookie di sessione
  // scritto da SortSelect (letto server-side → niente riordino visibile post-mount).
  const VALID_SORTS = ['recent', 'oldest', 'expiry', 'number_desc', 'number_asc', 'amount_desc', 'amount_asc']
  const savedSort = (await cookies()).get('cc_sort_fatture')?.value
  const sort = sortParam ?? (savedSort && VALID_SORTS.includes(savedSort) ? savedSort : undefined)
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/login')

  // ARCHIVIO (075) — gemello della lista preventivi: la pillola «Archiviate»
  // mostra SOLO le archiviate, tutte le altre le nascondono. Il filtro va in
  // SQL perché la paginazione conta le righe lato database; la sonda tiene in
  // piedi la lista finché la migration non è applicata.
  const soloArchiviati = status === 'archiviati'
  const archivioOk = await archivioDisponibile(supabase)

  let query = supabase
    .from('documents')
    .select('id, doc_number, title, status, total, currency, created_at, sent_at, expires_at, accepted_at, updated_at, updated_after_send_at, clients(id, name, email)', { count: 'exact' })
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
  } else if (sort === 'number_desc' || sort === 'number_asc') {
    // F5: per numero documento (colonne numeriche doc_year+doc_seq;
    // i rari senza numero in fondo in entrambi i versi)
    const asc = sort === 'number_asc'
    query = query
      .order('doc_year', { ascending: asc, nullsFirst: false })
      .order('doc_seq', { ascending: asc, nullsFirst: false })
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

  if (archivioOk) {
    query = soloArchiviati
      ? query.not('archived_at', 'is', null)
      : query.is('archived_at', null)
  }

  // Filtro tab di stato (AND con q/filtri avanzati)
  if (status === 'inviate') {
    // 'expired' incluso: una fattura oltre scadenza resta da incassare
    // (stessa scelta del tab "In attesa" dei preventivi)
    query = query.in('status', ['sent', 'viewed', 'expired'])
  } else if (status && !soloArchiviati) {
    query = query.eq('status', status as 'draft' | 'accepted' | 'rejected')
  }

  if (q && q.length > 0) {
    const qLow = q.trim().toLowerCase()

    // Ricerca per stato tokenizzata (punto 10, 3 ago): anche le DICITURE
    // composte ("fattura annullata", "bozza fattura") e i plurali/prefissi
    // ("annullate", "annull") filtrano per stato. La logica pura (testata)
    // vive in lib/documents/status-search.ts; qCore = query senza le parole
    // generiche, per i check sdi/modificata ("fatture sdi" = "sdi").
    const statusList = statusesFromQuery(qLow, FATTURA_STATUS_KEYWORDS, 2)
    const qCore = coreQuery(qLow)

    const MODIFIED_KW = ['modificato', 'modificata', 'modificati', 'modificate']
    const isModifiedSearch = MODIFIED_KW.includes(qCore) || (qCore.length >= 4 && MODIFIED_KW.some(k => k.startsWith(qCore)))
    // Ricerca SdI (28 lug, estesa 3 ago sera con l'ESITO): "sdi" = tutte le
    // trasmesse; "sdi consegnata"/"sdi scartate"/"sdi emessa" = quell'esito.
    // Pre-044 (colonna assente) la query risponde vuota: degrado innocuo.
    const sdiSearch = sdiEsitoQuery(qLow)
    if (sdiSearch) {
      query = query.not('sdi_status', 'is', null)
      if (sdiSearch.esiti) query = query.in('sdi_status', sdiSearch.esiti)
    } else if (isModifiedSearch) {
      query = query.not('updated_after_send_at', 'is', null)
    } else if (statusList) {
      query = query.in('status', statusList as ('draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired')[])
    } else if (q.length > 1) {
      const esc = q.trim().replace(/[,()"]/g, ' ').replace(/[%_\\]/g, (c) => `\\${c}`)
      const pat = `%${esc}%`

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
  }
  // Tetto SEMPRE presente (vedi preventivi): mai query illimitate in lista
  const fattFiltered = hasFilters || !!status
  // Paginazione a livello DB (.range): 20 per pagina, niente più tetto che
  // nascondeva le fatture oltre il cinquecentesimo. `count: 'exact'` dà il
  // totale filtrato per il pager.
  const offset = (requestedPage - 1) * PAGE_SIZE
  query = query.range(offset, offset + PAGE_SIZE - 1)

  const { data: fatture, count, error: listError } = await query
  // Errore di lettura ≠ archivio vuoto (review 4 ago): senza questa guardia
  // un blip di rete mostrava l'empty state "Nessuna fattura ancora".
  if (listError) {
    console.error('[fatture] lettura lista fallita:', listError)
    throw new Error('Non riesco a caricare le fatture. Riprova tra qualche secondo.')
  }
  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  if (requestedPage > totalPages && totalCount > 0) {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries({ q, status, date_from, date_to, amount_min, amount_max, sort: sortParam })) {
      if (v) sp.set(k, v)
    }
    if (totalPages > 1) sp.set('page', String(totalPages))
    const qs = sp.toString()
    redirect(qs ? `/fatture?${qs}` : '/fatture')
  }

  // Badge "SdI" in lista (decisione Eli 28 lug): stato SdI letto A PARTE e in
  // modo tollerante — la select principale resta intatta e pre-044 (colonna
  // assente) l'errore lascia solo la mappa vuota, niente badge e niente crash.
  const sdiById = new Map<string, string>()
  if (fatture && fatture.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonna 044 non ancora in types/database.ts
    const { data: sdiRows } = await (supabase as any)
      .from('documents')
      .select('id, sdi_status')
      .in('id', fatture.map((f) => f.id))
    for (const r of (sdiRows ?? []) as Array<{ id: string; sdi_status: string | null }>) {
      if (r.sdi_status) sdiById.set(r.id, r.sdi_status)
    }
  }

  // ⚠️ Niente riordino in JS, come nella lista Preventivi: con la lista
  // PAGINATA agiva solo sulle righe della pagina corrente e l'ordine saltava
  // fra una pagina e l'altra (Eli, 8 ago). Ordina il database su tutto
  // l'archivio, per `expires_at` crescente.
  const displayFatture = fatture ?? []

  const senderName = workspace.ragione_sociale ?? workspace.name ?? ''

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      {/* Pop-up "Bozza salvata" con numero assegnato (redirect da Nuova fattura) */}
      {bozza && <DraftSavedBanner docNumber={bozza !== '1' ? bozza : null} docType="fattura" />}
      {/* Mobile: fascia bianca titolo pagina */}
      <div className="lg:hidden -mx-4 -mt-4 mb-4 cc-title-band" style={{ padding: '15px 15px 13px' }}>
        <h1 className="cc-page-title" style={{ fontSize: 22 }}>Fatture</h1>
      </div>

      {/* ── HEADER (desktop only) ── */}
      <div className="hidden lg:flex items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="cc-page-title" style={{ fontSize: 22 }}>Fatture</h1>
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
          <CsvDownloadButton endpoint="/api/fatture/export-csv" filename="fatture.csv" />
          <ExportCommercialistaButton />
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

        {/* Mobile: riga Ordina (sotto i tab, allineata a dx) — nel riquadro
            bianco: sul fondo grigio non si vedeva (Eli 18 lug) */}
        <div className="flex items-center justify-end py-4 lg:hidden">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e7e7ea', borderRadius: 11, padding: '7px 11px', boxShadow: '0 1px 2px rgba(20,20,40,.05)' }}>
            <ArrowUpDown size={15} style={{ color: 'var(--cc-text-2)' }} />
            <span style={{ fontSize: 13, color: 'var(--cc-text-2)' }}>Ordina:</span>
            <SortSelect currentSort={sort} />
          </div>
        </div>

        {/* Cerca + Filtra + Ordina (desktop) — l'ordinamento mancava su PC
            (feedback Eli 22 lug #15): allineato ai Preventivi. */}
        <div className="hidden lg:flex items-center gap-2 flex-wrap mt-3">
          <div className="flex-1 min-w-[140px]">
            <SearchBar placeholder="Cerca per numero, cliente, stato, voce…" paramName="q" />
          </div>
          <AdvancedFilters basePath="/fatture" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e7e7ea', borderRadius: 11, padding: '7px 11px' }}>
            <ArrowUpDown size={15} style={{ color: 'var(--cc-text-2)' }} />
            <span style={{ fontSize: 13, color: 'var(--cc-text-2)' }}>Ordina:</span>
            <SortSelect currentSort={sort} />
          </div>
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

                  {/* Riga 2: data contestuale · importo · esito SdI */}
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 11, gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, color: dateInfo.urgent ? 'var(--cc-danger)' : 'var(--cc-text-2)', flexShrink: 0 }}>
                      {dateInfo.text}
                      {' · '}
                      <span style={{ fontWeight: 500, color: 'var(--cc-text)' }}>
                        €{(ft.total ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </span>
                    </span>
                    {/* Esito SdI come dicitura (Eli 3 ago notte: stesso stile
                        della fattura collegata nella lista preventivi, non un
                        badge) — si cerca con "sdi", "sdi consegnata" ecc. */}
                    {(() => {
                      const sdi = sdiById.get(ft.id)
                      if (!sdi) return null
                      const meta = SDI_LABEL[sdi] ?? { text: `SdI · ${sdi}`, color: '#2f8a63' }
                      return (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginLeft: 'auto', fontSize: 11, fontWeight: 600, color: meta.color, whiteSpace: 'nowrap', flexShrink: 0 }}>
                          <FileCheck2 style={{ width: 11, height: 11 }} /> {meta.text}
                        </span>
                      )
                    })()}
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
                    archived={soloArchiviati}
                    docType="fattura"
                  />
                </div>
              </div>
            )
          })}
          <ListPager
            basePath="/fatture"
            params={{ q, status, date_from, date_to, amount_min, amount_max, sort: sortParam }}
            page={requestedPage}
            totalPages={totalPages}
          />
        </div>
      )}
    </div>
  )
}
