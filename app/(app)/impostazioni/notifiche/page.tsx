import { redirect } from 'next/navigation'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { HubShell } from '../../altro/_components/HubShell'
import { ImpostazioniNotifiche } from '../tabs/notifiche'
import { extractNotifPrefs } from '../notif-prefs'

export const metadata = { title: 'Notifiche' }

export default async function ImpostazioniNotifichePage() {
  const { user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/login')
  const notifPrefs = extractNotifPrefs(workspace.notification_prefs as Record<string, unknown> | null)
  return (
    <HubShell title="Notifiche" back="/impostazioni" card={false}>
      <ImpostazioniNotifiche initialPrefs={notifPrefs} />
    </HubShell>
  )
}
