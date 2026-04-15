'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, Sparkles, Zap, Users, Infinity as InfinityIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { createCheckoutSessionAction, createPortalSessionAction } from '@/lib/actions/subscription'
import { PLAN_PRICING } from '@/lib/stripe/plans'
import type { PlanType } from '@/lib/stripe/plans'

interface PriceIds {
  proMonthly?: string
  proYearly?: string
  teamMonthly?: string
  teamYearly?: string
  lifetime?: string
}

interface PricingSectionProps {
  currentPlan: PlanType
  hasStripeCustomer: boolean
  priceIds: PriceIds
}

export function PricingSection({ currentPlan, hasStripeCustomer, priceIds }: PricingSectionProps) {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [pending, startTransition] = useTransition()
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)

  function handleCheckout(planKey: string, priceId: string | undefined, mode: 'subscription' | 'payment') {
    if (!priceId) return
    setLoadingPlan(planKey)
    startTransition(async () => {
      await createCheckoutSessionAction(priceId, mode)
    })
  }

  function handlePortal() {
    setLoadingPlan('portal')
    startTransition(async () => {
      await createPortalSessionAction()
    })
  }

  const proPriceId  = billing === 'monthly' ? priceIds.proMonthly  : priceIds.proYearly
  const teamPriceId = billing === 'monthly' ? priceIds.teamMonthly : priceIds.teamYearly

  return (
    <div className="space-y-8">
      {/* Toggle mensile/annuale */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-1 rounded-full border bg-muted p-1">
          {(['monthly', 'yearly'] as const).map((b) => (
            <button
              key={b}
              onClick={() => setBilling(b)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
                billing === b
                  ? 'bg-white text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {b === 'monthly' ? 'Mensile' : 'Annuale'}
              {b === 'yearly' && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 bg-green-100 text-green-700 border-0">
                  −20%
                </Badge>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Griglia piani */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 items-start">
        <PlanCard
          planKey="pro"
          name={PLAN_PRICING.pro.name}
          description={PLAN_PRICING.pro.description}
          price={billing === 'monthly' ? PLAN_PRICING.pro.monthly : PLAN_PRICING.pro.monthlyFromYearly}
          priceLabel={billing === 'yearly' ? `€${PLAN_PRICING.pro.yearly}/anno` : undefined}
          billing={billing}
          features={PLAN_PRICING.pro.features}
          currentPlan={currentPlan}
          popular
          icon={<Zap className="size-5" />}
          disabled={!proPriceId}
          onCheckout={() => handleCheckout('pro', proPriceId, 'subscription')}
          onPortal={hasStripeCustomer ? handlePortal : undefined}
          loading={pending && loadingPlan === 'pro'}
          portalLoading={pending && loadingPlan === 'portal'}
        />

        <PlanCard
          planKey="team"
          name={PLAN_PRICING.team.name}
          description={PLAN_PRICING.team.description}
          price={billing === 'monthly' ? PLAN_PRICING.team.monthly : PLAN_PRICING.team.monthlyFromYearly}
          priceLabel={billing === 'yearly' ? `€${PLAN_PRICING.team.yearly}/anno` : undefined}
          billing={billing}
          features={PLAN_PRICING.team.features}
          currentPlan={currentPlan}
          icon={<Users className="size-5" />}
          disabled={!teamPriceId}
          onCheckout={() => handleCheckout('team', teamPriceId, 'subscription')}
          onPortal={hasStripeCustomer ? handlePortal : undefined}
          loading={pending && loadingPlan === 'team'}
          portalLoading={pending && loadingPlan === 'portal'}
        />

        <PlanCard
          planKey="lifetime"
          name={PLAN_PRICING.lifetime.name}
          description={PLAN_PRICING.lifetime.description}
          price={PLAN_PRICING.lifetime.oneTime ?? 299}
          priceLabel="pagamento unico"
          billing="one_time"
          features={PLAN_PRICING.lifetime.features}
          currentPlan={currentPlan}
          icon={<InfinityIcon className="size-5" />}
          disabled={!priceIds.lifetime}
          onCheckout={() => handleCheckout('lifetime', priceIds.lifetime, 'payment')}
          loading={pending && loadingPlan === 'lifetime'}
        />
      </div>

      {/* Portale per abbonati */}
      {hasStripeCustomer && currentPlan !== 'free' && currentPlan !== 'lifetime' && (
        <div className="text-center pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handlePortal}
            disabled={pending}
            className="text-muted-foreground"
          >
            {pending && loadingPlan === 'portal' && <Loader2 className="size-3.5 animate-spin" />}
            Gestisci abbonamento, fatture e metodi di pagamento →
          </Button>
        </div>
      )}
    </div>
  )
}

// ── PlanCard ───────────────────────────────────────────────────────────────

interface PlanCardProps {
  planKey: string
  name: string
  description: string
  price: number
  priceLabel?: string
  billing: 'monthly' | 'yearly' | 'one_time'
  features: string[]
  currentPlan: PlanType
  popular?: boolean
  icon: React.ReactNode
  disabled?: boolean
  onCheckout: () => void
  onPortal?: () => void
  loading: boolean
  portalLoading?: boolean
}

function PlanCard({
  planKey, name, description, price, priceLabel, billing,
  features, currentPlan, popular, icon, disabled,
  onCheckout, onPortal, loading, portalLoading,
}: PlanCardProps) {
  const isCurrent = currentPlan === planKey
  // Non permettere downgrade tramite questa UI (gestito dal portale Stripe)
  const isUpgrade =
    currentPlan === 'free' ||
    (currentPlan === 'pro' && planKey === 'team') ||
    (currentPlan === 'pro' && planKey === 'lifetime')
  const canSwitch = !isCurrent && isUpgrade

  return (
    <div className={`relative rounded-xl border bg-card p-6 flex flex-col gap-4 ${
      popular && !isCurrent ? 'border-primary shadow-md ring-1 ring-primary/20' : ''
    } ${isCurrent ? 'border-green-300 bg-green-50/30' : ''}`}>
      {popular && !isCurrent && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
          <Badge className="bg-primary text-primary-foreground gap-1 text-xs px-2.5">
            <Sparkles className="size-3" /> Più scelto
          </Badge>
        </div>
      )}

      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className={isCurrent ? 'text-green-600' : 'text-primary'}>{icon}</span>
          <h3 className="font-bold text-lg">{name}</h3>
          {isCurrent && (
            <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 border-0">
              Attivo
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      <div>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold">
            €{price.toLocaleString('it-IT', { minimumFractionDigits: billing === 'yearly' ? 2 : 0 })}
          </span>
          {billing !== 'one_time' && (
            <span className="text-sm text-muted-foreground">/mese</span>
          )}
        </div>
        {priceLabel && (
          <p className="text-xs text-muted-foreground mt-0.5">{priceLabel}</p>
        )}
      </div>

      <ul className="space-y-2 flex-1">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2 text-sm">
            <Check className="size-4 text-green-500 shrink-0 mt-0.5" />
            <span>{f}</span>
          </li>
        ))}
      </ul>

      <div className="space-y-2 mt-2">
        {isCurrent ? (
          <>
            <Button variant="outline" className="w-full border-green-300 text-green-700" disabled>
              Piano attuale
            </Button>
            {onPortal && planKey !== 'lifetime' && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-muted-foreground"
                onClick={onPortal}
                disabled={portalLoading}
              >
                {portalLoading && <Loader2 className="size-3.5 animate-spin" />}
                Gestisci / cancella
              </Button>
            )}
          </>
        ) : canSwitch ? (
          <Button
            className="w-full"
            variant={popular ? 'default' : 'outline'}
            onClick={onCheckout}
            disabled={loading || disabled}
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {billing === 'one_time' ? 'Acquista ora' : 'Abbonati'}
          </Button>
        ) : (
          <Button variant="ghost" className="w-full text-muted-foreground text-xs" disabled>
            Disponibile dal portale Stripe
          </Button>
        )}
      </div>
    </div>
  )
}
