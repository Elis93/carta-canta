import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ArrowLeft, CalendarClock, CheckCircle2 } from 'lucide-react'
import { formatDocNumber } from '@/lib/utils'
import { Card, CardContent } from '@/components/ui/card'
import { PendingDocCard } from '@/app/(app)/dashboard/_components/PendingDocCard'

export default async function ScadenzePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Workspace
  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, ragione_sociale')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .limit(1)
      .maybeSingle()
    if (membership) {
      const { data: mw } = await supabase
        .from('workspaces')
        .select('id, name, ragione_sociale')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }
  if (!workspace) redirect('/onboarding')

  const now = new Date()

  // Tutti i preventivi inviati/visti non ancora risposti, ordinati per scadenza più vicina
  const { data: expiringDocs } = await supabase
    .from('documents')
    .select('id, doc_number, title, total, sent_at, last_reminder_at, client_id, expires_at')
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'preventivo')
    .in('status', ['sent', 'viewed'])
    .is('deleted_at', null)
    .order('expires_at', { ascending: true, nullsFirst: false })

  // Per ogni documento recupera i dati del cliente
  type DocWithClient = {
    documentId: string
    docNumber: string | null
    title: string | null
    total: number | null
    sentAt: string | null
    lastReminderAt: string | null
    expiresAt: string | null
    clientName: string | null
    clientEmail: string | null
    clientPhone: string | null
  }

  const docsWithClients: DocWithClient[] = []

  for (const doc of expiringDocs ?? []) {
    let clientName: string | null = null
    let clientEmail: string | null = null
    let clientPhone: string | null = null

    if (doc.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('name, email, phone')
        .eq('id', doc.client_id)
        .maybeSingle()
      clientName  = client?.name ?? null
      clientEmail = client?.email ?? null
      clientPhone = client?.phone ?? null
    }

    docsWithClients.push({
      documentId:     doc.id,
      docNumber:      doc.doc_number ? doc.doc_number.replace(/^[A-Za-z]+/, '') : null,
      title:          doc.title,
      total:          doc.total,
      sentAt:         doc.sent_at,
      lastReminderAt: doc.last_reminder_at,
      expiresAt:      doc.expires_at ?? null,
      clientName,
      clientEmail,
      clientPhone,
    })
  }

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Dashboard
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">Preventivi in attesa</span>
      </div>

      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarClock className="size-6 text-amber-500" />
          Preventivi in attesa
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tutti i preventivi inviati in attesa di risposta, ordinati per scadenza più vicina.
        </p>
      </div>

      {docsWithClients.length > 0 ? (
        <div className="space-y-3">
          {docsWithClients.map((doc) => {
            const expiresDate = doc.expiresAt ? new Date(doc.expiresAt) : null
            const daysLeft = expiresDate
              ? Math.ceil((expiresDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
              : null

            // Colore bordo/sfondo card: rosso se scade oggi/domani, ambra se entro 7gg, neutro altrimenti
            const cardClass =
              daysLeft !== null && daysLeft <= 1
                ? 'border-red-200 bg-red-50/40'
                : daysLeft !== null && daysLeft <= 7
                ? 'border-amber-200 bg-amber-50/30'
                : ''

            return (
              <Card key={doc.documentId} className={cardClass}>
                <CardContent className="pt-4 pb-4">
                  {expiresDate && daysLeft !== null && (
                    <div
                      className="flex items-center gap-2 text-xs font-medium mb-3 tabular-nums"
                      style={{ color: daysLeft <= 1 ? '#dc2626' : daysLeft <= 7 ? '#d97706' : '#6b7280' }}
                    >
                      <CalendarClock className="size-3.5" />
                      {daysLeft <= 0
                        ? 'Scade oggi'
                        : daysLeft === 1
                        ? 'Scade domani'
                        : `Scade tra ${daysLeft} giorni`}
                      {' '}—{' '}
                      {expiresDate.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </div>
                  )}
                  <PendingDocCard
                    documentId={doc.documentId}
                    docNumber={doc.docNumber}
                    title={doc.title}
                    total={doc.total}
                    sentAt={doc.sentAt}
                    lastReminderAt={doc.lastReminderAt}
                    clientName={doc.clientName}
                    clientEmail={doc.clientEmail}
                    clientPhone={doc.clientPhone}
                  />
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3 text-center">
            <CheckCircle2 className="size-10 text-green-500" />
            <p className="font-medium">Nessun preventivo in attesa</p>
            <p className="text-sm text-muted-foreground">
              Non ci sono preventivi inviati in attesa di risposta.
            </p>
            <Link href="/preventivi" className="text-sm text-primary hover:underline underline-offset-2 mt-1">
              Vedi tutti i preventivi →
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
