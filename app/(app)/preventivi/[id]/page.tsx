import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { PreventivoForm } from '../_components/PreventivoForm'
import { DeleteDocumentButton } from '../_components/DeleteDocumentButton'
import { DuplicateDocumentButton } from '../_components/DuplicateDocumentButton'
import { DownloadPdfButton } from '../_components/DownloadPdfButton'

interface Props {
  params: Promise<{ id: string }>
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  draft:    { label: 'Bozza',     variant: 'secondary' },
  sent:     { label: 'Inviato',   variant: 'default' },
  accepted: { label: 'Accettato', variant: 'default' },
  rejected: { label: 'Rifiutato', variant: 'destructive' },
  expired:  { label: 'Scaduto',   variant: 'outline' },
}

export default async function PreventivoDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, fiscal_regime, bollo_auto, ritenuta_auto, plan')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) redirect('/login')

  const { data: doc } = await supabase
    .from('documents')
    .select('*, document_items(*)')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (!doc) notFound()

  // Carica template
  const { data: templates } = await supabase
    .from('templates')
    .select('id, name, is_default')
    .eq('workspace_id', workspace.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  const statusInfo = STATUS_LABELS[doc.status] ?? { label: doc.status, variant: 'secondary' as const }
  const isEditable = doc.status === 'draft'
  const publicUrl = doc.public_token ? `/p/${doc.public_token}` : null

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Breadcrumb + azioni veloci */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Link href="/preventivi" className="flex items-center gap-1 hover:text-foreground">
            <ArrowLeft className="size-3.5" /> Preventivi
          </Link>
          <span>/</span>
          <span className="text-foreground font-medium">{doc.title}</span>
          {doc.doc_number && (
            <span className="text-muted-foreground">#{doc.doc_number}</span>
          )}
          <Badge variant={statusInfo.variant} className="text-xs ml-1">
            {statusInfo.label}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          {publicUrl && (doc.status === 'sent' || doc.status === 'accepted') && (
            <Button variant="outline" size="sm" asChild>
              <Link href={publicUrl} target="_blank">
                <ExternalLink className="size-4" /> Link cliente
              </Link>
            </Button>
          )}
          <DownloadPdfButton documentId={id} hasCachedPdf={!!doc.pdf_url} />
          <DuplicateDocumentButton documentId={id} />
        </div>
      </div>

      {/* Titolo + info */}
      <div>
        <h1 className="text-2xl font-semibold">{doc.title}</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
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

      {/* Stato non-editabile */}
      {!isEditable && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {doc.status === 'accepted'
            ? 'Questo preventivo è stato accettato e non può essere modificato.'
            : doc.status === 'sent'
            ? 'Il preventivo è stato inviato al cliente. Modificarlo creerà una nuova bozza.'
            : 'Il preventivo non è modificabile nel suo stato attuale.'}
        </div>
      )}

      {/* Form preventivo */}
      <PreventivoForm
        mode="edit"
        documentId={id}
        defaultValues={doc as any}
        templates={(templates ?? []) as Array<{ id: string; name: string; is_default: boolean | null }>}
        fiscalRegime={workspace.fiscal_regime}
        isProPlan={workspace.plan !== 'free'}
      />

      <Separator />

      {/* Zona pericolosa */}
      <div className="flex items-center justify-between gap-4 py-2">
        <div>
          <p className="text-sm font-medium">Elimina preventivo</p>
          <p className="text-xs text-muted-foreground">
            L&apos;operazione non è reversibile.
          </p>
        </div>
        <DeleteDocumentButton documentId={id} documentTitle={doc.title} />
      </div>
    </div>
  )
}
