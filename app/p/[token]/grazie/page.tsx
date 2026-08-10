import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Check, FileText } from 'lucide-react'
import { formatDocNumber } from '@/lib/utils'
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
      doc_number,
      total,
      currency,
      accepted_at,
      signer_name,
      workspaces!workspace_id (
        ragione_sociale,
        name,
        piva
      )
    `)
    .eq('public_token', token)
    // Solo PREVENTIVI: su una fattura pagata questa pagina direbbe
    // «Preventivo accettato» a chi ne costruisce l'indirizzo a mano.
    .eq('doc_type', 'preventivo')
    .is('deleted_at', null)
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
    ? new Date(doc.accepted_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' , timeZone: 'Europe/Rome' })
    : null
  // Data PER ESTESO con l'ora: è la ricevuta di ciò che il cliente ha appena
  // fatto, e la vuole leggibile senza interpretare abbreviazioni.
  const acceptedLong = doc.accepted_at
    ? new Date(doc.accepted_at).toLocaleString('it-IT', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome',
      })
    : null
  // Proposta scelta (041): query a SÉ e tollerante — la colonna non è nei tipi
  // generati, e metterla nella select principale farebbe fallire l'intera
  // pagina invece di far mancare una riga.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonna 041 non ancora in types/database.ts
  const tierScelto = await (admin as any)
    .from('documents')
    .select('accepted_tier')
    .eq('public_token', token)
    .maybeSingle()
    .then((r: { data: { accepted_tier?: string | null } | null }) => r.data?.accepted_tier ?? null, () => null)
  const TIER_LABELS: Record<string, string> = { base: 'Base', consigliata: 'Consigliata', premium: 'Premium' }
  const numero = formatDocNumber(doc.doc_number, 'preventivo')
  const totale = doc.total != null
    ? `€\u00A0${Number(doc.total).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
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
            {workspace.piva && <div style={{ fontSize: 12, color: 'var(--cc-muted)' }}>P.IVA {workspace.piva}</div>}
          </div>
        </div>

        {/* Corpo centrato */}
        <div style={{ padding: '40px 24px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#d4efe2', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 18 }}>
            <Check size={38} style={{ color: '#2f8a63' }} />
          </div>
          <div style={{ fontSize: 21, fontWeight: 700, color: '#161616', marginBottom: 8 }}>Preventivo accettato</div>
          <div style={{ fontSize: 14, color: '#55534b', lineHeight: 1.5, maxWidth: 280 }}>
            Grazie{firstName ? `, ${firstName}` : ''}! <b>{workspaceName}</b>{' '}ha ricevuto la tua accettazione e ti contatterà a breve.
          </div>
        </div>

        {/* ── Riepilogo di ciò che è stato accettato (Eli, 9 ago) ──
            Prima questa pagina diceva solo «grazie»: chi la riapriva dal link
            non ritrovava né il numero, né la cifra, né QUANDO aveva accettato.
            È la ricevuta della sua firma, e deve contenerla. */}
        <div style={{ margin: '18px 24px 0', background: '#fff', borderRadius: 12, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '14px 16px' }}>
          {numero !== '—' && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, padding: '5px 0' }}>
              <span style={{ color: 'var(--cc-muted)' }}>Preventivo</span>
              <span style={{ fontWeight: 600, color: '#161616' }}>{numero}</span>
            </div>
          )}
          {tierScelto && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, padding: '5px 0' }}>
              <span style={{ color: 'var(--cc-muted)' }}>Proposta scelta</span>
              <span style={{ fontWeight: 600, color: '#161616' }}>{TIER_LABELS[tierScelto] ?? tierScelto}</span>
            </div>
          )}
          {totale && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, padding: '5px 0' }}>
              <span style={{ color: 'var(--cc-muted)' }}>Totale</span>
              <span style={{ fontWeight: 700, color: '#161616', whiteSpace: 'nowrap' }}>{totale}</span>
            </div>
          )}
          {acceptedLong && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, padding: '5px 0' }}>
              <span style={{ color: 'var(--cc-muted)' }}>Accettato il</span>
              <span style={{ fontWeight: 600, color: '#161616', textAlign: 'right' }}>{acceptedLong}</span>
            </div>
          )}
          {doc.signer_name && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 14, padding: '5px 0', borderTop: '0.5px solid #eee', marginTop: 4, paddingTop: 9 }}>
              <span style={{ color: 'var(--cc-muted)' }}>Firmato da</span>
              <span style={{ fontWeight: 600, color: '#161616', textAlign: 'right' }}>{doc.signer_name}</span>
            </div>
          )}
        </div>

        {/* Torna al documento: il link resta valido e mostra il preventivo
            accettato, con la sua data. Senza questo tasto la pagina era un
            vicolo cieco — l'unico modo era il tasto Indietro del telefono. */}
        <div style={{ margin: '12px 24px 0' }}>
          <Link
            href={`/p/${token}`}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: '#fff', color: '#1a1a2e', border: '1px solid #e0dfda',
              borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 600,
              textDecoration: 'none',
              boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)',
            }}
          >
            <FileText size={17} /> Rivedi il preventivo
          </Link>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', fontSize: 11, color: '#b3b1ab', padding: '22px 14px 18px' }}>
          Preventivo generato con <b style={{ color: 'var(--cc-muted)' }}>Carta Canta</b> · cartacanta.app
        </div>

      </div>
    </div>
  )
}
