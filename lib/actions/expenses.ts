'use server'

// ============================================================
// Server Actions — Spese del Bilancio (feature Pro)
// Tabella `expenses` (migration 038). NB: types/database.ts non ancora
// rigenerato → accesso alla tabella con cast esplicito.
// ============================================================

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { parseImportoIt } from '@/lib/utils'

type ActionResult = { error?: string; success?: string } | null

// Workspace dell'utente corrente (owner o membro invitato)
async function getWorkspace(): Promise<{ id: string; plan: string } | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('workspaces')
    .select('id, plan')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (data) return data

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .not('accepted_at', 'is', null)
    .limit(1)
    .maybeSingle()
  if (!membership) return null

  const { data: memberWs } = await supabase
    .from('workspaces')
    .select('id, plan')
    .eq('id', membership.workspace_id)
    .maybeSingle()
  return memberWs
}

// Parsing importi in formato italiano: parseImportoIt in lib/utils
// (gestisce "1.500,50" e "85.50" — la versione locale precedente leggeva
// "85.50" come 8550).

export async function createExpenseAction(formData: FormData): Promise<ActionResult> {
  const workspace = await getWorkspace()
  if (!workspace) return { error: 'Sessione scaduta. Ricarica la pagina.' }
  if (workspace.plan === 'free') return { error: 'Il Bilancio è una funzione Pro.' }

  const amount = parseImportoIt(String(formData.get('amount') ?? ''))
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: 'Inserisci un importo valido (es. 85,50).' }
  }

  const description = String(formData.get('description') ?? '').trim()
  if (!description) return { error: 'Inserisci una descrizione della spesa.' }

  const dateRaw = String(formData.get('date') ?? '').trim()
  const date = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
    ? dateRaw
    : new Date().toISOString().slice(0, 10)

  // Categoria: preset dal dropdown, oppure testo libero ("Altra categoria…")
  const categoryCustom = String(formData.get('category_custom') ?? '').trim()
  const categoryPresetRaw = String(formData.get('category') ?? '').trim()
  const categoryPreset = categoryPresetRaw === '__custom__' ? '' : categoryPresetRaw
  const category = (categoryCustom || categoryPreset || 'Altro').slice(0, 40)

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella `expenses` (038) non ancora in types/database.ts
  const db = supabase as any
  const { error } = await db.from('expenses').insert({
    workspace_id: workspace.id,
    date,
    description,
    amount: Math.round(amount * 100) / 100,
    category,
  })

  if (error) return { error: 'Salvataggio non riuscito. Riprova.' }

  revalidatePath('/bilancio')
  return { success: 'Spesa salvata' }
}

export async function deleteExpenseAction(expenseId: string): Promise<ActionResult> {
  const workspace = await getWorkspace()
  if (!workspace) return { error: 'Sessione scaduta. Ricarica la pagina.' }

  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella `expenses` (038) non ancora in types/database.ts
  const db = supabase as any
  const { error } = await db
    .from('expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', expenseId)
    .eq('workspace_id', workspace.id)

  if (error) return { error: 'Eliminazione non riuscita. Riprova.' }

  revalidatePath('/bilancio')
  return { success: 'Spesa eliminata' }
}
