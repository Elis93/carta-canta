import { notFound } from 'next/navigation'
import { Clock } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'

export default async function ScadutoPage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: doc } = await admin
    .from('documents')
    .select(`
      title,
      expires_at,
      workspaces!workspace_id (
        ragione_sociale,
        name,
        piva
      )
    `)
    .eq('public_token', token)
    .eq('status', 'expired')
    .maybeSingle()

  if (!doc) notFound()

  const workspace = doc.workspaces as {
    ragione_sociale: string | null
    name: string
    piva: string | null
  }

  const workspaceName = workspace.ragione_sociale ?? workspace.name

  const expiredAt = doc.expires_at
    ? new Date(doc.expires_at).toLocaleDateString('it-IT', {
        day: '2-digit', month: 'long', year: 'numeric',
      })
    : null

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

          {/* Icona scaduto */}
          <div className="flex justify-center">
            <div className="size-20 rounded-full bg-amber-100 flex items-center justify-center">
              <Clock className="size-10 text-amber-600" />
            </div>
          </div>

          {/* Titolo */}
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Preventivo scaduto
            </h1>
            <p className="text-muted-foreground mt-2 leading-relaxed">
              Il preventivo di <strong>{workspaceName}</strong> non è più
              valido{expiredAt ? `: è scaduto il ${expiredAt}` : ''}.
            </p>
          </div>

          {/* Riepilogo */}
          <div className="bg-white rounded-xl border p-5 text-left space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground">Preventivo</span>
              <p className="font-medium mt-0.5">{doc.title}</p>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Emesso da</span>
              <p className="font-medium mt-0.5">{workspaceName}</p>
              {workspace.piva && (
                <p className="text-xs text-muted-foreground">P.IVA {workspace.piva}</p>
              )}
            </div>
            {expiredAt && (
              <div className="text-sm">
                <span className="text-muted-foreground">Scaduto il</span>
                <p className="font-medium mt-0.5">{expiredAt}</p>
              </div>
            )}
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            Sei ancora interessato? Contatta direttamente{' '}
            <strong>{workspaceName}</strong> per richiedere un preventivo
            aggiornato.
          </p>

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
