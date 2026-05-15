import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { RevenueChart, type TrendPoint } from '@/components/dashboard/RevenueChart'
import { PendingDocCard } from './_components/PendingDocCard'
import { StatusBadge } from '@/app/(app)/preventivi/_components/StatusBadge'
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
  Eye,
} from 'lucide-react'
import { FREE_DOC_LIMIT } from '@/lib/free-trial'

// ── Tipi ────────────────────────────────────────────────────────────────────

type DocStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'

interface DocRow {
  id: string
  title: string
  doc_number: string | null
  status: DocStatus
  doc_type: string
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
  viewed:   <Eye className="size-3.5 text-indigo-500" />,
  accepted: <CheckCircle2 className="size-3.5 text-green-500" />,
  rejected: <XCircle className="size-3.5 text-red-500" />,
  expired:  <Timer className="size-3.5 text-amber-500" />,
}

function getEventLabel(status: DocStatus, docType: string): string {
  const isFattura = docType === 'fattura'
  switch (status) {
    case 'draft':    return isFattura ? 'Bozza fattura'          : 'Bozza preventivo'
    case 'sent':     return isFattura ? 'Fattura inviata'        : 'Preventivo inviato'
    case 'viewed':   return isFattura ? 'Fattura visualizzata'   : 'Preventivo visualizzato'
    case 'accepted': return isFattura ? 'Fattura pagata'         : 'Preventivo accettato'
    case 'rejected': return isFattura ? 'Fattura annullata'      : 'Preventivo rifiutato'
    case 'expired':  return isFattura ? 'Fattura scaduta'        : 'Preventivo scaduto'
    default:         return isFattura ? 'Fattura'                : 'Preventivo'
  }
}


// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Carica workspace — prima come owner, poi come membro invitato (Team plan).
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
    .select('id, title, doc_number, status, doc_type, total, created_at, updated_at, sent_at, accepted_at, expires_at')
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })

  const docs: DocRow[] = (allDocs ?? []) as DocRow[]

  // Preventivi inviati (non bozze) — per il banner limite Free
  const sentPreventiviCount = docs.filter(d => d.doc_type === 'preventivo' && d.status !== 'draft').length

  // ── KPI: Preventivi accettati questo mese ────────────────────────────────
  const acceptedThisMonth = docs.filter(d =>
    d.doc_type === 'preventivo' &&
    d.status === 'accepted' &&
    d.accepted_at !== null &&
    d.accepted_at >= thisMonthStart
  )
  const acceptedPrevMonth = docs.filter(d =>
    d.doc_type === 'preventivo' &&
    d.status === 'accepted' &&
    d.accepted_at !== null &&
    d.accepted_at >= prevMonthStart &&
    d.accepted_at < thisMonthStart
  )
  const acceptedThisMonthCount = acceptedThisMonth.length
  const deltaAcceptedCount     = calcDelta(acceptedThisMonthCount, acceptedPrevMonth.length)

  // ── KPI: Valore preventivi accettati questo mese ──────────────────────────
  const acceptedThisMonthValue = acceptedThisMonth.reduce((s, d) => s + (d.total ?? 0), 0)
  const acceptedPrevMonthValue = acceptedPrevMonth.reduce((s, d) => s + (d.total ?? 0), 0)
  const deltaAcceptedValue     = calcDelta(acceptedThisMonthValue, acceptedPrevMonthValue)

  // ── KPI: Valore fatturato questo mese (fatture accettate/pagate) ──────────
  const paidFattureThisMonth = docs.filter(d =>
    d.doc_type === 'fattura' &&
    d.status === 'accepted' &&
    d.accepted_at !== null &&
    d.accepted_at >= thisMonthStart
  )
  const paidFatturePrevMonth = docs.filter(d =>
    d.doc_type === 'fattura' &&
    d.status === 'accepted' &&
    d.accepted_at !== null &&
    d.accepted_at >= prevMonthStart &&
    d.accepted_at < thisMonthStart
  )
  const paidFattureThisMonthValue = paidFattureThisMonth.reduce((s, d) => s + (d.total ?? 0), 0)
  const deltaPaidFattureValue     = calcDelta(paidFattureThisMonthValue, paidFatturePrevMonth.reduce((s, d) => s + (d.total ?? 0), 0))

  // ── KPI: in attesa di risposta (solo preventivi) ─────────────────────────
  const awaitingDocs = docs.filter(d => d.doc_type === 'preventivo' && d.status === 'sent')

  // ── FIX-16: Activity feed — include anche le bozze, ultimi 10 ────────────
  const feed = docs.slice(0, 10)

  // ── Alert: 14+ giorni senza risposta (solo preventivi) ───────────────────
  const stale = docs.filter(d =>
    d.doc_type === 'preventivo' &&
    d.status === 'sent' &&
    (d.sent_at ?? d.created_at) < fourteenDaysAgo
  )

  // ── Alert: scade domani (solo preventivi) ────────────────────────────────
  const expiringSoon = docs.filter(d =>
    d.doc_type === 'preventivo' &&
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

  // ── FIX-19: Preventivo in attesa più vecchio con info cliente ───────────
  const { data: oldestPendingRaw } = await supabase
    .from('documents')
    .select('id, doc_number, title, total, sent_at, last_reminder_at, client_id')
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'preventivo')
    .eq('status', 'sent')
    .is('deleted_at', null)
    .order('sent_at', { ascending: true, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  let pendingDoc: {
    documentId: string
    docNumber: string | null
    title: string | null
    total: number | null
    sentAt: string | null
    lastReminderAt: string | null
    clientName: string | null
    clientEmail: string | null
    clientPhone: string | null
  } | null = null

  if (oldestPendingRaw) {
    let clientName: string | null = null
    let clientEmail: string | null = null
    let clientPhone: string | null = null

    if (oldestPendingRaw.client_id) {
      const { data: clientData } = await supabase
        .from('clients')
        .select('name, email, phone')
        .eq('id', oldestPendingRaw.client_id)
        .maybeSingle()
      clientName  = clientData?.name ?? null
      clientEmail = clientData?.email ?? null
      clientPhone = clientData?.phone ?? null
    }

    pendingDoc = {
      documentId:     oldestPendingRaw.id,
      docNumber:      oldestPendingRaw.doc_number,
      title:          oldestPendingRaw.title,
      total:          oldestPendingRaw.total,
      sentAt:         oldestPendingRaw.sent_at,
      lastReminderAt: oldestPendingRaw.last_reminder_at,
      clientName,
      clientEmail,
      clientPhone,
    }
  }

  const fullName =
    user.user_metadata?.nome ||
    user.user_metadata?.full_name?.split(' ')[0] ||
    'Ciao'

  const draftPreventivi = docs.filter(d => d.status === 'draft' && d.doc_type === 'preventivo').length
  const draftFatture = docs.filter(d => d.status === 'draft' && d.doc_type === 'fattura').length
  const draftDocs = draftPreventivi + draftFatture

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
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Preventivi accettati questo mese */}
        <KpiCard
          title="Preventivi accettati"
          value={acceptedThisMonthCount}
          delta={deltaAcceptedCount}
          icon={<CheckCircle2 className="size-3.5" />}
          sub={`${now.toLocaleDateString('it-IT', { month: 'long' })} · vs mese scorso`}
        />
        {/* Valore preventivi accettati questo mese */}
        <KpiCard
          title="Valore preventivi"
          value={formatCurrency(acceptedThisMonthValue)}
          delta={deltaAcceptedValue}
          icon={<TrendingUp className="size-3.5" />}
          sub={`${now.toLocaleDateString('it-IT', { month: 'long' })} · vs mese scorso`}
        />
        {/* Valore fatturato questo mese */}
        <KpiCard
          title="Valore fatturato"
          value={formatCurrency(paidFattureThisMonthValue)}
          delta={deltaPaidFattureValue}
          icon={<FileText className="size-3.5" />}
          sub={`${now.toLocaleDateString('it-IT', { month: 'long' })} · vs mese scorso`}
          href={paidFattureThisMonth.length > 0 ? '/fatture' : undefined}
        />
        {/* In attesa di risposta */}
        <KpiCard
          title="In attesa di risposta"
          value={awaitingDocs.length}
          icon={<Clock className="size-3.5" />}
          href={awaitingDocs.length > 0 ? '/preventivi?status=sent' : undefined}
          sub={awaitingDocs.length > 0 ? 'Clicca per vedere' : undefined}
        />
        {/* Bozze preventivi + fatture */}
        <Card>
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <FileText className="size-3.5" />
              Bozze in lavorazione
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1.5">
            <p className="text-2xl font-bold leading-none">{draftDocs}</p>
            <div className="flex flex-col gap-0.5">
              {draftPreventivi > 0 ? (
                <Link href="/preventivi?status=draft" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 group">
                  <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                  {draftPreventivi} {draftPreventivi === 1 ? 'preventivo' : 'preventivi'}
                </Link>
              ) : null}
              {draftFatture > 0 ? (
                <Link href="/fatture?status=draft" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 group">
                  <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                  {draftFatture} {draftFatture === 1 ? 'fattura' : 'fatture'}
                </Link>
              ) : null}
              {draftDocs === 0 && (
                <span className="text-xs text-muted-foreground">Nessuna bozza</span>
              )}
            </div>
          </CardContent>
        </Card>
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

      {/* Activity feed + sidebar (Azioni rapide + Prossima scadenza) */}
      <div className="grid md:grid-cols-3 gap-4">

        {/* Activity feed — FIX-16: include bozze */}
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
                  const eventDate = doc.status === 'accepted' && doc.accepted_at
                    ? doc.accepted_at
                    : doc.status === 'sent' && doc.sent_at
                    ? doc.sent_at
                    : doc.updated_at

                  const docHref = doc.doc_type === 'fattura' ? `/fatture/${doc.id}` : `/preventivi/${doc.id}`
                  const docFallback = doc.doc_type === 'fattura' ? 'Fattura' : 'Preventivo'

                  return (
                    <Link
                      key={doc.id}
                      href={docHref}
                      className="flex items-center gap-3 py-2.5 hover:bg-muted/30 rounded transition-colors -mx-1 px-1"
                    >
                      <span className="shrink-0 mt-0.5">{EVENT_ICON[doc.status]}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {doc.doc_number ?? doc.title ?? docFallback}
                          {doc.doc_number && doc.title && (
                            <span className="font-normal text-muted-foreground"> — {doc.title}</span>
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {getEventLabel(doc.status, doc.doc_type)} · {new Date(eventDate).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-sm font-medium text-muted-foreground">
                          {formatCurrency(doc.total ?? 0)}
                        </span>
                        <StatusBadge status={doc.status} showTooltip={false} />
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

        {/* Sidebar destra: Azioni rapide + Prossima scadenza (FIX-19) */}
        <div className="flex flex-col gap-4">

          {/* Azioni rapide */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Azioni rapide</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button variant="outline" className="justify-start w-full" asChild>
                <Link href="/preventivi/nuovo">
                  <Plus className="size-4 shrink-0" />
                  <span className="truncate">Nuovo preventivo</span>
                </Link>
              </Button>
              <Button variant="outline" className="justify-start w-full" asChild>
                <Link href="/clienti/nuovo">
                  <Users className="size-4 shrink-0" />
                  <span className="truncate">Aggiungi cliente</span>
                </Link>
              </Button>
              <Button variant="outline" className="justify-start w-full" asChild>
                <Link href="/preventivi">
                  <FileText className="size-4 shrink-0" />
                  <span className="truncate flex-1 min-w-0">Tutti i preventivi</span>
                  {draftPreventivi > 0 && (
                    <Badge variant="secondary" className="ml-auto shrink-0 text-xs">
                      {draftPreventivi} bozz{draftPreventivi === 1 ? 'a' : 'e'}
                    </Badge>
                  )}
                </Link>
              </Button>
              <Button variant="outline" className="justify-start w-full" asChild>
                <Link href="/impostazioni">
                  <span className="truncate">Completa profilo attività</span>
                </Link>
              </Button>
            </CardContent>
          </Card>

          {/* FIX-19: Prossima scadenza — preventivo in attesa più vecchio */}
          <Card className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <Clock className="size-4 text-muted-foreground" />
                  Prossima scadenza
                </span>
                <Link
                  href="/preventivi/scadenze"
                  className="text-xs text-muted-foreground hover:text-foreground font-normal flex items-center gap-1"
                >
                  Vedi tutte <ArrowRight className="size-3" />
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {pendingDoc ? (
                <PendingDocCard {...pendingDoc} />
              ) : (
                <div className="flex items-center gap-2 text-sm text-green-600">
                  <CheckCircle2 className="size-4 shrink-0" />
                  Nessun preventivo in attesa ✅
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      {/* Banner upgrade (solo piano free vicino al limite) */}
      {workspace.plan === 'free' && sentPreventiviCount >= Math.floor(FREE_DOC_LIMIT * 0.75) && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div>
              <p className="font-medium text-sm">
                Hai inviato {sentPreventiviCount} di {FREE_DOC_LIMIT} preventivi gratuiti.
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
