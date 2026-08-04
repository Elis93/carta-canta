import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, Lock, TrendingUp } from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { formatCurrency } from '@/lib/utils'
import { expenseCategoryEmoji } from '@/lib/constants/expense-categories'
import { incassiFromDoc } from '@/lib/bilancio/incassi'
import { fetchAllRows } from '@/lib/supabase/fetch-all'
import { BackButton } from '@/components/shared/BackButton'
import { MonthPicker } from './_components/MonthPicker'
import { SwipeMonths } from './_components/SwipeMonths'
import { AddExpenseDialog } from './_components/AddExpenseDialog'
import { DeleteExpenseButton } from './_components/DeleteExpenseButton'
import { ExportBilancioButton } from './_components/ExportBilancioButton'

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
  document_log?: unknown
}

interface ExpenseRow {
  lavoro_id?: string | null
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
  searchParams: Promise<{ m?: string; y?: string }>
}) {
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  const isFree = workspace.plan === 'free'

  // ── Free: lucchetto (mockup 1d) — nessuna query ──────────────────────────
  if (isFree) {
    return (
      <div className="max-w-3xl mx-auto">
        <div className="lg:hidden" style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
          <BackButton fallback="/altro" />
          <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Bilancio</span>
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
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--cc-muted)' }}>{kpi.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: kpi.color }}>{kpi.value}</div>
            </div>
          ))}
        </div>

        {/* Card lucchetto */}
        <div style={{ margin: '13px 15px 0', background: '#fff', borderRadius: 14, borderLeft: '3px solid #c9a44c', boxShadow: SH, padding: '22px 16px', textAlign: 'center' }}>
          <Lock size={26} style={{ color: '#b08d3e', display: 'inline-block' }} />
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 8, color: '#161616' }}>Il bilancio è una funzione Pro</div>
          <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, marginTop: 6 }}>
            Entrate, uscite e utile del mese sempre sotto controllo: il quadro economico della tua attività, aggiornato in automatico.
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

  // ── Periodo: MESE (?m=YYYY-MM, default) oppure ANNO (?y=YYYY) ───────────
  // L'anno (Eli 4 ago: "e se vogliamo avere il bilancio annuale?") usa la
  // stessa pagina: cambiano il periodo dei KPI, il numero di barre del
  // grafico e il modo di elencare le spese (per categoria invece che una
  // per una).
  const now = new Date()
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const { m, y } = await searchParams
  const isYear = !!y && /^\d{4}$/.test(y)
  const selYear = isYear ? Math.min(Number(y), now.getFullYear()) : now.getFullYear()

  let selStart = currentMonthStart
  if (!isYear && m && /^\d{4}-\d{2}$/.test(m)) {
    const [yy, mo] = m.split('-').map(Number)
    if (mo >= 1 && mo <= 12) selStart = new Date(yy, mo - 1, 1)
    // Niente mesi futuri: clamp al mese corrente
    if (selStart > currentMonthStart) selStart = currentMonthStart
  }
  if (isYear) selStart = new Date(selYear, 0, 1)

  // Periodo dei KPI: il mese scelto, oppure l'anno intero
  const periodStart = isYear ? new Date(selYear, 0, 1) : selStart
  const periodEnd = isYear ? new Date(selYear + 1, 0, 1) : new Date(selStart.getFullYear(), selStart.getMonth() + 1, 1)
  const selEnd = periodEnd
  const isCurrentMonth = monthKey(selStart) === monthKey(currentMonthStart)
  const isCurrentYear = selYear === now.getFullYear()

  const prevMonth = new Date(selStart.getFullYear(), selStart.getMonth() - 1, 1)
  const nextMonth = new Date(selStart.getFullYear(), selStart.getMonth() + 1, 1)

  // Finestra dati: 6 mesi che terminano nel mese scelto, oppure i 12 mesi
  // dell'anno. ⚠️ La finestra serve anche contro la troncatura silenziosa a
  // 1.000 righe: in modalità ANNO le query passano da fetchAllRows.
  const chartStart = isYear
    ? new Date(selYear, 0, 1)
    : new Date(selStart.getFullYear(), selStart.getMonth() - 5, 1)
  const chartEnd = isYear ? new Date(selYear + 1, 0, 1) : selEnd
  const rangeStartIso = chartStart.toISOString().slice(0, 10)
  const rangeEndIso = chartEnd.toISOString().slice(0, 10)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne/tabella 038 non ancora in types/database.ts
  const db = supabase as any

  // ── Entrate: fatture pagate + acconti incassati (criterio di cassa) ─────
  // Tollerante pre-migration: se le colonne 038 mancano, fallback alle sole
  // fatture con stato "Pagata" (accepted).
  let entrateDocs: EntrataDoc[] = []
  // PERF: entrate, spese e lavori attivi sono indipendenti → un solo round
  // trip invece di tre in serie. Il fallback pre-migration resta sequenziale
  // (parte solo se le colonne 038 mancano).
  const [{ data: richDocs, error: richError }, { data: expenseRows, error: expenseError }, lavoriRes] = await Promise.all([
    (isYear
      ? fetchAllRows(() => db
          .from('documents')
          .select('id, doc_type, status, total, paid_at, paid_amount, payment_status, accepted_at, updated_at, document_log')
          .eq('workspace_id', workspace.id)
          .is('deleted_at', null)
          .or('and(doc_type.eq.fattura,status.eq.accepted),payment_status.in.(partial,paid)')
          .gte('updated_at', chartStart.toISOString()))
      : db
      .from('documents')
      .select('id, doc_type, status, total, paid_at, paid_amount, payment_status, accepted_at, updated_at, document_log')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .or('and(doc_type.eq.fattura,status.eq.accepted),payment_status.in.(partial,paid)')
      // Finestra temporale come per le spese: senza, la query scaricava
      // TUTTO lo storico e sopra il tetto righe dell'API (1.000 di default su
      // Supabase) le entrate sarebbero state troncate IN SILENZIO — numeri
      // del Bilancio sbagliati senza alcun avviso. Il filtro è su updated_at
      // perché l'incasso è un UPDATE (trigger trg_documents_updated_at):
      // paid_at ≤ updated_at sempre, quindi nessuna riga della finestra può
      // sfuggire. Stesso ragionamento già applicato alla Home (14 lug).
      .gte('updated_at', chartStart.toISOString())
    ),
    // `lavoro_id` (049) serve a dividere COSTI DEI LAVORI e SPESE GENERALI.
    // In modalità ANNO si pagina (fetchAllRows): un anno di spese può
    // superare il tetto righe e verrebbe troncato IN SILENZIO.
    (isYear
      ? fetchAllRows(() => db
          .from('expenses')
          .select('id, date, description, amount, category, lavoro_id')
          .eq('workspace_id', workspace.id)
          .is('deleted_at', null)
          .gte('date', rangeStartIso)
          .lt('date', rangeEndIso))
      : db
          .from('expenses')
          .select('id, date, description, amount, category, lavoro_id')
          .eq('workspace_id', workspace.id)
          .is('deleted_at', null)
          .gte('date', rangeStartIso)
          .order('date', { ascending: false })
      // NB: i builder PostgREST sono solo PromiseLike (then, niente .catch diretto)
    ).then((r: { data: unknown[] | null; error: unknown }) => r, () => ({ data: null, error: true })), // tabella 038 assente
    db
      .from('lavori')
      .select('id, title')
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .in('status', ['da_iniziare', 'in_corso', 'finito'])
      .order('updated_at', { ascending: false })
      .limit(30)
      .then((r: { data: unknown[] | null }) => r.data)
      .catch(() => null), // tabella 048 assente
  ])
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
      .gte('updated_at', chartStart.toISOString())
    entrateDocs = (baseDocs ?? []).map((d) => ({
      ...d,
      paid_at: null,
      paid_amount: null,
      payment_status: null,
    }))
  }

  // Eventi di incasso: dalla STORIA nel document_log (ogni acconto/saldo nel
  // suo mese; gli azzeramenti annullano l'incasso nel mese d'origine, mai
  // mesi negativi — decisione Eli 4 ago) — così l'acconto non "migra" più nel
  // mese del saldo. Fallback ai campi denormalizzati per i documenti storici.
  const incassi = entrateDocs.flatMap((doc) => incassiFromDoc(doc))

  // ── Uscite: spese del range (tollerante se la tabella non esiste) ──────
  // Query eseguita nel Promise.all sopra.
  let expenses: ExpenseRow[] = []
  if (!expenseError && expenseRows) expenses = expenseRows as ExpenseRow[]

  // ── Aggregati mese selezionato ──────────────────────────────────────────
  const entrateMese = incassi
    .filter((i) => i.when >= periodStart && i.when < periodEnd)
    .reduce((s, i) => s + i.amount, 0)
  const speseMese = expenses.filter((e) => {
    const d = new Date(e.date + 'T00:00:00')
    return d >= periodStart && d < periodEnd
  })
  const usciteMese = speseMese.reduce((s, e) => s + e.amount, 0)
  const utileMese = entrateMese - usciteMese

  // ── Uscite in due blocchi (Eli 4 ago: "dove sono i costi dei lavori?") ──
  // COSTI DEI LAVORI = spese collegate a un lavoro (expenses.lavoro_id, 049);
  // SPESE GENERALI = tutto il resto (carburante, attrezzatura, tasse…).
  // ⚠️ NON si sommano qui i costi delle VOCI (unit_cost) né le ore: i primi
  // sarebbero un doppio conteggio col materiale comprato davvero, le seconde
  // non sono denaro uscito dal conto (vivono sulla scheda Lavoro).
  const speseLavori = speseMese.filter((e) => !!e.lavoro_id)
  const speseGenerali = speseMese.filter((e) => !e.lavoro_id)
  const totLavori = speseLavori.reduce((s, e) => s + e.amount, 0)
  const totGenerali = speseGenerali.reduce((s, e) => s + e.amount, 0)

  // Riepilogo per categoria (usato in modalità ANNO: elencare 300 spese una
  // per una non serve a nessuno)
  const perCategoria = Object.entries(
    speseMese.reduce<Record<string, number>>((acc, e) => {
      const k = e.category ?? 'Altro'
      acc[k] = (acc[k] ?? 0) + e.amount
      return acc
    }, {})
  ).sort((a, b) => b[1] - a[1])

  // ── Grafico: 6 mesi fino al mese scelto, oppure i 12 mesi dell'anno ─────
  const chartMonths = Array.from({ length: isYear ? 12 : 6 }, (_, i) => {
    const start = isYear
      ? new Date(selYear, i, 1)
      : new Date(selStart.getFullYear(), selStart.getMonth() - 5 + i, 1)
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
    const entrate = incassi.filter((x) => x.when >= start && x.when < end).reduce((s, x) => s + x.amount, 0)
    const uscite = expenses
      .filter((e) => { const d = new Date(e.date + 'T00:00:00'); return d >= start && d < end })
      .reduce((s, e) => s + e.amount, 0)
    return {
      label: start.toLocaleDateString('it-IT', { month: 'short' }).replace('.', '').toUpperCase(),
      key: monthKey(start),
      // In modalità anno nessun mese è "quello scelto": il periodo è l'anno
      selected: !isYear && start.getTime() === selStart.getTime(),
      entrate,
      uscite,
    }
  })
  const chartMax = Math.max(1, ...chartMonths.flatMap((c) => [c.entrate, c.uscite]))
  const barHeight = (v: number) => (v <= 0 ? 2 : Math.max(3, Math.round((v / chartMax) * 58)))

  const meseLabelShort = selStart.toLocaleDateString('it-IT', { month: 'long' })

  // Lavori attivi per il collegamento spesa→lavoro (margine, 048/049) —
  // tollerante; query eseguita nel Promise.all sopra.
  const lavoriAttivi = (lavoriRes ?? []) as Array<{ id: string; title: string }>

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header mobile — fascia bianca */}
      <div className="lg:hidden" style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Bilancio</span>
        <ExportBilancioButton />
      </div>

      {/* Header desktop */}
      <div className="hidden lg:block p-6 pb-0">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="size-6" style={{ color: '#b08d3e' }} />
            Bilancio
          </h1>
          <ExportBilancioButton />
        </div>
      </div>

      {/* Selettore mese — prefetch={true} sulle frecce: il payload del mese
          adiacente viene scaricato in anticipo → il cambio è quasi istantaneo
          (feedback Eli 18 lug: "quando passo da un mese all'altro ci mette
          molto"). I salti liberi dal picker mostrano la rotellina. */}
      {/* Mese / Anno (Eli 4 ago) — due linguette, la scelta cambia periodo,
          grafico e modo di elencare le spese */}
      <div style={{ display: 'flex', gap: 7, margin: '14px 15px 0', background: '#fff', borderRadius: 12, padding: 4, boxShadow: SH }}>
        {[
          { label: 'Mese', href: `/bilancio?m=${monthKey(currentMonthStart)}`, on: !isYear },
          { label: 'Anno', href: `/bilancio?y=${now.getFullYear()}`, on: isYear },
        ].map((t) => (
          <Link
            key={t.label}
            href={t.href}
            replace
            prefetch={true}
            style={{
              flex: 1, textAlign: 'center', padding: '9px 0', borderRadius: 9,
              fontSize: 14, fontWeight: 600, textDecoration: 'none',
              background: t.on ? '#1a1a2e' : 'transparent',
              color: t.on ? '#fff' : '#55534b',
            }}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14, margin: '13px 15px 0', fontSize: 14, fontWeight: 600, color: '#161616' }}>
        {isYear ? (
          <>
            <Link href={`/bilancio?y=${selYear - 1}`} replace prefetch={true} aria-label="Anno precedente" style={{ color: 'var(--cc-muted)', display: 'flex', padding: 4 }}>
              <ChevronLeft size={18} />
            </Link>
            <span style={{ minWidth: 120, textAlign: 'center' }}>Anno {selYear}</span>
            {isCurrentYear ? (
              <span style={{ width: 26 }} aria-hidden />
            ) : (
              <Link href={`/bilancio?y=${selYear + 1}`} replace prefetch={true} aria-label="Anno successivo" style={{ color: 'var(--cc-muted)', display: 'flex', padding: 4 }}>
                <ChevronRight size={18} />
              </Link>
            )}
          </>
        ) : (
          <>
            <Link href={`/bilancio?m=${monthKey(prevMonth)}`} replace prefetch={true} aria-label="Mese precedente" style={{ color: 'var(--cc-muted)', display: 'flex', padding: 4 }}>
              <ChevronLeft size={18} />
            </Link>
            <MonthPicker value={monthKey(selStart)} max={monthKey(currentMonthStart)} label={monthLabel(selStart)} />
            {isCurrentMonth ? (
              <span style={{ width: 26 }} aria-hidden />
            ) : (
              <Link href={`/bilancio?m=${monthKey(nextMonth)}`} replace prefetch={true} aria-label="Mese successivo" style={{ color: 'var(--cc-muted)', display: 'flex', padding: 4 }}>
                <ChevronRight size={18} />
              </Link>
            )}
          </>
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
            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--cc-muted)' }}>{kpi.label}</div>
            <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: kpi.color, whiteSpace: 'nowrap' }}>{formatCurrency(kpi.value)}</div>
          </div>
        ))}
      </div>

      {/* Grafico ultimi 6 mesi — scorri con il dito per cambiare mese (19 lug) */}
      <SwipeMonths
        prevHref={isYear ? `/bilancio?y=${selYear - 1}` : `/bilancio?m=${monthKey(prevMonth)}`}
        nextHref={isYear
          ? (isCurrentYear ? null : `/bilancio?y=${selYear + 1}`)
          : (isCurrentMonth ? null : `/bilancio?m=${monthKey(nextMonth)}`)}
      >
      <div style={{ margin: '13px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: 14 }}>
        <div className="cc-section-label" style={{ marginBottom: 10 }}>
          {isYear ? `Andamento ${selYear} · tocca un mese per vederlo` : 'Andamento · tocca un mese o scorri per cambiare'}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 7, height: 74, marginTop: 10 }}>
          {/* Tap su un mese → i KPI e le spese sopra passano a quel mese
              (feedback Eli: vedere il dettaglio dei 3 valori dal grafico) */}
          {chartMonths.map((cm) => (
            <Link
              key={cm.key}
              replace
              href={`/bilancio?m=${cm.key}`}
              aria-label={`Vedi ${cm.label}: entrate ${formatCurrency(cm.entrate)}, uscite ${formatCurrency(cm.uscite)}`}
              style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textDecoration: 'none', borderRadius: 8, background: cm.selected ? '#f5f0e2' : 'transparent', padding: '4px 0 2px' }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 58, width: '100%', justifyContent: 'center' }}>
                <div style={{ width: 9, borderRadius: '3px 3px 0 0', background: '#1a1a2e', height: barHeight(cm.entrate) }} title={`Entrate ${formatCurrency(cm.entrate)}`} />
                <div style={{ width: 9, borderRadius: '3px 3px 0 0', background: '#c9c9d0', height: barHeight(cm.uscite) }} title={`Uscite ${formatCurrency(cm.uscite)}`} />
              </div>
              <span style={{ fontSize: 11, color: cm.selected ? '#b0863e' : 'var(--cc-muted)', fontWeight: 600 }}>{cm.label}</span>
            </Link>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#767676', marginTop: 9 }}>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, marginRight: 4, background: '#1a1a2e' }} />Entrate</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, marginRight: 4, background: '#c9c9d0' }} />Uscite</span>
        </div>
      </div>
      </SwipeMonths>

      {/* ── USCITE ─────────────────────────────────────────────────────────
          Mese: due blocchi (costi dei lavori / spese generali) con le voci.
          Anno: riepilogo per categoria (elencare un anno di spese non serve). */}
      {isYear ? (
        <div style={{ margin: '13px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: 14 }}>
          <div className="cc-section-label" style={{ marginBottom: perCategoria.length > 0 ? 4 : 8 }}>
            Uscite {selYear} per categoria
          </div>
          {perCategoria.length > 0 ? (
            <>
              {perCategoria.map(([cat, tot], i) => (
                <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: i < perCategoria.length - 1 ? FASCIA : 'none' }}>
                  <span style={{ width: 32, height: 32, borderRadius: 10, background: '#f2f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }} aria-hidden>
                    {expenseCategoryEmoji(cat)}
                  </span>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, color: '#161616' }}>{cat}</div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: '#161616', whiteSpace: 'nowrap' }}>{formatCurrency(tot)}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 11, marginTop: 4, borderTop: '1px solid #eee', fontSize: 13, color: 'var(--cc-muted)' }}>
                <span>Di cui costi legati ai lavori</span>
                <span style={{ fontWeight: 600, color: '#161616' }}>{formatCurrency(totLavori)}</span>
              </div>
            </>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--cc-muted)', padding: '4px 0 6px' }}>
              Nessuna spesa registrata nel {selYear}.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Costi dei lavori (spese collegate a un lavoro) */}
          {speseLavori.length > 0 && (
            <div style={{ margin: '13px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: 14 }}>
              <div className="cc-section-label" style={{ marginBottom: 4, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span>Costi dei lavori</span>
                <span style={{ color: '#161616' }}>{formatCurrency(totLavori)}</span>
              </div>
              {speseLavori.map((e, i) => (
                <ExpenseRowView key={e.id} e={e} last={i === speseLavori.length - 1} />
              ))}
            </div>
          )}

          {/* Spese generali (tutto ciò che non è di un lavoro) */}
          <div style={{ margin: '13px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: 14 }}>
            <div className="cc-section-label" style={{ marginBottom: speseGenerali.length > 0 ? 4 : 8, display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span>{speseLavori.length > 0 ? 'Spese generali' : `Spese di ${meseLabelShort}`}</span>
              {speseGenerali.length > 0 && <span style={{ color: '#161616' }}>{formatCurrency(totGenerali)}</span>}
            </div>
            {speseGenerali.length > 0 ? (
              speseGenerali.map((e, i) => (
                <ExpenseRowView key={e.id} e={e} last={i === speseGenerali.length - 1} />
              ))
            ) : (
              <p style={{ fontSize: 13, color: 'var(--cc-muted)', padding: '4px 0 6px' }}>
                {speseLavori.length > 0
                  ? `Nessuna spesa generale a ${meseLabelShort} (bollette, carburante, attrezzatura…).`
                  : `Nessuna spesa registrata a ${meseLabelShort}. Le entrate arrivano da sole dalle fatture segnate pagate; le spese le aggiungi tu qui sotto.`}
              </p>
            )}
          </div>
        </>
      )}

      {/* Aggiungi spesa */}
      <div style={{ margin: '13px 15px 0' }}>
        <AddExpenseDialog lavori={lavoriAttivi} />
      </div>

      {/* ── Righe di verità (4 ago) ────────────────────────────────────────
          Questa pagina è un quadro di CASSA, non un bilancio contabile: va
          detto. E per i forfettari — la fetta più grande del target — va
          detto che le spese registrate qui NON abbassano le tasse (si paga
          sul fatturato per coefficiente ATECO): senza, l'artigiano può
          credere che comprare attrezzatura riduca le imposte.
          🔒 Testo da far validare al commercialista (regola B.0). */}
      <div style={{ margin: '14px 15px 0', fontSize: 13, color: 'var(--cc-muted)', lineHeight: 1.55 }}>
        Qui vedi i soldi <b style={{ color: '#55534b' }}>entrati e usciti davvero</b>: è il quadro
        della tua cassa, non un bilancio contabile, e non sostituisce il commercialista.
        {workspace.fiscal_regime === 'forfettario' && (
          <>
            {' '}Nel <b style={{ color: '#55534b' }}>regime forfettario</b>{' '}le tasse si calcolano
            sul fatturato con il coefficiente del tuo codice ATECO: le spese che registri qui{' '}
            <b style={{ color: '#55534b' }}>non abbassano le tasse</b>, servono a farti capire
            quanto ti resta davvero.
          </>
        )}
      </div>

      <div style={{ height: 16 }} />
    </div>
  )
}

// Riga di spesa (condivisa dai due blocchi delle uscite)
function ExpenseRowView({ e, last }: { e: ExpenseRow; last: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: last ? 'none' : FASCIA }}>
      <span style={{ width: 32, height: 32, borderRadius: 10, background: '#f2f2f5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }} aria-hidden>
        {expenseCategoryEmoji(e.category)}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}>{e.description}</div>
        <div style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 1 }}>
          {e.category ?? 'Altro'} · {new Date(e.date + 'T00:00:00').toLocaleDateString('it-IT', { day: 'numeric', month: 'short' }).replace('.', '')}
        </div>
      </div>
      <span style={{ fontSize: 14, fontWeight: 700, color: '#161616', whiteSpace: 'nowrap' }}>{formatCurrency(e.amount)}</span>
      <DeleteExpenseButton expenseId={e.id} description={e.description} />
    </div>
  )
}
