import { redirect } from 'next/navigation'
import { UserRound } from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BackButton } from '@/components/shared/BackButton'
import { DatiSections } from './_components/DatiSections'

export const metadata = { title: 'Account e dati' }

// ============================================================
// Account e dati — era la tab "Dati" di Impostazioni (richiesta Eli
// 14 lug: la sesta tab schiacciava la barra su mobile). Raggiungibile
// da Altro › Account. Contiene anche "Rivedi il tutorial".
// ============================================================

export default async function AccountDatiPage() {
  const { user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── Header mobile — fascia bianca con riga oro ── */}
      <div
        className="lg:hidden flex items-center"
        style={{ background: '#fff', borderBottom: '2px solid #c9a44c', gap: 10, padding: '12px 15px' }}
      >
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Account e dati</span>
        <span style={{ width: 24 }} />
      </div>

      {/* ── Header desktop ── */}
      <div className="hidden lg:flex items-center gap-3 min-w-0 p-6 pb-0">
        <UserRound className="size-6 text-primary shrink-0" />
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold">Account e dati</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Esporta i tuoi dati, collega il commercialista, rivedi il tutorial.
          </p>
        </div>
      </div>

      <div className="px-[15px] py-[14px] lg:p-6">
        <DatiSections />
      </div>
    </div>
  )
}
