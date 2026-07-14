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
      <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/sopralluoghi" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Sopralluogo</span>
        <span style={{ width: 24 }} />
      </div>
      <SopralluogoForm defaults={null} />
    </div>
  )
}
