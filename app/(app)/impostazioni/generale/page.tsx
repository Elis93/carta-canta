import { redirect } from 'next/navigation'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { HubShell } from '../../altro/_components/HubShell'
import { ImpostazioniGenerali } from '../tabs/generali'

export const metadata = { title: 'Dati dell’attività' }

export default async function ImpostazioniGeneralePage() {
  const { user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/login')
  return (
    <HubShell title="Dati dell’attività" back="/impostazioni" card={false}>
      <ImpostazioniGenerali workspace={workspace} />
    </HubShell>
  )
}
