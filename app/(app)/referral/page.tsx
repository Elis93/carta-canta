import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { ReferralPageClient } from './_components/ReferralPageClient'

export const metadata = { title: 'Porta un amico — Carta Canta' }

export default async function ReferralPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Trova workspace
  let workspaceId: string | null = null
  let workspacePlan: string = 'free'
  let workspaceBillingInterval: string | null = null

  const { data: ws } = await supabase
    .from('workspaces')
    .select('id, plan, billing_interval')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (ws) {
    workspaceId = ws.id
    workspacePlan = ws.plan ?? 'free'
    workspaceBillingInterval = ws.billing_interval ?? null
  } else {
    const { data: m } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .limit(1)
      .maybeSingle()
    workspaceId = m?.workspace_id ?? null
  }

  if (!workspaceId) redirect('/login')

  // Le tabelle referral non sono nei tipi generati finché non si esegue supabase db push + codegen
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const adminDb = createAdminClient() as any

  // Codice referral (get or create tramite RPC admin — SECURITY DEFINER)
  const { data: code } = await adminDb.rpc('get_or_create_referral_code', {
    p_workspace_id: workspaceId,
  }) as { data: string | null }

  // Statistiche
  const [
    { data: uses },
    { data: rewards },
  ] = await Promise.all([
    db
      .from('referral_uses')
      .select('referee_workspace_id, used_at')
      .eq('referrer_workspace_id', workspaceId)
      .order('used_at', { ascending: false }) as Promise<{ data: Array<{ referee_workspace_id: string; used_at: string }> | null }>,
    db
      .from('referral_rewards')
      .select('free_months, applied_at, created_at')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false }) as Promise<{ data: Array<{ free_months: number; applied_at: string | null; created_at: string }> | null }>,
  ])

  const totalUses       = uses?.length ?? 0
  const totalRewards    = rewards?.length ?? 0
  const pendingRewards  = rewards?.filter((r) => !r.applied_at).length ?? 0
  const totalFreeMonths = rewards?.reduce((s, r) => s + r.free_months, 0) ?? 0

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'
  const shareUrl = code ? `${appUrl}/signup?ref=${code}` : null

  return (
    <ReferralPageClient
      code={code}
      shareUrl={shareUrl}
      totalUses={totalUses}
      totalRewards={totalRewards}
      pendingRewards={pendingRewards}
      totalFreeMonths={totalFreeMonths}
      plan={workspacePlan}
      billingInterval={workspaceBillingInterval}
    />
  )
}
