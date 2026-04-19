'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod/v4'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { PLAN_FEATURES } from '@/lib/stripe/plans'

// ── Tipi pubblici ─────────────────────────────────────────────────────────────

export type MemberRole = 'admin' | 'operator' | 'viewer'

export interface WorkspaceMember {
  user_id: string
  role: MemberRole
  invited_at: string | null
  accepted_at: string | null
  email: string
  full_name: string | null
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function getOwnerWorkspace() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, plan')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) redirect('/login')

  return { user, workspace }
}

// ── Carica membri (usata dalla page) ──────────────────────────────────────────

export async function getWorkspaceMembers(workspaceId: string): Promise<WorkspaceMember[]> {
  const admin = createAdminClient()

  const { data: rows } = await admin
    .from('workspace_members')
    .select('user_id, role, invited_at, accepted_at')
    .eq('workspace_id', workspaceId)
    .order('invited_at', { ascending: true })

  if (!rows || rows.length === 0) return []

  // Fetch info utente per ogni membro (max 5 per piano team — nessun problema perf)
  const members: WorkspaceMember[] = []
  for (const row of rows) {
    try {
      const { data } = await admin.auth.admin.getUserById(row.user_id)
      const u = data?.user
      members.push({
        user_id: row.user_id,
        role: row.role as MemberRole,
        invited_at: row.invited_at ?? null,
        accepted_at: row.accepted_at ?? null,
        email: u?.email ?? '—',
        full_name: (u?.user_metadata?.full_name as string | null)
          ?? ((u?.user_metadata?.nome || u?.user_metadata?.cognome)
            ? `${u?.user_metadata?.nome ?? ''} ${u?.user_metadata?.cognome ?? ''}`.trim()
            : null),
      })
    } catch {
      // Utente non trovato (raro) — include entry minimale
      members.push({
        user_id: row.user_id,
        role: row.role as MemberRole,
        invited_at: row.invited_at ?? null,
        accepted_at: row.accepted_at ?? null,
        email: '—',
        full_name: null,
      })
    }
  }

  return members
}

// ── inviteMemberAction ────────────────────────────────────────────────────────

const InviteSchema = z.object({
  email: z.email('Email non valida'),
  role: z.enum(['operator', 'viewer']),
})

export async function inviteMemberAction(
  _prev: { error?: string; success?: boolean } | null,
  formData: FormData
): Promise<{ error?: string; success?: boolean; name?: string }> {
  const { user, workspace } = await getOwnerWorkspace()

  const parsed = InviteSchema.safeParse({
    email: formData.get('email'),
    role:  formData.get('role'),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi' }
  }

  // Verifica limite piano
  const features = PLAN_FEATURES[workspace.plan]
  if (features.teamMembers === 0) {
    return { error: 'Il piano attuale non include collaboratori. Passa al piano Team.' }
  }

  const admin = createAdminClient()

  // Conta membri esistenti
  const { count } = await admin
    .from('workspace_members')
    .select('user_id', { count: 'exact', head: true })
    .eq('workspace_id', workspace.id)

  if ((count ?? 0) >= features.teamMembers) {
    return { error: `Hai raggiunto il limite di ${features.teamMembers} collaboratori per il piano Team.` }
  }

  // Cerca utente per email (paginato, max 1000 — sufficiente per SaaS early-stage)
  const { data: { users } } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const target = users.find((u) => u.email === parsed.data.email)

  if (!target) {
    return {
      error: `Nessun account trovato per "${parsed.data.email}". L'utente deve prima registrarsi a Carta Canta.`,
    }
  }
  if (target.id === user.id) {
    return { error: "Non puoi invitare te stesso." }
  }

  // Già membro?
  const { data: existing } = await admin
    .from('workspace_members')
    .select('user_id')
    .eq('workspace_id', workspace.id)
    .eq('user_id', target.id)
    .maybeSingle()

  if (existing) {
    return { error: 'Questo utente è già membro del workspace.' }
  }

  const { error: insertError } = await admin
    .from('workspace_members')
    .insert({
      workspace_id: workspace.id,
      user_id:      target.id,
      role:         parsed.data.role,
      invited_by:   user.id,
      accepted_at:  new Date().toISOString(), // accesso immediato, no token email
    })

  if (insertError) {
    console.error('[team/invite]', insertError)
    return { error: "Errore nell'aggiunta del membro." }
  }

  revalidatePath('/impostazioni')
  const name = (target.user_metadata?.full_name as string | null) ?? parsed.data.email
  return { success: true, name }
}

// ── removeMemberAction ────────────────────────────────────────────────────────

export async function removeMemberAction(userId: string): Promise<{ error?: string; success?: boolean }> {
  const { workspace } = await getOwnerWorkspace()
  const admin = createAdminClient()

  const { error } = await admin
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspace.id)
    .eq('user_id', userId)

  if (error) {
    console.error('[team/remove]', error)
    return { error: 'Errore nella rimozione del membro.' }
  }

  revalidatePath('/impostazioni')
  return { success: true }
}

// ── updateMemberRoleAction ────────────────────────────────────────────────────

export async function updateMemberRoleAction(
  userId: string,
  role: MemberRole
): Promise<{ error?: string; success?: boolean }> {
  const { workspace } = await getOwnerWorkspace()
  const admin = createAdminClient()

  const { error } = await admin
    .from('workspace_members')
    .update({ role })
    .eq('workspace_id', workspace.id)
    .eq('user_id', userId)

  if (error) return { error: 'Errore nel cambio ruolo.' }

  revalidatePath('/impostazioni')
  return { success: true }
}
