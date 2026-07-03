'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe, getOrCreateStripeCustomer, getPriceIds, planFromPriceId } from '@/lib/stripe/stripe'
import { revalidatePath } from 'next/cache'

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
    redirect('/abbonamento')
  }

  const stripe = getStripe()
  const session = await stripe.billingPortal.sessions.create({
    customer: workspace.stripe_customer_id,
    return_url: `${APP_URL}/abbonamento`,
  })

  redirect(session.url)
}

// ── switchToAnnualAction ──────────────────────────────────────────────────
// Passa l'abbonamento Pro da MENSILE ad ANNUALE (monodirezionale: solo upgrade).
// Apre il portale Stripe sul flusso `subscription_update_confirm` con il prezzo
// annuale già pre-selezionato → l'utente vede solo la conferma, nessuna scelta
// di downgrade. Stripe gestisce la proration automaticamente.

export async function switchToAnnualAction() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('stripe_customer_id, stripe_subscription_id, billing_interval')
    .eq('owner_id', user.id)
    .maybeSingle()

  // Consentito SOLO se c'è un abbonamento mensile attivo
  if (!workspace?.stripe_customer_id || !workspace.stripe_subscription_id || workspace.billing_interval !== 'month') {
    redirect('/abbonamento')
  }

  const ids = getPriceIds()
  if (!ids.pro_yearly) {
    throw new Error('Prezzo annuale Pro non configurato')
  }

  const stripe = getStripe()

  // Recupera l'ID dell'item della subscription (necessario per il confirm flow)
  const sub = await stripe.subscriptions.retrieve(workspace.stripe_subscription_id)
  const itemId = sub.items.data[0]?.id
  if (!itemId) {
    throw new Error('Item subscription non trovato')
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: workspace.stripe_customer_id,
    return_url: `${APP_URL}/abbonamento`,
    flow_data: {
      type: 'subscription_update_confirm',
      subscription_update_confirm: {
        subscription: workspace.stripe_subscription_id,
        items: [{ id: itemId, price: ids.pro_yearly }],
      },
    },
  })

  redirect(session.url)
}

// ── resyncSubscriptionAction ──────────────────────────────────────────────
// Ripristina i dati abbonamento dal vivo di Stripe (utile se il webhook non ha
// popolato i campi: es. abbonamento creato prima del webhook, o mancata consegna).
// Cerca il cliente Stripe per email e ricopia stato/subscription nel workspace.
export async function resyncSubscriptionAction(): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }
  const email = user.email
  if (!email) return { error: 'Email account non disponibile.' }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, stripe_customer_id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) return { error: 'Workspace non trovato.' }

  const stripe = getStripe()

  // Individua il customer: prima quello salvato, altrimenti per email
  let customerId = workspace.stripe_customer_id ?? null
  if (!customerId) {
    const customers = await stripe.customers.list({ email, limit: 10 })
    for (const c of customers.data) {
      const subs = await stripe.subscriptions.list({ customer: c.id, status: 'all', limit: 5 })
      if (subs.data.some((s) => s.status === 'active' || s.status === 'trialing')) { customerId = c.id; break }
    }
    if (!customerId && customers.data[0]) customerId = customers.data[0].id
  }
  if (!customerId) {
    return { error: 'Nessun cliente Stripe trovato per la tua email. Verifica di aver usato la stessa email dell’abbonamento.' }
  }

  const subs = await stripe.subscriptions.list({ customer: customerId, status: 'all', limit: 10 })
  const active = subs.data.find((s) => s.status === 'active' || s.status === 'trialing')
  const admin = createAdminClient()

  if (!active) {
    await admin.from('workspaces').update({
      plan: 'free', stripe_customer_id: customerId, stripe_subscription_id: null,
      subscription_ends_at: null, billing_interval: null,
    }).eq('id', workspace.id)
    revalidatePath('/abbonamento')
    return { ok: true, message: 'Nessun abbonamento attivo su Stripe: piano impostato su Free.' }
  }

  const priceId = active.items.data[0]?.price.id
  const plan = priceId ? (planFromPriceId(priceId) ?? 'pro') : 'pro'
  const periodEnd = active.items.data[0]?.current_period_end
  const endsAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

  await admin.from('workspaces').update({
    plan,
    stripe_customer_id:     customerId,
    stripe_subscription_id: active.id,
    subscription_ends_at:   endsAt,
    billing_interval:       active.items.data[0]?.price.recurring?.interval ?? null,
  }).eq('id', workspace.id)

  revalidatePath('/abbonamento')
  const planName = plan.charAt(0).toUpperCase() + plan.slice(1)
  return { ok: true, message: `Abbonamento ${planName} sincronizzato da Stripe.` }
}
