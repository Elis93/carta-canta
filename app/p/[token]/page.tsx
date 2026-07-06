import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { ActionBar } from './_components/ActionBar'
import { TrackView } from './_components/TrackView'
import { MobilePublicCard } from './_components/MobilePublicCard'
import { DocumentFrame } from '@/components/public/DocumentFrame'
import { PaymentInfoCard, hasPaymentChannels, type PaymentChannels } from '@/components/public/PaymentInfoCard'
import { TierPicker, type PublicTier } from '@/components/public/TierPicker'
import { calcolaDocumento } from '@/lib/fiscal/calcoli'
import { buildEpcQrDataUrl } from '@/lib/payments/epc'
import { CheckCircle2, XCircle, AlertTriangle, Eye, MessageCircle, Banknote } from 'lucide-react'
import { formatDocNumber } from '@/lib/utils'

interface Props {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'

// ── Open Graph / anteprima link (WhatsApp, ecc.) ───────────────────────────
// Imposta il logo "firma" nuovo come immagine di anteprima del link condiviso.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  const admin = createAdminClient()
  const { data: doc } = await admin
    .from('documents')
    .select('doc_type, doc_number, workspace_id')
    .eq('public_token', token)
    .is('deleted_at', null)
    .maybeSingle()

  let wsName = 'Carta Canta'
  if (doc?.workspace_id) {
    const { data: ws } = await admin
      .from('workspaces')
      .select('ragione_sociale, name')
      .eq('id', doc.workspace_id)
      .maybeSingle()
    wsName = ws?.ragione_sociale || ws?.name || 'Carta Canta'
  }

  const isPrev = doc?.doc_type !== 'fattura'
  const label = isPrev ? 'Preventivo' : 'Fattura'
  const num = doc?.doc_number ? formatDocNumber(doc.doc_number) : ''
  const title = `${label}${num ? ` ${num}` : ''} · ${wsName}`
  const description = `Apri per visualizzare ${isPrev ? 'il preventivo' : 'la fattura'} di ${wsName}.`

  // L'immagine di anteprima (og:image / twitter:image) è generata da
  // app/p/[token]/opengraph-image.tsx (card 1200×630 col logo firma).
  return {
    title,
    description,
    openGraph: { title, description, type: 'website', siteName: 'Carta Canta' },
    twitter: { card: 'summary_large_image', title, description },
  }
}

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
        phone,
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

  const workspace = doc.workspaces as {
    owner_id: string
    ragione_sociale: string | null
    name: string
    logo_url: string | null
    piva: string | null
    phone: string | null
    indirizzo: string | null
    cap: string | null
    citta: string | null
    provincia: string | null
    fiscal_regime: string
  }

  // isOwner, ownerEmail, canali di pagamento e acconto in parallelo (tutti indipendenti)
  const [isOwner, ownerEmail, paymentChannels, depositRow, clientPhotos, optionsData] = await Promise.all([
    (async () => {
      try {
        const userSupabase = await createClient()
        const { data: { user } } = await userSupabase.auth.getUser()
        return !!(user && workspace.owner_id === user.id)
      } catch { return false }
    })(),
    (async () => {
      try {
        const { data } = await admin.auth.admin.getUserById(workspace.owner_id)
        return data?.user?.email ?? null
      } catch { return null }
    })(),
    // Canali "Come pagare" (colonne migration 038 — tollerante se mancano)
    (async (): Promise<PaymentChannels | null> => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
        const { data: payWs } = await (admin as any)
          .from('workspaces')
          .select('payment_iban, payment_iban_holder, payment_paypal_url, payment_satispay_url, payment_notes')
          .eq('id', (doc as Record<string, unknown>).workspace_id as string)
          .maybeSingle()
        if (!payWs) return null
        return {
          iban: payWs.payment_iban ?? null,
          ibanHolder: payWs.payment_iban_holder ?? null,
          paypalUrl: payWs.payment_paypal_url ?? null,
          satispayUrl: payWs.payment_satispay_url ?? null,
          notes: payWs.payment_notes ?? null,
        }
      } catch { return null }
    })(),
    // Acconto / stato pagamento del documento (colonne 038 — tollerante)
    (async (): Promise<{ deposit_type: string | null; deposit_value: number | null; payment_status: string | null; paid_amount: number | null } | null> => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
        const { data } = await (admin as any)
          .from('documents')
          .select('deposit_type, deposit_value, payment_status, paid_amount')
          .eq('public_token', token)
          .maybeSingle()
        return data ?? null
      } catch { return null }
    })(),
    // Foto lavoro VISIBILI al cliente (tabella 041 — tollerante). Il cliente
    // vede SOLO le foto selezionate con l'occhio dall'artigiano (default: nessuna).
    (async (): Promise<Array<{ id: string; storage_path: string; label: string | null }>> => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 041 non ancora in types/database.ts
        const { data } = await (admin as any)
          .from('work_photos')
          .select('id, storage_path, label')
          .eq('document_id', (doc as Record<string, unknown>).id as string)
          .eq('visible_to_client', true)
          .order('created_at', { ascending: true })
        return data ?? []
      } catch { return [] }
    })(),
    // Opzioni a livelli (041 — tollerante): proposte da mostrare al cliente
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 041 non ancora in types/database.ts
    (async (): Promise<{ recommended: string | null; items: any[] } | null> => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 041 non ancora in types/database.ts
        const db = admin as any
        const { data: opt } = await db
          .from('documents')
          .select('options_enabled, recommended_tier, accepted_tier')
          .eq('public_token', token)
          .maybeSingle()
        if (!opt?.options_enabled || opt.accepted_tier) return null
        const { data: items } = await db
          .from('document_items')
          .select('description, unit, quantity, unit_price, discount_pct, vat_rate, bonus_tipo, option_tier, sort_order')
          .eq('document_id', (doc as Record<string, unknown>).id as string)
          .order('sort_order', { ascending: true })
        return { recommended: opt.recommended_tier ?? null, items: items ?? [] }
      } catch { return null }
    })(),
  ])

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

  // L'HTML del documento viene servito direttamente dalla route API
  // /api/p/[token]/pdf?preview=1 che usa buildPdfHtml() con Google Fonts.
  // Usare src= invece di srcDoc= nell'iframe risolve il problema dei font:
  // i browser bloccano le risorse esterne (Google Fonts) dagli iframe con
  // origine null (srcDoc), ma le caricano normalmente da una URL reale.

  // ── Stato del documento ────────────────────────────────────────────────
  const statusBanner = getStatusBanner(doc.status, workspaceName, isPreventivo)

  // ── Acconto (Acconti — riga ambra sotto il totale) ─────────────────────
  const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100
  const totalNum = Number(doc.total ?? 0)
  const deposit = (() => {
    if (!depositRow || totalNum <= 0) return null
    if (!isPreventivo) {
      // Fattura con acconto già incassato → mostra "Acconto già ricevuto / Saldo"
      if (depositRow.payment_status === 'partial' && Number(depositRow.paid_amount) > 0) {
        const acconto = round2(Number(depositRow.paid_amount))
        return { kind: 'received' as const, label: 'Acconto già ricevuto', acconto, saldo: round2(totalNum - acconto) }
      }
      return null
    }
    const t = depositRow.deposit_type
    const v = Number(depositRow.deposit_value)
    if ((t !== 'percent' && t !== 'amount') || !Number.isFinite(v) || v <= 0) return null
    const acconto = t === 'percent' ? round2((totalNum * Math.min(v, 100)) / 100) : round2(Math.min(v, totalNum))
    if (acconto <= 0) return null
    const label = t === 'percent'
      ? `Acconto alla conferma (${v.toLocaleString('it-IT', { maximumFractionDigits: 2 })}%)`
      : 'Acconto alla conferma'
    return { kind: 'requested' as const, label, acconto, saldo: round2(totalNum - acconto) }
  })()

  // ── Opzioni a livelli: card Base/Consigliata/Premium (mockup §3.2) ─────
  const TIER_LABELS: Record<string, string> = { base: 'Base', consigliata: 'Consigliata', premium: 'Premium' }
  const optionTiers: PublicTier[] | null = (() => {
    if (!optionsData || (doc.status !== 'sent' && doc.status !== 'viewed') || !isPreventivo) return null
    const tiers = (['base', 'consigliata', 'premium'] as const)
      .map((tier) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- voci lette con select dinamico (041)
        const tierItems = optionsData.items.filter((i: any) => (i.option_tier ?? 'base') === tier)
        if (tierItems.length === 0) return null
        const fiscal = calcolaDocumento(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- shape minima richiesta dal motore
          tierItems.map((i: any, idx: number) => ({
            id: String(idx), document_id: '', sort_order: idx,
            description: String(i.description ?? ''), unit: i.unit ?? 'pz',
            quantity: Number(i.quantity ?? 1), unit_price: Number(i.unit_price ?? 0),
            discount_pct: i.discount_pct ?? null, vat_rate: i.vat_rate ?? null,
            bonus_tipo: i.bonus_tipo ?? null, total: 0, ai_generated: false, ai_confidence: null,
          })) as any,
          {
            fiscal_regime: workspace.fiscal_regime as 'forfettario' | 'ordinario' | 'minimi',
            currency: 'EUR',
            discount_pct: doc.discount_pct ?? undefined,
            discount_fixed: doc.discount_fixed ?? undefined,
            vat_rate_default: doc.vat_rate_default ?? undefined,
          }
        )
        return {
          tier,
          label: TIER_LABELS[tier],
          total: fiscal.total,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          items: tierItems.map((i: any) => String(i.description ?? '')),
          recommended: optionsData.recommended === tier,
        }
      })
      .filter(Boolean) as PublicTier[]
    return tiers.length >= 2 ? tiers : null
  })()

  // ── "Il lavoro in foto" (mockup cantiere §2.3) ─────────────────────────
  const photoBase = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/work-photos/`
  const photosCard = clientPhotos.length > 0 ? (
    <div style={{ background: '#fff', borderRadius: 14, padding: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)' }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 10 }}>
        Il lavoro in foto
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 }}>
        {clientPhotos.map((p) => (
          <div key={p.id} style={{ position: 'relative', height: 96, borderRadius: 10, overflow: 'hidden', background: '#f2f2f5' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- storage pubblico */}
            <img src={`${photoBase}${p.storage_path}`} alt={p.label === 'dopo' ? 'Foto a lavoro finito' : 'Foto prima dell’intervento'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
            {p.label && (
              <span style={{ position: 'absolute', top: 5, left: 5, border: '1px solid rgba(255,255,255,.85)', background: 'rgba(22,22,22,.55)', color: '#fff', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 700, letterSpacing: '.05em' }}>
                {p.label.toUpperCase()}
              </span>
            )}
          </div>
        ))}
      </div>
      <p style={{ fontSize: 12, color: '#767676', marginTop: 9 }}>
        Foto del cantiere prima dell&rsquo;intervento e a lavoro finito.
      </p>
    </div>
  ) : null

  // ── Riquadro "Come pagare" (Pagamenti F1) ──────────────────────────────
  // Fatture in attesa di pagamento + preventivi accettati (per l'acconto).
  const showPayment =
    hasPaymentChannels(paymentChannels) &&
    (isPreventivo
      ? doc.status === 'accepted'
      : doc.status === 'sent' || doc.status === 'viewed')
  const causale = `${docLabelCap}${doc.doc_number ? ` ${formatDocNumber(doc.doc_number)}` : ''}`
  // Importo QR: acconto per il preventivo accettato, saldo residuo per la
  // fattura con acconto già ricevuto, altrimenti il totale.
  const epcAmount = isPreventivo
    ? deposit?.acconto ?? doc.total
    : deposit?.kind === 'received'
      ? deposit.saldo
      : doc.total
  const epcQr =
    showPayment && paymentChannels?.iban
      ? await buildEpcQrDataUrl({
          iban: paymentChannels.iban,
          beneficiary: paymentChannels.ibanHolder || workspaceName,
          amount: epcAmount,
          remittance: isPreventivo && deposit ? `Acconto ${causale}` : causale,
        })
      : null

  // Mappa le voci per il componente mobile (solo i campi necessari).
  // Con le opzioni in attesa di scelta le voci stanno DENTRO le card
  // proposta (TierPicker) — la lista unica mescolerebbe tutte le proposte.
  const mobileItems = optionTiers
    ? []
    : (doc.document_items ?? []).map((i) => ({
        description: i.description,
        total: i.total,
      }))

  return (
    <div>

      {/* ── LAYOUT MOBILE (< lg) ──────────────────────────────────────────── */}
      <div className="lg:hidden min-h-screen" style={{ background: '#eceae4' }}>
        <MobilePublicCard
          token={token}
          workspaceName={workspaceName}
          workspacePiva={workspace.piva}
          isPreventivo={isPreventivo}
          docLabel={docLabelCap}
          docNumber={doc.doc_number}
          sentAt={doc.sent_at}
          subtotal={doc.subtotal}
          taxAmount={doc.tax_amount}
          vatRateDefault={doc.vat_rate_default}
          total={doc.total}
          status={doc.status}
          clientName={client?.name ?? null}
          items={mobileItems}
          ownerEmail={ownerEmail}
          pdfSrc={`/api/p/${token}/pdf?preview=1`}
          paymentTerms={doc.payment_terms}
          expiresAt={doc.expires_at}
          notes={doc.notes}
          discountPct={doc.discount_pct}
          discountFixed={doc.discount_fixed}
          bolloAmount={doc.bollo_amount}
          deposit={deposit}
          tierPicker={optionTiers ? <TierPicker tiers={optionTiers} /> : undefined}
        />
        {photosCard && <div style={{ padding: '0 12px 12px' }}>{photosCard}</div>}
        {showPayment && paymentChannels && (
          <div style={{ padding: '0 12px 24px' }}>
            <PaymentInfoCard channels={paymentChannels} causale={causale} qrDataUrl={epcQr} />
          </div>
        )}
      </div>

      {/* ── LAYOUT DESKTOP (≥ lg) ─────────────────────────────────────────── */}
      <div className="hidden lg:block min-h-screen bg-gray-50">

        {/* Header brand — semplice, neutro. Il documento è dentro l'iframe. */}
        <header className="bg-white border-b px-4 py-3">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <span className="text-sm text-muted-foreground">
              {docLabelCap} inviat{isPreventivo ? 'o' : 'a'} tramite{' '}
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

          {/* ── Opzioni a livelli: il cliente confronta le proposte ── */}
          {optionTiers && (
            <div className="bg-white rounded-xl border shadow-sm p-6">
              <TierPicker tiers={optionTiers} />
            </div>
          )}

          {/* ── Documento — iframe punta alla route API (stesso HTML del PDF) ──
              Con le opzioni in attesa di scelta il documento completo (che
              elenca le voci di TUTTE le proposte) non viene mostrato. */}
          {!optionTiers && (
            <DocumentFrame
              src={`/api/p/${token}/pdf?preview=1`}
              title={`${docLabelCap} di ${workspaceName}`}
            />
          )}

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
                  contactPhone={workspace.phone}
                />
                <div className="flex flex-wrap gap-3 pt-1 border-t">
                  <a
                    href={`/api/p/${token}/pdf?preview=1`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-muted transition-colors"
                  >
                    <Eye className="size-4" />
                    Vedi documento completo
                  </a>
                </div>
              </div>
            ) : (
              /* Fattura: visualizzazione + contatto */
              <div className="bg-white rounded-xl border shadow-sm p-6 space-y-4">
                <div className="flex items-center gap-2 text-[#b0863e]">
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
                    Vedi documento completo
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
            <div className="bg-white rounded-xl border border-[#bce3d2] shadow-sm p-5">
              <div className="flex items-center gap-2 text-[#2f8a63]">
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

          {/* Il lavoro in foto — solo le foto scelte dall'artigiano */}
          {photosCard}

          {/* Come pagare — fatture da pagare + preventivi accettati */}
          {showPayment && paymentChannels && (
            <PaymentInfoCard channels={paymentChannels} causale={causale} qrDataUrl={epcQr} />
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

      {/* Tracking vista — client-side, fuori da entrambi i layout */}
      {(doc.status === 'sent' || doc.status === 'viewed') && !isOwner && (
        <TrackView token={token} />
      )}

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
            icon: <CheckCircle2 className="size-5 shrink-0 text-[#2f8a63]" />,
            classes: 'bg-[#d4efe2] border-[#bce3d2] text-[#2f8a63]',
          }
        : {
            title: 'Fattura pagata',
            subtitle: `Questa fattura è stata contrassegnata come pagata da ${workspaceName}.`,
            icon: <CheckCircle2 className="size-5 shrink-0 text-[#2f8a63]" />,
            classes: 'bg-[#d4efe2] border-[#bce3d2] text-[#2f8a63]',
          }
    case 'rejected':
      return isPreventivo
        ? {
            title: 'Preventivo rifiutato',
            subtitle: `Hai rifiutato questo preventivo. Contatta ${workspaceName} per ulteriori informazioni.`,
            icon: <XCircle className="size-5 shrink-0 text-[#b05656]" />,
            classes: 'bg-[#f5dede] border-[#ecc9c9] text-[#b05656]',
          }
        : {
            title: 'Fattura annullata',
            subtitle: `Questa fattura è stata annullata. Contatta ${workspaceName} per ulteriori informazioni.`,
            icon: <XCircle className="size-5 shrink-0 text-[#b05656]" />,
            classes: 'bg-[#f5dede] border-[#ecc9c9] text-[#b05656]',
          }
    case 'expired':
      return isPreventivo
        ? {
            title: 'Preventivo scaduto',
            subtitle: `Questo preventivo non è più valido. Contatta ${workspaceName} per un nuovo preventivo.`,
            icon: <AlertTriangle className="size-5 shrink-0 text-[#b0863e]" />,
            classes: 'bg-[#f5e9d0] border-[#e8d6ad] text-[#b0863e]',
          }
        : {
            title: 'Fattura scaduta',
            subtitle: `Questa fattura ha superato la data di scadenza. Contatta ${workspaceName} per ulteriori informazioni.`,
            icon: <AlertTriangle className="size-5 shrink-0 text-[#b0863e]" />,
            classes: 'bg-[#f5e9d0] border-[#e8d6ad] text-[#b0863e]',
          }
    default:
      return null
  }
}
