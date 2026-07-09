import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { getStudioUser, assertAccountantAccess } from '@/lib/studio'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatDocNumber, formatCurrency } from '@/lib/utils'
import { ExportCommercialistaButton } from '@/components/shared/ExportCommercialistaButton'

export const dynamic = 'force-dynamic'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

type FatturaRow = {
  id: string; doc_number: string | null; status: string; total: number | null
  paid_amount: number | null; payment_status: string | null; sent_at: string | null; created_at: string | null
  clients: { name: string | null; surname: string | null } | null
}

function statoLabel(f: FatturaRow): { label: string; color: string; bg: string } {
  if (f.status === 'rejected') return { label: 'Annullata', color: '#b05656', bg: '#f5dede' }
  if (f.payment_status === 'paid' || (!f.payment_status && f.status === 'accepted')) return { label: 'Incassata', color: '#2f8a63', bg: '#d4efe2' }
  if (f.payment_status === 'partial') return { label: 'Acconto', color: '#b0863e', bg: '#f5f0e2' }
  return { label: 'Da incassare', color: '#55534b', bg: '#f0f0f2' }
}

export default async function StudioClientPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = await params
  const user = await getStudioUser()
  if (!user) redirect(`/login?redirect=/studio/${workspaceId}`)

  // SICUREZZA: l'accesso si verifica dal link attivo, non dall'URL.
  const ws = await assertAccountantAccess(user, workspaceId)
  if (!ws) notFound()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non in types/database.ts
  const admin = createAdminClient() as any
  const baseSel = 'id, doc_number, status, total, sent_at, created_at, clients ( name, surname )'
  let fatture: FatturaRow[] = []
  const { data: rich, error } = await admin
    .from('documents')
    .select(`${baseSel}, paid_amount, payment_status`)
    .eq('workspace_id', workspaceId).eq('doc_type', 'fattura').neq('status', 'draft').is('deleted_at', null)
    .order('sent_at', { ascending: false })
  if (!error && rich) {
    fatture = rich as FatturaRow[]
  } else {
    // Tolleranza pre-migration 038 (colonne paid_*)
    const { data: base } = await admin
      .from('documents').select(baseSel)
      .eq('workspace_id', workspaceId).eq('doc_type', 'fattura').neq('status', 'draft').is('deleted_at', null)
      .order('created_at', { ascending: false })
    fatture = ((base ?? []) as FatturaRow[]).map((f) => ({ ...f, paid_amount: null, payment_status: null }))
  }

  const attive = fatture.filter((f) => f.status !== 'rejected')
  const totFatturato = attive.reduce((s, f) => s + Number(f.total ?? 0), 0)
  const totIncassato = attive.reduce((s, f) => {
    const paid = f.payment_status === 'paid' || (!f.payment_status && f.status === 'accepted')
    return s + Number(f.paid_amount ?? (paid ? f.total ?? 0 : 0))
  }, 0)

  return (
    <>
      <Link href="/studio" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 13, fontWeight: 600, color: '#8a887f', textDecoration: 'none', marginBottom: 10 }}>
        <ChevronLeft size={16} /> Tutti i clienti
      </Link>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#161616', margin: '0 0 2px' }}>{ws.ragione_sociale || ws.name}</h1>
      {ws.piva && <p style={{ fontSize: 13, color: '#8a887f', margin: '0 0 16px' }}>P.IVA {ws.piva}</p>}

      {/* KPI + download */}
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px', marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { label: 'Fatturato', value: totFatturato },
            { label: 'Incassato', value: totIncassato },
          ].map((k) => (
            <div key={k.label} style={{ flex: 1, background: '#fafafa', borderRadius: 11, padding: '10px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8a887f' }}>{k.label}</div>
              <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3, color: '#161616', whiteSpace: 'nowrap' }}>{formatCurrency(k.value)}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 12 }}>
          <ExportCommercialistaButton endpoint={`/api/studio/${workspaceId}/export`} />
        </div>
      </div>

      {/* Elenco fatture (sola lettura) */}
      <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', margin: '4px 2px 8px' }}>
        Fatture ({fatture.length})
      </div>
      {fatture.length === 0 ? (
        <p style={{ fontSize: 13, color: '#8a887f', padding: '10px 2px' }}>Nessuna fattura emessa.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {fatture.map((f) => {
            const st = statoLabel(f)
            const cliente = [f.clients?.name, f.clients?.surname].filter(Boolean).join(' ')
            const data = f.sent_at ?? f.created_at
            return (
              <div key={f.id} style={{ background: '#fff', borderRadius: 12, boxShadow: SH, padding: '11px 13px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#161616' }}>
                    {formatDocNumber(f.doc_number, 'fattura')}{cliente ? ` · ${cliente}` : ''}
                  </span>
                  {data && <span style={{ display: 'block', fontSize: 12, color: '#8a887f', marginTop: 1 }}>{new Date(data).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>}
                </span>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#161616', flexShrink: 0 }}>{formatCurrency(Number(f.total ?? 0))}</span>
                <span style={{ fontSize: 11, fontWeight: 600, color: st.color, background: st.bg, borderRadius: 999, padding: '3px 9px', flexShrink: 0 }}>{st.label}</span>
              </div>
            )
          })}
        </div>
      )}

      <p style={{ fontSize: 12, color: '#a5a39b', textAlign: 'center', marginTop: 20, lineHeight: 1.6 }}>
        Sola lettura. Il cliente può scollegarti in qualsiasi momento. Per la contabilità usa il pulsante di download qui sopra.
      </p>
    </>
  )
}
