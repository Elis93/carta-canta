import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { FileText } from 'lucide-react'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BackButton } from '@/components/shared/BackButton'
import { formatDocNumber } from '@/lib/utils'
import { WorkPhotosCard, type WorkPhoto } from '@/app/(app)/preventivi/_components/WorkPhotosCard'
import { LavoroForm, type LavoroDefaults } from '../_components/LavoroForm'
import { DeleteLavoroButton } from '../_components/DeleteLavoroButton'

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
  try {
    const { data: lav } = await db
      .from('lavori')
      .select('id, title, address, notes, status, document_id, clients ( id, name, surname, email, phone, piva )')
      .eq('id', id)
      .eq('workspace_id', workspace.id)
      .is('deleted_at', null)
      .maybeSingle()
    if (!lav) notFound()

    defaults = {
      id: lav.id,
      title: lav.title ?? '',
      address: lav.address,
      notes: lav.notes,
      status: lav.status,
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

    if (documentId) {
      const [{ data: doc }, { data: fatt }, { data: wp }] = await Promise.all([
        supabase
          .from('documents')
          .select('doc_number, doc_type')
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
      fattura = fatt ?? null
      workPhotos = (wp ?? []) as WorkPhoto[]
    }
  } catch {
    notFound()
  }

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

      {/* Foto del lavoro (vivono sul preventivo di origine) */}
      {documentId && (
        <div style={{ padding: '0 15px 16px' }}>
          <WorkPhotosCard documentId={documentId} initialPhotos={workPhotos} />
        </div>
      )}
    </div>
  )
}
