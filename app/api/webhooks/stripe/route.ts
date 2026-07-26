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
  // ⚠️ DUE FASI (migration 061, review 25 lug S1): si PRENOTA l'evento
  // ('processing') e lo si marca 'done' SOLO a elaborazione completata.
  // Con la sola prenotazione (060) un timeout della lambda lasciava la riga
  // orfana e il retry di Stripe veniva scambiato per un doppione → evento
  // perso per sempre (il webhook è l'UNICA via che scrive il piano).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 060/061 non ancora in types/database.ts
  const db = admin as any
  const STALE_MS = 5 * 60_000
  let dedupRegistered = false
  {
    const { error: insErr } = await db
      .from('stripe_webhook_events')
      .insert({ event_id: event.id, event_type: event.type, status: 'processing' })
    if (!insErr) {
      dedupRegistered = true
    } else if (insErr.code === '23505') {
      // Esiste già: doppione vero o prenotazione rimasta appesa?
      const { data: prev, error: prevErr } = await db
        .from('stripe_webhook_events')
        .select('status, started_at')
        .eq('event_id', event.id)
        .maybeSingle()
      if (prevErr) {
        // Non sappiamo se è un doppione: rispondere 200 lo scarterebbe PER
        // SEMPRE. Meglio un 409 e lasciare che Stripe ritenti.
        console.error('[stripe-webhook] registro illeggibile, chiedo un retry:', event.id, prevErr.code)
        return NextResponse.json({ error: 'Registro non leggibile' }, { status: 409 })
      }
      const startedMs = prev?.started_at ? Date.parse(prev.started_at) : 0
      const stale = Number.isFinite(startedMs) && Date.now() - startedMs > STALE_MS
      if (prev?.status === 'done') {
        console.log('[stripe-webhook] evento già elaborato, ignoro il retry:', event.id, event.type)
        return NextResponse.json({ received: true, duplicate: true })
      }
      if (prev?.status === 'processing' && !stale) {
        // Un'altra esecuzione lo sta elaborando proprio ora: Stripe ritenti
        // più tardi invece di lavorarci in parallelo.
        console.warn('[stripe-webhook] evento già in elaborazione, chiedo un retry:', event.id)
        return NextResponse.json({ error: 'Elaborazione in corso' }, { status: 409 })
      }
      // Prenotazione appesa (lambda morta): la riprendiamo.
      // ⚠️ La ripresa RI-AFFERMA la staleness nel WHERE (`started_at` più
      // vecchio del taglio). Senza, DUE retry che trovano la STESSA
      // prenotazione scaduta vincerebbero entrambi (1 riga a testa,
      // misurato su PG16) e l'evento verrebbe elaborato due volte in
      // parallelo — seconda email "Piano attivato" e stato riscritto.
      // Il primo UPDATE porta started_at a "adesso", quindi il secondo non
      // matcha più e risponde "doppione".
      // NB: si confronta con `<`, NON con `=` sul valore appena letto:
      // PostgREST rende i timestamp con i MICROsecondi mentre JavaScript
      // arriva ai millisecondi (verificato su PG16), quindi un'uguaglianza
      // basterebbe un `new Date()` di troppo per non matchare mai più —
      // e ogni evento appeso verrebbe scambiato per doppione e perso.
      const staleCutoff = new Date(Date.now() - STALE_MS).toISOString()
      const { data: claimed, error: claimErr } = await db
        .from('stripe_webhook_events')
        .update({ status: 'processing', started_at: new Date().toISOString() })
        .eq('event_id', event.id)
        .neq('status', 'done')
        .lt('started_at', staleCutoff)
        .select('event_id')
      if (claimErr) {
        // Errore di scrittura ≠ "già fatto": 409, così Stripe ritenta.
        console.error('[stripe-webhook] ripresa non riuscita, chiedo un retry:', event.id, claimErr.code)
        return NextResponse.json({ error: 'Ripresa non riuscita' }, { status: 409 })
      }
      if (!claimed || claimed.length === 0) {
        // 0 righe = un'altra esecuzione l'ha appena portato a 'done'.
        return NextResponse.json({ received: true, duplicate: true })
      }
      console.warn('[stripe-webhook] riprendo un evento rimasto appeso:', event.id, event.type)
      dedupRegistered = true
    } else if (insErr.code !== '42P01' && insErr.code !== 'PGRST205' && insErr.code !== 'PGRST204') {
      // 42P01/PGRST205 = tabella assente, PGRST204 = colonna assente
      // (pre-060/061): non bloccare il pagamento, si prosegue come prima.
      console.warn('[stripe-webhook] registro eventi non disponibile, proseguo senza deduplica:', insErr.code)
    }
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
      // supabase-js NON lancia: l'esito va letto da `error`, non da un catch
      // (review 25 lug S2 — il try/catch precedente era codice morto).
      const { error: cleanupErr } = await db
        .from('stripe_webhook_events')
        .delete()
        .eq('event_id', event.id)
      if (cleanupErr) {
        console.error('[stripe-webhook] CRITICO: prenotazione non rimossa dopo errore — l\'evento resterà appeso fino allo sblocco automatico (5 min):', event.id, cleanupErr)
      }
    }
    // Ritorna 500 → Stripe ritenterà il webhook
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 })
  }

  // Elaborazione completata: solo ORA l'evento è un vero doppione per i retry.
  if (dedupRegistered) {
    const { error: doneErr } = await db
      .from('stripe_webhook_events')
      .update({ status: 'done', processed_at: new Date().toISOString() })
      .eq('event_id', event.id)
    if (doneErr) {
      // Non è grave: la prenotazione scade da sola dopo 5 minuti e un
      // eventuale retry rielabora (gli handler sono idempotenti sullo stato).
      console.warn('[stripe-webhook] evento elaborato ma non marcato done:', event.id, doneErr.code)
    }
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
