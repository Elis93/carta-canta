import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft, CheckCircle2, ChevronRight, Banknote } from 'lucide-react'
import { formatDocNumber, formatCurrency } from '@/lib/utils'

export const metadata = { title: 'Fatture da incassare' }

/**
 * Pagina "Fatture da incassare" — l'equivalente di /preventivi/scadenze per le fatture:
 * elenca le fatture inviate/viste NON ancora pagate, ordinate per scadenza di pagamento,
 * con evidenza di quelle scadute e del totale da incassare.
 */
export default async function FattureScadenzePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, name, ragione_sociale')
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
        .from('workspaces')
        .select('id, name, ragione_sociale')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }
  if (!workspace) redirect('/onboarding')

  const now = new Date()

  // Fatture inviate/viste (non ancora pagate/annullate), ordinate per scadenza pagamento
  const { data: docs } = await supabase
    .from('documents')
    .select('id, doc_number, title, total, sent_at, expires_at, client_id')
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'fattura')
    .in('status', ['sent', 'viewed'])
    .is('deleted_at', null)
    .order('expires_at', { ascending: true, nullsFirst: false })

  const rows = docs ?? []

  // Nomi cliente in un'unica query
  const clientIds = Array.from(new Set(rows.map((d) => d.client_id).filter(Boolean))) as string[]
  const clientNameById = new Map<string, string>()
  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name')
      .in('id', clientIds)
    for (const c of clients ?? []) clientNameById.set(c.id, c.name)
  }

  // KPI
  const totaleDaIncassare = rows.reduce((s, d) => s + (d.total ?? 0), 0)
  const scadute = rows.filter((d) => d.expires_at && new Date(d.expires_at) < now)
  const totaleScaduto = scadute.reduce((s, d) => s + (d.total ?? 0), 0)

  const fascia = '0.5px solid #eeeeee'

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header mobile */}
      <div className="lg:hidden -mx-4 -mt-4">
        <div style={{ background: '#fff', borderBottom: fascia, padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Link href="/fatture" style={{ color: '#55534b', display: 'flex', alignItems: 'center' }}>
            <ChevronLeft size={25} />
          </Link>
          <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: '#161616' }}>Fatture da incassare</span>
          <span style={{ width: 24 }} />
        </div>
      </div>

      {/* Header desktop */}
      <div className="hidden lg:block p-4 md:p-6 pb-0">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Banknote className="size-6 text-amber-500" />
          Fatture da incassare
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Fatture inviate non ancora pagate, ordinate per scadenza di pagamento.
        </p>
      </div>

      <div className="p-4 lg:p-6 space-y-4">
        {/* KPI */}
        <div style={{ display: 'flex', gap: 11 }}>
          <div style={{ flex: 1, background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '13px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8a887f' }}>Da incassare</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#161616', marginTop: 4 }}>{formatCurrency(totaleDaIncassare)}</div>
            <div style={{ fontSize: 12, color: '#8a887f', marginTop: 2 }}>{rows.length} fattur{rows.length === 1 ? 'a' : 'e'}</div>
          </div>
          <div style={{ flex: 1, background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '13px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8a887f' }}>Scaduto</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: scadute.length ? '#b05656' : '#161616', marginTop: 4 }}>{formatCurrency(totaleScaduto)}</div>
            <div style={{ fontSize: 12, color: '#8a887f', marginTop: 2 }}>{scadute.length} scadut{scadute.length === 1 ? 'a' : 'e'}</div>
          </div>
        </div>

        {/* Lista */}
        {rows.length > 0 ? (
          <div className="cc-card-md" style={{ padding: 0, overflow: 'hidden' }}>
            {rows.map((doc, i) => {
              const due = doc.expires_at ? new Date(doc.expires_at) : null
              const daysLeft = due ? Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null
              const overdue = daysLeft !== null && daysLeft < 0
              const soon = daysLeft !== null && daysLeft >= 0 && daysLeft <= 7
              const dueLabel = daysLeft === null
                ? 'Senza scadenza'
                : overdue
                  ? `Scaduta da ${Math.abs(daysLeft)} giorn${Math.abs(daysLeft) === 1 ? 'o' : 'i'}`
                  : daysLeft === 0
                    ? 'Scade oggi'
                    : daysLeft === 1
                      ? 'Scade domani'
                      : `Scade tra ${daysLeft} giorni`
              const dueColor = overdue ? '#b05656' : soon ? '#b0863e' : '#8a887f'
              const clientName = doc.client_id ? clientNameById.get(doc.client_id) ?? null : null
              return (
                <Link
                  key={doc.id}
                  href={`/fatture/${doc.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px', borderTop: i ? fascia : undefined, textDecoration: 'none' }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 600, color: '#161616', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.doc_number ? formatDocNumber(doc.doc_number, 'fattura') : (doc.title ?? 'Bozza')}
                      {clientName ? ` · ${clientName}` : ''}
                    </div>
                    <div style={{ fontSize: 12.5, color: dueColor, fontWeight: overdue || soon ? 600 : 400, marginTop: 2 }}>{dueLabel}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#161616', flexShrink: 0 }}>{formatCurrency(doc.total ?? 0)}</div>
                  <ChevronRight size={18} style={{ color: '#8a887f', flexShrink: 0 }} />
                </Link>
              )
            })}
          </div>
        ) : (
          <div className="cc-card-md" style={{ padding: '32px 15px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
            <CheckCircle2 className="size-10" style={{ color: '#2f8a63' }} />
            <p style={{ fontWeight: 600, color: '#161616' }}>Nessuna fattura da incassare</p>
            <p style={{ fontSize: 13, color: '#8a887f' }}>Tutte le fatture inviate risultano pagate.</p>
            <Link href="/fatture" style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', textDecoration: 'none', marginTop: 2 }}>Vedi tutte le fatture &rarr;</Link>
          </div>
        )}
      </div>
    </div>
  )
}
