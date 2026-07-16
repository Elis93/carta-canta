import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SearchBar } from '@/components/shared/SearchBar'
import { BackButton } from '@/components/shared/BackButton'
import { Users, Plus, ChevronRight, AlertTriangle } from 'lucide-react'

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

// Banner duplicati come componente async: carica in PARALLELO alla lista
// clienti (prima la pagina aspettava questa query prima di renderizzare).
async function DuplicateEmailBanner({ workspaceId }: { workspaceId: string }) {
  const duplicateGroups = await getDuplicateEmailGroups(workspaceId)
  if (duplicateGroups.length === 0) return null
  return (
    <div className="rounded-lg border border-[#e8d6ad] bg-[#f5e9d0] px-4 py-3 space-y-2">
      <div className="flex items-center gap-2 text-[#b0863e]">
        <AlertTriangle className="size-4 shrink-0" />
        <p className="text-sm font-medium">
          {duplicateGroups.length === 1
            ? 'Ci sono contatti che condividono la stessa email'
            : `Ci sono ${duplicateGroups.length} gruppi di contatti con email in comune`}
        </p>
      </div>
      <ul className="space-y-1 pl-6">
        {duplicateGroups.map(({ email, contacts }) => (
          <li key={email} className="text-xs text-[#b0863e]">
            <span className="font-medium">{email}</span>
            {' '}— usata da:{' '}
            {contacts.map((c, i) => (
              <span key={c.id}>
                {i > 0 && ', '}
                <Link
                  href={`/clienti/${c.id}`}
                  className="underline underline-offset-2 hover:text-[#8a6c33]"
                >
                  {c.name}{c.surname ? ` ${c.surname}` : ''}
                </Link>
              </span>
            ))}
          </li>
        ))}
      </ul>
    </div>
  )
}

async function ClientiList({ query }: { query: string }) {
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
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
    <div>
      {clients.map((c, idx) => (
        <Link
          key={c.id}
          href={`/clienti/${c.id}`}
          className="flex items-center gap-3 hover:bg-muted/30 active:bg-muted/30 transition-colors"
          style={{
            padding: '11px 0',
            borderBottom: idx < clients.length - 1 ? '0.5px solid #eee' : 'none',
          }}
        >
          <div
            className="rounded-full flex items-center justify-center shrink-0 font-semibold"
            style={{ width: 40, height: 40, background: '#f0efe9', color: '#1a1a2e', fontSize: 16 }}
          >
            {c.name[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate" style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}>{c.name}</p>
            <p className="truncate" style={{ fontSize: 12, color: 'var(--cc-muted)', marginTop: 2 }}>
              {[c.email ?? c.phone, c.citta].filter(Boolean).join(' · ')}
            </p>
          </div>
          <ChevronRight size={18} style={{ color: 'var(--cc-muted)', flexShrink: 0 }} />
        </Link>
      ))}
    </div>
  )
}

export default async function ClientiPage({ searchParams }: Props) {
  const { q = '' } = await searchParams

  // Recupera workspace per il banner duplicati
  const { user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/login')

  // PERF: il controllo duplicati NON blocca più la pagina — viene reso come
  // componente async in Suspense e carica in parallelo alla lista clienti.

  return (
    <div className="max-w-3xl mx-auto">
      {/* ── Fascia titolo bianca (mobile) ── */}
      <div
        className="lg:hidden cc-title-band"
        style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 10 }}
      >
        <BackButton fallback="/altro" />
        <h1 className="cc-page-title" style={{ fontSize: 22, margin: 0 }}>Clienti</h1>
      </div>

      <div className="p-4 md:p-6 space-y-5">
      {/* ── Header desktop ── */}
      <div className="hidden lg:flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Users className="size-6 text-primary shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold">Clienti</h1>
            <p className="text-muted-foreground text-sm mt-0.5">Rubrica clienti del tuo workspace.</p>
          </div>
        </div>
        {/* Desktop: button in header */}
        <Button asChild>
          <Link href="/clienti/nuovo">
            <Plus className="size-4" /> Nuovo cliente
          </Link>
        </Button>
      </div>

      {/* ── Banner email duplicate (carica in parallelo alla lista) ── */}
      <Suspense fallback={null}>
        <DuplicateEmailBanner workspaceId={workspace.id} />
      </Suspense>

      <SearchBar placeholder="Cerca per nome, email, telefono…" defaultValue={q} />

      {/* Mobile: "Nuovo cliente" full-width navy */}
      <Link
        href="/clienti/nuovo"
        className="lg:hidden flex items-center justify-center text-white"
        style={{ background: '#1a1a2e', borderRadius: 11, padding: 13, fontSize: 14, fontWeight: 600, gap: 8, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)' }}
      >
        <Plus size={18} /> Nuovo cliente
      </Link>

      <Card>
        <CardContent style={{ padding: '4px 15px' }}>
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
    </div>
  )
}
