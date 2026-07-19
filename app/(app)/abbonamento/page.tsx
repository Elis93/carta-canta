import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Crown, CreditCard, Check, CheckCircle2, ChevronLeft, BadgePercent, Settings } from 'lucide-react'
import { PricingSection } from './_components/PricingSection'
import { SuccessBanner } from './_components/SuccessBanner'
import { SwitchBillingButton } from './_components/SwitchBillingButton'
import { MobileProCard } from './_components/MobileProCard'
import { PLAN_FEATURES, AI_IMPORT_ENABLED, type PlanType } from '@/lib/stripe/plans'
import { createPortalSessionAction } from '@/lib/actions/subscription'
import { FREE_DOC_LIMIT, FREE_TRIAL_DAYS, checkFreeBlock } from '@/lib/free-trial'
import { BackButton } from '@/components/shared/BackButton'

const PLAN_DISPLAY: Record<PlanType, { label: string; color: string }> = {
  free:     { label: 'Free',     color: 'bg-gray-100 text-gray-700' },
  pro:      { label: 'Pro',      color: 'bg-[#d8e8fb] text-[#3f6fb0]' },
  team:     { label: 'Team',     color: 'bg-[#e9e0f7] text-[#7c3aed]' },
  lifetime: { label: 'Lifetime', color: 'bg-[#f5e9d0] text-[#b0863e]' },
}

export default async function AbbonamentoPage() {
  const { user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/login')

  const currentPlan = workspace.plan as PlanType
  const planDisplay = PLAN_DISPLAY[currentPlan]
  const features = PLAN_FEATURES[currentPlan]
  const hasStripeCustomer = !!workspace.stripe_customer_id

  // Preventivi inviati (per mostrare usage nel piano Free)
  // Fonte di verità: sent_quota_used — contatore storico, mai decrementato.
  // Coerente con checkFreeBlock() e con la logica mostrata in /preventivi/nuovo.
  let docsUsed: number | null = null
  let daysRemaining: number | null = null
  let freeStatus: ReturnType<typeof checkFreeBlock> | null = null
  if (currentPlan === 'free') {
    freeStatus = checkFreeBlock({
      id: workspace.id,
      plan: currentPlan,
      free_trial_expires_at: workspace.free_trial_expires_at,
      sent_quota_used: workspace.sent_quota_used ?? 0,
    })
    docsUsed = freeStatus.docsUsed
    daysRemaining = freeStatus.daysRemaining
  }

  const proMonthlyPrice = process.env.STRIPE_PRICE_PRO_MONTHLY ?? ''
  const proYearlyPrice = process.env.STRIPE_PRICE_PRO_YEARLY ?? ''

  return (
    <div className="max-w-4xl mx-auto">

      {/* ── MOBILE LAYOUT ── */}
      <div className="lg:hidden pb-8">
        {/* Header mobile */}
        <div
          className="flex items-center gap-2.5"
          style={{ background: '#fff', borderBottom: '2px solid #c9a44c', padding: '12px 15px' }}
        >
          <BackButton fallback="/altro" />
          <span style={{ flex: 1, minWidth: 0, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Abbonamento</span>
          <span style={{ width: 24, flexShrink: 0 }} />
        </div>

        {/* Banner successo */}
        <div className="px-4 pt-3">
          <Suspense fallback={null}>
            <SuccessBanner />
          </Suspense>
        </div>

        {/* Card "Il tuo piano" (Free) */}
        {currentPlan === 'free' && docsUsed !== null && freeStatus && (
          <div
            style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '15px 15px' }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 12 }}>
              Il tuo piano
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: '#161616' }}>Piano Free</span>
              {freeStatus.blocked && (
                <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 600, color: '#a32d2d', background: '#f7dede', borderRadius: 999, padding: '2px 9px' }}>
                  Scaduto
                </span>
              )}
            </div>

            {/* Uso preventivi — rosso se raggiunto il limite documenti (non per il tempo) */}
            <div style={{ fontSize: 13, marginTop: 8, color: docsUsed >= FREE_DOC_LIMIT ? '#a32d2d' : 'var(--cc-muted)', fontWeight: docsUsed >= FREE_DOC_LIMIT ? 600 : 400 }}>
              {docsUsed} di {FREE_DOC_LIMIT} preventivi gratuiti usati
              {docsUsed >= FREE_DOC_LIMIT ? ' — limite raggiunto' : ''}
            </div>
            <div style={{ marginTop: 8, height: 8, borderRadius: 999, background: '#ececef', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  borderRadius: 999,
                  width: `${Math.min(100, (docsUsed / FREE_DOC_LIMIT) * 100)}%`,
                  background: docsUsed >= FREE_DOC_LIMIT ? '#a32d2d' : '#1a1a2e',
                }}
              />
            </div>

            {/* Periodo di prova (giorni) */}
            {daysRemaining !== null && (
              <div style={{ fontSize: 13, color: daysRemaining <= 0 ? '#a32d2d' : 'var(--cc-muted)', marginTop: 10, fontWeight: daysRemaining <= 0 ? 600 : 400 }}>
                {daysRemaining > 0
                  ? `Periodo di prova: ${daysRemaining} ${daysRemaining === 1 ? 'giorno' : 'giorni'} rimanenti`
                  : `Periodo di prova di ${FREE_TRIAL_DAYS} giorni terminato`}
              </div>
            )}

            {/* CTA blocco (i motivi sono citati sopra, in rosso) */}
            {freeStatus.blocked && (
              <p style={{ fontSize: 13, color: '#a32d2d', fontWeight: 600, marginTop: 10, lineHeight: 1.4 }}>
                Passa a Pro per continuare.
              </p>
            )}
          </div>
        )}

        {/* Card "Passa a Pro" (Free) — con scelta Mensile/Annuale: il bottone
            addebita esattamente il prezzo mostrato (fix bug prezzo 5 lug) */}
        {currentPlan === 'free' && (
          <MobileProCard monthlyPriceId={proMonthlyPrice} yearlyPriceId={proYearlyPrice} />
        )}

        {/* Già su Pro/Lifetime — mostra stato */}
        {currentPlan !== 'free' && (
          <>
            {/* Card "Il tuo piano" (Pro) */}
            <div
              style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '15px 15px' }}
            >
              <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 12 }}>
                Il tuo piano
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                <span style={{ fontSize: 18, fontWeight: 700, color: '#161616' }}>
                  Piano {PLAN_DISPLAY[currentPlan].label}
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 600, color: '#2f8a63', background: '#d4efe2', borderRadius: 999, padding: '2px 9px' }}>
                  Attivo
                </span>
              </div>

              {/* Fatturazione mensile / annuale */}
              {currentPlan !== 'lifetime' && workspace.billing_interval && (
                <div style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 3 }}>
                  Fatturazione {workspace.billing_interval === 'year' ? 'annuale' : 'mensile'}
                </div>
              )}

              {/* Data rinnovo / scadenza */}
              {workspace.subscription_ends_at && (
                <div style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 3, marginBottom: 11 }}>
                  {workspace.stripe_subscription_id
                    ? `Rinnovo il ${new Date(workspace.subscription_ends_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' , timeZone: 'Europe/Rome' })}`
                    : `Attivo fino al ${new Date(workspace.subscription_ends_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' , timeZone: 'Europe/Rome' })}`
                  }
                </div>
              )}

              <div style={{ height: '0.5px', background: '#eee', margin: '13px -15px' }} />

              {/* Feature incluse */}
              {[
                'Preventivi e fatture illimitati',
                'Template illimitati e personalizzabili',
                'Nessuna filigrana sul PDF',
                'AI Import (foto → preventivo)',
              ].map((f) => (
                <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '5px 0', fontSize: 14, color: '#161616' }}>
                  <CheckCircle2 size={17} style={{ color: '#2f8a63', flex: '0 0 auto' }} />
                  {f}
                </div>
              ))}
            </div>

            {/* Card oro "Passa alla fatturazione annuale" (solo mensile) */}
            {workspace.stripe_subscription_id && workspace.billing_interval === 'month' && (
              <div
                style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '15px 15px', border: '1px solid #ecd9ad' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                  <BadgePercent size={19} style={{ color: '#b08d3e' }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: '#161616' }}>Passa alla fatturazione annuale</span>
                </div>
                <div style={{ fontSize: 13, color: '#55534b', lineHeight: 1.45 }}>
                  Risparmia 2 mesi: <b>€&nbsp;182/anno</b>{' '}invece di €&nbsp;228 (€&nbsp;19×12).
                </div>
                <SwitchBillingButton billingInterval={workspace.billing_interval} variant="mobile" />
              </div>
            )}

            {/* Gestisci abbonamento — portale Stripe */}
            {hasStripeCustomer && (
              <div style={{ padding: '0 15px', marginTop: 14 }}>
                <form action={createPortalSessionAction}>
                  <button
                    type="submit"
                    style={{ width: '100%', border: '1px solid #e7e7ea', color: '#1a1a2e', borderRadius: 12, height: 48, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 500, background: '#fff', cursor: 'pointer' }}
                  >
                    <Settings size={18} />
                    Gestisci abbonamento
                  </button>
                </form>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── DESKTOP LAYOUT (invariato) ── */}
      <div className="hidden lg:block p-4 md:p-6 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Crown className="size-6 text-amber-500" />
          Abbonamento
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestisci il tuo piano e le opzioni di fatturazione.
        </p>
      </div>

      {/* Banner successo/cancellazione (client) */}
      <Suspense fallback={null}>
        <SuccessBanner />
      </Suspense>

      {/* Stato piano attuale */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <CreditCard className="size-5 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">Piano attuale</p>
              {workspace.subscription_ends_at && currentPlan !== 'free' && (
                <p className="text-xs text-muted-foreground">
                  {workspace.stripe_subscription_id
                    ? `Rinnovo il ${new Date(workspace.subscription_ends_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' , timeZone: 'Europe/Rome' })}`
                    : `Attivo fino al ${new Date(workspace.subscription_ends_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' , timeZone: 'Europe/Rome' })}`
                  }
                </p>
              )}
            </div>
          </div>
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${planDisplay.color}`}>
            {currentPlan === 'lifetime' && '♾️ '}
            Piano {planDisplay.label}
          </span>
        </div>

        {/* Cambio fatturazione mensile ⇄ annuale (solo abbonamenti ricorrenti) */}
        {currentPlan !== 'free' && workspace.stripe_subscription_id && (
          <div className="flex items-center justify-between gap-3 flex-wrap border-t pt-4">
            <p className="text-sm text-muted-foreground">
              Fatturazione attuale:{' '}
              <span className="font-medium text-foreground">
                {workspace.billing_interval === 'year' ? 'Annuale' : workspace.billing_interval === 'month' ? 'Mensile' : '—'}
              </span>
            </p>
            <SwitchBillingButton billingInterval={workspace.billing_interval} />
          </div>
        )}

        {/* Usage bar piano Free */}
        {currentPlan === 'free' && docsUsed !== null && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Preventivi inviati</span>
              <span className="font-medium text-foreground">{docsUsed} / {FREE_DOC_LIMIT}</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  docsUsed >= FREE_DOC_LIMIT ? 'bg-[#b05656]' : docsUsed >= Math.floor(FREE_DOC_LIMIT * 0.75) ? 'bg-[#b0863e]' : 'bg-primary'
                }`}
                style={{ width: `${Math.min(100, (docsUsed / FREE_DOC_LIMIT) * 100)}%` }}
              />
            </div>
            {daysRemaining !== null && (
              <p className="text-xs text-muted-foreground">
                {daysRemaining > 0
                  ? <>Periodo di prova: <strong className="text-foreground">{daysRemaining} {daysRemaining === 1 ? 'giorno' : 'giorni'}</strong> rimanenti</>
                  : <span className="text-[#b05656] font-medium">Periodo di prova scaduto</span>
                }
              </p>
            )}
            {docsUsed >= FREE_DOC_LIMIT && (
              <p className="text-xs text-[#b05656] font-medium">
                Limite di {FREE_DOC_LIMIT} preventivi raggiunto. Effettua l&apos;upgrade per continuare.
              </p>
            )}
            {/* Spiegazione conteggio */}
            <details className="mt-2">
              <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground select-none">
                Come vengono conteggiati i preventivi?
              </summary>
              <div className="mt-2 space-y-1.5 text-xs text-muted-foreground rounded-lg border bg-muted/30 px-3 py-2.5">
                <p>Quando viene conteggiato: un preventivo viene scalato dal limite nel momento in cui viene inviato al cliente per la prima volta (via email o link). Il semplice salvataggio come bozza non consuma quota.</p>
                <p>Cancellazione: eliminare un preventivo non recupera il contatore. Il conteggio è permanente e riflette tutti i preventivi inviati, anche quelli cancellati in seguito.</p>
                <p>Cestino e ripristino: spostare un preventivo nel cestino o ripristinarlo non modifica il contatore.</p>
                <p>Reinvio: reinviare un preventivo già inviato (con lo stesso status) non incrementa il contatore.</p>
                <p>Fatture: le fatture non consumano quota preventivi — il limite riguarda solo i preventivi.</p>
              </div>
            </details>
          </div>
        )}

        {/* Feature del piano corrente */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
          <FeaturePill
            label="Preventivi"
            value={features.maxDocuments === Infinity ? 'Illimitati' : `Max ${features.maxDocuments}`}
            active
          />
          <FeaturePill
            label="Template"
            value={features.maxTemplates === Infinity ? 'Illimitati' : `Max ${features.maxTemplates}`}
            active
          />
          <FeaturePill
            label="AI Import"
            value={
              !features.aiImport ? 'Non incluso'
              : AI_IMPORT_ENABLED ? 'Incluso'
              : 'In arrivo'
            }
            active={features.aiImport && AI_IMPORT_ENABLED}
          />
          <FeaturePill
            label="Watermark"
            value={features.watermark ? 'Presente' : 'Rimovibile'}
            active={!features.watermark}
          />
          <FeaturePill
            label="Marketplace"
            value={currentPlan === 'free' ? 'Profilo base' : 'In evidenza'}
            active={currentPlan !== 'free'}
          />
        </div>
      </div>

      <Separator />

      {/* Intestazione sezione piani */}
      <div className="text-center space-y-2">
        <h2 className="text-xl font-semibold">
          {currentPlan === 'free' ? 'Scegli il piano giusto per te' : 'Cambia piano'}
        </h2>
        <p className="text-sm text-muted-foreground">
          Nessun contratto. Cancella quando vuoi.
        </p>
      </div>

      {/* Sezione prezzi (client — gestisce toggle mensile/annuale) */}
      {/* FIX-28: lifetime rimosso dai priceIds — piano non più venduto */}
      <PricingSection
        currentPlan={currentPlan}
        hasStripeCustomer={hasStripeCustomer}
        priceIds={{
          proMonthly:  process.env.STRIPE_PRICE_PRO_MONTHLY,
          proYearly:   process.env.STRIPE_PRICE_PRO_YEARLY,
          teamMonthly: process.env.STRIPE_PRICE_TEAM_MONTHLY,
          teamYearly:  process.env.STRIPE_PRICE_TEAM_YEARLY,
        }}
      />

      </div>{/* fine desktop */}
    </div>
  )
}

function FeaturePill({
  label, value, active
}: { label: string; value: string; active: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 text-center ${active ? 'bg-primary/5 border border-primary/10' : 'bg-gray-50 border border-gray-200'}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xs font-semibold mt-0.5 ${active ? 'text-primary' : 'text-muted-foreground'}`}>{value}</p>
    </div>
  )
}
