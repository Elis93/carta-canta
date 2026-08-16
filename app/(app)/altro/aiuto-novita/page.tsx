import { HelpCircle, Sparkles } from 'lucide-react'
import { HubShell } from '../_components/HubShell'
import { MenuRow } from '../_components/MenuRow'

export const metadata = { title: 'Aiuto e novità' }

export default function AiutoNovitaPage() {
  return (
    <HubShell title="Aiuto e novità">
      <MenuRow href="/aiuto"  icon={HelpCircle} label="Aiuto e contatti" desc="Domande frequenti, tutorial e come scriverci" descAlways />
      <MenuRow href="/novita" icon={Sparkles}   label="Novità" desc="Cosa c'è di nuovo nell'app" descAlways last />
    </HubShell>
  )
}
