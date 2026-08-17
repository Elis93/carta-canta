import { redirect } from 'next/navigation'
import { UserRound, ShieldCheck, Database, Crown, Gift } from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { HubShell } from '../altro/_components/HubShell'
import { MenuRow } from '../altro/_components/MenuRow'

export const metadata = { title: 'Account e abbonamento' }

// Account — ELENCO → sotto-pagine (Eli 15 ago, #8) + Abbonamento confluito qui
// (#11: «Abbonamento dentro Account»). Niente più pillole; le sezioni sono voci
// di un elenco che aprono la loro pagina, come gli hub di «Altro».
export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ sez?: string }>
}) {
  const { sez } = await searchParams
  // Compatibilità con le vecchie pillole (?sez=…)
  if (sez === 'sicurezza') redirect('/account/sicurezza')
  if (sez === 'dati') redirect('/account/dati')
  if (sez === 'account') redirect('/account/accesso')

  const { user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')
  const isFree = workspace.plan === 'free'

  return (
    <HubShell title="Account e abbonamento">
      <MenuRow href="/account/accesso" icon={UserRound} label="Indirizzo e accesso" desc="L’email con cui entri e l’eliminazione dell’account" descAlways />
      <MenuRow href="/account/sicurezza" icon={ShieldCheck} label="Sicurezza e blocco app" desc="Blocco con impronta ed esci da tutti i dispositivi" descAlways />
      <MenuRow href="/account/dati" icon={Database} label="I tuoi dati e commercialista" desc="Collega il tuo commercialista ai tuoi documenti · scarica i tuoi dati" descAlways />
      <MenuRow
        href="/abbonamento"
        icon={Crown}
        iconColor="var(--cc-gold)"
        label="Abbonamento"
        desc="Il tuo piano e la fatturazione"
        descAlways
        hint={isFree ? (
          // Pillola oro identica a quelle PRO di «Altro», accanto alla voce
          // (Eli, 17 ago: «affianco e non sotto»).
          <span style={{ display: 'inline-block', border: '1px solid #e8d6ad', color: '#b0863e', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 999, letterSpacing: '.03em', whiteSpace: 'nowrap' }}>Passa a Pro</span>
        ) : undefined}
      />
      <MenuRow href="/referral" icon={Gift} label="Porta un amico" desc="Invita altri artigiani e ottieni premi sull’abbonamento" descAlways last />
    </HubShell>
  )
}
