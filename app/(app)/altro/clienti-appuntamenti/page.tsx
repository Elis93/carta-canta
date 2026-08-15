import { Users, CalendarDays, HardHat } from 'lucide-react'
import { HubShell } from '../_components/HubShell'
import { MenuRow } from '../_components/MenuRow'

export const metadata = { title: 'Clienti e appuntamenti' }

export default function ClientiAppuntamentiPage() {
  return (
    <HubShell title="Clienti e appuntamenti">
      <MenuRow href="/clienti"      icon={Users}        label="Clienti" desc="La tua rubrica" descAlways />
      <MenuRow href="/calendario"   icon={CalendarDays} label="Agenda appuntamenti" desc="Sopralluoghi e lavori della settimana" descAlways />
      <MenuRow href="/sopralluoghi" icon={HardHat}      label="Sopralluoghi" desc="Foto e appunti presi presso il cliente" descAlways last />
    </HubShell>
  )
}
