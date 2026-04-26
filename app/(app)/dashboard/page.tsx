import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { RevenueChart, type TrendPoint } from '@/components/dashboard/RevenueChart'
import {
  FileText,
  Plus,
  Users,
  Clock,
  CheckCircle2,
  ArrowRight,
  AlertTriangle,
  TrendingUp,
  CalendarClock,
  Send,
  XCircle,
  Timer,
  PenLine,
} from 'lucide-react'

// ── Tipi ────────────────────────────────────────────────────────────────────

type DocStatus = 'draft' | 'sent' | 'accepted' | 'rejected' | 'expired'

interface DocRow {
  id: string
  title: string
  doc_number: string | null
  status: DocStatus
  total: number | null
  created_at: string
  updated_at: string
  sent_at: string | null
  accepted_at: string | null
  expires_at: string | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcDelta(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null
  return ((current - previous) / previous) * 100
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function startOfPrevMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() - 1, 1)
}

const EVENT_ICON: Record<DocStatus, React.ReactNode> = {
  draft:    <PenLine className="size-3.5 text-gray-400" />,
  sent:     <Send className="size-3.5 text-blue-500" />,
  accepted: <CheckCircle2 className="size-3.5 text-green-500" />,
  rejected: <XCircle className="size-3.5 text-red-500" />,
  expired:  <Timer className="size-3.5 text-amber-500" />,
}

const EVENT_LABEL: Record<DocStatus, string> = {
  draft:    'Bozza salvata',
  sent:     'Preventivo inviato',
  accepted: 'Preventivo accettato',
  rejected: 'Preventivo rifiutato',
  expired:  'Preventivo scaduto',
}

const STATUS_BADGE: Record<DocStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  draft:    { label: 'Bozza',     variant: 'secondary' },
  sent:     { label: 'Inviato',   variant: 'default' },
  accepted: { label: 'Accettato', variant: 'outline' },
  rejected: { label: 'Rifiutato', variant: 'destructive' },
  expired:  { label: 'Scaduto',   variant: 'destructive' },
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Carica workspace — prima come owner, poi come membro invitato (Team plan).
  // Stesso pattern usato in app/(app)/layout.tsx per coerenza.
  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, plan, ragione_sociale')
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
      const { data: memberWorkspace } = await supabase
        .from('workspaces')
        .select('id, name, plan, ragione_sociale')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = memberWorkspace
    }
  }

  if (!workspace) redirect('/onboarding')

  const now = new Date()
  const thisMonthStart  = startOfMonth(now).toISOString()
  const prevMonthStart  = startOfPrevMonth(now).toISOString()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const tomorrow        = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const tomorrowStart   = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()).toISOString()
  const tomorrowEnd     = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 1).toISOString()

  // Tutti i documenti del workspace (per KPI e activity feed)
  const { data: allDocs } = await supabase
    .from('documents')
    .select('id, title, doc_number, status, total, created_at, updated_at, sent_at, accepted_at, expires_at')
    .eq('workspace_id', workspace.id)
    .order('updated_at', { ascending: false })

  const docs: DocRow[] = (allDocs ?? []) as DocRow[]

  // ── KPI: questo mese ──────────────────────────────────────────────────────
  const thisMonth = docs.filter(d => d.created_at >= thisMonthStart)
  const prevMonth = docs.filter(d => d.created_at >= prevMonthStart && d.created_at < thisMonthStart)

  const thisMonthCount  = thisMonth.length
  const prevMonthCount  = prevMonth.length
  const deltaCount      = calcDelta(thisMonthCount, prevMonthCount)

  const thisMonthValue  = thisMonth.reduce((s, d) => s + (d.total ?? 0), 0)
  const prevMonthValue  = prevMonth.reduce((s, d) => s + (d.total ?? 0), 0)
  const deltaValue      = calcDelta(thisMonthValue, prevMonthValue)

  // ── KPI: tasso di accettazione (su tutti i doc non-draft) ─────────────────
  const sentAll      = docs.filter(d => d.status !== 'draft')
  const acceptedAll  = docs.filter(d => d.status === 'accepted')
  const acceptRate   = sentAll.length > 0 ? (acceptedAll.length / sentAll.length) * 100 : null

  const sentAllPrev     = [...docs.filter(d => d.status !== 'draft' && d.created_at < thisMonthStart)]
  const acceptedPrev    = [...docs.filter(d => d.status === 'accepted' && d.created_at < thisMonthStart)]
  const prevAcceptRate  = sentAllPrev.length > 0 ? (acceptedPrev.length / sentAllPrev.length) * 100 : null
  const deltaAccept     = acceptRate !== null && prevAcceptRate !== null
    ? acceptRate - prevAcceptRate
    : null

  // ── KPI: in attesa di risposta ────────────────────────────────────────────
  const awaitingDocs = docs.filter(d => d.status === 'sent')

  // ── Activity feed: ultimi 10 eventi (non-draft) ───────────────────────────
  const feed = docs
    .filter(d => d.status !== 'draft')
    .slice(0, 10)

  // ── Alert: 14+ giorni senza risposta ─────────────────────────────────────
  const stale = docs.filter(d =>
    d.status === 'sent' &&
    (d.sent_at ?? d.created_at) < fourteenDaysAgo
  )

  // ── Alert: scade domani ───────────────────────────────────────────────────
  const expiringSoon = docs.filter(d =>
    d.status === 'sent' &&
    d.expires_at !== null &&
    d.expires_at >= tomorrowStart &&
    d.expires_at < tomorrowEnd
  )

  // ── Trend ultimi 6 mesi ───────────────────────────────────────────────────
  type TrendBucket = TrendPoint & { key: string }
  const trendBuckets: TrendBucket[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', ''),
      total: 0,
      count: 0,
    }
  })
  docs.forEach((doc) => {
    const key = doc.created_at.slice(0, 7)
    const m = trendBuckets.find((t) => t.key === key)
    if (m) { m.total += doc.total ?? 0; m.count++ }
  })
  const chartData: TrendPoint[] = trendBuckets.map(({ label, total, count }) => ({ label, total, count }))

  const fullName =
    user.user_metadata?.nome ||
    user.user_metadata?.full_name?.split(' ')[0] ||
    'Ciao'

  const draftDocs = docs.filter(d => d.status === 'draft').length

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

      {/* Header */}
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

      {/* Alert automatici */}
      {(stale.length > 0 || expiringSoon.length > 0) && (
        <div className="space-y-2">
          {stale.length > 0 && (
            <div className="flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800">
              <AlertTriangle className="size-4 shrink-0 text-amber-600" />
              <p className="text-sm flex-1">
                <span className="font-semibold">{stale.length} {stale.length === 1 ? 'preventivo' : 'preventivi'}</span>
                {' '}senza risposta da 14+ giorni.{' '}
                <Link href="/preventivi?status=sent" className="underline underline-offset-2 font-medium hover:text-amber-900">
                  Manda un reminder →
                </Link>
              </p>
            </div>
          )}
          {expiringSoon.map(d => (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800">
              <CalendarClock className="size-4 shrink-0 text-red-600" />
              <p className="text-sm flex-1">
                Il preventivo{' '}
                <Link href={`/preventivi/${d.id}`} className="font-semibold underline underline-offset-2 hover:text-red-900">
                  {d.doc_number ?? d.title ?? 'Preventivo'}
                </Link>
                {' '}scade domani.
              </p>
            </div>
          ))}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          title="Preventivi questo mese"
          value={thisMonthCount}
          delta={deltaCount}
          icon={<FileText className="size-3.5" />}
          sub="vs mese scorso"
        />
        <KpiCard
          title="Valore questo mese"
          value={formatCurrency(thisMonthValue)}
          delta={deltaValue}
          icon={<TrendingUp className="size-3.5" />}
          sub="vs mese scorso"
        />
        <KpiCard
          title="Tasso accettazione"
          value={acceptRate !== null ? `${acceptRate.toFixed(0)}%` : '—'}
          delta={deltaAccept}
          icon={<CheckCircle2 className="size-3.5" />}
          sub="su tutti i preventivi"
        />
        <KpiCard
          title="In attesa di risposta"
          value={awaitingDocs.length}
          icon={<Clock className="size-3.5" />}
          href={awaitingDocs.length > 0 ? '/preventivi?status=sent' : undefined}
          sub={awaitingDocs.length > 0 ? 'Clicca per vedere' : undefined}
        />
      </div>

      {/* Trend revenue ultimi 6 mesi */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="size-4 text-muted-foreground" />
            Andamento ultimi 6 mesi
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 pb-4 px-4">
          <RevenueChart data={chartData} />
        </CardContent>
      </Card>

      {/* Activity feed + Azioni rapide */}
      <div className="grid md:grid-cols-3 gap-4">

        {/* Activity feed */}
        <Card className="md:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Attività recente</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/preventivi">
                Vedi tutti
                <ArrowRight className="size-3.5" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {feed.length > 0 ? (
              <div className="divide-y">
                {feed.map(doc => {
                  const s = STATUS_BADGE[doc.status]
                  const eventDate = doc.status === 'accepted' && doc.accepted_at
                    ? doc.accepted_at
                    : doc.status === 'sent' && doc.sent_at
                    ? doc.sent_at
                    : doc.updated_at

                  return (
                    <Link
                      key={doc.id}
                      href={`/preventivi/${doc.id}`}
                      className="flex items-center gap-3 py-2.5 hover:bg-muted/30 rounded transition-colors -mx-1 px-1"
                    >
                      <span className="shrink-0 mt-0.5">{EVENT_ICON[doc.status]}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{doc.doc_number ?? doc.title ?? 'Preventivo'}</p>
                        <p className="text-xs text-muted-foreground">
                          {EVENT_LABEL[doc.status]} · {new Date(eventDate).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-medium text-muted-foreground">
                          {formatCurrency(doc.total ?? 0)}
                        </span>
                        <Badge variant={s.variant} className="text-xs">{s.label}</Badge>
                      </div>
                    </Link>
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

      {/* Banner upgrade (solo piano free vicino al limite) */}
      {workspace.plan === 'free' && docs.length >= 7 && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="font-medium text-sm">
                Hai creato {docs.length} di 10 preventivi gratuiti.
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
