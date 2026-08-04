import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { formatCurrency, formatDocNumber } from '@/lib/utils'
import { userInitials } from '@/lib/utils/user-initials'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { KpiCard } from '@/components/dashboard/KpiCard'
import { RevenueChartLazy } from '@/components/dashboard/RevenueChartLazy'
import type { TrendPoint } from '@/components/dashboard/RevenueChart'
import { PendingDocCard } from './_components/PendingDocCard'
import { ScadenzeHomeCard } from './_components/ScadenzeHomeCard'
import { CompleteProfileCard, type ProfileItem } from './_components/CompleteProfileCard'
import { MobileAvatarMenu } from './_components/MobileAvatarMenu'
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
  Crown,
  Bell,
  Hammer,
} from 'lucide-react'
import { FREE_DOC_LIMIT, checkFreeBlock } from '@/lib/free-trial'
import { getAppNotifications } from '@/lib/notifications'
import { getTodayEvents } from '@/lib/agenda'
import { TodayAgendaCard } from './_components/TodayAgendaCard'
import { InstallHomeBanner } from '@/components/shared/InstallHomeBanner'
import { LAVORO_STATUS_META, type LavoroStatus } from '@/app/(app)/lavori/_components/lavoro-status'

// ── Tipi ────────────────────────────────────────────────────────────────────

type DocStatus = 'draft' | 'sent' | 'viewed' | 'accepted' | 'rejected' | 'expired'

// Riga lavoro per il feed "Attività recente" (richiesta Eli 2 ago:
// anche i lavori modificati/aggiornati, non solo i documenti)
interface LavoroFeedRow {
  id: string
  title: string | null
  status: string
  created_at: string | null
  updated_at: string
  clients: { name: string | null; surname: string | null } | null
}

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

// ── Costanti ─────────────────────────────────────────────────────────────────

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcDelta(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null
  return ((current - previous) / previous) * 100
}

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
  sent:     <Send className="size-3.5 text-[#3f6fb0]" />,
  viewed:   <Eye className="size-3.5 text-[#c25b91]" />,
  accepted: <CheckCircle2 className="size-3.5 text-[#2f8a63]" />,
  rejected: <XCircle className="size-3.5 text-[#b05656]" />,
  expired:  <Timer className="size-3.5 text-[#b0863e]" />,
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

// Badge mobili — sfondo tenue + testo grigio scuro (#2b2b2b)
function getMobileBadgeLabel(status: DocStatus, docType: string): string {
  const isFattura = docType === 'fattura'
  switch (status) {
    case 'draft':    return 'Bozza'
    case 'sent':     return 'Inviato'
    case 'viewed':   return 'Visto'
    case 'accepted': return isFattura ? 'Pagata' : 'Accettato'
    case 'rejected': return isFattura ? 'Annullata' : 'Rifiutato'
    case 'expired':  return 'Scaduto'
    default:         return status
  }
}

function getMobileBadgeBg(status: DocStatus): string {
  switch (status) {
    case 'draft':    return '#e8e8e8'
    case 'sent':     return '#d8e8fb'
    case 'viewed':   return '#fbe1ee'
    case 'accepted': return '#d4efe2'
    case 'rejected': return '#f5dede'
    case 'expired':  return '#f5e9d0'
    default:         return '#e8e8e8'
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  // Contesto sessione condiviso (memoizzato per richiesta — vedi lib/workspace-context.ts)
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  const now = new Date()
  const meseCorrente = now.toLocaleDateString('it-IT', { month: 'long' , timeZone: 'Europe/Rome' })
  const thisMonthStart  = startOfMonth(now).toISOString()
  const prevMonthStart  = startOfPrevMonth(now).toISOString()
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const tomorrow        = new Date(now.getTime() + 24 * 60 * 60 * 1000)
  const tomorrowStart   = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate()).toISOString()
  const tomorrowEnd     = new Date(tomorrow.getFullYear(), tomorrow.getMonth(), tomorrow.getDate() + 1).toISOString()

  // Inizio della finestra del grafico (6 mesi, incluso il corrente): tutto ciò
  // che serve a KPI/trend/feed ha per forza updated_at dentro questa finestra
  // (accettazioni e incassi aggiornano updated_at). Le attese e le bozze,
  // che possono essere più vecchie, arrivano da query dedicate qui sotto.
  const windowStart = new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString()

  // PERF: tutte le query della Home dipendono solo dal workspace → un solo
  // round trip. Il cliente del preventivo in scadenza è JOINato direttamente,
  // e checklist+notifiche non aspettano i documenti. La query documenti è
  // LIMITATA alla finestra del trend (prima scaricava l'intero storico:
  // con anni di dati la Home sarebbe rallentata ad ogni apertura).
  const [{ data: recentDocs }, { data: pendingPreventivi }, { count: draftPrevCount }, { count: draftFattCount }, { data: oldestPendingRaw }, { data: pendingFatturaRaw }, { count: fattureScadenzaCount }, { count: catalogCount }, appNotifications, todayEvents, recentLavori] = await Promise.all([
    supabase
      .from('documents')
      .select('id, title, doc_number, status, doc_type, total, created_at, updated_at, sent_at, accepted_at, expires_at, updated_after_send_at, clients(name, surname)')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .gte('updated_at', windowStart)
      .order('updated_at', { ascending: false }),
    // TUTTI i preventivi in attesa (anche vecchi): servono a solleciti,
    // scadenze di domani e conteggio "Altri N in attesa"
    supabase
      .from('documents')
      .select('id, doc_number, title, status, sent_at, created_at, expires_at')
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'preventivo')
      .in('status', ['sent', 'viewed'])
      .is('deleted_at', null),
    // Conteggi bozze (anche vecchie) senza scaricare le righe
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'preventivo')
      .eq('status', 'draft')
      .is('deleted_at', null),
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'fattura')
      .eq('status', 'draft')
      .is('deleted_at', null),
    supabase
      .from('documents')
      .select('id, doc_number, title, total, sent_at, expires_at, last_reminder_at, updated_after_send_at, public_token, client_id, clients(name, email, phone)')
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'preventivo')
      .in('status', ['sent', 'viewed'])
      .is('deleted_at', null)
      .order('expires_at', { ascending: true, nullsFirst: false })
      .order('sent_at', { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    // FATTURA più urgente da incassare (card "In scadenza" unificata, 2 ago):
    // 'expired' incluso — una fattura oltre scadenza resta da incassare
    supabase
      .from('documents')
      .select('id, doc_number, title, total, sent_at, expires_at, public_token, client_id, clients(name, email, phone)')
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'fattura')
      .in('status', ['sent', 'viewed', 'expired'])
      .is('deleted_at', null)
      .order('expires_at', { ascending: true, nullsFirst: false })
      .order('sent_at', { ascending: true, nullsFirst: false })
      .limit(1)
      .maybeSingle(),
    // Conteggio fatture da incassare entro 7 giorni (badge del tasto "Fatture" —
    // stessa semantica del vecchio badge Scadenze di Altro)
    supabase
      .from('documents')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'fattura')
      .in('status', ['sent', 'viewed', 'expired'])
      .is('deleted_at', null)
      .not('expires_at', 'is', null)
      .lte('expires_at', new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString()),
    supabase
      .from('catalog_items')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id),
    getAppNotifications(
      supabase,
      workspace.id,
      workspace.notification_prefs as Record<string, unknown> | null
    ),
    // Appuntamenti di OGGI (sopralluoghi + lavori) per la card "Oggi in agenda"
    getTodayEvents(supabase, workspace.id),
    // Lavori toccati di recente per "Attività recente" (Eli 2 ago).
    // ⚠️ I builder PostgREST sono PromiseLike: tollerante pre-migration con
    // .then(ok, ko), MAI .catch diretto sul builder (lezione 14 lug).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 049 non ancora in types/database.ts
    (supabase as any)
      .from('lavori')
      .select('id, title, status, created_at, updated_at, clients(name, surname)')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .gte('updated_at', windowStart)
      .order('updated_at', { ascending: false })
      .limit(5)
      .then(
        (r: { data: unknown[] | null }) => (r.data ?? []) as unknown as LavoroFeedRow[],
        () => [] as LavoroFeedRow[]
      ) as Promise<LavoroFeedRow[]>,
  ])

  const docs: DocRow[] = (recentDocs ?? []) as DocRow[]
  const pending = (pendingPreventivi ?? []) as Array<{ id: string; doc_number: string | null; title: string | null; status: string; sent_at: string | null; created_at: string; expires_at: string | null }>


  // ── KPI ─────────────────────────────────────────────────────────────────────
  const acceptedThisMonth = docs.filter(d =>
    d.doc_type === 'preventivo' && d.status === 'accepted' &&
    d.accepted_at !== null && d.accepted_at >= thisMonthStart
  )
  const acceptedPrevMonth = docs.filter(d =>
    d.doc_type === 'preventivo' && d.status === 'accepted' &&
    d.accepted_at !== null && d.accepted_at >= prevMonthStart && d.accepted_at < thisMonthStart
  )
  const acceptedThisMonthCount = acceptedThisMonth.length
  const deltaAcceptedCount     = calcDelta(acceptedThisMonthCount, acceptedPrevMonth.length)
  const acceptedThisMonthValue = acceptedThisMonth.reduce((s, d) => s + (d.total ?? 0), 0)
  const acceptedPrevMonthValue = acceptedPrevMonth.reduce((s, d) => s + (d.total ?? 0), 0)
  const deltaAcceptedValue     = calcDelta(acceptedThisMonthValue, acceptedPrevMonthValue)

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

  // Feed unificato documenti + lavori (Eli 2 ago), ordinato per aggiornamento
  type FeedItem =
    | { kind: 'doc'; when: string; doc: DocRow }
    | { kind: 'lavoro'; when: string; lavoro: LavoroFeedRow }
  const feed: FeedItem[] = [
    ...docs.map((d) => ({ kind: 'doc' as const, when: d.updated_at, doc: d })),
    ...recentLavori.map((l) => ({ kind: 'lavoro' as const, when: l.updated_at, lavoro: l })),
  ]
    .sort((a, b) => b.when.localeCompare(a.when))
    .slice(0, 5)

  // Solleciti/scadenze/conteggio: dalla query DEDICATA sulle attese
  // (anche più vecchie della finestra del trend)
  const stale = pending.filter(d =>
    (d.sent_at ?? d.created_at) < fourteenDaysAgo
  )
  const expiringSoon = pending.filter(d =>
    d.expires_at !== null &&
    d.expires_at >= tomorrowStart &&
    d.expires_at < tomorrowEnd
  )


  // ── Trend ────────────────────────────────────────────────────────────────────
  type TrendBucket = TrendPoint & { key: string; totalAll: number; countAll: number }
  const trendBuckets: TrendBucket[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return {
      key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: d.toLocaleDateString('it-IT', { month: 'short' , timeZone: 'Europe/Rome' }).replace('.', ''),
      total: 0, count: 0, totalAll: 0, countAll: 0,
    }
  })
  docs.forEach((doc) => {
    if (doc.doc_type === 'preventivo' && doc.status === 'accepted' && doc.accepted_at) {
      const acceptedKey = doc.accepted_at.slice(0, 7)
      const mAccepted = trendBuckets.find((t) => t.key === acceptedKey)
      if (mAccepted) { mAccepted.total += doc.total ?? 0; mAccepted.count++ }
    }
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

  // ── Pending doc ──────────────────────────────────────────────────────────────
  let pendingDoc: {
    documentId: string
    docNumber: string | null
    title: string | null
    total: number | null
    sentAt: string | null
    lastReminderAt: string | null
    updatedAfterSendAt: string | null
    expiresAt: string | null
    publicToken: string | null
    clientName: string | null
    clientEmail: string | null
    clientPhone: string | null
  } | null = null

  if (oldestPendingRaw) {
    // Cliente JOINato nella query principale (niente round trip extra)
    const pendingClient = (oldestPendingRaw as unknown as {
      clients: { name: string | null; email: string | null; phone: string | null } | null
    }).clients
    const clientName  = pendingClient?.name ?? null
    const clientEmail = pendingClient?.email ?? null
    const clientPhone = pendingClient?.phone ?? null

    pendingDoc = {
      documentId:         oldestPendingRaw.id,
      docNumber:          oldestPendingRaw.doc_number ? oldestPendingRaw.doc_number.replace(/^[A-Za-z]+/, '') : null,
      title:              oldestPendingRaw.title,
      total:              oldestPendingRaw.total,
      sentAt:             oldestPendingRaw.sent_at,
      lastReminderAt:     oldestPendingRaw.last_reminder_at,
      updatedAfterSendAt: (oldestPendingRaw as Record<string, unknown>).updated_after_send_at as string | null ?? null,
      expiresAt:          oldestPendingRaw.expires_at ?? null,
      publicToken:        (oldestPendingRaw as Record<string, unknown>).public_token as string | null ?? null,
      clientName,
      clientEmail,
      clientPhone,
    }
  }

  // ── Nomi e identità ───────────────────────────────────────────────────────────
  const workspaceName = workspace.ragione_sociale ?? workspace.name
  const fullName =
    user.user_metadata?.nome ||
    (user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ||
    workspaceName

  // Iniziali: Nome + Cognome utente; fallback full_name (prima+ultima parola);
  // fallback ragione sociale. Helper condiviso con la scheda profilo di Altro
  // (stesse identiche iniziali nei due tondi — richiesta Eli 17 lug).
  const initials = userInitials(user.user_metadata, workspaceName)

  // Bozze: conteggi dedicati (head:true) — includono anche le bozze più
  // vecchie della finestra del trend, senza scaricare righe
  const draftPreventivi = draftPrevCount ?? 0
  const draftFatture    = draftFattCount ?? 0
  const draftDocs       = draftPreventivi + draftFatture

  const isFree = workspace.plan === 'free'
  const freeTrialStatus = isFree ? checkFreeBlock(workspace) : null

  // Checklist "Completa il tuo profilo" + notifiche: caricate nel Promise.all
  // iniziale (dipendono solo dal workspace, non dai documenti).
  const unreadNotifications = appNotifications.filter((n) => !n.read).length

  const profileItems: ProfileItem[] = [
    { key: 'dati',   label: 'Dati attività (ragione sociale)', done: !!workspace.ragione_sociale,               href: '/impostazioni?tab=generale' },
    { key: 'phone',  label: 'Telefono (per farti contattare)',  done: !!workspace.phone,                         href: '/impostazioni?tab=generale#telefono' },
    { key: 'logo',   label: 'Carica il tuo logo',               done: !!workspace.logo_url,                      href: '/impostazioni?tab=generale#logo' },
    { key: 'ateco',  label: 'Codice ATECO (voci suggerite)',    done: (workspace.ateco_codes?.length ?? 0) > 0,  href: '/impostazioni?tab=fiscale#ateco' },
    { key: 'listino', label: 'Carica il listino nel catalogo',  done: (catalogCount ?? 0) > 0,                   href: '/catalogo' },
  ]
  const profileIncomplete = profileItems.some((i) => !i.done)


  // ── Etichette scadenza per la card "In scadenza" ──────────────────────────
  function scadenzaLabel(expiresAt: string | null | undefined, kind: 'preventivo' | 'fattura'): string {
    if (!expiresAt) return kind === 'fattura' ? 'Da incassare' : 'In attesa'
    const exp          = new Date(expiresAt)
    const todayMid     = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const tomorrowMid  = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1)
    const dayAfterMid  = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 2)
    if (exp < todayMid) return kind === 'fattura' ? 'Oltre la scadenza — da incassare' : 'Scaduto'
    if (exp < tomorrowMid) return kind === 'fattura' ? 'Da incassare entro oggi' : 'Scade oggi'
    if (exp < dayAfterMid) return kind === 'fattura' ? 'Da incassare entro domani' : 'Scade domani'
    const d = exp.toLocaleDateString('it-IT', { day: '2-digit', month: 'short', timeZone: 'Europe/Rome' })
    return kind === 'fattura' ? `Da incassare entro il ${d}` : `Scade il ${d}`
  }
  const expiresLabel = scadenzaLabel(pendingDoc?.expiresAt, 'preventivo')

  // Fattura più urgente da incassare (blocco fattura della card unificata)
  let pendingFattura: {
    documentId: string
    numberLabel: string | null
    clientName: string | null
    clientEmail: string | null
    clientPhone: string | null
    total: number | null
    expiresLabel: string
    expiresAt: string | null
    publicToken: string | null
  } | null = null
  if (pendingFatturaRaw) {
    const fc = (pendingFatturaRaw as unknown as {
      clients: { name: string | null; email: string | null; phone: string | null } | null
    }).clients
    pendingFattura = {
      documentId:  pendingFatturaRaw.id,
      numberLabel: pendingFatturaRaw.doc_number ? formatDocNumber(pendingFatturaRaw.doc_number, 'fattura') : null,
      clientName:  fc?.name ?? null,
      clientEmail: fc?.email ?? null,
      clientPhone: fc?.phone ?? null,
      total:       pendingFatturaRaw.total,
      expiresLabel: scadenzaLabel(pendingFatturaRaw.expires_at, 'fattura'),
      expiresAt:   pendingFatturaRaw.expires_at ?? null,
      publicToken: (pendingFatturaRaw as Record<string, unknown>).public_token as string | null ?? null,
    }
  }

  // Badge dei due tasti (stessa semantica del vecchio badge Scadenze di Altro:
  // entro 7 giorni). I preventivi si contano dalla lista attese già scaricata.
  const scadenzaCutoff7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7).toISOString()
  const prevScadenzaCount = pending.filter((d) => d.expires_at != null && d.expires_at <= scadenzaCutoff7).length

  // Sfondo caldo dell'app: #f8f6f1 (terzo schiarimento chiesto da Eli:
  // f0eee8 → f3f1ec → f6f4ef → f8f6f1) — tenere allineato ad AppShell
  return (
    <div className="lg:bg-background" style={{ background: '#f8f6f1', minHeight: '100%' }}>

      {/* ══════════════════ MOBILE ══════════════════════════════════════════════ */}
      <div className="lg:hidden">

        {/* 1. Brand strip — variante B "scena navy" (scelta Eli 2 ago dal
            mockup): il marchio grande sulla fascia blu notte come splash e
            login — si vede davvero, e le due fasce di prima diventano una
            testata coerente (via il nastrino bianco "né carne né pesce"). */}
        <div style={{ background: '#1a1a2e', padding: '14px 15px 13px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <svg viewBox="0 0 512 512" style={{ width: 46, height: 46, flexShrink: 0 }} xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <rect x="7" y="7" width="498" height="498" rx="110" fill="rgba(255,255,255,.07)" stroke="#c9a44c" strokeWidth="14"/>
              <path d="M342 133 A150 150 0 1 0 342 379" fill="none" stroke="#c9a44c" strokeWidth="38" strokeLinecap="round"/>
              <path d="M307 175 A96 96 0 1 0 307 337" fill="none" stroke="#f3ede0" strokeWidth="30" strokeLinecap="round"/>
            </svg>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 24, fontWeight: 600, color: '#f5efdf', lineHeight: 1.1 }}>
                Carta <span style={{ color: '#c9a44c' }}>Canta</span>
              </div>
              <div style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 13, fontStyle: 'italic', color: '#cbb47a', marginTop: 1 }}>
                il tuo ufficio in tasca
              </div>
            </div>
          </div>
        </div>

        {/* 2. Home header: saluto + avatar — riga oro che stacca la testata dal contenuto */}
        <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div>
              <div style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.15 }}>Ciao, {fullName}</div>
              <div style={{ fontSize: 13, color: '#55534b' }}>{workspaceName}</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Campanella notifiche (mockup notifiche 1) — anche per i Free */}
            <Link
              href="/notifiche"
              aria-label={unreadNotifications > 0 ? `Notifiche: ${unreadNotifications} non lette` : 'Notifiche'}
              style={{ position: 'relative', width: 36, height: 36, borderRadius: '50%', background: '#fff', border: '1px solid #e7e7ea', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(20,20,40,.05)', color: '#55534b' }}
            >
              <Bell size={17} strokeWidth={1.9} />
              {unreadNotifications > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 17, height: 17, borderRadius: 999, background: '#b05656', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                  {unreadNotifications > 9 ? '9+' : unreadNotifications}
                </span>
              )}
            </Link>
            <MobileAvatarMenu
              initials={initials}
              userEmail={user.email ?? ''}
              plan={workspace.plan}
            />
          </div>
        </div>

        {/* 2b. Installa l'app: solo dal browser, sparisce al primo tocco */}
        <InstallHomeBanner />

        {/* 3. Critical blocked banner (mobile) */}
        {isFree && freeTrialStatus?.blocked && (
          <div style={{ margin: '12px 15px 0', background: '#f5dede', borderRadius: 11, border: '1px solid #ecc9c9', padding: '11px 13px', display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 13, color: '#b05656' }}>
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1, color: '#b05656' }} />
            <p style={{ margin: 0 }}>
              <strong>
                {freeTrialStatus.reason === 'trial_expired'
                  ? 'Periodo di prova terminato.'
                  : `Limite di ${FREE_DOC_LIMIT} preventivi raggiunto.`}
              </strong>
              {' '}
              <Link href="/abbonamento" style={{ fontWeight: 600, color: '#b05656' }}>Passa a Pro →</Link>
            </p>
          </div>
        )}

        {/* 4. Quota banner (gold — solo se non bloccato) */}
        {isFree && freeTrialStatus && !freeTrialStatus.blocked && (
          <div style={{ margin: '18px 15px 0', background: '#fff', borderRadius: 11, boxShadow: SH, borderLeft: '3px solid #c9a44c', padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 9 }}>
            <Crown size={18} style={{ color: '#b08d3e', flexShrink: 0 }} aria-hidden="true" />
            <span style={{ flex: 1, fontSize: 13, color: '#55534b' }}>
              {freeTrialStatus.docsUsed}/{FREE_DOC_LIMIT} preventivi gratuiti
            </span>
            <Link href="/abbonamento" style={{ fontSize: 13, fontWeight: 600, color: '#b08d3e', textDecoration: 'none', whiteSpace: 'nowrap' }}>
              Passa a Pro →
            </Link>
          </div>
        )}

        {/* 4b. Completa il tuo profilo (solo se manca qualcosa; ✕ = nascosta 3gg) */}
        {profileIncomplete && <CompleteProfileCard items={profileItems} />}

        {/* 4c. Oggi in agenda — sempre visibile (CTA se l'agenda è vuota).
            Bordo oro leggero su un lato: separa le card della Home (Eli 18 lug). */}
        <TodayAgendaCard agenda={todayEvents} style={{ margin: '18px 15px 0' }} />

        {/* 5. Card unica "In scadenza": preventivo da sollecitare + fattura da
            incassare + i due tasti che sostituiscono la voce Scadenze di Altro
            (mockup approvato 2 ago sera). */}
        <ScadenzeHomeCard
          preventivo={pendingDoc ? {
            documentId:  pendingDoc.documentId,
            numberLabel: pendingDoc.docNumber,
            clientName:  pendingDoc.clientName,
            clientEmail: pendingDoc.clientEmail,
            clientPhone: pendingDoc.clientPhone,
            total:       pendingDoc.total,
            expiresLabel,
            expiresAt:   pendingDoc.expiresAt,
            publicToken: pendingDoc.publicToken,
            isModified:  !!pendingDoc.updatedAfterSendAt,
          } : null}
          fattura={pendingFattura}
          prevCount={prevScadenzaCount}
          fattCount={fattureScadenzaCount ?? 0}
          workspaceName={workspaceName}
        />

        {/* 7. KPI grid — tappabili: aprono le liste filtrate (come le KPI desktop) */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, margin: '20px 15px 0' }}>
          <Link href="/preventivi?status=accepted" style={{ background: '#fff', borderRadius: 12, boxShadow: SH, padding: '14px 12px', textAlign: 'center', display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontSize: 12, color: '#55534b' }}>Preventivi accettati</div>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 5 }}>{acceptedThisMonthCount}</div>
            <div style={{ fontSize: 12, color: 'var(--cc-muted)', marginTop: 2 }}>{meseCorrente}</div>
          </Link>
          <Link href="/fatture?status=accepted" style={{ background: '#fff', borderRadius: 12, boxShadow: SH, padding: '14px 12px', textAlign: 'center', display: 'block', textDecoration: 'none', color: 'inherit' }}>
            <div style={{ fontSize: 12, color: '#55534b' }}>Fatturato</div>
            <div style={{ fontSize: 24, fontWeight: 600, marginTop: 5 }}>
              {paidFattureThisMonthValue === 0
                ? '€ 0'
                : `€\u00A0${paidFattureThisMonthValue.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0  })}`}
            </div>
            <div style={{ fontSize: 12, color: 'var(--cc-muted)', marginTop: 2 }}>{meseCorrente}</div>
          </Link>
        </div>

        {/* 8. Activity card — titoletto FUORI dalla card (stile Altro, Eli 2 ago sera) */}
        <div style={{ margin: '23px 15px 18px' }}>
          <div className="cc-section-label" style={{ margin: '0 2px 8px' }}>
            Attività recente
          </div>
          <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '2px 15px 8px' }}>

          {feed.length > 0 ? (
            feed.map((item, idx) => {
              const isLast = idx === feed.length - 1
              if (item.kind === 'lavoro') {
                const lav = item.lavoro
                const meta = LAVORO_STATUS_META[lav.status as LavoroStatus] ?? LAVORO_STATUS_META.da_iniziare
                const lavClient = lav.clients
                  ? [lav.clients.name, lav.clients.surname].filter(Boolean).join(' ')
                  : null
                const isNew = !!lav.created_at && lav.updated_at.slice(0, 16) === lav.created_at.slice(0, 16)
                return (
                  <Link
                    key={`lav-${lav.id}`}
                    href={`/lavori/${lav.id}`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '11px 0',
                      borderBottom: isLast ? 'none' : '0.5px solid #eeeeee',
                      textDecoration: 'none', color: 'inherit',
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cc-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lav.title ?? 'Lavoro'}{lavClient ? ` · ${lavClient}` : ''}
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 2 }}>
                        {isNew ? 'Lavoro creato' : 'Lavoro aggiornato'} il {new Date(lav.updated_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'Europe/Rome' }).replace('.', '')}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 600, color: meta.color,
                      padding: '3px 11px', borderRadius: 999,
                      background: meta.bg, flexShrink: 0,
                    }}>
                      {meta.label}
                    </span>
                  </Link>
                )
              }
              const doc = item.doc
              const docHref = doc.doc_type === 'fattura' ? `/fatture/${doc.id}` : `/preventivi/${doc.id}`
              const clientName = doc.clients
                ? [doc.clients.name, doc.clients.surname].filter(Boolean).join(' ')
                : null

              // "Prev" prefix solo in questo feed (⚠️ SOLO qui — spec REVISIONE_UI.md)
              const rawNum = formatDocNumber(doc.doc_number)
              const displayLabel = rawNum !== '—'
                ? (doc.doc_type === 'preventivo'
                    ? `Prev ${rawNum}`
                    : formatDocNumber(doc.doc_number, 'fattura'))
                : (doc.title ?? (doc.doc_type === 'fattura' ? 'Fattura' : 'Preventivo'))

              return (
                <Link
                  key={doc.id}
                  href={docHref}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 0',
                    borderBottom: isLast ? 'none' : '0.5px solid #eeeeee',
                    textDecoration: 'none', color: 'inherit',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--cc-text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {displayLabel}{clientName ? ` · ${clientName}` : ''}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 2 }}>
                      {formatCurrency(doc.total ?? 0)}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 12, fontWeight: 600, color: '#2b2b2b',
                    padding: '3px 11px', borderRadius: 999,
                    background: getMobileBadgeBg(doc.status), flexShrink: 0,
                  }}>
                    {getMobileBadgeLabel(doc.status, doc.doc_type)}
                  </span>
                </Link>
              )
            })
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px 0', gap: 12, textAlign: 'center' }}>
              <FileText size={32} style={{ color: 'var(--cc-muted)', opacity: 0.4 }} />
              <p style={{ margin: 0, fontSize: 14, color: 'var(--cc-muted)' }}>Nessun preventivo ancora.</p>
              <Button asChild size="sm">
                <Link href="/preventivi/nuovo">
                  <Plus />
                  Crea il primo
                </Link>
              </Button>
            </div>
          )}
          </div>
        </div>

      </div>
      {/* ══════════════════ END MOBILE ══════════════════════════════════════════ */}

      {/* ══════════════════ DESKTOP ═════════════════════════════════════════════ */}
      <div className="hidden lg:block p-6 max-w-5xl mx-auto space-y-6">

        {/* Blocked banners */}
        {isFree && freeTrialStatus?.blocked && freeTrialStatus.reason === 'trial_expired' && (
          <div className="flex items-start gap-3 rounded-lg border border-[#ecc9c9] bg-[#f5dede] px-4 py-3 text-sm text-[#b05656]">
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
          <div className="flex items-start gap-3 rounded-lg border border-[#ecc9c9] bg-[#f5dede] px-4 py-3 text-sm text-[#b05656]">
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
          <div className="flex items-center justify-between gap-4 rounded-lg border border-[#e8d6ad] bg-[#f5e9d0] px-4 py-3 text-sm text-[#b0863e]">
            <p>
              Hai inviato <strong>{freeTrialStatus.docsUsed} di {FREE_DOC_LIMIT}</strong> preventivi gratuiti.{' '}
              <Link href="/abbonamento" className="font-semibold underline underline-offset-2 hover:text-[#8a6c33]">
                Passa a Pro
              </Link>{' '}
              per preventivi illimitati, AI import e watermark rimovibile.
            </p>
          </div>
        )}

        {/* Intestazione + campanella (anche su desktop, come su mobile) */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Ciao, {fullName} 👋</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{workspaceName}</p>
          </div>
          <Link
            href="/notifiche"
            aria-label={unreadNotifications > 0 ? `Notifiche: ${unreadNotifications} non lette` : 'Notifiche'}
            style={{ position: 'relative', width: 38, height: 38, borderRadius: '50%', background: '#fff', border: '1px solid #e7e7ea', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 2px rgba(20,20,40,.05)', color: '#55534b', flexShrink: 0 }}
          >
            <Bell size={18} strokeWidth={1.9} />
            {unreadNotifications > 0 && (
              <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 17, height: 17, borderRadius: 999, background: '#b05656', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </Link>
        </div>

        {/* Oggi in agenda — sempre visibile (CTA se l'agenda è vuota) */}
        <TodayAgendaCard agenda={todayEvents} />

        {/* Alert automatici */}
        {(stale.length > 0 || expiringSoon.length > 0) && (
          <div className="space-y-2">
            {stale.length > 0 && (
              <div className="flex items-center gap-3 rounded-lg border border-[#e8d6ad] bg-[#f5e9d0] px-4 py-3 text-[#b0863e]">
                <AlertTriangle className="size-4 shrink-0 text-[#b0863e]" />
                <p className="text-sm flex-1">
                  <span className="font-semibold">{stale.length} {stale.length === 1 ? 'preventivo' : 'preventivi'}</span>
                  {' '}senza risposta da 14+ giorni.{' '}
                  <Link href="/preventivi/scadenze" className="underline underline-offset-2 font-medium hover:text-[#8a6c33]">
                    Manda un reminder →
                  </Link>
                </p>
              </div>
            )}
            {expiringSoon.map(d => (
              <div key={d.id} className="flex items-center gap-3 rounded-lg border border-[#ecc9c9] bg-[#f5dede] px-4 py-3 text-[#b05656]">
                <CalendarClock className="size-4 shrink-0 text-[#b05656]" />
                <p className="text-sm flex-1">
                  Il preventivo{' '}
                  <Link href={`/preventivi/${d.id}`} className="font-semibold underline underline-offset-2 hover:text-[#8f4444]">
                    {formatDocNumber(d.doc_number) !== '—' ? formatDocNumber(d.doc_number) : (d.title ?? 'Preventivo')}
                  </Link>
                  {' '}scade domani.
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Prossima scadenza */}
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
              <PendingDocCard
                documentId={pendingDoc.documentId}
                docNumber={pendingDoc.docNumber}
                title={pendingDoc.title}
                total={pendingDoc.total}
                sentAt={pendingDoc.sentAt}
                lastReminderAt={pendingDoc.lastReminderAt}
                updatedAfterSendAt={pendingDoc.updatedAfterSendAt}
                clientName={pendingDoc.clientName}
                clientEmail={pendingDoc.clientEmail}
                clientPhone={pendingDoc.clientPhone}
              />
            ) : (
              <div className="flex items-center gap-2 text-sm text-[#2f8a63]">
                <CheckCircle2 className="size-4 shrink-0" />
                Nessun preventivo in attesa ✅
              </div>
            )}
          </CardContent>
        </Card>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-3">
          <KpiCard
            title="Accettati questo mese"
            value={acceptedThisMonthCount}
            delta={suppressEarlyMonthDelta(now, deltaAcceptedCount, acceptedThisMonthCount)}
            icon={<CheckCircle2 className="size-3.5" />}
            sub={`${now.toLocaleDateString('it-IT', { month: 'long' , timeZone: 'Europe/Rome' })} · vs mese scorso`}
            href="/preventivi?status=accepted"
          />
          <KpiCard
            title="Valore accettati questo mese"
            value={formatCurrency(acceptedThisMonthValue)}
            delta={suppressEarlyMonthDelta(now, deltaAcceptedValue, acceptedThisMonthValue)}
            icon={<TrendingUp className="size-3.5" />}
            sub={`${now.toLocaleDateString('it-IT', { month: 'long' , timeZone: 'Europe/Rome' })} · vs mese scorso`}
            href="/preventivi?status=accepted"
          />
          <KpiCard
            title="Fatturato questo mese"
            value={formatCurrency(paidFattureThisMonthValue)}
            delta={suppressEarlyMonthDelta(now, deltaPaidFattureValue, paidFattureThisMonthValue)}
            icon={<FileText className="size-3.5" />}
            sub={`${now.toLocaleDateString('it-IT', { month: 'long' , timeZone: 'Europe/Rome' })} · vs mese scorso`}
            href="/fatture?status=accepted"
          />
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
                {draftPreventivi > 0 && (
                  <Link href="/preventivi?status=draft" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 group">
                    <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                    {draftPreventivi} {draftPreventivi === 1 ? 'preventivo' : 'preventivi'}
                  </Link>
                )}
                {draftFatture > 0 && (
                  <Link href="/fatture?status=draft" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 group">
                    <ArrowRight className="size-3 group-hover:translate-x-0.5 transition-transform" />
                    {draftFatture} {draftFatture === 1 ? 'fattura' : 'fatture'}
                  </Link>
                )}
                {draftDocs === 0 && (
                  <span className="text-xs text-muted-foreground">Nessuna bozza</span>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Trend revenue */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="size-4 text-muted-foreground" />
              Andamento ultimi 6 mesi
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 pb-4 px-4">
            <RevenueChartLazy data={chartData} />
          </CardContent>
        </Card>

        {/* Attività recente */}
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
                {feed.map(item => {
                  if (item.kind === 'lavoro') {
                    const lav = item.lavoro
                    const meta = LAVORO_STATUS_META[lav.status as LavoroStatus] ?? LAVORO_STATUS_META.da_iniziare
                    const lavClient = lav.clients
                      ? [lav.clients.name, lav.clients.surname].filter(Boolean).join(' ')
                      : null
                    const isNew = !!lav.created_at && lav.updated_at.slice(0, 16) === lav.created_at.slice(0, 16)
                    return (
                      <Link
                        key={`lav-${lav.id}`}
                        href={`/lavori/${lav.id}`}
                        className="flex items-center gap-3 py-2.5 hover:bg-muted/30 rounded transition-colors -mx-1 px-1"
                      >
                        <span className="shrink-0 mt-0.5"><Hammer className="size-4 text-muted-foreground" /></span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{lav.title ?? 'Lavoro'}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                            {lavClient && <span className="truncate min-w-0">{lavClient} ·</span>}
                            <span className="shrink-0">{isNew ? 'Lavoro creato' : 'Lavoro aggiornato'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {new Date(lav.updated_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', timeZone: 'Europe/Rome' })}
                          </span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: meta.color, background: meta.bg, padding: '3px 10px', borderRadius: 999 }}>
                            {meta.label}
                          </span>
                        </div>
                      </Link>
                    )
                  }
                  const doc = item.doc
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
                  const eventDateFormatted = new Date(eventDate).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' , timeZone: 'Europe/Rome' })

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
                        <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0">
                          {clientName && (
                            <span className="truncate min-w-0">{clientName} ·</span>
                          )}
                          <span className="shrink-0">{getEventLabel(doc.status, doc.doc_type)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="text-xs text-muted-foreground hidden sm:inline">
                          {eventDateFormatted}
                        </span>
                        <span className="text-sm font-medium text-muted-foreground">
                          {formatCurrency(doc.total ?? 0)}
                        </span>
                        <StatusBadge status={doc.status} showTooltip={false} />
                        {isModified && (
                          <span className="inline-flex items-center rounded border border-[#d6c9ef] bg-[#e9e0f7] px-1.5 py-0.5 text-[10px] font-medium text-[#7c3aed]">
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
      {/* ══════════════════ END DESKTOP ═════════════════════════════════════════ */}

    </div>
  )
}
