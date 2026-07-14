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
    // PERF: sopralluogo e foto sono keyati entrambi sull'id di route →
    // un solo round trip invece di due in serie.
    // Prima con scheduled_at (047); se la colonna manca, retry senza.
    const [sopRes, photosRes] = await Promise.all([
      db
        .from('sopralluoghi')
        .select('id, title, address, notes, scheduled_at, document_id, clients ( id, name, surname, email, phone, piva )')
        .eq('id', id)
        .eq('workspace_id', workspace.id)
        .is('deleted_at', null)
        .maybeSingle(),
      db
        .from('work_photos')
        .select('id, storage_path')
        .eq('sopralluogo_id', id)
        .eq('workspace_id', workspace.id)
        .order('created_at', { ascending: true })
        .then((r: { data: unknown[] | null }) => r.data, () => null),
    ])
    let sop = sopRes.data
    const photos = photosRes
    if (!sop) {
      ;({ data: sop } = await db
        .from('sopralluoghi')
        .select('id, title, address, notes, document_id, clients ( id, name, surname, email, phone, piva )')
        .eq('id', id)
        .eq('workspace_id', workspace.id)
        .is('deleted_at', null)
        .maybeSingle())
    }
    if (!sop) notFound()
    // ISO → stringa datetime-local in ora italiana (il form la mostra così)
    const scheduledLocal = sop.scheduled_at
      ? new Date(sop.scheduled_at).toLocaleString('sv-SE', { timeZone: 'Europe/Rome' }).slice(0, 16).replace(' ', 'T')
      : null
    defaults = {
      id: sop.id,
      title: sop.title ?? '',
      address: sop.address,
      notes: sop.notes,
      scheduledAt: scheduledLocal,
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
      <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/sopralluoghi" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Sopralluogo</span>
        <DeleteSopralluogoButton sopralluogoId={id} />
      </div>
      <SopralluogoForm defaults={defaults} />
    </div>
  )
}
