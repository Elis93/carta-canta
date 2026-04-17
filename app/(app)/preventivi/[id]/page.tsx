import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, ExternalLink } from 'lucide-react'
import { PreventivoForm } from '../_components/PreventivoForm'
import { DeleteDocumentButton } from '../_components/DeleteDocumentButton'
import { DuplicateDocumentButton } from '../_components/DuplicateDocumentButton'
import { PdfActions } from '../_components/PdfActions'
import { SendEmailDialog } from '../_components/SendEmailDialog'
import { StatusBadge } from '../_components/StatusBadge'
import { StatusChangeDropdown } from '../_components/StatusChangeDropdown'
import { ViewHistorySection } from '../_components/ViewHistorySection'

interface Props {
  params: Promise<{ id: string }>
}

export default async function PreventivoDetailPage({ params }: Props) {
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
    .maybeSingle()

  if (!doc) notFound()

  // Carica template (campi base per il form + campi PDF)
  const { data: templates } = await supabase
    .from('templates')
    .select('id, name, is_default, color_primary, show_logo, show_watermark, legal_notice')
    .eq('workspace_id', workspace.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: true })

  // Template attivo per il documento corrente (usato per il PDF)
  const activeTemplate = templates?.find((t) => t.id === (doc as any).template_id)
    ?? templates?.find((t) => t.is_default)
    ?? templates?.[0]
    ?? null

  // Dati cliente per il PDF (facoltativo — il documento può non avere cliente)
  const { data: pdfClient } = doc.client_id
    ? await supabase
        .from('clients')
        .select('name, email, phone, piva, indirizzo, cap, citta, provincia')
        .eq('id', doc.client_id)
        .eq('workspace_id', workspace.id)
        .maybeSingle()
    : { data: null }

  // Storico aperture (solo per documenti non in bozza)
  const { data: views } = doc.status !== 'draft'
    ? await supabase
        .from('document_views')
        .select('id, viewed_at, ip_address, country')
        .eq('document_id', id)
        .order('viewed_at', { ascending: false })
        .limit(50)
    : { data: [] }

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
          <span className="text-foreground font-mono font-semibold">
            {doc.doc_number ?? '—'}
          </span>
          {doc.title && (
            <span className="text-muted-foreground truncate hidden sm:inline">
              · {doc.title}
            </span>
          )}
          <StatusBadge status={doc.status} className="ml-1" />
        </div>

        <div className="flex items-center gap-2">
          <StatusChangeDropdown documentId={id} currentStatus={doc.status} />
          {publicUrl && (doc.status === 'sent' || doc.status === 'viewed' || doc.status === 'accepted') && (
            <Button variant="outline" size="sm" asChild>
              <Link href={publicUrl} target="_blank">
                <ExternalLink className="size-4" /> Link cliente
              </Link>
            </Button>
          )}
          <PdfActions
            docNumberSlug={(doc.doc_number ?? doc.id).replace(/\//g, '-')}
            doc={doc as any}
            workspace={workspace as any}
            client={pdfClient ?? null}
            template={activeTemplate ?? null}
          />
          {/* "Invia al cliente" — solo bozze; dopo l'invio il badge cambia in Inviato */}
          {doc.status === 'draft' && (
            <SendEmailDialog
              documentId={id}
              docNumber={doc.doc_number}
              clientEmail={pdfClient?.email ?? null}
              senderName={workspace.ragione_sociale ?? workspace.name}
            />
          )}
          <DuplicateDocumentButton documentId={id} />
        </div>
      </div>

      {/* Intestazione documento */}
      <div>
        {/* Numero progressivo come h1 principale */}
        <h1 className="text-2xl font-bold font-mono">
          {doc.doc_number ?? '—'}
        </h1>
        {/* Oggetto / titolo — mostrato solo se presente */}
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

      {/* Riepilogo firma digitale */}
      {doc.status === 'accepted' && doc.accepted_at && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm space-y-1">
          <p className="font-medium text-green-800">Accettazione registrata</p>
          <p className="text-green-700">
            {doc.signer_name ? (
              <>Firmato da <strong>{doc.signer_name}</strong> il{' '}</>
            ) : (
              <>Accettato il{' '}</>
            )}
            {new Date(doc.accepted_at).toLocaleDateString('it-IT', {
              day: '2-digit', month: 'long', year: 'numeric',
              hour: '2-digit', minute: '2-digit',
            } as Intl.DateTimeFormatOptions)}
            {doc.accepted_ip && (
              <span className="text-green-600"> · IP {doc.accepted_ip}</span>
            )}
          </p>
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

      {/* Storico aperture */}
      {views && views.length > 0 && (
        <>
          <Separator />
          <ViewHistorySection views={views} />
        </>
      )}

      <Separator />

      {/* Zona pericolosa */}
      <div className="flex items-center justify-between gap-4 py-2">
        <div>
          <p className="text-sm font-medium">Elimina preventivo</p>
          <p className="text-xs text-muted-foreground">
            L&apos;operazione non è reversibile.
          </p>
        </div>
        <DeleteDocumentButton
          documentId={id}
          documentTitle={doc.doc_number ?? doc.title ?? 'questo preventivo'}
        />
      </div>
    </div>
  )
}
