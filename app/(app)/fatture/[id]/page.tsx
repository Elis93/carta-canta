import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { ArrowLeft, FileText, AlertTriangle, Eye, Pencil, X, ChevronLeft, Banknote, Link as LinkIcon } from 'lucide-react'
import { LinkToPreventivoButton } from '../_components/LinkToPreventivoButton'
import { SegnaPagataButton } from '../_components/SegnaPagataButton'
import { AnnullaFatturaButton } from '../_components/AnnullaFatturaButton'
import { StatusBadge } from '@/app/(app)/preventivi/_components/StatusBadge'
import { PdfActions } from '@/app/(app)/preventivi/_components/PdfActions'
import { PreventivoForm } from '@/app/(app)/preventivi/_components/PreventivoForm'
import { ShareButton } from '@/app/(app)/preventivi/_components/ShareButton'
import { StatusChangeDropdown } from '@/app/(app)/preventivi/_components/StatusChangeDropdown'
import { SendEmailDialog } from '@/app/(app)/preventivi/_components/SendEmailDialog'
import { RestoreVersionButton } from '@/app/(app)/preventivi/_components/RestoreVersionButton'
import { DocumentTimeline } from '@/app/(app)/preventivi/_components/DocumentTimeline'
import { SendEmailDialogController } from '@/app/(app)/preventivi/_components/SendEmailDialogController'
import { WorkPhotosCard } from '@/app/(app)/preventivi/_components/WorkPhotosCard'
import { SdiCard, type SdiCardProps } from '../_components/SdiCard'
import { getSdiQuota, SDI_FREE_LIFETIME } from '@/lib/sdi/quota'
import type { DocumentLogEntry } from '@/app/(app)/preventivi/_components/DocumentTimeline'
import { Separator } from '@/components/ui/separator'
import type { DocStatus } from '@/app/(app)/preventivi/_components/StatusBadge'
import { formatDocNumber } from '@/lib/utils'
import { BackButton } from '@/components/shared/BackButton'

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

  // Documento + template: query indipendenti (entrambe dipendono solo da workspace.id) → in parallelo.
  const [{ data: doc }, { data: templates }] = await Promise.all([
    supabase
      .from('documents')
      .select('*, document_items(*)')
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'fattura')
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('templates')
      .select('id, name, is_default, color_primary, show_logo, show_watermark, legal_notice, preset_key, font_family, logo_position')
      .eq('workspace_id', workspace.id)
      .order('is_default', { ascending: false }),
  ])

  if (!doc) notFound()

  const activeTemplate = templates?.find((t) => t.id === (doc as any).template_id)
    ?? templates?.find((t) => t.is_default)
    ?? templates?.[0]
    ?? null

  const defaultTemplate = templates?.find(
    (t) => t.is_default && t.name !== 'Template predefinito'
  ) ?? null

  // Cliente, storico aperture e preventivo di origine: dipendono solo da `doc`,
  // indipendenti tra loro → eseguite in parallelo.
  const [{ data: pdfClient }, { data: viewsData }, { data: _originDoc }] = await Promise.all([
    doc.client_id
      ? supabase
          .from('clients')
          .select('id, name, surname, email, phone, piva, indirizzo, cap, citta, provincia')
          .eq('id', doc.client_id)
          .eq('workspace_id', workspace.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    // Storico aperture (solo per documenti non in bozza)
    doc.status !== 'draft'
      ? supabase
          .from('document_views')
          .select('id, viewed_at')
          .eq('document_id', id)
          .order('viewed_at', { ascending: false })
      : Promise.resolve({ data: [] as Array<{ id: string; viewed_at: string }> }),
    // Preventivo di origine (se la fattura è stata generata da conversione)
    doc.origin_document_id
      ? supabase
          .from('documents')
          .select('id, doc_number, title')
          .eq('id', doc.origin_document_id)
          .eq('workspace_id', workspace.id)
          .is('deleted_at', null)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  const formDefaultClient = pdfClient
    ? { id: pdfClient.id, name: pdfClient.name, surname: pdfClient.surname ?? null, email: pdfClient.email ?? null, phone: pdfClient.phone ?? null, piva: pdfClient.piva ?? null }
    : null

  const clientName = pdfClient
    ? [pdfClient.name, pdfClient.surname].filter(Boolean).join(' ')
    : null

  const views: Array<{ id: string; viewed_at: string }> = viewsData ?? []
  const originDoc: { id: string; doc_number: string | null; title: string | null } | null = _originDoc

  // ── Foto lavoro (tabella 041 — fetch tollerante pre-migration) ──
  let workPhotos: Array<{ id: string; storage_path: string; label: 'prima' | 'dopo' | null; visible_to_client: boolean; sopralluogo_id: string | null }> = []
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 041 non ancora in types/database.ts
    const { data: wp } = await (supabase as any)
      .from('work_photos')
      .select('id, storage_path, label, visible_to_client, sopralluogo_id')
      .eq('document_id', id)
      .order('created_at', { ascending: true })
    workPhotos = wp ?? []
  } catch { /* migration 041 non ancora applicata */ }

  // ── SDI (colonne 044 — tollerante; feature dietro NEXT_PUBLIC_SDI_ENABLED) ──
  let sdiProps: SdiCardProps | null = null
  if (process.env.NEXT_PUBLIC_SDI_ENABLED === 'true' && doc.status !== 'draft') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 044 non ancora in types/database.ts
      const db = supabase as any
      const [{ data: sdiRow }, { data: clientRow }, quota] = await Promise.all([
        db.from('documents').select('sdi_status, sdi_error, sdi_sent_at').eq('id', id).maybeSingle(),
        doc.client_id
          ? db.from('clients').select('codice_destinatario, pec').eq('id', doc.client_id).maybeSingle()
          : Promise.resolve({ data: null }),
        getSdiQuota(workspace.id, workspace.plan),
      ])
      sdiProps = {
        documentId: id,
        sdiStatus: sdiRow?.sdi_status ?? null,
        sdiError: sdiRow?.sdi_error ?? null,
        sdiSentAt: sdiRow?.sdi_sent_at ?? null,
        isPro: workspace.plan !== 'free',
        freeRemaining: quota.allowed ? quota.remaining : 0,
        freeTotal: SDI_FREE_LIFETIME,
        clientDestinatario: clientRow?.codice_destinatario ?? null,
        clientPec: clientRow?.pec ?? null,
        isMockProvider: !process.env.OPENAPI_SDI_API_KEY,
      }
    } catch { /* migration 044 non ancora applicata */ }
  }

  const isDraft = doc.status === 'draft'
  // Invio consentito solo se TUTTE le voci inserite sono complete (descrizione,
  // prezzo e quantità): una bozza può contenere voci "da completare" (AI dalle foto).
  const docItems = (doc as Record<string, unknown>).document_items as Array<Record<string, unknown>> | null ?? []
  const meaningfulDocItems = docItems.filter(item =>
    String(item.description ?? '').trim() !== '' ||
    Number(item.unit_price ?? 0) > 0 ||
    Number(item.quantity ?? 0) > 0
  )
  const hasVoci = meaningfulDocItems.length > 0 && meaningfulDocItems.every(item =>
    String(item.description ?? '').trim() !== '' &&
    Number(item.unit_price ?? 0) > 0 &&
    Number(item.quantity ?? 0) > 0
  )

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
  }

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

  return (
    <div className="max-w-4xl mx-auto">

      {/* ── MOBILE HEADER (lg:hidden) ── */}
      <div
        className="lg:hidden flex items-center gap-2.5"
        style={{ background: '#fff', borderBottom: '0.5px solid #eeeeee', padding: '12px 15px' }}
      >
        <BackButton fallback="/fatture" />
        {/* Simbolo tipo documento (A2, 5 lug): banconota ORO = fattura */}
        <span style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 7, fontSize: 17, fontWeight: 600, color: '#161616' }}>
          <Banknote size={19} style={{ color: '#b08d3e', flexShrink: 0 }} aria-hidden />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {formatDocNumber(doc.doc_number, 'fattura') !== '—' ? formatDocNumber(doc.doc_number, 'fattura') : 'Bozza'}
          </span>
        </span>
        {edit !== '1' && doc.status !== 'accepted' && doc.status !== 'rejected' && (
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
        <StatusBadge status={doc.status} docType="fattura" />
      </div>

      {/* ── MOBILE: card "Preventivo collegato" (lg:hidden) — Apri + Cambia ── */}
      <div
        className="lg:hidden"
        style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '15px 15px', display: 'flex', alignItems: 'center', gap: 12 }}
      >
        <LinkIcon size={20} style={{ color: originDoc ? '#3f6fb0' : '#8a887f', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64' }}>
            Preventivo collegato
          </div>
          {originDoc ? (
            <div style={{ fontSize: 15, fontWeight: 600, color: '#161616', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {originDoc.doc_number ? formatDocNumber(originDoc.doc_number, 'preventivo') : (originDoc.title ?? 'bozza')}
            </div>
          ) : (
            <div style={{ fontSize: 14, color: '#8a887f', marginTop: 2 }}>Nessuno</div>
          )}
        </div>
        {originDoc && (
          <Link href={`/preventivi/${originDoc.id}`} style={{ fontSize: 14, fontWeight: 600, color: '#1a1a2e', textDecoration: 'none', flexShrink: 0 }}>
            Apri
          </Link>
        )}
        <LinkToPreventivoButton
          fatturaId={id}
          workspaceId={workspace.id}
          currentPreventivoId={doc.origin_document_id}
          compact
          triggerStyle={{ display: 'flex', alignItems: 'center', gap: 6, border: '1px solid #e7e7ea', borderRadius: 10, padding: '8px 12px', fontSize: 13, fontWeight: 600, color: '#1a1a2e', background: '#fff', cursor: 'pointer', flexShrink: 0 }}
        />
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
              {formatDocNumber(doc.doc_number, 'fattura')}
            </span>
            <StatusBadge status={doc.status} className="ml-1" docType="fattura" />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <PdfActions
              documentId={id}
              docNumberSlug={(doc.doc_number ?? doc.id).replace(/\//g, '-')}
              docType="fattura"
            />
            {doc.public_token && (
              <ShareButton
                documentId={id}
                publicToken={doc.public_token}
                docNumber={doc.doc_number}
                docType="fattura"
                isDraft={isDraft}
                hasVoci={hasVoci}
                clientName={clientName}
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
                initialClientName={pdfClient ? pdfClient.name : null}
                initialHasClient={!!doc.client_id}
                senderName={workspace.ragione_sociale ?? workspace.name}
                docType="fattura"
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
                docType="fattura"
                isResend
                hideTrigger
              />
            )}
            <StatusChangeDropdown
              documentId={id}
              currentStatus={doc.status}
              transitions={FATTURA_TRANSITIONS}
              apiPath={`/api/fatture/${id}/status`}
              docType="fattura"
            />
          </div>
        </div>

        {/* ── MOBILE: card Cliente (lg:hidden) — statica se il cliente non è in
            rubrica (prima era un link "#" che non portava da nessuna parte) ── */}
        {clientName && (
          pdfClient?.id ? (
            <Link href={`/clienti/${pdfClient.id}`} className="lg:hidden" style={{ background: '#fff', borderRadius: 14, boxShadow: 'var(--cc-shadow)', padding: '15px 15px', display: 'block', textDecoration: 'none' }}>
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 12 }}>Cliente</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#161616' }}>{clientName}</div>
              {(pdfClient?.email || pdfClient?.phone) && (
                <div style={{ fontSize: 13, color: '#8a887f', marginTop: 3 }}>
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

        {/* ── Fattura elettronica SDI (mockup crescita §1) ── */}
        {sdiProps && <SdiCard {...sdiProps} />}

        {/* ── MOBILE: card Foto lavoro (mockup cantiere §2.1) ── */}
        <div className="lg:hidden">
          <WorkPhotosCard documentId={id} initialPhotos={workPhotos} />
        </div>

        {/* ── MOBILE: card Riepilogo (lg:hidden) ── */}
        {docItems.length > 0 && (
          <div className="lg:hidden" style={{ background: '#fff', borderRadius: 14, boxShadow: 'var(--cc-shadow)', padding: '15px 15px' }}>
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 12 }}>Riepilogo</div>
            {docItems.map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', fontSize: 14 }}>
                <span style={{ color: '#161616' }}>{String(item.description ?? '—')}</span>
                {item.total != null && (
                  <span style={{ color: '#161616', whiteSpace: 'nowrap' }}>
                    {`€ ${Number(item.total).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2  })}`}
                  </span>
                )}
              </div>
            ))}
            <div style={{ height: '0.5px', background: '#eee', margin: '6px -15px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', fontSize: 14 }}>
              <span style={{ color: '#161616', fontWeight: 400 }}>Subtotale</span>
              <span style={{ color: '#161616', fontWeight: 500 }}>
                {`€ ${Number((doc as any).subtotal ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2  })}`}
              </span>
            </div>
            {Number((doc as any).tax_amount ?? 0) > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', fontSize: 14 }}>
                <span style={{ color: '#161616', fontWeight: 400 }}>{ivaLabel}</span>
                <span style={{ color: '#161616', fontWeight: 500 }}>
                  {`€ ${Number((doc as any).tax_amount).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2  })}`}
                </span>
              </div>
            )}
            <div style={{ height: '1px', background: '#e3e3e6', margin: '0 -15px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', fontSize: 16 }}>
              <span style={{ color: '#161616', fontWeight: 600 }}>Totale</span>
              <span style={{ color: '#161616', fontWeight: 700 }}>
                {`€ ${Number((doc as any).total ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2  })}`}
              </span>
            </div>
          </div>
        )}

        {/* ── MOBILE: Anteprima + Condividi (lg:hidden) ── */}
        <div className="flex lg:hidden" style={{ gap: 11 }}>
          {/* Anteprima */}
          <a
            href={`/api/documents/${id}/pdf?preview=1`}
            target="_blank"
            rel="noopener noreferrer"
            style={mobileActionBase}
          >
            <Eye size={18} style={{ color: '#55534b' }} /> Anteprima
          </a>
          {/* Condividi (navy) */}
          {doc.public_token && (
            <ShareButton
              documentId={id}
              publicToken={doc.public_token}
              docNumber={doc.doc_number}
              docType="fattura"
              isDraft={isDraft}
              hasVoci={hasVoci}
              clientName={clientName}
              triggerStyle={(doc.status === 'sent' || doc.status === 'viewed' || doc.status === 'expired') ? mobileActionBase : mobileActionPrimary}
            />
          )}
        </div>

        {/* ── MOBILE: Segna pagata (navy) + Annulla fattura (bianco) affiancati, sent/viewed ── */}
        {(doc.status === 'sent' || doc.status === 'viewed' || doc.status === 'expired') && (
          <div className="lg:hidden" style={{ display: 'flex', gap: 11 }}>
            <SegnaPagataButton
              documentId={id}
              total={doc.total}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
              alreadyPaid={(doc as any).payment_status === 'partial' ? Number((doc as any).paid_amount ?? 0) : 0}
            />
            <AnnullaFatturaButton documentId={id} />
          </div>
        )}

        {/* ── DESKTOP: Intestazione documento ── */}
        <div className="hidden lg:block">
          <h1 className="text-2xl font-bold font-mono">{formatDocNumber(doc.doc_number, 'fattura')}</h1>
          {doc.title && <p className="text-base text-muted-foreground mt-0.5">{doc.title}</p>}
          <p className="text-sm text-muted-foreground mt-1">
            Fattura creata il{' '}
            {new Date(doc.created_at!).toLocaleDateString('it-IT', {
              day: '2-digit', month: 'long', year: 'numeric',
             timeZone: 'Europe/Rome' })}
          </p>
        </div>

        {/* FIX-7bis: avviso di trasparenza — questo documento NON è la fattura elettronica via SdI */}
        <div className="flex items-start gap-2 rounded-lg border border-[#e8d6ad] bg-[#f5e9d0] px-4 py-3 text-xs text-[#b0863e]">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>
            Questo documento non sostituisce la fattura elettronica. Ricordati di trasmetterla tramite SdI
            (cassetto fiscale o commercialista).
          </span>
        </div>

        {/* Link al preventivo di origine (desktop — su mobile è la card "Preventivo collegato" in cima) */}
        <div className="hidden lg:block">
        {originDoc ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 px-4 py-3 text-sm text-muted-foreground flex-wrap">
            <div className="flex items-center gap-2">
              <FileText className="size-4 shrink-0" />
              <span>
                Collegata al preventivo{' '}
                <Link
                  href={`/preventivi/${originDoc.id}`}
                  className="font-medium text-foreground hover:underline underline-offset-2"
                >
                  {originDoc.doc_number
                    ? formatDocNumber(originDoc.doc_number, 'preventivo')
                    : originDoc.title ?? 'bozza'}
                </Link>
              </span>
            </div>
            <LinkToPreventivoButton
              fatturaId={id}
              workspaceId={workspace.id}
              currentPreventivoId={doc.origin_document_id}
            />
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground flex-wrap">
            <FileText className="size-4 shrink-0 text-muted-foreground/60" />
            <span className="flex-1">Fattura non collegata a nessun preventivo.</span>
            <LinkToPreventivoButton
              fatturaId={id}
              workspaceId={workspace.id}
            />
          </div>
        )}
        </div>

        {(doc.status === 'accepted' || doc.status === 'rejected') && (
          <div className="rounded-lg border border-[#e8d6ad] bg-[#f5e9d0] px-4 py-3 text-sm text-[#b0863e]">
            {doc.status === 'accepted'
              ? 'Fattura pagata — nessuna modifica consentita.'
              : 'Fattura annullata — nessuna modifica consentita.'}
          </div>
        )}

        {/* ── BANNER MODIFICATO dopo l'invio (C2) ── */}
        {doc.updated_after_send_at && (
          <div className="flex items-start gap-3 rounded-lg border border-[#d6c9ef] bg-[#e9e0f7] px-4 py-3 text-sm text-[#7c3aed]">
            <AlertTriangle className="size-4 shrink-0 mt-0.5 text-[#7c3aed]" />
            <div className="flex-1 min-w-0 space-y-2">
              <p className="font-semibold">Fattura modificata — non ancora reinviata</p>
              <p className="text-[#7c3aed]">
                Hai aggiornato questa fattura il{' '}
                {new Date(doc.updated_after_send_at).toLocaleString('it-IT', {
                  day: '2-digit', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                 timeZone: 'Europe/Rome' } as Intl.DateTimeFormatOptions)}.
                {' '}Il cliente ha ancora la versione precedente.
              </p>
              <RestoreVersionButton documentId={id} docType="fattura" />
            </div>
          </div>
        )}

        {/* Form fattura — su mobile visibile solo con ?edit=1 (e non per accepted/rejected) */}
        <div
          className={edit !== '1' || doc.status === 'accepted' || doc.status === 'rejected' ? 'hidden lg:block' : undefined}
        >
          <PreventivoForm
            mode="edit"
            documentId={id}
            defaultValues={doc as any}
            templates={(templates ?? []) as Array<{ id: string; name: string; is_default: boolean | null }>}
            defaultTemplateId={defaultTemplate?.id ?? null}
            fiscalRegime={workspace.fiscal_regime}
            isProPlan={workspace.plan !== 'free'}
            docType="fattura"
            defaultClient={formDefaultClient}
          />
        </div>

        {/* Foto lavoro — anche su DESKTOP (prima solo nella vista mobile) */}
        <div className="hidden lg:block">
          <WorkPhotosCard documentId={id} initialPhotos={workPhotos} />
        </div>

        {/* Cronologia fattura (C3) — card come nel mockup, stessa resa del preventivo */}
        <div className="cc-card-md" style={{ padding: '15px 15px' }}>
          <DocumentTimeline
            createdAt={doc.created_at ?? null}
            sentAt={doc.sent_at ?? null}
            acceptedAt={doc.accepted_at ?? null}
            status={doc.status}
            expiresAt={doc.expires_at ?? null}
            rejectionReason={doc.rejection_reason ?? null}
            views={views}
            documentLog={(Array.isArray(doc.document_log) ? doc.document_log as unknown as DocumentLogEntry[] : [])}
            docType="fattura"
          />
        </div>

        <Separator className="hidden lg:block" />

      </div>
    </div>
  )
}
