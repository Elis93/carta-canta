// ============================================================
// POST /api/webhooks/stripe
// Pubblica — no auth, ma validata con firma Stripe.
// Gestisce gli eventi di abbonamento e aggiorna il piano nel DB.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createElement } from 'react'
import type Stripe from 'stripe'
import { getStripe, planFromPriceId } from '@/lib/stripe/stripe'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { PagamentoFallitoEmail } from '@/lib/email/templates/pagamento_fallito'
import { PagamentoSuccessEmail } from '@/lib/email/templates/pagamento_success'

// Disabilita il body parsing di Next.js — Stripe richiede il body grezzo
export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature') ?? ''
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    console.error('[stripe-webhook] STRIPE_WEBHOOK_SECRET non configurata')
    return NextResponse.json({ error: 'Webhook non configurato' }, { status: 500 })
  }

  // ── Verifica firma Stripe ─────────────────────────────────────────────
  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.warn('[stripe-webhook] Firma non valida:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Firma non valida' }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── Gestione eventi ───────────────────────────────────────────────────
  try {
    switch (event.type) {

      // Pagamento completato (sia subscription che one-time Lifetime)
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        await handleCheckoutCompleted(session, admin)
        break
      }

      // Abbonamento aggiornato (rinnovo, cambio piano, cancellazione schedulata)
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionUpdated(sub, admin)
        break
      }

      // Abbonamento terminato definitivamente → downgrade a free
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(sub, admin)
        break
      }

      // Pagamento fattura fallito — notifica all'owner
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        console.warn('[stripe-webhook] Pagamento fallito per customer:', invoice.customer)
        await handlePaymentFailed(invoice, admin)
        break
      }

      default:
        // Evento non gestito — ok, Stripe richiede 200
        break
    }
  } catch (err) {
    console.error('[stripe-webhook] Errore gestione evento:', event.type, err)
    // Ritorna 500 → Stripe ritenterà il webhook
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ── Handlers ──────────────────────────────────────────────────────────────

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  admin: ReturnType<typeof createAdminClient>
) {
  const workspaceId = session.metadata?.workspace_id
  if (!workspaceId) {
    console.warn('[stripe-webhook] checkout.session.completed senza workspace_id')
    return
  }

  const customerId = typeof session.customer === 'string'
    ? session.customer
    : session.customer?.id ?? null

  if (session.mode === 'payment') {
    // Piano Lifetime — pagamento unico
    await admin.from('workspaces').update({
      plan: 'lifetime',
      stripe_customer_id: customerId,
      stripe_subscription_id: null,
      subscription_ends_at: null,
    }).eq('id', workspaceId)

    console.log('[stripe-webhook] Lifetime attivato per workspace:', workspaceId)
    await sendPaymentSuccessEmail(workspaceId, 'Lifetime', admin)

  } else if (session.mode === 'subscription') {
    // Abbonamento — recupera dettagli dalla subscription
    const stripe = getStripe()
    const subId = typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id

    if (!subId) return

    const subscription = await stripe.subscriptions.retrieve(subId)
    const priceId = subscription.items.data[0]?.price.id
    const plan = priceId ? (planFromPriceId(priceId) ?? 'pro') : 'pro'
    const periodEnd = subscription.items.data[0]?.current_period_end
    const endsAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

    await admin.from('workspaces').update({
      plan,
      stripe_customer_id: customerId,
      stripe_subscription_id: subId,
      subscription_ends_at: endsAt,
    }).eq('id', workspaceId)

    console.log(`[stripe-webhook] Piano ${plan} attivato per workspace:`, workspaceId)
    const planName = plan.charAt(0).toUpperCase() + plan.slice(1)
    await sendPaymentSuccessEmail(workspaceId, planName, admin)
  }
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  admin: ReturnType<typeof createAdminClient>
) {
  // Trova workspace dal stripe_subscription_id o customer_id
  const { data: workspace } = await admin
    .from('workspaces')
    .select('id')
    .or(`stripe_subscription_id.eq.${subscription.id},stripe_customer_id.eq.${subscription.customer}`)
    .maybeSingle()

  if (!workspace) {
    console.warn('[stripe-webhook] subscription.updated: workspace non trovato per sub:', subscription.id)
    return
  }

  const priceId = subscription.items.data[0]?.price.id
  const plan = priceId ? (planFromPriceId(priceId) ?? 'pro') : 'pro'
  const periodEnd = subscription.items.data[0]?.current_period_end
  const endsAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

  const isActive = subscription.status === 'active' || subscription.status === 'trialing'
  const isCancelledAtPeriodEnd = subscription.cancel_at_period_end

  await admin.from('workspaces').update({
    plan: isActive ? plan : 'free',
    stripe_subscription_id: subscription.id,
    subscription_ends_at: (isActive || isCancelledAtPeriodEnd) ? endsAt : null,
  }).eq('id', workspace.id)

  console.log(`[stripe-webhook] Subscription aggiornata — piano: ${plan}, workspace: ${workspace.id}`)
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  admin: ReturnType<typeof createAdminClient>
) {
  const { data: workspace } = await admin
    .from('workspaces')
    .select('id')
    .or(`stripe_subscription_id.eq.${subscription.id},stripe_customer_id.eq.${subscription.customer}`)
    .maybeSingle()

  if (!workspace) {
    console.warn('[stripe-webhook] subscription.deleted: workspace non trovato per sub:', subscription.id)
    return
  }

  await admin.from('workspaces').update({
    plan: 'free',
    stripe_subscription_id: null,
    subscription_ends_at: null,
  }).eq('id', workspace.id)

  console.log('[stripe-webhook] Subscription terminata — downgrade a free per workspace:', workspace.id)
}

async function sendPaymentSuccessEmail(
  workspaceId: string,
  planName: string,
  admin: ReturnType<typeof createAdminClient>
) {
  try {
    const { data: workspace } = await admin
      .from('workspaces')
      .select('owner_id, ragione_sociale, name')
      .eq('id', workspaceId)
      .maybeSingle()

    if (!workspace) return

    const { data: ownerData } = await admin.auth.admin.getUserById(workspace.owner_id)
    const ownerEmail = ownerData?.user?.email
    if (!ownerEmail) return

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.it'
    const workspaceName = workspace.ragione_sociale ?? workspace.name

    await sendEmail({
      to: ownerEmail,
      subject: `🎉 Piano ${planName} attivato — grazie per aver scelto Carta Canta!`,
      react: createElement(PagamentoSuccessEmail, {
        workspaceName,
        planName,
        abbonamentoUrl: `${appUrl}/abbonamento`,
      }),
    })

    console.log(`[stripe-webhook] Email pagamento ok inviata a: ${ownerEmail}`)
  } catch (err) {
    console.warn('[stripe-webhook] Errore invio email pagamento ok:', err)
  }
}

async function handlePaymentFailed(
  invoice: Stripe.Invoice,
  admin: ReturnType<typeof createAdminClient>
) {
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id
  if (!customerId) return

  const { data: workspace } = await admin
    .from('workspaces')
    .select('id, ragione_sociale, name, plan, notification_prefs, owner_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (!workspace) return

  // Rispetta preferenza notifiche
  const prefs = (workspace.notification_prefs as Record<string, boolean> | null) ?? {}
  if (prefs['pagamento_fallito'] === false) return

  try {
    const { data: ownerData } = await admin.auth.admin.getUserById(workspace.owner_id)
    const ownerEmail = ownerData?.user?.email
    if (!ownerEmail) return

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.it'
    const workspaceName = workspace.ragione_sociale ?? workspace.name
    const planName = workspace.plan.charAt(0).toUpperCase() + workspace.plan.slice(1)

    await sendEmail({
      to: ownerEmail,
      subject: `⚠️ Pagamento non riuscito per il piano ${planName} di Carta Canta`,
      react: createElement(PagamentoFallitoEmail, {
        workspaceName,
        planName,
        portalUrl: `${appUrl}/abbonamento`,
      }),
    })

    console.log('[stripe-webhook] Email pagamento fallito inviata a:', ownerEmail)
  } catch (err) {
    console.warn('[stripe-webhook] Errore invio email pagamento fallito:', err)
  }
}
