import { notFound } from 'next/navigation'
import { X } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'

function getInitials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2)
}

export default async function RifiutatoPage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  // Verifica che il documento esista ed è rifiutato
  const { data: doc } = await admin
    .from('documents')
    .select(`
      title,
      doc_type,
      rejection_reason,
      workspaces!workspace_id (
        ragione_sociale,
        name,
        piva
      )
    `)
    .eq('public_token', token)
    .is('deleted_at', null)
    .eq('status', 'rejected')
    .maybeSingle()

  if (!doc) notFound()

  const workspace = doc.workspaces as {
    ragione_sociale: string | null
    name: string
    piva: string | null
  }

  const workspaceName = workspace.ragione_sociale ?? workspace.name
  const initials = getInitials(workspaceName)
  const isPreventivo = (doc as Record<string, unknown>).doc_type !== 'fattura'

  return (
    <div style={{ background: '#fafafa', minHeight: '100vh' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>

        {/* Header brand */}
        <div style={{ background: '#fff', borderBottom: '0.5px solid #eee', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 11 }}>
          <div style={{ width: 40, height: 40, borderRadius: 9, background: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, flex: '0 0 auto' }}>
            {initials}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#161616' }}>{workspaceName}</div>
            {workspace.piva && <div style={{ fontSize: 12, color: '#8a887f' }}>P.IVA {workspace.piva}</div>}
          </div>
        </div>

        {/* Corpo centrato */}
        <div style={{ padding: '40px 24px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#f5dede', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <X size={38} style={{ color: '#b05656' }} />
          </div>
          <div style={{ fontSize: 21, fontWeight: 700, color: '#161616', marginBottom: 8 }}>
            {isPreventivo ? 'Preventivo rifiutato' : 'Fattura annullata'}
          </div>
          <div style={{ fontSize: 14, color: '#55534b', lineHeight: 1.5, maxWidth: 290 }}>
            {isPreventivo
              ? <>Hai rifiutato il preventivo di <b>{workspaceName}</b>. Il mittente è stato notificato.</>
              : <>La fattura di <b>{workspaceName}</b> è stata annullata.</>
            }
          </div>
        </div>

        {/* Card motivo */}
        {doc.rejection_reason && (
          <div style={{ margin: '18px 24px 0', background: '#fff', borderRadius: 12, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '13px 15px' }}>
            <div style={{ fontSize: 12, color: '#8a887f' }}>Motivo indicato</div>
            <div style={{ fontSize: 14, color: '#161616', marginTop: 2, lineHeight: 1.5 }}>{doc.rejection_reason}</div>
          </div>
        )}

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#b3b1ab', padding: '22px 14px 18px' }}>
          Preventivo generato con <b style={{ color: '#8a887f' }}>Carta Canta</b> · cartacanta.app
        </div>

      </div>
    </div>
  )
}
