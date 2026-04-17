import { notFound } from 'next/navigation'
import Image from 'next/image'
import { createAdminClient } from '@/lib/supabase/admin'
import { ActionBar } from './_components/ActionBar'
import { CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react'

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
      title,
      doc_number,
      status,
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

  // Segna come "visto" al primo accesso (da sent → viewed)
  if (doc.status === 'sent') {
    admin
      .from('documents')
      .update({ status: 'viewed' })
      .eq('id', doc.id)
      .eq('status', 'sent')
      .then(() => {})
      .catch(() => {})
  }

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

  // ── Stato del preventivo ───────────────────────────────────────────────
  const statusBanner = getStatusBanner(doc.status, workspaceName)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header brand */}
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <span className="text-sm text-muted-foreground">
            Preventivo inviato tramite{' '}
            <a href="https://cartacanta.it" className="font-medium text-foreground hover:underline">
              Carta Canta
            </a>
          </span>
          {doc.doc_number && (
            <span className="text-xs text-muted-foreground">
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
        <div className="bg-white rounded-xl border shadow-sm overflow-hidden">

          {/* Intestazione documento */}
          <div className="p-6 border-b">
            <div className="flex items-start justify-between gap-4">
              {/* Logo + nome workspace */}
              <div className="flex items-center gap-3">
                {workspace.logo_url ? (
                  <Image
                    src={workspace.logo_url}
                    alt={`Logo ${workspaceName}`}
                    width={48}
                    height={48}
                    className="rounded-md object-contain"
                  />
                ) : (
                  <div className="size-12 rounded-md bg-gray-100 flex items-center justify-center text-xl font-bold text-gray-400">
                    {workspaceName.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-base">{workspaceName}</p>
                  {workspace.piva && (
                    <p className="text-xs text-muted-foreground">P.IVA {workspace.piva}</p>
                  )}
                  {(workspace.indirizzo || workspace.citta) && (
                    <p className="text-xs text-muted-foreground">
                      {[workspace.indirizzo, workspace.citta, workspace.provincia]
                        .filter(Boolean).join(', ')}
                    </p>
                  )}
                </div>
              </div>

              {/* Info preventivo */}
              <div className="text-right text-sm shrink-0">
                <p className="font-bold text-lg text-foreground">Preventivo</p>
                {doc.doc_number && (
                  <p className="text-muted-foreground">#{doc.doc_number}</p>
                )}
                {doc.sent_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(doc.sent_at).toLocaleDateString('it-IT', {
                      day: '2-digit', month: 'long', year: 'numeric'
                    })}
                  </p>
                )}
                {doc.expires_at && (
                  <p className="text-xs text-muted-foreground">
                    Valido fino al{' '}
                    {new Date(doc.expires_at).toLocaleDateString('it-IT', {
                      day: '2-digit', month: 'long', year: 'numeric'
                    })}
                  </p>
                )}
              </div>
            </div>

            {/* Titolo preventivo */}
            <h1 className="text-xl font-bold mt-5">{doc.title}</h1>

            {/* Dati cliente */}
            {client && (
              <div className="mt-4 text-sm">
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1 font-medium">
                  Destinatario
                </p>
                <p className="font-medium">{client.name}</p>
                {client.piva && <p className="text-muted-foreground">P.IVA {client.piva}</p>}
                {(client.indirizzo || client.citta) && (
                  <p className="text-muted-foreground">
                    {[client.indirizzo, client.citta, client.provincia].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Tabella voci */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="text-left px-6 py-3 font-medium">Descrizione</th>
                  <th className="text-right px-4 py-3 font-medium">Qtà</th>
                  <th className="text-right px-4 py-3 font-medium">Prezzo</th>
                  {showIva && <th className="text-right px-4 py-3 font-medium">IVA</th>}
                  <th className="text-right px-6 py-3 font-medium">Totale</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((item, i) => (
                  <tr key={i} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <span className="font-medium">{item.description}</span>
                      {item.unit && item.unit !== 'pz' && (
                        <span className="text-muted-foreground ml-1 text-xs">/ {item.unit}</span>
                      )}
                    </td>
                    <td className="text-right px-4 py-4 tabular-nums">
                      {formatNumber(Number(item.quantity))} {item.unit ?? ''}
                    </td>
                    <td className="text-right px-4 py-4 tabular-nums">
                      {formatCurrency(Number(item.unit_price))}
                    </td>
                    {showIva && (
                      <td className="text-right px-4 py-4 text-muted-foreground">
                        {item.vat_rate != null ? `${item.vat_rate}%` : '—'}
                      </td>
                    )}
                    <td className="text-right px-6 py-4 font-medium tabular-nums">
                      {formatCurrency(Number(item.total))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totali */}
          <div className="border-t p-6">
            <div className="max-w-xs ml-auto space-y-2 text-sm">
              <TotalRow label="Subtotale" value={formatCurrency(Number(doc.subtotal))} />

              {hasDiscount && (
                <TotalRow
                  label={
                    Number(doc.discount_pct) > 0
                      ? `Sconto ${doc.discount_pct}%`
                      : `Sconto fisso`
                  }
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

              <div className="border-t pt-2">
                <TotalRow
                  label="Totale"
                  value={formatCurrency(Number(doc.total))}
                  bold
                />
              </div>
            </div>
          </div>

          {/* Note */}
          {doc.notes && (
            <div className="border-t px-6 py-4 bg-gray-50/50">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1.5 font-medium">
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

        {/* CTA accettazione — se sent o viewed */}
        {(doc.status === 'sent' || doc.status === 'viewed') && (
          <div className="bg-white rounded-xl border shadow-sm p-6 space-y-3">
            <h2 className="font-semibold text-base">
              Cosa vuoi fare con questo preventivo?
            </h2>
            <ActionBar
              token={token}
              documentTitle={doc.title}
              workspaceName={workspaceName}
              contactEmail={ownerEmail}
              contactPhone={null}
            />
          </div>
        )}

        {/* Accettato: info firma */}
        {doc.status === 'accepted' && doc.accepted_at && (
          <div className="bg-white rounded-xl border border-green-200 shadow-sm p-5">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle2 className="size-5" />
              <p className="font-medium text-sm">
                Preventivo accettato il{' '}
                {new Date(doc.accepted_at).toLocaleDateString('it-IT', {
                  day: '2-digit', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                } as Intl.DateTimeFormatOptions)}
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-muted-foreground pb-6">
          Preventivo gestito con{' '}
          <a href="https://cartacanta.it" className="underline hover:text-foreground">
            Carta Canta
          </a>
          {' '}· Preventivi professionali per artigiani italiani
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
}: {
  label: string
  value: string
  bold?: boolean
  muted?: boolean
}) {
  return (
    <div className="flex justify-between">
      <span className={muted ? 'text-muted-foreground' : ''}>{label}</span>
      <span className={bold ? 'font-bold text-base' : muted ? 'text-muted-foreground' : ''}>
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

function getStatusBanner(status: string, workspaceName: string) {
  switch (status) {
    case 'accepted':
      return {
        title: 'Preventivo accettato',
        subtitle: `Hai accettato questo preventivo di ${workspaceName}.`,
        icon: <CheckCircle2 className="size-5 shrink-0 text-green-600" />,
        classes: 'bg-green-50 border-green-200 text-green-800',
      }
    case 'rejected':
      return {
        title: 'Preventivo rifiutato',
        subtitle: `Hai rifiutato questo preventivo. Contatta ${workspaceName} per ulteriori informazioni.`,
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
