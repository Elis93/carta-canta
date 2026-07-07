import { redirect } from 'next/navigation'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BackButton } from '@/components/shared/BackButton'
import { LavoroForm } from '../_components/LavoroForm'

export const metadata = { title: 'Nuovo lavoro' }

export default async function NuovoLavoroPage() {
  const { user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  return (
    <div className="max-w-3xl mx-auto">
      <div style={{ background: '#fff', borderBottom: '0.5px solid #eeeeee', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/lavori" />
        <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: '#161616' }}>Nuovo lavoro</span>
        <span style={{ width: 24 }} />
      </div>
      <LavoroForm defaults={null} />
    </div>
  )
}
