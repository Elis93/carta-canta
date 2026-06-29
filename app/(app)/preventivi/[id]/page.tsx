import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, ChevronLeft, ExternalLink, AlertTriangle, Info, FileCheck2, Eye, CheckCircle2, XCircle, Pencil, X, Crown, Send, Share2, Clock, FileText, Link2 } from 'lucide-react'
import { PreventivoForm } from '../_components/PreventivoForm'
import { DeleteDocumentButton } from '../_components/DeleteDocumentButton'
import { DuplicateDocumentButton } from '../_components/DuplicateDocumentButton'
import { PdfActions } from '../_components/PdfActions'
import { SendEmailDialog } from '../_components/SendEmailDialog'
import { SendEmailDialogController } from '../_components/SendEmailDialogController'
import { StatusBadge } from '../_components/StatusBadge'
import { StatusChangeDropdown } from '../_components/StatusChangeDropdown'
import { ViewHistorySection } from '../_components/ViewHistorySection'
import { ConvertiFatturaButton } from '../_components/ConvertiFatturaButton'
import { RegisterManualSendButton } from '../_components/RegisterManualSendButton'
import { ShareButton } from '../_components/ShareButton'
import { checkFreeBlock, FREE_DOC_LIMIT } from '@/lib/free-trial'
import { formatDocNumber } from '@/lib/utils'
import { RestoreVersionButton } from '../_components/RestoreVersionButton'
import { DocumentTimeline } from '../_components/DocumentTimeline'
import { AltreAzioniCard } from '../_components/AltreAzioniCard'
import { MobileStatusChips } from '../_components/MobileStatusChips'
import type { DocumentLogEntry } from '../_components/DocumentTimeline'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ send?: string; edit?: string }>
}

export default async function PreventivoDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { send, edit } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, ragione_sociale, piva, indirizzo, cap, citta, provincia, logo_url, fiscal_regime, bollo_auto, ritenuta_auto, plan, free_trial_expires_at, sent_quota_used')
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
        .from('workspaces').select('id, name, ragione_sociale, piva, indirizzo, cap, citta, provincia, logo_url, fiscal_regime, bollo_auto, ritenuta_auto, plan, free_trial_expires_at, sent_quota_used')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }
  if (!workspace) redirect('/login')

  // Documento + template: query indipendenti (entrambe dipendono solo da workspace.id) → in parallelo.
  const [{ data: doc }, { data: templates }] = await Promise.all([
    supabase
      .from('documents')
      .select('*, document_items(*)')
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

  // Le tre query seguenti dipendono solo da `doc` (cliente, fattura collegata, storico aperture)
  // e sono indipendenti tra loro → eseguite in parallelo.
  const [{ data: pdfClient }, { data: fatturaOrigin }, { data: views }] = await Promise.all([
    // Dati cliente: usati sia per il PDF sia per pre-popolare il campo cliente nel form.
    doc.client_id
      ? supabase
          .from('clients')
          .select('id, name, surname, email, phone, piva, indirizzo, cap, citta, provincia')
          .eq('id', doc.client_id)
          .eq('workspace_id', workspace.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Fattura generata da questo preventivo (solo se accepted)
    doc.status === 'accepted' && doc.doc_type !== 'fattura'
      ? supabase
          .from('documents')
          .select('id, doc_number')
          .eq('origin_document_id', id)
          .eq('workspace_id', workspace.id)
          .eq('doc_type', 'fattura')
          .limit(1)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Storico aperture (solo per documenti non in bozza)
    doc.status !== 'draft'
      ? supabase
          .from('document_views')
          .select('id, viewed_at, ip_address, country')
          .eq('document_id', id)
          .order('viewed_at', { ascending: false })
          .limit(50)
      : Promise.resolve({ data: [] }),
  ])

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
  // Almeno una voce "completa": descrizione + prezzo + quantità tutti valorizzati
  const docItems = (doc as Record<string, unknown>).document_items as Array<Record<string, unknown>> | null ?? []
  const hasVoci = docItems.some(item =>
    String(item.description ?? '').trim() !== '' &&
    Number(item.unit_price ?? 0) > 0 &&
    Number(item.quantity ?? 0) > 0
  )
  // Promemoria quota Free: mostrato per i piani Free (in qualsiasi stato), non quando bloccato.
  const freeTrialStatus = isFree ? checkFreeBlock(workspace) : null

  const publicUrl = doc.public_token ? `/p/${doc.public_token}` : null

  // ── Helper formattazione (mobile read view) ──
  const euro = (n: number) => `€ ${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const fmtShort = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
  const fmtLong = (iso: string) => new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
  const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })

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

  // Secondo bottone primario (mobile): cambia per stato
  const shareLabel = isDraft ? 'Invia al cliente' : (doc.status === 'expired' ? 'Rinvia al cliente' : 'Condividi')
  const shareIcon = (isDraft || doc.status === 'expired') ? <Send size={18} /> : <Share2 size={18} />

  // Cronologia (mobile) — toni dei badge come da mockup
  type CronEvent = { key: string; bg: string; color: string; icon: React.ReactNode; label: string; date: string | null }
  const cron: CronEvent[] = []
  if (doc.created_at) cron.push({ key: 'created', bg: '#e8e8e8', color: '#8a8a8a', icon: <FileText size={12} />, label: doc.status === 'draft' ? 'Creata' : 'Creato', date: doc.created_at })
  if (doc.sent_at) cron.push({ key: 'sent', bg: '#d8e8fb', color: '#3f6fb0', icon: <Send size={12} />, label: 'Inviato al cliente', date: doc.sent_at })
  if (views && views.length > 0) {
    const firstView = [...views].sort((a, b) => new Date(a.viewed_at).getTime() - new Date(b.viewed_at).getTime())[0]
    cron.push({ key: 'viewed', bg: '#fbe1ee', color: '#c25b91', icon: <Eye size={12} />, label: 'Visto dal cliente', date: firstView.viewed_at })
  }
  if (doc.accepted_at) cron.push({ key: 'accepted', bg: '#d4efe2', color: '#2f8a63', icon: <CheckCircle2 size={12} />, label: 'Accettato e firmato', date: doc.accepted_at })
  if (doc.status === 'rejected') cron.push({ key: 'rejected', bg: '#f5dede', color: '#b05656', icon: <XCircle size={12} />, label: 'Rifiutato dal cliente', date: doc.sent_at ?? doc.created_at ?? null })
  if (doc.status === 'expired' && doc.expires_at) cron.push({ key: 'expired', bg: '#f5e9d0', color: '#b0863e', icon: <AlertTriangle size={12} />, label: 'Scaduto', date: doc.expires_at })
  const cronDated = cron.filter((e) => e.date).sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
  const cronUndated: CronEvent[] = []
  if (fatturaOrigin) cronUndated.push({ key: 'fattura', bg: '#d4efe2', color: '#2f8a63', icon: <Link2 size={12} />, label: fatturaOrigin.doc_number ? `Fattura ${formatDocNumber(fatturaOrigin.doc_number)} collegata` : 'Fattura collegata', date: null })
  if (doc.status === 'sent' || doc.status === 'viewed') cronUndated.push({ key: 'attesa', bg: '#f0f0f2', color: '#b3b1ab', icon: <Clock size={12} />, label: 'In attesa di risposta', date: null })
  const cronOrdered = [...cronDated, ...cronUndated]

  // ── Stili condivisi mobile (mockup pixel) ──
  const cardStyle: React.CSSProperties = {
    background: '#fff', borderRadius: 14,
    boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)',
    padding: '15px 15px',
  }
  const cardLabel: React.CSSProperties = {
    fontSize: 11, fontWeight: 600, letterSpacing: '.07em',
    textTransform: 'uppercase', color: '#8a887f', marginBottom: 11,
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
      <div className="lg:hidden" style={{ background: '#fff', borderBottom: '0.5px solid #eeeeee', display: 'flex', alignItems: 'center', padding: '12px 15px' }}>
        <Link href="/preventivi" aria-label="Indietro" style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <ChevronLeft size={25} style={{ color: '#55534b' }} />
        </Link>
        <span style={{ flex: 1, textAlign: 'center', fontSize: 17, fontWeight: 600, color: '#161616' }}>
          {headerTitle}
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
            {stateText && <span style={{ fontSize: 12.5, color: '#8a887f' }}>{stateText}</span>}
          </div>

          {/* Banner accettazione (stato accepted) */}
          {doc.status === 'accepted' && (
            <div style={{ margin: '14px 15px 0', background: '#d4efe2', border: '1px solid #bce3d2', borderRadius: 10, padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <CheckCircle2 size={17} style={{ color: '#2f8a63', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#2f8a63' }}>
                  Accettato{doc.signer_name ? ' e firmato dal cliente' : ''}
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
                <div style={{ fontSize: 12, color: '#b0863e', marginTop: 2 }}>Validità superata. Puoi rinviarlo al cliente o duplicarlo.</div>
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
            <div style={{ margin: '14px 15px 0' }} className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <p>
                {freeTrialStatus.reason === 'trial_expired'
                  ? <><strong>Il periodo di prova è terminato.</strong> Non puoi inviare questo preventivo. </>
                  : <><strong>Hai raggiunto il limite di {FREE_DOC_LIMIT} preventivi del piano Free.</strong> </>}
                <Link href="/abbonamento" className="font-semibold underline underline-offset-2">Passa a Pro</Link>
              </p>
            </div>
          )}

          {/* Card Cliente */}
          {clientName && (
            <div style={{ ...cardStyle, margin: '14px 15px 0' }}>
              <div style={cardLabel}>Cliente</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#161616' }}>{clientName}</div>
              {clientContact && <div style={{ fontSize: 13, color: '#8a887f', marginTop: 3 }}>{clientContact}</div>}
            </div>
          )}

          {/* Card Riepilogo */}
          <div style={{ ...cardStyle, margin: '14px 15px 0' }}>
            <div style={cardLabel}>Riepilogo</div>
            {doc.title && <div style={{ fontSize: 15, fontWeight: 600, color: '#161616', marginBottom: 6 }}>{doc.title}</div>}
            {docItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', fontSize: 13.5 }}>
                <span style={{ color: '#161616' }}>{String(item.description ?? '—')}</span>
                {item.total != null && <span style={{ color: '#161616', whiteSpace: 'nowrap' }}>{euro(Number(item.total))}</span>}
              </div>
            ))}
            <div style={{ height: '0.5px', background: '#eee', margin: '6px -15px' }} />
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
              <div style={{ fontSize: 12.5, color: '#8a887f', marginTop: 8 }}>Valido fino al {fmtLong(doc.expires_at)}</div>
            )}
          </div>

          {/* Azioni riga 1: Anteprima (bianco bordato) + Condividi (navy pieno) */}
          <div style={{ display: 'flex', gap: 11, padding: '0 15px', marginTop: 16 }}>
            <a
              href={`/api/documents/${id}/pdf?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ ...actionChip, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e', fontWeight: 500 }}
            >
              <Eye size={18} style={{ color: '#55534b' }} /> Anteprima
            </a>
            {doc.public_token && (
              <ShareButton
                documentId={id}
                publicToken={doc.public_token}
                docNumber={doc.doc_number}
                docType="preventivo"
                isDraft={isDraft}
                hasVoci={hasVoci}
                clientName={clientName}
                triggerLabel={shareLabel}
                triggerIcon={shareIcon}
                isExpired={doc.status === 'expired'}
                defaultValidityDays={(doc as any).validity_days ?? 30}
                triggerStyle={{ ...actionChip, background: '#1a1a2e', color: '#fff', border: '1px solid #1a1a2e', fontWeight: 600, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)' }}
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
            <div style={{ padding: '0 15px', marginTop: 11 }}>
              <ConvertiFatturaButton documentId={id} fullWidth />
            </div>
          )}
          {/* Link alla fattura già generata */}
          {doc.status === 'accepted' && doc.doc_type !== 'fattura' && fatturaOrigin && (
            <div style={{ padding: '0 15px', marginTop: 11 }}>
              <Button variant="outline" className="w-full" asChild>
                <Link href={`/fatture/${fatturaOrigin.id}`}>
                  <FileCheck2 className="size-4" />
                  Fattura {fatturaOrigin.doc_number ? formatDocNumber(fatturaOrigin.doc_number) : 'bozza'}
                </Link>
              </Button>
            </div>
          )}

          {/* Altre azioni (Duplica · [Segna come inviato] · Elimina) */}
          <div style={{ margin: '14px 15px 0' }} id="mobile-altre-azioni">
            <AltreAzioniCard>
              <DuplicateDocumentButton documentId={id} asRow />
              {isDraft && <RegisterManualSendButton documentId={id} asRow />}
              <DeleteDocumentButton
                documentId={id}
                documentTitle={formatDocNumber(doc.doc_number) !== '—' ? formatDocNumber(doc.doc_number) : (doc.title ?? 'questo preventivo')}
                asRow
              />
            </AltreAzioniCard>
          </div>

          {/* Card Visualizzazioni (stato Visto) */}
          {doc.status === 'viewed' && views && views.length > 0 && (
            <div style={{ ...cardStyle, margin: '14px 15px 0' }}>
              <div style={cardLabel}>Visualizzazioni</div>
              <div style={{ fontSize: 13, color: '#55534b' }}>
                Aperto {views.length} {views.length === 1 ? 'volta' : 'volte'}
                {latestView && <> · ultima il {fmtDateTime(latestView.viewed_at)}</>}
              </div>
            </div>
          )}

          {/* Card Cronologia */}
          {cronOrdered.length > 0 && (
            <div style={{ ...cardStyle, margin: '14px 15px 0' }}>
              <div style={cardLabel}>Cronologia</div>
              {cronOrdered.map((ev, i) => {
                const isLast = i === cronOrdered.length - 1
                return (
                  <div key={ev.key} style={{ position: 'relative', display: 'flex', gap: 13, paddingBottom: isLast ? 0 : 16 }}>
                    {!isLast && <div style={{ position: 'absolute', left: 9, top: 21, bottom: -9, width: 1.5, background: '#ececef' }} />}
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: ev.bg, color: ev.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto', zIndex: 1 }}>
                      {ev.icon}
                    </div>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#161616' }}>{ev.label}</div>
                      <div style={{ fontSize: 12, color: '#8a887f', marginTop: 1 }}>{ev.date ? fmtDateTime(ev.date) : '—'}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── CONTENUTO DESKTOP (sempre) + FORM MODIFICA (mobile solo con ?edit=1) ── */}
      <div className={edit === '1' ? 'p-4 space-y-4 lg:p-6' : 'hidden lg:block space-y-4 lg:p-6'}>

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
              />
            )}
            {doc.status === 'draft' && (
              <SendEmailDialogController
                documentId={id}
                docNumber={doc.doc_number ? doc.doc_number.replace(/^[A-Za-z]+/, '') : null}
                initialClientEmail={pdfClient?.email ?? null}
                initialClientName={pdfClient ? [pdfClient.name, pdfClient.surname].filter(Boolean).join(' ') : null}
                senderName={workspace.ragione_sociale ?? workspace.name}
                initialOpen={send === '1'}
                initialHasClient={!!pdfClient}
                hasVoci={hasVoci}
              />
            )}
            {(doc.status === 'sent' || doc.status === 'viewed') && (
              <SendEmailDialog
                documentId={id}
                docNumber={doc.doc_number ? doc.doc_number.replace(/^[A-Za-z]+/, '') : null}
                clientEmail={pdfClient?.email ?? null}
                clientId={pdfClient?.id ?? null}
                recipientName={pdfClient ? [pdfClient.name, pdfClient.surname].filter(Boolean).join(' ') : null}
                hasClient={!!pdfClient}
                senderName={workspace.ragione_sociale ?? workspace.name}
                isResend
              />
            )}
            <DuplicateDocumentButton documentId={id} />
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
            })}
            {doc.expires_at && (
              <>
                {' '}· Valido fino al{' '}
                {new Date(doc.expires_at).toLocaleDateString('it-IT', {
                  day: '2-digit', month: 'long', year: 'numeric'
                })}
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
          <div className="hidden lg:flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
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
                  Accettato{doc.signer_name ? ' e firmato dal cliente' : ''}
                </div>
                {doc.accepted_at && (
                  <div style={{ fontSize: 12, color: '#2f8a63', marginTop: 2 }}>
                    {doc.signer_name && <>{doc.signer_name} · </>}
                    {new Date(doc.accepted_at).toLocaleDateString('it-IT', {
                      day: '2-digit', month: 'long', year: 'numeric',
                    })}
                    {doc.accepted_ip != null && <> · IP {String(doc.accepted_ip)}</>}
                  </div>
                )}
                {doc.signature_image && (
                  <img
                    src={doc.signature_image}
                    alt="Firma cliente"
                    className="mt-2 h-12 object-contain rounded border border-green-100 bg-white px-2"
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── BANNER RIFIUTATO (desktop) ── */}
        {doc.status === 'rejected' && (
          <div className="hidden lg:block rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-1">
            <p>Il cliente ha rifiutato questo preventivo.</p>
            {doc.rejection_reason && (
              <p className="text-red-700">
                <span className="font-medium">Motivo: </span>
                {doc.rejection_reason}
              </p>
            )}
          </div>
        )}

        {/* ── BANNER SCADUTO (desktop) ── */}
        {doc.status === 'expired' && (
          <div className="hidden lg:block rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
            Questo preventivo è scaduto.
          </div>
        )}

        {/* ── BANNER INVIATO (non ancora modificato) — desktop ── */}
        {(doc.status === 'sent' || doc.status === 'viewed') && !(doc as any).updated_after_send_at && (
          <div className="hidden lg:flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
            <Info className="size-4 shrink-0 mt-0.5" />
            <p>
              Questo preventivo è stato inviato. Puoi modificarlo e aggiornarlo —
              il cliente riceverà la nuova versione solo se lo reinvii.
            </p>
          </div>
        )}

        {/* ── BANNER MODIFICATO dopo l'invio — desktop ── */}
        {(doc as any).updated_after_send_at && (
          <div className="hidden lg:flex items-start gap-3 rounded-lg border border-violet-300 bg-violet-50 px-4 py-3 text-sm text-violet-900">
            <AlertTriangle className="size-4 shrink-0 mt-0.5 text-violet-600" />
            <div className="flex-1 min-w-0 space-y-2">
              <p className="font-semibold">Preventivo modificato — non ancora reinviato</p>
              <p className="text-violet-800">
                Hai aggiornato questo preventivo il{' '}
                {new Date((doc as any).updated_after_send_at).toLocaleString('it-IT', {
                  day: '2-digit', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                } as Intl.DateTimeFormatOptions)}.
                {' '}Il cliente ha ancora la versione precedente.
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
          />
        </div>

        {/* Cronologia completa — desktop */}
        <div className="hidden lg:block space-y-4">
          <Separator />
          <DocumentTimeline
            createdAt={doc.created_at ?? null}
            sentAt={doc.sent_at ?? null}
            acceptedAt={doc.accepted_at ?? null}
            status={doc.status}
            expiresAt={doc.expires_at ?? null}
            rejectionReason={doc.rejection_reason ?? null}
            views={(views ?? []) as Array<{ id: string; viewed_at: string }>}
            fatturaRef={fatturaOrigin ? { id: fatturaOrigin.id, doc_number: fatturaOrigin.doc_number ?? null, created_at: new Date().toISOString() } : null}
            documentLog={(Array.isArray((doc as any).document_log) ? (doc as any).document_log : []) as DocumentLogEntry[]}
          />

          {/* Storico aperture dettagliato (IP e device) */}
          {views && views.length > 0 && (
            <div className="mt-8">
              <Separator className="mb-6" />
              <ViewHistorySection views={views} />
            </div>
          )}

          <Separator />

          {/* Zona pericolosa */}
          <div className="flex items-center justify-between gap-4 py-2">
            <div>
              <p className="text-sm font-medium">Elimina preventivo</p>
              <p className="text-xs text-muted-foreground">
                Viene spostato nel cestino. Recuperabile entro 15 giorni.
              </p>
            </div>
            <DeleteDocumentButton
              documentId={id}
              documentTitle={formatDocNumber(doc.doc_number) !== '—' ? formatDocNumber(doc.doc_number) : (doc.title ?? 'questo preventivo')}
            />
          </div>
        </div>

      </div>
    </div>
  )
}
