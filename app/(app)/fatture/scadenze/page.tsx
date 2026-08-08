import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { ChevronLeft, CheckCircle2, Banknote } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { ScadenzaSollecitoCard } from '@/components/shared/ScadenzaSollecitoCard'
import { documentiSenzaPromemoria } from '@/lib/documents/archivio'
import { BackButton } from '@/components/shared/BackButton'

export const metadata = { title: 'Fatture da incassare' }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

/**
 * Pagina "Fatture da incassare / Solleciti" — layout dal mockup
 * "Fatture — Da incassare / Solleciti" (Carta_Canta_mockup_pagine2.html).
 */
export default async function FattureScadenzePage() {
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  const workspaceName = workspace.ragione_sociale || workspace.name || null

  const now = new Date()

  // Fatture inviate/viste non ancora pagate, ordinate per scadenza di pagamento
  // PERF: cliente JOINato nella stessa query (prima era una seconda query in serie)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
  const { data: docs } = await (supabase as any)
    .from('documents')
    .select('id, doc_number, title, total, status, expires_at, updated_after_send_at, public_token, client_id, payment_status, paid_amount, clients(id, name, email, phone)')
    .eq('workspace_id', workspace.id)
    .eq('doc_type', 'fattura')
    .in('status', ['sent', 'viewed', 'expired'])
    .is('deleted_at', null)
    .order('expires_at', { ascending: true, nullsFirst: false })

  interface Row {
    id: string; doc_number: string | null; title: string | null; total: number | null
    status: string; expires_at: string | null; updated_after_send_at: string | null
    public_token: string | null; client_id: string | null
    payment_status?: string | null; paid_amount?: number | null
    clients: { id: string; name: string | null; email: string | null; phone: string | null } | null
  }
  const rowsRaw: Row[] = docs ?? []

  // Rinvii (074), solleciti spenti e archiviati (075) — query a sé e TOLLERANTE:
  // se le colonne non esistono ancora la pagina funziona come prima.
  const senzaPromemoria = await documentiSenzaPromemoria(supabase, workspace.id)
  const rinvioDi = new Map<string, string>(
    senzaPromemoria.flatMap((d) => (d.snoozeUntil ? [[d.id, d.snoozeUntil] as [string, string]] : []))
  )
  const sollecitiSpenti = new Set(senzaPromemoria.filter((d) => d.sollecitiSpenti).map((d) => d.id))
  // ⚠️ Gli ARCHIVIATI escono dalla pagina; i rinviati e quelli senza solleciti
  // RESTANO, con la loro etichetta e il modo per riprenderli — è qui che si
  // gestiscono, toglierli li renderebbe irraggiungibili.
  const archiviati = new Set(senzaPromemoria.filter((d) => d.archiviato).map((d) => d.id))
  const rows: Row[] = rowsRaw.filter((d) => !archiviati.has(d.id))


  const clientById = new Map<string, { name: string | null; email: string | null; phone: string | null }>()
  for (const d of rows) {
    const c = (d as unknown as { clients: { id: string; name: string | null; email: string | null; phone: string | null } | null }).clients
    if (c) clientById.set(c.id, { name: c.name, email: c.email, phone: c.phone })
  }

  // Riepilogo
  const daysLeftOf = (expiresAt: string | null): number | null =>
    expiresAt ? Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null

  // RESIDUO, non totale pieno (review 25 lug E4): con un acconto già
  // incassato "da incassare" è il saldo — il totale gonfiava il riepilogo.
  const residuoOf = (d: { total: number | null; payment_status?: string | null; paid_amount?: number | null }) => {
    const paid = d.payment_status === 'partial' ? Number(d.paid_amount ?? 0) : 0
    return Math.max(0, (d.total ?? 0) - paid)
  }
  const totaleDaIncassare = rows.reduce((s, d) => s + residuoOf(d), 0)
  const scadute = rows.filter((d) => {
    const dl = daysLeftOf(d.expires_at)
    return dl !== null && dl < 0
  }).length

  return (
    <div className="max-w-3xl mx-auto">
      {/* Header mobile — fascia bianca */}
      <div className="lg:hidden" style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/fatture" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Fatture da incassare</span>
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
                alreadyPaid={doc.payment_status === 'partial' ? Number(doc.paid_amount ?? 0) : 0}
                expiresAt={doc.expires_at}
                daysLeft={daysLeftOf(doc.expires_at)}
                snoozeUntil={rinvioDi.get(doc.id) ?? null}
                remindersOff={sollecitiSpenti.has(doc.id)}
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
          <p style={{ fontSize: 13, color: 'var(--cc-muted)' }}>Tutte le fatture inviate risultano pagate.</p>
          <Link href="/fatture" style={{ fontSize: 13, fontWeight: 600, color: '#1a1a2e', textDecoration: 'none', marginTop: 2 }}>
            Vedi tutte le fatture &rarr;
          </Link>
        </div>
      )}

      <div style={{ height: 16 }} />
    </div>
  )
}
