import { redirect } from 'next/navigation'
import { Crown, Gift } from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { HubShell } from '../_components/HubShell'
import { MenuRow } from '../_components/MenuRow'

export const metadata = { title: 'Abbonamento e inviti' }

export default async function AbbonamentoInvitiPage() {
  const { user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')
  const isFree = workspace.plan === 'free'

  return (
    <HubShell title="Abbonamento e inviti">
      <MenuRow
        href="/abbonamento"
        icon={Crown}
        iconColor="var(--cc-gold)"
        label="Abbonamento"
        desc="Il tuo piano, fatturazione, passa a Pro"
        descAlways
        hint={isFree ? (
          <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--cc-navy)' }}>Passa a Pro</span>
        ) : undefined}
      />
      <MenuRow
        href="/referral"
        icon={Gift}
        label="Porta un amico"
        desc="Invita altri artigiani e ottieni premi sull'abbonamento"
        descAlways
        last
      />
    </HubShell>
  )
}
