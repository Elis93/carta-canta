import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { SearchBar } from '@/components/shared/SearchBar'
import { Users, Plus, Phone, Mail, ChevronRight, AlertTriangle } from 'lucide-react'

interface Props {
  searchParams: Promise<{ q?: string }>
}

// ── Rilevamento email duplicate ────────────────────────────────
async function getDuplicateEmailGroups(workspaceId: string) {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('id, name, surname, email')
    .eq('workspace_id', workspaceId)
    .not('email', 'is', null)
    .limit(500)

  if (!data) return []

  // Raggruppa per email
  const map = new Map<string, { id: string; name: string; surname: string | null }[]>()
  for (const c of data) {
    if (!c.email) continue
    const existing = map.get(c.email) ?? []
    existing.push({ id: c.id, name: c.name, surname: c.surname })
    map.set(c.email, existing)
  }

  return Array.from(map.entries())
    .filter(([, cs]) => cs.length > 1)
    .map(([email, contacts]) => ({ email, contacts }))
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
          className="flex items-center gap-3 py-3 px-1 hover:bg-muted/50 active:bg-muted/50 rounded-lg -mx-1 transition-colors cursor-pointer"
        >
          <div
            className="size-10 rounded-full flex items-center justify-center shrink-0 text-base font-medium"
            style={{ background: '#f0efe9', color: 'var(--cc-navy)' }}
          >
            {c.name[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{c.name}</p>
            <p className="text-xs truncate mt-0.5" style={{ color: 'var(--cc-text-2)' }}>
              {[c.email ?? c.phone, c.citta].filter(Boolean).join(' · ')}
            </p>
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

  // Recupera workspace per il banner duplicati
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let workspace = await supabase
    .from('workspaces').select('id').eq('owner_id', user.id).maybeSingle()
    .then(r => r.data)
  if (!workspace) {
    const membership = await supabase
      .from('workspace_members').select('workspace_id')
      .eq('user_id', user.id).not('accepted_at', 'is', null).limit(1).maybeSingle()
      .then(r => r.data)
    if (membership) {
      workspace = await supabase
        .from('workspaces').select('id').eq('id', membership.workspace_id).maybeSingle()
        .then(r => r.data)
    }
  }
  if (!workspace) redirect('/login')

  const duplicateGroups = await getDuplicateEmailGroups(workspace.id)

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Users className="size-6 text-primary shrink-0 hidden lg:block" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">Clienti</h1>
            <p className="text-muted-foreground text-sm mt-0.5 hidden lg:block">Rubrica clienti del tuo workspace.</p>
          </div>
        </div>
        {/* Desktop: button in header */}
        <Button asChild className="hidden lg:flex">
          <Link href="/clienti/nuovo">
            <Plus className="size-4" /> Nuovo cliente
          </Link>
        </Button>
      </div>

      {/* ── Banner email duplicate ────────────────────────────── */}
      {duplicateGroups.length > 0 && (
        <div className="rounded-lg border border-yellow-300 bg-yellow-50 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2 text-yellow-800">
            <AlertTriangle className="size-4 shrink-0" />
            <p className="text-sm font-medium">
              {duplicateGroups.length === 1
                ? 'Ci sono 2 contatti che condividono la stessa email'
                : `Ci sono ${duplicateGroups.length} gruppi di contatti con email in comune`}
            </p>
          </div>
          <ul className="space-y-1 pl-6">
            {duplicateGroups.map(({ email, contacts }) => (
              <li key={email} className="text-xs text-yellow-800">
                <span className="font-medium">{email}</span>
                {' '}— usata da:{' '}
                {contacts.map((c, i) => (
                  <span key={c.id}>
                    {i > 0 && ', '}
                    <Link
                      href={`/clienti/${c.id}`}
                      className="underline underline-offset-2 hover:text-yellow-900"
                    >
                      {c.name}{c.surname ? ` ${c.surname}` : ''}
                    </Link>
                  </span>
                ))}
              </li>
            ))}
          </ul>
        </div>
      )}

      <SearchBar placeholder="Cerca per nome, email, telefono…" defaultValue={q} />

      {/* Mobile: "Nuovo cliente" full-width navy */}
      <Link
        href="/clienti/nuovo"
        className="lg:hidden flex items-center justify-center gap-2 rounded-[9px] py-3 text-sm font-medium text-white"
        style={{ background: 'var(--cc-navy)', boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)' }}
      >
        <Plus className="size-4" /> Nuovo cliente
      </Link>

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
