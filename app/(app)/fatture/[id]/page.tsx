import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, FileText, AlertTriangle } from 'lucide-react'
import { LinkToPreventivoButton } from '../_components/LinkToPreventivoButton'
import { StatusBadge } from '@/app/(app)/preventivi/_components/StatusBadge'
import { PdfActions } from '@/app/(app)/preventivi/_components/PdfActions'
import { PreventivoForm } from '@/app/(app)/preventivi/_components/PreventivoForm'
import { DeleteDocumentButton } from '@/app/(app)/preventivi/_components/DeleteDocumentButton'
import { StatusChangeDropdown } from '@/app/(app)/preventivi/_components/StatusChangeDropdown'
import { SendEmailDialog } from '@/app/(app)/preventivi/_components/SendEmailDialog'
import { RestoreVersionButton } from '@/app/(app)/preventivi/_components/RestoreVersionButton'
import { DocumentTimeline } from '@/app/(app)/preventivi/_components/DocumentTimeline'
import { SendEmailDialogController } from '@/app/(app)/preventivi/_components/SendEmailDialogController'
import type { DocumentLogEntry } from '@/app/(app)/preventivi/_components/DocumentTimeline'
import { Separator } from '@/components/ui/separator'
import type { DocStatus } from '@/app/(app)/preventivi/_components/StatusBadge'
import { formatDocNumber } from '@/lib/utils'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ send?: string }>
}

export default async function FatturaDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { send } = await searchParams
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

  const { data: doc } = await supabase
    .from('documents')
    .select('*, document_items(*)')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'fattura')
    .is('deleted_at', null)
    .maybeSingle()

  if (!doc) notFound()

  const { data: templates } = await supabase
    .from('templates')
    .select('id, name, is_default, color_primary, show_logo, show_watermark, legal_notice, preset_key, font_family, logo_position')
    .eq('workspace_id', workspace.id)
    .order('is_default', { ascending: false })

  const activeTemplate = templates?.find((t) => t.id === (doc as any).template_id)
    ?? templates?.find((t) => t.is_default)
    ?? templates?.[0]
    ?? null

  const defaultTemplate = templates?.find(
    (t) => t.is_default && t.name !== 'Template predefinito'
  ) ?? null

  const { data: pdfClient } = doc.client_id
    ? await supabase
        .from('clients')
        .select('name, email, phone, piva, indirizzo, cap, citta, provincia')
        .eq('id', doc.client_id)
        .eq('workspace_id', workspace.id)
        .maybeSingle()
    : { data: null }

  // Storico aperture (solo per documenti non in bozza)
  let views: Array<{ id: string; viewed_at: string }> = []
  if (doc.status !== 'draft') {
    const { data: viewsData } = await supabase
      .from('document_views')
      .select('id, viewed_at')
      .eq('document_id', id)
      .order('viewed_at', { ascending: false })
    views = viewsData ?? []
  }

  // Preventivo di origine (se la fattura è stata generata da conversione)
  let originDoc: { id: string; doc_number: string | null; title: string | null } | null = null
  if (doc.origin_document_id) {
    const { data: _originDoc } = await supabase
      .from('documents')
      .select('id, doc_number, title')
      .eq('id', doc.origin_document_id)
      .eq('workspace_id', workspace.id)
      .maybeSingle()
    originDoc = _originDoc
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
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
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

        <div className="flex items-center gap-2">
          <PdfActions
            documentId={id}
            docNumberSlug={(doc.doc_number ?? doc.id).replace(/\//g, '-')}
            docType="fattura"
          />
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

      <div>
        <h1 className="text-2xl font-bold font-mono">{formatDocNumber(doc.doc_number, 'fattura')}</h1>
        {doc.title && <p className="text-base text-muted-foreground mt-0.5">{doc.title}</p>}
        <p className="text-sm text-muted-foreground mt-1">
          Fattura creata il{' '}
          {new Date(doc.created_at!).toLocaleDateString('it-IT', {
            day: '2-digit', month: 'long', year: 'numeric',
          })}
        </p>
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
            <RestoreVersionButton documentId={id} />
          </div>
        </div>
      )}

      <PreventivoForm
        mode="edit"
        documentId={id}
        defaultValues={doc as any}
        templates={(templates ?? []) as Array<{ id: string; name: string; is_default: boolean | null }>}
        defaultTemplateId={defaultTemplate?.id ?? null}
        fiscalRegime={workspace.fiscal_regime}
        isProPlan={workspace.plan !== 'free'}
        docType="fattura"
      />

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

      <div className="flex items-center justify-between gap-4 py-2">
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
  )
}
