import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft } from 'lucide-react'
import { StatusBadge } from '@/app/(app)/preventivi/_components/StatusBadge'
import { PdfActions } from '@/app/(app)/preventivi/_components/PdfActions'
import { PreventivoForm } from '@/app/(app)/preventivi/_components/PreventivoForm'
import { DeleteDocumentButton } from '@/app/(app)/preventivi/_components/DeleteDocumentButton'
import { StatusChangeDropdown } from '@/app/(app)/preventivi/_components/StatusChangeDropdown'
import { Separator } from '@/components/ui/separator'
import type { DocStatus } from '@/app/(app)/preventivi/_components/StatusBadge'

interface Props {
  params: Promise<{ id: string }>
}

export default async function FatturaDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, ragione_sociale, piva, indirizzo, cap, citta, provincia, logo_url, fiscal_regime, bollo_auto, ritenuta_auto, plan')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) redirect('/login')

  const { data: doc } = await supabase
    .from('documents')
    .select('*, document_items(*)')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'fattura')
    .maybeSingle()

  if (!doc) notFound()

  const { data: templates } = await supabase
    .from('templates')
    .select('id, name, is_default, color_primary, show_logo, show_watermark, legal_notice')
    .eq('workspace_id', workspace.id)
    .order('is_default', { ascending: false })

  const activeTemplate = templates?.find((t) => t.id === (doc as any).template_id)
    ?? templates?.find((t) => t.is_default)
    ?? templates?.[0]
    ?? null

  const { data: pdfClient } = doc.client_id
    ? await supabase
        .from('clients')
        .select('name, email, phone, piva, indirizzo, cap, citta, provincia')
        .eq('id', doc.client_id)
        .eq('workspace_id', workspace.id)
        .maybeSingle()
    : { data: null }

  const isEditable = doc.status === 'draft'

  const FATTURA_TRANSITIONS: Partial<Record<DocStatus, { status: DocStatus; label: string }[]>> = {
    draft: [
      { status: 'accepted', label: 'Segna come pagata' },
      { status: 'rejected', label: 'Annulla fattura' },
    ],
    sent: [
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
            {doc.doc_number ?? '—'}
          </span>
          <StatusBadge status={doc.status} className="ml-1" />
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
          <StatusChangeDropdown
            documentId={id}
            currentStatus={doc.status}
            transitions={FATTURA_TRANSITIONS}
            apiPath={`/api/fatture/${id}/status`}
          />
        </div>
      </div>

      <div>
        <h1 className="text-2xl font-bold font-mono">{doc.doc_number ?? '—'}</h1>
        {doc.title && <p className="text-base text-muted-foreground mt-0.5">{doc.title}</p>}
        <p className="text-sm text-muted-foreground mt-1">
          Fattura creata il{' '}
          {new Date(doc.created_at!).toLocaleDateString('it-IT', {
            day: '2-digit', month: 'long', year: 'numeric',
          })}
        </p>
      </div>

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
        fiscalRegime={workspace.fiscal_regime}
        isProPlan={workspace.plan !== 'free'}
        docType="fattura"
      />

      <Separator />

      <div className="flex items-center justify-between gap-4 py-2">
        <div>
          <p className="text-sm font-medium">Elimina fattura</p>
          <p className="text-xs text-muted-foreground">L&apos;operazione non è reversibile.</p>
        </div>
        <DeleteDocumentButton
          documentId={id}
          documentTitle={doc.doc_number ?? doc.title ?? 'questa fattura'}
        />
      </div>
    </div>
  )
}
