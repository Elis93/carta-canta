import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { Crown, Truck } from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { getAiImportQuota, AI_IMPORT_PRO_MONTHLY } from '@/lib/ai/quota'
import { BackButton } from '@/components/shared/BackButton'
import { ListinoDetail } from './_components/ListinoDetail'

// ============================================================
// Dettaglio LISTINO FORNITORE (Fase 2, Pro) — voci col COSTO,
// ricarico predefinito, scadenza, import/rinnovo con l'AI.
// 🔒 B.2: tutto privato dell'artigiano, mai al cliente.
// ============================================================

export const metadata = { title: 'Listino fornitore' }

const AI_IMPORT_ENABLED = process.env.NEXT_PUBLIC_AI_IMPORT_ENABLED === 'true'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ListinoFornitorePage({ params }: Props) {
  const { id } = await params
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/login')

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) notFound()

  const header = (
    <div className="cc-title-band" style={{ padding: '12px 15px', display: 'flex', alignItems: 'center', gap: 10 }}>
      <BackButton fallback="/catalogo?tab=listini" />
      <div className="cc-page-title" style={{ fontSize: 22 }}>Listino fornitore</div>
    </div>
  )

  // Gate Pro (i listini sono Pro — decisione congelata)
  if (workspace.plan === 'free') {
    return (
      <div className="max-w-3xl mx-auto">
        {header}
        <div style={{ margin: '14px 15px 0', background: '#fff', borderLeft: '3px solid #c9a44c', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05)', padding: '16px 15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <Truck size={19} style={{ color: '#b08d3e', flexShrink: 0 }} />
            <div style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}>I listini fornitori sono una funzione Pro.</div>
          </div>
          <Link
            href="/abbonamento"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, height: 48, borderRadius: 12, background: '#1a1a2e', color: '#fff', fontSize: 13, fontWeight: 600, textDecoration: 'none', marginTop: 12 }}
          >
            <Crown size={15} style={{ color: '#c9a44c' }} /> Passa a Pro
          </Link>
        </div>
      </div>
    )
  }

  type ListRow = { id: string; name: string; markup_pct: number | null; valid_until: string | null }
  type ItemRow = { id: string; code: string | null; description: string; unit: string; unit_cost: number }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 063 non ancora in types/database.ts
  const db = supabase as any
  const [list, items]: [ListRow | null, ItemRow[]] = await Promise.all([
    db.from('supplier_lists')
      .select('id, name, markup_pct, valid_until')
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .maybeSingle()
      .then((r: { data: ListRow | null }) => r.data, () => null),
    db.from('supplier_list_items')
      .select('id, code, description, unit, unit_cost')
      .eq('list_id', id)
      .order('description')
      .then((r: { data: ItemRow[] | null }) => r.data ?? [], () => [] as ItemRow[]),
  ])

  if (!list) notFound()

  const aiQuota = AI_IMPORT_ENABLED ? await getAiImportQuota(workspace.id, workspace.plan) : null

  return (
    <div className="max-w-3xl mx-auto">
      {header}
      <ListinoDetail
        list={list}
        items={items}
        ai={aiQuota ? {
          allowed: aiQuota.allowed,
          remaining: aiQuota.allowed ? aiQuota.remaining : 0,
          isPro: aiQuota.allowed ? aiQuota.isPro : aiQuota.reason === 'pro_monthly',
          proMonthly: AI_IMPORT_PRO_MONTHLY,
        } : null}
      />
    </div>
  )
}
