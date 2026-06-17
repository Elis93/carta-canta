import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, ExternalLink, AlertTriangle, Info, FileCheck2, Eye, CheckCircle2, Pencil } from 'lucide-react'
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

  const isFree = workspace.plan === 'free'
  const isDraft = doc.status === 'draft'
  // Almeno una voce "completa": descrizione + prezzo + quantità tutti valorizzati
  const docItems = (doc as Record<string, unknown>).document_items as Array<Record<string, unknown>> | null ?? []
  const hasVoci = docItems.some(item =>
    String(item.description ?? '').trim() !== '' &&
    Number(item.unit_price ?? 0) > 0 &&
    Number(item.quantity ?? 0) > 0
  )
  const freeTrialStatus = (isFree && isDraft)
    ? checkFreeBlock(workspace)
    : null

  const publicUrl = doc.public_token ? `/p/${doc.public_token}` : null

  const chipBase: React.CSSProperties = {
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    gap: 6, flex: 1, borderRadius: 13, padding: '0 8px',
    fontSize: 14, fontWeight: 500, textDecoration: 'none',
    border: '1px solid #e7e7ea', boxShadow: '0 1px 2px rgba(20,20,40,.04)',
    background: 'white', color: 'var(--cc-navy)', cursor: 'pointer',
    whiteSpace: 'nowrap', height: 48,
  }

  return (
    <div className="max-w-4xl mx-auto">

      {/* ── MOBILE HEADER (lg:hidden) ── */}
      <div className="lg:hidden flex items-center gap-2.5 px-4 pt-4 pb-3 border-b mb-1">
        <Link
          href="/preventivi"
          style={{ color: 'var(--cc-text-2)', flexShrink: 0, display: 'flex', alignItems: 'center' }}
        >
          <ArrowLeft size={22} />
        </Link>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--cc-text)', fontFamily: 'monospace' }}>
            {formatDocNumber(doc.doc_number) !== '—' ? formatDocNumber(doc.doc_number) : 'Bozza'}
          </div>
          {clientName && (
            <div style={{ fontSize: 12, color: 'var(--cc-text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {clientName}
            </div>
          )}
        </div>
        <StatusBadge status={doc.status} />
        {edit !== '1' && (
          <Link
            href={`/preventivi/${id}?edit=1`}
            style={{ color: 'var(--cc-navy)', flexShrink: 0, display: 'flex', alignItems: 'center', padding: 2 }}
            aria-label="Modifica preventivo"
          >
            <Pencil size={20} />
          </Link>
        )}
      </div>

      <div className="p-4 lg:p-6 space-y-4">

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

        {/* ── MOBILE: banner accettazione PRIMA delle azioni (lg:hidden) ── */}
        {doc.status === 'accepted' && (
          <div className="lg:hidden" style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '11px 14px', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <CheckCircle2 size={17} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>
                Accettato e firmato dal cliente
              </div>
              {doc.accepted_at && (
                <div style={{ fontSize: 12, color: '#16a34a', marginTop: 2 }}>
                  {doc.signer_name && <>{doc.signer_name} · </>}
                  {new Date(doc.accepted_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
                  {doc.accepted_ip != null && <> · IP {String(doc.accepted_ip)}</>}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── MOBILE QUICK ACTIONS (lg:hidden) ── */}
        <div className="flex gap-2 lg:hidden">
          {/* Anteprima — sempre visibile, grigio */}
          <a
            href={`/api/documents/${id}/pdf?preview=1`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...chipBase, color: '#6b6f7a' }}
          >
            <Eye size={16} /> Anteprima
          </a>
          {/* Condividi — navy, gestisce sia invia (draft) sia reinvia (sent/viewed) */}
          {doc.public_token && (
            <ShareButton
              documentId={id}
              publicToken={doc.public_token}
              docNumber={doc.doc_number}
              docType="preventivo"
              isDraft={isDraft}
              hasVoci={hasVoci}
              clientName={clientName}
              triggerStyle={{ ...chipBase, background: 'var(--cc-navy)', color: '#fff', border: '1px solid var(--cc-navy)', boxShadow: '0 4px 14px rgba(26,26,46,.22)' }}
            />
          )}
          {/* Segna accettato / Segna rifiutato (solo se in attesa) */}
          {(doc.status === 'sent' || doc.status === 'viewed') && (
            <MobileStatusChips documentId={id} chipBase={chipBase} />
          )}
          {/* Crea fattura (solo se accepted e nessuna fattura collegata) */}
          {doc.status === 'accepted' && doc.doc_type !== 'fattura' && !fatturaOrigin && (
            <ConvertiFatturaButton documentId={id} />
          )}
        </div>

        {/* ── MOBILE: riepilogo compatto preventivo (lg:hidden) ── */}
        {docItems.length > 0 && (
          <div className="lg:hidden" style={{ background: '#fff', borderRadius: 9, boxShadow: 'var(--cc-shadow)', overflow: 'hidden' }}>
            <div style={{ padding: '9px 13px', borderBottom: '0.5px solid var(--cc-border-color)', fontSize: 12, color: 'var(--cc-text-3)' }}>
              {'Emesso '}
              {new Date(doc.created_at!).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}
              {doc.accepted_at && (
                <>{' · Accettato '}{new Date(doc.accepted_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</>
              )}
              {doc.sent_at && !doc.accepted_at && (
                <>{' · Inviato '}{new Date(doc.sent_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short' })}</>
              )}
            </div>
            {docItems.slice(0, 4).map((item, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 13px', borderBottom: '0.5px solid var(--cc-border-color)', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--cc-text)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(item.description ?? '—')}
                </span>
                {item.total != null && (
                  <span style={{ fontSize: 13, color: 'var(--cc-text-2)', flexShrink: 0 }}>
                    {`€ ${Number(item.total).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
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
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--cc-text)' }}>Totale</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--cc-text)' }}>
                  {`€ ${Number((doc as any).total).toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`}
                </span>
              </div>
            )}
          </div>
        )}

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

        {/* ── PROMEMORIA QUOTA FREE ── */}
        {isFree && isDraft && freeTrialStatus && !freeTrialStatus.blocked && (
          <div style={{ background: '#fff', border: '1px solid #e8e2d4', borderLeft: '3px solid #c9a44c', borderRadius: 9, padding: '9px 13px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ color: '#c9a44c', fontSize: 16, flexShrink: 0 }}>♛</span>
            <span style={{ fontSize: 13, color: 'var(--cc-text-2)', flex: 1 }}>
              {freeTrialStatus.docsUsed}/{FREE_DOC_LIMIT} preventivi gratuiti
            </span>
            <Link href="/abbonamento" style={{ fontSize: 13, fontWeight: 600, color: '#c9a44c', textDecoration: 'none', flexShrink: 0 }}>Passa a Pro →</Link>
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

        {/* ── BANNER BOZZA: invio fuori app (nascosto) ── */}
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

        {/* ── BANNER ACCETTAZIONE (con firma) — desktop only, su mobile è sopra le azioni ── */}
        {doc.status === 'accepted' && (
          <div className="hidden lg:block">
            <div style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              borderRadius: 10,
              padding: '11px 14px',
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}>
              <CheckCircle2 size={17} style={{ color: '#16a34a', flexShrink: 0, marginTop: 2 }} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#15803d' }}>
                  Accettato{doc.signer_name ? ' e firmato dal cliente' : ''}
                </div>
                {doc.accepted_at && (
                  <div style={{ fontSize: 12, color: '#16a34a', marginTop: 2 }}>
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

        {/* Form preventivo — su mobile visibile solo con ?edit=1 */}
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

        {/* ── MOBILE: Crea fattura (full-width, navy) — solo se accettato e nessuna fattura collegata ── */}
        {doc.status === 'accepted' && doc.doc_type !== 'fattura' && !fatturaOrigin && (
          <div className="lg:hidden">
            <ConvertiFatturaButton documentId={id} />
          </div>
        )}
        {/* Desktop: link alla fattura già generata */}
        {doc.status === 'accepted' && doc.doc_type !== 'fattura' && fatturaOrigin && (
          <div className="lg:hidden">
            <Button variant="outline" className="w-full" asChild>
              <Link href={`/fatture/${fatturaOrigin.id}`}>
                <FileCheck2 className="size-4" />
                Fattura {fatturaOrigin.doc_number ? formatDocNumber(fatturaOrigin.doc_number) : 'bozza'}
              </Link>
            </Button>
          </div>
        )}

        {/* ── MOBILE: Altre azioni collassabili (lg:hidden) ── */}
        <div className="lg:hidden" id="mobile-altre-azioni">
          <AltreAzioniCard>
            <DuplicateDocumentButton documentId={id} />
            <StatusChangeDropdown documentId={id} currentStatus={doc.status} />
            {isDraft && <RegisterManualSendButton documentId={id} />}
            <DeleteDocumentButton
              documentId={id}
              documentTitle={formatDocNumber(doc.doc_number) !== '—' ? formatDocNumber(doc.doc_number) : (doc.title ?? 'questo preventivo')}
            />
          </AltreAzioniCard>
        </div>

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

        {/* ── DESKTOP: Zona pericolosa (hidden on mobile — su mobile è in Altre azioni) ── */}
        <div className="hidden lg:flex items-center justify-between gap-4 py-2">
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
  )
}
