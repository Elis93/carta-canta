import { redirect, notFound } from 'next/navigation'
import { getSessionWorkspace } from '@/lib/workspace-context'
import { BackButton } from '@/components/shared/BackButton'
import { SopralluogoForm, type SopralluogoDefaults } from '../_components/SopralluogoForm'
import { DeleteSopralluogoButton } from '../_components/DeleteSopralluogoButton'

export const metadata = { title: 'Sopralluogo' }

export default async function SopralluogoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const { supabase, user, workspace } = await getSessionWorkspace()
  if (!user) redirect('/login')
  if (!workspace) redirect('/onboarding')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 041 non ancora in types/database.ts
  const db = supabase as any
  let defaults: SopralluogoDefaults | null = null
  try {
    const [{ data: sop }, { data: photos }] = await Promise.all([
      db
        .from('sopralluoghi')
        .select('id, title, address, notes, document_id, clients ( id, name, surname, email, phone, piva )')
        .eq('id', id)
        .eq('workspace_id', workspace.id)
        .is('deleted_at', null)
        .maybeSingle(),
      db
        .from('work_photos')
        .select('id, storage_path')
        .eq('sopralluogo_id', id)
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: true }),
    ])
    if (!sop) notFound()
    defaults = {
      id: sop.id,
      title: sop.title ?? '',
      address: sop.address,
      notes: sop.notes,
      documentId: sop.document_id,
      client: sop.clients
        ? {
            id: sop.clients.id,
            name: sop.clients.name ?? '',
            surname: sop.clients.surname ?? null,
            email: sop.clients.email ?? null,
            phone: sop.clients.phone ?? null,
            piva: sop.clients.piva ?? null,
          }
        : null,
      photos: (photos ?? []) as Array<{ id: string; storage_path: string }>,
    }
  } catch {
    notFound()
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div style={{ background: '#fff', borderBottom: '0.5px solid #eeeeee', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/sopralluoghi" />
        <span style={{ flex: 1, fontSize: 17, fontWeight: 600, color: '#161616' }}>Sopralluogo</span>
        <DeleteSopralluogoButton sopralluogoId={id} />
      </div>
      <SopralluogoForm defaults={defaults} />
    </div>
  )
}
