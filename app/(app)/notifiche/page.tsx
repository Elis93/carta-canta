import { redirect } from 'next/navigation'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { getAppNotifications } from '@/lib/notifications'
import { BackButton } from '@/components/shared/BackButton'
import { NotificationList } from './_components/NotificationList'

export const metadata = { title: 'Notifiche' }

export default async function NotifichePage() {
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  const notifications = await getAppNotifications(
    supabase,
    workspace.id,
    workspace.notification_prefs as Record<string, unknown> | null
  )

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header — fascia bianca */}
      <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/dashboard" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Notifiche</span>
        <span style={{ width: 24 }} />
      </div>

      <NotificationList notifications={notifications} />
      <div style={{ height: 16 }} />
    </div>
  )
}
