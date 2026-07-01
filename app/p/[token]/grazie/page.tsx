import { notFound } from 'next/navigation'
import { Check } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'

function getInitials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2)
}

export default async function GraziePage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  // Verifica che il documento esista ed è accettato
  const { data: doc } = await admin
    .from('documents')
    .select(`
      title,
      accepted_at,
      signer_name,
      workspaces!workspace_id (
        ragione_sociale,
        name,
        piva
      )
    `)
    .eq('public_token', token)
    .eq('status', 'accepted')
    .maybeSingle()

  if (!doc) notFound()

  const workspace = doc.workspaces as {
    ragione_sociale: string | null
    name: string
    piva: string | null
  }

  const workspaceName = workspace.ragione_sociale ?? workspace.name
  const initials = getInitials(workspaceName)
  const firstName = doc.signer_name ? doc.signer_name.split(/\s+/)[0] : null

  const acceptedDate = doc.accepted_at
    ? new Date(doc.accepted_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

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
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#d4efe2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <Check size={38} style={{ color: '#2f8a63' }} />
          </div>
          <div style={{ fontSize: 21, fontWeight: 700, color: '#161616', marginBottom: 8 }}>Preventivo accettato</div>
          <div style={{ fontSize: 14, color: '#55534b', lineHeight: 1.5, maxWidth: 280 }}>
            Grazie{firstName ? `, ${firstName}` : ''}! <b>{workspaceName}</b> ha ricevuto la tua accettazione e ti contatterà a breve.
          </div>
        </div>

        {/* Card firmatario */}
        {doc.signer_name && (
          <div style={{ margin: '18px 24px 0', background: '#fff', borderRadius: 12, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '13px 15px', textAlign: 'center' }}>
            <div style={{ fontSize: 12, color: '#8a887f' }}>Firmato da</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#161616', marginTop: 2 }}>
              {doc.signer_name}{acceptedDate ? ` · ${acceptedDate}` : ''}
            </div>
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
