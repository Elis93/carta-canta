import { notFound, redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { ActionBar } from './_components/ActionBar'
import { TrackView } from './_components/TrackView'
import { CheckCircle2, XCircle, AlertTriangle, Download, MessageCircle, Banknote } from 'lucide-react'

interface Props {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'

export default async function PublicDocumentPage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  // ── Carica documento con relazioni ─────────────────────────────────────
  const { data: doc } = await admin
    .from('documents')
    .select(`
      id,
      workspace_id,
      title,
      doc_number,
      doc_type,
      status,
      template_snapshot,
      notes,
      validity_days,
      payment_terms,
      currency,
      subtotal,
      discount_pct,
      discount_fixed,
      tax_amount,
      bollo_amount,
      total,
      sent_at,
      expires_at,
      accepted_at,
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
        indirizzo,
        cap,
        citta,
        provincia
      )
    `)
    .eq('public_token', token)
    .in('status', ['sent', 'viewed', 'accepted', 'rejected', 'expired'])
    .maybeSingle()

  if (!doc) notFound()

  const isPreventivo = (doc as Record<string, unknown>).doc_type !== 'fattura'
  const docLabel = isPreventivo ? 'preventivo' : 'fattura'
  const docLabelCap = isPreventivo ? 'Preventivo' : 'Fattura'

  // Redirect a pagine dedicate per stati terminali
  if (doc.status === 'expired') redirect(`/p/${token}/scaduto`)

  // Controlla se il visitatore è il proprietario del workspace.
  // Se sì, non tracciamo l'apertura (evita falsi "visto" quando l'owner
  // clicca sul proprio link per verificare l'invio).
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
    indirizzo: string | null
    cap: string | null
    citta: string | null
    provincia: string | null
  } | null

  const items = (doc.document_items as Array<{
    sort_order: number
    description: string
    unit: string | null
    quantity: number
    unit_price: number
    discount_pct: number | null
    vat_rate: number | null
    total: number
  }>).sort((a, b) => a.sort_order - b.sort_order)

  // ── Template snapshot + fallback chain ───────────────────────────────────
  // Priorità identica al PDF route:
  //   1. template_snapshot sul documento (congelato all'invio)
  //   2. template default del workspace
  //   3. primo template disponibile nel workspace
  //   4. valori hardcoded di fallback
  type TemplateSnap = { preset_key?: string | null; color_primary?: string | null; font_family?: string | null; show_logo?: boolean | null; show_watermark?: boolean | null; legal_notice?: string | null }
  let snap = (doc as Record<string, unknown>).template_snapshot as TemplateSnap | null

  if (!snap) {
    const workspaceId = (doc as Record<string, unknown>).workspace_id as string
    // Prova template default del workspace
    const { data: defaultTmpl } = await admin
      .from('templates')
      .select('preset_key, color_primary, font_family, show_logo, show_watermark, legal_notice')
      .eq('workspace_id', workspaceId)
      .eq('is_default', true)
      .maybeSingle()
    if (defaultTmpl) {
      snap = defaultTmpl
    } else {
      // Primo template disponibile
      const { data: anyTmpl } = await admin
        .from('templates')
        .select('preset_key, color_primary, font_family, show_logo, show_watermark, legal_notice')
        .eq('workspace_id', workspaceId)
        .limit(1)
        .maybeSingle()
      if (anyTmpl) snap = anyTmpl
    }
  }

  const colorPrimary = snap?.color_primary ?? '#1a1a2e'
  const fontFamily   = snap?.font_family   ?? 'Inter'
  const presetKey    = snap?.preset_key    ?? 'classico'
  const isBold       = presetKey === 'bold'
  const isTecnico    = presetKey === 'tecnico'
  const isElegante   = presetKey === 'elegante'
  const legalNotice  = snap?.legal_notice  ?? null

  const workspaceName = workspace.ragione_sociale ?? workspace.name
  const isForfettario = workspace.fiscal_regime === 'forfettario'
  const showIva = !isForfettario && Number(doc.tax_amount) > 0
  const hasDiscount = Number(doc.discount_pct) > 0 || Number(doc.discount_fixed) > 0

  // ── Recupera email owner per il link "Hai domande?" ────────────────────
  let ownerEmail: string | null = null
  try {
    const { data } = await admin.auth.admin.getUserById(workspace.owner_id)
    ownerEmail = data?.user?.email ?? null
  } catch { /* silenzioso */ }

  // ── Stato del documento ────────────────────────────────────────────────
  const statusBanner = getStatusBanner(doc.status, workspaceName, isPreventivo)

  return (
    <div className="min-h-screen bg-gray-50" style={{ fontFamily }}>
      {/* Header brand */}
      <header
        className={isBold ? 'px-4 py-3' : 'bg-white border-b px-4 py-3'}
        style={isBold ? { backgroundColor: colorPrimary } : undefined}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className={`text-sm ${isBold ? 'text-white/80' : 'text-muted-foreground'}`}>
            {docLabelCap} inviato tramite{' '}
            <a href="https://cartacanta.app" className={`font-medium ${isBold ? 'text-white hover:text-white/80' : 'text-foreground hover:underline'}`}>
              Carta Canta
            </a>
          </span>
          {doc.doc_number && (
            <span className={`text-xs ${isBold ? 'text-white/70' : 'text-muted-foreground'}`}>
              #{doc.doc_number}
            </span>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Status banner (non-sent states) */}
        {statusBanner && (
          <div className={`flex items-center gap-3 rounded-lg border px-4 py-3 ${statusBanner.classes}`}>
            {statusBanner.icon}
            <div>
              <p className="font-medium text-sm">{statusBanner.title}</p>
              <p className="text-xs opacity-80">{statusBanner.subtitle}</p>
            </div>
          </div>
        )}

        {/* Documento principale */}
        <div
          className="bg-white rounded-xl border shadow-sm overflow-hidden"
          style={isTecnico ? { borderLeftWidth: '3px', borderLeftColor: colorPrimary } : undefined}
        >

          {/* ── Intestazione: logo+azienda sinistra, tipo+numero destra ── */}
          <div
            className={isBold ? 'px-6 py-5' : 'px-6 py-5 border-b'}
            style={isBold ? { backgroundColor: colorPrimary } : undefined}
          >
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              {/* Logo + nome workspace */}
              <div className="flex items-center gap-3">
                {workspace.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={workspace.logo_url}
                    alt={`Logo ${workspaceName}`}
                    width={48}
                    height={48}
                    className={`rounded-md object-contain size-12 ${isElegante ? 'border border-gray-300' : ''}`}
                  />
                ) : (
                  <div
                    className="size-12 rounded-md flex items-center justify-center text-xl font-bold"
                    style={isBold
                      ? { backgroundColor: 'rgba(255,255,255,0.2)', color: 'white' }
                      : { backgroundColor: colorPrimary + '20', color: colorPrimary }}
                  >
                    {workspaceName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p
                    className={`font-semibold text-base ${isTecnico ? 'uppercase tracking-wide text-sm' : ''}`}
                    style={isBold ? { color: 'white' } : undefined}
                  >
                    {workspaceName}
                  </p>
                  {workspace.piva && (
                    <p className="text-xs" style={isBold ? { color: 'rgba(255,255,255,0.7)' } : { color: '#666' }}>
                      P.IVA {workspace.piva}
                    </p>
                  )}
                  {(workspace.indirizzo || workspace.citta) && (
                    <p className="text-xs" style={isBold ? { color: 'rgba(255,255,255,0.7)' } : { color: '#666' }}>
                      {[workspace.indirizzo, workspace.citta, workspace.provincia].filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Tipo doc + numero */}
              <div className="text-left sm:text-right text-sm sm:shrink-0">
                <p
                  className={`font-bold tracking-wide ${isElegante ? 'italic' : 'uppercase'}`}
                  style={{ color: isBold ? 'white' : colorPrimary, fontSize: isElegante ? '1.1rem' : '0.95rem' }}
                >
                  {docLabelCap}
                </p>
                {doc.doc_number && (
                  <p
                    className={`mt-1 ${isElegante ? 'italic' : ''}`}
                    style={{ color: isBold ? 'rgba(255,255,255,0.8)' : '#666', fontSize: '0.85rem' }}
                  >
                    #{doc.doc_number}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* ── Info row: destinatario sinistra | date destra ── */}
          <div className={`px-6 py-4 border-b grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm ${isTecnico ? 'bg-gray-50/60' : ''}`}>
            {/* Destinatario */}
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: colorPrimary }}>
                Destinatario
              </p>
              {client ? (
                <>
                  <p className="font-semibold">{client.name}</p>
                  {client.piva && <p className="text-muted-foreground text-xs">P.IVA {client.piva}</p>}
                  {(client.indirizzo || client.citta) && (
                    <p className="text-muted-foreground text-xs">
                      {[client.indirizzo, client.citta, client.provincia].filter(Boolean).join(', ')}
                    </p>
                  )}
                  {client.email && <p className="text-muted-foreground text-xs">{client.email}</p>}
                  {client.phone && <p className="text-muted-foreground text-xs">{client.phone}</p>}
                </>
              ) : (
                <p className="text-muted-foreground italic text-xs">Nessun destinatario</p>
              )}
            </div>
            {/* Date + termini */}
            <div className="sm:text-right">
              <p className="text-[11px] font-semibold uppercase tracking-widest mb-2" style={{ color: colorPrimary }}>
                Data emissione
              </p>
              {doc.sent_at && (
                <p className="font-semibold">
                  {new Date(doc.sent_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              )}
              {doc.expires_at && (
                <p className="text-muted-foreground text-xs mt-1">
                  Valido fino al{' '}
                  {new Date(doc.expires_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              )}
              {doc.payment_terms && (
                <p className="text-muted-foreground text-xs mt-1">Pagamento: {doc.payment_terms}</p>
              )}
            </div>
          </div>

          {/* ── Titolo + note ── */}
          {(doc.title || doc.notes) && (
            <div className="px-6 py-4 border-b">
              {doc.title && <p className="font-bold text-base">{doc.title}</p>}
              {doc.notes && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{doc.notes}</p>}
            </div>
          )}

          {/* ── Tabella voci ── */}
          <div className="overflow-x-auto -mx-px">
            <table className="w-full text-sm min-w-[400px]">
              <thead>
                <tr
                  className="border-b text-xs uppercase tracking-wide"
                  style={isElegante
                    ? { borderBottomWidth: '1px', borderBottomColor: '#999' }
                    : isBold
                      ? { backgroundColor: colorPrimary + '18', color: colorPrimary }
                      : { backgroundColor: colorPrimary, color: 'white' }}
                >
                  <th className="text-left px-3 sm:px-6 py-3 font-semibold">Descrizione</th>
                  <th className="text-center px-2 py-3 font-semibold hidden sm:table-cell">UM</th>
                  <th className="text-right px-2 sm:px-4 py-3 font-semibold">Qtà</th>
                  <th className="text-right px-2 sm:px-4 py-3 font-semibold">Prezzo</th>
                  {showIva && <th className="text-right px-2 sm:px-4 py-3 font-semibold">IVA</th>}
                  <th className="text-right px-3 sm:px-6 py-3 font-semibold">Totale</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item, i) => (
                  <tr key={i} className={i % 2 === 1 ? 'bg-gray-50/60' : ''}>
                    <td className="px-3 sm:px-6 py-3 sm:py-4">
                      <span className="font-medium">{item.description}</span>
                    </td>
                    <td className="text-center px-2 py-3 sm:py-4 text-muted-foreground hidden sm:table-cell whitespace-nowrap">
                      {item.unit ?? 'pz'}
                    </td>
                    <td className="text-right px-2 sm:px-4 py-3 sm:py-4 tabular-nums whitespace-nowrap">
                      {formatNumber(Number(item.quantity))}
                    </td>
                    <td className="text-right px-2 sm:px-4 py-3 sm:py-4 tabular-nums whitespace-nowrap">
                      {formatCurrency(Number(item.unit_price))}
                    </td>
                    {showIva && (
                      <td className="text-right px-2 sm:px-4 py-3 sm:py-4 text-muted-foreground whitespace-nowrap">
                        {item.vat_rate != null ? `${item.vat_rate}%` : '—'}
                      </td>
                    )}
                    <td className="text-right px-3 sm:px-6 py-3 sm:py-4 font-semibold tabular-nums whitespace-nowrap">
                      {formatCurrency(Number(item.total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Totali ── */}
          <div className="border-t p-6">
            <div className="max-w-[220px] ml-auto space-y-1.5 text-sm">
              <TotalRow label="Subtotale" value={formatCurrency(Number(doc.subtotal))} />

              {hasDiscount && (
                <TotalRow
                  label={Number(doc.discount_pct) > 0 ? `Sconto ${doc.discount_pct}%` : 'Sconto fisso'}
                  value={`− ${formatCurrency(Number(doc.subtotal) - (Number(doc.subtotal) * (1 - (Number(doc.discount_pct ?? 0)) / 100) - Number(doc.discount_fixed ?? 0)))}`}
                  muted
                />
              )}

              {showIva && (
                <TotalRow label="IVA" value={formatCurrency(Number(doc.tax_amount))} />
              )}

              {Number(doc.bollo_amount) > 0 && (
                <TotalRow label="Marca da bollo" value={formatCurrency(Number(doc.bollo_amount))} />
              )}

              <div className="border-t-2 pt-2 mt-2" style={{ borderColor: colorPrimary }}>
                <TotalRow
                  label="TOTALE"
                  value={formatCurrency(Number(doc.total))}
                  bold
                  accentColor={colorPrimary}
                />
              </div>
            </div>
          </div>

          {/* ── Note (solo se non già mostrate sopra) ── */}
          {doc.notes && !doc.title && (
            <div className="border-t px-6 py-4 bg-gray-50/50">
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest mb-1.5 font-semibold">
                Note
              </p>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{doc.notes}</p>
            </div>
          )}

          {/* Stringa legale forfettario */}
          {isForfettario && (
            <div className="border-t px-6 py-3 bg-gray-50/50">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Operazione effettuata ai sensi dell&apos;art. 1, commi 54–89, L. 190/2014
                (Regime Forfettario) – Operazione fuori campo IVA ai sensi del comma 58,
                lettera a), del medesimo articolo
              </p>
            </div>
          )}

          {/* Nota legale da template snapshot */}
          {legalNotice && !isForfettario && (
            <div className="border-t px-6 py-3 bg-gray-50/50">
              <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                {legalNotice}
              </p>
            </div>
          )}

          {/* Termini di pagamento */}
          {doc.payment_terms && (
            <div className="border-t px-6 py-3">
              <span className="text-xs text-muted-foreground">
                Pagamento: <strong className="text-foreground">{doc.payment_terms}</strong>
              </span>
              {doc.validity_days && (
                <span className="text-xs text-muted-foreground ml-4">
                  Validità: <strong className="text-foreground">{doc.validity_days} giorni</strong>
                </span>
              )}
            </div>
          )}
        </div>

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
                documentTitle={doc.title || (doc.doc_number ? `Preventivo #${doc.doc_number}` : `Preventivo di ${workspaceName}`)}
                workspaceName={workspaceName}
                contactEmail={ownerEmail}
                contactPhone={null}
              />
              <div className="flex flex-wrap gap-3 pt-1 border-t">
                <a
                  href={`/api/p/${token}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted transition-colors"
                >
                  <Download className="size-4" />
                  Scarica PDF
                </a>
              </div>
            </div>
          ) : (
            /* Fattura: visualizzazione + download + contatto */
            <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
              <div className="flex items-center gap-2 text-amber-700">
                <Banknote className="size-5 shrink-0" />
                <h2 className="font-semibold text-base">
                  Questa fattura è in attesa di pagamento
                </h2>
              </div>
              {doc.payment_terms && (
                <p className="text-sm text-muted-foreground">
                  Termini di pagamento: <strong className="text-foreground">{doc.payment_terms}</strong>
                </p>
              )}
              <div className="flex flex-wrap gap-3 pt-1">
                <a
                  href={`/api/p/${token}/pdf`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted transition-colors"
                >
                  <Download className="size-4" />
                  Scarica PDF
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

        {/* Tracking vista — client-side, filtra bot/scanner che non eseguono JS.
            Registra anche i click successivi al primo (quando status='viewed'). */}
        {(doc.status === 'sent' || doc.status === 'viewed') && !isOwner && <TrackView token={token} />}

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

// ── Helpers ────────────────────────────────────────────────────────────────

function TotalRow({
  label,
  value,
  bold = false,
  muted = false,
  accentColor,
}: {
  label: string
  value: string
  bold?: boolean
  muted?: boolean
  accentColor?: string
}) {
  return (
    <div className="flex justify-between">
      <span className={muted ? 'text-muted-foreground' : ''}>{label}</span>
      <span
        className={bold ? 'font-bold text-base' : muted ? 'text-muted-foreground' : ''}
        style={bold && accentColor ? { color: accentColor } : undefined}
      >
        {value}
      </span>
    </div>
  )
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatNumber(value: number): string {
  return value % 1 === 0
    ? value.toString()
    : value.toLocaleString('it-IT', { maximumFractionDigits: 3 })
}

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
