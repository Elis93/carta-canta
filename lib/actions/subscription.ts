'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, getOrCreateStripeCustomer } from '@/lib/stripe/stripe'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'

// ── createCheckoutSessionAction ───────────────────────────────────────────
// Crea una sessione Stripe Checkout e redirige l'utente.
// priceId: ID del prezzo Stripe (abbonamento o one-time)
// mode: 'subscription' per piani mensili/annuali, 'payment' per Lifetime

export async function createCheckoutSessionAction(
  priceId: string,
  mode: 'subscription' | 'payment' = 'subscription'
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, ragione_sociale, stripe_customer_id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) redirect('/login')

  // Ottieni o crea il customer Stripe
  const customerId = await getOrCreateStripeCustomer(
    workspace.id,
    user.email ?? '',
    workspace.ragione_sociale ?? workspace.name,
    workspace.stripe_customer_id
  )

  // Aggiorna stripe_customer_id nel DB se è cambiato
  if (customerId !== workspace.stripe_customer_id) {
    const admin = createAdminClient()
    await admin
      .from('workspaces')
      .update({ stripe_customer_id: customerId })
      .eq('id', workspace.id)
  }

  const stripe = getStripe()

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode,
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    metadata: {
      workspace_id: workspace.id,
    },
    success_url: `${APP_URL}/abbonamento?success=1`,
    cancel_url: `${APP_URL}/abbonamento?cancelled=1`,
    allow_promotion_codes: true,
    ...(mode === 'subscription' ? {
      subscription_data: {
        metadata: { workspace_id: workspace.id },
      },
    } : {}),
    // Localizzazione italiana
    locale: 'it',
    tax_id_collection: { enabled: true },
    customer_update: {
      address: 'auto',
      name: 'auto',
    },
  })

  if (!session.url) {
    throw new Error('Impossibile creare la sessione di pagamento')
  }

  redirect(session.url)
}

// ── createPortalSessionAction ─────────────────────────────────────────────
// Apre il portale Stripe per gestire abbonamento, fatture, metodi di pagamento

export async function createPortalSessionAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('stripe_customer_id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace?.stripe_customer_id) {
    // Nessun abbonamento attivo → torna alla pagina abbonamento
    redirect('/abbonamento')
  }

  const stripe = getStripe()

  const session = await stripe.billingPortal.sessions.create({
    customer: workspace.stripe_customer_id,
    return_url: `${APP_URL}/abbonamento`,
  })

  redirect(session.url)
}
