import { redirect } from 'next/navigation'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BackButton } from '@/components/shared/BackButton'
import { SopralluogoForm } from '../_components/SopralluogoForm'

export const metadata = { title: 'Nuovo sopralluogo' }

export default async function NuovoSopralluogoPage() {
  const { user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  return (
    <div className="max-w-3xl mx-auto">
      <div style={{ background: '#fff', borderBottom: '0.5px solid #eeeeee', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/sopralluoghi" />
        <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: '#161616', textAlign: 'center' }}>Sopralluogo</span>
        <span style={{ width: 32 }} />
      </div>
      <SopralluogoForm defaults={null} />
    </div>
  )
}
