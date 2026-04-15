// ============================================================
// CARTA CANTA — Stripe client
// Lazy singleton server-side. Non importare mai in componenti client.
// ============================================================

import Stripe from 'stripe'

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY
    if (!key) throw new Error('STRIPE_SECRET_KEY non configurata')
    _stripe = new Stripe(key, {
      apiVersion: '2026-03-25.dahlia',
      typescript: true,
    })
  }
  return _stripe
}

// ── Helper: crea o recupera Stripe Customer per un workspace ──────────────

export async function getOrCreateStripeCustomer(
  workspaceId: string,
  email: string,
  name: string,
  existingCustomerId: string | null
): Promise<string> {
  const stripe = getStripe()

  if (existingCustomerId) {
    // Verifica che il customer esista ancora
    try {
      const customer = await stripe.customers.retrieve(existingCustomerId)
      if (!customer.deleted) return existingCustomerId
    } catch {
      // Customer non trovato → ne creiamo uno nuovo
    }
  }

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { workspace_id: workspaceId },
  })

  return customer.id
}

// ── Prezzi configurati nelle env vars ────────────────────────────────────

export function getPriceIds() {
  return {
    pro_monthly:  process.env.STRIPE_PRICE_PRO_MONTHLY,
    pro_yearly:   process.env.STRIPE_PRICE_PRO_YEARLY,
    team_monthly: process.env.STRIPE_PRICE_TEAM_MONTHLY,
    team_yearly:  process.env.STRIPE_PRICE_TEAM_YEARLY,
    lifetime:     process.env.STRIPE_PRICE_LIFETIME,
  }
}

/** Dato un price_id Stripe, restituisce il piano corrispondente */
export function planFromPriceId(priceId: string): 'pro' | 'team' | 'lifetime' | null {
  const ids = getPriceIds()
  if (priceId === ids.pro_monthly || priceId === ids.pro_yearly) return 'pro'
  if (priceId === ids.team_monthly || priceId === ids.team_yearly) return 'team'
  if (priceId === ids.lifetime) return 'lifetime'
  return null
}
