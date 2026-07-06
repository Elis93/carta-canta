import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Lock, TrendingUp } from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { formatCurrency } from '@/lib/utils'
import { expenseCategoryEmoji } from '@/lib/constants/expense-categories'
import { BackButton } from '@/components/shared/BackButton'
import { AddExpenseDialog } from './_components/AddExpenseDialog'
import { DeleteExpenseButton } from './_components/DeleteExpenseButton'

export const metadata = { title: 'Bilancio' }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'
const FASCIA = '0.5px solid #eeeeee'

// ── Tipi (tabella/colonne 038 non ancora in types/database.ts) ─────────────
interface EntrataDoc {
  id: string
  doc_type: string
  status: string
  total: number | null
  paid_at: string | null
  paid_amount: number | null
  payment_status: string | null
  accepted_at: string | null
  updated_at: string | null
}

interface ExpenseRow {
  id: string
  date: string
  description: string
  amount: number
  category: string | null
}

function monthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(d: Date): string {
  const label = d.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default async function BilancioPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string }>
}) {
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  const isFree = workspace.plan === 'free'

  // ── Free: lucchetto (mockup 1d) — nessuna query ──────────────────────────
  if (isFree) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="lg:hidden" style={{ background: '#fff', borderBottom: FASCIA, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
          <BackButton fallback="/altro" />
          <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: '#161616' }}>Bilancio</span>
          <span style={{ width: 24 }} />
        </div>
        <div className="hidden lg:block p-6 pb-0">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="size-6" style={{ color: '#b08d3e' }} />
            Bilancio
          </h1>
        </div>

        {/* Assaggio sfocato */}
        <div style={{ margin: '14px 15px 0', display: 'flex', gap: 8, filter: 'blur(2.5px)', opacity: 0.55, pointerEvents: 'none' }} aria-hidden>
          {[
            { label: 'Entrate', value: '€ 4.820,00', color: '#2f8a63' },
            { label: 'Uscite', value: '€ 1.635,50', color: '#b05656' },
            { label: 'Utile', value: '€ 3.184,50', color: '#161616' },
          ].map((kpi) => (
            <div key={kpi.label} style={{ flex: 1, background: '#fff', borderRadius: 14, padding: '11px 8px', textAlign: 'center', boxShadow: SH }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8a887f' }}>{kpi.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: kpi.color }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Card lucchetto */}
        <div style={{ margin: '13px 15px 0', background: '#fff', borderRadius: 14, borderLeft: '3px solid #c9a44c', boxShadow: SH, padding: '22px 16px', textAlign: 'center' }}>
          <Lock size={26} style={{ color: '#b08d3e', display: 'inline-block' }} />
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 8, color: '#161616' }}>Il bilancio è una funzione Pro</div>
          <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, marginTop: 6 }}>
            Vedi quanto entra, quanto esce e quanto ti resta in tasca — mese per mese, senza commercialista.
          </p>
          <Link
            href="/abbonamento"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 48, borderRadius: 12, background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none', boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', marginTop: 14 }}
          >
            Passa a Pro
          </Link>
        </div>
        <div style={{ height: 16 }} />
      </div>
    )
  }

  // ── Mese selezionato (?m=YYYY-MM, default mese corrente) ────────────────
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const { m } = await searchParams
  let selStart = currentMonthStart
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split('-').map(Number)
    if (mo >= 1 && mo <= 12) selStart = new Date(y, mo - 1, 1)
  }
  const selEnd = new Date(selStart.getFullYear(), selStart.getMonth() + 1, 1)
  const isCurrentMonth = monthKey(selStart) === monthKey(currentMonthStart)

  const prevMonth = new Date(selStart.getFullYear(), selStart.getMonth() - 1, 1)
  const nextMonth = new Date(selStart.getFullYear(), selStart.getMonth() + 1, 1)

  // Intervallo dati: copre il mese selezionato E gli ultimi 6 mesi (grafico)
  const chartStart = new Date(now.getFullYear(), now.getMonth() - 5, 1)
  const rangeStart = selStart < chartStart ? selStart : chartStart
  const rangeStartIso = rangeStart.toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne/tabella 038 non ancora in types/database.ts
  const db = supabase as any

  // ── Entrate: fatture pagate + acconti incassati (criterio di cassa) ─────
  // Tollerante pre-migration: se le colonne 038 mancano, fallback alle sole
  // fatture con stato "Pagata" (accepted).
  let entrateDocs: EntrataDoc[] = []
  const { data: richDocs, error: richError } = await db
    .from('documents')
    .select('id, doc_type, status, total, paid_at, paid_amount, payment_status, accepted_at, updated_at')
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .or('and(doc_type.eq.fattura,status.eq.accepted),payment_status.in.(partial,paid)')
  if (!richError && richDocs) {
    entrateDocs = richDocs as EntrataDoc[]
  } else {
    const { data: baseDocs } = await supabase
      .from('documents')
      .select('id, doc_type, status, total, accepted_at, updated_at')
      .eq('workspace_id', workspace.id)
      .eq('doc_type', 'fattura')
      .eq('status', 'accepted')
      .is('deleted_at', null)
    entrateDocs = (baseDocs ?? []).map((d) => ({
      ...d,
      paid_at: null,
      paid_amount: null,
      payment_status: null,
    }))
  }

  // Evento di incasso per documento: quando e quanto
  const incassi = entrateDocs.map((doc) => {
    const when = new Date(doc.paid_at ?? doc.accepted_at ?? doc.updated_at ?? 0)
    const amount =
      doc.payment_status === 'partial'
        ? doc.paid_amount ?? 0
        : doc.paid_amount ?? doc.total ?? 0
    return { when, amount }
  })

  // ── Uscite: spese del range (tollerante se la tabella non esiste) ──────
  let expenses: ExpenseRow[] = []
  const { data: expenseRows, error: expenseError } = await db
    .from('expenses')
    .select('id, date, description, amount, category')
    .eq('workspace_id', workspace.id)
    .is('deleted_at', null)
    .gte('date', rangeStartIso)
    .order('date', { ascending: false })
  if (!expenseError && expenseRows) expenses = expenseRows as ExpenseRow[]

  // ── Aggregati mese selezionato ──────────────────────────────────────────
  const entrateMese = incassi
    .filter((i) => i.when >= selStart && i.when < selEnd)
    .reduce((s, i) => s + i.amount, 0)
  const speseMese = expenses.filter((e) => {
    const d = new Date(e.date + 'T00:00:00')
    return d >= selStart && d < selEnd
  })
  const usciteMese = speseMese.reduce((s, e) => s + e.amount, 0)
  const utileMese = entrateMese - usciteMese

  // ── Grafico ultimi 6 mesi ────────────────────────────────────────────────
  const chartMonths = Array.from({ length: 6 }, (_, i) => {
    const start = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1)
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
    const entrate = incassi.filter((x) => x.when >= start && x.when < end).reduce((s, x) => s + x.amount, 0)
    const uscite = expenses
      .filter((e) => { const d = new Date(e.date + 'T00:00:00'); return d >= start && d < end })
      .reduce((s, e) => s + e.amount, 0)
    return { label: start.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '').toUpperCase(), entrate, uscite }
  })
  const chartMax = Math.max(1, ...chartMonths.flatMap((c) => [c.entrate, c.uscite]))
  const barHeight = (v: number) => (v <= 0 ? 2 : Math.max(3, Math.round((v / chartMax) * 58)))

  const meseLabelShort = selStart.toLocaleDateString('it-IT', { month: 'long' })

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header mobile — fascia bianca */}
      <div className="lg:hidden" style={{ background: '#fff', borderBottom: FASCIA, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: '#161616' }}>Bilancio</span>
        <span style={{ width: 24 }} />
      </div>

      {/* Header desktop */}
      <div className="hidden lg:block p-6 pb-0">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <TrendingUp className="size-6" style={{ color: '#b08d3e' }} />
          Bilancio
        </h1>
      </div>

      {/* Selettore mese */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, margin: '15px 15px 0', fontSize: 14, fontWeight: 600, color: '#161616' }}>
        <Link href={`/bilancio?m=${monthKey(prevMonth)}`} aria-label="Mese precedente" style={{ color: '#8a887f', display: 'flex', padding: 4 }}>
          <ChevronLeft size={18} />
        </Link>
        <span style={{ minWidth: 130, textAlign: 'center' }}>{monthLabel(selStart)}</span>
        {isCurrentMonth ? (
          <span style={{ width: 26 }} aria-hidden />
        ) : (
          <Link href={`/bilancio?m=${monthKey(nextMonth)}`} aria-label="Mese successivo" style={{ color: '#8a887f', display: 'flex', padding: 4 }}>
            <ChevronRight size={18} />
          </Link>
        )}
      </div>

      {/* KPI Entrate / Uscite / Utile */}
      <div style={{ margin: '12px 15px 0', display: 'flex', gap: 8 }}>
        {[
          { label: 'Entrate', value: entrateMese, color: '#2f8a63' },
          { label: 'Uscite', value: usciteMese, color: '#b05656' },
          { label: 'Utile', value: utileMese, color: utileMese < 0 ? '#b05656' : '#161616' },
        ].map((kpi) => (
          <div key={kpi.label} style={{ flex: 1, background: '#fff', borderRadius: 14, padding: '11px 8px', textAlign: 'center', boxShadow: SH }}>
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8a887f' }}>{kpi.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: kpi.color, whiteSpace: 'nowrap' }}>{formatCurrency(kpi.value)}</div>
          </div>
        ))}
      </div>

      {/* Grafico ultimi 6 mesi */}
      <div style={{ margin: '13px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 10 }}>
          Ultimi 6 mesi
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: 74, marginTop: 10 }}>
          {chartMonths.map((cm) => (
            <div key={cm.label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 58, width: '100%', justifyContent: 'center' }}>
                <div style={{ width: 9, borderRadius: '3px 3px 0 0', background: '#1a1a2e', height: barHeight(cm.entrate) }} title={`Entrate ${formatCurrency(cm.entrate)}`} />
                <div style={{ width: 9, borderRadius: '3px 3px 0 0', background: '#c9c9d0', height: barHeight(cm.uscite) }} title={`Uscite ${formatCurrency(cm.uscite)}`} />
              </div>
              <span style={{ fontSize: 11, color: '#8a887f', fontWeight: 600 }}>{cm.label}</span>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#767676', marginTop: 9 }}>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, marginRight: 4, background: '#1a1a2e' }} />Entrate</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, marginRight: 4, background: '#c9c9d0' }} />Uscite</span>
        </div>
      </div>

      {/* Spese del mese */}
      <div style={{ margin: '13px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: speseMese.length > 0 ? 4 : 8 }}>
          Spese di {meseLabelShort}
        </div>
        {speseMese.length > 0 ? (
          speseMese.map((e, i) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < speseMese.length - 1 ? FASCIA : 'none' }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, background: '#f2f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }} aria-hidden>
                {expenseCategoryEmoji(e.category)}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#161616' }}>{e.description}</div>
                <div style={{ fontSize: 12, color: '#8a887f', marginTop: 1 }}>
                  {e.category ?? 'Altro'} · {new Date(e.date + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '')}
                </div>
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: '#161616', whiteSpace: 'nowrap' }}>{formatCurrency(e.amount)}</span>
              <DeleteExpenseButton expenseId={e.id} description={e.description} />
            </div>
          ))
        ) : (
          <p style={{ fontSize: 13, color: '#8a887f', padding: '4px 0 6px' }}>
            Nessuna spesa registrata a {meseLabelShort}. Le entrate arrivano da sole dalle fatture segnate pagate; le spese le aggiungi tu qui sotto.
          </p>
        )}
      </div>

      {/* Aggiungi spesa */}
      <div style={{ margin: '13px 15px 0' }}>
        <AddExpenseDialog />
      </div>

      <div style={{ height: 16 }} />
    </div>
  )
}
