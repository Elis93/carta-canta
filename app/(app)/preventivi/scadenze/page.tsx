import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { ChevronLeft, CalendarClock, CheckCircle2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { ScadenzaSollecitoCard } from '@/components/shared/ScadenzaSollecitoCard'
import { BackButton } from '@/components/shared/BackButton'

export const metadata = { title: 'Preventivi in scadenza' }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

/**
 * Pagina "Preventivi in scadenza / Solleciti" — layout dal mockup
 * "Preventivi — In scadenza / Solleciti" (Carta_Canta_mockup_pagine2.html).
 */
export default async function ScadenzePage() {
  // Contesto sessione condiviso (memoizzato per richiesta — vedi lib/workspace-context.ts)
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  const workspaceName = workspace.ragione_sociale || workspace.name || null

  const now = new Date()

  // Preventivi inviati/visti in attesa di risposta, ordinati per scadenza più vicina
  const { data: docs } = await supabase
    .from('documents')
    .select('id, doc_number, title, total, status, expires_at, updated_after_send_at, public_token, client_id')
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'preventivo')
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

  const totaleInAttesa = rows.reduce((s, d) => s + (d.total ?? 0), 0)
  const scaduti = rows.filter((d) => {
    const dl = daysLeftOf(d.expires_at)
    return dl !== null && dl < 0
  }).length

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header mobile — fascia bianca */}
      <div className="lg:hidden" style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/preventivi" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Preventivi in scadenza</span>
        <span style={{ width: 24 }} />
      </div>

      {/* Header desktop — semplice */}
      <div className="hidden lg:block p-6 pb-0">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CalendarClock className="size-6 text-amber-500" />
          Preventivi in scadenza
        </h1>
      </div>

      {rows.length > 0 ? (
        <>
          {/* Card riepilogo */}
          <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '16px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#a5a39b' }}>
                In attesa di risposta
              </div>
              <div style={{ fontSize: 23, fontWeight: 700, color: '#161616', marginTop: 4, letterSpacing: '-.01em' }}>
                {formatCurrency(totaleInAttesa)}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              {scaduti > 0 && (
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, fontWeight: 600, color: '#b05656' }}>
                  {scaduti} scadut{scaduti === 1 ? 'o' : 'i'}
                </div>
              )}
              <div style={{ fontSize: 12, color: '#a5a39b', marginTop: 3 }}>
                {rows.length} preventiv{rows.length === 1 ? 'o aperto' : 'i aperti'}
              </div>
            </div>
          </div>

          {/* Card documenti */}
          {rows.map((doc) => {
            const client = doc.client_id ? clientById.get(doc.client_id) : undefined
            return (
              <ScadenzaSollecitoCard
                key={doc.id}
                docType="preventivo"
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
          <p style={{ fontWeight: 600, color: '#161616' }}>Nessun preventivo in attesa</p>
          <p style={{ fontSize: 13, color: '#55534b' }}>Quando invii un preventivo lo trovi qui fino alla risposta del cliente.</p>
          <Link href="/preventivi" style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', textDecoration: 'none', marginTop: 2 }}>
            Vedi tutti i preventivi &rarr;
          </Link>
        </div>
      )}

      <div style={{ height: 16 }} />
    </div>
  )
}
