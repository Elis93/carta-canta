import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  FileText,
  Plus,
  Users,
  TrendingUp,
  Clock,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  // Dati workspace
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, plan, ragione_sociale')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) redirect('/login')

  // KPI: ultimi documenti
  const { data: documents } = await supabase
    .from('documents')
    .select('id, title, status, total, currency, created_at, client_id')
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })
    .limit(5)

  // Conteggi per status
  const { data: counts } = await supabase
    .from('documents')
    .select('status')
    .eq('workspace_id', workspace.id)

  const totalDocs = counts?.length ?? 0
  const sentDocs = counts?.filter((d) => d.status === 'sent').length ?? 0
  const acceptedDocs = counts?.filter((d) => d.status === 'accepted').length ?? 0
  const draftDocs = counts?.filter((d) => d.status === 'draft').length ?? 0

  // Valore totale preventivi accettati
  const { data: acceptedDocs2 } = await supabase
    .from('documents')
    .select('total')
    .eq('workspace_id', workspace.id)
    .eq('status', 'accepted')

  const totalAccettato = acceptedDocs2?.reduce((s, d) => s + (d.total ?? 0), 0) ?? 0

  const fullName =
    user.user_metadata?.nome ||
    user.user_metadata?.full_name?.split(' ')[0] ||
    'Ciao'

  const statusLabel: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
    draft:    { label: 'Bozza',    variant: 'secondary' },
    sent:     { label: 'Inviato',  variant: 'default' },
    accepted: { label: 'Accettato', variant: 'outline' },
    rejected: { label: 'Rifiutato', variant: 'destructive' },
    expired:  { label: 'Scaduto',  variant: 'destructive' },
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">
      {/* Intestazione */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Ciao, {fullName} 👋</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {workspace.ragione_sociale ?? workspace.name}
          </p>
        </div>
        <Button asChild size="lg">
          <Link href="/preventivi/nuovo">
            <Plus />
            Nuovo preventivo
          </Link>
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <FileText className="size-3.5" />
              Totale preventivi
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{totalDocs}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <Clock className="size-3.5" />
              In attesa di risposta
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{sentDocs}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <CheckCircle2 className="size-3.5" />
              Accettati
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{acceptedDocs}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <TrendingUp className="size-3.5" />
              Valore accettato
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-2xl font-bold">{formatCurrency(totalAccettato)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Documenti recenti + Azioni rapide */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Ultimi preventivi */}
        <Card className="md:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Ultimi preventivi</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/preventivi">
                Vedi tutti
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {documents && documents.length > 0 ? (
              <div className="divide-y">
                {documents.map((doc) => {
                  const s = statusLabel[doc.status] ?? { label: doc.status, variant: 'secondary' as const }
                  return (
                    <div key={doc.id} className="flex items-center justify-between py-2.5 gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{doc.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(doc.created_at!).toLocaleDateString('it-IT')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-medium">{formatCurrency(doc.total)}</span>
                        <Badge variant={s.variant} className="text-xs">{s.label}</Badge>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                <FileText className="size-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Nessun preventivo ancora.</p>
                <Button asChild size="sm">
                  <Link href="/preventivi/nuovo">
                    <Plus />
                    Crea il primo
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Azioni rapide */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Azioni rapide</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/preventivi/nuovo">
                <Plus className="size-4" />
                Nuovo preventivo
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/clienti/nuovo">
                <Users className="size-4" />
                Aggiungi cliente
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/preventivi">
                <FileText className="size-4" />
                Tutti i preventivi
                {draftDocs > 0 && (
                  <Badge variant="secondary" className="ml-auto text-xs">
                    {draftDocs} bozz{draftDocs === 1 ? 'a' : 'e'}
                  </Badge>
                )}
              </Link>
            </Button>
            <Button variant="outline" className="justify-start" asChild>
              <Link href="/impostazioni">
                Completa profilo attività
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Banner upgrade (solo piano free) */}
      {workspace.plan === 'free' && totalDocs >= 7 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="font-medium text-sm">
                Hai creato {totalDocs} di 10 preventivi gratuiti.
              </p>
              <p className="text-xs text-muted-foreground">
                Passa a Pro per preventivi illimitati, AI import e nessun watermark.
              </p>
            </div>
            <Button asChild size="sm">
              <Link href="/abbonamento">Upgrade →</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
