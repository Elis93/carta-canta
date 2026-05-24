import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { ActionBar } from './_components/ActionBar'
import { TrackView } from './_components/TrackView'
import { DocumentFrame } from '@/components/public/DocumentFrame'
import { CheckCircle2, XCircle, AlertTriangle, Eye, MessageCircle, Banknote } from 'lucide-react'
import { formatDocNumber } from '@/lib/utils'

interface Props {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'

export default async function PublicDocumentPage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  // ── Carica documento con relazioni ─────────────────────────────────────
  // created_at e vat_rate_default sono richiesti da buildPdfHtml().
  const { data: doc } = await admin
    .from('documents')
    .select(`
      id,
      workspace_id,
      doc_type,
      doc_number,
      title,
      notes,
      status,
      template_snapshot,
      created_at,
      sent_at,
      expires_at,
      accepted_at,
      payment_terms,
      validity_days,
      currency,
      subtotal,
      discount_pct,
      discount_fixed,
      tax_amount,
      bollo_amount,
      total,
      vat_rate_default,
      public_token,
      document_items (
        sort_order,
        description,
        unit,
        quantity,
        unit_price,
        discount_pct,
        vat_rate,
        total
      ),
      workspaces!workspace_id (
        owner_id,
        ragione_sociale,
        name,
        logo_url,
        piva,
        indirizzo,
        cap,
        citta,
        provincia,
        fiscal_regime
      ),
      clients!client_id (
        name,
        email,
        phone,
        piva,
        codice_fiscale,
        indirizzo,
        cap,
        citta,
        provincia,
        paese
      )
    `)
    .eq('public_token', token)
    .in('status', ['sent', 'viewed', 'accepted', 'rejected', 'expired'])
    .is('deleted_at', null)
    .maybeSingle()

  if (!doc) notFound()

  const isPreventivo = (doc as Record<string, unknown>).doc_type !== 'fattura'
  const docLabelCap = isPreventivo ? 'Preventivo' : 'Fattura'

  // Redirect a pagine dedicate per stati terminali
  if (doc.status === 'expired') redirect(`/p/${token}/scaduto`)

  // Controlla se il visitatore è il proprietario del workspace.
  // Se sì, non tracciamo l'apertura (evita falsi "visto").
  let isOwner = false
  try {
    const userSupabase = await createClient()
    const { data: { user } } = await userSupabase.auth.getUser()
    const ws = doc.workspaces as { owner_id: string }
    if (user && ws.owner_id === user.id) isOwner = true
  } catch { /* silenzioso — non blocca il rendering */ }

  const workspace = doc.workspaces as {
    owner_id: string
    ragione_sociale: string | null
    name: string
    logo_url: string | null
    piva: string | null
    indirizzo: string | null
    cap: string | null
    citta: string | null
    provincia: string | null
    fiscal_regime: string
  }

  const client = doc.clients as {
    name: string
    email: string | null
    phone: string | null
    piva: string | null
    codice_fiscale: string | null
    indirizzo: string | null
    cap: string | null
    citta: string | null
    provincia: string | null
    paese: string | null
  } | null

  const workspaceName = workspace.ragione_sociale ?? workspace.name

  // ── Template snapshot + fallback chain ──────────────────────────────────
  // Priorità identica alla PDF route:
  //   1. template_snapshot sul documento (congelato all'invio)
  //   2. template di default del workspace
  //   3. primo template disponibile nel workspace
  //   4. null → buildPdfHtml() userà stili di default
  type TemplateSnap = {
    preset_key?: string | null
    color_primary?: string | null
    font_family?: string | null
    show_logo?: boolean | null
    show_watermark?: boolean | null
    legal_notice?: string | null
    logo_position?: string | null
  }
  let snap = (doc as Record<string, unknown>).template_snapshot as TemplateSnap | null

  if (!snap) {
    const workspaceId = (doc as Record<string, unknown>).workspace_id as string
    const { data: defaultTmpl } = await admin
      .from('templates')
      .select('preset_key, color_primary, font_family, show_logo, show_watermark, legal_notice, logo_position')
      .eq('workspace_id', workspaceId)
      .eq('is_default', true)
      .maybeSingle()
    if (defaultTmpl) {
      snap = defaultTmpl
    } else {
      const { data: anyTmpl } = await admin
        .from('templates')
        .select('preset_key, color_primary, font_family, show_logo, show_watermark, legal_notice, logo_position')
        .eq('workspace_id', workspaceId)
        .limit(1)
        .maybeSingle()
      if (anyTmpl) snap = anyTmpl
    }
  }

  // ── Recupera email owner per il link "Hai domande?" ────────────────────
  let ownerEmail: string | null = null
  try {
    const { data } = await admin.auth.admin.getUserById(workspace.owner_id)
    ownerEmail = data?.user?.email ?? null
  } catch { /* silenzioso */ }

  // L'HTML del documento viene servito direttamente dalla route API
  // /api/p/[token]/pdf?preview=1 che usa buildPdfHtml() con Google Fonts.
  // Usare src= invece di srcDoc= nell'iframe risolve il problema dei font:
  // i browser bloccano le risorse esterne (Google Fonts) dagli iframe con
  // origine null (srcDoc), ma le caricano normalmente da una URL reale.

  // ── Stato del documento ────────────────────────────────────────────────
  const statusBanner = getStatusBanner(doc.status, workspaceName, isPreventivo)

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header brand — semplice, neutro. Il documento è dentro l'iframe. */}
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            {docLabelCap} inviato tramite{' '}
            <a
              href="https://cartacanta.app"
              className="font-medium text-foreground hover:underline"
            >
              Carta Canta
            </a>
          </span>
          {doc.doc_number && (
            <span className="text-xs text-muted-foreground">
              #{formatDocNumber(doc.doc_number)}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Status banner (stati non-sent) */}
        {statusBanner && (
          <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${statusBanner.classes}`}>
            {statusBanner.icon}
            <div>
              <p className="font-medium text-sm">{statusBanner.title}</p>
              <p className="text-xs opacity-80">{statusBanner.subtitle}</p>
            </div>
          </div>
        )}

        {/* ── Documento — iframe punta alla route API (stesso HTML del PDF) ── */}
        {/* src= garantisce origine reale → Google Fonts caricano correttamente */}
        <DocumentFrame
          src={`/api/p/${token}/pdf?preview=1`}
          title={`${docLabelCap} di ${workspaceName}`}
        />

        {/* CTA — se sent o viewed */}
        {(doc.status === 'sent' || doc.status === 'viewed') && (
          isPreventivo ? (
            /* Preventivo: accetta / rifiuta / contatta / scarica */
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
              <h2 className="font-semibold text-base">
                Cosa vuoi fare con questo preventivo?
              </h2>
              <ActionBar
                token={token}
                documentTitle={doc.title || (doc.doc_number ? `Preventivo #${formatDocNumber(doc.doc_number)}` : `Preventivo di ${workspaceName}`)}
                workspaceName={workspaceName}
                contactEmail={ownerEmail}
                contactPhone={null}
              />
              <div className="flex flex-wrap gap-3 pt-1 border-t">
                <a
                  href={`/api/p/${token}/pdf?preview=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted transition-colors"
                >
                  <Eye className="size-4" />
                  Visualizza preventivo
                </a>
              </div>
            </div>
          ) : (
            /* Fattura: visualizzazione + contatto */
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
              <div className="flex items-center gap-2 text-amber-700">
                <Banknote className="size-5 shrink-0" />
                <h2 className="font-semibold text-base">
                  Questa fattura è in attesa di pagamento
                </h2>
              </div>
              {doc.payment_terms && (
                <p className="text-sm text-muted-foreground">
                  Termini di pagamento:{' '}
                  <strong className="text-foreground">{doc.payment_terms}</strong>
                </p>
              )}
              <div className="flex flex-wrap gap-3 pt-1">
                <a
                  href={`/api/p/${token}/pdf?preview=1`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted transition-colors"
                >
                  <Eye className="size-4" />
                  Visualizza fattura
                </a>
                {ownerEmail && (
                  <a
                    href={`mailto:${ownerEmail}`}
                    className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted transition-colors"
                  >
                    <MessageCircle className="size-4" />
                    Contatta {workspaceName}
                  </a>
                )}
              </div>
            </div>
          )
        )}

        {/* Accettato (preventivo) / Pagata (fattura) */}
        {doc.status === 'accepted' && (
          <div className="bg-white rounded-xl border border-green-200 shadow-sm p-5">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="size-5" />
              <p className="font-medium text-sm">
                {isPreventivo
                  ? `Preventivo accettato${doc.accepted_at ? ` il ${new Date(doc.accepted_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}` : ''}`
                  : 'Fattura contrassegnata come pagata'
                }
              </p>
            </div>
          </div>
        )}

        {/* Tracking vista — client-side */}
        {(doc.status === 'sent' || doc.status === 'viewed') && !isOwner && (
          <TrackView token={token} />
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pb-6">
          {docLabelCap} gestit{isPreventivo ? 'o' : 'a'} con{' '}
          <a href="https://cartacanta.app" className="underline hover:text-foreground">
            Carta Canta
          </a>
          {' '}· Documenti professionali per artigiani italiani
        </p>

      </main>
    </div>
  )
}

// ── Helper: banner stato ───────────────────────────────────────────────────

function getStatusBanner(status: string, workspaceName: string, isPreventivo: boolean) {
  switch (status) {
    case 'accepted':
      return isPreventivo
        ? {
            title: 'Preventivo accettato',
            subtitle: `Hai accettato questo preventivo di ${workspaceName}.`,
            icon: <CheckCircle2 className="size-5 shrink-0 text-green-600" />,
            classes: 'bg-green-50 border-green-200 text-green-800',
          }
        : {
            title: 'Fattura pagata',
            subtitle: `Questa fattura è stata contrassegnata come pagata da ${workspaceName}.`,
            icon: <CheckCircle2 className="size-5 shrink-0 text-green-600" />,
            classes: 'bg-green-50 border-green-200 text-green-800',
          }
    case 'rejected':
      return isPreventivo
        ? {
            title: 'Preventivo rifiutato',
            subtitle: `Hai rifiutato questo preventivo. Contatta ${workspaceName} per ulteriori informazioni.`,
            icon: <XCircle className="size-5 shrink-0 text-red-600" />,
            classes: 'bg-red-50 border-red-200 text-red-800',
          }
        : {
            title: 'Fattura annullata',
            subtitle: `Questa fattura è stata annullata. Contatta ${workspaceName} per ulteriori informazioni.`,
            icon: <XCircle className="size-5 shrink-0 text-red-600" />,
            classes: 'bg-red-50 border-red-200 text-red-800',
          }
    case 'expired':
      return {
        title: 'Preventivo scaduto',
        subtitle: `Questo preventivo non è più valido. Contatta ${workspaceName} per un nuovo preventivo.`,
        icon: <AlertTriangle className="size-5 shrink-0 text-amber-600" />,
        classes: 'bg-amber-50 border-amber-200 text-amber-800',
      }
    default:
      return null
  }
}
