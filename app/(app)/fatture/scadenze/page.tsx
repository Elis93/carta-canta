import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { ChevronLeft, CheckCircle2, Banknote } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { ScadenzaSollecitoCard } from '@/components/shared/ScadenzaSollecitoCard'

export const metadata = { title: 'Fatture da incassare' }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'
const FASCIA = '0.5px solid #eeeeee'

/**
 * Pagina "Fatture da incassare / Solleciti" — layout dal mockup
 * "Fatture — Da incassare / Solleciti" (Carta_Canta_mockup_pagine2.html).
 */
export default async function FattureScadenzePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Workspace
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

  const workspaceName = workspace.ragione_sociale || workspace.name || null

  const now = new Date()

  // Fatture inviate/viste non ancora pagate, ordinate per scadenza di pagamento
  const { data: docs } = await supabase
    .from('documents')
    .select('id, doc_number, title, total, status, expires_at, updated_after_send_at, public_token, client_id')
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'fattura')
    .in('status', ['sent', 'viewed'])
    .is('deleted_at', null)
    .order('expires_at', { ascending: true, nullsFirst: false })

  const rows = docs ?? []

  // Dati cliente in un'unica query
  const clientIds = Array.from(new Set(rows.map((d) => d.client_id).filter(Boolean))) as string[]
  const clientById = new Map<string, { name: string | null; email: string | null; phone: string | null }>()
  if (clientIds.length > 0) {
    const { data: clients } = await supabase
      .from('clients')
      .select('id, name, email, phone')
      .in('id', clientIds)
    for (const c of clients ?? []) clientById.set(c.id, { name: c.name, email: c.email, phone: c.phone })
  }

  // Riepilogo
  const daysLeftOf = (expiresAt: string | null): number | null =>
    expiresAt ? Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null

  const totaleDaIncassare = rows.reduce((s, d) => s + (d.total ?? 0), 0)
  const scadute = rows.filter((d) => {
    const dl = daysLeftOf(d.expires_at)
    return dl !== null && dl < 0
  }).length

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header mobile — fascia bianca */}
      <div className="lg:hidden" style={{ background: '#fff', borderBottom: FASCIA, display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <Link href="/fatture" style={{ color: '#55534b', display: 'flex', alignItems: 'center' }} aria-label="Indietro">
          <ChevronLeft size={25} />
        </Link>
        <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: '#161616' }}>Fatture da incassare</span>
        <span style={{ width: 24 }} />
      </div>

      {/* Header desktop — semplice */}
      <div className="hidden lg:block p-6 pb-0">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Banknote className="size-6 text-amber-500" />
          Fatture da incassare
        </h1>
      </div>

      {/* Sottotitolo */}
      <div style={{ margin: '13px 15px 2px', fontSize: 12, color: '#a5a39b', lineHeight: 1.5 }}>
        Fatture non ancora pagate, ordinate per scadenza.
      </div>

      {rows.length > 0 ? (
        <>
          {/* Card riepilogo */}
          <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#a5a39b' }}>
                Totale da incassare
              </div>
              <div style={{ fontSize: 23, fontWeight: 700, color: '#161616', marginTop: 4, letterSpacing: '-.01em' }}>
                {formatCurrency(totaleDaIncassare)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {scadute > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#b05656' }}>
                  {scadute} scadut{scadute === 1 ? 'a' : 'e'}
                </div>
              )}
              <div style={{ fontSize: 12, color: '#a5a39b', marginTop: 3 }}>
                {rows.length} fattur{rows.length === 1 ? 'a aperta' : 'e aperte'}
              </div>
            </div>
          </div>

          {/* Card documenti */}
          {rows.map((doc) => {
            const client = doc.client_id ? clientById.get(doc.client_id) : undefined
            return (
              <ScadenzaSollecitoCard
                key={doc.id}
                docType="fattura"
                documentId={doc.id}
                docNumber={doc.doc_number}
                status={doc.status}
                isModified={!!doc.updated_after_send_at}
                clientName={client?.name ?? null}
                clientEmail={client?.email ?? null}
                clientPhone={client?.phone ?? null}
                total={doc.total}
                expiresAt={doc.expires_at}
                daysLeft={daysLeftOf(doc.expires_at)}
                publicToken={doc.public_token}
                workspaceName={workspaceName}
              />
            )
          })}
        </>
      ) : (
        <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '32px 15px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, textAlign: 'center' }}>
          <CheckCircle2 className="size-10" style={{ color: '#2f8a63' }} />
          <p style={{ fontWeight: 600, color: '#161616' }}>Nessuna fattura da incassare</p>
          <p style={{ fontSize: 13, color: '#8a887f' }}>Tutte le fatture inviate risultano pagate.</p>
          <Link href="/fatture" style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', textDecoration: 'none', marginTop: 2 }}>
            Vedi tutte le fatture &rarr;
          </Link>
        </div>
      )}

      <div style={{ height: 16 }} />
    </div>
  )
}
