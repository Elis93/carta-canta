import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, FileText } from 'lucide-react'
import { LinkToPreventivoButton } from '../_components/LinkToPreventivoButton'
import { StatusBadge } from '@/app/(app)/preventivi/_components/StatusBadge'
import { PdfActions } from '@/app/(app)/preventivi/_components/PdfActions'
import { PreventivoForm } from '@/app/(app)/preventivi/_components/PreventivoForm'
import { DeleteDocumentButton } from '@/app/(app)/preventivi/_components/DeleteDocumentButton'
import { StatusChangeDropdown } from '@/app/(app)/preventivi/_components/StatusChangeDropdown'
import { SendEmailDialog } from '@/app/(app)/preventivi/_components/SendEmailDialog'
import { Separator } from '@/components/ui/separator'
import type { DocStatus } from '@/app/(app)/preventivi/_components/StatusBadge'
import { formatDocNumber } from '@/lib/utils'

interface Props {
  params: Promise<{ id: string }>
}

export default async function FatturaDetailPage({ params }: Props) {
  const { id } = await params
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

  const defaultTemplate = templates?.find((t) => t.is_default) ?? templates?.[0] ?? null

  const { data: pdfClient } = doc.client_id
    ? await supabase
        .from('clients')
        .select('name, email, phone, piva, indirizzo, cap, citta, provincia')
        .eq('id', doc.client_id)
        .eq('workspace_id', workspace.id)
        .maybeSingle()
    : { data: null }

  // Preventivo di origine (se la fattura è stata generata da conversione)
  const { data: originDoc } = doc.origin_document_id
    ? await supabase
        .from('documents')
        .select('id, doc_number, title')
        .eq('id', doc.origin_document_id)
        .eq('workspace_id', workspace.id)
        .maybeSingle()
    : { data: null }

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
            docNumberSlug={(doc.doc_number ?? doc.id).replace(/\//g, '-')}
            doc={doc as any}
            workspace={workspace as any}
            client={pdfClient ?? null}
            template={activeTemplate ?? null}
            docType="fattura"
          />
          {doc.status === 'draft' && (
            <SendEmailDialog
              documentId={id}
              docNumber={doc.doc_number}
              clientEmail={pdfClient?.email ?? null}
              senderName={workspace.ragione_sociale ?? workspace.name}
              docType="fattura"
            />
          )}
          {(doc.status === 'sent' || doc.status === 'viewed') && (
            <SendEmailDialog
              documentId={id}
              docNumber={doc.doc_number}
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

      <Separator />

      <div className="flex items-center justify-between gap-4 py-2">
        <div>
          <p className="text-sm font-medium">Elimina fattura</p>
          <p className="text-xs text-muted-foreground">Viene spostata nel cestino. Recuperabile entro 15 giorni.</p>
        </div>
        <DeleteDocumentButton
          documentId={id}
          documentTitle={doc.doc_number ?? doc.title ?? 'questa fattura'}
          docType="fattura"
        />
      </div>
    </div>
  )
}
