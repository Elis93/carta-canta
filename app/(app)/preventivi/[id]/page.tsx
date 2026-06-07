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
import { SendEmailDialogController } from '../_components/SendEmailDialogController'
import { StatusBadge } from '../_components/StatusBadge'
import { StatusChangeDropdown } from '../_components/StatusChangeDropdown'
import { ViewHistorySection } from '../_components/ViewHistorySection'
import { ConvertiFatturaButton } from '../_components/ConvertiFatturaButton'
import { RegisterManualSendButton } from '../_components/RegisterManualSendButton'
import { checkFreeBlock, FREE_DOC_LIMIT } from '@/lib/free-trial'
import { formatDocNumber } from '@/lib/utils'
import { RestoreVersionButton } from '../_components/RestoreVersionButton'
import { DocumentTimeline } from '../_components/DocumentTimeline'
import type { DocumentLogEntry } from '../_components/DocumentTimeline'

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

  // defaultTemplateId: template personalizzato con is_default=true (esclude "Template predefinito").
  // Se nessun custom template è attivo, il dropdown mostrerà "Default (Classico)".
  const defaultTemplateId = templates?.find(
    (t) => t.is_default && t.name !== 'Template predefinito'
  )?.id ?? null

  // Dati cliente: usati sia per il PDF sia per pre-popolare il campo cliente nel form.
  const { data: pdfClient } = doc.client_id
    ? await supabase
        .from('clients')
        .select('id, name, surname, email, phone, piva, indirizzo, cap, citta, provincia')
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
          {/* Primo invio — solo da bozza.
              Usa il controller che si aggiorna in tempo reale quando
              l'utente cambia il cliente nel form sottostante. */}
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
          {/* Reinvio link — per preventivi già inviati o visti */}
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

      {/* Intestazione documento */}
      <div>
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

      {/* ── BANNER TRIAL FREE ── */}
      {isFree && isDraft && freeTrialStatus && !freeTrialStatus.blocked && (
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

      {/* ── BANNER BOZZA: invio fuori app ──
          NASCOSTO temporaneamente (sessione 26): funzione da rifinire più avanti.
          Il componente RegisterManualSendButton resta nel codice per riattivazione futura. */}
      {false && isDraft && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <p>
            Hai inviato il preventivo al cliente fuori dall&apos;app? Registra l&apos;invio
            per assegnare il numero progressivo e aggiornare lo stato.
          </p>
          <div className="shrink-0">
            <RegisterManualSendButton documentId={id} />
          </div>
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

      {/* ── BANNER ACCETTATO ── */}
      {doc.status === 'accepted' && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Questo preventivo è stato accettato e non può essere modificato.
        </div>
      )}

      {/* ── BANNER RIFIUTATO ── */}
      {doc.status === 'rejected' && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 space-y-1">
          <p>Il cliente ha rifiutato questo preventivo.</p>
          {doc.rejection_reason && (
            <p className="text-red-700">
              <span className="font-medium">Motivo: </span>
              {doc.rejection_reason}
            </p>
          )}
        </div>
      )}

      {/* ── BANNER SCADUTO ── */}
      {doc.status === 'expired' && (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-4 py-3 text-sm text-orange-800">
          Questo preventivo è scaduto.
        </div>
      )}

      {/* ── BANNER INVIATO (non ancora modificato) ── */}
      {(doc.status === 'sent' || doc.status === 'viewed') && !(doc as any).updated_after_send_at && (
        <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <Info className="size-4 shrink-0 mt-0.5" />
          <p>
            Questo preventivo è stato inviato. Puoi modificarlo e aggiornarlo —
            il cliente riceverà la nuova versione solo se lo reinvii.
          </p>
        </div>
      )}

      {/* ── BANNER MODIFICATO dopo l'invio ── */}
      {(doc as any).updated_after_send_at && (
        <div className="flex items-start gap-3 rounded-lg border border-violet-300 bg-violet-50 px-4 py-3 text-sm text-violet-900">
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

      {/* ── RIEPILOGO FIRMA DIGITALE ── */}
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
        defaultTemplateId={defaultTemplateId}
        fiscalRegime={workspace.fiscal_regime}
        isProPlan={workspace.plan !== 'free'}
        defaultClient={formDefaultClient}
      />

      {/* Cronologia completa */}
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
  )
}
