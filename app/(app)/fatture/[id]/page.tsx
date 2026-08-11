import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { signPhotoPaths } from '@/lib/photos/signed-url'
import Link from 'next/link'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { ArrowLeft, FileText, AlertTriangle, Pencil, X, ChevronLeft, Banknote, Hammer, Link as LinkIcon } from 'lucide-react'
import { LinkToPreventivoButton } from '../_components/LinkToPreventivoButton'
import { LavoroLinkButton } from '@/app/(app)/preventivi/_components/LavoroLinkButton'
import { SegnaPagataButton } from '../_components/SegnaPagataButton'
import { AnnullaFatturaButton } from '../_components/AnnullaFatturaButton'
import { NotaCreditoButton } from '../_components/NotaCreditoButton'
import { SegnaNonPagataButton } from '../_components/SegnaNonPagataButton'
import { CorreggiIncassoButton } from '../_components/CorreggiIncassoButton'
import { RiattivaFatturaButton } from '../_components/RiattivaFatturaButton'
import { ContextHint } from '@/components/shared/ContextHint'
import { StatusBadge } from '@/app/(app)/preventivi/_components/StatusBadge'
import { PdfActions } from '@/app/(app)/preventivi/_components/PdfActions'
import { PreventivoForm } from '@/app/(app)/preventivi/_components/PreventivoForm'
import { ShareButton } from '@/app/(app)/preventivi/_components/ShareButton'
import { StatusChangeDropdown } from '@/app/(app)/preventivi/_components/StatusChangeDropdown'
import { SendEmailDialog } from '@/app/(app)/preventivi/_components/SendEmailDialog'
import { RestoreVersionButton } from '@/app/(app)/preventivi/_components/RestoreVersionButton'
import { DocumentTimeline } from '@/app/(app)/preventivi/_components/DocumentTimeline'
import { MessaggiCard } from '@/app/(app)/preventivi/_components/MessaggiCard'
import { conversationFromLog } from '@/lib/documents/messaggi'
import { SendEmailDialogController } from '@/app/(app)/preventivi/_components/SendEmailDialogController'
import { WorkPhotosCard } from '@/app/(app)/preventivi/_components/WorkPhotosCard'
import { AnteprimaButton } from '@/app/(app)/preventivi/_components/AnteprimaButton'
import { SdiCard, type SdiCardProps } from '../_components/SdiCard'
import { getSdiQuota, SDI_FREE_LIFETIME } from '@/lib/sdi/quota'
import { sdiAmbiente } from '@/lib/sdi'
import { SDI_SEND_ATTEMPT_MARKER } from '@/lib/sdi/types'
import type { DocumentLogEntry } from '@/app/(app)/preventivi/_components/DocumentTimeline'
import { Separator } from '@/components/ui/separator'
import type { DocStatus } from '@/app/(app)/preventivi/_components/StatusBadge'
import { ChiediRecensioneButton } from '../_components/ChiediRecensioneButton'
import { formatDocNumber, stripPrefissoLegacy } from '@/lib/utils'
import { BackButton } from '@/components/shared/BackButton'
import { ArchivioBanner } from '@/components/shared/ArchivioBanner'
import { docNumberSlug } from '@/lib/documents/numero'
import { residuoStornabile, sommaNoteAttive, baseStornabile, TOLLERANZA_STORNO } from '@/lib/documents/storno'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ send?: string; edit?: string }>
}

export default async function FatturaDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { send, edit } = await searchParams
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/login')

  // PERF: documento (con cliente JOINato), template, aperture e foto lavoro
  // sono tutti keyati su id di route / workspace → UN solo round trip
  // (prima erano tre onde in serie).
  const [{ data: doc }, { data: templates }, { data: viewsRaw }, workPhotosData, vetrina] = await Promise.all([
    supabase
      .from('documents')
      .select('*, document_items(*), clients(id, name, surname, email, phone, piva, indirizzo, cap, citta, provincia)')
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .in('doc_type', ['fattura', 'nota_credito'])
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('templates')
      .select('id, name, is_default, color_primary, show_logo, show_watermark, legal_notice, preset_key, font_family, logo_position')
      .eq('workspace_id', workspace.id)
      .order('is_default', { ascending: false }),
    // Storico aperture (mostrato solo per documenti non in bozza)
    supabase
      .from('document_views')
      .select('id, viewed_at')
      .eq('document_id', id)
      .order('viewed_at', { ascending: false }),
    // Foto lavoro (tabella 041 — tollerante pre-migration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 041 non ancora in types/database.ts
    (supabase as any)
      .from('work_photos')
      .select('id, storage_path, label, visible_to_client, sopralluogo_id')
      .eq('document_id', id)
      .order('created_at', { ascending: true })
      .then((r: { data: unknown[] | null }) => r.data, () => null),
    // Vetrina pubblicata? Serve solo a decidere se ha senso parlare di
    // recensioni (vedi hint più sotto). Tollerante: se la tabella del
    // marketplace non c'è, si comporta come "non pubblicata".
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella marketplace non in types/database.ts
    (supabase as any)
      .from('marketplace_profiles')
      .select('enabled, published_at')
      .eq('workspace_id', workspace.id)
      .maybeSingle()
      .then((r: { data: { enabled?: boolean; published_at?: string | null } | null }) => r.data, () => null),
  ])

  if (!doc) notFound()

  // Archiviato? (075). La select principale è un `select('*')`: la colonna
  // arriva già, e se la migration non ci fosse arriverebbe semplicemente
  // `undefined` — nessuna query in più e tolleranza gratis.
  const archiviato = !!(doc as { archived_at?: string | null }).archived_at

  // Pubblicata = interruttore acceso E pubblicazione confermata (stesse due
  // condizioni con cui /professionisti/[id] decide se la vetrina esiste).
  const vetrinaPubblicata = !!vetrina?.enabled && !!vetrina?.published_at

  const activeTemplate = templates?.find((t) => t.id === (doc as any).template_id)
    ?? templates?.find((t) => t.is_default)
    ?? templates?.[0]
    ?? null

  const defaultTemplate = templates?.find(
    (t) => t.is_default && t.name !== 'Template predefinito'
  ) ?? null

  // Preventivo di origine (se la fattura è stata generata da conversione) +
  // le SUE foto lavoro (19 lug, Eli: "in fattura tutto deve essere trasportato
  // dal preventivo" — le foto restano collegate al preventivo, qui si vedono
  // e si gestiscono anche dalla fattura). Uniche query che dipendono da `doc`.
  const [{ data: _originDoc }, originPhotosData, linkedLavoro] = doc.origin_document_id
    ? await Promise.all([
        supabase
          .from('documents')
          .select('id, doc_number, title, total, bollo_amount')
          .eq('id', doc.origin_document_id)
          .eq('workspace_id', workspace.id)
          .is('deleted_at', null)
          .maybeSingle(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 041 non ancora in types/database.ts
        (supabase as any)
          .from('documents')
          .select('id')
          .eq('id', doc.origin_document_id)
          .is('deleted_at', null)
          .maybeSingle()
          .then(
            (r: { data: { id: string } | null }) => r.data
              ? (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
                  .from('work_photos')
                  .select('id, storage_path, label, visible_to_client, sopralluogo_id')
                  .eq('document_id', doc.origin_document_id)
                  .order('created_at', { ascending: true })
                  .then((p: { data: unknown[] | null }) => p.data, () => null)
              // Origine nel CESTINO (review 25 lug M5): niente foto — il
              // banner dice già "non collegata", mostrarle sarebbe incoerente.
              : null,
            () => null
          ),
        // Lavoro collegato (048): il lavoro vive sul PREVENTIVO di origine →
        // dalla fattura ci si arriva con un tasto (richiesta Eli 3 ago).
        // Tollerante pre-migration.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 048 non ancora in types/database.ts
        (supabase as any)
          .from('lavori')
          .select('id')
          .eq('document_id', doc.origin_document_id)
          .eq('workspace_id', workspace.id)
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle()
          .then((r: { data: { id: string } | null }) => r.data, () => null),
      ])
    : [{ data: null }, null, null]

  // Cliente JOINato nel documento.
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'
  const pdfClient = (doc as unknown as {
    clients: { id: string; name: string; surname: string | null; email: string | null; phone: string | null; piva: string | null; indirizzo: string | null; cap: string | null; citta: string | null; provincia: string | null } | null
  }).clients
  // Aperture SEMPRE in cronologia, anche in bozza (fattura riattivata):
  // la storia del documento non si cancella (Eli 3 ago notte).
  const viewsData = viewsRaw ?? []

  // Conversazione col cliente (messaggi dalla pagina pubblica + risposte).
  // ⚠️ Si usa l'helper, non il log grezzo: nel registro ci sono anche gli
  // incassi, che non c'entrano con i messaggi.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- document_log jsonb nel select *
  const conversation = conversationFromLog((doc as any).document_log)

  const formDefaultClient = pdfClient
    ? { id: pdfClient.id, name: pdfClient.name, surname: pdfClient.surname ?? null, email: pdfClient.email ?? null, phone: pdfClient.phone ?? null, piva: pdfClient.piva ?? null }
    : null

  const clientName = pdfClient
    ? [pdfClient.name, pdfClient.surname].filter(Boolean).join(' ')
    : null

  const views: Array<{ id: string; viewed_at: string }> = viewsData ?? []
  const originDoc: { id: string; doc_number: string | null; title: string | null } | null = _originDoc

  // ── Foto lavoro (tabella 041 — fetch tollerante): prima quelle del
  // preventivo di origine, poi quelle caricate direttamente sulla fattura ──
  type WorkPhotoRow = { id: string; storage_path: string; label: 'prima' | 'dopo' | null; visible_to_client: boolean; sopralluogo_id: string | null; readonly?: boolean }
  const workPhotos: WorkPhotoRow[] = [
    // Foto del preventivo di origine: di sola lettura dalla fattura (finding
    // M2 — la ✕/occhio dalla fattura non deve staccare/eliminare/nascondere
    // la foto sul preventivo, dove ha effetto anche sulla pagina pubblica).
    ...((originPhotosData ?? []) as WorkPhotoRow[]).map((p) => ({ ...p, readonly: true })),
    ...((workPhotosData ?? []) as WorkPhotoRow[]),
  ]

  // Firma delle foto già presenti con l'admin: in un team le foto stanno nella
  // cartella di chi le ha caricate, e il client di un collaboratore non
  // potrebbe firmarle (archivio privato, migration 068). Le foto caricate DOPO,
  // nella stessa sessione, le firma il client (propria cartella).
  const workPhotoSignedUrls = Object.fromEntries(
    await signPhotoPaths(createAdminClient(), workPhotos.map((p) => p.storage_path)),
  )

  // ── SdI (colonne 044 — tollerante; feature dietro NEXT_PUBLIC_SDI_ENABLED) ──
  let sdiProps: SdiCardProps | null = null
  // Non su bozze (non trasmissibili) né su ANNULLATE (review 25 lug A3: la
  // card offriva "Invia allo SdI" su una fattura che l'app dichiara annullata
  // → trasmissione di un documento annullato e auto-trappola senza uscita).
  // ⚠️ Il gate sullo STATO si applica solo all'OFFERTA di trasmettere: se la
  // fattura è già stata trasmessa la card resta comunque, in qualsiasi stato —
  // è il registro di ciò che è partito, e nasconderlo (com'è successo a Eli
  // l'8 ago tornando "non pagata") fa sparire una storia che esiste davvero.
  if (process.env.NEXT_PUBLIC_SDI_ENABLED === 'true') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
      const db = supabase as any
      const [{ data: sdiRow }, { data: clientRow }, quota] = await Promise.all([
        db.from('documents').select('sdi_status, sdi_error, sdi_sent_at, sdi_provider_id, sdi_updated_at').eq('id', id).maybeSingle(),
        doc.client_id
          ? db.from('clients').select('codice_destinatario, pec').eq('id', doc.client_id).maybeSingle()
          : Promise.resolve({ data: null }),
        getSdiQuota(workspace.id, workspace.plan),
      ])
      // Orfana SBLOCCABILE: 'inviata' senza alcuna traccia di invio (né sent_at
      // né provider_id), SENZA il marker "tentativo avviato" (= il crash è
      // avvenuto PRIMA della chiamata al provider) e ferma da più di 10 minuti
      // (esclude un invio ancora in volo). Stesse condizioni della route reclaim.
      const sdiUpdatedMs = sdiRow?.sdi_updated_at ? Date.parse(sdiRow.sdi_updated_at) : NaN
      const sdiOrphan =
        sdiRow?.sdi_status === 'inviata' &&
        !sdiRow?.sdi_sent_at &&
        !sdiRow?.sdi_provider_id &&
        sdiRow?.sdi_error !== SDI_SEND_ATTEMPT_MARKER &&
        Number.isFinite(sdiUpdatedMs) &&
        Date.now() - sdiUpdatedMs > 10 * 60_000

      const giaTrasmessa = !!sdiRow?.sdi_status
      const puoTrasmettere = doc.status !== 'draft' && doc.status !== 'rejected'
      if (!giaTrasmessa && !puoTrasmettere) throw new Error('card non pertinente')

      sdiProps = {
        documentId: id,
        sdiStatus: sdiRow?.sdi_status ?? null,
        sdiError: sdiRow?.sdi_error ?? null,
        sdiSentAt: sdiRow?.sdi_sent_at ?? null,
        sdiOrphan,
        sdiAttempted: sdiRow?.sdi_error === SDI_SEND_ATTEMPT_MARKER,
        quotaReason: quota.allowed ? null : quota.reason,
        isPro: workspace.plan !== 'free',
        freeRemaining: quota.allowed ? quota.remaining : 0,
        freeTotal: SDI_FREE_LIFETIME,
        clientDestinatario: clientRow?.codice_destinatario ?? null,
        clientPec: clientRow?.pec ?? null,
        ambiente: sdiAmbiente(),
        isNotaCredito: doc.doc_type === 'nota_credito',
      }
    } catch { /* migration 044 assente, o card non pertinente su questa fattura */ }
  }

  // Nota di credito (TD04): stesso impianto di una fattura, ma niente incassi
  // e niente storno di sé stessa. Lo SdI invece SERVE — una nota che resta
  // nell'app non storna nulla: per l'Agenzia la fattura è ancora intera.
  const isNotaCredito = doc.doc_type === 'nota_credito'
  const isDraft = doc.status === 'draft'
  const isCancelled = doc.status === 'rejected'
  // ⚖️ Fattura già trasmessa allo SdI (stato ≠ "scartata") = emessa: niente
  // riattivazione, solo nota di credito. Oggi lo SdI è spento → sempre falso.
  const sdiTransmitted = !!(doc as any).sdi_status && (doc as any).sdi_status !== 'scartata' // eslint-disable-line @typescript-eslint/no-explicit-any
  const canReactivate = isCancelled && !sdiTransmitted

  // ── MULTI-NOTA: le note di credito di questa fattura + il residuo ────────
  // (decisione Eli, 10 ago). Su una FATTURA trasmessa: elenco delle sue note
  // e residuo stornabile — il tasto «Crea nota di credito» vive finché c'è
  // residuo, poi resta spento e spiegato. Su una NOTA: le sorelle servono
  // all'avviso «superi il residuo» (il blocco vero è alla trasmissione).
  type NotaSorella = { id: string; doc_number: string | null; total: number | null; status: string }
  let noteFattura: NotaSorella[] = []
  let residuoStorno: number | null = null
  if (sdiTransmitted && !isNotaCredito) {
    const { data: nf } = await supabase
      .from('documents')
      .select('id, doc_number, total, status')
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'nota_credito')
      .eq('origin_document_id', id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true })
    noteFattura = (nf ?? []) as NotaSorella[]
    // Base = totale − bollo: il bollo non è un'operazione stornabile (le note
    // hanno bollo 0), e senza la sottrazione una fattura forfettaria stornata
    // per intero mostrava un residuo fantasma di 2 €.
    residuoStorno = residuoStornabile(
      baseStornabile(Number(doc.total ?? 0), Number((doc as { bollo_amount?: number | null }).bollo_amount ?? 0)),
      sommaNoteAttive(noteFattura),
    )
  }
  // Sulla nota: quanto residuo ha a disposizione QUESTA nota (fattura meno le
  // altre attive). Se i suoi importi lo superano, avviso ambra — la
  // trasmissione verrebbe bloccata.
  let notaOltreResiduo: { residuo: number } | null = null
  if (isNotaCredito && !sdiTransmitted && doc.origin_document_id && _originDoc) {
    const { data: sorelle } = await supabase
      .from('documents')
      .select('id, total, status')
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'nota_credito')
      .eq('origin_document_id', doc.origin_document_id)
      .is('deleted_at', null)
      .neq('id', id)
    const og = _originDoc as { total?: number | null; bollo_amount?: number | null }
    const residuoNota = residuoStornabile(
      baseStornabile(Number(og.total ?? 0), Number(og.bollo_amount ?? 0)),
      sommaNoteAttive((sorelle ?? []) as Array<{ total: number | null; status: string }>),
    )
    if (doc.status !== 'rejected' && Number(doc.total ?? 0) > residuoNota + TOLLERANZA_STORNO) {
      notaOltreResiduo = { residuo: residuoNota }
    }
  }
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
  // PRIMO invio (bozza): TUTTE le voci complete (le bozze possono avere voci AI
  // "da completare"). RE-INVIO di un documento già inviato: basta una voce
  // completa (comportamento storico), per non bloccare righe a 0 legittime.
  const hasVoci = isDraft
    ? meaningfulDocItems.length > 0 && meaningfulDocItems.every(isCompleteVoce)
    : docItems.some(isCompleteVoce)

  // ⚠️ Una NOTA DI CREDITO non si «incassa»: è denaro che torna al cliente,
  // non che arriva. Offrire «Segna come pagata» qui era doppiamente sbagliato
  // — le parole non tornano, e lo stato «pagata» avrebbe fatto entrare la nota
  // nel Bilancio come un'ENTRATA, cioè con il segno opposto al suo.
  const NOTA_CREDITO_TRANSITIONS: Partial<Record<DocStatus, { status: DocStatus; label: string }[]>> = {
    draft:   [{ status: 'rejected', label: 'Annulla la nota di credito' }],
    sent:    [{ status: 'rejected', label: 'Annulla la nota di credito' }],
    viewed:  [{ status: 'rejected', label: 'Annulla la nota di credito' }],
    expired: [{ status: 'rejected', label: 'Annulla la nota di credito' }],
  }

  const FATTURA_TRANSITIONS: Partial<Record<DocStatus, { status: DocStatus; label: string }[]>> = {
    draft: [
      { status: 'accepted', label: 'Segna come pagata' },
      { status: 'rejected', label: 'Annulla fattura' },
    ],
    sent: [
      { status: 'accepted', label: 'Segna come pagata' },
      { status: 'rejected', label: 'Annulla fattura' },
    ],
    viewed: [
      { status: 'accepted', label: 'Segna come pagata' },
      { status: 'rejected', label: 'Annulla fattura' },
    ],
    // Fattura scaduta = pagamento in ritardo: deve restare incassabile
    expired: [
      { status: 'accepted', label: 'Segna come pagata' },
      { status: 'rejected', label: 'Annulla fattura' },
    ],
    // Uscita dal "pagata per errore" (review 25 lug #3): azzera l'incasso e
    // torna "da incassare".
    accepted: [
      { status: 'sent', label: 'Segna come non pagata' },
    ],
  }

  // Le stesse transizioni SENZA «Annulla fattura», per le fatture trasmesse
  // allo SdI: una fattura emessa si storna con la nota di credito, non si
  // annulla — e il tasto per crearla è già sulla pagina. «Segna come pagata»
  // resta: una fattura trasmessa si incassa eccome.
  const FATTURA_TRANSITIONS_TRASMESSA: typeof FATTURA_TRANSITIONS = Object.fromEntries(
    Object.entries(FATTURA_TRANSITIONS).map(([k, v]) => [
      k,
      v.filter((t) => t.status !== 'rejected' && t.status !== 'draft'),
    ])
  )

  const chipBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 5, flex: 1, borderRadius: 9, padding: '10px 6px',
    fontSize: 13, fontWeight: 500, textDecoration: 'none',
    border: '0.5px solid var(--cc-border-color)',
    background: 'white', color: 'var(--cc-navy)', cursor: 'pointer',
    whiteSpace: 'nowrap', height: 'auto',
  }

  // Bottoni azione mobile (mockup 05): 48px, radius 13
  const mobileActionBase: React.CSSProperties = {
    flex: 1, boxSizing: 'border-box', height: 48, borderRadius: 13,
    padding: '0 13px', fontSize: 14, display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 8, background: '#fff',
    border: '1px solid #e7e7ea', color: '#1a1a2e', fontWeight: 500,
    textDecoration: 'none', cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)',
  }
  const mobileActionPrimary: React.CSSProperties = {
    flex: 1, boxSizing: 'border-box', height: 48, borderRadius: 13,
    padding: '0 13px', fontSize: 14, display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 8, background: '#1a1a2e', color: '#fff',
    border: '1px solid #1a1a2e', fontWeight: 600, textDecoration: 'none',
    cursor: 'pointer', boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
  }

  // Etichetta IVA: mostra la percentuale se uniforme su tutte le voci, altrimenti generica
  const vatRates = Array.from(new Set(docItems.map(it => Number(it.vat_rate ?? 0))))
  const ivaLabel = vatRates.length === 1 ? `IVA ${vatRates[0]}%` : 'IVA'

  // Modalità MODIFICA vera: solo negli stati dove il form può comparire.
  // Con ?edit=1 stantio in URL (back del browser dopo Annulla/Segna pagata)
  // i gate "nascondi le card di lettura" NON devono scattare — prima
  // lasciavano una pagina quasi vuota, col banner "Puoi riattivarla" ma
  // senza il bottone Riattiva (review 3 ago).
  // ⚖️ Una fattura TRASMESSA allo SdI non è modificabile (il server rifiuta
  // dal salvataggio): la modifica non si offre nemmeno — regola dell'8 ago,
  // «se non si dovrebbe fare, non lo permettiamo». Vale anche per l'URL
  // ?edit=1 digitato a mano.
  const editing = edit === '1' && doc.status !== 'accepted' && doc.status !== 'rejected' && !sdiTransmitted

  return (
    <div className="max-w-4xl mx-auto">

      {/* ── MOBILE HEADER (lg:hidden) ── */}
      <div
        className="lg:hidden flex items-center gap-2.5"
        style={{ background: '#fff', borderBottom: '2px solid #c9a44c', padding: '12px 15px' }}
      >
        <BackButton fallback="/fatture" />
        {/* Simbolo tipo documento (A2, 5 lug): banconota ORO = fattura */}
        <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 7, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>
          <Banknote size={19} style={{ color: '#b08d3e', flexShrink: 0 }} aria-hidden />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {formatDocNumber(doc.doc_number, doc.doc_type) !== '—' ? formatDocNumber(doc.doc_number, doc.doc_type) : 'Bozza'}
          </span>
        </span>
        {edit !== '1' && doc.status !== 'accepted' && doc.status !== 'rejected' && !sdiTransmitted && (
          <Link
            href={`/fatture/${id}?edit=1`}
            style={{ width: 34, height: 34, borderRadius: '50%', background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#55534b' }}
            aria-label="Modifica fattura"
          >
            <Pencil size={18} />
          </Link>
        )}
        {/* ✕ per uscire dalla modifica — come sul dettaglio preventivo */}
        {edit === '1' && (
          <Link
            href={`/fatture/${id}`}
            style={{ width: 34, height: 34, borderRadius: '50%', background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#55534b' }}
            aria-label="Chiudi modifica"
          >
            <X size={18} />
          </Link>
        )}
      </div>

      {/* ── MOBILE: badge stato + data (lg:hidden) ── */}
      <div className="lg:hidden" style={{ margin: '14px 15px 0', display: 'flex', alignItems: 'center', gap: 9 }}>
        <StatusBadge status={doc.status} docType={doc.doc_type} />
      </div>

      {/* Hint una-tantum (progressive disclosure, 2 ago) alla prima fattura saldata.
          ⚠️ Compare SOLO col profilo pubblicato nella vetrina (feedback Eli 7 ago:
          "mi dice che il cliente può recensirmi anche se il mio profilo non è
          pubblicato"). La recensione si può lasciare comunque, ma finché la vetrina
          è spenta non la vede nessuno: annunciarla sarebbe una promessa vuota.
          Testo accorciato e con il collegamento al posto delle istruzioni scritte
          ("non mi piacciono frasi così lunghe, piuttosto mettiamo il link"). */}
      {doc.status === 'accepted' && vetrinaPubblicata && (
        <div className="lg:hidden" style={{ margin: '11px 15px 0' }}>
          <ContextHint id="recensione-sbloccata">
            Fattura saldata: ora il cliente può recensirti dal suo link.{' '}
            <Link href="/recensioni" style={{ fontWeight: 600, color: '#6b5626', textDecoration: 'underline' }}>
              Le tue recensioni
            </Link>
          </ContextHint>
        </div>
      )}

      {/* Card "Chiedi una recensione" (7 ago). Il riquadro per recensire compare
          sul link pubblico solo DOPO che la fattura è segnata pagata — quando il
          cliente quel link l'ha già chiuso: senza un invito la funzione era viva
          nel codice e morta nella realtà. L'invito lo manda l'artigiano (regola
          B.0: niente email automatiche verso i clienti finali finché non risponde
          l'avvocato) e passa da WhatsApp, il canale che converte di più. */}
      {doc.status === 'accepted' && vetrinaPubblicata && doc.public_token && !isCancelled && (
        <div style={{ margin: '11px 15px 0' }}>
          <ChiediRecensioneButton
            publicUrl={`${appUrl}/p/${doc.public_token}`}
            clientName={pdfClient?.name ?? null}
            clientPhone={pdfClient?.phone ?? null}
            clientEmail={pdfClient?.email ?? null}
            workspaceName={workspace.ragione_sociale ?? workspace.name}
          />
        </div>
      )}

      {/* ── MOBILE: card "Preventivo collegato" (lg:hidden) — Apri + Cambia ──
          In modifica (?edit=1) le card di sola lettura SPARISCONO così il form
          appare subito sotto la testata (Eli 3 ago: "le schermate di modifica
          mi appaiono in basso e non me ne accorgo"). */}
      <div
        className={editing ? 'hidden' : 'lg:hidden'}
        style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '15px 15px', display: 'flex', alignItems: 'center', gap: 12 }}
      >
        <LinkIcon size={20} style={{ color: originDoc ? '#3f6fb0' : 'var(--cc-muted)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64' }}>
            {isNotaCredito ? 'Fattura stornata' : 'Preventivo collegato'}
          </div>
          {originDoc ? (
            <div style={{ fontSize: 15, fontWeight: 600, color: '#161616', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {originDoc.doc_number ? formatDocNumber(originDoc.doc_number, isNotaCredito ? 'fattura' : 'preventivo') : (originDoc.title ?? 'bozza')}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: 'var(--cc-muted)', marginTop: 2 }}>Nessuno</div>
          )}
        </div>
        {originDoc && (
          <Link href={isNotaCredito ? `/fatture/${originDoc.id}` : `/preventivi/${originDoc.id}`} style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', textDecoration: 'none', flexShrink: 0 }}>
            Apri
          </Link>
        )}
        {/* ⚠️ Sulla NOTA DI CREDITO il collegamento NON si cambia: `origin_document_id`
            è il riferimento fiscale alla fattura stornata, quello che finisce in
            `DatiFattureCollegate` dell'XML. Cambiarlo (o toglierlo) renderebbe la
            nota orfana, o peggio dichiarerebbe all'Agenzia lo storno di un altro
            documento. Il server lo impediva già; qui sparisce anche il tasto. */}
        {!isNotaCredito && (
          <LinkToPreventivoButton
            fatturaId={id}
            workspaceId={workspace.id}
            currentPreventivoId={doc.origin_document_id}
            compact
            triggerStyle={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e7e7ea', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#1a1a2e', background: '#fff', cursor: 'pointer', flexShrink: 0 }}
          />
        )}
      </div>


      <div className="p-4 lg:p-6 space-y-4">

        {/* ── DESKTOP BREADCRUMB + AZIONI (hidden on mobile) ── */}
        <div className="hidden lg:flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Link href="/fatture" className="flex items-center gap-1 hover:text-foreground">
              <ArrowLeft className="size-3.5" /> Fatture
            </Link>
            <span>/</span>
            <span className="text-foreground font-mono font-semibold">
              {formatDocNumber(doc.doc_number, doc.doc_type)}
            </span>
            <StatusBadge status={doc.status} className="ml-1" docType={doc.doc_type} />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <PdfActions
              documentId={id}
              docNumberSlug={docNumberSlug(doc.doc_number ?? doc.id)}
              docType={doc.doc_type}
            />
            {/* 19 lug: su una fattura ANNULLATA niente "Invia al cliente" (il
                cliente vedrebbe "annullata"): o si riattiva, o resta com'è. */}
            {doc.public_token && !isCancelled && (
              <ShareButton
                documentId={id}
                publicToken={doc.public_token}
                docNumber={doc.doc_number}
                docType={doc.doc_type}
                isDraft={isDraft}
                isExpired={doc.status === 'expired'}
                isModified={!!(doc as any).updated_after_send_at}
                hasVoci={hasVoci}
                clientName={clientName}
                initialOpen={send === '1'}
                listenOpenEvent
              />
            )}
            {canReactivate && <RiattivaFatturaButton documentId={id} />}
            {/* Dialog email SENZA trigger: si apre dall'icona Email del pop-up
                "Invia al cliente" (evento) — montato per ogni stato */}
            {doc.status === 'draft' ? (
              <SendEmailDialogController
                documentId={id}
                docNumber={doc.doc_number ? stripPrefissoLegacy(doc.doc_number) : null}
                initialClientEmail={pdfClient?.email ?? null}
                initialClientName={pdfClient ? pdfClient.name : null}
                initialHasClient={!!doc.client_id}
                senderName={workspace.ragione_sociale ?? workspace.name}
                docType={doc.doc_type}
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
                docType={doc.doc_type}
                isResend
                hideTrigger
              />
            )}
            <StatusChangeDropdown
              documentId={id}
              currentStatus={doc.status}
              // ⚖️ Trasmessa allo SdI: «Annulla» non si offre. Il server lo
              // rifiuta comunque (409), ma scoprire il divieto DOPO la
              // conferma è ciò che la regola dell'8 ago vieta («se non si
              // dovrebbe fare, non lo permettiamo»). Su MOBILE era già così
              // (il tasto Annulla sparisce e al suo posto c'è «Crea nota di
              // credito»): questo menu desktop era rimasto indietro.
              transitions={
                isNotaCredito
                  ? (sdiTransmitted ? {} : NOTA_CREDITO_TRANSITIONS)
                  : (sdiTransmitted ? FATTURA_TRANSITIONS_TRASMESSA : FATTURA_TRANSITIONS)
              }
              apiPath={`/api/fatture/${id}/status`}
              docType={doc.doc_type}
            />
          </div>
        </div>

        {archiviato && <ArchivioBanner documentId={id} docType={doc.doc_type} />}

        {/* ⚖️ Avviso del TETTO sulla nota (decisione Eli, 10 ago: «trasmissione
            bloccante + avviso ambra sul salvataggio» — in bozza si lavora
            liberi, ma chi supera il residuo lo deve sapere PRIMA di provare a
            trasmettere, non dall'errore dopo). */}
        {notaOltreResiduo && (
          <div className="rounded-lg border border-[#e8d6ad] bg-[#f5e9d0] px-4 py-3 text-sm text-[#8a6a2f]" style={{ lineHeight: 1.5 }}>
            <b>Questa nota supera il residuo stornabile.</b>{' '}
            Sulla fattura d&rsquo;origine restano da stornare{' '}
            <b>€&nbsp;{notaOltreResiduo.residuo.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>{' '}
            (totale meno le altre note attive): con questi importi la trasmissione
            allo SdI verrà bloccata. Riduci le voci della nota entro il residuo.
          </div>
        )}

        {/* ── BANNER MODIFICATO dopo l'invio (C2) — IN ALTO (richiesta Eli
            3 ago): è l'avviso più importante della pagina, prima stava in
            fondo sotto riepilogo e bottoni e passava inosservato.
            Non su pagata/trasmessa (review 25 lug #10/M3): lì il ripristino è
            bloccato dal server (trigger 057 / guardia SdI) e il bottone
            fallirebbe per sempre. */}
        {doc.updated_after_send_at && doc.status !== 'accepted' && !sdiTransmitted && (
          <div className="rounded-lg border border-[#e2d7f4] bg-[#f6f2fc] px-4 py-3 text-sm">
            <span className="inline-flex items-center gap-1.5 rounded-lg bg-[#ddd0f4] px-2.5 py-1 text-[13px] font-bold text-[#161616]">
              <AlertTriangle className="size-3.5 shrink-0" aria-hidden />
              Modificata — cliente non avvisato
            </span>
            <p className="mt-2 text-[#3f3d36]">
              Documento aggiornato il{' '}
              {new Date(doc.updated_after_send_at).toLocaleString('it-IT', { day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' } as Intl.DateTimeFormatOptions)}, dopo
              l&rsquo;invio al cliente. Chi riapre il link vede già la versione aggiornata, ma il
              cliente non ha ricevuto alcuna comunicazione: si consiglia di inviare nuovamente
              la fattura.
            </p>
            <div className="mt-2">
              <RestoreVersionButton documentId={id} docType={doc.doc_type} />
            </div>
          </div>
        )}

        {/* ── MOBILE: card Cliente (lg:hidden) — statica se il cliente non è in
            rubrica (prima era un link "#" che non portava da nessuna parte) ── */}
        {clientName && !editing && (
          pdfClient?.id ? (
            <Link href={`/clienti/${pdfClient.id}`} className="lg:hidden" style={{ background: '#fff', borderRadius: 14, boxShadow: 'var(--cc-shadow)', padding: '15px 15px', display: 'block', textDecoration: 'none' }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 12 }}>Cliente</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#161616' }}>{clientName}</div>
              {(pdfClient?.email || pdfClient?.phone) && (
                <div style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 3 }}>
                  {[pdfClient?.email, pdfClient?.phone].filter(Boolean).join(' · ')}
                </div>
              )}
            </Link>
          ) : (
            <div className="lg:hidden" style={{ background: '#fff', borderRadius: 14, boxShadow: 'var(--cc-shadow)', padding: '15px 15px' }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 12 }}>Cliente</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#161616' }}>{clientName}</div>
              <div style={{ fontSize: 12, color: '#767676', marginTop: 3 }}>
                Non è in rubrica · <Link href="/clienti/nuovo" style={{ color: '#1a1a2e', fontWeight: 600, textDecoration: 'none' }}>Aggiungilo →</Link>
              </div>
            </div>
          )
        )}

        {/* ── Fattura elettronica SdI (mockup crescita §1) — su mobile
            nascosta in modifica (il form deve stare in alto, Eli 3 ago) ── */}
        {sdiProps && (
          <div className={editing ? 'hidden lg:block' : undefined}>
            <SdiCard {...sdiProps} />
          </div>
        )}

        {/* ── MOBILE: card Foto lavoro (mockup cantiere §2.1) ── */}
        <div className={editing ? 'hidden' : 'lg:hidden'}>
          <WorkPhotosCard documentId={id} initialPhotos={workPhotos} initialSignedUrls={workPhotoSignedUrls} />
        </div>

        {/* ── MOBILE: card Riepilogo (lg:hidden) ── */}
        {docItems.length > 0 && !editing && (
          <div className="lg:hidden" style={{ background: '#fff', borderRadius: 14, boxShadow: 'var(--cc-shadow)', padding: '15px 15px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 12 }}>Riepilogo</div>
            {docItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', fontSize: 14 }}>
                <span style={{ color: '#161616' }}>{String(item.description ?? '—')}</span>
                {item.total != null && (
                  <span style={{ color: '#161616', whiteSpace: 'nowrap' }}>
                    {`€\u00A0${Number(item.total).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2  })}`}
                  </span>
                )}
              </div>
            ))}
            <div style={{ height: '0.5px', background: '#eee', margin: '6px -15px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', fontSize: 14 }}>
              <span style={{ color: '#161616', fontWeight: 400 }}>Subtotale</span>
              <span style={{ color: '#161616', fontWeight: 500 }}>
                {`€\u00A0${Number((doc as any).subtotal ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2  })}`}
              </span>
            </div>
            {/* Marca da bollo: senza questa riga il totale saltava da 100 a
                102 senza dire da dove venissero i 2 € (screenshot Eli 26 lug).
                Il PDF la mostrava già: qui mancava. */}
            {Number((doc as any).bollo_amount ?? 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', fontSize: 14 }}>
                <span style={{ color: '#161616', fontWeight: 400 }}>Marca da bollo</span>
                <span style={{ color: '#161616', fontWeight: 500 }}>
                  {`€\u00A0${Number((doc as any).bollo_amount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2  })}`}
                </span>
              </div>
            )}
            {Number((doc as any).tax_amount ?? 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', fontSize: 14 }}>
                <span style={{ color: '#161616', fontWeight: 400 }}>{ivaLabel}</span>
                <span style={{ color: '#161616', fontWeight: 500 }}>
                  {`€\u00A0${Number((doc as any).tax_amount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2  })}`}
                </span>
              </div>
            )}
            <div style={{ height: '1px', background: '#e3e3e6', margin: '0 -15px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', fontSize: 16 }}>
              <span style={{ color: '#161616', fontWeight: 600 }}>Totale</span>
              <span style={{ color: '#161616', fontWeight: 700 }}>
                {`€\u00A0${Number((doc as any).total ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2  })}`}
              </span>
            </div>
            {/* Acconto: quanto è entrato e quanto MANCA, sempre in vista
                (feedback Eli 27 lug: "quanto manca anche fuori dal pop-up") */}
            {(doc as any).payment_status === 'partial' && Number((doc as any).paid_amount ?? 0) > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0 0', fontSize: 14 }}>
                  <span style={{ color: '#2f8a63' }}>Acconto già ricevuto</span>
                  <span style={{ color: '#2f8a63', fontWeight: 600 }}>
                    {`−€\u00A0${Number((doc as any).paid_amount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0 2px', fontSize: 15 }}>
                  <span style={{ color: '#161616', fontWeight: 600 }}>Resta da incassare</span>
                  <span style={{ color: '#161616', fontWeight: 700 }}>
                    {`€\u00A0${Math.max(0, Number((doc as any).total ?? 0) - Number((doc as any).paid_amount ?? 0)).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </span>
                </div>
                {/* Acconto sbagliato → azzera e reinserisci (feedback Eli 27 lug):
                    su una fattura non ancora saldata non c'era NESSUN modo di
                    correggerlo ("Segna non pagata" esiste solo sulle saldate). */}
                {doc.status !== 'accepted' && doc.status !== 'rejected' && (
                  <CorreggiIncassoButton documentId={id} amount={Number((doc as any).paid_amount ?? 0)} />
                )}
              </>
            )}
            {/* Fattura SALDATA: quanto è entrato e quando (feedback Eli 7 ago,
                "dove vedo l'incasso effettivamente azzerato?"). Prima l'importo
                incassato non compariva da nessuna parte sulla fattura pagata:
                c'era solo la pillola verde «Pagata». Così l'azzeramento non si
                vedeva sparire — restava solo la riga in cronologia. Ora la cifra
                c'è finché l'incasso c'è, e sparisce quando lo azzeri. */}
            {doc.status === 'accepted' && Number((doc as any).paid_amount ?? 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0 2px', fontSize: 14 }}>
                <span style={{ color: '#2f8a63' }}>
                  Incassato
                  {(doc as any).paid_at && (
                    <> il {new Date((doc as any).paid_at).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Rome' })}</>
                  )}
                </span>
                <span style={{ color: '#2f8a63', fontWeight: 700 }}>
                  {`€ ${Number((doc as any).paid_amount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── MOBILE: Anteprima + Condividi (lg:hidden) ── */}
        <div className={editing ? 'hidden' : 'flex lg:hidden'} style={{ gap: 11 }}>
          {/* Anteprima — overlay (19 lug): chiudendo si torna al punto esatto */}
          <AnteprimaButton
            src={`/api/documents/${id}/pdf?preview=1`}
            style={mobileActionBase}
          />
          {/* Condividi (navy) — non su una fattura annullata (19 lug) */}
          {doc.public_token && !isCancelled && (
            <ShareButton
              documentId={id}
              publicToken={doc.public_token}
              docNumber={doc.doc_number}
              docType={doc.doc_type}
              isDraft={isDraft}
              isExpired={doc.status === 'expired'}
                isModified={!!(doc as any).updated_after_send_at}
              hasVoci={hasVoci}
              clientName={clientName}
              triggerStyle={(doc.status === 'sent' || doc.status === 'viewed' || doc.status === 'expired') ? mobileActionBase : mobileActionPrimary}
            />
          )}
          {canReactivate && <RiattivaFatturaButton documentId={id} fullWidth />}
        </div>

        {/* ── MOBILE: Segna pagata (navy) + Annulla fattura (bianco) affiancati.
            Anche in BOZZA (review 25 lug #6): pagamento in contanti alla
            consegna o bozza sbagliata — prima su telefono non c'era NESSUN
            modo di registrare l'incasso o annullare. ── */}
        {/* ⚠️ Sulla NOTA DI CREDITO niente «Segna pagata»: non è denaro che
            entra, è denaro che torna al cliente. Resta solo l'annullamento,
            e solo finché la nota non è partita. */}
        {isNotaCredito && !sdiTransmitted && doc.status !== 'rejected' && !editing && (
          <div className="lg:hidden" style={{ display: 'flex', gap: 11 }}>
            <AnnullaFatturaButton documentId={id} isNotaCredito />
          </div>
        )}
        {!isNotaCredito && (doc.status === 'draft' || doc.status === 'sent' || doc.status === 'viewed' || doc.status === 'expired') && !editing && (
          <div className="lg:hidden" style={{ display: 'flex', gap: 11 }}>
            <SegnaPagataButton
              documentId={id}
              total={doc.total}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
              alreadyPaid={(doc as any).payment_status === 'partial' ? Number((doc as any).paid_amount ?? 0) : 0}
            />
            {/* Trasmessa allo SdI: il server rifiuta l'annullamento (serve una
                nota di credito) — offrirlo lo stesso faceva scoprire il
                divieto solo DOPO la conferma (screenshot Eli 26 lug). */}
            {!sdiTransmitted && (
              <AnnullaFatturaButton
                documentId={id}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 nel select *
                alreadyPaid={(doc as any).payment_status === 'partial' ? Number((doc as any).paid_amount ?? 0) : 0}
              />
            )}
          </div>
        )}
        {/* Fattura trasmessa: al posto di «Annulla» il documento che la storna
            davvero (Eli, 8 ago). Il testo sotto resta: spiega cos'è una nota di
            credito a chi non l'ha mai fatta. */}
        {sdiTransmitted && !isNotaCredito && !editing && (
          <div className="lg:hidden" style={{ marginTop: 2 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {noteFattura.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e6e6e6', borderRadius: 12, padding: '11px 13px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--cc-muted)', marginBottom: 6 }}>
                    Note di credito di questa fattura
                  </div>
                  {noteFattura.map((n) => (
                    <Link key={n.id} href={`/fatture/${n.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', fontSize: 13.5, textDecoration: 'none', color: '#161616' }}>
                      <span style={{ fontWeight: 600 }}>{n.doc_number ? formatDocNumber(n.doc_number, 'nota_credito') : 'Nota di credito'}</span>
                      <span style={{ whiteSpace: 'nowrap', color: n.status === 'rejected' ? 'var(--cc-muted)' : '#161616' }}>
                        {n.status === 'rejected' ? 'Annullata' : `\u2212\u00A0\u20AC\u00A0${Number(n.total ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </span>
                    </Link>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0 1px', fontSize: 13.5, borderTop: '1px solid #eee', marginTop: 4 }}>
                    <span style={{ color: 'var(--cc-muted)' }}>Residuo stornabile</span>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{`\u20AC\u00A0${Number(residuoStorno ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
                  </div>
                </div>
              )}
              {residuoStorno !== null && residuoStorno <= TOLLERANZA_STORNO ? (
                <div style={{ border: '1px solid #e6e6e6', background: '#f7f7f8', borderRadius: 12, padding: '11px 13px' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--cc-muted)' }}>Crea nota di credito</div>
                  <p style={{ fontSize: 12, color: 'var(--cc-muted)', margin: '3px 0 0', lineHeight: 1.45 }}>
                    Questa fattura è già stornata per intero: le sue note di credito
                    coprono tutto il totale. Se una è sbagliata, aprila e annullala
                    (si può finché non è trasmessa), poi il residuo si riapre.
                  </p>
                </div>
              ) : (
                <NotaCreditoButton documentId={id} />
              )}
            </div>
          </div>
        )}
        {(doc.status === 'sent' || doc.status === 'viewed' || doc.status === 'expired') && sdiTransmitted && !isNotaCredito && !editing && (
          <p className="lg:hidden" style={{ fontSize: 12, color: 'var(--cc-muted)', lineHeight: 1.45, marginTop: -4 }}>
            Questa fattura è già stata trasmessa allo SdI: non si annulla più. Per
            correggerla serve una nota di credito, cioè una fattura «al contrario»
            che storna in tutto o in parte quella sbagliata. Il tasto qui sopra te
            la prepara già compilata: controlla gli importi, poi mandala al cliente
            e trasmettila — è la trasmissione a far avvenire lo storno.
          </p>
        )}

        {/* ── MOBILE: uscita dal "pagata per errore" (review 25 lug #3) ── */}
        {doc.status === 'accepted' && (
          <div className="lg:hidden">
            <SegnaNonPagataButton documentId={id} fullWidth />
          </div>
        )}

        {/* ── MOBILE: scheda lavoro collegata (via preventivo di origine) —
            dalla fattura si arriva DENTRO al lavoro con un tocco. Sta QUI,
            in fondo alla zona azioni, nello stesso punto del gemello
            preventivo (Eli 3 ago sera: "organizziamoci in modo simile"). ── */}
        {linkedLavoro?.id && !editing && (
          <div className="lg:hidden">
            <LavoroLinkButton lavoroId={linkedLavoro.id} fullWidth />
          </div>
        )}

        {/* ── DESKTOP: Intestazione documento ── */}
        <div className="hidden lg:block">
          <h1 className="text-2xl font-bold font-mono">{formatDocNumber(doc.doc_number, doc.doc_type)}</h1>
          {doc.title && <p className="text-base text-muted-foreground mt-0.5">{doc.title}</p>}
          <p className="text-sm text-muted-foreground mt-1">
            {isNotaCredito ? 'Nota di credito creata il' : 'Fattura creata il'}{' '}
            {new Date(doc.created_at!).toLocaleDateString('it-IT', {
              day: '2-digit', month: 'long', year: 'numeric',
             timeZone: 'Europe/Rome' })}
          </p>
        </div>

        {/* FIX-7bis: avviso di trasparenza — questo documento NON è la fattura
            elettronica via SdI. Nascosto una volta trasmessa (audit 24 lug):
            dopo l'invio SdI riuscito il promemoria era fuorviante.
            Nascosto anche sulle BOZZE (feedback Eli 26 lug): lì l'artigiano
            sta ancora scrivendo la fattura e il promemoria fiscale è
            prematuro — compare quando la fattura è davvero uscita. */}
        {/* Se la card SdI è montata, il promemoria vive LÌ (feedback Eli
            26 lug): questo banner resta solo come ripiego quando la
            fatturazione elettronica in app è spenta. */}
        {!sdiProps && !isDraft && !isCancelled && !sdiTransmitted && (
          <div className={`${editing ? 'hidden lg:flex' : 'flex'} items-start gap-2 rounded-lg border border-[#e8d6ad] bg-[#f5e9d0] px-4 py-3 text-xs text-[#b0863e]`}>
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>
              Questo documento non sostituisce la fattura elettronica. Ricordati di trasmetterla tramite SdI
              (cassetto fiscale o commercialista).
            </span>
          </div>
        )}

        {/* Link al preventivo di origine (desktop — su mobile è la card "Preventivo collegato" in cima) */}
        <div className="hidden lg:block">
        {originDoc ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground flex-wrap">
            <div className="flex items-center gap-2">
              <FileText className="size-4 shrink-0" />
              <span>
                {isNotaCredito ? 'Storna la fattura' : 'Collegata al preventivo'}{' '}
                <Link
                  href={isNotaCredito ? `/fatture/${originDoc.id}` : `/preventivi/${originDoc.id}`}
                  className="font-medium text-foreground hover:underline underline-offset-2"
                >
                  {originDoc.doc_number
                    ? formatDocNumber(originDoc.doc_number, isNotaCredito ? 'fattura' : 'preventivo')
                    : originDoc.title ?? 'bozza'}
                </Link>
              </span>
            </div>
            <div className="flex items-center gap-2">
              {linkedLavoro?.id && (
                <Link
                  href={`/lavori/${linkedLavoro.id}`}
                  className="inline-flex items-center gap-1.5 rounded-md border bg-white px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted/50"
                >
                  <Hammer className="size-4" />
                  Scheda lavoro
                </Link>
              )}
              {/* Sulla nota di credito il riferimento è fiscale: non si cambia
                  (vedi la card mobile qui sopra). */}
              {!isNotaCredito && (
                <LinkToPreventivoButton
                  fatturaId={id}
                  workspaceId={workspace.id}
                  currentPreventivoId={doc.origin_document_id}
                />
              )}
            </div>
          </div>
        ) : !isNotaCredito ? (
          <div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground flex-wrap">
            <FileText className="size-4 shrink-0 text-muted-foreground/60" />
            <span className="flex-1">Fattura non collegata a nessun preventivo.</span>
            <LinkToPreventivoButton
              fatturaId={id}
              workspaceId={workspace.id}
            />
          </div>
        ) : (
          // Nota di credito senza riferimento: è un problema fiscale, non un
          // collegamento mancante — senza, lo SdI non sa cosa si sta stornando.
          <div className="flex items-start gap-2 rounded-lg border border-[#e8d6ad] bg-[#f5e9d0] px-4 py-3 text-sm text-[#b0863e]">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>
              Questa nota di credito non è collegata a nessuna fattura: così non si
              può trasmettere. Creala di nuovo dalla fattura da stornare.
            </span>
          </div>
        )}
        </div>

        {(doc.status === 'accepted' || doc.status === 'rejected') && (
          <div className="rounded-lg border border-[#e8d6ad] bg-[#f5e9d0] px-4 py-3 text-sm text-[#b0863e]">
            {doc.status === 'accepted'
              ? 'Fattura pagata — nessuna modifica consentita.'
              : canReactivate
                ? 'Fattura annullata. Puoi riattivarla (torna in bozza) finché non è stata trasmessa allo SdI.'
                : 'Fattura annullata e già trasmessa allo SdI: per correggerla serve una nota di credito.'}
          </div>
        )}

        {/* ⚠️ «Crea nota di credito» esisteva SOLO su mobile: su computer una
            fattura trasmessa non aveva alcun modo di essere stornata. */}
        {sdiTransmitted && !isNotaCredito && !editing && (
          <div className="hidden lg:block">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {noteFattura.length > 0 && (
                <div style={{ background: '#fff', border: '1px solid #e6e6e6', borderRadius: 12, padding: '11px 13px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--cc-muted)', marginBottom: 6 }}>
                    Note di credito di questa fattura
                  </div>
                  {noteFattura.map((n) => (
                    <Link key={n.id} href={`/fatture/${n.id}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '6px 0', fontSize: 13.5, textDecoration: 'none', color: '#161616' }}>
                      <span style={{ fontWeight: 600 }}>{n.doc_number ? formatDocNumber(n.doc_number, 'nota_credito') : 'Nota di credito'}</span>
                      <span style={{ whiteSpace: 'nowrap', color: n.status === 'rejected' ? 'var(--cc-muted)' : '#161616' }}>
                        {n.status === 'rejected' ? 'Annullata' : `\u2212\u00A0\u20AC\u00A0${Number(n.total ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                      </span>
                    </Link>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0 1px', fontSize: 13.5, borderTop: '1px solid #eee', marginTop: 4 }}>
                    <span style={{ color: 'var(--cc-muted)' }}>Residuo stornabile</span>
                    <span style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{`\u20AC\u00A0${Number(residuoStorno ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span>
                  </div>
                </div>
              )}
              {residuoStorno !== null && residuoStorno <= TOLLERANZA_STORNO ? (
                <div style={{ border: '1px solid #e6e6e6', background: '#f7f7f8', borderRadius: 12, padding: '11px 13px' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--cc-muted)' }}>Crea nota di credito</div>
                  <p style={{ fontSize: 12, color: 'var(--cc-muted)', margin: '3px 0 0', lineHeight: 1.45 }}>
                    Questa fattura è già stornata per intero: le sue note di credito
                    coprono tutto il totale. Se una è sbagliata, aprila e annullala
                    (si può finché non è trasmessa), poi il residuo si riapre.
                  </p>
                </div>
              ) : (
                <NotaCreditoButton documentId={id} />
              )}
            </div>
          </div>
        )}

        {/* Form fattura — su mobile visibile solo con ?edit=1 (e non per accepted/rejected) */}
        {sdiTransmitted ? (
          <div className="hidden lg:block rounded-lg border border-[#e8d6ad] bg-[#f5e9d0] px-4 py-3 text-sm text-[#8a6a2f]">
            {isNotaCredito
              ? 'Questa nota di credito è stata trasmessa allo SdI: non è più modificabile.'
              : 'Questa fattura è stata trasmessa allo SdI: non è più modificabile. Per correggerla usa la nota di credito, qui sopra.'}
          </div>
        ) : (
        <div
          className={editing ? undefined : 'hidden lg:block'}
        >
          <PreventivoForm
            mode="edit"
            documentId={id}
            defaultValues={doc as any}
            templates={(templates ?? []) as Array<{ id: string; name: string; is_default: boolean | null }>}
            defaultTemplateId={defaultTemplate?.id ?? null}
            fiscalRegime={workspace.fiscal_regime}
            isProPlan={workspace.plan !== 'free'}
            // Tipo VERO (chiuso l'11 ago, ultimo residuo del 10): col tipo a
            // mano una nota di credito in modifica parlava da fattura
            // («Aggiorna fattura», «Voci fattura», popup col numero «Fatt.»).
            docType={isNotaCredito ? 'nota_credito' : 'fattura'}
            defaultClient={formDefaultClient}
          />
        </div>
        )}

        {/* Foto lavoro — anche su DESKTOP (prima solo nella vista mobile) */}
        <div className="hidden lg:block">
          <WorkPhotosCard documentId={id} initialPhotos={workPhotos} initialSignedUrls={workPhotoSignedUrls} />
        </div>

        {/* Messaggi col cliente — solo se ha scritto dal link (5 ago).
            Card unica mobile+desktop, come la cronologia qui sotto. */}
        {conversation.length > 0 && (
          <div className={editing ? 'cc-card-md hidden lg:block' : 'cc-card-md'} style={{ padding: '15px 15px' }}>
            <MessaggiCard
              documentId={doc.id}
              messages={conversation}
              clientHasEmail={!!pdfClient?.email}
              clientName={clientName}
            />
          </div>
        )}

        {/* Cronologia fattura (C3) — card come nel mockup, stessa resa del
            preventivo. In ?edit=1 su mobile sparisce come le altre card di
            sola lettura (il gemello preventivo in edit non la mostra). */}
        <div className={editing ? 'cc-card-md hidden lg:block' : 'cc-card-md'} style={{ padding: '15px 15px' }}>
          <DocumentTimeline
            createdAt={doc.created_at ?? null}
            sentAt={doc.sent_at ?? null}
            // Per la cronologia "Pagata" conta la DATA DI INCASSO scelta nel
            // dialog (paid_at), non l'ora del click (review 25 lug F1).
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 nel select *
            // "Pagata" SOLO quando la fattura è davvero SALDATA (feedback Eli
            // 27 lug): con un acconto parziale paid_at è valorizzato ma lo
            // stato resta 'sent' → la cronologia mostrava "Pagata" accanto
            // alla riga dell'acconto. Gli acconti hanno già le loro righe.
            acceptedAt={doc.status === 'accepted' ? (((doc as any).paid_at as string | null) ?? doc.accepted_at ?? null) : null}
            status={doc.status}
            expiresAt={doc.expires_at ?? null}
            rejectionReason={doc.rejection_reason ?? null}
            views={views}
            documentLog={(Array.isArray(doc.document_log) ? doc.document_log as unknown as DocumentLogEntry[] : [])}
            docType={doc.doc_type}
            /* Fattura elettronica: partenza ed esito (Eli, 8 ago). I valori
               arrivano dal `select('*')`, quindi senza le colonne 044 sono
               semplicemente `undefined` e la cronologia resta com'era. */
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
            sdiSentAt={(doc as any).sdi_sent_at ?? null}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
            sdiStatus={(doc as any).sdi_status ?? null}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
            sdiUpdatedAt={(doc as any).sdi_updated_at ?? null}
          />
        </div>

        <Separator className="hidden lg:block" />

      </div>
    </div>
  )
}
