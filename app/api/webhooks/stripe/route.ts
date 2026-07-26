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

  // ── Idempotenza (migration 060) ───────────────────────────────────────
  // Stripe RITENTA gli eventi: senza deduplica un retry di
  // checkout.session.completed rimanderebbe l'email "Piano attivato" e
  // riscriverebbe lo stato. L'INSERT con PK fa da lock: 23505 = già
  // elaborato → 200 (così Stripe smette di ritentare).
  // Tollerante pre-060: se la tabella non esiste si prosegue come prima.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 060 non ancora in types/database.ts
  const { error: dedupErr } = await (admin as any)
    .from('stripe_webhook_events')
    .insert({ event_id: event.id, event_type: event.type })
  let dedupRegistered = !dedupErr
  if (dedupErr) {
    if (dedupErr.code === '23505') {
      console.log('[stripe-webhook] evento già elaborato, ignoro il retry:', event.id, event.type)
      return NextResponse.json({ received: true, duplicate: true })
    }
    // 42P01 = tabella assente (pre-060): non bloccare il pagamento.
    if (dedupErr.code !== '42P01') {
      console.warn('[stripe-webhook] registro eventi non disponibile, proseguo senza deduplica:', dedupErr.code)
    }
    dedupRegistered = false
  }

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
        await handleSubscriptionUpdated(sub, admin, event.created)
        break
      }

      // Abbonamento terminato definitivamente → downgrade a free
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await handleSubscriptionDeleted(sub, admin, event.created)
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
    // ⚠️ CRITICO: l'evento è stato registrato come "visto" PRIMA di essere
    // elaborato. Se l'elaborazione fallisce dobbiamo TOGLIERE quella riga,
    // altrimenti il retry di Stripe la troverebbe e risponderebbe "duplicato"
    // → l'evento non verrebbe elaborato MAI (un utente che ha pagato
    // resterebbe su Free per sempre). Il registro serve contro i doppioni,
    // non deve mai trasformarsi in una perdita di eventi.
    if (dedupRegistered) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 060
        await (admin as any).from('stripe_webhook_events').delete().eq('event_id', event.id)
      } catch (cleanupErr) {
        console.error('[stripe-webhook] CRITICO: registro non ripulito dopo errore — evento a rischio di essere ignorato al retry:', event.id, cleanupErr)
      }
    }
    // Ritorna 500 → Stripe ritenterà il webhook
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}

// ── Ordine degli eventi (migration 060) ───────────────────────────────────
// Stripe NON garantisce l'ordine di consegna: un `subscription.updated`
// consegnato in ritardo DOPO un `subscription.deleted` riattiverebbe un piano
// cancellato. Confrontiamo `event.created` con l'ultimo evento applicato.
// Tollerante pre-060 (colonna assente → nessun blocco).
async function isStaleStripeEvent(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  eventCreated: number,
): Promise<boolean> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonna 060 non ancora in types/database.ts
    const { data, error } = await (admin as any)
      .from('workspaces')
      .select('stripe_event_at')
      .eq('id', workspaceId)
      .maybeSingle()
    if (error || !data?.stripe_event_at) return false
    const prev = Date.parse(data.stripe_event_at)
    return Number.isFinite(prev) && prev > eventCreated * 1000
  } catch {
    return false
  }
}

/** Marca l'ultimo evento applicato (best-effort, tollerante pre-060). */
async function stampStripeEvent(
  admin: ReturnType<typeof createAdminClient>,
  workspaceId: string,
  eventCreated: number,
): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonna 060
    await (admin as any)
      .from('workspaces')
      .update({ stripe_event_at: new Date(eventCreated * 1000).toISOString() })
      .eq('id', workspaceId)
  } catch { /* colonna assente: nessun impatto sul pagamento */ }
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
    const { error: upErr } = await admin.from('workspaces').update({
      plan: 'lifetime',
      stripe_customer_id: customerId,
      stripe_subscription_id: null,
      subscription_ends_at: null,
    }).eq('id', workspaceId)
    // supabase-js non lancia: senza questo throw la route risponderebbe 200
    // e Stripe non ritenterebbe MAI — utente pagante lasciato su Free.
    if (upErr) throw new Error(`update lifetime fallito: ${upErr.message}`)

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

    const { error: upErr } = await admin.from('workspaces').update({
      plan,
      stripe_customer_id:     customerId,
      stripe_subscription_id: subId,
      subscription_ends_at:   endsAt,
      billing_interval:       subscription.items.data[0]?.price.recurring?.interval ?? null,
    }).eq('id', workspaceId)
    if (upErr) throw new Error(`update abbonamento fallito: ${upErr.message}`)

    console.log(`[stripe-webhook] Piano ${plan} attivato per workspace:`, workspaceId)
    const planName = plan.charAt(0).toUpperCase() + plan.slice(1)
    await sendPaymentSuccessEmail(workspaceId, planName, admin)
  }
}

async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription,
  admin: ReturnType<typeof createAdminClient>,
  eventCreated: number,
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

  // Evento consegnato FUORI ORDINE (più vecchio dell'ultimo applicato):
  // applicarlo riattiverebbe un piano già cancellato (migration 060).
  if (await isStaleStripeEvent(admin, workspace.id, eventCreated)) {
    console.log('[stripe-webhook] subscription.updated ignorato (fuori ordine) per workspace:', workspace.id)
    return
  }

  const priceId = subscription.items.data[0]?.price.id
  const plan = priceId ? (planFromPriceId(priceId) ?? 'pro') : 'pro'
  const periodEnd = subscription.items.data[0]?.current_period_end
  const endsAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

  const isActive = subscription.status === 'active' || subscription.status === 'trialing'
  const isCancelledAtPeriodEnd = subscription.cancel_at_period_end

  const { error: upErr } = await admin.from('workspaces').update({
    plan:                   isActive ? plan : 'free',
    stripe_subscription_id: subscription.id,
    subscription_ends_at:   (isActive || isCancelledAtPeriodEnd) ? endsAt : null,
    billing_interval:       isActive
      ? (subscription.items.data[0]?.price.recurring?.interval ?? null)
      : null,
  }).eq('id', workspace.id)
  if (upErr) throw new Error(`update subscription fallito: ${upErr.message}`)
  await stampStripeEvent(admin, workspace.id, eventCreated)

  console.log(`[stripe-webhook] Subscription aggiornata — piano: ${plan}, workspace: ${workspace.id}`)
}

async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription,
  admin: ReturnType<typeof createAdminClient>,
  eventCreated: number,
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

  // Vedi handleSubscriptionUpdated: niente downgrade da un evento vecchio.
  if (await isStaleStripeEvent(admin, workspace.id, eventCreated)) {
    console.log('[stripe-webhook] subscription.deleted ignorato (fuori ordine) per workspace:', workspace.id)
    return
  }

  const { error: upErr } = await admin.from('workspaces').update({
    plan:                   'free',
    stripe_subscription_id: null,
    subscription_ends_at:   null,
    billing_interval:       null,
  }).eq('id', workspace.id)
  if (upErr) throw new Error(`downgrade a free fallito: ${upErr.message}`)
  await stampStripeEvent(admin, workspace.id, eventCreated)

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
      .select('owner_id, ragione_sociale, name, notification_prefs')
      .eq('id', workspaceId)
      .maybeSingle()

    if (!workspace) return

    const { data: ownerData } = await admin.auth.admin.getUserById(workspace.owner_id)
    const ownerEmail = ownerData?.user?.email
    if (!ownerEmail) return

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'
    const workspaceName = workspace.ragione_sociale ?? workspace.name

    await sendEmail({
      to: ownerEmail,
      subject: `Piano ${planName} attivato — benvenuto su Carta Canta!`,
      react: createElement(PagamentoSuccessEmail, {
        workspaceName,
        planName,
        abbonamentoUrl: `${appUrl}/abbonamento`,
      }),
    })

    console.log('[stripe-webhook] Email pagamento ok inviata, workspace:', workspaceId)
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

  try {
    const { data: ownerData } = await admin.auth.admin.getUserById(workspace.owner_id)
    const ownerEmail = ownerData?.user?.email
    if (!ownerEmail) return

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'
    const workspaceName = workspace.ragione_sociale ?? workspace.name
    const planName = workspace.plan.charAt(0).toUpperCase() + workspace.plan.slice(1)

    await sendEmail({
      to: ownerEmail,
      subject: `Pagamento non riuscito per il piano ${planName} di Carta Canta`,
      react: createElement(PagamentoFallitoEmail, {
        workspaceName,
        planName,
        portalUrl: `${appUrl}/abbonamento`,
      }),
    })

    console.log('[stripe-webhook] Email pagamento fallito inviata, workspace:', workspace.id)
  } catch (err) {
    console.warn('[stripe-webhook] Errore invio email pagamento fallito:', err)
  }
}
