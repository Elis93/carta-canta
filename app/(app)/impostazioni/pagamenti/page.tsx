import { redirect } from 'next/navigation'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { HubShell } from '../../altro/_components/HubShell'
import { ImpostazioniPagamenti } from '../tabs/pagamenti'

export const metadata = { title: 'Coordinate di pagamento' }

export default async function ImpostazioniPagamentiPage() {
  const { user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/login')
  return (
    <HubShell title="Coordinate di pagamento" back="/impostazioni" card={false}>
      <ImpostazioniPagamenti workspace={workspace} />
    </HubShell>
  )
}
