import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SearchBar } from '@/components/shared/SearchBar'
import { Users, Plus, Phone, Mail, ChevronRight } from 'lucide-react'

interface Props {
  searchParams: Promise<{ q?: string }>
}

async function ClientiList({ query }: { query: string }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
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
        .from('workspaces').select('id')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }
  if (!workspace) redirect('/login')

  let dbQuery = supabase
    .from('clients')
    .select('id, name, email, phone, citta, provincia, piva, created_at')
    .eq('workspace_id', workspace.id)
    .order('name', { ascending: true })

  if (query.trim()) {
    dbQuery = dbQuery.textSearch('search_vector', query, {
      type: 'websearch',
      config: 'italian',
    })
  }

  const { data: clients } = await dbQuery.limit(100)

  if (!clients || clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="size-12 rounded-full bg-muted flex items-center justify-center">
          <Users className="size-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">
          {query ? 'Nessun cliente trovato.' : 'Nessun cliente ancora.'}
        </p>
        {!query && (
          <Button asChild size="sm">
            <Link href="/clienti/nuovo">
              <Plus className="size-4" /> Aggiungi il primo cliente
            </Link>
          </Button>
        )}
      </div>
    )
  }

  return (
    <div className="divide-y">
      {clients.map((c) => (
        <Link
          key={c.id}
          href={`/clienti/${c.id}`}
          className="flex items-center gap-3 py-3 px-1 hover:bg-muted/50 rounded-lg -mx-1 transition-colors"
        >
          <div className="size-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-semibold text-primary">
              {c.name[0]?.toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{c.name}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
              {c.email && (
                <span className="flex items-center gap-1 truncate">
                  <Mail className="size-3 shrink-0" /> {c.email}
                </span>
              )}
              {c.phone && !c.email && (
                <span className="flex items-center gap-1">
                  <Phone className="size-3 shrink-0" /> {c.phone}
                </span>
              )}
              {c.citta && (
                <span className="shrink-0">
                  {c.citta}{c.provincia ? ` (${c.provincia})` : ''}
                </span>
              )}
            </div>
          </div>
          {c.piva && (
            <Badge variant="outline" className="text-xs font-mono shrink-0 hidden sm:flex">
              {c.piva}
            </Badge>
          )}
          <ChevronRight className="size-4 text-muted-foreground shrink-0" />
        </Link>
      ))}
    </div>
  )
}

export default async function ClientiPage({ searchParams }: Props) {
  const { q = '' } = await searchParams

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Clienti</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Rubrica clienti del tuo workspace.</p>
        </div>
        <Button asChild>
          <Link href="/clienti/nuovo">
            <Plus className="size-4" /> Nuovo cliente
          </Link>
        </Button>
      </div>

      <SearchBar placeholder="Cerca per nome, email, telefono…" defaultValue={q} />

      <Card>
        <CardContent className="px-4 py-2">
          <Suspense
            fallback={
              <div className="py-8 text-center text-sm text-muted-foreground">Caricamento…</div>
            }
          >
            <ClientiList query={q} />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  )
}
