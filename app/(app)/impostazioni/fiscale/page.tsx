import { redirect } from 'next/navigation'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { HubShell } from '../../altro/_components/HubShell'
import { ImpostazioniFiscali } from '../tabs/fiscali'

export const metadata = { title: 'Dati fiscali' }

export default async function ImpostazioniFiscalePage() {
  const { user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/login')
  return (
    <HubShell title="Dati fiscali" back="/impostazioni" card={false}>
      <ImpostazioniFiscali workspace={workspace} />
    </HubShell>
  )
}
