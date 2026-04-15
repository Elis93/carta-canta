import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ClientForm } from '../_components/ClientForm'
import { DeleteClientButton } from '../_components/DeleteClientButton'
import {
  Mail, Phone, MapPin, Building2, FileText,
  ArrowLeft, Plus, Hash,
} from 'lucide-react'

const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft:    { label: 'Bozza',     variant: 'secondary' },
  sent:     { label: 'Inviato',   variant: 'default' },
  accepted: { label: 'Accettato', variant: 'outline' },
  rejected: { label: 'Rifiutato', variant: 'destructive' },
  expired:  { label: 'Scaduto',   variant: 'destructive' },
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function ClienteDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) redirect('/login')

  const { data: client } = await supabase
    .from('clients')
    .select('*')
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .maybeSingle()

  if (!client) notFound()

  const { data: documents } = await supabase
    .from('documents')
    .select('id, title, status, total, currency, doc_number, created_at')
    .eq('client_id', id)
    .eq('workspace_id', workspace.id)
    .order('created_at', { ascending: false })
    .limit(20)

  const infoItems = [
    { icon: Mail,     label: 'Email',           value: client.email },
    { icon: Phone,    label: 'Telefono',         value: client.phone },
    { icon: Building2,label: 'Partita IVA',      value: client.piva },
    { icon: Hash,     label: 'Codice fiscale',   value: client.codice_fiscale },
    {
      icon: MapPin,
      label: 'Indirizzo',
      value: [client.indirizzo, client.cap, client.citta, client.provincia]
        .filter(Boolean)
        .join(', ') || null,
    },
  ].filter((i) => i.value)

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/clienti" className="flex items-center gap-1 hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Clienti
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">{client.name}</span>
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="size-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-lg font-bold text-primary">
              {client.name[0]?.toUpperCase()}
            </span>
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{client.name}</h1>
            <p className="text-xs text-muted-foreground">
              Cliente dal {formatDate(client.created_at!)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/preventivi/nuovo?client=${id}`}>
              <Plus className="size-4" /> Nuovo preventivo
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid md:grid-cols-5 gap-4">
        {/* Info + Edit */}
        <div className="md:col-span-2 space-y-4">
          {infoItems.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Informazioni</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {infoItems.map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex items-start gap-2 text-sm">
                    <Icon className="size-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="truncate">{value}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {client.notes && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Note</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-line text-muted-foreground">
                  {client.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Preventivi del cliente */}
        <div className="md:col-span-3 space-y-4">
          <Card>
            <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="size-4" />
                Preventivi ({documents?.length ?? 0})
              </CardTitle>
              <Button asChild variant="ghost" size="sm">
                <Link href={`/preventivi/nuovo?client=${id}`}>
                  <Plus className="size-3.5" /> Nuovo
                </Link>
              </Button>
            </CardHeader>
            <CardContent>
              {documents && documents.length > 0 ? (
                <div className="divide-y">
                  {documents.map((doc) => {
                    const s = STATUS_LABEL[doc.status] ?? { label: doc.status, variant: 'secondary' as const }
                    return (
                      <Link
                        key={doc.id}
                        href={`/preventivi/${doc.id}`}
                        className="flex items-center justify-between py-2.5 gap-3 hover:bg-muted/50 rounded px-1 -mx-1 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{doc.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {doc.doc_number && <span className="font-mono mr-2">{doc.doc_number}</span>}
                            {formatDate(doc.created_at!)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-medium">
                            {formatCurrency(doc.total)}
                          </span>
                          <Badge variant={s.variant} className="text-xs">{s.label}</Badge>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Nessun preventivo per questo cliente.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Separator />

      {/* Modifica dati */}
      <div>
        <h2 className="text-base font-semibold mb-4">Modifica dati</h2>
        <ClientForm mode="edit" clientId={id} defaultValues={client} />
      </div>

      <Separator />

      {/* Zona pericolosa */}
      <div className="flex items-center justify-between gap-4 py-2">
        <div>
          <p className="text-sm font-medium">Elimina cliente</p>
          <p className="text-xs text-muted-foreground">
            I preventivi esistenti non vengono eliminati.
          </p>
        </div>
        <DeleteClientButton clientId={id} clientName={client.name} />
      </div>
    </div>
  )
}
