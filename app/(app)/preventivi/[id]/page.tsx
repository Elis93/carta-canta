import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, ExternalLink, AlertTriangle, Info, FileCheck2 } from 'lucide-react'
import { PreventivoForm } from '../_components/PreventivoForm'
import { DeleteDocumentButton } from '../_components/DeleteDocumentButton'
import { DuplicateDocumentButton } from '../_components/DuplicateDocumentButton'
import { PdfActions } from '../_components/PdfActions'
import { SendEmailDialog } from '../_components/SendEmailDialog'
import { StatusBadge } from '../_components/StatusBadge'
import { StatusChangeDropdown } from '../_components/StatusChangeDropdown'
import { ViewHistorySection } from '../_components/ViewHistorySection'
import { ConvertiFatturaButton } from '../_components/ConvertiFatturaButton'
import { RegisterManualSendButton } from '../_components/RegisterManualSendButton'
import { checkFreeBlock, FREE_DOC_LIMIT } from '@/lib/free-trial'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ send?: string }>
}

export default async function PreventivoDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { send } = await searchParams
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

  const { data: doc } = await supabase
    .from('documents')
    .select('*, document_items(*)')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'preventivo')
    .is('deleted_at', null)
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

  // Template di default del workspace (usato per pre-selezionare il Select nel form)
  const defaultTemplate = templates?.find((t) => t.is_default) ?? templates?.[0] ?? null

  // Dati cliente: usati sia per il PDF sia per pre-popolare il campo cliente nel form.
  const { data: pdfClient } = doc.client_id
    ? await supabase
        .from('clients')
        .select('id, name, email, phone, piva, indirizzo, cap, citta, provincia')
        .eq('id', doc.client_id)
        .eq('workspace_id', workspace.id)
        .maybeSingle()
    : { data: null }

  const formDefaultClient = pdfClient
    ? { id: pdfClient.id, name: pdfClient.name, email: pdfClient.email ?? null, phone: pdfClient.phone ?? null, piva: pdfClient.piva ?? null }
    : null

  // Fattura generata da questo preventivo (solo se accepted)
  const { data: fatturaOrigin } = doc.status === 'accepted' && doc.doc_type !== 'fattura'
    ? await supabase
        .from('documents')
        .select('id, doc_number')
        .eq('origin_document_id', id)
        .eq('workspace_id', workspace.id)
        .eq('doc_type', 'fattura')
        .limit(1)
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

  const isFree = workspace.plan === 'free'
  const isDraft = doc.status === 'draft'
  const hasVoci = Number((doc as Record<string, unknown>).total ?? 0) > 0
  const hasPdfDownloaded = !!(doc as any).pdf_downloaded_at
  const freeTrialStatus = (isFree && isDraft)
    ? checkFreeBlock(workspace)
    : null

  const isEditable = isDraft
  const publicUrl = doc.public_token ? `/p/${doc.public_token}` : null

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      {/* Breadcrumb + azioni veloci */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
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
          <StatusBadge
            status={doc.status}
            pdfDownloaded={hasPdfDownloaded}
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
            docNumberSlug={(doc.doc_number ?? doc.id).replace(/\//g, '-')}
            doc={doc as any}
            workspace={workspace as any}
            client={pdfClient ?? null}
            template={activeTemplate ?? null}
          />
          {/* Primo invio — solo da bozza */}
          {doc.status === 'draft' && (
            <SendEmailDialog
              documentId={id}
              docNumber={doc.doc_number}
              clientEmail={pdfClient?.email ?? null}
              senderName={workspace.ragione_sociale ?? workspace.name}
              initialOpen={send === '1'}
              hasClient={!!pdfClient}
              hasVoci={hasVoci}
            />
          )}
          {/* Reinvio link — per preventivi già inviati o visti */}
          {(doc.status === 'sent' || doc.status === 'viewed') && (
            <SendEmailDialog
              documentId={id}
              docNumber={doc.doc_number}
              clientEmail={pdfClient?.email ?? null}
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
                  Fattura {fatturaOrigin.doc_number ?? 'bozza'}
                </Link>
              </Button>
            ) : (
              <ConvertiFatturaButton documentId={id} />
            )
          )}
        </div>
      </div>

      {/* Intestazione documento */}
      <div>
        <h1 className="text-2xl font-bold font-mono">
          {doc.doc_number ?? '—'}
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

      {/* ── BANNER TRIAL FREE (bozza non ancora scaricata) ── */}
      {isFree && isDraft && !hasPdfDownloaded && freeTrialStatus && !freeTrialStatus.blocked && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Info className="size-4 shrink-0 mt-0.5" />
          <p>
            Piano Free · <strong>{freeTrialStatus.docsUsed}/{FREE_DOC_LIMIT}</strong> preventivi inviati
            {freeTrialStatus.daysRemaining !== null && freeTrialStatus.daysRemaining > 0 && (
              <> · <strong>{freeTrialStatus.daysRemaining} {freeTrialStatus.daysRemaining === 1 ? 'giorno' : 'giorni'}</strong> rimanenti</>
            )}
            .{' '}
            <Link href="/abbonamento" className="underline underline-offset-2">
              Passa a Pro
            </Link>{' '}
            per preventivi illimitati.
          </p>
        </div>
      )}
      {/* ── BANNER BLOCCO TRIAL FREE ── */}
      {isFree && isDraft && freeTrialStatus?.blocked && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
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

      {/* ── BANNER POST-DOWNLOAD (bozza scaricata ma non ancora inviata) ── */}
      {isDraft && hasPdfDownloaded && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p className="font-medium mb-1">PDF scaricato — numero non ancora assegnato</p>
          <p className="mb-3">
            Il preventivo è stato scaricato ma non ha ancora un numero ufficiale e non risulta
            inviato. Se l&apos;hai inviato al cliente fuori dall&apos;app, registra l&apos;invio
            per assegnare il numero progressivo.
          </p>
          <RegisterManualSendButton documentId={id} />
        </div>
      )}

      {/* Avviso: nessun template disponibile */}
      {(!templates || templates.length === 0) && (
        <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <p>
            <span className="font-medium">Nessun template disponibile.</span>{' '}
            Il PDF verrà generato con il layout predefinito.{' '}
            <Link href="/template/nuovo" className="underline underline-offset-2 hover:text-yellow-900">
              Crea un template
            </Link>{' '}
            per personalizzare colori e aspetto del documento.
          </p>
        </div>
      )}

      {/* Stato non-editabile */}
      {!isEditable && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 space-y-1">
          <p>
            {doc.status === 'accepted'
              ? 'Questo preventivo è stato accettato e non può essere modificato.'
              : doc.status === 'sent'
              ? 'Il preventivo è stato inviato al cliente. Modificarlo creerà una nuova bozza.'
              : doc.status === 'rejected'
              ? 'Il cliente ha rifiutato questo preventivo.'
              : 'Il preventivo non è modificabile nel suo stato attuale.'}
          </p>
          {doc.status === 'rejected' && doc.rejection_reason && (
            <p className="text-amber-700">
              <span className="font-medium">Motivo: </span>
              {doc.rejection_reason}
            </p>
          )}
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
            {doc.accepted_ip != null && (
              <span className="text-green-600"> · IP {String(doc.accepted_ip)}</span>
            )}
          </p>
          {doc.signature_image && (
            <img
              src={doc.signature_image}
              alt="Firma cliente"
              className="mt-2 h-12 object-contain rounded border border-green-100 bg-white px-2"
            />
          )}
        </div>
      )}

      {/* Form preventivo */}
      <PreventivoForm
        mode="edit"
        documentId={id}
        defaultValues={doc as any}
        templates={(templates ?? []) as Array<{ id: string; name: string; is_default: boolean | null }>}
        defaultTemplateId={defaultTemplate?.id ?? null}
        fiscalRegime={workspace.fiscal_regime}
        isProPlan={workspace.plan !== 'free'}
        defaultClient={formDefaultClient}
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
            Viene spostato nel cestino. Recuperabile entro 15 giorni.
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
