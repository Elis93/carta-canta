import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { FileCheck2, Inbox, Download, Plus, FileInput } from 'lucide-react'
import { AdvancedFilters } from '../preventivi/_components/AdvancedFilters'
import { SearchBar } from '@/components/shared/SearchBar'
import { StatusBadge } from '../preventivi/_components/StatusBadge'
import { formatDocNumber } from '@/lib/utils'

export const metadata = { title: 'Fatture' }

interface Props {
  searchParams: Promise<{ q?: string; date_from?: string; date_to?: string; amount_min?: string; amount_max?: string }>
}

// Mapping keyword italiano → valore status (con prefisso per ricerca parziale)
const FATTURA_STATUS_KEYWORDS: Record<string, string | string[]> = {
  'bozza': 'draft', 'bozze': 'draft',
  'inviata': 'sent', 'inviato': 'sent', 'inviati': 'sent',
  'aperta': 'viewed', 'aperto': 'viewed',
  'pagata': 'accepted', 'pagato': 'accepted', 'pagati': 'accepted', 'pagamento': 'accepted',
  'annullata': 'rejected', 'annullato': 'rejected',
  'scaduta': 'expired', 'scaduto': 'expired',
}

export default async function FatturePage({ searchParams }: Props) {
  const { q, date_from, date_to, amount_min, amount_max } = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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

  let query = supabase
    .from('documents')
    .select('id, doc_number, title, status, total, currency, created_at, updated_after_send_at, clients(id, name)')
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'fattura')
    .is('deleted_at', null)
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

  if (q && q.length > 0) {
    const qLow = q.trim().toLowerCase()

    // Ricerca per stato: esatta poi prefisso (min 2 caratteri)
    let statusMatch: string | string[] | undefined = FATTURA_STATUS_KEYWORDS[qLow]
    if (!statusMatch && qLow.length >= 2) {
      for (const [keyword, value] of Object.entries(FATTURA_STATUS_KEYWORDS)) {
        if (keyword.startsWith(qLow)) {
          statusMatch = value
          break
        }
      }
    }

    if (statusMatch) {
      if (Array.isArray(statusMatch)) {
        query = query.in('status', statusMatch as ('sent' | 'viewed')[])
      } else {
        query = query.eq('status', statusMatch as 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired')
      }
    } else if (q.length > 1) {
      const pat = `%${q.trim()}%`

      // Cerca clienti per nome/cognome/email — query separata per evitare
      // problemi con i filtri embedded di PostgREST (non supportati in .or())
      const { data: matchingClients } = await supabase
        .from('clients')
        .select('id')
        .eq('workspace_id', workspace.id)
        .or(`name.ilike.${pat},surname.ilike.${pat},email.ilike.${pat},piva.ilike.${pat}`)
        .limit(30)
      const clientIds = (matchingClients ?? []).map((c) => c.id)

      // Cerca nelle descrizioni delle voci (document_items)
      const { data: matchingItems } = await supabase
        .from('document_items')
        .select('document_id')
        .ilike('description', pat)
        .limit(50)
      const itemDocIds = [...new Set((matchingItems ?? []).map((i) => i.document_id))]

      // Costruisci OR: numero, titolo, note, client ids, voci ids
      const orParts: string[] = [
        `doc_number.ilike.${pat}`,
        `title.ilike.${pat}`,
        `notes.ilike.${pat}`,
      ]
      if (clientIds.length > 0) {
        orParts.push(`client_id.in.(${clientIds.join(',')})`)
      }
      if (itemDocIds.length > 0) {
        orParts.push(`id.in.(${itemDocIds.join(',')})`)
      }

      query = query.or(orParts.join(','))
    }
  } else if (!hasFilters) {
    query = query.limit(100)
  }

  const { data: fatture } = await query

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4">
      {/* Riga 1: titolo + bottoni azione */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <FileCheck2 className="size-6 text-primary shrink-0" />
          <div>
            <h1 className="text-2xl font-semibold">Fatture</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              {fatture?.length ?? 0} fatture totali
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" asChild>
            <Link href="/fatture/nuovo?from=preventivo" title="Da preventivo">
              <FileInput className="size-4" />
              <span className="hidden sm:inline">Da preventivo</span>
            </Link>
          </Button>
          <Button size="sm" asChild>
            <Link href="/fatture/nuovo" title="Nuova fattura">
              <Plus className="size-4" />
              <span className="hidden sm:inline">Nuova fattura</span>
            </Link>
          </Button>
        </div>
      </div>

      {/* Riga 2: ricerca + filtri + esporta */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex-1 min-w-[160px] sm:max-w-xs">
          <SearchBar placeholder="Cerca per numero, cliente, stato, voce…" paramName="q" />
        </div>
        <AdvancedFilters basePath="/fatture" />
        <Button variant="outline" size="sm" asChild>
          <a href="/api/fatture/export-csv" download title="Esporta CSV">
            <Download className="size-4" />
            <span className="hidden sm:inline">Esporta CSV</span>
          </a>
        </Button>
      </div>

      {!fatture || fatture.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
          <Inbox className="size-12 text-muted-foreground/40" />
          <p className="text-muted-foreground text-sm">
            {q ? `Nessun risultato per "${q}"` : <>Nessuna fattura ancora.<br />Converti un preventivo accettato in fattura per iniziare.</>}
          </p>
          {!q && (
            <Button asChild variant="outline" size="sm">
              <Link href="/preventivi?status=accepted">Vai ai preventivi accettati →</Link>
            </Button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border rounded-lg border bg-card overflow-hidden">
          {fatture.map((ft) => {
            const client = ft.clients as { id: string; name: string } | null
            const isModified = !!(ft as Record<string, unknown>).updated_after_send_at

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
                      {formatDocNumber(ft.doc_number, 'fattura')}
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
                  {isModified && (
                    <span className="hidden sm:inline-flex items-center rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                      Modificato
                    </span>
                  )}
                  <StatusBadge status={ft.status as 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'} docType="fattura" showTooltip={false} />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
