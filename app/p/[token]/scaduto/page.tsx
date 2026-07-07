import { notFound } from 'next/navigation'
import { Clock, Phone, Mail } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'

interface Props {
  params: Promise<{ token: string }>
}

export const dynamic = 'force-dynamic'

function getInitials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2)
}

export default async function ScadutoPage({ params }: Props) {
  const { token } = await params
  const admin = createAdminClient()

  const { data: doc } = await admin
    .from('documents')
    .select(`
      title,
      doc_type,
      expires_at,
      workspaces!workspace_id (
        owner_id,
        ragione_sociale,
        name,
        piva,
        phone
      )
    `)
    .eq('public_token', token)
    .is('deleted_at', null)
    .eq('status', 'expired')
    .maybeSingle()

  if (!doc) notFound()

  const workspace = doc.workspaces as {
    owner_id: string
    ragione_sociale: string | null
    name: string
    piva: string | null
    phone: string | null
  }

  const workspaceName = workspace.ragione_sociale ?? workspace.name
  const initials = getInitials(workspaceName)
  const isPreventivo = (doc as Record<string, unknown>).doc_type !== 'fattura'
  const docLabelCap = isPreventivo ? 'Preventivo' : 'Fattura'

  // Contatto artigiano: se c'è il telefono → chiamata; altrimenti fallback email dell'account.
  let ownerEmail: string | null = null
  if (!workspace.phone) {
    try {
      const { data } = await admin.auth.admin.getUserById(workspace.owner_id)
      ownerEmail = data?.user?.email ?? null
    } catch { ownerEmail = null }
  }

  const expiredAt = doc.expires_at
    ? new Date(doc.expires_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
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
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#f5e9d0', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <Clock size={36} style={{ color: '#b0863e' }} />
          </div>
          <div style={{ fontSize: 21, fontWeight: 700, color: '#161616', marginBottom: 8 }}>
            {docLabelCap} scadut{isPreventivo ? 'o' : 'a'}
          </div>
          <div style={{ fontSize: 14, color: '#55534b', lineHeight: 1.5, maxWidth: 290 }}>
            Quest{isPreventivo ? 'o preventivo è scaduto' : 'a fattura è scaduta'}{expiredAt ? <> il <b>{expiredAt}</b></> : ''}. Contatta {workspaceName} per richiederne un{isPreventivo ? 'o' : 'a'} aggiornat{isPreventivo ? 'o' : 'a'}.
          </div>
        </div>

        {/* Pulsante contatto: chiamata se c'è il telefono, altrimenti email */}
        {workspace.phone ? (
          <div style={{ padding: '0 24px', marginTop: 18 }}>
            <a
              href={`tel:${workspace.phone.replace(/[^\d+]/g, '')}`}
              style={{ border: '1px solid #e7e7ea', borderRadius: 12, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 500, color: '#1a1a2e', textDecoration: 'none' }}
            >
              <Phone size={18} />
              Chiama l&rsquo;artigiano
            </a>
          </div>
        ) : ownerEmail ? (
          <div style={{ padding: '0 24px', marginTop: 18 }}>
            <a
              href={`mailto:${ownerEmail}`}
              style={{ border: '1px solid #e7e7ea', borderRadius: 12, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 500, color: '#1a1a2e', textDecoration: 'none' }}
            >
              <Mail size={18} />
              Contatta l&rsquo;artigiano
            </a>
          </div>
        ) : null}

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#b3b1ab', padding: '22px 14px 18px' }}>
          Preventivo generato con <b style={{ color: '#8a887f' }}>Carta Canta</b> · cartacanta.app
        </div>

      </div>
    </div>
  )
}
