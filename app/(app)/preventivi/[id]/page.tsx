import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, ChevronLeft, ExternalLink, AlertTriangle, Info, FileCheck2, CheckCircle2, XCircle, Pencil, X, Crown, Send, Clock, FileText, Hammer } from 'lucide-react'
import { PreventivoForm } from '../_components/PreventivoForm'
import { PdfActions } from '../_components/PdfActions'
import { SendEmailDialog } from '../_components/SendEmailDialog'
import { SendEmailDialogController } from '../_components/SendEmailDialogController'
import { StatusBadge } from '../_components/StatusBadge'
import { StatusChangeDropdown } from '../_components/StatusChangeDropdown'
import { ConvertiFatturaButton } from '../_components/ConvertiFatturaButton'
import { ApriLavoroButton } from '../_components/ApriLavoroButton'
import { LavoroLinkButton } from '../_components/LavoroLinkButton'
import { RiportaInBozzaButton } from '../_components/RiportaInBozzaButton'
import { AnteprimaButton } from '../_components/AnteprimaButton'
import { AccontoCard } from '../_components/AccontoCard'
import { WorkPhotosCard } from '../_components/WorkPhotosCard'
import { ShareButton } from '../_components/ShareButton'
import { checkFreeBlock, FREE_DOC_LIMIT } from '@/lib/free-trial'
import { ContextHint } from '@/components/shared/ContextHint'
import { formatDocNumber } from '@/lib/utils'
import { RestoreVersionButton } from '../_components/RestoreVersionButton'
import { DocumentTimeline } from '../_components/DocumentTimeline'
import { MobileStatusChips } from '../_components/MobileStatusChips'
import type { DocumentLogEntry } from '../_components/DocumentTimeline'
import { BackButton } from '@/components/shared/BackButton'

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
    // Storico aperture (sempre in cronologia — la storia non si cancella)
    supabase
      .from('document_views')
      .select('id, viewed_at, ip_address, country')
      .eq('document_id', id)
      .order('viewed_at', { ascending: false })
      .limit(50),
    // Listini fornitori (063) — avviso scadenza-listino nel form (tollerante pre-migration)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 063 non ancora in types/database.ts
    (supabase as any)
      .from('supplier_lists')
      .select('id, name, valid_until')
      .eq('workspace_id', workspace.id)
      .then((r: { data: Array<{ id: string; name: string; valid_until: string | null }> | null }) => r.data ?? [], () => [] as Array<{ id: string; name: string; valid_until: string | null }>)
  ])

  if (!doc) notFound()

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
  const vatRates = Array.from(new Set(docItems.map((i) => Number(i.vat_rate)).filter((r) => !Number.isNaN(r))))
  const ivaLabel = vatRates.length === 1 ? `IVA ${vatRates[0]}%` : 'IVA'

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
  else if (doc.status === 'accepted') stateText = doc.accepted_at ? `Accettato il ${fmtShort(doc.accepted_at)}` : 'Accettato'
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

      {/* ── MOBILE HEADER (lg:hidden) ── */}
      <div className="lg:hidden" style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', padding: '12px 15px' }}>
        <BackButton fallback="/preventivi" />
        {/* Simbolo tipo documento (A2, 5 lug): foglio NAVY = preventivo */}
        <span style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e', minWidth: 0 }}>
          <FileText size={18} style={{ color: '#1a1a2e', flexShrink: 0 }} aria-hidden />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{headerTitle}</span>
        </span>
        {edit !== '1' ? (
          <Link href={`/preventivi/${id}?edit=1`} aria-label="Modifica preventivo" style={{ width: 34, height: 34, borderRadius: '50%', background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Pencil size={18} style={{ color: '#55534b' }} />
          </Link>
        ) : (
          <Link href={`/preventivi/${id}`} aria-label="Chiudi modifica" style={{ width: 34, height: 34, borderRadius: '50%', background: '#f4f4f5', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <X size={18} style={{ color: '#55534b' }} />
          </Link>
        )}
      </div>

      {/* ── MOBILE READ VIEW (lg:hidden, solo se non in modifica) — pixel-perfect dal mockup ── */}
      {edit !== '1' && (
        <div className="lg:hidden" style={{ paddingBottom: 20 }}>

          {/* Riga stato: badge + testo contestuale */}
          <div style={{ margin: '14px 15px 0', display: 'flex', alignItems: 'center', gap: 9 }}>
            <StatusBadge status={doc.status} />
            {stateText && <span style={{ fontSize: 13, color: 'var(--cc-muted)' }}>{stateText}</span>}
          </div>

          {/* Banner accettazione — solo se aggiunge dettagli (firma/IP) alla riga stato */}
          {doc.status === 'accepted' && (doc.signer_name || doc.accepted_ip != null) && (
            <div style={{ margin: '14px 15px 0', background: '#d4efe2', border: '1px solid #bce3d2', borderRadius: 10, padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <CheckCircle2 size={17} style={{ color: '#2f8a63', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2f8a63' }}>
                  {doc.signer_name
                    ? 'Accettato e firmato dal cliente'
                    : doc.accepted_ip != null
                    ? 'Accettato dal cliente'
                    : 'Segnato come accettato manualmente'}
                </div>
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

          {/* Foto lavoro (mockup cantiere §2.1) */}
          <div style={{ margin: '14px 15px 0' }}>
            <WorkPhotosCard documentId={id} initialPhotos={workPhotos} />
          </div>

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
                <div style={{ fontSize: 12, color: '#b0863e', marginTop: 2 }}>Validità superata. Puoi rinviarlo al cliente.</div>
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
                  : <><strong>Hai raggiunto il limite di {FREE_DOC_LIMIT} preventivi del piano Free.</strong>{' '}</>}
                <Link href="/abbonamento" className="font-semibold underline underline-offset-2">Passa a Pro</Link>
              </p>
            </div>
          )}

          {/* Card Cliente — tap: apre la scheda cliente. Se il cliente non è in
              rubrica (es. eliminato dopo la creazione del documento) la card è
              statica: prima era un link "#" che non portava da nessuna parte. */}
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

          {/* Card Riepilogo */}
          <div style={{ ...cardStyle, margin: '14px 15px 0' }}>
            <div style={cardLabel}>Riepilogo</div>
            {doc.title && <div style={{ fontSize: 15, fontWeight: 600, color: '#161616', marginBottom: 6 }}>{doc.title}</div>}
            {/* 18 lug (Eli): con più proposte le voci di Base e Premium erano
                mescolate in un'unica lista → ora ogni gruppo ha la sua
                etichetta (i totali sotto restano riferiti alla Base). */}
            {(() => {
              const tierOf = (it: Record<string, unknown>) => String(it.option_tier ?? 'base')
              const tiers = [...new Set(docItems.map(tierOf))]
              const multi = tiers.length > 1
              const TIER_LBL: Record<string, string> = { base: 'Proposta Base', consigliata: 'Proposta Consigliata', premium: 'Proposta Premium' }
              const order = ['base', 'consigliata', 'premium']
              const sorted = multi
                ? [...docItems].sort((a, b) => order.indexOf(tierOf(a)) - order.indexOf(tierOf(b)))
                : docItems
              let lastTier: string | null = null
              return sorted.map((item, i) => {
                const t = tierOf(item)
                const header = multi && t !== lastTier
                lastTier = t
                return (
                  <div key={i}>
                    {header && (
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.07em', textTransform: 'uppercase', color: '#b0863e', padding: '9px 0 2px' }}>
                        {TIER_LBL[t] ?? t}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', fontSize: 14 }}>
                      <span style={{ color: '#161616' }}>{String(item.description ?? '—')}</span>
                      {item.total != null && <span style={{ color: '#161616', whiteSpace: 'nowrap' }}>{euro(Number(item.total))}</span>}
                    </div>
                  </div>
                )
              })
            })()}
            <div style={{ height: '0.5px', background: '#eee', margin: '6px -15px' }} />
            {new Set(docItems.map((it) => String(it.option_tier ?? 'base'))).size > 1 && (() => {
              // I totali del documento seguono la Base; recommended_tier si
              // legge SOLO per i documenti legacy salvati con la vecchia ★
              // (azzerata al prossimo salvataggio) — la nota cita quella giusta.
              const rec = String((doc as Record<string, unknown>).recommended_tier ?? '') || 'base'
              const lbl = ({ base: 'Base', consigliata: 'Consigliata', premium: 'Premium' } as Record<string, string>)[rec] ?? 'Base'
              return (
                <p style={{ fontSize: 12, color: 'var(--cc-muted)', margin: '6px 0 0', lineHeight: 1.45 }}>
                  I totali qui sotto si riferiscono alla proposta {lbl}. Il cliente
                  sceglie la proposta dalla sua pagina.
                </p>
              )
            })()}
            <div style={sumRow}>
              <span style={{ color: '#161616', fontWeight: 400 }}>Subtotale</span>
              <span style={{ color: '#161616', fontWeight: 500 }}>{euro(subtotal)}</span>
            </div>
            {taxAmount > 0 && (
              <div style={sumRow}>
                <span style={{ color: '#161616', fontWeight: 400 }}>{ivaLabel}</span>
                <span style={{ color: '#161616', fontWeight: 500 }}>{euro(taxAmount)}</span>
              </div>
            )}
            {bolloAmount > 0 && (
              <div style={sumRow}>
                <span style={{ color: '#161616', fontWeight: 400 }}>Marca da bollo</span>
                <span style={{ color: '#161616', fontWeight: 500 }}>{euro(bolloAmount)}</span>
              </div>
            )}
            <div style={{ height: '1px', background: '#e3e3e6', margin: '0 -15px' }} />
            <div style={{ ...sumRow, fontSize: 16 }}>
              <span style={{ color: '#161616', fontWeight: 600 }}>Totale</span>
              <span style={{ color: '#161616', fontWeight: 700 }}>{euro(totalAmount)}</span>
            </div>
            {doc.expires_at && (
              <div style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 8 }}>Valido fino al {fmtLong(doc.expires_at)}</div>
            )}
          </div>

          {/* Azioni riga 1: Anteprima (bianco bordato) + Condividi (navy pieno) */}
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
                defaultValidityDays={(doc as any).validity_days ?? 30}
                triggerStyle={doc.status === 'accepted'
                  ? { ...actionChip, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e', fontWeight: 500 }
                  : { ...actionChip, background: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e', fontWeight: 600, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)' }}
              />
            )}
          </div>

          {/* Azioni riga 2: Segna accettato / Segna rifiutato (solo se in attesa) */}
          {(doc.status === 'sent' || doc.status === 'viewed') && (
            <div style={{ display: 'flex', gap: 11, padding: '0 15px', marginTop: 11 }}>
              <MobileStatusChips documentId={id} chipBase={segnaChip} />
            </div>
          )}

          {/* Crea fattura (full-width navy) — solo se accettato e nessuna fattura collegata */}
          {doc.status === 'accepted' && doc.doc_type !== 'fattura' && !fatturaOrigin && (
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
          {doc.status === 'accepted' && doc.doc_type !== 'fattura' && !fatturaOrigin && !doc.signer_name && doc.accepted_ip == null && (
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

          {/* Card Visualizzazioni RIMOSSA (Eli 3 ago sera): le aperture
              vivono DENTRO la cronologia qui sotto, non in una card propria. */}

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
            <StatusChangeDropdown documentId={id} currentStatus={doc.status} />
            {publicUrl && (doc.status === 'sent' || doc.status === 'viewed' || doc.status === 'accepted') && (
              <Button variant="outline" size="sm" asChild>
                <Link href={publicUrl} target="_blank">
                  <ExternalLink className="size-4" /> Link cliente
                </Link>
              </Button>
            )}
            <PdfActions
              documentId={id}
              docNumberSlug={(doc.doc_number ?? doc.id).replace(/\//g, '-')}
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
                isExpired={doc.status === 'expired'}
                defaultValidityDays={(doc as any).validity_days ?? 30}
                initialOpen={send === '1'}
                listenOpenEvent
              />
            )}
            {/* Dialog email SENZA trigger: si apre dall'icona Email del pop-up
                "Invia al cliente" (evento) — montato per ogni stato */}
            {doc.status === 'draft' ? (
              <SendEmailDialogController
                documentId={id}
                docNumber={doc.doc_number ? doc.doc_number.replace(/^[A-Za-z]+/, '') : null}
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
                docNumber={doc.doc_number ? doc.doc_number.replace(/^[A-Za-z]+/, '') : null}
                clientEmail={pdfClient?.email ?? null}
                clientId={pdfClient?.id ?? null}
                recipientName={pdfClient ? [pdfClient.name, pdfClient.surname].filter(Boolean).join(' ') : null}
                hasClient={!!pdfClient}
                senderName={workspace.ragione_sociale ?? workspace.name}
                isResend
                hideTrigger
              />
            )}
            {doc.status === 'accepted' && doc.doc_type !== 'fattura' && (
              fatturaOrigin ? (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/fatture/${fatturaOrigin.id}`}>
                    <FileCheck2 className="size-4" />
                    Fattura {fatturaOrigin.doc_number ? formatDocNumber(fatturaOrigin.doc_number) : 'bozza'}
                  </Link>
                </Button>
              ) : (
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
            {/* Riporta in bozza — solo accettazione manuale, senza fattura collegata */}
            {doc.status === 'accepted' && doc.doc_type !== 'fattura' && !fatturaOrigin && !doc.signer_name && doc.accepted_ip == null && (
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
                  <strong>Hai raggiunto il limite di {FREE_DOC_LIMIT} preventivi del piano Free.</strong>{' '}
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
                    : 'Segnato come accettato manualmente'}
                </div>
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
          <div className="hidden lg:flex items-start gap-3 rounded-lg border border-[#d6c9ef] bg-[#e9e0f7] px-4 py-3 text-sm text-[#7c3aed]">
            <AlertTriangle className="size-4 shrink-0 mt-0.5 text-[#7c3aed]" />
            <div className="flex-1 min-w-0 space-y-2">
              <p className="font-semibold">Preventivo modificato — non ancora reinviato</p>
              <p className="text-[#7c3aed]">
                Hai aggiornato questo preventivo il{' '}
                {new Date((doc as any).updated_after_send_at).toLocaleString('it-IT', {
                  day: '2-digit', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                 timeZone: 'Europe/Rome' } as Intl.DateTimeFormatOptions)}.
                {' '}Il cliente vede già la versione aggiornata dal link: reinvialo per avvisarlo.
              </p>
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
            defaultClient={formDefaultClient}
            linkedPhotoCount={Math.min(workPhotos.length, 6)}
            supplierLists={supplierLists}
          />
        </div>

        {/* Acconto + Foto lavoro — anche su DESKTOP: prima esistevano solo
            nella vista mobile (registrare un acconto dal PC era impossibile) */}
        <div className="hidden lg:block space-y-4">
          {accontoInfo && (
            <AccontoCard
              documentId={id}
              acconto={accontoInfo.acconto}
              saldo={accontoInfo.saldo}
              received={accontoInfo.received}
            />
          )}
          <WorkPhotosCard documentId={id} initialPhotos={workPhotos} />
        </div>

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
