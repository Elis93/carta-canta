import { BookOpen, Calculator, LayoutTemplate } from 'lucide-react'
import { HubShell } from '../_components/HubShell'
import { MenuRow } from '../_components/MenuRow'

export const metadata = { title: 'Catalogo e strumenti' }

export default function CatalogoStrumentiPage() {
  return (
    <HubShell title="Catalogo e strumenti">
      <MenuRow href="/catalogo" icon={BookOpen}       label="Catalogo e listini" desc="Le tue voci e i listini dei fornitori" descAlways />
      <MenuRow href="/calcoli"  icon={Calculator}     label="Calcoli" desc="Metri quadri, piastrelle, resa…" descAlways />
      <MenuRow href="/template" icon={LayoutTemplate} label="Template documenti" desc="L'aspetto di preventivi e fatture" descAlways last />
    </HubShell>
  )
}
