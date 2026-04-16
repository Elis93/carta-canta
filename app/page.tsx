import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  CheckCircle,
  Zap,
  Link2,
  Sparkles,
  ArrowRight,
} from 'lucide-react'

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className="flex min-h-svh flex-col bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="font-semibold tracking-tight">Carta Canta</span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/login">Accedi</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/signup">Prova gratis</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        {/* Hero */}
        <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 py-24 text-center">
          <Badge variant="secondary" className="text-xs">
            Per artigiani e freelance italiani
          </Badge>
          <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
            Preventivi professionali in pochi minuti
          </h1>
          <p className="max-w-xl text-lg text-muted-foreground">
            Crea, invia e fai firmare preventivi direttamente online. Carta
            Canta gestisce IVA, ritenute e regime forfettario al posto tuo.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button size="lg" asChild>
              <Link href="/signup">
                Inizia gratis
                <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/login">Hai già un account? Accedi</Link>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Nessuna carta di credito • 10 preventivi gratuiti
          </p>
        </section>

        {/* Features */}
        <section className="border-t bg-muted/30">
          <div className="mx-auto grid max-w-5xl gap-8 px-4 py-20 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<FileText className="h-5 w-5" />}
              title="Preventivi e fatture"
              description="Numerazione automatica, PDF scaricabile, gestione IVA e regimi fiscali italiani."
            />
            <FeatureCard
              icon={<Link2 className="h-5 w-5" />}
              title="Link pubblico"
              description="Invia un link al cliente: può accettare o rifiutare direttamente dal browser, senza app."
            />
            <FeatureCard
              icon={<Sparkles className="h-5 w-5" />}
              title="AI Import"
              description="Fotografa un preventivo cartaceo o carica un PDF: l'AI lo converte in bozza in secondi."
            />
            <FeatureCard
              icon={<Zap className="h-5 w-5" />}
              title="Template riutilizzabili"
              description="Salva le voci ricorrenti come template e riusale con un clic."
            />
          </div>
        </section>

        {/* Checklist + CTA */}
        <section className="mx-auto flex w-full max-w-5xl flex-col items-center gap-6 px-4 py-20 text-center">
          <div className="flex flex-col items-center gap-2">
            {[
              'Regime forfettario, ordinario e minimi',
              'Bollo virtuale e ritenuta d\'acconto automatici',
              'Accettazione digitale con firma cliente',
              'Nessuna installazione — funziona da browser',
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <CheckCircle className="h-4 w-4 shrink-0 text-primary" />
                {item}
              </div>
            ))}
          </div>
          <Button size="lg" className="mt-4" asChild>
            <Link href="/signup">
              Crea il tuo primo preventivo
              <ArrowRight className="ml-1 h-4 w-4" />
            </Link>
          </Button>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} Carta Canta</span>
          <div className="flex gap-4">
            <Link href="/login" className="hover:text-foreground">
              Accedi
            </Link>
            <Link href="/signup" className="hover:text-foreground">
              Registrati
            </Link>
          </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode
  title: string
  description: string
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <h3 className="font-semibold">{title}</h3>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  )
}
