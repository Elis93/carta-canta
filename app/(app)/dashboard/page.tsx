import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDocNumber } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { RevenueChart, type TrendPoint } from '@/components/dashboard/RevenueChart'
import { PendingDocCard } from './_components/PendingDocCard'
import { StatusBadge } from '@/app/(app)/preventivi/_components/StatusBadge'
import {
  FileText,
  Plus,
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
import { FREE_DOC_LIMIT, checkFreeBlock } from '@/lib/free-trial'

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
  updated_after_send_at: string | null
  clients: { name: string | null; surname: string | null } | null
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcDelta(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null
  return ((current - previous) / previous) * 100
}

// FIX-15 (sessione FIX-05): la dashboard mostrava "-100%" in rosso al 2° giorno
// del mese semplicemente perché non c'era ancora nessun dato — il confronto
// "vs mese scorso" è poco significativo quando il mese è appena iniziato e il
// valore corrente è ancora a zero. Nascondiamo il delta in quel caso (i dati
// del mese in corso sono comunque visibili nel valore principale della card).
const EARLY_MONTH_DAY_THRESHOLD = 5
function suppressEarlyMonthDelta(now: Date, delta: number | null, currentValue: number): number | null {
  if (now.getDate() <= EARLY_MONTH_DAY_THRESHOLD && currentValue === 0) return null
  return delta
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
    .select('id, name, plan, ragione_sociale, sent_quota_used, free_trial_expires_at')
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
        .select('id, name, plan, ragione_sociale, sent_quota_used, free_trial_expires_at')
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
  // allDocs e oldestPendingRaw dipendono solo da workspace.id e sono indipendenti → in parallelo.
  // (oldestPendingRaw è la prossima scadenza; la usiamo più in basso ma la query parte già qui.)
  const [{ data: allDocs }, { data: oldestPendingRaw }] = await Promise.all([
    supabase
      .from('documents')
      .select('id, title, doc_number, status, doc_type, total, created_at, updated_at, sent_at, accepted_at, expires_at, updated_after_send_at, clients(name, surname)')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false }),
    // ── Preventivo in attesa con scadenza più vicina ──
    // Ordine: expires_at ASC (scade prima) → sent_at ASC (inviato prima) come fallback
    supabase
      .from('documents')
      .select('id, doc_number, title, total, sent_at, expires_at, last_reminder_at, updated_after_send_at, client_id')
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'preventivo')
      .in('status', ['sent', 'viewed'])
      .is('deleted_at', null)
      .order('expires_at', { ascending: true, nullsFirst: false })
      .order('sent_at', { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
  ])

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

  // ── KPI: Valore fatturato questo mese (fatture pagate) ───────────────────
  // Per le fatture marcate "pagata" manualmente, accepted_at può essere null
  // (il route /api/fatture/[id]/status non lo impostava nelle versioni precedenti).
  // Fallback: usa updated_at come data di pagamento per le fatture storiche.
  const paidFattureThisMonth = docs.filter(d => {
    if (d.doc_type !== 'fattura' || d.status !== 'accepted') return false
    const paidAt = d.accepted_at ?? d.updated_at
    return paidAt >= thisMonthStart
  })
  const paidFatturePrevMonth = docs.filter(d => {
    if (d.doc_type !== 'fattura' || d.status !== 'accepted') return false
    const paidAt = d.accepted_at ?? d.updated_at
    return paidAt >= prevMonthStart && paidAt < thisMonthStart
  })
  const paidFattureThisMonthValue = paidFattureThisMonth.reduce((s, d) => s + (d.total ?? 0), 0)
  const deltaPaidFattureValue     = calcDelta(paidFattureThisMonthValue, paidFatturePrevMonth.reduce((s, d) => s + (d.total ?? 0), 0))

  // ── Activity feed — include anche le bozze, ultime 5 per ultima modifica ──
  const feed = docs.slice(0, 5)

  // ── Alert: 14+ giorni senza risposta (solo preventivi) ───────────────────
  const stale = docs.filter(d =>
    d.doc_type === 'preventivo' &&
    (d.status === 'sent' || d.status === 'viewed') &&
    (d.sent_at ?? d.created_at) < fourteenDaysAgo
  )

  // ── Alert: scade domani (solo preventivi) ────────────────────────────────
  const expiringSoon = docs.filter(d =>
    d.doc_type === 'preventivo' &&
    (d.status === 'sent' || d.status === 'viewed') &&
    d.expires_at !== null &&
    d.expires_at >= tomorrowStart &&
    d.expires_at < tomorrowEnd
  )

  // ── Trend ultimi 6 mesi ───────────────────────────────────────────────────
  type TrendBucket = TrendPoint & { key: string; totalAll: number; countAll: number }
  const trendBuckets: TrendBucket[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('it-IT', { month: 'short' }).replace('.', ''),
      total:    0,   // valore preventivi accettati (per accepted_at)
      count:    0,
      totalAll: 0,   // valore fatturato (fatture accepted per mese)
      countAll: 0,
    }
  })
  docs.forEach((doc) => {
    // Barra scura: preventivi accettati, per mese di accettazione
    if (doc.doc_type === 'preventivo' && doc.status === 'accepted' && doc.accepted_at) {
      const acceptedKey = doc.accepted_at.slice(0, 7)
      const mAccepted = trendBuckets.find((t) => t.key === acceptedKey)
      if (mAccepted) { mAccepted.total += doc.total ?? 0; mAccepted.count++ }
    }
    // Barra chiara: fatture accepted (fatturato) per mese
    if (doc.doc_type === 'fattura' && doc.status === 'accepted') {
      const paidAt = doc.accepted_at ?? doc.updated_at
      const paidKey = paidAt.slice(0, 7)
      const mPaid = trendBuckets.find((t) => t.key === paidKey)
      if (mPaid) { mPaid.totalAll += doc.total ?? 0; mPaid.countAll++ }
    }
  })
  const chartData: TrendPoint[] = trendBuckets.map(
    ({ label, total, count, totalAll, countAll }) => ({ label, total, count, totalAll, countAll })
  )

  let pendingDoc: {
    documentId: string
    docNumber: string | null
    title: string | null
    total: number | null
    sentAt: string | null
    lastReminderAt: string | null
    updatedAfterSendAt: string | null
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
      documentId:         oldestPendingRaw.id,
      docNumber:          oldestPendingRaw.doc_number ? oldestPendingRaw.doc_number.replace(/^[A-Za-z]+/, '') : null,
      title:              oldestPendingRaw.title,
      total:              oldestPendingRaw.total,
      sentAt:             oldestPendingRaw.sent_at,
      lastReminderAt:     oldestPendingRaw.last_reminder_at,
      updatedAfterSendAt: (oldestPendingRaw as Record<string, unknown>).updated_after_send_at as string | null ?? null,
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

  const isFree = workspace.plan === 'free'
  const freeTrialStatus = isFree ? checkFreeBlock(workspace) : null

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto space-y-6">

      {/* ── BANNER PIANO FREE — sempre in cima ── */}
      {isFree && freeTrialStatus?.blocked && freeTrialStatus.reason === 'trial_expired' && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <p>
            <strong>Il periodo di prova è terminato.</strong>{' '}
            Non puoi creare, scaricare o inviare nuovi preventivi.{' '}
            <Link href="/abbonamento" className="font-semibold underline underline-offset-2">
              Passa a Pro
            </Link>{' '}
            per preventivi illimitati.
          </p>
        </div>
      )}
      {isFree && freeTrialStatus?.blocked && freeTrialStatus.reason === 'doc_limit' && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <p>
            <strong>Hai raggiunto il limite di {FREE_DOC_LIMIT} preventivi gratuiti.</strong>{' '}
            Non puoi creare o inviare altri preventivi.{' '}
            <Link href="/abbonamento" className="font-semibold underline underline-offset-2">
              Passa a Pro
            </Link>{' '}
            per preventivi illimitati, AI import e watermark rimovibile.
          </p>
        </div>
      )}
      {isFree && !freeTrialStatus?.blocked && freeTrialStatus && (
        <div className="flex items-center justify-between gap-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p>
            Hai inviato <strong>{freeTrialStatus.docsUsed} di {FREE_DOC_LIMIT}</strong> preventivi gratuiti.{' '}
            <Link href="/abbonamento" className="font-semibold underline underline-offset-2 hover:text-amber-900">
              Passa a Pro
            </Link>{' '}
            per preventivi illimitati, AI import e watermark rimovibile.
          </p>
        </div>
      )}

      {/* Header
          FIX-18 (sessione FIX-05): rimosso il bottone "Nuovo preventivo" duplicato
          (era identico, a pochi pixel di distanza, da quello già presente
          nell'header globale — vedi AppShell.tsx riga ~252 — generando un
          "doppio CTA" ridondante e confuso). L'azione resta sempre disponibile
          dall'header globale su ogni pagina dell'app. */}
      <div>
        <h1 className="text-2xl font-semibold">Ciao, {fullName} 👋</h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          {workspace.ragione_sociale ?? workspace.name}
        </p>
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
                <Link href="/preventivi/scadenze" className="underline underline-offset-2 font-medium hover:text-amber-900">
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
                  {formatDocNumber(d.doc_number) !== '—' ? formatDocNumber(d.doc_number) : (d.title ?? 'Preventivo')}
                </Link>
                {' '}scade domani.
              </p>
            </div>
          ))}
        </div>
      )}

      {/* M3: Prossima scadenza IN CIMA — "cosa devo fare oggi" prima dei numeri */}
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

      {/* KPI Cards — riepilogo mensile */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Preventivi accettati questo mese
            FIX-15: titolo ora dice esplicitamente "questo mese" — la card mostra
            un dato MENSILE, mentre le liste preventivi/fatture mostrano TOTALI
            storici: senza questa precisazione l'utente legge la differenza come
            un bug ("Accettati 2" in lista vs "0" in dashboard). Il delta viene
            nascosto a inizio mese quando il valore corrente è ancora zero, per
            non mostrare un "-100%" fuorviante e demoralizzante. */}
        <KpiCard
          title="Accettati questo mese"
          value={acceptedThisMonthCount}
          delta={suppressEarlyMonthDelta(now, deltaAcceptedCount, acceptedThisMonthCount)}
          icon={<CheckCircle2 className="size-3.5" />}
          sub={`${now.toLocaleDateString('it-IT', { month: 'long' })} · vs mese scorso`}
          href="/preventivi?status=accepted"
        />
        {/* Valore preventivi accettati questo mese */}
        <KpiCard
          title="Valore accettati questo mese"
          value={formatCurrency(acceptedThisMonthValue)}
          delta={suppressEarlyMonthDelta(now, deltaAcceptedValue, acceptedThisMonthValue)}
          icon={<TrendingUp className="size-3.5" />}
          sub={`${now.toLocaleDateString('it-IT', { month: 'long' })} · vs mese scorso`}
          href="/preventivi?status=accepted"
        />
        {/* Valore fatturato questo mese */}
        <KpiCard
          title="Fatturato questo mese"
          value={formatCurrency(paidFattureThisMonthValue)}
          delta={suppressEarlyMonthDelta(now, deltaPaidFattureValue, paidFattureThisMonthValue)}
          icon={<FileText className="size-3.5" />}
          sub={`${now.toLocaleDateString('it-IT', { month: 'long' })} · vs mese scorso`}
          href="/fatture?q=Pagata"
        />
        {/* Bozze preventivi + fatture */}
        <Card className="h-full">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <FileText className="size-3.5" />
              Bozze in lavorazione
            </CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-1">
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

      {/* Attività recente (full width, in fondo) */}
      <Card>
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
                  const clientName = doc.clients
                    ? [doc.clients.name, doc.clients.surname].filter(Boolean).join(' ')
                    : null
                  const isModified = !!doc.updated_after_send_at

                  const eventDateFormatted = new Date(eventDate).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })

                  return (
                    <Link
                      key={doc.id}
                      href={docHref}
                      className="flex items-center gap-3 py-2.5 hover:bg-muted/30 rounded transition-colors -mx-1 px-1"
                    >
                      <span className="shrink-0 mt-0.5">{EVENT_ICON[doc.status]}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">
                          {formatDocNumber(doc.doc_number, doc.doc_type) !== '—' ? formatDocNumber(doc.doc_number, doc.doc_type) : (doc.title ?? docFallback)}
                          {doc.doc_number && doc.title && (
                            <span className="font-normal text-muted-foreground"> — {doc.title}</span>
                          )}
                        </p>
                        {/* Seconda riga: clientName si tronca, label evento sempre visibile */}
                        <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                          {clientName && (
                            <span className="truncate min-w-0">{clientName} ·</span>
                          )}
                          <span className="shrink-0">{getEventLabel(doc.status, doc.doc_type)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Data sempre visibile, estratta dal blocco troncabile */}
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {eventDateFormatted}
                        </span>
                        <span className="text-sm font-medium text-muted-foreground">
                          {formatCurrency(doc.total ?? 0)}
                        </span>
                        <StatusBadge status={doc.status} showTooltip={false} />
                        {isModified && (
                          <span className="inline-flex items-center rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-700">
                            {doc.doc_type === 'fattura' ? 'Modificata' : 'Modificato'}
                          </span>
                        )}
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

    </div>
  )
}
