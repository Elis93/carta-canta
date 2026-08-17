import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import Link from 'next/link'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { Button } from '@/components/ui/button'
import { Inbox, Download, Plus, FileInput, ArrowUpDown, FileCheck2, FileMinus2, FilePlus2, AlertTriangle } from 'lucide-react'
import { checkFreeBlock, FREE_INVOICE_LIMIT } from '@/lib/free-trial'
import { AdvancedFilters } from '../preventivi/_components/AdvancedFilters'
import { SearchBar } from '@/components/shared/SearchBar'
import { ExportCommercialistaButton } from '@/components/shared/ExportCommercialistaButton'
import { StatusBadge } from '../preventivi/_components/StatusBadge'
import { DocumentRowActions } from '../preventivi/_components/DocumentRowActions'
import { getSdiQuota } from '@/lib/sdi/quota'
import { archivioDisponibile } from '@/lib/documents/archivio'
import { freeOpenSentIds } from '@/lib/plan/free-lock'
import { SortSelect } from '../preventivi/_components/SortSelect'
import { ListPager } from '../_components/ListPager'
import { ArchivioToggle } from '../_components/ArchivioToggle'
import { CestinoToggle } from '../_components/CestinoToggle'
import { CestinoInline } from '../_components/CestinoInline'
import { DraftSavedBanner } from '../preventivi/_components/DraftSavedBanner'
import { formatDocNumber } from '@/lib/utils'
import { getContextualDate } from '@/lib/utils/document-date'
import { statusesFromQuery, coreQuery, sdiEsitoQuery, isNotaCreditoQuery, isNotaDebitoQuery, FATTURA_STATUS_KEYWORDS } from '@/lib/documents/status-search'
import { CsvDownloadButton } from '@/components/shared/CsvDownloadButton'
import { ordinaPerUrgenza } from '@/lib/documents/ordina-scadenza'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { numeroVarianti } from '@/lib/documents/numero'

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
  // ⚠️ «Archiviate» NON sta qui (Eli, 8 ago, opzione C del mockup): non è uno
  // stato del documento, è il posto dove l'hai messo — e con sei pillole la
  // riga non ci stava su nessun telefono. È il tasto ArchivioToggle, a
  // sinistra della riga «Ordina».
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

  // ARCHIVIO (075) — gemello della lista preventivi: il tasto «Archivio»
  // (?status=archiviati) mostra SOLO le archiviate, le pillole di stato le
  // nascondono. Il filtro va in
  // SQL perché la paginazione conta le righe lato database; la sonda tiene in
  // piedi la lista finché la migration non è applicata.
  const soloArchiviati = status === 'archiviati'
  const archivioOk = await archivioDisponibile(supabase)
  // Indirizzo dell'archivio senza la migration (segnalibro, o la voce del
  // cerca): il filtro non si applicherebbe e si vedrebbe la lista INTERA
  // spacciata per archivio. Meglio riportare alla lista, che almeno dice
  // il vero.
  if (soloArchiviati && !archivioOk) redirect('/fatture')

  // CESTINO (#11, 14 ago) — gemello della lista preventivi: il tab «Cestino»
  // mostra le fatture (e le note di credito/debito) eliminate, accanto
  // all'Archivio. Vista a sé (dati/azioni diversi, client component): si esce
  // subito, senza passare dalla query normale. Non dipende dalla migration
  // archivio.
  if (status === 'cestino') {
    return (
      <div className="p-4 lg:p-6 max-w-4xl mx-auto">
        <div className="lg:hidden -mx-4 -mt-4 mb-4 cc-title-band" style={{ padding: '15px 15px 13px' }}>
          <h1 className="cc-page-title" style={{ fontSize: 22 }}>Fatture</h1>
        </div>
        <div className="hidden lg:flex items-center gap-3 mb-4">
          <h1 className="cc-page-title" style={{ fontSize: 22 }}>Fatture</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2" style={{ marginBottom: 14 }}>
          {archivioOk && <ArchivioToggle base="/fatture" attivo={false} />}
          <CestinoToggle base="/fatture" attivo />
        </div>
        <CestinoInline scope="fattura" />
      </div>
    )
  }

  let query = supabase
    .from('documents')
    .select('id, doc_number, title, status, doc_type, origin_document_id, total, currency, created_at, sent_at, expires_at, accepted_at, updated_at, updated_after_send_at, clients(id, name, email)', { count: 'exact' })
    .eq('workspace_id', workspace.id)
    .in('doc_type', ['fattura', 'nota_credito', 'nota_debito'])
    .is('deleted_at', null)

  // Ordinamento — default 'recent' (updated_at DESC = ultima modifica),
  // coerente con Preventivi (Eli, 15 ago 2026).
  if (sort === 'oldest') {
    query = query.order('updated_at', { ascending: true })
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
    // default ('recent' o nessun parametro): ultima modifica per prima
    query = query.order('updated_at', { ascending: false })
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

  // ⚠️ L'archivio nasconde dalla NAVIGAZIONE, non dalla RICERCA — gemella della
  // lista preventivi (Eli, 8 ago). Con una ricerca in corso i risultati
  // archiviati compaiono, con la loro etichetta.
  if (archivioOk && !q) {
    query = soloArchiviati
      ? query.not('archived_at', 'is', null)
      : query.is('archived_at', null)
  } else if (archivioOk && q && soloArchiviati) {
    query = query.not('archived_at', 'is', null)
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
    // Cerca per parola «archiviati» (075): chi scrive la parola vuole quelli,
    // non un documento che la contiene nel titolo.
    const ARCHIVIO_KW = ['archiviato', 'archiviata', 'archiviati', 'archiviate', 'archivio']
    const isArchivioSearch = archivioOk && (ARCHIVIO_KW.includes(qCore) || (qCore.length >= 5 && ARCHIVIO_KW.some(k => k.startsWith(qCore))))
    // Ricerca SdI (28 lug, estesa 3 ago sera con l'ESITO): "sdi" = tutte le
    // trasmesse; "sdi consegnata"/"sdi scartate"/"sdi emessa" = quell'esito.
    // Pre-044 (colonna assente) la query risponde vuota: degrado innocuo.
    const sdiSearch = sdiEsitoQuery(qLow)
    // «nota di credito», anche a pezzi (Eli, 9 ago). Va PRIMA della ricerca
    // testuale: chi scrive «nota» vuole le note, non i documenti che hanno
    // quella parola nel titolo.
    const isNotaCreditoSearch = isNotaCreditoQuery(qLow)
    const isNotaDebitoSearch = isNotaDebitoQuery(qLow)
    if (isNotaCreditoSearch && isNotaDebitoSearch) {
      // Parole comuni ai due vocabolari («nota», «note»): si cercano
      // ENTRAMBE le famiglie — vedere solo metà delle note sarebbe peggio
      // che non cercarle affatto.
      query = query.in('doc_type', ['nota_credito', 'nota_debito'])
    } else if (isNotaCreditoSearch) {
      query = query.eq('doc_type', 'nota_credito')
    } else if (isNotaDebitoSearch) {
      query = query.eq('doc_type', 'nota_debito')
    } else if (sdiSearch) {
      query = query.not('sdi_status', 'is', null)
      if (sdiSearch.esiti) query = query.in('sdi_status', sdiSearch.esiti)
    } else if (isArchivioSearch) {
      query = query.not('archived_at', 'is', null)
    } else if (isModifiedSearch) {
      query = query.not('updated_after_send_at', 'is', null)
    } else if (statusList) {
      query = query.in('status', statusList as ('draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired')[])
    } else if (q.length > 1) {
      const escapa = (v: string) => v.replace(/[,()"]/g, ' ').replace(/[%_\\]/g, (c) => `\\${c}`)
      const esc = escapa(q.trim())
      const pat = `%${esc}%`
      // ⚠️ Le due grafie del sezionale convivono: le note create prima del
      // 10 ago sono «NC001/2026», le nuove «NC 001/2026». Chi cerca in un modo
      // deve trovare anche l'altro — una ricerca che risponde «nessun
      // risultato» nega l'esistenza di un documento che esiste.
      const numPats = numeroVarianti(q).map((v) => `doc_number.ilike.%${escapa(v)}%`)

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
        ...numPats,
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

  // ⚠️ «Scadenza più vicina» NON si può paginare nel database: l'ordine è per
  // fascia di urgenza (scadute → in attesa → bozze → chiuse → annullate) e
  // PostgREST non sa ordinare per un'espressione. Quindi per QUESTO
  // ordinamento si leggono tutte le righe filtrate, si ordina, e SOLO DOPO si
  // taglia la pagina — altrimenti si riordinerebbe la sola finestra che si sta
  // guardando, che è il difetto dell'8 agosto e non è un ordinamento.
  // Costo: qualche lettura in più su un solo ordinamento; correttezza in
  // cambio. Gli altri ordinamenti restano paginati dal database.
  type RigaLista = NonNullable<Awaited<typeof query>['data']>[number]
  let fatture: RigaLista[] | null = null
  let count: number | null = null
  let listError: unknown = null
  if (sort === 'expiry') {
    const { data: tutte, error } = await fetchAllRows<RigaLista>(() => query)
    listError = error
    if (!error) {
      const ordinate = ordinaPerUrgenza((tutte ?? []) as Array<RigaLista & { status: string }>)
      count = ordinate.length
      fatture = ordinate.slice(offset, offset + PAGE_SIZE)
    }
  } else {
    const res = await query.range(offset, offset + PAGE_SIZE - 1)
    fatture = res.data
    count = res.count
    listError = res.error
  }
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
  const incassateIds = new Set<string>()
  if (fatture && fatture.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonna 044 non ancora in types/database.ts
    const { data: sdiRows } = await (supabase as any)
      .from('documents')
      .select('id, sdi_status, payment_status')
      .in('id', fatture.map((f) => f.id))
    for (const r of (sdiRows ?? []) as Array<{ id: string; sdi_status: string | null; payment_status?: string | null }>) {
      if (r.sdi_status) sdiById.set(r.id, r.sdi_status)
      // Incasso registrato (038): il tasto Elimina resta spento e spiegato —
      // quei soldi sono nelle Entrate del Bilancio (decisione Eli, 11 ago).
      if (r.payment_status === 'paid' || r.payment_status === 'partial') incassateIds.add(r.id)
    }
  }

  // ⚠️ Da quale FATTURA nasce ogni nota di credito (Eli, 9 ago: *"non la vedo
  // come documento diviso dalla fattura da cui viene creata"*). Il numero da
  // solo dice che è una nota (NC001/2026); questa riga dice CHE COSA storna,
  // ed è il pezzo che la rende un documento a sé e non una copia della fattura.
  // Query a parte e tollerante, come le due qui sopra: la select principale
  // resta intatta e un errore lascia solo la mappa vuota.
  const ncOriginById = new Map<string, string>()
  {
    const note = (fatture ?? []).filter((f) => f.doc_type === 'nota_credito' && f.origin_document_id)
    if (note.length > 0) {
      const origini = await supabase
        .from('documents')
        .select('id, doc_number, doc_type')
        .in('id', note.map((n) => n.origin_document_id as string))
        .then((r) => r.data ?? [], () => [])
      const numeroById = new Map(origini.map((o) => [o.id, formatDocNumber(o.doc_number, o.doc_type)]))
      for (const n of note) {
        const num = numeroById.get(n.origin_document_id as string)
        if (num && num !== '—') ncOriginById.set(n.id, num)
      }
    }
  }

  // Quali righe di QUESTA pagina sono archiviate: serve solo quando la ricerca
  // le fa comparire fuori dalla loro pillola. Stessa forma tollerante del
  // blocco SdI qui sopra — la select principale resta intatta.
  const archiviatiIds = new Set(
    q && archivioOk && fatture && fatture.length > 0
      ? await supabase
          .from('documents')
          .select('id')
          .in('id', fatture.map((f) => f.id))
          .not('archived_at', 'is', null)
          .then((r) => (r.data ?? []).map((x) => x.id), () => [] as string[])
      : []
  )

  // Downgrade Pro→Free: le fatture INVIATE oltre le prime 8 sono in sola
  // lettura. `freeOpenSentIds` ritorna null sui piani a pagamento → nessun
  // blocco. Le bozze restano sempre aperte. Le note (credito/debito) non
  // sono un doc_type 'fattura' → mai bloccate.
  const openSentFatt = await freeOpenSentIds(supabase, workspace, 'fattura')
  const bloccatiIds = new Set(
    openSentFatt
      ? (fatture ?? [])
          .filter((f) => f.doc_type === 'fattura' && f.status !== 'draft' && !openSentFatt.has(f.id))
          .map((f) => f.id)
      : []
  )

  // ⚠️ Niente riordino in JS, come nella lista Preventivi: con la lista
  // PAGINATA agiva solo sulle righe della pagina corrente e l'ordine saltava
  // fra una pagina e l'altra (Eli, 8 ago). Ordina il database su tutto
  // l'archivio, per `expires_at` crescente.
  const displayFatture = fatture ?? []

  const senderName = workspace.ragione_sociale ?? workspace.name ?? ''

  // Avviso dei 12 giorni per l'invio email dalla LISTA (bozze — 080): la
  // conferma fiscale parte anche da qui, quindi anche qui serve l'avviso.
  // 'auto' solo se il pilota partirà davvero (interruttore + quota).
  let avvisoSdiWs: 'auto' | 'manuale' | null = null
  if (process.env.NEXT_PUBLIC_SDI_ENABLED === 'true') {
    const acceso = (workspace as { sdi_auto_enabled?: boolean | null }).sdi_auto_enabled !== false
    const quotaOk = acceso
      ? await getSdiQuota(workspace.id, workspace.plan).then((q) => q.allowed, () => false)
      : false
    avvisoSdiWs = acceso && quotaOk ? 'auto' : 'manuale'
  }

  // Piano Free: contatore delle 8 FATTURE inviate (083), gemello del banner
  // preventivi. ⚠️ Il limite morde sull'INVIO, non sulla creazione — quindi
  // l'avviso dice «inviare» e NON disabilita «Nuova fattura».
  const isFree = workspace.plan === 'free'
  const freeInvoiceStatus = isFree ? checkFreeBlock(workspace, 'fattura') : null

  return (
    <div className="p-4 lg:p-6 max-w-4xl mx-auto">
      {/* Pop-up "Bozza salvata" con numero assegnato (redirect da Nuova fattura) */}
      {bozza && <DraftSavedBanner docNumber={bozza !== '1' ? bozza : null} docType="fattura" />}
      {/* Mobile: fascia bianca titolo pagina */}
      <div className="lg:hidden -mx-4 -mt-4 mb-4 cc-title-band" style={{ padding: '15px 15px 13px' }}>
        <h1 className="cc-page-title" style={{ fontSize: 22 }}>Fatture</h1>
      </div>

      {/* ── BANNER PIANO FREE (limite 8 fatture inviate, 083) ── */}
      {isFree && freeInvoiceStatus?.blocked && freeInvoiceStatus.reason === 'trial_expired' && (
        <div className="flex items-start gap-3 rounded-lg border border-[#ecc9c9] bg-[#f5dede] px-4 py-3 text-sm text-[#b05656] mb-4">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <p>
            <strong>Il periodo di prova è terminato.</strong>{' '}
            Non puoi inviare nuove fatture ai clienti.{' '}
            <Link href="/abbonamento" className="font-semibold underline underline-offset-2">Passa a Pro</Link>{' '}
            per fatture illimitate.
          </p>
        </div>
      )}
      {isFree && freeInvoiceStatus?.blocked && freeInvoiceStatus.reason === 'doc_limit' && (
        <div className="flex items-start gap-3 rounded-lg border border-[#ecc9c9] bg-[#f5dede] px-4 py-3 text-sm text-[#b05656] mb-4">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <p>
            {/* ⚠️ Niente promesse sullo SdI qui: la trasmissione non dipende da
                QUESTO limite, ma su Free ha un suo contatore (8 e-fatture,
                lib/sdi/quota.ts) che a questo punto è spesso esaurito anche
                lui — prometterla «possibile» sarebbe falso (finding revisore). */}
            <strong>Hai raggiunto il limite di {FREE_INVOICE_LIMIT} fatture gratuite.</strong>{' '}
            Non puoi inviarne altre al cliente; creare bozze resta possibile.{' '}
            <Link href="/abbonamento" className="font-semibold underline underline-offset-2">Passa a Pro</Link>{' '}
            per fatture illimitate.
          </p>
        </div>
      )}
      {isFree && !freeInvoiceStatus?.blocked && freeInvoiceStatus && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          background: 'var(--cc-card)', borderRadius: 11, boxShadow: 'var(--cc-shadow)',
          borderLeft: '3px solid #c9a44c', padding: '10px 14px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16, color: '#c9a44c' }}>♛</span>
            <span style={{ fontSize: 13, color: 'var(--cc-text-2)' }}>
              <strong style={{ color: 'var(--cc-text)', fontWeight: 600 }}>{freeInvoiceStatus.docsUsed}/{FREE_INVOICE_LIMIT}</strong>{' '}fatture gratuite
            </span>
          </div>
          <Link href="/abbonamento" style={{ fontSize: 13, fontWeight: 600, color: '#c9a44c', textDecoration: 'none', whiteSpace: 'nowrap' }}>
            Passa a Pro →
          </Link>
        </div>
      )}

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

      {/* ── AZIONI (mobile): creare una fattura è la prima cosa che si fa qui,
           quindi sta in cima. I Preventivi non hanno questo blocco: lì si
           crea dal tasto «+» della barra in basso. ── */}
      {/* ⚠️ 16px sotto, non 8 (Eli, 9 ago: *"la distanza tra la sezione cerca e
           da preventivo è meno rispetto alla distanza tra cerca e le sezioni"*).
           Misurato: erano 8px qui contro 16px fra cerca e pillole — due stacchi
           diversi fra blocchi dello stesso livello, e l'occhio li legge come un
           raggruppamento che non esiste. */}
      <div className="lg:hidden" style={{ display: 'flex', gap: 10, padding: '2px 0 16px' }}>
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

      {/* ── CERCA (mobile) — SOTTO le azioni (Eli, 8 ago + ricerca UX):
           i due tasti sono l’AZIONE della pagina, non un filtro, e in mezzo
           fra cerca e sezioni spezzavano la sequenza «cerco → filtro →
           guardo». Da qui in giù la pagina è identica ai Preventivi. ── */}
      <div className="mb-3 lg:hidden">
        <SearchBar placeholder="Cerca numero, cliente, voce…" paramName="q" />
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
          {archivioOk && <ArchivioToggle base="/fatture" attivo={soloArchiviati} q={q} sort={sortParam} />}
          <CestinoToggle base="/fatture" attivo={false} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', background: '#fff', border: '1px solid #e7e7ea', borderRadius: 11, padding: '7px 11px', boxShadow: '0 1px 2px rgba(20,20,40,.05)' }}>
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
          {archivioOk && <ArchivioToggle base="/fatture" attivo={soloArchiviati} q={q} sort={sortParam} />}
          <CestinoToggle base="/fatture" attivo={false} />
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
                  {/* ⚠️ RIGA 1 — numero e cliente, TUTTA la larghezza (mockup B
                      dell'8 ago, scelta di Eli): gemella della lista preventivi.
                      Prima i badge stavano qui e non si restringevano: con due
                      badge il nome del cliente spariva. */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                      <span style={{ fontWeight: 500, fontSize: 14, color: 'var(--cc-text)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        {/* ⚠️ Il tipo VERO, non 'fattura' fisso: su una nota di
                            credito il marcatore «Fatt.» sarebbe una bugia. */}
                        {ft.doc_number ? formatDocNumber(ft.doc_number, ft.doc_type) : (
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
                  </div>

                  {/* RIGA 2 — stato e avvisi a sinistra, data e importo a destra */}
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 9, gap: 8, flexWrap: 'wrap' }}>
                    <StatusBadge status={ft.status as 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'} docType={ft.doc_type ?? 'fattura'} showTooltip={false} />
                    {isModified && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#2b2b2b', background: '#e9e0f7', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        Modificata
                      </span>
                    )}
                    {(soloArchiviati || archiviatiIds.has(ft.id)) && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#55534b', background: '#eeedea', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        Archiviata
                      </span>
                    )}
                    {bloccatiIds.has(ft.id) && (
                      <span style={{ fontSize: 11, fontWeight: 600, color: '#8a5a00', background: '#f5e9d0', borderRadius: 999, padding: '2px 8px', whiteSpace: 'nowrap', flexShrink: 0 }}>
                        🔒 Bloccata
                      </span>
                    )}
                    <span style={{ fontSize: 13, color: dateInfo.urgent ? 'var(--cc-danger)' : 'var(--cc-text-2)', flexShrink: 0, marginLeft: 'auto' }}>
                      {dateInfo.text}
                      {' · '}
                      <span style={{ fontWeight: 500, color: 'var(--cc-text)' }}>
                        €{(ft.total ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                      </span>
                    </span>
                  </div>

                  {/* RIGA 3 — esito SdI, allineato a destra (Eli 3 ago notte:
                      dicitura con iconcina, non un badge). Si cerca con "sdi",
                      "sdi consegnata" ecc. */}
                  {(() => {
                    const sdi = sdiById.get(ft.id)
                    const meta = sdi ? (SDI_LABEL[sdi] ?? { text: `SdI · ${sdi}`, color: '#2f8a63' }) : null
                    const isNc = ft.doc_type === 'nota_credito'
                    const isNd = ft.doc_type === 'nota_debito'
                    if (!meta && !isNc && !isNd) return null
                    // ⚠️ «Nota di credito» è una DICITURA come l'esito SdI, non una
                    // pillola (Eli, 9 ago): sta a sinistra, sulla stessa riga e con
                    // la stessa forma. Una pillola in più sulla riga dei badge
                    // rubava spazio al nome del cliente — è il difetto misurato
                    // l'8 agosto, e questa riga esiste apposta per i rimandi.
                    return (
                      <div style={{ marginTop: 7, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                        {/* ⚠️ La dicitura della nota VA A CAPO (niente `nowrap`): col
                            riferimento alla fattura stornata sborda a 320px in «Testo
                            grande» — misurato. `flex:1 1 auto` + `minWidth:0` le lasciano
                            lo spazio che c'è, l'icona resta in cima. */}
                        {(isNc || isNd) && (
                          <span style={{ display: 'inline-flex', alignItems: 'flex-start', gap: 3, fontSize: 11, fontWeight: 600, color: isNd ? '#3f6fb0' : '#6b4fa8', flex: '1 1 auto', minWidth: 0, lineHeight: 1.35 }}>
                            {isNd
                              ? <FilePlus2 style={{ width: 11, height: 11, flexShrink: 0, marginTop: 1 }} />
                              : <FileMinus2 style={{ width: 11, height: 11, flexShrink: 0, marginTop: 1 }} />}
                            <span>
                              {isNd ? 'Nota di debito' : 'Nota di credito'}
                              {ncOriginById.get(ft.id)
                                ? ` · ${isNd ? 'integra' : 'storna'} ${ncOriginById.get(ft.id)}`
                                : ''}
                            </span>
                          </span>
                        )}
                        {meta && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, fontWeight: 600, color: meta.color, whiteSpace: 'nowrap', marginLeft: 'auto' }}>
                            <FileCheck2 style={{ width: 11, height: 11 }} /> {meta.text}
                          </span>
                        )}
                      </div>
                    )
                  })()}
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
                    archived={soloArchiviati || archiviatiIds.has(ft.id)}
                    // Esito SdI già in mano alla lista (mappa sdiById): una
                    // fattura trasmessa non si elimina — il tasto resta spento.
                    sdiTransmitted={(() => { const st = sdiById.get(ft.id); return !!st && st !== 'scartata' })()}
                    // Incasso registrato (acconto o saldo): il tasto Elimina
                    // resta spento e spiegato — quei soldi sono nel Bilancio
                    // (decisione Eli, 11 ago).
                    hasIncasso={incassateIds.has(ft.id)}
                    docType={ft.doc_type ?? 'fattura'}
                    avvisoSdi={ft.doc_type === 'nota_credito' ? (avvisoSdiWs ? 'manuale' : null) : avvisoSdiWs}
                    locked={bloccatiIds.has(ft.id)}
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
