import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { createAdminClient } from '@/lib/supabase/admin'
import { signPhotoPaths } from '@/lib/photos/signed-url'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, ChevronLeft, ExternalLink, AlertTriangle, Info, FileCheck2, CheckCircle2, XCircle, Pencil, X, Crown, Send, Clock, FileText, Hammer } from 'lucide-react'
import { PreventivoForm } from '../_components/PreventivoForm'
import { PdfActions } from '../_components/PdfActions'
import { SendEmailDialog } from '../_components/SendEmailDialog'
import { SendEmailDialogController } from '../_components/SendEmailDialogController'
import { StatusBadge } from '../_components/StatusBadge'
import { StatusChangeDropdown, LOCKED_TRANSITIONS } from '../_components/StatusChangeDropdown'
import { ConvertiFatturaButton } from '../_components/ConvertiFatturaButton'
import { ApriLavoroButton } from '../_components/ApriLavoroButton'
import { LavoroLinkButton } from '../_components/LavoroLinkButton'
import { RiportaInBozzaButton } from '../_components/RiportaInBozzaButton'
import { AnteprimaButton } from '../_components/AnteprimaButton'
import { AccontoCard } from '../_components/AccontoCard'
import { WorkPhotosCard } from '../_components/WorkPhotosCard'
import { ShareButton } from '../_components/ShareButton'
import { checkFreeBlock, FREE_DOC_LIMIT } from '@/lib/free-trial'
import { isDocFreeLocked } from '@/lib/plan/free-lock'
import { PRO_LOCK_HREF } from '@/lib/plan/gate'
import { ContextHint } from '@/components/shared/ContextHint'
import { formatDocNumber, stripPrefissoLegacy } from '@/lib/utils'
import { RestoreVersionButton } from '../_components/RestoreVersionButton'
import { DocumentTimeline } from '../_components/DocumentTimeline'
import { MessaggiCard } from '../_components/MessaggiCard'
import { ScrollToHash } from '@/components/shared/ScrollToHash'
import { conversationFromLog } from '@/lib/documents/messaggi'
import { hasPiuProposte, totaliPerProposta, tierOf, TIER_LABEL, TIER_ORDER, type TierKey, type VoceConTier } from '@/lib/documents/proposte'
import { riepilogoIva } from '@/lib/fiscal/calcoli'
import { espandiBeniSignificativi, type VoceSplittabile } from '@/lib/fiscal/beni-significativi'
import { MobileStatusChips } from '../_components/MobileStatusChips'
import type { DocumentLogEntry } from '../_components/DocumentTimeline'
import { BackButton } from '@/components/shared/BackButton'
import { ArchivioBanner } from '@/components/shared/ArchivioBanner'
import { PosticipaSollecito } from '@/components/shared/PosticipaSollecito'
import { docNumberSlug } from '@/lib/documents/numero'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ send?: string; edit?: string; da_sopralluogo?: string }>
}

export default async function PreventivoDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { send, edit, da_sopralluogo } = await searchParams
  // Contesto sessione condiviso (memoizzato per richiesta — vedi lib/workspace-context.ts)
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/login')

  // PERF: tutte le query sono keyate su id di route / workspace → UN solo
  // round trip (prima erano due onde in serie). Il cliente è JOINato nel
  // documento; fattura collegata e aperture si filtrano dopo in base allo
  // stato (stessa visibilità di prima, fetch anticipato).
  const [{ data: doc }, { data: templates }, { data: fatturaOriginRaw }, { data: viewsRaw }, supplierLists] = await Promise.all([
    supabase
      .from('documents')
      .select('*, document_items(*), clients(id, name, surname, email, phone, piva, indirizzo, cap, citta, provincia)')
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'preventivo')
      .is('deleted_at', null)
      .maybeSingle(),
    // Carica template (campi base per il form + campi PDF)
    supabase
      .from('templates')
      .select('id, name, is_default, color_primary, show_logo, show_watermark, legal_notice')
      .eq('workspace_id', workspace.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: true }),
    // Fattura generata da questo preventivo (mostrata solo se accepted)
    supabase
      .from('documents')
      .select('id, doc_number, created_at')
      .eq('origin_document_id', id)
      .is('deleted_at', null)
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'fattura')
      .limit(1)
      .maybeSingle(),
    // Storico aperture (sempre in cronologia — la storia non si cancella).
    // ⚠️ Senza limit(50), come il gemello fatture: col limite, oltre le 50
    // aperture la cronologia numerava «1ª» quella che era la 51ª.
    supabase
      .from('document_views')
      .select('id, viewed_at, ip_address, country')
      .eq('document_id', id)
      .order('viewed_at', { ascending: false }),
    // Listini fornitori (063) — avviso scadenza-listino nel form (tollerante pre-migration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 063 non ancora in types/database.ts
    (supabase as any)
      .from('supplier_lists')
      .select('id, name, valid_until')
      .eq('workspace_id', workspace.id)
      .then((r: { data: Array<{ id: string; name: string; valid_until: string | null }> | null }) => r.data ?? [], () => [] as Array<{ id: string; name: string; valid_until: string | null }>)
  ])

  if (!doc) notFound()

  // Archiviato? (075). La select principale è un `select('*')`: la colonna
  // arriva già, e se la migration non ci fosse arriverebbe semplicemente
  // `undefined` — nessuna query in più e tolleranza gratis.
  const archiviato = !!(doc as { archived_at?: string | null }).archived_at
  // Promemoria spenti / rinviati (074-075). Letti dal `select('*')` già fatto:
  // pre-migration i campi sono `undefined` e le due righe restano invisibili.
  const sollecitiSpenti = !!(doc as { reminders_off_at?: string | null }).reminders_off_at
  const rinvioRaw = (doc as { snooze_until?: string | null }).snooze_until ?? null
  const rinvioAttivo = rinvioRaw && rinvioRaw > new Date().toISOString() ? rinvioRaw : null

  // Template attivo per il documento corrente (usato per il PDF)
  const activeTemplate = templates?.find((t) => t.id === (doc as any).template_id)
    ?? templates?.find((t) => t.is_default)
    ?? templates?.[0]
    ?? null

  // defaultTemplateId: template personalizzato con is_default=true (esclude "Template predefinito").
  // Se nessun custom template è attivo, il dropdown mostrerà "Default (Classico)".
  const defaultTemplateId = templates?.find(
    (t) => t.is_default && t.name !== 'Template predefinito'
  )?.id ?? null

  // Cliente JOINato nel documento; la CARD della fattura collegata resta
  // filtrata per stato (la cronologia invece riceve il dato grezzo).
  const pdfClient = (doc as unknown as {
    clients: { id: string; name: string; surname: string | null; email: string | null; phone: string | null; piva: string | null; indirizzo: string | null; cap: string | null; citta: string | null; provincia: string | null } | null
  }).clients
  const fatturaOrigin = doc.status === 'accepted' && doc.doc_type !== 'fattura' ? fatturaOriginRaw : null
  // Le aperture del cliente restano SEMPRE in cronologia, anche se il
  // documento torna in bozza (Eli 3 ago notte: "è la storia di quel
  // documento, nulla si cancella") — prima il gate status!=='draft' le
  // faceva sparire dopo un "Riporta in bozza".
  const views = viewsRaw

  // Conversazione col cliente (messaggi dalla pagina pubblica + risposte).
  // ⚠️ Si usa l'helper, non il log grezzo: nel registro ci sono anche gli
  // incassi, che non c'entrano con i messaggi.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- document_log jsonb nel select *
  const conversation = conversationFromLog((doc as any).document_log)

  const formDefaultClient = pdfClient
    ? { id: pdfClient.id, name: pdfClient.name, email: pdfClient.email ?? null, phone: pdfClient.phone ?? null, piva: pdfClient.piva ?? null }
    : null

  const clientName = pdfClient
    ? [pdfClient.name, pdfClient.surname].filter(Boolean).join(' ')
    : null
  const clientContact = pdfClient
    ? [pdfClient.email, pdfClient.phone].filter(Boolean).join(' · ')
    : null

  const isFree = workspace.plan === 'free'
  // Downgrade Pro→Free: preventivo INVIATO oltre i primi 8 = sola lettura
  // (Eli, 12 ago). Le bozze restano aperte; i piani a pagamento mai bloccati.
  const freeLocked = await isDocFreeLocked(supabase, { plan: workspace.plan, id: workspace.id }, doc)
  // ?edit=1 digitato a mano su un documento bloccato: rimbalza alla vista di
  // lettura (il server rifiuta comunque il salvataggio, ma la modifica non si
  // deve nemmeno aprire — regola dell'8 ago).
  if (edit === '1' && freeLocked) redirect(`/preventivi/${id}`)
  const isDraft = doc.status === 'draft'
  const docItems = (doc as Record<string, unknown>).document_items as Array<Record<string, unknown>> | null ?? []
  const isCompleteVoce = (item: Record<string, unknown>) =>
    String(item.description ?? '').trim() !== '' &&
    Number(item.unit_price ?? 0) > 0 &&
    Number(item.quantity ?? 0) > 0
  const meaningfulDocItems = docItems.filter(item =>
    String(item.description ?? '').trim() !== '' ||
    Number(item.unit_price ?? 0) > 0 ||
    Number(item.quantity ?? 0) > 0
  )
  // PRIMO invio (bozza): TUTTE le voci devono essere complete — così una bozza
  // con voci AI "da completare" (prezzo/quantità 0) non parte al cliente.
  // RE-INVIO di un documento già inviato: basta una voce completa (comportamento
  // storico), per non bloccare documenti reali con righe a 0 (es. "omaggio").
  const hasVoci = isDraft
    ? meaningfulDocItems.length > 0 && meaningfulDocItems.every(isCompleteVoce)
    : docItems.some(isCompleteVoce)
  // Promemoria quota Free: mostrato per i piani Free (in qualsiasi stato), non quando bloccato.
  const freeTrialStatus = isFree ? checkFreeBlock(workspace) : null

  const publicUrl = doc.public_token ? `/p/${doc.public_token}` : null

  // ── Helper formattazione (mobile read view) ──
  const euro = (n: number) => `€\u00A0${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2  })}`
  const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' , timeZone: 'Europe/Rome' })
  const fmtLong = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' , timeZone: 'Europe/Rome' })

  const subtotal = Number((doc as any).subtotal ?? 0)
  const taxAmount = Number((doc as any).tax_amount ?? 0)
  const bolloAmount = Number((doc as any).bollo_amount ?? 0)
  const totalAmount = Number((doc as any).total ?? 0)
  // Righe «IVA x%» PER ALIQUOTA, dal motore (riepilogoIva) sulle voci espanse
  // dei beni significativi — stessa fonte del PDF, così non possono divergere.
  // ⚠️ Prima l'etichetta faceva Number(vat_rate): su una voce con IVA
  // «predefinita» (null) usciva «IVA 0%» accanto all'imposta calcolata al
  // default (Eli, 20 ago, foto); e con aliquote diverse una sola riga «IVA»
  // sommava tutto. Ora: una riga per aliquota, col numero giusto.
  const ivaOpts = {
    fiscal_regime: 'ordinario' as const,
    discount_pct: Number((doc as any).discount_pct ?? 0),
    discount_fixed: Number((doc as any).discount_fixed ?? 0),
    vat_rate_default: ((doc as any).vat_rate_default ?? 22) as number,
  }
  const righeIvaDi = (items: typeof docItems) => riepilogoIva(
    (espandiBeniSignificativi(
      items as unknown as VoceSplittabile[],
      workspace.fiscal_regime,
      (doc as any).vat_rate_default ?? null,
    ) as unknown as typeof docItems).map((i) => ({ total: Number(i.total ?? 0), vat_rate: i.vat_rate == null ? null : Number(i.vat_rate) })),
    ivaOpts,
  ).filter((r) => r.rate > 0)
  const ivaRighe = righeIvaDi(docItems)
  // Sconto di documento in euro, per la riga del riepilogo: % sul subtotale
  // più l'eventuale fisso, arrotondato e mai oltre il subtotale (stessa
  // formula della pagina pubblica e del motore). Senza questa riga il foglio
  // non tornava: Subtotale 90 + IVA 18,70 ≠ Totale 103,70 (foto Eli 25 ago).
  const scontoDocumento = Math.min(
    Math.round((subtotal * (ivaOpts.discount_pct / 100) + ivaOpts.discount_fixed) * 100) / 100,
    subtotal,
  )

  // Preventivo con più proposte: un calcolo PER PROPOSTA (null se ce n'è una
  // sola, e allora restano i totali salvati sul documento).
  const totaliProposte = hasPiuProposte(docItems)
    ? totaliPerProposta(docItems, {
        fiscal_regime: workspace.fiscal_regime as 'forfettario' | 'ordinario' | 'minimi',
        currency: 'EUR',
        discount_pct: (doc as any).discount_pct ?? undefined,
        discount_fixed: (doc as any).discount_fixed ?? undefined,
        vat_rate_default: (doc as any).vat_rate_default ?? undefined,
      })
    : null

  // ── Quale proposta è stata confermata (041) ─────────────────────────────
  // Eli, 9 ago: *"quando clicco su accettato preventivo e seleziono la
  // proposta base poi non si capisce che è stato confermato quello"*.
  // Il dato c'era già (`accepted_tier`, scritto sia dall'accettazione manuale
  // sia da quella del cliente) ma non veniva mostrato da nessuna parte: si
  // leggeva solo nel toast del momento, che sparisce dopo quattro secondi.
  const acceptedTierRaw = (doc as { accepted_tier?: string | null }).accepted_tier ?? null
  const acceptedTier = acceptedTierRaw && (TIER_ORDER as readonly string[]).includes(acceptedTierRaw)
    ? (acceptedTierRaw as TierKey)
    : null
  const acceptedTierLabel = acceptedTier ? TIER_LABEL[acceptedTier] : null
  // Chi ha scelto: il cliente dal link (lascia IP o firma) o l'artigiano.
  const sceltaDalCliente = !!doc.signer_name || doc.accepted_ip != null

  // Apertura più recente (per riga stato "Visto" e card Visualizzazioni)
  const latestView = views && views.length > 0
    ? [...views].sort((a, b) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime())[0]
    : null

  // Header: per la bozza il titolo è "Bozza"; altrimenti "Preventivo {num}"
  const headerTitle = doc.status === 'draft'
    ? 'Bozza'
    : (formatDocNumber(doc.doc_number) !== '—' ? `Preventivo ${formatDocNumber(doc.doc_number)}` : 'Bozza')

  // Riga di stato sotto l'header (badge + testo contestuale)
  let stateText = ''
  if (doc.status === 'draft') stateText = doc.created_at ? `Creata il ${fmtShort(doc.created_at)}` : 'Bozza'
  else if (doc.status === 'viewed') stateText = latestView ? `Visto dal cliente il ${fmtShort(latestView.viewed_at)}` : (doc.sent_at ? `Inviato il ${fmtShort(doc.sent_at)}` : 'Visto')
  else if (doc.status === 'sent') stateText = doc.sent_at ? `Inviato il ${fmtShort(doc.sent_at)}` : 'Inviato'
  else if (doc.status === 'accepted') {
    stateText = doc.accepted_at ? `Accettato il ${fmtShort(doc.accepted_at)}` : 'Accettato'
    // La proposta scelta va accanto alla data: è la prima riga che si legge
    // aprendo il documento, e senza questa parola resta la domanda «quale?».
    if (acceptedTierLabel) stateText += ` · proposta ${acceptedTierLabel}`
  }
  else if (doc.status === 'rejected') stateText = 'Rifiutato'
  else if (doc.status === 'expired') stateText = doc.expires_at ? `Scaduto il ${fmtShort(doc.expires_at)}` : 'Scaduto'

  // Secondo bottone primario (mobile): SEMPRE "Invia al cliente", in ogni stato
  // (decisione Eli 5 lug — una sola dicitura). Apre il pop-up coi canali; il
  // canale Email apre il popup email; per gli scaduti il pop-up gestisce la
  // nuova scadenza come prima.

  // Cronologia (mobile): dal 3 ago sera usa DIRETTAMENTE DocumentTimeline —
  // la vecchia lista costruita inline qui ignorava il document_log (modifiche,
  // reinvii, incassi, transizioni manuali) e andava tenuta allineata a mano.
  // Ora le cronologie sono UNA (Eli: "deve contenere ogni minima azione").

  // ── Acconto richiesto (colonne 038 — lette dal doc già caricato con select('*')) ──
  // NB: con una fattura collegata l'acconto vive SULLA FATTURA (spostato
  // alla conversione) — qui non va più mostrato né registrato, altrimenti
  // il Bilancio lo conterebbe due volte.
  let accontoInfo: { acconto: number; saldo: number; received: { amount: number; at: string | null } | null } | null = null
  if (doc.status === 'accepted' && !fatturaOrigin) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
      const depRow = doc as any
      const totalNum = Number(doc.total ?? 0)
      const t = depRow?.deposit_type
      const v = Number(depRow?.deposit_value)
      if ((t === 'percent' || t === 'amount') && Number.isFinite(v) && v > 0 && totalNum > 0) {
        const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
        const acconto = t === 'percent' ? r2((totalNum * Math.min(v, 100)) / 100) : r2(Math.min(v, totalNum))
        if (acconto > 0) {
          accontoInfo = {
            acconto,
            saldo: r2(totalNum - acconto),
            received:
              depRow.payment_status === 'partial' && Number(depRow.paid_amount) > 0
                ? { amount: r2(Number(depRow.paid_amount)), at: depRow.paid_at ?? null }
                : null,
          }
        }
      }
    } catch { /* migration non ancora applicata */ }
  }

  // ── Foto lavoro (041) + lavoro collegato (048) — tolleranti pre-migration ──
  let workPhotos: Array<{ id: string; storage_path: string; label: 'prima' | 'dopo' | null; visible_to_client: boolean; sopralluogo_id: string | null }> = []
  // Lavoro già creato da questo preventivo → tasto "Apri la scheda lavoro"
  // che ci porta DENTRO (richiesta Eli 3 ago), in ogni stato del documento.
  let linkedLavoroId: string | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 041/048 non ancora in types/database.ts
  const anyDb = supabase as any
  const [wpRes, lavRes] = await Promise.all([
    anyDb
      .from('work_photos')
      .select('id, storage_path, label, visible_to_client, sopralluogo_id')
      .eq('document_id', id)
      .order('created_at', { ascending: true })
      .then((r: { data: unknown[] | null }) => r.data, () => null),
    anyDb
      .from('lavori')
      .select('id')
      .eq('document_id', id)
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .limit(1)
      .maybeSingle()
      .then((r: { data: { id: string } | null }) => r.data, () => null),
  ])
  workPhotos = (wpRes ?? []) as typeof workPhotos

  // Firma delle foto già presenti con l'admin: in un team le foto stanno nella
  // cartella di chi le ha caricate, e il client di un collaboratore non
  // potrebbe firmarle (archivio privato, migration 068). Le foto caricate DOPO,
  // nella stessa sessione, le firma il client (propria cartella).
  const workPhotoSignedUrls = Object.fromEntries(
    await signPhotoPaths(createAdminClient(), workPhotos.map((p) => p.storage_path)),
  )
  linkedLavoroId = lavRes?.id ?? null

  // ── Stili condivisi mobile (mockup pixel) ──
  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 14,
    boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)',
    padding: '15px 15px',
  }
  const cardLabel: React.CSSProperties = {
    fontSize: 13, fontWeight: 600, letterSpacing: '.07em',
    textTransform: 'uppercase', color: '#6f6d64', marginBottom: 12,
  }
  const sumRow: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 0', fontSize: 14,
  }
  // Righe del conteggio dentro una proposta: più piccole e grigie delle voci,
  // così non si confondono con esse.
  const riepilogoRow: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '5px 0', fontSize: 13, color: 'var(--cc-muted)',
  }
  const actionChip: React.CSSProperties = {
    flex: 1, height: 48, boxSizing: 'border-box', whiteSpace: 'nowrap',
    borderRadius: 13, padding: '0 13px', fontSize: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)',
    textDecoration: 'none', cursor: 'pointer',
  }
  // Chip "Segna accettato/rifiutato": bianca, bordo neutro, peso 600 (icona colorata gestita nel componente)
  const segnaChip: React.CSSProperties = { ...actionChip, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e', fontWeight: 600 }

  return (
    <div className="max-w-4xl mx-auto">
      {/* La pagina ha un loading.tsx: le ancore (#messaggi) hanno bisogno di
          ScrollToHash, altrimenti lo scroll parte sullo scheletro (regola 20 ago). */}
      <ScrollToHash />

      {/* ── MOBILE HEADER (lg:hidden) ── */}
      <div className="lg:hidden" style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', padding: '12px 15px' }}>
        <BackButton fallback="/preventivi" />
        {/* Simbolo tipo documento (A2, 5 lug): foglio NAVY = preventivo */}
        <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e', minWidth: 0 }}>
          <FileText size={18} style={{ color: '#1a1a2e', flexShrink: 0 }} aria-hidden />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{headerTitle}</span>
        </span>
        {edit !== '1' ? (
          freeLocked ? null : (
          // Matita CON etichetta (collaudo 17 ago) — NAVY PIENA (mockup B,
          // Eli 25 ago: «non si capisce che serve cliccare su Modifica»).
          <Link href={`/preventivi/${id}?edit=1`} aria-label="Modifica preventivo" style={{ display: 'flex', alignItems: 'center', gap: 5, borderRadius: 999, background: '#1a1a2e', padding: '8px 14px', fontSize: 13, fontWeight: 700, color: '#fff', textDecoration: 'none', flexShrink: 0, boxShadow: '0 5px 12px -5px rgba(26,26,46,.6)' }}>
            <Pencil size={15} /> Modifica
          </Link>
          )
        ) : (
          <>
            {/* Chip di stato vista (Eli 20 ago: «non è chiaro se sono nella
                vista riassuntiva o in quella di modifica»): in modifica lo
                dice una pillola ambra; la ✕ riporta al riepilogo. */}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 999, background: '#f5e9d0', border: '1px solid #e8d6ad', padding: '6px 11px', fontSize: 12.5, fontWeight: 600, color: '#8a5a00', flexShrink: 0, marginRight: 8 }}>
              <Pencil size={13} /> In modifica
            </span>
            <Link href={`/preventivi/${id}`} aria-label="Chiudi la modifica e torna al riepilogo" style={{ width: 34, height: 34, borderRadius: '50%', background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <X size={18} style={{ color: '#55534b' }} />
            </Link>
          </>
        )}
      </div>

      {archiviato && (
        <div style={{ margin: '14px 15px 0' }} className="lg:mx-6 lg:mt-6">
          <ArchivioBanner documentId={id} docType="preventivo" />
        </div>
      )}

      {/* Promemoria spenti o rinviati: DETTO SUL DOCUMENTO (Eli 21 ago — un
          documento spariva dalla sezione «In scadenza» della Home e la
          ragione, un «Non ricordarmelo più» toccato giorni prima, non si
          vedeva da nessuna parte). Compare solo quando c'è qualcosa da dire;
          il tasto per riaccenderli è dentro il componente. */}
      {(sollecitiSpenti || rinvioAttivo) && (
        <div style={{ margin: '10px 15px 0' }} className="lg:mx-6">
          <PosticipaSollecito
            documentId={id}
            docType="preventivo"
            snoozeUntil={rinvioAttivo}
            remindersOff={sollecitiSpenti}
          />
        </div>
      )}

      {/* Downgrade Pro→Free: preventivo bloccato (oltre gli 8 inviati). Spento
          e spiegato: si apre e si consulta, ma non si modifica, invia, scarica
          o duplica. Il dato resta salvato — tornando a Pro riappare usabile. */}
      {freeLocked && (
        <div style={{ margin: '14px 15px 0' }} className="lg:mx-6 lg:mt-6">
          <div className="flex items-start gap-2 rounded-lg border border-[#e8d6ad] bg-[#f5e9d0] px-4 py-3 text-xs text-[#8a5a00]">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div>
              <b>Preventivo bloccato</b> — è oltre gli 8 del piano gratuito. Puoi aprirlo e consultarlo, ma non modificarlo, inviarlo, scaricarlo o duplicarlo.{' '}
              <Link href={PRO_LOCK_HREF} style={{ fontWeight: 600, textDecoration: 'underline' }}>
                Torna a Pro per sbloccarlo
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE READ VIEW (lg:hidden, solo se non in modifica) — pixel-perfect dal mockup ── */}
      {edit !== '1' && (
        <div className="lg:hidden" style={{ paddingBottom: 20 }}>

          {/* Riga stato: badge + testo contestuale */}
          <div style={{ margin: '14px 15px 0', display: 'flex', alignItems: 'center', gap: 9 }}>
            <StatusBadge status={doc.status} />
            {stateText && <span style={{ fontSize: 13, color: 'var(--cc-muted)' }}>{stateText}</span>}
          </div>

          {/* ── MODIFICATO dopo l'invio — MOBILE (7 ago) ──────────────────
              ⚠️ Bug segnalato da Eli: la Home diceva "Modificato" ma aprendo
              il preventivo dal telefono non c'era NESSUN riferimento, solo il
              badge "Visto". Il banner esisteva ma era `hidden lg:flex`, cioè
              solo desktop — e l'app si usa dal telefono. La fattura invece ce
              l'aveva già su entrambi. */}
          {(doc as any).updated_after_send_at && doc.status !== 'accepted' && (
            <div style={{ margin: '14px 15px 0', background: '#f6f2fc', border: '1px solid #e2d7f4', borderRadius: 10, padding: '12px 14px' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#ddd0f4', color: '#161616', borderRadius: 8, padding: '4px 9px', fontSize: 12.5, fontWeight: 700 }}>
                <AlertTriangle size={14} style={{ flexShrink: 0 }} aria-hidden />
                Modificato — cliente non avvisato
              </span>
              <p style={{ fontSize: 12.5, color: '#3f3d36', marginTop: 8, lineHeight: 1.55 }}>
                Documento aggiornato il{' '}
                {new Date((doc as any).updated_after_send_at).toLocaleString('it-IT', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' } as Intl.DateTimeFormatOptions)}, dopo
                l&rsquo;invio al cliente. Chi riapre il link vede già la versione aggiornata, ma il
                cliente non ha ricevuto alcuna comunicazione: si consiglia di inviare nuovamente
                il preventivo.
              </p>
            </div>
          )}

          {/* Banner accettazione — compare quando aggiunge qualcosa alla riga di
              stato: i dettagli della firma (firma/IP) OPPURE la proposta scelta.
              ⚠️ Prima l'accettazione MANUALE non aveva alcun banner: segnando
              accettata la Premium non restava traccia visibile della scelta. */}
          {doc.status === 'accepted' && (doc.signer_name || doc.accepted_ip != null || acceptedTierLabel) && (
            <div style={{ margin: '14px 15px 0', background: '#d4efe2', border: '1px solid #bce3d2', borderRadius: 10, padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <CheckCircle2 size={17} style={{ color: '#2f8a63', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2f8a63' }}>
                  {doc.signer_name
                    ? 'Accettato e firmato dal cliente'
                    : doc.accepted_ip != null
                    ? 'Accettato dal cliente'
                    : 'Segnato come accettato da te'}
                </div>
                {acceptedTierLabel && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2f8a63', marginTop: 3 }}>
                    Proposta {acceptedTierLabel}
                    <span style={{ fontWeight: 400 }}>
                      {' '}— {sceltaDalCliente ? 'scelta dal cliente' : 'confermata da te'}
                    </span>
                  </div>
                )}
                {doc.accepted_at && (
                  <div style={{ fontSize: 12, color: '#2f8a63', marginTop: 2 }}>
                    {doc.signer_name && <>{doc.signer_name} · </>}
                    {fmtLong(doc.accepted_at)}
                    {doc.accepted_ip != null && <> · IP {String(doc.accepted_ip)}</>}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Acconto richiesto (mockup ciclo incasso 3c) */}
          {accontoInfo && (
            <div style={{ margin: '14px 15px 0' }}>
              <AccontoCard
                documentId={id}
                acconto={accontoInfo.acconto}
                saldo={accontoInfo.saldo}
                received={accontoInfo.received}
              />
            </div>
          )}

          {/* La card Foto è scesa in fondo, dopo il Cliente (mockup B, Eli
              25 ago): la prima cosa che si incontra dev'essere il documento. */}

          {/* Banner rifiutato */}
          {doc.status === 'rejected' && (
            <div style={{ margin: '14px 15px 0', background: '#f5dede', border: '1px solid #ecc9c9', borderRadius: 10, padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <XCircle size={17} style={{ color: '#b05656', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#b05656' }}>Rifiutato dal cliente</div>
                {doc.rejection_reason && (
                  <div style={{ fontSize: 12, color: '#b05656', marginTop: 2 }}>Motivo: &ldquo;{doc.rejection_reason}&rdquo;</div>
                )}
              </div>
            </div>
          )}

          {/* Banner scaduto */}
          {doc.status === 'expired' && (
            <div style={{ margin: '14px 15px 0', background: '#f5e9d0', border: '1px solid #e8d6ad', borderRadius: 10, padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <Clock size={17} style={{ color: '#b0863e', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#b0863e' }}>Preventivo scaduto</div>
                <div style={{ fontSize: 12, color: '#b0863e', marginTop: 2 }}>Validità superata.{freeLocked ? '' : ' Puoi rinviarlo al cliente.'}</div>
              </div>
            </div>
          )}

          {/* Banner quota Free (corto, oro) — solo bozza */}
          {isFree && isDraft && freeTrialStatus && !freeTrialStatus.blocked && (
            <div style={{ margin: '14px 15px 0', background: '#fff', borderLeft: '3px solid #c9a44c', borderRadius: 11, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <Crown size={18} style={{ color: '#b08d3e', flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#55534b', flex: 1 }}>
                {freeTrialStatus.docsUsed}/{FREE_DOC_LIMIT} preventivi gratuiti
              </span>
              <Link href="/abbonamento" style={{ fontSize: 13, fontWeight: 600, color: '#b08d3e', textDecoration: 'none', flexShrink: 0 }}>Passa a Pro →</Link>
            </div>
          )}
          {/* Banner blocco Free (bozza non inviabile) */}
          {isFree && isDraft && freeTrialStatus?.blocked && (
            <div style={{ margin: '14px 15px 0' }} className="flex items-start gap-3 rounded-xl border border-[#ecc9c9] bg-[#f5dede] px-4 py-3 text-sm text-[#b05656]">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <p>
                {freeTrialStatus.reason === 'trial_expired'
                  ? <><strong>Il periodo di prova è terminato.</strong>{' '}Non puoi inviare questo preventivo.{' '}</>
                  : <><strong>Hai raggiunto il limite di {FREE_DOC_LIMIT} preventivi del piano gratuito.</strong>{' '}</>}
                <Link href="/abbonamento" className="font-semibold underline underline-offset-2">Passa a Pro</Link>
              </p>
            </div>
          )}

          {/* ── IL FOGLIO (mockup B «Foglio», scelto da Eli 25 ago) ─────────
              In lettura il documento SI VEDE come un foglio: filetto d'oro in
              testa, tipo+numero in Georgia, voci a filetti e totale in fascia
              navy. È la forma stessa a dire «questo è il documento, non un
              modulo da compilare». La card Cliente è scesa sotto. */}
          <div style={{ margin: '14px 15px 0', background: '#fbfaf7', border: '1px solid #e6e1d5', borderTop: '3px solid #c9a44c', borderRadius: 14, boxShadow: '0 10px 26px -16px rgba(20,20,40,.5)', padding: '15px 15px' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: '#8a6b28' }}>
              Preventivo
            </div>
            {doc.doc_number && (
              <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 22, color: '#161616', margin: '3px 0 1px' }}>
                {formatDocNumber(doc.doc_number)}
              </div>
            )}
            {(clientName || stateText) && (
              <div style={{ fontSize: 12.5, color: 'var(--cc-muted)', marginBottom: 10 }}>
                {clientName ?? ''}{clientName && stateText ? ' · ' : ''}{stateText ? stateText.charAt(0).toLowerCase() + stateText.slice(1) : ''}
              </div>
            )}
            {doc.title && <div style={{ fontSize: 15, fontWeight: 600, color: '#161616', marginBottom: 6 }}>{doc.title}</div>}
            {/* ⚠️ UN BLOCCO CHIUSO PER PROPOSTA (Eli, 7 ago, mockup approvato):
                voci e totali della Base, poi voci e totali della Premium.
                Prima le voci erano sì raggruppate, ma i due riepiloghi stavano
                tutti in fondo: i totali della Base cadevano DOPO le voci della
                Premium e per verificarli bisognava scorrere avanti e indietro.
                Il filetto colorato a sinistra tiene insieme il blocco e mostra
                a colpo d'occhio dove finisce una proposta e comincia l'altra. */}
            {totaliProposte ? (
              <>
                {totaliProposte.map((p, i) => {
                  const vociProposta = docItems.filter((it) => tierOf(it as VoceConTier) === p.tier)
                  // ⚠️ Quella accettata si riconosce a colpo d'occhio: filetto
                  // verde e spunta. Le altre restano leggibili ma spente — se
                  // fossero identiche, il riepilogo continuerebbe a non dire
                  // quale delle due è stata confermata.
                  const scelta = acceptedTier === p.tier
                  const scartata = !!acceptedTier && !scelta
                  return (
                    <div
                      key={p.tier}
                      style={{
                        borderLeft: `3px solid ${scelta ? '#2f8a63' : scartata ? '#e4e2dc' : p.tier === 'base' ? '#e0d3b0' : '#cfc3e8'}`,
                        paddingLeft: 11,
                        marginTop: i === 0 ? 4 : 18,
                        opacity: scartata ? 0.55 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 2 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: scelta ? '#2f8a63' : scartata ? 'var(--cc-muted)' : '#b0863e' }}>
                          Proposta {p.label}
                        </span>
                        {scelta && (
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#d4efe2', border: '1px solid #bce3d2', color: '#2f8a63', borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 700 }}>
                            <CheckCircle2 size={11} aria-hidden />
                            {sceltaDalCliente ? 'Scelta dal cliente' : 'Confermata da te'}
                          </span>
                        )}
                        {scartata && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--cc-muted)' }}>Non scelta</span>
                        )}
                      </div>
                      {vociProposta.map((item, k) => (
                        <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '6px 0', fontSize: 14 }}>
                          <span style={{ color: '#161616' }}>{String(item.description ?? '—')}</span>
                          {item.total != null && <span style={{ color: '#161616', whiteSpace: 'nowrap' }}>{euro(Number(item.total))}</span>}
                        </div>
                      ))}
                      {/* ⚠️ Filetto + testo più piccolo e grigio: senza questo stacco
                          «Subtotale» e «Marca da bollo» si leggevano come DUE VOCI in
                          più della proposta (Eli, 7 ago, foto alla mano). Ora ci sono
                          tre livelli distinti: le voci (scure, 14), il conteggio
                          (grigio, 13), il totale (nero, in grassetto). */}
                      <div style={{ height: '0.5px', background: '#ededea', margin: '8px 0 2px' }} />
                      <div style={riepilogoRow}>
                        <span>Subtotale</span>
                        <span style={{ fontWeight: 500 }}>{euro(p.subtotal)}</span>
                      </div>
                      {p.sconto > 0 && (
                        <div style={riepilogoRow}>
                          <span>Sconto{ivaOpts.discount_pct > 0 && !ivaOpts.discount_fixed ? ` (${ivaOpts.discount_pct}%)` : ''}</span>
                          <span style={{ fontWeight: 500, color: '#2f8a63' }}>−{euro(p.sconto)}</span>
                        </div>
                      )}
                      {p.taxAmount > 0 && righeIvaDi(docItems.filter((i) => tierOf(i as unknown as VoceConTier) === p.tier)).map((r) => (
                        <div key={r.rate} style={riepilogoRow}>
                          <span>IVA {r.rate}%</span>
                          <span style={{ fontWeight: 500 }}>{euro(r.imposta)}</span>
                        </div>
                      ))}
                      {p.bollo > 0 && (
                        <div style={riepilogoRow}>
                          <span>Marca da bollo</span>
                          <span style={{ fontWeight: 500 }}>{euro(p.bollo)}</span>
                        </div>
                      )}
                      <div style={{ ...sumRow, fontSize: 15, borderTop: '1px solid #e3e3e6', marginTop: 6, paddingTop: 8 }}>
                        <span style={{ color: '#161616', fontWeight: 700 }}>Totale {p.label}</span>
                        <span style={{ color: '#161616', fontWeight: 700 }}>{euro(p.total)}</span>
                      </div>
                    </div>
                  )
                })}
                {acceptedTierLabel ? (
                  <p style={{ fontSize: 12, color: 'var(--cc-muted)', margin: '14px 0 0', lineHeight: 1.45 }}>
                    {sceltaDalCliente ? 'Il cliente ha scelto' : 'Hai confermato'} la proposta{' '}
                    <b style={{ color: '#2f8a63' }}>{acceptedTierLabel}</b>: da qui in avanti il
                    preventivo vale quella cifra — in Home, nelle liste, nell&rsquo;acconto e
                    nella fattura.
                  </p>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--cc-muted)', margin: '14px 0 0', lineHeight: 1.45 }}>
                    Il cliente sceglie la proposta dalla sua pagina. Fino ad allora il
                    preventivo vale come <b style={{ color: '#55534b' }}>{totaliProposte[0].label}</b>:
                    è la cifra che vedi in Home, nelle liste e nel calcolo dell&rsquo;acconto.
                  </p>
                )}
              </>
            ) : (
              <>
                {docItems.map((item, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', fontSize: 14 }}>
                    <span style={{ color: '#161616' }}>{String(item.description ?? '—')}</span>
                    {item.total != null && <span style={{ color: '#161616', whiteSpace: 'nowrap' }}>{euro(Number(item.total))}</span>}
                  </div>
                ))}
                <div style={{ height: '0.5px', background: '#eee', margin: '6px -15px' }} />
                <div style={sumRow}>
                  <span style={{ color: '#161616', fontWeight: 400 }}>Subtotale</span>
                  <span style={{ color: '#161616', fontWeight: 500 }}>{euro(subtotal)}</span>
                </div>
                {/* Sconto di documento (foto Eli 25 ago: il riepilogo interno lo
                    OMETTEVA — Subtotale 90, IVA, Totale — mentre PDF e pagina
                    del cliente lo mostrano). Stessa formula della pagina
                    pubblica: % sul subtotale + fisso, mai oltre il subtotale. */}
                {scontoDocumento > 0 && (
                  <div style={sumRow}>
                    <span style={{ color: '#161616', fontWeight: 400 }}>Sconto{ivaOpts.discount_pct > 0 && !ivaOpts.discount_fixed ? ` (${ivaOpts.discount_pct}%)` : ''}</span>
                    <span style={{ color: '#2f8a63', fontWeight: 500 }}>−{euro(scontoDocumento)}</span>
                  </div>
                )}
                {taxAmount > 0 && ivaRighe.map((r) => (
                  <div key={r.rate} style={sumRow}>
                    <span style={{ color: '#161616', fontWeight: 400 }}>IVA {r.rate}%</span>
                    <span style={{ color: '#161616', fontWeight: 500 }}>{euro(r.imposta)}</span>
                  </div>
                ))}
                {bolloAmount > 0 && (
                  <div style={sumRow}>
                    <span style={{ color: '#161616', fontWeight: 400 }}>Marca da bollo</span>
                    <span style={{ color: '#161616', fontWeight: 500 }}>{euro(bolloAmount)}</span>
                  </div>
                )}
                {/* TOTALE sotto un filetto navy, su fondo chiaro come il resto
                    (Eli 25 ago sera: la fascia scura era «davvero impattante»).
                    Stessa veste della pagina del cliente. */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 10, paddingTop: 11, borderTop: '2px solid #1a1a2e' }}>
                  <span style={{ fontSize: 11, letterSpacing: '.14em', textTransform: 'uppercase', color: '#8a6b28', fontWeight: 700 }}>Totale</span>
                  <span style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 22, color: '#161616' }}>{euro(totalAmount)}</span>
                </div>
              </>
            )}
            {doc.expires_at && (
              <div style={{ fontSize: 12.5, color: 'var(--cc-muted)', marginTop: 11 }}>Valido fino al {fmtLong(doc.expires_at)}</div>
            )}
          </div>

          {/* ⚠️ «Anteprima», non «come lo vede il cliente» (Eli 25 ago sera):
              la frase secca faceva credere che il cliente avesse SOLO questa
              vista — dal link apre anche il documento completo col template. */}
          <p style={{ margin: '8px 15px 0', textAlign: 'center', fontSize: 12, color: 'var(--cc-muted)' }}>
            Anteprima della pagina del cliente: dal link apre anche il documento completo, col template che hai scelto
          </p>

          {/* Azioni riga 1: Anteprima (bianco bordato) + Condividi (navy pieno).
              Su un preventivo BLOCCATO (Free, oltre gli 8) niente PDF né invio:
              resta la sola consultazione. */}
          {!freeLocked && (
          <div style={{ display: 'flex', gap: 11, padding: '0 15px', marginTop: 16 }}>
            {/* 19 lug: overlay, non navigazione — chiudendo si torna al punto esatto */}
            <AnteprimaButton
              src={`/api/documents/${id}/pdf?preview=1`}
              style={{ ...actionChip, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e', fontWeight: 500 }}
            />
            {doc.public_token && (
              <ShareButton
                documentId={id}
                publicToken={doc.public_token}
                docNumber={doc.doc_number}
                docType="preventivo"
                isDraft={isDraft}
                hasVoci={hasVoci}
                clientName={clientName}
                triggerIcon={<Send size={18} />}
                isExpired={doc.status === 'expired'}
                isModified={!!(doc as any).updated_after_send_at}
                defaultValidityDays={(doc as any).validity_days ?? 30}
                triggerStyle={doc.status === 'accepted'
                  ? { ...actionChip, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e', fontWeight: 500 }
                  : { ...actionChip, background: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e', fontWeight: 600, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)' }}
              />
            )}
          </div>
          )}

          {/* Azioni riga 2: Segna accettato / Segna rifiutato (solo se in attesa) */}
          {(doc.status === 'sent' || doc.status === 'viewed') && (
            <div style={{ display: 'flex', gap: 11, padding: '0 15px', marginTop: 11 }}>
              <MobileStatusChips documentId={id} chipBase={segnaChip} />
            </div>
          )}

          {/* Crea fattura (full-width navy) — solo se accettato e nessuna fattura collegata.
              Bloccato su Free oltre gli 8 (la conversione crea una fattura, vietata). */}
          {doc.status === 'accepted' && doc.doc_type !== 'fattura' && !fatturaOrigin && !freeLocked && (
            <div style={{ padding: '0 15px', marginTop: 11, display: 'flex', flexDirection: 'column', gap: 11 }}>
              {/* Hint una-tantum (progressive disclosure, 2 ago) */}
              <ContextHint id="converti-fattura">
                Preventivo accettato: puoi trasformarlo in fattura con un tocco — voci e cliente passano da soli.
              </ContextHint>
              <ConvertiFatturaButton documentId={id} fullWidth />
            </div>
          )}
          {/* Apri lavoro (sezione Lavori): se il lavoro ESISTE già è un link
              diretto (in ogni stato — Eli 3 ago); altrimenti, su accettato,
              il bottone che lo crea. */}
          {doc.doc_type !== 'fattura' && linkedLavoroId && (
            <div style={{ padding: '0 15px', marginTop: 11 }}>
              <LavoroLinkButton lavoroId={linkedLavoroId} fullWidth />
            </div>
          )}
          {doc.status === 'accepted' && doc.doc_type !== 'fattura' && !linkedLavoroId && (
            <div style={{ padding: '0 15px', marginTop: 11 }}>
              <ApriLavoroButton documentId={id} fullWidth />
            </div>
          )}
          {/* Riporta in bozza — SOLO accettazione manuale ("Segna accettato"
              per errore): mai se il cliente ha accettato dalla pagina pubblica
              (signer_name/accepted_ip = prova FES) o con fattura collegata. */}
          {doc.status === 'accepted' && doc.doc_type !== 'fattura' && !fatturaOrigin && !doc.signer_name && doc.accepted_ip == null && !freeLocked && (
            <div style={{ padding: '0 15px', marginTop: 11 }}>
              <RiportaInBozzaButton documentId={id} fullWidth />
            </div>
          )}
          {/* Link alla fattura già generata */}
          {doc.status === 'accepted' && doc.doc_type !== 'fattura' && fatturaOrigin && (
            <div style={{ padding: '0 15px', marginTop: 11 }}>
              <Link
                href={`/fatture/${fatturaOrigin.id}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: 12, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e', fontSize: 14, fontWeight: 600, textDecoration: 'none', boxSizing: 'border-box', boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)' }}
              >
                <FileCheck2 size={18} />
                Fattura {fatturaOrigin.doc_number ? formatDocNumber(fatturaOrigin.doc_number) : 'bozza'}
              </Link>
            </div>
          )}

          {/* Card Cliente — DOPO il foglio e le azioni (mockup B): tap apre la
              scheda; se il cliente non è in rubrica la card è statica. */}
          {clientName && (
            pdfClient?.id ? (
              <Link href={`/clienti/${pdfClient.id}`} style={{ ...cardStyle, margin: '14px 15px 0', display: 'block', textDecoration: 'none' }}>
                <div style={cardLabel}>Cliente</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#161616' }}>{clientName}</div>
                {clientContact && <div style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 3 }}>{clientContact}</div>}
              </Link>
            ) : (
              <div style={{ ...cardStyle, margin: '14px 15px 0' }}>
                <div style={cardLabel}>Cliente</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#161616' }}>{clientName}</div>
                <div style={{ fontSize: 12, color: '#767676', marginTop: 3 }}>
                  Non è in rubrica · <Link href="/clienti/nuovo" style={{ color: '#1a1a2e', fontWeight: 600, textDecoration: 'none' }}>Aggiungilo →</Link>
                </div>
              </div>
            )
          )}

          {/* Foto lavoro — in fondo (mockup B, Eli 25 ago) */}
          <div style={{ margin: '14px 15px 0' }}>
            <WorkPhotosCard documentId={id} initialPhotos={workPhotos} initialSignedUrls={workPhotoSignedUrls} />
          </div>

          {/* Card Visualizzazioni RIMOSSA (Eli 3 ago sera): le aperture
              vivono DENTRO la cronologia qui sotto, non in una card propria. */}

          {/* Card Messaggi — solo se il cliente ha scritto dal link (5 ago) */}
          {conversation.length > 0 && (
            <div style={{ ...cardStyle, margin: '14px 15px 0' }}>
              {/* anchorId solo QUI (mount mobile): sul desktop c'è una seconda
                  istanza e un id duplicato manderebbe lo scroll su quella nascosta. */}
              <MessaggiCard
                documentId={doc.id}
                messages={conversation}
                clientHasEmail={!!pdfClient?.email}
                clientName={clientName}
                anchorId="messaggi"
              />
            </div>
          )}

          {/* Card Cronologia — DocumentTimeline (unificata il 3 ago sera):
              log completo (modifiche, reinvii, incassi, transizioni manuali),
              ogni apertura del cliente con data e ora, tendina inclusa. */}
          <div data-tour="cronologia" style={{ ...cardStyle, margin: '14px 15px 0' }}>
            <DocumentTimeline
              createdAt={doc.created_at ?? null}
              sentAt={doc.sent_at ?? null}
              acceptedAt={doc.accepted_at ?? null}
              status={doc.status}
              expiresAt={doc.expires_at ?? null}
              rejectionReason={doc.rejection_reason ?? null}
              signerName={doc.signer_name ?? null}
              acceptedIp={doc.accepted_ip != null ? String(doc.accepted_ip) : null}
              acceptedTierLabel={acceptedTierLabel}
              views={(views ?? []) as Array<{ id: string; viewed_at: string }>}
              fatturaRef={fatturaOriginRaw ? { id: fatturaOriginRaw.id, doc_number: fatturaOriginRaw.doc_number ?? null, created_at: fatturaOriginRaw.created_at ?? new Date().toISOString() } : null}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- document_log jsonb nel select *
              documentLog={(Array.isArray((doc as any).document_log) ? (doc as any).document_log : []) as DocumentLogEntry[]}
            />
          </div>
        </div>
      )}

      {/* ── CONTENUTO DESKTOP (sempre) + FORM MODIFICA (mobile solo con ?edit=1) ── */}
      <div className={edit === '1' ? 'p-4 space-y-4 lg:p-6' : 'hidden lg:block space-y-4 lg:p-6'}>
        {/* Banner "creato dal sopralluogo" (mockup cantiere §1.3) */}
        {da_sopralluogo === '1' && (
          <div style={{ background: '#fff', borderLeft: '3px solid #c9a44c', borderRadius: 12, boxShadow: '0 1px 2px rgba(20,20,40,.05)', padding: '12px 14px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#161616' }}>
              Creato dal sopralluogo{doc.title ? ` “${doc.title}”` : ''}
            </div>
            <p style={{ fontSize: 12, color: '#767676', marginTop: 3, lineHeight: 1.5 }}>
              Cliente, appunti (nelle Note interne) e foto già agganciati. Aggiungi le voci e i prezzi.
            </p>
          </div>
        )}

        {/* ── DESKTOP BREADCRUMB + AZIONI (hidden on mobile) ── */}
        <div className="hidden lg:flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/preventivi" className="flex items-center gap-1 hover:text-foreground">
              <ArrowLeft className="size-3.5" /> Preventivi
            </Link>
            <span>/</span>
            <span className="text-foreground font-mono font-semibold">
              {formatDocNumber(doc.doc_number)}
            </span>
            {doc.title && (
              <span className="text-muted-foreground truncate hidden sm:inline">
                · {doc.title}
              </span>
            )}
            <StatusBadge
              status={doc.status}
              className="ml-1"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap sm:justify-end">
            <StatusChangeDropdown documentId={id} currentStatus={doc.status} transitions={freeLocked ? LOCKED_TRANSITIONS : undefined} />
            {publicUrl && (doc.status === 'sent' || doc.status === 'viewed' || doc.status === 'accepted') && (
              <Button variant="outline" size="sm" asChild>
                <Link href={publicUrl} target="_blank">
                  <ExternalLink className="size-4" /> Link cliente
                </Link>
              </Button>
            )}
            {/* Preventivo BLOCCATO (Free, oltre gli 8): niente PDF, invio o
                conversione in fattura. Restano StatusChangeDropdown, Link
                cliente e Scheda lavoro (consultazione/navigazione). */}
            {!freeLocked && (
              <PdfActions
                documentId={id}
                docNumberSlug={docNumberSlug(doc.doc_number ?? doc.id)}
              />
            )}
            {doc.public_token && !freeLocked && (
              <ShareButton
                documentId={id}
                publicToken={doc.public_token}
                docNumber={doc.doc_number}
                docType="preventivo"
                isDraft={isDraft}
                hasVoci={hasVoci}
                clientName={clientName}
                isExpired={doc.status === 'expired'}
                isModified={!!(doc as any).updated_after_send_at}
                defaultValidityDays={(doc as any).validity_days ?? 30}
                initialOpen={send === '1'}
                listenOpenEvent
              />
            )}
            {/* Dialog email SENZA trigger: si apre dall'icona Email del pop-up
                "Invia al cliente" (evento) — montato per ogni stato */}
            {!freeLocked && (doc.status === 'draft' ? (
              <SendEmailDialogController
                documentId={id}
                docNumber={doc.doc_number ? stripPrefissoLegacy(doc.doc_number) : null}
                initialClientEmail={pdfClient?.email ?? null}
                initialClientName={pdfClient ? [pdfClient.name, pdfClient.surname].filter(Boolean).join(' ') : null}
                senderName={workspace.ragione_sociale ?? workspace.name}
                initialHasClient={!!pdfClient}
                hasVoci={hasVoci}
                hideTrigger
              />
            ) : (
              <SendEmailDialog
                documentId={id}
                docNumber={doc.doc_number ? stripPrefissoLegacy(doc.doc_number) : null}
                clientEmail={pdfClient?.email ?? null}
                clientId={pdfClient?.id ?? null}
                recipientName={pdfClient ? [pdfClient.name, pdfClient.surname].filter(Boolean).join(' ') : null}
                hasClient={!!pdfClient}
                senderName={workspace.ragione_sociale ?? workspace.name}
                isResend
                hideTrigger
              />
            ))}
            {doc.status === 'accepted' && doc.doc_type !== 'fattura' && (
              fatturaOrigin ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/fatture/${fatturaOrigin.id}`}>
                    <FileCheck2 className="size-4" />
                    Fattura {fatturaOrigin.doc_number ? formatDocNumber(fatturaOrigin.doc_number) : 'bozza'}
                  </Link>
                </Button>
              ) : freeLocked ? null : (
                <ConvertiFatturaButton documentId={id} />
              )
            )}
            {doc.doc_type !== 'fattura' && linkedLavoroId && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/lavori/${linkedLavoroId}`}>
                  <Hammer className="size-4" />
                  Scheda lavoro
                </Link>
              </Button>
            )}
            {doc.status === 'accepted' && doc.doc_type !== 'fattura' && !linkedLavoroId && (
              <ApriLavoroButton documentId={id} />
            )}
            {/* Riporta in bozza — solo accettazione manuale, senza fattura
                collegata. Bloccato su Free oltre gli 8 (riaprirebbe alla
                modifica un documento in sola lettura). */}
            {doc.status === 'accepted' && doc.doc_type !== 'fattura' && !fatturaOrigin && !doc.signer_name && doc.accepted_ip == null && !freeLocked && (
              <RiportaInBozzaButton documentId={id} />
            )}
          </div>
        </div>

        {/* ── DESKTOP: Intestazione documento ── */}
        <div className="hidden lg:block">
          <h1 className="text-2xl font-bold font-mono">
            {formatDocNumber(doc.doc_number)}
          </h1>
          {doc.title && (
            <p className="text-base text-muted-foreground mt-0.5">{doc.title}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1">
            Creato il{' '}
            {new Date(doc.created_at!).toLocaleDateString('it-IT', {
              day: '2-digit', month: 'long', year: 'numeric'
            , timeZone: 'Europe/Rome' })}
            {doc.expires_at && (
              <>
                {' '}· Valido fino al{' '}
                {new Date(doc.expires_at).toLocaleDateString('it-IT', {
                  day: '2-digit', month: 'long', year: 'numeric'
                , timeZone: 'Europe/Rome' })}
              </>
            )}
          </p>
        </div>

        {/* ── PROMEMORIA QUOTA FREE (desktop) ── */}
        {isFree && freeTrialStatus && !freeTrialStatus.blocked && (
          <div className="hidden lg:flex" style={{ background: '#fff', border: '1px solid #e8e2d4', borderLeft: '3px solid #c9a44c', borderRadius: 9, padding: '9px 13px', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#c9a44c', fontSize: 16, flexShrink: 0 }}>♛</span>
            <span style={{ fontSize: 13, color: 'var(--cc-text-2)', flex: 1 }}>
              {freeTrialStatus.docsUsed}/{FREE_DOC_LIMIT} preventivi gratuiti
            </span>
            <Link href="/abbonamento" style={{ fontSize: 13, fontWeight: 600, color: '#c9a44c', textDecoration: 'none', flexShrink: 0 }}>Passa a Pro →</Link>
          </div>
        )}
        {/* ── BANNER BLOCCO TRIAL FREE (desktop) ── */}
        {isFree && isDraft && freeTrialStatus?.blocked && (
          <div className="hidden lg:flex items-start gap-3 rounded-lg border border-[#ecc9c9] bg-[#f5dede] px-4 py-3 text-sm text-[#b05656]">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <p>
              {freeTrialStatus.reason === 'trial_expired' ? (
                <>
                  <strong>Il periodo di prova è terminato.</strong>{' '}
                  Non puoi scaricare o inviare questo preventivo.{' '}
                </>
              ) : (
                <>
                  <strong>Hai raggiunto il limite di {FREE_DOC_LIMIT} preventivi del piano gratuito.</strong>{' '}
                  Non puoi scaricare o inviare altri preventivi.{' '}
                </>
              )}
              <Link href="/abbonamento" className="font-semibold underline underline-offset-2">
                Passa a Pro
              </Link>{' '}
              per preventivi illimitati.
            </p>
          </div>
        )}

        {/* ── BANNER ACCETTAZIONE (con firma) — desktop ── */}
        {doc.status === 'accepted' && (
          <div className="hidden lg:block">
            <div style={{
              background: '#d4efe2',
              border: '1px solid #bce3d2',
              borderRadius: 10,
              padding: '11px 14px',
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}>
              <CheckCircle2 size={17} style={{ color: '#2f8a63', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2f8a63' }}>
                  {doc.signer_name
                    ? 'Accettato e firmato dal cliente'
                    : doc.accepted_ip != null
                    ? 'Accettato dal cliente'
                    : 'Segnato come accettato da te'}
                </div>
                {acceptedTierLabel && (
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#2f8a63', marginTop: 3 }}>
                    Proposta {acceptedTierLabel}
                    <span style={{ fontWeight: 400 }}>
                      {' '}— {sceltaDalCliente ? 'scelta dal cliente' : 'confermata da te'}
                    </span>
                  </div>
                )}
                {doc.accepted_at && (
                  <div style={{ fontSize: 12, color: '#2f8a63', marginTop: 2 }}>
                    {doc.signer_name && <>{doc.signer_name} · </>}
                    {new Date(doc.accepted_at).toLocaleDateString('it-IT', {
                      day: '2-digit', month: 'long', year: 'numeric',
                     timeZone: 'Europe/Rome' })}
                    {doc.accepted_ip != null && <> · IP {String(doc.accepted_ip)}</>}
                  </div>
                )}
                {doc.signature_image && (
                  <img
                    src={doc.signature_image}
                    alt="Firma cliente"
                    className="mt-2 h-12 object-contain rounded border border-[#bce3d2] bg-white px-2"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── BANNER RIFIUTATO (desktop) ── */}
        {doc.status === 'rejected' && (
          <div className="hidden lg:block rounded-lg border border-[#ecc9c9] bg-[#f5dede] px-4 py-3 text-sm text-[#b05656] space-y-1">
            <p>Il cliente ha rifiutato questo preventivo.</p>
            {doc.rejection_reason && (
              <p className="text-[#b05656]">
                <span className="font-medium">Motivo: </span>
                {doc.rejection_reason}
              </p>
            )}
          </div>
        )}

        {/* ── BANNER SCADUTO (desktop) ── */}
        {doc.status === 'expired' && (
          <div className="hidden lg:block rounded-lg border border-[#e8d6ad] bg-[#f5e9d0] px-4 py-3 text-sm text-[#b0863e]">
            Questo preventivo è scaduto.
          </div>
        )}

        {/* ── BANNER INVIATO (non ancora modificato) — desktop ── */}
        {(doc.status === 'sent' || doc.status === 'viewed') && !(doc as any).updated_after_send_at && (
          <div className="hidden lg:flex items-start gap-3 rounded-lg border border-[#c3d9f2] bg-[#d8e8fb] px-4 py-3 text-sm text-[#3f6fb0]">
            <Info className="size-4 shrink-0 mt-0.5" />
            <p>
              Questo preventivo è stato inviato. Se lo modifichi, il cliente vedrà
              subito la versione aggiornata dal link: reinvialo per avvisarlo del cambiamento.
            </p>
          </div>
        )}

        {/* ── BANNER MODIFICATO dopo l'invio — desktop ──
            Non su ACCETTATO (review 25 lug #1 trasversale): il ripristino
            è bloccato dal server (trigger 057) e fallirebbe per sempre. */}
        {(doc as any).updated_after_send_at && doc.status !== 'accepted' && (
          <div className="hidden lg:block rounded-lg border border-[#e2d7f4] bg-[#f6f2fc] px-4 py-3 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#ddd0f4] px-2.5 py-1 text-[13px] font-bold text-[#161616]">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              Modificato — cliente non avvisato
            </span>
            <p className="mt-2 text-[#3f3d36]">
              Documento aggiornato il{' '}
              {new Date((doc as any).updated_after_send_at).toLocaleString('it-IT', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' } as Intl.DateTimeFormatOptions)}, dopo
              l&rsquo;invio al cliente. Chi riapre il link vede già la versione aggiornata, ma il
              cliente non ha ricevuto alcuna comunicazione: si consiglia di inviare nuovamente
              il preventivo.
            </p>
            <div className="mt-2">
              <RestoreVersionButton documentId={id} />
            </div>
          </div>
        )}

        {/* Form preventivo — desktop sempre; mobile solo con ?edit=1 */}
        <div className={edit !== '1' ? 'hidden lg:block' : undefined}>
          <PreventivoForm
            mode="edit"
            documentId={id}
            defaultValues={doc as any}
            templates={(templates ?? []) as Array<{ id: string; name: string; is_default: boolean | null }>}
            defaultTemplateId={defaultTemplateId}
            fiscalRegime={workspace.fiscal_regime}
            isProPlan={workspace.plan !== 'free'}
            forceReadOnly={freeLocked}
            defaultClient={formDefaultClient}
            linkedPhotoCount={Math.min(workPhotos.length, 6)}
            supplierLists={supplierLists}
          />
        </div>

        {/* Acconto — anche su DESKTOP: prima esisteva solo nella vista mobile
            (registrare un acconto dal PC era impossibile) */}
        {accontoInfo && (
          <div className="hidden lg:block">
            <AccontoCard
              documentId={id}
              acconto={accontoInfo.acconto}
              saldo={accontoInfo.saldo}
              received={accontoInfo.received}
            />
          </div>
        )}
        {/* Foto lavoro — visibile ANCHE su mobile in modifica (Eli, 17 ago:
            «creo un preventivo dal sopralluogo e le foto mancano» — le foto
            erano collegate davvero, ma l'atterraggio del sopralluogo è
            ?edit=1 e questa card stava in un blocco solo-desktop: sembravano
            perse). Su mobile in lettura resta la copia della vista read
            (questo contenitore lì non è renderizzato). */}
        <WorkPhotosCard documentId={id} initialPhotos={workPhotos} initialSignedUrls={workPhotoSignedUrls} />

        {/* Messaggi col cliente — desktop */}
        {conversation.length > 0 && (
          <div className="hidden lg:block space-y-4">
            <Separator />
            <MessaggiCard
              documentId={doc.id}
              messages={conversation}
              clientHasEmail={!!pdfClient?.email}
              clientName={clientName}
            />
          </div>
        )}

        {/* Cronologia completa — desktop */}
        <div className="hidden lg:block space-y-4" data-tour="cronologia">
          <Separator />
          <DocumentTimeline
            createdAt={doc.created_at ?? null}
            sentAt={doc.sent_at ?? null}
            acceptedAt={doc.accepted_at ?? null}
            status={doc.status}
            expiresAt={doc.expires_at ?? null}
            rejectionReason={doc.rejection_reason ?? null}
            signerName={doc.signer_name ?? null}
            acceptedIp={doc.accepted_ip != null ? String(doc.accepted_ip) : null}
            acceptedTierLabel={acceptedTierLabel}
            views={(views ?? []) as Array<{ id: string; viewed_at: string }>}
            fatturaRef={fatturaOriginRaw ? { id: fatturaOriginRaw.id, doc_number: fatturaOriginRaw.doc_number ?? null, created_at: fatturaOriginRaw.created_at ?? new Date().toISOString() } : null}
            documentLog={(Array.isArray((doc as any).document_log) ? (doc as any).document_log : []) as DocumentLogEntry[]}
          />

          {/* Storico aperture dedicato RIMOSSO (Eli 3 ago sera): le
              visualizzazioni stanno dentro la cronologia qui sopra. I dati
              per-apertura (IP, device) restano registrati in document_views
              a fini probatori. */}

        </div>

      </div>
    </div>
  )
}
