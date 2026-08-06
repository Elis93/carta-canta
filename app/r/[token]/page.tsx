import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CheckCircle2, FileText } from 'lucide-react'
import { createAdminClient } from '@/lib/supabase/admin'
import { signPhotoPaths } from '@/lib/photos/signed-url'
import { PhotoGallery } from '@/components/public/PhotoGallery'
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
    report_signature_image?: string | null
    workspace_id: string
    clients: { name: string | null; surname: string | null } | null
  } | null = null
  try {
    let { data, error } = await db
      .from('lavori')
      .select('id, title, address, finished_at, report_text, report_sent_at, report_signed_at, report_signer_name, report_signature_image, workspace_id, clients ( name, surname )')
      .eq('report_token', token)
      .is('deleted_at', null)
      .maybeSingle()
    // Pre-migration 053: senza la colonna della firma la pagina deve
    // funzionare come prima (F20) → riprova senza
    if (error?.code === '42703') {
      ;({ data, error } = await db
        .from('lavori')
        .select('id, title, address, finished_at, report_text, report_sent_at, report_signed_at, report_signer_name, workspace_id, clients ( name, surname )')
        .eq('report_token', token)
        .is('deleted_at', null)
        .maybeSingle())
    }
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

  // 19 lug (Eli): nel rapportino ci deve essere tutto quello che l'artigiano
  // ha inserito — ORE segnate sul lavoro e FOTO. Le foto restano quelle che
  // l'artigiano ha reso visibili con l'occhio (regola permanente: di default
  // il cliente non vede nessuna foto). Tutto tollerante pre-migration.
  let laborMinutes = 0
  let lavDocumentId: string | null = null
  try {
    let { data: extra, error: extraErr } = await db
      .from('lavori')
      .select('labor_minutes, document_id')
      .eq('id', lav.id)
      .maybeSingle()
    if (extraErr?.code === '42703') {
      // Pre-migration 052: le ore non esistono ancora — solo il documento
      ;({ data: extra, error: extraErr } = await db
        .from('lavori')
        .select('document_id')
        .eq('id', lav.id)
        .maybeSingle())
    }
    if (!extraErr && extra) {
      const m = Number((extra as { labor_minutes?: number }).labor_minutes ?? 0)
      laborMinutes = Number.isFinite(m) && m > 0 ? Math.round(m) : 0
      lavDocumentId = (extra as { document_id?: string | null }).document_id ?? null
    }
  } catch { /* pre-migration */ }

  let photos: Array<{ id: string; storage_path: string; label: string | null }> = []
  if (lavDocumentId) {
    try {
      const { data } = await db
        .from('work_photos')
        .select('id, storage_path, label')
        .eq('document_id', lavDocumentId)
        .eq('visible_to_client', true)
        .order('created_at', { ascending: true })
      photos = data ?? []
    } catch { /* pre-migration */ }
  }
  const photoUrls = await signPhotoPaths(admin, photos.map((p) => p.storage_path))
  // Una foto di cui non riusciamo a firmare l'indirizzo non si vedrebbe: meglio
  // non mostrare il riquadro vuoto (stessa scelta della pagina del cliente).
  // ⚠️ Ma NON in silenzio: questo è il documento che il cliente firma, e una
  // foto mancante è una prova mancante. Se ne manca anche una sola glielo
  // diciamo, così ricarica invece di firmare un rapportino incompleto.
  const fotoTotali = photos.length
  photos = photos.filter((p) => photoUrls.has(p.storage_path))
  const fotoMancanti = fotoTotali - photos.length
  const oreLabel = laborMinutes > 0
    ? `${Math.floor(laborMinutes / 60) > 0 ? `${Math.floor(laborMinutes / 60)} h ` : ''}${laborMinutes % 60 > 0 || laborMinutes < 60 ? `${laborMinutes % 60} min` : ''}`.trim()
    : null

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
          {oreLabel && (
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: '0.5px solid #eee', marginTop: 12, paddingTop: 10, fontSize: 14 }}>
              <span style={{ color: 'var(--cc-muted)' }}>Ore di lavoro in cantiere</span>
              <span style={{ color: '#161616', fontWeight: 600, whiteSpace: 'nowrap' }}>{oreLabel}</span>
            </div>
          )}
        </div>

        {fotoMancanti > 0 && (
          <div style={{ marginTop: 14, background: '#fdf6e7', border: '1px solid #ead9b4', borderRadius: 14, padding: '13px 15px', fontSize: 14, lineHeight: 1.5, color: '#7a5c20' }}>
            {fotoMancanti === 1
              ? 'Una foto del lavoro non si è caricata.'
              : `${fotoMancanti} foto del lavoro non si sono caricate.`}{' '}
            Ricarica la pagina prima di firmare, così vedi il rapportino completo.
          </div>
        )}

        {/* Foto del lavoro (quelle rese visibili al cliente dall'artigiano).
            Stessa card della pagina del documento, ingrandimento compreso:
            è la stessa persona che guarda le stesse foto, e prima del 6 agosto
            qui erano le uniche che NON si potevano ingrandire — proprio sul
            documento che sta per firmare. */}
        {photos.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <PhotoGallery
              photos={photos.map((p) => ({ id: p.id, src: photoUrls.get(p.storage_path)!, label: p.label }))}
            />
          </div>
        )}

        {/* Firma */}
        <div style={{ marginTop: 14 }}>
          {signed ? (
            <div style={{ background: '#d4efe2', borderRadius: 13, padding: '13px 15px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9 }}>
                <CheckCircle2 size={18} style={{ color: '#2f8a63', flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 14, color: '#1d5c41', lineHeight: 1.5 }}>
                  Firmato da <strong>{lav.report_signer_name ?? 'cliente'}</strong>
                  {lav.report_signed_at && <> il {new Date(lav.report_signed_at).toLocaleString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })}</>}
                </span>
              </div>
              {/* F20: firma disegnata dal cliente (rapportini firmati dopo la migration 053) */}
              {lav.report_signature_image && (
                // eslint-disable-next-line @next/next/no-img-element -- data URI PNG, dimensione nota
                <img
                  src={lav.report_signature_image}
                  alt="Firma del cliente"
                  style={{ marginTop: 10, background: '#fff', borderRadius: 9, border: '0.5px solid #b7dcc8', width: '100%', maxWidth: 320, height: 'auto', display: 'block' }}
                />
              )}
            </div>
          ) : (
            <SignRapportoForm token={token} defaultName={clientFullName ?? ''} />
          )}
        </div>

        {/* 2 ago sera (Eli): prima l'ANTEPRIMA — si apre la versione documento
            in HTML e da lì, se si vuole, il bottone "Scarica in PDF" dentro la
            pagina apre il dialogo di stampa (B.8). */}
        <a
          href={`/api/r/${token}/pdf?preview=1`}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: 14, minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: 8, background: '#fff', border: '0.5px solid #dcdbd7', borderRadius: 12,
            color: '#1a1a2e', fontSize: 14, fontWeight: 600, textDecoration: 'none',
          }}
        >
          <FileText size={16} /> Anteprima del rapportino
        </a>

        <p style={{ fontSize: 11, color: '#a5a39b', textAlign: 'center', marginTop: 18, lineHeight: 1.6 }}>
          Firmando confermi che i lavori descritti sono stati eseguiti. Vengono registrati la firma, data, ora e
          indirizzo IP (firma elettronica semplice). Documento generato con Carta Canta.
        </p>
      </div>
    </div>
  )
}
