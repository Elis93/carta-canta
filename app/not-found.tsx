import Link from 'next/link'
import { FileQuestion } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-muted/30 px-4 text-center">
      <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-6">
        <FileQuestion className="size-8 text-muted-foreground" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight mb-2">Pagina non trovata</h1>
      <p className="text-muted-foreground mb-8 max-w-sm">
        La pagina che cerchi non esiste o è stata spostata.
      </p>
      <Button asChild>
        <Link href="/dashboard">Torna alla dashboard</Link>
      </Button>
    </div>
  )
}
