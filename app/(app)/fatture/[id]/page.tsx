import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, FileText, AlertTriangle, Eye, Pencil } from 'lucide-react'
import { LinkToPreventivoButton } from '../_components/LinkToPreventivoButton'
import { SegnaPagataButton } from '../_components/SegnaPagataButton'
import { StatusBadge } from '@/app/(app)/preventivi/_components/StatusBadge'
import { PdfActions } from '@/app/(app)/preventivi/_components/PdfActions'
import { PreventivoForm } from '@/app/(app)/preventivi/_components/PreventivoForm'
import { DeleteDocumentButton } from '@/app/(app)/preventivi/_components/DeleteDocumentButton'
import { DuplicateDocumentButton } from '@/app/(app)/preventivi/_components/DuplicateDocumentButton'
import { ShareButton } from '@/app/(app)/preventivi/_components/ShareButton'
import { StatusChangeDropdown } from '@/app/(app)/preventivi/_components/StatusChangeDropdown'
import { SendEmailDialog } from '@/app/(app)/preventivi/_components/SendEmailDialog'
import { RestoreVersionButton } from '@/app/(app)/preventivi/_components/RestoreVersionButton'
import { DocumentTimeline } from '@/app/(app)/preventivi/_components/DocumentTimeline'
import { SendEmailDialogController } from '@/app/(app)/preventivi/_components/SendEmailDialogController'
import { AltreAzioniCard } from '@/app/(app)/preventivi/_components/AltreAzioniCard'
import type { DocumentLogEntry } from '@/app/(app)/preventivi/_components/DocumentTimeline'
import { Separator } from '@/components/ui/separator'
import type { DocStatus } from '@/app/(app)/preventivi/_components/StatusBadge'
import { formatDocNumber } from '@/lib/utils'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ send?: string; edit?: string }>
}

export default async function FatturaDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { send, edit } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, ragione_sociale, piva, indirizzo, cap, citta, provincia, logo_url, fiscal_regime, bollo_auto, ritenuta_auto, plan')
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
        .from('workspaces').select('id, name, ragione_sociale, piva, indirizzo, cap, citta, provincia, logo_url, fiscal_regime, bollo_auto, ritenuta_auto, plan')
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

  const isDraft = doc.status === 'draft'
  // Almeno una voce "completa": descrizione + prezzo + quantità tutti valorizzati
  const docItems = (doc as Record<string, unknown>).document_items as Array<Record<string, unknown>> | null ?? []
  const hasVoci = docItems.some(item =>
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
  }

  const chipBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 5, flex: 1, borderRadius: 9, padding: '10px 6px',
    fontSize: 13, fontWeight: 500, textDecoration: 'none',
    border: '0.5px solid var(--cc-border-color)',
    background: 'white', color: 'var(--cc-navy)', cursor: 'pointer',
    whiteSpace: 'nowrap', height: 'auto',
  }

  return (
    <div className="max-w-4xl mx-auto">

      {/* ── MOBILE HEADER (lg:hidden) ── */}
      <div className="lg:hidden flex items-center gap-2.5 px-4 pt-4 pb-3 border-b mb-1">
        <Link
          href="/fatture"
          style={{ color: 'var(--cc-text-2)', flexShrink: 0, display: 'flex', alignItems: 'center' }}
        >
          <ArrowLeft size={22} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--cc-text)', fontFamily: 'monospace' }}>
            {formatDocNumber(doc.doc_number, 'fattura') !== '—' ? formatDocNumber(doc.doc_number, 'fattura') : 'Bozza'}
          </div>
          {clientName && (
            <div style={{ fontSize: 12, color: 'var(--cc-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {clientName}
            </div>
          )}
        </div>
        <StatusBadge status={doc.status} docType="fattura" />
        {edit !== '1' && doc.status !== 'accepted' && doc.status !== 'rejected' && (
          <Link
            href={`/fatture/${id}?edit=1`}
            style={{ color: 'var(--cc-navy)', flexShrink: 0, display: 'flex', alignItems: 'center', padding: 2 }}
            aria-label="Modifica fattura"
          >
            <Pencil size={20} />
          </Link>
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
              />
            )}
            {doc.status === 'draft' && (
              <SendEmailDialogController
                documentId={id}
                docNumber={doc.doc_number ? doc.doc_number.replace(/^[A-Za-z]+/, '') : null}
                initialClientEmail={pdfClient?.email ?? null}
                initialClientName={pdfClient ? pdfClient.name : null}
                initialHasClient={!!doc.client_id}
                senderName={workspace.ragione_sociale ?? workspace.name}
                docType="fattura"
                initialOpen={send === '1'}
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
                docType="fattura"
                isResend
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

        {/* ── MOBILE QUICK ACTIONS (lg:hidden) ── */}
        <div className="flex gap-2 lg:hidden">
          {/* Invia (draft, navy) */}
          {isDraft && (
            <Link
              href="?send=1"
              style={{
                ...chipBase,
                border: 'none',
                background: 'var(--cc-navy)',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(26,26,46,.22)',
              }}
            >
              Invia
            </Link>
          )}
          {/* Reinvia (sent/viewed) */}
          {(doc.status === 'sent' || doc.status === 'viewed') && (
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
            />
          )}
          {/* Condividi */}
          {doc.public_token && (
            <ShareButton
              documentId={id}
              publicToken={doc.public_token}
              docNumber={doc.doc_number}
              docType="fattura"
              isDraft={isDraft}
              hasVoci={hasVoci}
              clientName={clientName}
              triggerStyle={chipBase}
            />
          )}
          {/* Anteprima */}
          <a
            href={`/api/documents/${id}/pdf?preview=1`}
            target="_blank"
            rel="noopener noreferrer"
            style={chipBase}
          >
            <Eye size={16} /> Anteprima
          </a>
        </div>

        {/* ── MOBILE: azioni secondarie (Modifica + Segna pagata) per sent/viewed ── */}
        {(doc.status === 'sent' || doc.status === 'viewed') && (
          <div className="flex gap-2 lg:hidden">
            <Link
              href={`/fatture/${id}?edit=1`}
              style={{ ...chipBase, flex: 1, textAlign: 'center' as const, justifyContent: 'center' }}
            >
              Modifica
            </Link>
            <SegnaPagataButton documentId={id} />
          </div>
        )}

        {/* ── MOBILE: riepilogo compatto fattura (lg:hidden) ── */}
        {docItems.length > 0 && (
          <div className="lg:hidden" style={{ background: '#fff', borderRadius: 9, boxShadow: 'var(--cc-shadow)', overflow: 'hidden' }}>
            <div style={{ padding: '9px 13px', borderBottom: '0.5px solid var(--cc-border-color)', fontSize: 12, color: 'var(--cc-text-3)' }}>
              {'Emessa '}
              {new Date(doc.created_at!).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
              {doc.accepted_at && (
                <>{' · Pagata '}{new Date(doc.accepted_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</>
              )}
              {doc.sent_at && !doc.accepted_at && (
                <>{' · Inviata '}{new Date(doc.sent_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</>
              )}
            </div>
            {docItems.slice(0, 4).map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 13px', borderBottom: '0.5px solid var(--cc-border-color)', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--cc-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(item.description ?? '—')}
                </span>
                {item.total != null && (
                  <span style={{ fontSize: 13, color: 'var(--cc-text-2)', flexShrink: 0 }}>
                    {`€ ${Number(item.total).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
                  </span>
                )}
              </div>
            ))}
            {docItems.length > 4 && (
              <div style={{ fontSize: 12, color: 'var(--cc-text-3)', textAlign: 'center', padding: '6px 13px', borderBottom: '0.5px solid var(--cc-border-color)' }}>
                {`e altre ${docItems.length - 4} voci`}
              </div>
            )}
            {(doc as any).total != null && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '10px 13px' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cc-text)' }}>Totale da pagare</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--cc-text)' }}>
                  {`€ ${Number((doc as any).total).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
                </span>
              </div>
            )}
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
            })}
          </p>
        </div>

        {/* FIX-7bis: avviso di trasparenza — questo documento NON è la fattura elettronica via SdI */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>
            Questo documento non sostituisce la fattura elettronica. Ricordati di trasmetterla tramite SdI
            (cassetto fiscale o commercialista).
          </span>
        </div>

        {/* Link al preventivo di origine */}
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

        {(doc.status === 'accepted' || doc.status === 'rejected') && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {doc.status === 'accepted'
              ? 'Fattura pagata — nessuna modifica consentita.'
              : 'Fattura annullata — nessuna modifica consentita.'}
          </div>
        )}

        {/* ── BANNER MODIFICATO dopo l'invio (C2) ── */}
        {doc.updated_after_send_at && (
          <div className="flex items-start gap-3 rounded-lg border border-violet-300 bg-violet-50 px-4 py-3 text-sm text-violet-900">
            <AlertTriangle className="size-4 shrink-0 mt-0.5 text-violet-600" />
            <div className="flex-1 min-w-0 space-y-2">
              <p className="font-semibold">Fattura modificata — non ancora reinviata</p>
              <p className="text-violet-800">
                Hai aggiornato questa fattura il{' '}
                {new Date(doc.updated_after_send_at).toLocaleString('it-IT', {
                  day: '2-digit', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                } as Intl.DateTimeFormatOptions)}.
                {' '}Il cliente ha ancora la versione precedente.
              </p>
              <RestoreVersionButton documentId={id} docType="fattura" />
            </div>
          </div>
        )}

        {/* Form fattura — su mobile visibile solo con ?edit=1 (e non per accepted/rejected) */}
        <div
          id="fattura-form-section"
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

        {/* ── MOBILE: Altre azioni collassabili (lg:hidden) ── */}
        <div className="lg:hidden" id="mobile-altre-azioni-fattura">
          <AltreAzioniCard>
            <DuplicateDocumentButton documentId={id} />
            <StatusChangeDropdown
              documentId={id}
              currentStatus={doc.status}
              transitions={FATTURA_TRANSITIONS}
              apiPath={`/api/fatture/${id}/status`}
              docType="fattura"
            />
            <DeleteDocumentButton
              documentId={id}
              documentTitle={formatDocNumber(doc.doc_number, 'fattura') !== '—' ? formatDocNumber(doc.doc_number, 'fattura') : (doc.title ?? 'questa fattura')}
              docType="fattura"
            />
          </AltreAzioniCard>
        </div>

        {/* Cronologia fattura (C3) */}
        <Separator />
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

        <Separator />

        {/* ── DESKTOP: Zona pericolosa (hidden on mobile — su mobile è in Altre azioni) ── */}
        <div className="hidden lg:flex items-center justify-between gap-4 py-2">
          <div>
            <p className="text-sm font-medium">Elimina fattura</p>
            <p className="text-xs text-muted-foreground">Viene spostata nel cestino. Recuperabile entro 15 giorni.</p>
          </div>
          <DeleteDocumentButton
            documentId={id}
            documentTitle={formatDocNumber(doc.doc_number, 'fattura') !== '—' ? formatDocNumber(doc.doc_number, 'fattura') : (doc.title ?? 'questa fattura')}
            docType="fattura"
          />
        </div>

      </div>
    </div>
  )
}
