import { redirect } from 'next/navigation'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { HubShell } from '../../altro/_components/HubShell'
import { DatiSections } from '../_components/DatiSections'

export const metadata = { title: 'I tuoi dati e commercialista' }

export default async function AccountDatiPage() {
  const { user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')
  return (
    <HubShell title="I tuoi dati e commercialista" back="/account" card={false}>
      <DatiSections section="dati" userEmail={user.email ?? ''} />
    </HubShell>
  )
}
