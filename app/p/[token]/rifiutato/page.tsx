import { notFound } from 'next/navigation'
import { XCircle } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'

export default async function RifiutatoPage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  // Verifica che il documento esista ed è rifiutato
  const { data: doc } = await admin
    .from('documents')
    .select(`
      title,
      doc_type,
      rejection_reason,
      workspaces!workspace_id (
        ragione_sociale,
        name,
        piva
      )
    `)
    .eq('public_token', token)
    .eq('status', 'rejected')
    .maybeSingle()

  if (!doc) notFound()

  const workspace = doc.workspaces as {
    ragione_sociale: string | null
    name: string
    piva: string | null
  }

  const workspaceName = workspace.ragione_sociale ?? workspace.name
  const isPreventivo = (doc as Record<string, unknown>).doc_type !== 'fattura'
  const docLabelCap = isPreventivo ? 'Preventivo' : 'Fattura'

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header brand */}
      <header className="bg-white border-b px-4 py-3">
        <div className="max-w-3xl mx-auto">
          <span className="text-sm text-muted-foreground">
            {docLabelCap} gestit{isPreventivo ? 'o' : 'a'} con{' '}
            <a href="https://cartacanta.app" className="font-medium text-foreground hover:underline">
              Carta Canta
            </a>
          </span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <div className="max-w-md w-full text-center space-y-6">

          {/* Icona rifiuto */}
          <div className="flex justify-center">
            <div className="size-20 rounded-full bg-red-100 flex items-center justify-center">
              <XCircle className="size-10 text-red-500" />
            </div>
          </div>

          {/* Titolo */}
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {isPreventivo ? 'Preventivo rifiutato' : 'Fattura annullata'}
            </h1>
            <p className="text-muted-foreground mt-2 leading-relaxed">
              {isPreventivo
                ? <>{`Hai rifiutato il preventivo di `}<strong>{workspaceName}</strong>{`. L'artigiano è stato notificato.`}</>
                : <>{`La fattura di `}<strong>{workspaceName}</strong>{` è stata annullata.`}</>
              }
            </p>
          </div>

          {/* Riepilogo */}
          <div className="bg-white rounded-xl border p-5 text-left space-y-3">
            <div className="text-sm">
              <span className="text-muted-foreground">{docLabelCap}</span>
              <p className="font-medium mt-0.5">{doc.title}</p>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Inviato da</span>
              <p className="font-medium mt-0.5">{workspaceName}</p>
              {workspace.piva && (
                <p className="text-xs text-muted-foreground">P.IVA {workspace.piva}</p>
              )}
            </div>
            {doc.rejection_reason && (
              <div className="text-sm">
                <span className="text-muted-foreground">Motivo indicato</span>
                <p className="mt-0.5 text-foreground leading-relaxed">{doc.rejection_reason}</p>
              </div>
            )}
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">
            {isPreventivo
              ? <>Hai cambiato idea? Contatta direttamente <strong>{workspaceName}</strong> per richiedere un nuovo preventivo.</>
              : <>Per chiarimenti contatta direttamente <strong>{workspaceName}</strong>.</>
            }
          </p>

          <p className="text-xs text-muted-foreground">
            Hai ricevuto quest{isPreventivo ? 'o' : 'a'} {isPreventivo ? 'preventivo' : 'fattura'} tramite{' '}
            <a href="https://cartacanta.app" className="underline hover:text-foreground">
              Carta Canta
            </a>
          </p>

        </div>
      </main>
    </div>
  )
}
