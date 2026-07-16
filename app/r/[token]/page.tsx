import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CheckCircle2 } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { SignRapportoForm } from './_components/SignRapportoForm'

// ============================================================
// /r/[token] — rapportino di fine lavoro PUBBLICO (senza login).
// Il cliente legge cosa è stato fatto e firma con nome + tocco,
// stessa firma elettronica semplice dell'accettazione preventivo.
// ============================================================

export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Props {
  params: Promise<{ token: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { token } = await params
  if (!UUID_RE.test(token)) return { title: 'Rapportino di fine lavoro', robots: { index: false } }
  const admin = createAdminClient()
  let wsName = 'Carta Canta'
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 049 non ancora in types/database.ts
    const { data: lav } = await (admin as any)
      .from('lavori')
      .select('workspace_id')
      .eq('report_token', token)
      .is('deleted_at', null)
      .maybeSingle()
    if (lav?.workspace_id) {
      const { data: ws } = await admin
        .from('workspaces')
        .select('ragione_sociale, name')
        .eq('id', lav.workspace_id)
        .maybeSingle()
      wsName = ws?.ragione_sociale || ws?.name || wsName
    }
  } catch { /* pre-migration */ }
  return {
    title: `Rapportino di fine lavoro · ${wsName}`,
    description: `Rapportino di fine lavoro di ${wsName}: leggi e firma dal telefono.`,
    robots: { index: false },
  }
}

export default async function PublicRapportoPage({ params }: Props) {
  const { token } = await params
  if (!UUID_RE.test(token)) notFound()

  const admin = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 049 non ancora in types/database.ts
  const db = admin as any

  let lav: {
    id: string
    title: string | null
    address: string | null
    finished_at: string | null
    report_text: string | null
    report_sent_at: string | null
    report_signed_at: string | null
    report_signer_name: string | null
    workspace_id: string
    clients: { name: string | null; surname: string | null } | null
  } | null = null
  try {
    const { data, error } = await db
      .from('lavori')
      .select('id, title, address, finished_at, report_text, report_sent_at, report_signed_at, report_signer_name, workspace_id, clients ( name, surname )')
      .eq('report_token', token)
      .is('deleted_at', null)
      .maybeSingle()
    if (error) notFound()
    lav = data
  } catch {
    notFound()
  }
  if (!lav || !lav.report_text) notFound()

  const { data: ws } = await admin
    .from('workspaces')
    .select('ragione_sociale, name, logo_url')
    .eq('id', lav.workspace_id)
    .maybeSingle()
  const wsName = ws?.ragione_sociale || ws?.name || 'Carta Canta'

  const clientFullName = [lav.clients?.name, lav.clients?.surname].filter(Boolean).join(' ') || null
  const signed = Boolean(lav.report_signed_at)

  const dateLabel = (iso: string) =>
    new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' })

  return (
    <div style={{ background: '#fafafa', minHeight: '100vh' }}>
      {/* Header col nome dell'impresa */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #eee', padding: '13px 16px' }}>
        <div className="max-w-xl mx-auto" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {ws?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element -- logo esterno (Supabase Storage), dimensione fissa
            <img src={ws.logo_url} alt="" style={{ width: 30, height: 30, borderRadius: 8, objectFit: 'contain', flexShrink: 0 }} />
          )}
          <span style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>{wsName}</span>
        </div>
      </div>

      <div className="max-w-xl mx-auto" style={{ padding: '20px 16px 30px' }}>
        <p style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#b0863e' }}>
          Rapportino di fine lavoro
        </p>
        <h1 style={{ fontSize: 22, lineHeight: 1.25, fontWeight: 700, color: '#161616', margin: '6px 0 0' }}>
          {lav.title || 'Lavoro concluso'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--cc-muted)', margin: '6px 0 0', lineHeight: 1.5 }}>
          {clientFullName && <>Cliente: {clientFullName} · </>}
          {lav.address && <>{lav.address} · </>}
          {lav.finished_at ? <>concluso il {dateLabel(lav.finished_at)}</> : lav.report_sent_at ? <>del {dateLabel(lav.report_sent_at)}</> : null}
        </p>

        {/* Testo del rapportino */}
        <div style={{ marginTop: 16, background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '15px 16px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 9 }}>
            Lavori eseguiti
          </div>
          <p style={{ fontSize: 14, color: '#161616', lineHeight: 1.65, whiteSpace: 'pre-wrap', margin: 0 }}>{lav.report_text}</p>
        </div>

        {/* Firma */}
        <div style={{ marginTop: 14 }}>
          {signed ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, background: '#d4efe2', borderRadius: 13, padding: '13px 15px' }}>
              <CheckCircle2 size={18} style={{ color: '#2f8a63', flexShrink: 0, marginTop: 1 }} />
              <span style={{ fontSize: 14, color: '#1d5c41', lineHeight: 1.5 }}>
                Firmato da <strong>{lav.report_signer_name ?? 'cliente'}</strong>
                {lav.report_signed_at && <> il {new Date(lav.report_signed_at).toLocaleString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })}</>}
              </span>
            </div>
          ) : (
            <SignRapportoForm token={token} defaultName={clientFullName ?? ''} />
          )}
        </div>

        <p style={{ fontSize: 11, color: '#a5a39b', textAlign: 'center', marginTop: 18, lineHeight: 1.6 }}>
          Firmando confermi che i lavori descritti sono stati eseguiti. Vengono registrati data, ora e indirizzo IP
          (firma elettronica semplice). Documento generato con Carta Canta.
        </p>
      </div>
    </div>
  )
}
