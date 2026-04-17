import { notFound } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle2 } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { Button } from '@/components/ui/button'

interface Props {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'

export default async function GraziePage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  // Verifica che il documento esista ed è accettato
  const { data: doc } = await admin
    .from('documents')
    .select(`
      title,
      accepted_at,
      signer_name,
      workspaces!workspace_id (
        ragione_sociale,
        name,
        logo_url,
        piva,
        citta
      )
    `)
    .eq('public_token', token)
    .eq('status', 'accepted')
    .maybeSingle()

  if (!doc) notFound()

  const workspace = doc.workspaces as {
    ragione_sociale: string | null
    name: string
    logo_url: string | null
    piva: string | null
    citta: string | null
  }

  const workspaceName = workspace.ragione_sociale ?? workspace.name

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header brand */}
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <span className="text-sm text-muted-foreground">
            Preventivo gestito con{' '}
            <a href="https://cartacanta.it" className="font-medium text-foreground hover:underline">
              Carta Canta
            </a>
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center space-y-6">

          {/* Icona successo */}
          <div className="flex justify-center">
            <div className="size-20 rounded-full bg-green-100 flex items-center justify-center">
              <CheckCircle2 className="size-10 text-green-600" />
            </div>
          </div>

          {/* Titolo */}
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Preventivo accettato!
            </h1>
            <p className="text-muted-foreground mt-2 leading-relaxed">
              La tua accettazione è stata registrata.{' '}
              <strong>{workspaceName}</strong> ti contatterà presto per
              procedere con i lavori.
            </p>
          </div>

          {/* Riepilogo */}
          <div className="bg-white rounded-xl border p-5 text-left space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Preventivo</span>
              <p className="font-medium mt-0.5">{doc.title}</p>
            </div>
            {doc.signer_name && (
              <div className="text-sm">
                <span className="text-muted-foreground">Firmato da</span>
                <p className="font-medium mt-0.5">{doc.signer_name}</p>
              </div>
            )}
            {doc.accepted_at && (
              <div className="text-sm">
                <span className="text-muted-foreground">Accettato il</span>
                <p className="font-medium mt-0.5">
                  {new Date(doc.accepted_at).toLocaleDateString('it-IT', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  } as Intl.DateTimeFormatOptions)}
                </p>
              </div>
            )}
            <div className="text-sm">
              <span className="text-muted-foreground">Da</span>
              <p className="font-medium mt-0.5">{workspaceName}</p>
              {workspace.piva && (
                <p className="text-xs text-muted-foreground">P.IVA {workspace.piva}</p>
              )}
            </div>
          </div>

          {/* Torna al preventivo */}
          <Button variant="outline" asChild className="w-full">
            <Link href={`/p/${token}`}>
              Visualizza il preventivo
            </Link>
          </Button>

          <p className="text-xs text-muted-foreground">
            Hai ricevuto questo preventivo tramite{' '}
            <a href="https://cartacanta.it" className="underline hover:text-foreground">
              Carta Canta
            </a>
          </p>
        </div>
      </main>
    </div>
  )
}
