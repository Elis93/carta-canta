import { redirect } from 'next/navigation'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { HubShell } from '../../altro/_components/HubShell'
import { DatiSections } from '../_components/DatiSections'

export const metadata = { title: 'Indirizzo e accesso' }

export default async function AccountAccessoPage() {
  const { user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')
  return (
    <HubShell title="Indirizzo e accesso" back="/account" card={false}>
      <DatiSections section="account" userEmail={user.email ?? ''} />
    </HubShell>
  )
}
