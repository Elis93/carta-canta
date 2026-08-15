import { redirect } from 'next/navigation'
import { Building2, Receipt, CreditCard, Bell } from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { HubShell } from '../altro/_components/HubShell'
import { MenuRow } from '../altro/_components/MenuRow'

export const metadata = { title: 'Impostazioni' }

// Impostazioni — ELENCO → sotto-pagine (Eli 15 ago, #8): niente più pillole in
// cima; le sezioni sono voci di un elenco che aprono la loro pagina, come gli
// hub di «Altro». Titoli riscritti per dire meglio cosa contengono.
export default async function ImpostazioniPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  // Compatibilità coi vecchi collegamenti a pillole (?tab=…): rimanda alla
  // sotto-pagina giusta, così segnalibri e link salvati non si rompono.
  if (tab === 'dati') redirect('/account')
  if (tab === 'piano') redirect('/abbonamento')
  if (tab === 'generale') redirect('/impostazioni/generale')
  if (tab === 'fiscale') redirect('/impostazioni/fiscale')
  if (tab === 'pagamenti') redirect('/impostazioni/pagamenti')
  if (tab === 'notifiche') redirect('/impostazioni/notifiche')

  const { user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/login')

  return (
    <HubShell title="Impostazioni">
      <MenuRow href="/impostazioni/generale" icon={Building2} label="Dati dell’attività" desc="Ragione sociale, indirizzo, logo, validità e acconto" descAlways />
      <MenuRow href="/impostazioni/fiscale" icon={Receipt} label="Dati fiscali" desc="Regime, codice ATECO, IVA e trasmissione allo SdI" descAlways />
      <MenuRow href="/impostazioni/pagamenti" icon={CreditCard} label="Coordinate di pagamento" desc="IBAN, QR e note per farti pagare" descAlways />
      <MenuRow href="/impostazioni/notifiche" icon={Bell} label="Notifiche" desc="Email e avvisi nella campanella" descAlways last />
    </HubShell>
  )
}
