import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BackButton } from '@/components/shared/BackButton'
import { RequestRow, type RequestData } from './_components/RequestRow'

export const metadata = { title: 'Richieste' }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

export default async function RichiestePage() {
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  let requests: RequestData[] = []
  const preventivoDi = new Map<string, { numero: string | null; stato: string }>()
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 043/065 non ancora in types/database.ts
    const db = supabase as any
    // customer_phone (065) + preferred_slot (066) tolleranti pre-migration:
    // colonna assente → retry senza le colonne nuove.
    let { data, error } = await db
      .from('marketplace_requests')
      .select('id, customer_name, customer_contact, customer_phone, customer_city, preferred_slot, message, status, created_at, document_id')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error && (error.code === '42703' || error.code === 'PGRST204')) {
      ;({ data } = await db
        .from('marketplace_requests')
        .select('id, customer_name, customer_contact, customer_city, message, status, created_at')
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: false })
        .limit(100))
    }
    requests = (data ?? []) as RequestData[]

    // Preventivo nato dalla richiesta (076): si mostra il NUMERO, non un
    // generico "fatto" — così dalla richiesta si risale al documento.
    // ⚠️ Solo i documenti ancora vivi: se il preventivo è finito nel cestino
    // la richiesta torna onestamente "da fare".
    const docIds = [...new Set(requests.map((r) => r.document_id).filter((x): x is string => !!x))]
    if (docIds.length > 0) {
      const { data: docs } = await supabase
        .from('documents')
        .select('id, doc_number, status')
        .in('id', docIds)
        .is('deleted_at', null)
      for (const d of docs ?? []) preventivoDi.set(d.id, { numero: d.doc_number, stato: d.status })
    }
  } catch { /* migration 043/076 non ancora applicata */ }

  return (
    <div className="max-w-3xl mx-auto">
      <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/farti-trovare" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Richieste</span>
        <span style={{ width: 24 }} />
      </div>

      {requests.length > 0 ? (
        <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '4px 15px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', padding: '10px 0 2px' }}>
            Dal marketplace
          </div>
          {requests.map((r, i) => (
            <RequestRow
              key={r.id}
              request={r}
              preventivo={r.document_id ? preventivoDi.get(r.document_id) ?? null : null}
              last={i === requests.length - 1}
            />
          ))}
        </div>
      ) : (
        <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '30px 15px', textAlign: 'center' }}>
          <p style={{ fontWeight: 600, color: '#161616', fontSize: 14 }}>Nessuna richiesta ancora</p>
          <p style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 6, lineHeight: 1.55, maxWidth: 320, marginLeft: 'auto', marginRight: 'auto' }}>
            Quando un cliente ti contatta dal marketplace, la richiesta arriva qui
            (e ricevi un&rsquo;email di avviso senza i dettagli).
          </p>
          <Link href="/farti-trovare" style={{ display: 'inline-block', marginTop: 10, fontSize: 13, fontWeight: 600, color: '#1a1a2e', textDecoration: 'none' }}>
            Pubblica il tuo profilo →
          </Link>
        </div>
      )}

      <p style={{ margin: '12px 15px 0', fontSize: 12, color: '#767676', textAlign: 'center' }}>
        Aprendo una richiesta vedi i dettagli e il contatto del cliente.
      </p>
      <div style={{ height: 16 }} />
    </div>
  )
}
