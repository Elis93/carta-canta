// GET /api/cron/referral
// Eseguito il 1° di ogni mese alle 09:00 UTC dal cron Vercel.
// Protetto da CRON_SECRET.
//
// Logica (modello mensile ricorrente — migration 020):
//   Per ogni workspace con piano Pro/Team attivo (referrer):
//     1. Conta quanti dei suoi referral sono "attivi questo mese":
//        - billing_interval = 'month' E piano pro/team attivo
//        - billing_interval = 'year'  E subscription_ends_at >= oggi
//     2. Se la soglia (MIN_ACTIVE_REFERRALS) è soddisfatta E non esiste già
//        un referral_rewards per (workspace_id, reward_month corrente):
//        → emette credito Customer Balance Stripe di €19
//        → inserisce referral_rewards con il reward_month corrente
//
// Il credito Stripe (Customer Balance negativo) si scala automaticamente
// dalla prossima fattura, sia mensile che annuale. Non si toccano le date
// della subscription né si generano proration.
//
// Premio pending: se il referrer non ha ancora stripe_customer_id (piano
// Free che non ha mai acquistato), salva applied_at = null e lo applica
// al prossimo giro mensile.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getStripe } from '@/lib/stripe/stripe'

const CREDIT_CENTS       = 1900 // €19 = 1 mese Pro
const MIN_ACTIVE_REFERRALS = 3  // soglia minima referral attivi per ottenere il premio

// ── Tipi locali ─────────────────────────────────────────────────────────────
// (referral_uses, referral_rewards, voice_usage non ancora in types/database.ts)

interface ReferralUseRow {
  referrer_workspace_id: string
  referee_workspace_id:  string
  code:                  string
}

interface RefereeWorkspaceRow {
  id:                   string
  plan:                 string
  billing_interval:     string | null
  subscription_ends_at: string | null
}

interface ReferrerWorkspaceRow {
  id:                string
  stripe_customer_id: string | null
  name:              string
}

interface PendingRewardRow {
  id:                  string
  workspace_id:        string
  credit_amount_cents: number
}

// ── Helper ───────────────────────────────────────────────────────────────────

/** Restituisce il reward_month del mese corrente in formato 'YYYY-MM' */
function currentRewardMonth(): string {
  const now = new Date()
  const y   = now.getUTCFullYear()
  const m   = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

/** True se il referee ha un piano Pro/Team attivo in questo mese */
function isRefereeActiveThisMonth(referee: RefereeWorkspaceRow, today: Date): boolean {
  if (!['pro', 'team'].includes(referee.plan)) return false

  if (referee.billing_interval === 'month') {
    // Subscription mensile attiva = piano pro/team (già verificato sopra)
    return true
  }

  if (referee.billing_interval === 'year' && referee.subscription_ends_at) {
    // Subscription annuale: è attiva se la scadenza è nel futuro
    return new Date(referee.subscription_ends_at) >= today
  }

  return false
}

// ── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const secret = request.headers.get('authorization')?.replace('Bearer ', '')
  // Fail-CLOSED: senza CRON_SECRET nell'env l'endpoint resta chiuso
  // (undefined !== undefined passerebbe — e qui si toccano premi/Stripe).
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Non autorizzato' }, { status: 401 })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin      = createAdminClient() as any
  const stripe     = getStripe()
  const rewardMonth = currentRewardMonth()
  const today       = new Date()

  const results = { checked: 0, rewarded: 0, pending: 0, skipped: 0, errors: 0 }

  // ── 1. Carica tutti i referral_uses ────────────────────────────────────────
  const { data: allUses, error: usesError } = await admin
    .from('referral_uses')
    .select('referrer_workspace_id, referee_workspace_id, code') as {
      data: ReferralUseRow[] | null
      error: unknown
    }

  if (usesError) {
    console.error('[cron/referral] Errore lettura referral_uses:', usesError)
    return NextResponse.json({ error: String(usesError) }, { status: 500 })
  }
  if (!allUses || allUses.length === 0) {
    return NextResponse.json({ success: true, ...results })
  }

  // ── 2. Raggruppa referee per referrer ──────────────────────────────────────
  const refereesByReferrer = new Map<string, string[]>()
  for (const use of allUses) {
    const list = refereesByReferrer.get(use.referrer_workspace_id) ?? []
    list.push(use.referee_workspace_id)
    refereesByReferrer.set(use.referrer_workspace_id, list)
  }

  const referrerIds = [...refereesByReferrer.keys()]
  const allRefereeIds = [...new Set(allUses.map((u) => u.referee_workspace_id))]

  results.checked = referrerIds.length

  // ── 3. Carica i dati dei referee (piano, billing_interval, scadenza) ───────
  const { data: refereeWorkspaces } = await admin
    .from('workspaces')
    .select('id, plan, billing_interval, subscription_ends_at')
    .in('id', allRefereeIds) as { data: RefereeWorkspaceRow[] | null }

  const refereeMap = new Map<string, RefereeWorkspaceRow>(
    (refereeWorkspaces ?? []).map((w) => [w.id, w])
  )

  // ── 4. Carica i premi già emessi per questo mese (evita duplicati) ─────────
  const { data: existingRewards } = await admin
    .from('referral_rewards')
    .select('workspace_id')
    .eq('reward_month', rewardMonth)
    .in('workspace_id', referrerIds) as { data: { workspace_id: string }[] | null }

  const alreadyRewardedThisMonth = new Set(
    (existingRewards ?? []).map((r) => r.workspace_id)
  )

  // ── 5. Carica i dati dei referrer (per stripe_customer_id) ────────────────
  const { data: referrerWorkspaces } = await admin
    .from('workspaces')
    .select('id, stripe_customer_id, name')
    .in('id', referrerIds) as { data: ReferrerWorkspaceRow[] | null }

  const referrerMap = new Map<string, ReferrerWorkspaceRow>(
    (referrerWorkspaces ?? []).map((w) => [w.id, w])
  )

  // ── 6. Per ogni referrer: conta referral attivi e decidi il premio ─────────
  for (const [referrerId, refereeIds] of refereesByReferrer) {
    // Se già premiato questo mese, salta
    if (alreadyRewardedThisMonth.has(referrerId)) {
      results.skipped++
      continue
    }

    // Conta referral attivi questo mese
    const activeCount = refereeIds.filter((refId) => {
      const referee = refereeMap.get(refId)
      return referee ? isRefereeActiveThisMonth(referee, today) : false
    }).length

    if (activeCount < MIN_ACTIVE_REFERRALS) {
      results.skipped++
      continue
    }

    // Soglia soddisfatta → emetti il premio
    const referrer = referrerMap.get(referrerId)
    if (!referrer) continue

    try {
      let txId:      string | null = null
      let appliedAt: string | null = null

      if (referrer.stripe_customer_id) {
        const tx = await stripe.customers.createBalanceTransaction(
          referrer.stripe_customer_id,
          {
            amount:      -CREDIT_CENTS,
            currency:    'eur',
            description: `Referral bonus ${rewardMonth} — 1 mese Pro gratuito`,
          }
        )
        txId      = tx.id
        appliedAt = new Date().toISOString()
        results.rewarded++
      } else {
        // Referrer senza Stripe (piano Free): salva pending, applicato al giro successivo
        results.pending++
      }

      await admin.from('referral_rewards').insert({
        workspace_id:                  referrerId,
        // referee_workspace_id: campo obbligatorio (NOT NULL nella tabella) —
        // nel modello mensile un premio copre N referral, registriamo il primo attivo
        // come rappresentativo del gruppo per soddisfare il vincolo NOT NULL.
        referee_workspace_id: refereeIds.find((id) => {
          const r = refereeMap.get(id)
          return r ? isRefereeActiveThisMonth(r, today) : false
        }) ?? refereeIds[0],
        reward_month:                  rewardMonth,
        free_months:                   1,
        credit_amount_cents:           CREDIT_CENTS,
        stripe_balance_transaction_id: txId,
        applied_at:                    appliedAt,
      })

      console.log(
        `[cron/referral] ${appliedAt ? 'Premio applicato' : 'Premio pending'} — ` +
        `referrer=${referrerId} mese=${rewardMonth} referral_attivi=${activeCount}`
      )
    } catch (err) {
      console.error(`[cron/referral] Errore per referrer ${referrerId}:`, err)
      results.errors++
    }
  }

  // ── 7. Tenta di applicare i premi pending (referrer ora con stripe_customer_id) ──
  try {
    const { data: pendingRewards } = await admin
      .from('referral_rewards')
      .select('id, workspace_id, credit_amount_cents')
      .is('applied_at', null)
      .is('stripe_balance_transaction_id', null) as { data: PendingRewardRow[] | null }

    if (pendingRewards && pendingRewards.length > 0) {
      const pendingIds = [...new Set(pendingRewards.map((r) => r.workspace_id))]
      const { data: nowWithStripe } = await admin
        .from('workspaces')
        .select('id, stripe_customer_id')
        .in('id', pendingIds)
        .not('stripe_customer_id', 'is', null) as {
          data: { id: string; stripe_customer_id: string }[] | null
        }

      const stripeIdMap = new Map(
        (nowWithStripe ?? []).map((w) => [w.id, w.stripe_customer_id])
      )

      for (const reward of pendingRewards) {
        const customerId = stripeIdMap.get(reward.workspace_id)
        if (!customerId) continue

        try {
          const tx = await stripe.customers.createBalanceTransaction(customerId, {
            amount:      -reward.credit_amount_cents,
            currency:    'eur',
            description: `Referral bonus — 1 mese Pro gratuito (pending applicato)`,
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
          console.warn(`[cron/referral] Pending reward ${reward.id} fallito:`, err)
        }
      }
    }
  } catch (err) {
    console.warn('[cron/referral] Controllo pending fallito:', err)
  }

  console.log(`[cron/referral] Completato ${rewardMonth}:`, results)
  return NextResponse.json({ success: true, rewardMonth, ...results })
}
