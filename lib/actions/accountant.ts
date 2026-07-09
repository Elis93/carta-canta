'use server'

// ============================================================
// Canale commercialisti — FASE B. Azioni lato ARTIGIANO:
// invita / revoca / lista il proprio commercialista (per email).
// La tabella accountant_links ha RLS senza policy → si accede solo
// via admin client, sempre dopo aver verificato che chi agisce è il
// PROPRIETARIO del workspace.
// ============================================================

import { revalidatePath } from 'next/cache'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendEmail } from '@/lib/email/send'
import { AccountantInviteEmail } from '@/lib/email/templates/accountant_invite'
import { checkPublicRateLimit } from '@/lib/public-rate-limit'

type Result = { error?: string; success?: string } | null

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Solo il PROPRIETARIO del workspace può gestire i commercialisti.
async function getOwnerWorkspace(): Promise<{ id: string; name: string; ragione_sociale: string | null; ownerEmail: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: ws } = await supabase
    .from('workspaces')
    .select('id, name, ragione_sociale')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!ws) return null
  return { id: ws.id, name: ws.name, ragione_sociale: ws.ragione_sociale, ownerEmail: user.email ?? '' }
}

export async function inviteAccountantAction(emailRaw: string): Promise<Result> {
  const ws = await getOwnerWorkspace()
  if (!ws) return { error: 'Solo il titolare può invitare il commercialista.' }

  const email = emailRaw.trim().toLowerCase()
  if (!EMAIL_RE.test(email) || email.length > 200) return { error: 'Inserisci un indirizzo email valido.' }

  // Rate limit: max 10 inviti/ora per workspace (anti-abuso/enumeration)
  const rl = await checkPublicRateLimit({ key: `accountant-invite:${ws.id}`, limit: 10, window: '1 h', windowMs: 3_600_000 })
  if (rl.blocked) return { error: 'Troppi inviti in poco tempo. Riprova tra un po’.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 051 non in types/database.ts
  const db = createAdminClient() as any

  // Upsert: un solo invito per (workspace, email). Se era stato revocato, riattiva.
  const { data: existing } = await db
    .from('accountant_links')
    .select('id, revoked_at')
    .eq('workspace_id', ws.id)
    .eq('accountant_email', email) // email già normalizzata a minuscolo (match esatto, no wildcard LIKE)
    .maybeSingle()

  let token: string
  if (existing) {
    const { data: upd, error } = await db
      .from('accountant_links')
      .update({ revoked_at: null, invited_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select('token')
      .single()
    if (error) return { error: 'La migration 051 potrebbe non essere ancora applicata.' }
    token = upd.token
  } else {
    const { data: ins, error } = await db
      .from('accountant_links')
      .insert({ workspace_id: ws.id, accountant_email: email })
      .select('token')
      .single()
    if (error) return { error: 'La migration 051 potrebbe non essere ancora applicata.' }
    token = ins.token
  }

  // Email d'invito (best-effort, non blocca)
  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'
    await sendEmail({
      to: email,
      subject: `${ws.ragione_sociale ?? ws.name} ti ha invitato come commercialista su Carta Canta`,
      react: createElement(AccountantInviteEmail, {
        workspaceName: ws.ragione_sociale ?? ws.name,
        studioUrl: `${appUrl}/studio`,
      }),
    })
  } catch { /* non blocca l'invito */ }
  void token

  revalidatePath('/impostazioni')
  return { success: 'Invito inviato al commercialista.' }
}

export async function revokeAccountantAction(linkId: string): Promise<Result> {
  const ws = await getOwnerWorkspace()
  if (!ws) return { error: 'Solo il titolare può revocare l’accesso.' }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 051 non in types/database.ts
  const db = createAdminClient() as any
  const { error } = await db
    .from('accountant_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', linkId)
    .eq('workspace_id', ws.id) // scoping: non si può revocare un link di un altro workspace
  if (error) return { error: 'Revoca non riuscita.' }

  revalidatePath('/impostazioni')
  return { success: 'Accesso revocato.' }
}

export interface AccountantLinkView {
  id: string
  email: string
  invitedAt: string
  acceptedAt: string | null
}

// Elenco dei commercialisti invitati (attivi) del proprio workspace — per la card.
export async function listAccountantLinks(): Promise<AccountantLinkView[]> {
  const ws = await getOwnerWorkspace()
  if (!ws) return []
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 051 non in types/database.ts
  const db = createAdminClient() as any
  try {
    const { data } = await db
      .from('accountant_links')
      .select('id, accountant_email, invited_at, accepted_at')
      .eq('workspace_id', ws.id)
      .is('revoked_at', null)
      .order('invited_at', { ascending: false })
    return ((data ?? []) as Array<{ id: string; accountant_email: string; invited_at: string; accepted_at: string | null }>).map((l) => ({
      id: l.id, email: l.accountant_email, invitedAt: l.invited_at, acceptedAt: l.accepted_at,
    }))
  } catch {
    return [] // migration 051 non ancora applicata
  }
}
