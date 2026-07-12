import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Building2, ChevronRight } from 'lucide-react'
import { getStudioUser, listClientWorkspacesForAccountant, studioAuthRedirectPath } from '@/lib/studio'
import { InviteClientCard } from '@/components/shared/InviteClientCard'

export const dynamic = 'force-dynamic'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

export default async function StudioHomePage({
  searchParams,
}: {
  searchParams: Promise<{ invited?: string }>
}) {
  const { invited } = await searchParams
  const user = await getStudioUser()
  if (!user) redirect(await studioAuthRedirectPath('/studio'))

  const clients = await listClientWorkspacesForAccountant(user)

  // Link d'invito aperto con la sessione di un'ALTRA email (feedback Eli:
  // atterrata su uno studio vuoto senza capire perché) → avviso esplicito.
  const invitedEmail = (invited ?? '').trim().toLowerCase()
  const wrongSession =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(invitedEmail) && invitedEmail !== user.email

  return (
    <>
      {wrongSession && (
        <div style={{ background: '#fdf9ef', border: '1px solid #ecdfc0', borderRadius: 12, padding: '12px 14px', marginBottom: 14 }}>
          <p style={{ fontSize: 13, color: '#55534b', lineHeight: 1.55, margin: 0 }}>
            <strong style={{ color: '#b0863e' }}>Attenzione:</strong> questo invito è per{' '}
            <strong style={{ color: '#161616' }}>{invitedEmail}</strong>, ma sei collegato come{' '}
            <strong style={{ color: '#161616' }}>{user.email}</strong>. Per vedere il cliente che ti
            ha invitato, esci (in alto a destra) e accedi — o registrati — con l&rsquo;email dell&rsquo;invito.
          </p>
        </div>
      )}
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#161616', margin: '4px 0 4px' }}>I tuoi clienti</h1>
      <p style={{ fontSize: 14, color: '#55534b', margin: '0 0 18px', lineHeight: 1.5 }}>
        Gli artigiani che ti hanno collegato al loro spazio Carta Canta. Accesso in sola lettura.
      </p>

      {clients.length === 0 ? (
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '22px 18px', textAlign: 'center' }}>
          <Building2 size={26} style={{ color: '#c9c7bf', margin: '0 auto 8px' }} />
          <div style={{ fontSize: 15, fontWeight: 600, color: '#161616' }}>Nessun cliente collegato</div>
          <p style={{ fontSize: 13, color: '#767676', lineHeight: 1.55, marginTop: 6 }}>
            Quando un artigiano ti invita dal suo Carta Canta (con questa email, <strong>{user.email}</strong>),
            lo troverai qui. Chiedigli di aprire Impostazioni &rsaquo; Dati &rsaquo; &laquo;Il tuo commercialista&raquo;
            — oppure invitalo tu qui sotto.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {clients.map((c) => (
            <Link key={c.id} href={`/studio/${c.id}`} style={{ textDecoration: 'none' }}>
              <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ width: 38, height: 38, borderRadius: 11, background: '#f5f0e2', color: '#b0863e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Building2 size={18} />
                </span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: 15, fontWeight: 600, color: '#161616', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.ragione_sociale || c.name}
                  </span>
                  {c.piva && <span style={{ display: 'block', fontSize: 12, color: '#8a887f', marginTop: 1 }}>P.IVA {c.piva}</span>}
                </span>
                <ChevronRight size={18} style={{ color: '#c9c7bf', flexShrink: 0 }} />
              </div>
            </Link>
          ))}
        </div>
      )}

      <InviteClientCard />
    </>
  )
}
