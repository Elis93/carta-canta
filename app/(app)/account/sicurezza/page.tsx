import { redirect } from 'next/navigation'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { HubShell } from '../../altro/_components/HubShell'
import { DatiSections } from '../_components/DatiSections'

export const metadata = { title: 'Sicurezza e blocco app' }

export default async function AccountSicurezzaPage() {
  const { user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')
  return (
    <HubShell title="Sicurezza e blocco app" back="/account" card={false}>
      <DatiSections section="sicurezza" userEmail={user.email ?? ''} />
    </HubShell>
  )
}
