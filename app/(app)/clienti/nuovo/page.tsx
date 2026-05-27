import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ClientForm } from '../_components/ClientForm'

export default function NuovoClientePage() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/clienti" className="flex items-center gap-1 hover:text-foreground transition-colors">
          <ArrowLeft className="size-3.5" /> Clienti
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Nuovo cliente</span>
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Nuovo cliente</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Aggiungi un nuovo cliente alla tua rubrica.
        </p>
      </div>
      <ClientForm mode="create" />
    </div>
  )
}
