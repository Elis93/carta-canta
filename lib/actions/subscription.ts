'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, getOrCreateStripeCustomer, getPriceIds } from '@/lib/stripe/stripe'

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

  // FIX-32: custom_text per piani annuali — chiarisce che l'addebito è annuale unico
  const ids = getPriceIds()
  const isYearly = priceId === ids.pro_yearly || priceId === ids.team_yearly

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
    // FIX-32: messaggio personalizzato per piani annuali
    ...(isYearly ? {
      custom_text: {
        submit: {
          message: 'Addebito annuale unico — nessun rinnovo mensile',
        },
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
// Apre il portale Stripe per gestire abbonamento, fatture, metodi di pagamento.
//
// switchPlan=true → apre il portale direttamente sul flusso di cambio piano
// (mensile ⇄ annuale) tramite deep-link flow_data. Richiede che il portale
// Stripe abbia "Customers can switch plans" attivo con i prezzi Pro elencati.

export async function createPortalSessionAction(
  options: { switchPlan?: boolean } = {}
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('stripe_customer_id, stripe_subscription_id')
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
    // Deep-link diretto alla schermata di cambio piano (se richiesto e c'è una sub attiva)
    ...(options.switchPlan && workspace.stripe_subscription_id
      ? {
          flow_data: {
            type: 'subscription_update' as const,
            subscription_update: {
              subscription: workspace.stripe_subscription_id,
            },
          },
        }
      : {}),
  })

  redirect(session.url)
}
