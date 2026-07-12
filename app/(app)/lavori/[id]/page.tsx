import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BackButton } from '@/components/shared/BackButton'
import { formatDocNumber, formatCurrency } from '@/lib/utils'
import { WorkPhotosCard, type WorkPhoto } from '@/app/(app)/preventivi/_components/WorkPhotosCard'
import { AddExpenseDialog } from '@/app/(app)/bilancio/_components/AddExpenseDialog'
import { LavoroForm, type LavoroDefaults } from '../_components/LavoroForm'
import { DeleteLavoroButton } from '../_components/DeleteLavoroButton'
import { RapportinoCard, type RapportinoData } from '../_components/RapportinoCard'

export const metadata = { title: 'Lavoro' }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

export default async function LavoroDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 048 non ancora in types/database.ts
  const db = supabase as any
  let defaults: LavoroDefaults | null = null
  let documentId: string | null = null
  let docInfo: { doc_number: string | null; doc_type: string } | null = null
  let fattura: { id: string; doc_number: string | null } | null = null
  let workPhotos: WorkPhoto[] = []
  let preventivato: number | null = null
  let spese: Array<{ id: string; description: string; amount: number; date: string }> = []
  let rapportino: RapportinoData | null = null
  try {
    // Prima con le colonne 049 (scheduled_at + report_*); se mancano, retry senza.
    let { data: lav } = await db
      .from('lavori')
      .select('id, title, address, notes, status, scheduled_at, document_id, report_token, report_text, report_signed_at, report_signer_name, clients ( id, name, surname, email, phone, piva )')
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (!lav) {
      ;({ data: lav } = await db
        .from('lavori')
        .select('id, title, address, notes, status, document_id, clients ( id, name, surname, email, phone, piva )')
        .eq('id', id)
        .eq('workspace_id', workspace.id)
        .is('deleted_at', null)
        .maybeSingle())
    }
    if (!lav) notFound()

    const scheduledLocal = lav.scheduled_at
      ? new Date(lav.scheduled_at).toLocaleString('sv-SE', { timeZone: 'Europe/Rome' }).slice(0, 16).replace(' ', 'T')
      : null

    defaults = {
      id: lav.id,
      title: lav.title ?? '',
      address: lav.address,
      notes: lav.notes,
      status: lav.status,
      scheduledAt: scheduledLocal,
      client: lav.clients
        ? {
            id: lav.clients.id,
            name: lav.clients.name ?? '',
            surname: lav.clients.surname ?? null,
            email: lav.clients.email ?? null,
            phone: lav.clients.phone ?? null,
            piva: lav.clients.piva ?? null,
          }
        : null,
    }
    documentId = lav.document_id

    // Rapportino di fine lavoro (049) — la card compare quando il lavoro è
    // finito/fatturato oppure se un rapportino esiste già.
    if ('report_token' in lav && (lav.status === 'finito' || lav.status === 'fatturato' || lav.report_token)) {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'
      rapportino = {
        lavoroId: lav.id,
        text: lav.report_text ?? null,
        url: lav.report_token ? `${appUrl}/r/${lav.report_token}` : null,
        signedAt: lav.report_signed_at ?? null,
        signerName: lav.report_signer_name ?? null,
        clientPhone: lav.clients?.phone ?? null,
      }
    }

    // Spese collegate (margine, 049) — tollerante
    try {
      const { data: exp } = await db
        .from('expenses')
        .select('id, description, amount, date')
        .eq('lavoro_id', id)
        .eq('workspace_id', workspace.id)
        .is('deleted_at', null)
        .order('date', { ascending: false })
      spese = (exp ?? []) as typeof spese
    } catch { /* colonna 049 assente */ }

    if (documentId) {
      const [{ data: doc }, { data: fatt }, { data: wp }] = await Promise.all([
        supabase
          .from('documents')
          .select('doc_number, doc_type, total')
          .eq('id', documentId)
          .maybeSingle(),
        supabase
          .from('documents')
          .select('id, doc_number')
          .eq('origin_document_id', documentId)
          .eq('doc_type', 'fattura')
          .is('deleted_at', null)
          .limit(1)
          .maybeSingle(),
        db
          .from('work_photos')
          .select('id, storage_path, label, visible_to_client, sopralluogo_id')
          .eq('document_id', documentId)
          .eq('workspace_id', workspace.id)
          .order('created_at', { ascending: true }),
      ])
      docInfo = doc ?? null
      preventivato = doc?.total != null ? Number(doc.total) : null
      fattura = fatt ?? null
      workPhotos = (wp ?? []) as WorkPhoto[]
    }
  } catch {
    notFound()
  }

  const speseTotale = spese.length > 0 ? spese.reduce((s, e) => s + Number(e.amount), 0) : (spese.length === 0 && preventivato != null ? 0 : null)
  const margine = preventivato != null && speseTotale != null ? preventivato - speseTotale : null

  return (
    <div className="max-w-3xl mx-auto">
      <div style={{ background: '#fff', borderBottom: '0.5px solid #eeeeee', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/lavori" />
        <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: '#161616' }}>Lavoro</span>
        <DeleteLavoroButton lavoroId={id} />
      </div>

      {/* Documenti collegati */}
      {documentId && (
        <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '12px 15px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link href={`/preventivi/${documentId}`} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600, color: '#1a1a2e', textDecoration: 'none' }}>
            <FileText size={15} /> Preventivo {docInfo?.doc_number ? formatDocNumber(docInfo.doc_number) : ''} →
          </Link>
          {fattura && (
            <Link href={`/fatture/${fattura.id}`} style={{ display: 'flex', alignItems: 'center', gap: 9, fontSize: 13, fontWeight: 600, color: '#1a1a2e', textDecoration: 'none' }}>
              <FileText size={15} /> Fattura {fattura.doc_number ? formatDocNumber(fattura.doc_number, 'fattura') : ''} →
            </Link>
          )}
        </div>
      )}

      <LavoroForm defaults={defaults} />

      {/* Economia del lavoro: preventivato vs speso (margine) */}
      <div style={{ padding: '0 15px 13px' }}>
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 10 }}>
            Economia del lavoro
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Preventivato', value: preventivato, color: '#161616' },
              { label: 'Speso', value: speseTotale, color: '#b05656' },
              { label: 'Margine', value: margine, color: margine != null && margine < 0 ? '#b05656' : '#2f8a63' },
            ].map((kpi) => (
              <div key={kpi.label} style={{ flex: 1, background: '#fafafa', borderRadius: 11, padding: '10px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#8a887f' }}>{kpi.label}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginTop: 3, color: kpi.color, whiteSpace: 'nowrap' }}>
                  {kpi.value != null ? formatCurrency(kpi.value) : '—'}
                </div>
              </div>
            ))}
          </div>
          {spese.length > 0 && (
            <div style={{ marginTop: 10 }}>
              {spese.map((e, i) => (
                <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: i === 0 ? '0.5px solid #eee' : 'none', borderBottom: i < spese.length - 1 ? '0.5px solid #eee' : 'none', fontSize: 13 }}>
                  <span style={{ color: '#161616', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.description}</span>
                  <span style={{ color: '#55534b', fontWeight: 600, flexShrink: 0 }}>{formatCurrency(Number(e.amount))}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 12 }}>
            {workspace.plan === 'free' ? (
              /* Il salvataggio spese è Pro (come il Bilancio): niente form
                 che si rifiuta solo ALLA FINE — lock chiaro subito. */
              <Link
                href="/abbonamento"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '1px solid #e8d6ad', borderRadius: 11, background: '#fdf9ef', color: '#b0863e', fontSize: 13, fontWeight: 600, padding: '11px 0', textDecoration: 'none' }}
              >
                Le spese del lavoro sono una funzione Pro — Scopri Pro
              </Link>
            ) : (
              <AddExpenseDialog lavori={defaults ? [{ id: defaults.id, title: defaults.title || 'Questo lavoro' }] : []} defaultLavoroId={defaults?.id} />
            )}
          </div>
          {preventivato == null && (
            <p style={{ fontSize: 12, color: '#8a887f', marginTop: 8, lineHeight: 1.45 }}>
              Il &laquo;preventivato&raquo; compare quando il lavoro nasce da un preventivo.
            </p>
          )}
        </div>
      </div>

      {/* Rapportino di fine lavoro (firma del cliente via /r/[token]) */}
      {rapportino && (
        <div style={{ padding: '0 15px 13px' }}>
          <RapportinoCard data={rapportino} />
        </div>
      )}

      {/* Foto del lavoro (vivono sul preventivo di origine) */}
      {documentId && (
        <div style={{ padding: '0 15px 16px' }}>
          <WorkPhotosCard documentId={documentId} initialPhotos={workPhotos} />
        </div>
      )}
    </div>
  )
}
