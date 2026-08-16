import { redirect } from 'next/navigation'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BackButton } from '@/components/shared/BackButton'
import { Calcolatrice } from '@/components/calc/Calcolatrice'

export const metadata = { title: 'Calcoli' }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

export default async function CalcoliPage() {
  const { user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  return (
    <div className="max-w-2xl mx-auto">
      {/* Testata */}
      <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Calcoli</span>
        <span style={{ width: 24 }} />
      </div>

      <div style={{ padding: '15px' }}>
        <p style={{ fontSize: 13, color: 'var(--cc-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
          Due conti veloci di cantiere. Con &laquo;Copia&raquo; incolli il risultato dove vuoi; dentro un
          preventivo trovi lo stesso strumento accanto alla quantità.
        </p>
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '15px' }}>
          <Calcolatrice />
        </div>
      </div>

      <div style={{ height: 40 }} />
    </div>
  )
}
