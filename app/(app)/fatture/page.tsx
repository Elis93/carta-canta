import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FileCheck2, Inbox, Download, Plus } from 'lucide-react'
import { AdvancedFilters } from '../preventivi/_components/AdvancedFilters'

export const metadata = { title: 'Fatture' }

const STATUS_LABEL: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft:    { label: 'Bozza',     variant: 'secondary' },
  sent:     { label: 'Inviata',   variant: 'default' },
  accepted: { label: 'Pagata',    variant: 'outline' },
  rejected: { label: 'Annullata', variant: 'destructive' },
  expired:  { label: 'Scaduta',   variant: 'destructive' },
}

interface Props {
  searchParams: Promise<{ date_from?: string; date_to?: string; amount_min?: string; amount_max?: string }>
}

export default async function FatturePage({ searchParams }: Props) {
  const { date_from, date_to, amount_min, amount_max } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) redirect('/login')

  let query = supabase
    .from('documents')
    .select('id, doc_number, title, status, total, currency, created_at, clients(id, name)')
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'fattura')
    .order('created_at', { ascending: false })

  if (date_from && /^\d{4}-\d{2}-\d{2}$/.test(date_from))
    query = query.gte('created_at', `${date_from}T00:00:00.000Z`)
  if (date_to && /^\d{4}-\d{2}-\d{2}$/.test(date_to))
    query = query.lte('created_at', `${date_to}T23:59:59.999Z`)
  if (amount_min && !isNaN(Number(amount_min)))
    query = query.gte('total', Number(amount_min))
  if (amount_max && !isNaN(Number(amount_max)))
    query = query.lte('total', Number(amount_max))

  const hasFilters = !!(date_from || date_to || amount_min || amount_max)
  if (!hasFilters) query = query.limit(100)

  const { data: fatture } = await query

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <FileCheck2 className="size-6 text-primary" />
          <div>
            <h1 className="text-2xl font-semibold">Fatture</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {fatture?.length ?? 0} fatture totali
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <AdvancedFilters basePath="/fatture" />
          <Button variant="outline" size="sm" asChild>
            <a href="/api/fatture/export-csv" download>
              <Download className="size-4" />
              <span className="hidden sm:inline">Esporta CSV</span>
            </a>
          </Button>
          <Button size="sm" asChild>
            <Link href="/fatture/nuovo">
              <Plus className="size-4" />
              Nuova fattura
            </Link>
          </Button>
        </div>
      </div>

      {!fatture || fatture.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Inbox className="size-12 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            Nessuna fattura ancora.<br />
            Converti un preventivo accettato in fattura per iniziare.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/preventivi?status=accepted">Vai ai preventivi accettati →</Link>
          </Button>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border bg-card overflow-hidden">
          {fatture.map((ft) => {
            const client = ft.clients as { id: string; name: string } | null
            const s = STATUS_LABEL[ft.status] ?? STATUS_LABEL['draft']!

            return (
              <Link
                key={ft.id}
                href={`/fatture/${ft.id}`}
                className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors group"
              >
                <FileCheck2 className="size-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-sm group-hover:text-primary transition-colors shrink-0">
                      {ft.doc_number ?? '—'}
                    </span>
                    {ft.title && (
                      <span className="text-sm text-muted-foreground truncate">{ft.title}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                    {client && <span>{client.name}</span>}
                    {client && <span>·</span>}
                    <span>
                      {new Date(ft.created_at!).toLocaleDateString('it-IT', {
                        day: '2-digit', month: 'short', year: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="font-semibold">
                    €{(ft.total ?? 0).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                  </span>
                  <Badge variant={s.variant} className="text-xs">{s.label}</Badge>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
