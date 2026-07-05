import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Crown, Sparkles } from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { getAiImportQuota, AI_IMPORT_PRO_MONTHLY } from '@/lib/ai/quota'
import { BackButton } from '@/components/shared/BackButton'
import { ImportWizard } from './_components/ImportWizard'

export const metadata = { title: 'Importa listino' }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'
const AI_IMPORT_ENABLED = process.env.NEXT_PUBLIC_AI_IMPORT_ENABLED === 'true'

export default async function ImportaListinoPage() {
  const { user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  if (!AI_IMPORT_ENABLED) redirect('/catalogo')

  const quota = await getAiImportQuota(workspace.id, workspace.plan)

  const header = (
    <div className="lg:hidden" style={{ background: '#fff', borderBottom: '0.5px solid #eeeeee', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
      <BackButton fallback="/catalogo" />
      <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: '#161616', textAlign: 'center' }}>Importa listino</span>
      <span style={{ width: 32 }} />
    </div>
  )

  // Quota esaurita → schermata "opzione A" (mai "riprova più tardi")
  if (!quota.allowed) {
    const showUpgrade = quota.reason === 'free_used' || quota.reason === 'tank_empty'
    return (
      <div className="max-w-3xl mx-auto">
        {header}
        <div style={{ margin: '14px 15px 0', background: '#fff', borderLeft: '3px solid #c9a44c', borderRadius: 14, boxShadow: SH, padding: '16px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Sparkles size={19} style={{ color: '#b08d3e', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}>Importa il tuo listino</div>
              <div style={{ fontSize: 12, color: '#767676', marginTop: 2, lineHeight: 1.5 }}>
                {showUpgrade
                  ? <>Hai finito gli import gratuiti. <b>Con Pro importi quando vuoi.</b></>
                  : `Hai usato i ${AI_IMPORT_PRO_MONTHLY} import di questo mese. Si ricaricano il mese prossimo.`}
              </div>
            </div>
          </div>
          {showUpgrade && (
            <Link
              href="/abbonamento"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 44, borderRadius: 12, background: '#1a1a2e', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', marginTop: 12 }}
            >
              <Crown size={15} style={{ color: 'var(--cc-gold)' }} /> Passa a Pro
            </Link>
          )}
        </div>
        <div style={{ height: 16 }} />
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto">
      {header}
      <ImportWizard
        isPro={quota.isPro}
        remaining={quota.remaining}
        proMonthly={AI_IMPORT_PRO_MONTHLY}
      />
    </div>
  )
}
