import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { ContextHint } from '@/components/shared/ContextHint'
import { Button } from '@/components/ui/button'
import { SearchBar } from '@/components/shared/SearchBar'
import { Plus, FileCheck2, Inbox, Eye, Download, AlertTriangle, ArrowUpDown } from 'lucide-react'
import { StatusBadge } from './_components/StatusBadge'
import { AdvancedFilters } from './_components/AdvancedFilters'
import { DocumentRowActions } from './_components/DocumentRowActions'
import { DraftSavedBanner } from './_components/DraftSavedBanner'
import { SortSelect } from './_components/SortSelect'
import { ListPager } from '../_components/ListPager'
import { ArchivioToggle } from '../_components/ArchivioToggle'
import { CestinoToggle } from '../_components/CestinoToggle'
import { CestinoInline } from '../_components/CestinoInline'
import { checkFreeBlock, FREE_DOC_LIMIT } from '@/lib/free-trial'
import { freeOpenSentIds } from '@/lib/plan/free-lock'
import { formatDocNumber } from '@/lib/utils'
import { getContextualDate } from '@/lib/utils/document-date'
import { statusesFromQuery, coreQuery, linkedFatturaQuery } from '@/lib/documents/status-search'
import { archivioDisponibile } from '@/lib/documents/archivio'
import { CsvDownloadButton } from '@/components/shared/CsvDownloadButton'
import { ordinaPerUrgenza } from '@/lib/documents/ordina-scadenza'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { numeroVarianti } from '@/lib/documents/numero'

interface Props {
  searchParams: Promise<{ q?: string; status?: string; date_from?: string; date_to?: string; amount_min?: string; amount_max?: string; client_id?: string; bozza?: string; sort?: string; page?: string }>
}

const STATUS_TABS = [
  { value: '',         label: 'Tutti' },
  { value: 'draft',    label: 'Bozze' },
  { value: 'attesa',   label: 'In attesa' },
  { value: 'accepted', label: 'Accettati' },
  { value: 'rejected', label: 'Rifiutati' },
  // ⚠️ «Archiviati» NON sta qui (Eli, 8 ago, opzione C del mockup): non è uno
  // stato del documento, è il posto dove l'hai messo — e con sei pillole la
  // riga non ci stava su nessun telefono. È il tasto ArchivioToggle, a
  // sinistra della riga «Ordina».
]

export default async function PreventiviPage({ searchParams }: Props) {
  const { q, status, date_from, date_to, amount_min, amount_max, client_id, bozza, sort: sortParam, page: pageParam } = await searchParams
  // Paginazione: 20 documenti per pagina (?page=, 1-based).
  const PAGE_SIZE = 20
  const requestedPage = Math.max(1, Math.floor(Number(pageParam)) || 1)
  // Preferenza di ordinamento: ?sort= nell'URL, altrimenti il cookie di sessione
  // scritto da SortSelect. Letto SERVER-SIDE così la lista arriva già nell'ordine
  // finale al primo paint (niente riordino visibile dopo il mount).
  const VALID_SORTS = ['recent', 'oldest', 'expiry', 'number_desc', 'number_asc', 'amount_desc', 'amount_asc']
  const savedSort = (await cookies()).get('cc_sort_preventivi')?.value
  const sort = sortParam ?? (savedSort && VALID_SORTS.includes(savedSort) ? savedSort : undefined)
  // Contesto sessione condiviso (memoizzato per richiesta — vedi lib/workspace-context.ts)
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/login')

  // ARCHIVIO (075): il tasto «Archivio» (?status=archiviati) mostra SOLO gli
  // archiviati, tutte
  // le altre li nascondono — altrimenti archiviare non servirebbe a niente.
  // ⚠️ Il filtro va in SQL, non in memoria: la paginazione conta le righe lato
  // database e un filtro applicato dopo darebbe pagine di lunghezza diversa e
  // un pager che promette pagine vuote.
  // La sonda tiene in piedi la lista finché la migration non è applicata: senza,
  // la pagina principale dell'app finirebbe sull'errore di caricamento.
  const soloArchiviati = status === 'archiviati'
  const archivioOk = await archivioDisponibile(supabase)
  // Indirizzo dell'archivio senza la migration (segnalibro, o la voce del
  // cerca): il filtro non si applicherebbe e si vedrebbe la lista INTERA
  // spacciata per archivio. Meglio riportare alla lista, che almeno dice
  // il vero.
  if (soloArchiviati && !archivioOk) redirect('/preventivi')

  // CESTINO (#11, 14 ago): il tab «Cestino» mostra i preventivi eliminati,
  // accanto all'Archivio. È una vista a sé — dati diversi (deleted_at), azioni
  // diverse (ripristina/elimina), client component — quindi NON passa dalla
  // query normale: si esce subito, altrimenti `.eq('status','cestino')`
  // fallirebbe sull'enum. Non dipende dalla migration archivio.
  if (status === 'cestino') {
    return (
      <div className="p-4 lg:p-6 max-w-5xl mx-auto">
        <div className="lg:hidden -mx-4 -mt-4 mb-4 cc-title-band" style={{ padding: '15px 15px 13px' }}>
          <h1 className="cc-page-title" style={{ fontSize: 22 }}>Preventivi</h1>
        </div>
        <div className="hidden lg:flex items-center gap-3 mb-4">
          <h1 className="cc-page-title" style={{ fontSize: 22 }}>Preventivi</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 14 }}>
          {archivioOk && <ArchivioToggle base="/preventivi" attivo={false} />}
          <CestinoToggle base="/preventivi" attivo />
        </div>
        <CestinoInline scope="preventivo" />
      </div>
    )
  }

  // Query preventivi — ordinamento configurabile tramite ?sort=
  let query = supabase
    .from('documents')
    .select(`
      id, title, doc_number, status, total, currency, signer_name, accepted_ip,
      created_at, sent_at, expires_at, accepted_at, updated_at, updated_after_send_at,
      clients(id, name, surname, email)
    `, { count: 'exact' })
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
  } else if (sort === 'number_desc' || sort === 'number_asc') {
    // F5: per numero documento. doc_number è una stringa ("001/2026"): si
    // ordina sulle colonne numeriche doc_year+doc_seq (i rari senza numero
    // finiscono in fondo in entrambi i versi)
    const asc = sort === 'number_asc'
    query = query
      .order('doc_year', { ascending: asc, nullsFirst: false })
      .order('doc_seq', { ascending: asc, nullsFirst: false })
  } else if (sort === 'amount_desc') {
    query = query.order('total', { ascending: false, nullsFirst: false })
  } else if (sort === 'amount_asc') {
    query = query.order('total', { ascending: true, nullsFirst: false })
  } else {
    // default ('oldest' o nessun parametro): meno recenti per primi
    query = query.order('updated_at', { ascending: true })
  }

  // ⚠️ L'ARCHIVIO NASCONDE DALLA NAVIGAZIONE, NON DALLA RICERCA (Eli, 8 ago:
  // "i documenti archiviati non compaiono nei risultati del cerca, è
  // corretto?" — no, non lo era). Chi cerca un nome sta cercando una cosa che
  // sa di avere: rispondergli "nessun risultato" perché l'ha messa via è una
  // bugia. Quando c'è una ricerca in corso l'archivio si apre e i risultati
  // archiviati compaiono con la loro etichetta; sfogliando le pillole, no.
  // (È il modello della posta: archiviare toglie dalla lista, non dal cerca.)
  if (archivioOk && !q) {
    query = soloArchiviati
      ? query.not('archived_at', 'is', null)
      : query.is('archived_at', null)
  } else if (archivioOk && q && soloArchiviati) {
    query = query.not('archived_at', 'is', null)
  }

  if (status === 'attesa') {
    query = query.in('status', ['sent', 'viewed', 'expired'])
  } else if (status && !soloArchiviati) {
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
    // Ricerca per stato tokenizzata (punto 10, 3 ago): anche le DICITURE
    // composte ("preventivo rifiutato", "bozza preventivo") e plurali/prefissi.
    // Logica pura testata in lib/documents/status-search.ts.
    const statusList = statusesFromQuery(qLow, STATUS_KEYWORDS, 3)
    const qCore = coreQuery(qLow)
    const MODIFIED_KW = ['modificato', 'modificata', 'modificati', 'modificate']
    const isModifiedSearch = MODIFIED_KW.includes(qCore) || (qCore.length >= 4 && MODIFIED_KW.some(k => k.startsWith(qCore)))
    // Cerca per parola «archiviati» (075): chi scrive la parola vuole quelli,
    // non un documento che la contiene nel titolo.
    const ARCHIVIO_KW = ['archiviato', 'archiviata', 'archiviati', 'archiviate', 'archivio']
    const isArchivioSearch = archivioOk && (ARCHIVIO_KW.includes(qCore) || (qCore.length >= 5 && ARCHIVIO_KW.some(k => k.startsWith(qCore))))
    // "FATTURA COLLEGATA" (chiarimento Eli 3 ago sera): la parola "fattura"
    // nella ricerca dei preventivi sposta il filtro sulla fattura collegata —
    // "fattura annullata" trova i preventivi con la fattura collegata
    // annullata; "fattura" da sola, quelli con una fattura qualsiasi.
    const linkedFat = linkedFatturaQuery(qLow)
    if (linkedFat) {
      let fq = supabase
        .from('documents')
        .select('origin_document_id')
        .eq('workspace_id', workspace.id)
        .eq('doc_type', 'fattura')
        .is('deleted_at', null)
        .not('origin_document_id', 'is', null)
      if (linkedFat.statuses) {
        fq = fq.in('status', linkedFat.statuses as ('draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired')[])
      }
      const { data: fatRows } = await fq.limit(500)
      const prevIds = [...new Set((fatRows ?? []).map((r) => r.origin_document_id).filter((x): x is string => !!x))]
      // Nessuna fattura corrispondente → nessun preventivo (uuid impossibile:
      // .in con lista vuota non è sintassi valida per PostgREST)
      query = prevIds.length > 0
        ? query.in('id', prevIds)
        : query.eq('id', '00000000-0000-0000-0000-000000000000')
    } else if (isArchivioSearch) {
      query = query.not('archived_at', 'is', null)
    } else if (isModifiedSearch) {
      query = query.not('updated_after_send_at', 'is', null)
    } else if (statusList) {
      // Ricerca per stato: applica filtro direttamente
      query = query.in('status', statusList as ('draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired')[])
    } else {
      // Ricerca testuale: doc_number, titolo, note + nome cliente
      const escapa = (v: string) => v.replace(/[,()"]/g, ' ').replace(/[%_\\]/g, (c) => `\\${c}`)
      const esc = escapa(q)
      const pat = `%${esc}%`
      // Vedi lista Fatture: «NC001» e «NC 001» sono lo stesso documento.
      const numPats = numeroVarianti(q).map((v) => `doc_number.ilike.%${escapa(v)}%`)

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

      const orParts = [`title.ilike.${pat}`, ...numPats, `notes.ilike.${pat}`]
      if (clientIds.length > 0) {
        orParts.push(`client_id.in.(${clientIds.join(',')})`)
      }
      if (itemDocIds.length > 0) {
        orParts.push(`id.in.(${itemDocIds.join(',')})`)
      }
      query = query.or(orParts.join(','))
    }
  }
  // Paginazione a livello DB (.range): niente più tetto a 500 che nascondeva
  // i documenti oltre il cinquecentesimo. `count: 'exact'` (sul select) dà il
  // totale filtrato per costruire il pager.
  const offset = (requestedPage - 1) * PAGE_SIZE

  // ⚠️ «Scadenza più vicina» NON si può paginare nel database: l'ordine è per
  // fascia di urgenza (scadute → in attesa → bozze → chiuse → annullate) e
  // PostgREST non sa ordinare per un'espressione. Quindi per QUESTO
  // ordinamento si leggono tutte le righe filtrate, si ordina, e SOLO DOPO si
  // taglia la pagina — altrimenti si riordinerebbe la sola finestra che si sta
  // guardando, che è il difetto dell'8 agosto e non è un ordinamento.
  // Costo: qualche lettura in più su un solo ordinamento; correttezza in
  // cambio. Gli altri ordinamenti restano paginati dal database.
  type RigaLista = NonNullable<Awaited<typeof query>['data']>[number]
  let documents: RigaLista[] | null = null
  let count: number | null = null
  let listError: unknown = null
  if (sort === 'expiry') {
    const { data: tutte, error } = await fetchAllRows<RigaLista>(() => query)
    listError = error
    if (!error) {
      const ordinate = ordinaPerUrgenza((tutte ?? []) as Array<RigaLista & { status: string }>)
      count = ordinate.length
      documents = ordinate.slice(offset, offset + PAGE_SIZE)
    }
  } else {
    const res = await query.range(offset, offset + PAGE_SIZE - 1)
    documents = res.data
    count = res.count
    listError = res.error
  }
  // Errore di lettura ≠ archivio vuoto (review 4 ago): senza questa guardia
  // un blip di rete mostrava l'empty state "Nessun preventivo ancora".
  if (listError) {
    console.error('[preventivi] lettura lista fallita:', listError)
    throw new Error('Non riesco a caricare i preventivi. Riprova tra qualche secondo.')
  }
  const totalCount = count ?? 0
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  // Link stantio a una pagina che non esiste più (dopo cancellazioni): manda
  // all'ultima pagina valida invece di mostrare una lista vuota.
  if (requestedPage > totalPages && totalCount > 0) {
    const sp = new URLSearchParams()
    for (const [k, v] of Object.entries({ q, status, date_from, date_to, amount_min, amount_max, client_id, sort: sortParam })) {
      if (v) sp.set(k, v)
    }
    if (totalPages > 1) sp.set('page', String(totalPages))
    const qs = sp.toString()
    redirect(qs ? `/preventivi?${qs}` : '/preventivi')
  }

  // Preventivi collegati a una fattura, aperture e KPI — query indipendenti in parallelo
  const docIds = (documents ?? []).map((d) => d.id)
  // Quali righe di QUESTA pagina sono archiviate: serve solo quando la ricerca
  // le fa comparire fuori dalla loro pillola. ⚠️ Query a sé e tollerante — la
  // colonna NON entra nella select principale, che deve restare tipizzata (e
  // funzionare anche senza la migration).
  const archiviatiIds = new Set(
    q && archivioOk && docIds.length > 0
      ? await supabase
          .from('documents')
          .select('id')
          .in('id', docIds)
          .not('archived_at', 'is', null)
          .then((r) => (r.data ?? []).map((x) => x.id), () => [] as string[])
      : []
  )
  // Downgrade Pro→Free: i preventivi INVIATI oltre i primi 8 sono in sola
  // lettura. `freeOpenSentIds` ritorna null sui piani a pagamento → nessun
  // blocco. Le bozze restano sempre aperte.
  const openSentPrev = await freeOpenSentIds(supabase, workspace, 'preventivo')
  const bloccatiIds = new Set(
    openSentPrev
      ? (documents ?? [])
          .filter((d) => d.status !== 'draft' && !openSentPrev.has(d.id))
          .map((d) => d.id)
      : []
  )
  const [{ data: convertedRows }, { data: viewRows }, { data: counts }, { count: catalogCount }] = await Promise.all([
    supabase
      .from('documents')
      .select('origin_document_id, status, doc_number')
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'fattura')
      .is('deleted_at', null)
      .not('origin_document_id', 'is', null),
    docIds.length > 0
      ? supabase
          .from('document_views')
          .select('document_id')
          .in('document_id', docIds)
      : Promise.resolve({ data: [] as Array<{ document_id: string }>, error: null }),
    // Conteggi dei tab: gli archiviati NON contano (il tab che li mostra ha il
    // suo numero a parte), altrimenti «Tutti: 40» e una lista di 32 righe.
    // ⚠️ fetchAllRows: oltre le 1.000 righe una select secca viene TRONCATA
    // in silenzio e i numeri dei tab direbbero meno del vero (follow-up 4 ago).
    fetchAllRows<{ status: string; total: number | null }>(() =>
      archivioOk
        ? supabase
            .from('documents')
            .select('status, total')
            .eq('workspace_id', workspace.id)
            .eq('doc_type', 'preventivo')
            .is('deleted_at', null)
            .is('archived_at', null)
        : supabase
            .from('documents')
            .select('status, total')
            .eq('workspace_id', workspace.id)
            .eq('doc_type', 'preventivo')
            .is('deleted_at', null)),
    // Hint "salva nel Catalogo" (progressive disclosure, 2 ago): serve solo
    // sapere se il catalogo è VUOTO — conteggio head, zero righe scaricate
    supabase
      .from('catalog_items')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id),
  ])

  const convertedFattureMap = new Map<string, { docNumber: string | null; status: string }>(
    (convertedRows ?? [])
      .filter((r) => r.origin_document_id)
      .map((r) => [r.origin_document_id as string, { docNumber: r.doc_number ?? null, status: r.status }])
  )

  const viewCountMap = (viewRows ?? []).reduce<Record<string, number>>((acc, v) => {
    acc[v.document_id] = (acc[v.document_id] ?? 0) + 1
    return acc
  }, {})

  const kpi = {
    total: counts?.length ?? 0,
    drafts: counts?.filter((d) => d.status === 'draft').length ?? 0,
    // Allineato al tab "In attesa" (sent+viewed+expired)
    sent: counts?.filter((d) => ['sent', 'viewed', 'expired'].includes(d.status)).length ?? 0,
    viewed: counts?.filter((d) => d.status === 'viewed').length ?? 0,
    accepted: counts?.filter((d) => d.status === 'accepted').length ?? 0,
    valore: counts?.filter((d) => d.status === 'accepted')
      .reduce((s, d) => s + (d.total ?? 0), 0) ?? 0,
  }

  // ⚠️ NIENTE riordino in JS per "Scadenza vicina" (Eli, 8 ago: "non capisco
  // come funziona l'ordina per scadenza vicina, secondo me c'è qualcosa di
  // sbagliato" — e aveva ragione).
  // Qui c'era un sort che metteva davanti i documenti in attesa e in fondo gli
  // altri. Funzionava finché la lista era unica; da quando è PAGINATA (4 ago)
  // agiva solo sulle 20 righe della pagina corrente, quindi la pagina 1 finiva
  // con documenti accettati di maggio e la pagina 2 ricominciava da scadenze di
  // agosto: l'ordine, guardando due pagine di fila, non aveva più senso.
  // Ora ordina il DATABASE, per `expires_at` crescente su TUTTO l'archivio:
  // l'ordine è quello promesso dall'etichetta e regge fra una pagina e l'altra.
  const displayDocuments = documents ?? []

  const isFree = workspace.plan === 'free'
  const freeTrialStatus = isFree
    ? checkFreeBlock(workspace)
    : null
  const atLimit = isFree && (freeTrialStatus?.blocked ?? false)

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto">
      {/* Mobile: fascia bianca titolo pagina */}
      <div className="lg:hidden -mx-4 -mt-4 mb-4 cc-title-band" style={{ padding: '15px 15px 13px' }}>
        <h1 className="cc-page-title" style={{ fontSize: 22 }}>Preventivi</h1>
      </div>

      {bozza && <DraftSavedBanner docNumber={bozza !== '1' ? bozza : null} />}

      {/* ── BANNER PIANO FREE ── */}
      {isFree && freeTrialStatus?.blocked && freeTrialStatus.reason === 'trial_expired' && (
        <div className="flex items-start gap-3 rounded-lg border border-[#ecc9c9] bg-[#f5dede] px-4 py-3 text-sm text-[#b05656] mb-4">
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
        <div className="flex items-start gap-3 rounded-lg border border-[#ecc9c9] bg-[#f5dede] px-4 py-3 text-sm text-[#b05656] mb-4">
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

      {/* ── HEADER (desktop only) ── */}
      <div className="hidden lg:flex items-center justify-between gap-3 mb-4">
        <h1 className="cc-page-title" style={{ fontSize: 22 }}>Preventivi</h1>
        <div className="flex items-center gap-2 shrink-0">
          {/* Desktop: Export CSV button + Nuovo preventivo */}
          <CsvDownloadButton endpoint="/api/preventivi/export-csv" filename="preventivi.csv" />
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

        {/* Hint una-tantum (progressive disclosure, 2 ago): chi ha già scritto
            3+ preventivi a mano col catalogo vuoto risparmierebbe tempo vero */}
        {!q && !status && (documents?.length ?? 0) >= 3 && (catalogCount ?? 0) === 0 && (
          <div style={{ marginTop: 12 }}>
            <ContextHint id="salva-catalogo">
              Scrivi spesso le stesse voci? Salvale nel <Link href="/catalogo" style={{ fontWeight: 600, color: '#6b5626', textDecoration: 'underline' }}>Catalogo</Link>:{' '}nel preventivo le peschi con un tocco da &laquo;Da catalogo&raquo;.
            </ContextHint>
          </div>
        )}

        {/* ⚠️ DUE superfici SEPARATE, non una barra sola (Eli, 9 ago: *"perché
            la sezione archivio è diventata un tutt'uno con l'Ordina? erano e
            devono essere separate"*). L'8 agosto le avevo unite per togliere
            una superficie bianca dalla pila prima della lista: ma sono due
            cose diverse — «Archivio» cambia COSA vedi, «Ordina» cambia in che
            ORDINE lo vedi. Dentro lo stesso riquadro sembravano un comando
            solo. `flexWrap` + `marginLeft:auto`: quando non ci stanno affiancate
            (schermo stretto, «Testo grande») «Ordina» scende su una riga propria
            allineata a destra, invece di far sbordare la pagina. */}
        <div className="flex flex-wrap items-center gap-2 lg:hidden" style={{ margin: '14px 0' }}>
          {archivioOk && <ArchivioToggle base="/preventivi" attivo={soloArchiviati} q={q} sort={sortParam} />}
          <CestinoToggle base="/preventivi" attivo={false} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', background: '#fff', border: '1px solid #e7e7ea', borderRadius: 11, padding: '7px 11px', boxShadow: '0 1px 2px rgba(20,20,40,.05)' }}>
            <ArrowUpDown size={15} style={{ color: 'var(--cc-text-2)' }} />
            <span style={{ fontSize: 13, color: 'var(--cc-text-2)' }}>Ordina:</span>
            <SortSelect currentSort={sort} />
          </div>
        </div>

        {/* Desktop: Cerca + Filtra + Ordina in una riga */}
        <div className="hidden lg:flex items-center gap-2 flex-wrap mt-3">
          <div className="flex-1 min-w-[140px]">
            <SearchBar placeholder="Cerca per numero, cliente, stato, voce…" paramName="q" />
          </div>
          {archivioOk && <ArchivioToggle base="/preventivi" attivo={soloArchiviati} q={q} sort={sortParam} />}
          <CestinoToggle base="/preventivi" attivo={false} />
          <AdvancedFilters />
          <SortSelect currentSort={sort} />
        </div>
      </div>

      {/* ── LISTA ── */}
      {displayDocuments.length === 0 ? (
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
                  archiviati: 'Nessun preventivo archiviato',
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
          {displayDocuments.map((doc) => {
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
            const fattura = convertedFattureMap.get(doc.id)
            const isModified = !!(doc as Record<string, unknown>).updated_after_send_at
            // Etichetta fattura collegata (mostrata sotto al badge stato)
            const fatturaInfo = fattura ? (() => {
              const num = fattura.docNumber ? formatDocNumber(fattura.docNumber) : null
              const base = num ? `Fattura ${num}` : 'Fattura'
              switch (fattura.status) {
                case 'accepted': return { text: `${base} · Pagata`, color: '#2f8a63', strike: false }
                case 'sent':
                case 'viewed':   return { text: `${base} · Emessa`, color: '#3f6fb0', strike: false }
                case 'rejected': return { text: `${base} · Annullata`, color: 'var(--cc-muted)', strike: true }
                default:         return { text: num ? `Bozza fattura ${num}` : 'Bozza fattura', color: 'var(--cc-muted)', strike: false }
              }
            })() : null

            return (
              <div key={doc.id} style={{ position: 'relative', marginBottom: 16 }}>
                {/* Scheda cliccabile — cc-card come Link */}
                <Link
                  href={`/preventivi/${doc.id}`}
                  className="cc-card"
                  style={{ display: 'block', textDecoration: 'none', padding: '14px 50px 14px 15px', borderRadius: 9 }}
                >
                  {/* ⚠️ RIGA 1 — numero e cliente, TUTTA la larghezza (mockup B
                      dell'8 ago, scelta di Eli). Prima i badge stavano qui a
                      destra e non si restringevano: con due badge al nome del
                      cliente restavano 0px — spariva, ed è quello che si vedeva
                      nelle liste vere. Ora chi è il cliente si legge sempre; lo
                      stato e gli avvisi stanno sulla riga sotto, dove c'è posto. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                      <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--cc-text)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {doc.doc_number ? formatDocNumber(doc.doc_number) : (
                          <span style={{ fontWeight: 400, fontStyle: 'italic', color: 'var(--cc-text-3)' }}>Bozza senza numero</span>
                        )}
                      </span>
                      {clientFullName ? (
                        <>
                          <span style={{ color: 'var(--cc-text-3)', fontSize: 14, flexShrink: 0 }}>·</span>
                          <span style={{ fontSize: 14, color: 'var(--cc-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {clientFullName}
                          </span>
                        </>
                      ) : doc.status === 'draft' ? (
                        /* Decisione Eli 27 lug: la bozza può nascere senza
                           cliente (appunti in cantiere), ma in lista si deve
                           VEDERE — così non ci si dimentica per chi era.
                           L'invio senza cliente è comunque bloccato. */
                        <span style={{ fontSize: 11, fontWeight: 600, color: '#b0863e', background: '#f5e9d0', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          Senza cliente
                        </span>
                      ) : null}
                    </div>
                  </div>

                  {/* RIGA 2 — stato e avvisi a sinistra, data e importo a destra.
                      `flexWrap` + `marginLeft: auto`: quando ci stanno restano
                      ai due capi, quando non ci stanno la data scende su una
                      riga propria invece di far sbordare la card. */}
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 9, gap: 8, flexWrap: 'wrap' }}>
                    <StatusBadge status={isExpired ? 'expired' : doc.status} showTooltip={false} />
                    {isModified && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#2b2b2b', background: '#e9e0f7', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        Modificato
                      </span>
                    )}
                    {(soloArchiviati || archiviatiIds.has(doc.id)) && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#55534b', background: '#eeedea', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        Archiviato
                      </span>
                    )}
                    {bloccatiIds.has(doc.id) && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#8a5a00', background: '#f5e9d0', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        🔒 Bloccato
                      </span>
                    )}
                    <span style={{ fontSize: 13, color: dateInfo.urgent ? 'var(--cc-danger)' : 'var(--cc-text-2)', flexShrink: 0, marginLeft: 'auto' }}>
                      {dateInfo.text}
                      {' · '}
                      <span style={{ fontWeight: 500, color: 'var(--cc-text)' }}>
                        €{(doc.total ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </span>
                    </span>
                    {viewCount > 0 && (
                      <span className="hidden lg:flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                        <Eye className="size-3.5" />{viewCount}
                      </span>
                    )}
                  </div>

                  {/* RIGA 3 — la fattura collegata, allineata a destra: è un
                      rimando a un altro documento, non un dato di questo. */}
                  {fatturaInfo && (
                    <div style={{ marginTop: 7, textAlign: 'right' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: fatturaInfo.color, whiteSpace: 'nowrap', textDecoration: fatturaInfo.strike ? 'line-through' : 'none' }}>
                        <FileCheck2 style={{ width: 11, height: 11 }} /> {fatturaInfo.text}
                      </span>
                    </div>
                  )}
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
                      // Stesso predicato FES di status route / RiportaInBozza:
                      // firma O IP di accettazione = prova del cliente.
                      signedProof: !!(doc.signer_name || doc.accepted_ip),
                    }}
                    senderName={senderName}
                    archived={soloArchiviati || archiviatiIds.has(doc.id)}
                    locked={bloccatiIds.has(doc.id)}
                  />
                </div>
              </div>
            )
          })}
          <ListPager
            basePath="/preventivi"
            params={{ q, status, date_from, date_to, amount_min, amount_max, client_id, sort: sortParam }}
            page={requestedPage}
            totalPages={totalPages}
          />
        </div>
      )}
    </div>
  )
}

