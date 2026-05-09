// GET /api/cron/referral
// Eseguito il 1° di ogni mese alle 09:00 UTC dal cron Vercel.
// Protetto da CRON_SECRET.
//
// Logica:
//   1. Trova tutti i referral_uses dove il referee ha piano pagamento
//   2. Esclude quelli già premiati (referral_rewards)
//   3. Per ogni nuovo caso: emette credito Stripe al referrer + inserisce referral_rewards
//
// Credito: €19 (1900 cent) sul Customer Balance Stripe — si scalerà dalla prossima fattura.
// Se il referrer non ha ancora stripe_customer_id (piano Free), salva il premio come
// "pending" (applied_at = null) e lo applicherà al prossimo giro mensile.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/stripe'

const CREDIT_CENTS = 1900 // €19 = 1 mese Pro

// Tipi locali per le nuove tabelle (non ancora in types/database.ts)
interface ReferralUseRow {
  id: string
  referrer_workspace_id: string
  referee_workspace_id: string
  code: string
}
interface PaidRefereeRow  { id: string; stripe_customer_id: string | null }
interface ExistingRewardRow { referee_workspace_id: string }
interface ReferrerRow     { id: string; stripe_customer_id: string | null; name: string; owner_id: string }
interface PendingRewardRow { id: string; workspace_id: string; credit_amount_cents: number }

export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = createAdminClient() as any
  const results = {
    checked: 0,
    rewarded: 0,
    pending: 0,
    errors: 0,
  }

  // ── 1. Trova le conversioni non ancora premiate ───────────────────────────
  // Join referral_uses con workspaces (referee) per verificare piano pagamento
  // e con referral_rewards per escludere già premiati.
  const { data: conversions, error: queryError } = await admin
    .from('referral_uses')
    .select(`
      id,
      referrer_workspace_id,
      referee_workspace_id,
      code
    `)

  if (queryError) {
    console.error('[cron/referral] Query error:', queryError)
    return NextResponse.json({ error: queryError.message }, { status: 500 })
  }

  if (!conversions || conversions.length === 0) {
    return NextResponse.json({ success: true, ...results })
  }

  results.checked = conversions.length

  // ── 2. Filtra: referee su piano pagamento e non ancora premiato ───────────
  // Facciamo due query extra per non complicare il join
  const refereeIds = (conversions as ReferralUseRow[]).map((c) => c.referee_workspace_id)

  const [{ data: paidReferees }, { data: existingRewards }] = await Promise.all([
    admin
      .from('workspaces')
      .select('id, stripe_customer_id')
      .in('id', refereeIds)
      .in('plan', ['pro', 'team', 'lifetime']) as Promise<{ data: PaidRefereeRow[] | null }>,
    admin
      .from('referral_rewards')
      .select('referee_workspace_id')
      .in('referee_workspace_id', refereeIds) as Promise<{ data: ExistingRewardRow[] | null }>,
  ])

  const paidSet     = new Set((paidReferees   ?? []).map((w: PaidRefereeRow) => w.id))
  const rewardedSet = new Set((existingRewards ?? []).map((r: ExistingRewardRow) => r.referee_workspace_id))

  const toReward = (conversions as ReferralUseRow[]).filter(
    (c) => paidSet.has(c.referee_workspace_id) && !rewardedSet.has(c.referee_workspace_id)
  )

  if (toReward.length === 0) {
    return NextResponse.json({ success: true, ...results })
  }

  // ── 3. Carica i workspace referrer (per stripe_customer_id) ──────────────
  const referrerIds = [...new Set(toReward.map((c) => c.referrer_workspace_id))]
  const { data: referrers } = await admin
    .from('workspaces')
    .select('id, stripe_customer_id, name, owner_id')
    .in('id', referrerIds) as { data: ReferrerRow[] | null }

  const referrerMap = Object.fromEntries(
    (referrers ?? []).map((w: ReferrerRow) => [w.id, w])
  )

  // ── 4. Emetti premi ───────────────────────────────────────────────────────
  const stripe = getStripe()

  for (const conv of toReward) {
    const referrer = referrerMap[conv.referrer_workspace_id]
    if (!referrer) continue

    try {
      let txId: string | null = null
      let appliedAt: string | null = null

      if (referrer.stripe_customer_id) {
        // Emetti credito Stripe (importo negativo = credito a favore del cliente)
        const tx = await stripe.customers.createBalanceTransaction(
          referrer.stripe_customer_id,
          {
            amount:      -CREDIT_CENTS,
            currency:    'eur',
            description: `Referral bonus — 1 mese Pro gratuito (codice ${conv.code})`,
          }
        )
        txId      = tx.id
        appliedAt = new Date().toISOString()
        results.rewarded++
      } else {
        // Referrer non ancora su Stripe (piano Free): salva come pending
        results.pending++
      }

      // Inserisci il record premio
      await admin.from('referral_rewards').insert({
        workspace_id:                 conv.referrer_workspace_id,
        referee_workspace_id:         conv.referee_workspace_id,
        free_months:                  1,
        credit_amount_cents:          CREDIT_CENTS,
        stripe_balance_transaction_id: txId,
        applied_at:                   appliedAt,
      })

      console.log(
        `[cron/referral] Premio ${appliedAt ? 'applicato' : 'pending'} — ` +
        `referrer=${conv.referrer_workspace_id} referee=${conv.referee_workspace_id}`
      )
    } catch (err) {
      console.error(`[cron/referral] Errore per conv ${conv.id}:`, err)
      results.errors++
    }
  }

  // ── 5. Tenta di applicare i premi pending con stripe_customer_id ora disponibile ──
  // (es. referrer Free che nel frattempo ha sottoscritto Pro)
  try {
    const { data: pendingRewards } = await admin
      .from('referral_rewards')
      .select('id, workspace_id, credit_amount_cents')
      .is('applied_at', null)
      .is('stripe_balance_transaction_id', null) as { data: PendingRewardRow[] | null }

    if (pendingRewards && pendingRewards.length > 0) {
      const pendingWorkspaceIds = [...new Set((pendingRewards as PendingRewardRow[]).map((r) => r.workspace_id))]
      const { data: pendingReferrers } = await admin
        .from('workspaces')
        .select('id, stripe_customer_id')
        .in('id', pendingWorkspaceIds)
        .not('stripe_customer_id', 'is', null) as { data: PaidRefereeRow[] | null }

      const pendingReferrerMap = Object.fromEntries(
        (pendingReferrers ?? []).map((w: PaidRefereeRow) => [w.id, w.stripe_customer_id as string])
      )

      for (const reward of pendingRewards) {
        const customerId = pendingReferrerMap[reward.workspace_id]
        if (!customerId) continue

        try {
          const tx = await stripe.customers.createBalanceTransaction(customerId, {
            amount:      -reward.credit_amount_cents,
            currency:    'eur',
            description: `Referral bonus — 1 mese Pro gratuito`,
          })

          await admin
            .from('referral_rewards')
            .update({
              stripe_balance_transaction_id: tx.id,
              applied_at:                    new Date().toISOString(),
            })
            .eq('id', reward.id)

          results.rewarded++
          console.log(`[cron/referral] Premio pending applicato — reward=${reward.id}`)
        } catch (err) {
          console.warn(`[cron/referral] Pending reward ${reward.id} failed:`, err)
        }
      }
    }
  } catch (err) {
    console.warn('[cron/referral] Pending rewards check failed:', err)
  }

  console.log('[cron/referral] Completato:', results)
  return NextResponse.json({ success: true, ...results })
}
