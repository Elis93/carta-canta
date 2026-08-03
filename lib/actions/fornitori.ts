'use server'

// ============================================================
// Listini fornitori (Fase 2 — PROGETTO_LISTINO_FORNITORE.md).
// Funzione PRO (decisione congelata: margine gratis, listini Pro).
// 🔒 B.2: i costi dei listini sono PRIVATI dell'artigiano — queste
// tabelle non vengono mai lette da superfici pubbliche.
// Tolleranti pre-063: tabella assente → messaggio chiaro, mai crash.
// ============================================================

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod/v4'
import { createClient } from '@/lib/supabase/server'
import { matchRinnovo, type ListinoItemEsistente } from '@/lib/fornitori/listino'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const PRO_ERROR = 'I listini fornitori sono una funzione Pro. Passa a Pro da Altro › Abbonamento.'
const MIGRATION_ERROR = 'I listini fornitori non sono ancora attivi su questo database (migration 063 da applicare).'

const ListSchema = z.object({
  name: z.string().min(1, 'Il nome del fornitore è obbligatorio').max(120),
  markup_pct: z.coerce.number().min(0).max(500).nullable().optional(),
  valid_until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
})

const ItemSchema = z.object({
  code: z.string().max(60).nullable().optional(),
  description: z.string().min(1, 'La descrizione è obbligatoria').max(300),
  unit: z.string().min(1).max(20).default('pz'),
  unit_cost: z.coerce.number().min(0, 'Il costo non può essere negativo'),
})

async function getProWorkspace(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let { data: workspace } = await supabase
    .from('workspaces')
    .select('id, plan')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) {
    const { data: membership } = await supabase
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .not('accepted_at', 'is', null)
      .limit(1)
      .maybeSingle()
    if (membership) {
      const { data: mw } = await supabase
        .from('workspaces')
        .select('id, plan')
        .eq('id', membership.workspace_id)
        .maybeSingle()
      workspace = mw
    }
  }
  if (!workspace) redirect('/login')
  return workspace
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 063 non ancora in types/database.ts
const db = (supabase: unknown) => supabase as any

function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

function parseListForm(formData: FormData) {
  return ListSchema.safeParse({
    name: formData.get('name'),
    markup_pct: (formData.get('markup_pct') || null) as string | null,
    valid_until: (formData.get('valid_until') || null) as string | null,
  })
}

// ── CRUD listino ────────────────────────────────────────────────────────

export async function createSupplierListAction(formData: FormData) {
  const supabase = await createClient()
  const workspace = await getProWorkspace(supabase)
  if (workspace.plan === 'free') return { error: PRO_ERROR }

  const parsed = parseListForm(formData)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dati non validi' }

  const { data, error } = await db(supabase)
    .from('supplier_lists')
    .insert({
      workspace_id: workspace.id,
      name: parsed.data.name.trim(),
      markup_pct: parsed.data.markup_pct ?? null,
      valid_until: parsed.data.valid_until ?? null,
    })
    .select('id')
    .single()

  if (error) {
    if (isMissingTable(error)) return { error: MIGRATION_ERROR }
    return { error: 'Impossibile creare il listino. Riprova.' }
  }
  revalidatePath('/catalogo')
  return { success: true, id: data.id as string }
}

export async function updateSupplierListAction(id: string, formData: FormData) {
  const supabase = await createClient()
  const workspace = await getProWorkspace(supabase)
  if (workspace.plan === 'free') return { error: PRO_ERROR }
  if (!UUID_RE.test(id)) return { error: 'Listino non trovato.' }

  const parsed = parseListForm(formData)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dati non validi' }

  const { data, error } = await db(supabase)
    .from('supplier_lists')
    .update({
      name: parsed.data.name.trim(),
      markup_pct: parsed.data.markup_pct ?? null,
      valid_until: parsed.data.valid_until ?? null,
    })
    .eq('id', id)
    .eq('workspace_id', workspace.id)
    .select('id')

  if (error) {
    if (isMissingTable(error)) return { error: MIGRATION_ERROR }
    return { error: 'Impossibile salvare le modifiche. Riprova.' }
  }
  if (!data || data.length === 0) return { error: 'Listino non trovato.' }
  revalidatePath('/catalogo')
  revalidatePath(`/catalogo/fornitori/${id}`)
  return { success: true }
}

export async function deleteSupplierListAction(id: string) {
  const supabase = await createClient()
  const workspace = await getProWorkspace(supabase)
  if (workspace.plan === 'free') return { error: PRO_ERROR }
  if (!UUID_RE.test(id)) return { error: 'Listino non trovato.' }

  // Le voci del listino spariscono con lui (CASCADE); i documenti che hanno
  // usato quei prezzi NON si toccano: il costo è congelato sulla voce (062)
  // e supplier_list_id va a NULL da solo (FK SET NULL).
  const { error } = await db(supabase)
    .from('supplier_lists')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspace.id)

  if (error) {
    if (isMissingTable(error)) return { error: MIGRATION_ERROR }
    return { error: 'Impossibile eliminare il listino. Riprova.' }
  }
  revalidatePath('/catalogo')
  return { success: true }
}

// ── CRUD voci del listino ───────────────────────────────────────────────

function parseItemForm(formData: FormData) {
  return ItemSchema.safeParse({
    code: (formData.get('code') || null) as string | null,
    description: formData.get('description'),
    unit: formData.get('unit') || 'pz',
    unit_cost: formData.get('unit_cost'),
  })
}

export async function addSupplierItemAction(listId: string, formData: FormData) {
  const supabase = await createClient()
  const workspace = await getProWorkspace(supabase)
  if (workspace.plan === 'free') return { error: PRO_ERROR }
  if (!UUID_RE.test(listId)) return { error: 'Listino non trovato.' }

  const parsed = parseItemForm(formData)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dati non validi' }

  // Il listino deve essere del workspace (RLS copre, ma il filtro rende
  // l'errore onesto invece di violare la FK)
  const { data: list } = await db(supabase)
    .from('supplier_lists')
    .select('id')
    .eq('id', listId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()
  if (!list) return { error: 'Listino non trovato.' }

  const { error } = await db(supabase)
    .from('supplier_list_items')
    .insert({
      list_id: listId,
      workspace_id: workspace.id,
      code: parsed.data.code?.trim() || null,
      description: parsed.data.description.trim(),
      unit: parsed.data.unit.trim() || 'pz',
      unit_cost: Math.round(parsed.data.unit_cost * 100) / 100,
    })

  if (error) {
    if (isMissingTable(error)) return { error: MIGRATION_ERROR }
    return { error: 'Impossibile salvare la voce. Riprova.' }
  }
  revalidatePath(`/catalogo/fornitori/${listId}`)
  return { success: true }
}

export async function updateSupplierItemAction(itemId: string, formData: FormData) {
  const supabase = await createClient()
  const workspace = await getProWorkspace(supabase)
  if (workspace.plan === 'free') return { error: PRO_ERROR }
  if (!UUID_RE.test(itemId)) return { error: 'Voce non trovata.' }

  const parsed = parseItemForm(formData)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Dati non validi' }

  const { data, error } = await db(supabase)
    .from('supplier_list_items')
    .update({
      code: parsed.data.code?.trim() || null,
      description: parsed.data.description.trim(),
      unit: parsed.data.unit.trim() || 'pz',
      unit_cost: Math.round(parsed.data.unit_cost * 100) / 100,
    })
    .eq('id', itemId)
    .eq('workspace_id', workspace.id)
    .select('list_id')

  if (error) {
    if (isMissingTable(error)) return { error: MIGRATION_ERROR }
    return { error: 'Impossibile salvare la voce. Riprova.' }
  }
  if (!data || data.length === 0) return { error: 'Voce non trovata.' }
  revalidatePath(`/catalogo/fornitori/${data[0].list_id}`)
  return { success: true }
}

export async function deleteSupplierItemAction(itemId: string) {
  const supabase = await createClient()
  const workspace = await getProWorkspace(supabase)
  if (workspace.plan === 'free') return { error: PRO_ERROR }
  if (!UUID_RE.test(itemId)) return { error: 'Voce non trovata.' }

  const { data, error } = await db(supabase)
    .from('supplier_list_items')
    .delete()
    .eq('id', itemId)
    .eq('workspace_id', workspace.id)
    .select('list_id')

  if (error) {
    if (isMissingTable(error)) return { error: MIGRATION_ERROR }
    return { error: 'Impossibile eliminare la voce. Riprova.' }
  }
  if (data?.[0]?.list_id) revalidatePath(`/catalogo/fornitori/${data[0].list_id}`)
  return { success: true }
}

// ── Import AI (primo import E rinnovo — flusso F) ───────────────────────
// Stessa quota AI dell'import catalogo (decisione: "stessa quota/kill-switch").
// L'import si conta SOLO qui al salvataggio, come per il catalogo.
// Se il listino ha già voci → RINNOVO: abbina per codice/descrizione,
// aggiorna i costi, inserisce le nuove, riepilogo dei rincari.

const ImportedSchema = z.object({
  code: z.string().max(60).nullable().optional(),
  description: z.string().min(1).max(300),
  unit: z.string().min(1).max(20).default('pz'),
  unit_cost: z.coerce.number().min(0),
})

export async function importSupplierItemsAction(
  listId: string,
  rawItems: unknown,
  validUntil?: string | null
): Promise<{ error?: string; matched?: number; added?: number; increased?: number; avgIncreasePct?: number | null }> {
  const supabase = await createClient()
  const workspace = await getProWorkspace(supabase)
  if (workspace.plan === 'free') return { error: PRO_ERROR }
  if (!UUID_RE.test(listId)) return { error: 'Listino non trovato.' }

  const parsed = z.array(ImportedSchema).min(1).max(200).safeParse(rawItems)
  if (!parsed.success) return { error: 'Voci non valide. Controlla i dati e riprova.' }

  const validDate = validUntil && /^\d{4}-\d{2}-\d{2}$/.test(validUntil) ? validUntil : null

  const { data: list, error: listErr } = await db(supabase)
    .from('supplier_lists')
    .select('id')
    .eq('id', listId)
    .eq('workspace_id', workspace.id)
    .maybeSingle()
  if (listErr && isMissingTable(listErr)) return { error: MIGRATION_ERROR }
  if (!list) return { error: 'Listino non trovato.' }

  // Quota AI: si consuma al salvataggio (stessa regola dell'import catalogo)
  const { getAiImportQuota, recordAiImportUse, quotaExhaustedMessage } = await import('@/lib/ai/quota')
  const quota = await getAiImportQuota(workspace.id, workspace.plan)
  if (!quota.allowed) return { error: quotaExhaustedMessage(quota.reason) }

  const imported = parsed.data.map((it) => ({
    code: it.code?.trim() || null,
    description: it.description.trim(),
    unit: it.unit.trim() || 'pz',
    unit_cost: Math.round(it.unit_cost * 100) / 100,
  }))

  const { data: existing, error: exErr } = await db(supabase)
    .from('supplier_list_items')
    .select('id, code, description, unit_cost')
    .eq('list_id', listId)
  if (exErr) {
    if (isMissingTable(exErr)) return { error: MIGRATION_ERROR }
    return { error: 'Impossibile leggere il listino. Riprova.' }
  }

  const esito = matchRinnovo(
    (existing ?? []).map((e: { id: string; code: string | null; description: string; unit_cost: number }): ListinoItemEsistente => ({
      id: e.id, code: e.code, description: e.description, unit_cost: Number(e.unit_cost),
    })),
    imported
  )

  // Aggiornamenti (rinnovo) — uno per voce abbinata
  for (const u of esito.updates) {
    const { error } = await db(supabase)
      .from('supplier_list_items')
      .update({ unit_cost: u.unit_cost })
      .eq('id', u.id)
      .eq('workspace_id', workspace.id)
    if (error) return { error: 'Aggiornamento non riuscito a metà: riprova l’import.' }
  }

  // Inserimenti (voci nuove)
  if (esito.additions.length > 0) {
    const { error } = await db(supabase)
      .from('supplier_list_items')
      .insert(esito.additions.map((it) => ({
        list_id: listId,
        workspace_id: workspace.id,
        code: it.code ?? null,
        description: it.description,
        unit: it.unit,
        unit_cost: it.unit_cost,
      })))
    if (error) return { error: 'Salvataggio non riuscito. Riprova.' }
  }

  // Nuova scadenza del listino (se indicata) + touch updated_at
  await db(supabase)
    .from('supplier_lists')
    .update(validDate ? { valid_until: validDate } : { updated_at: new Date().toISOString() })
    .eq('id', listId)
    .eq('workspace_id', workspace.id)

  await recordAiImportUse(workspace.id, workspace.plan, imported.length)

  revalidatePath('/catalogo')
  revalidatePath(`/catalogo/fornitori/${listId}`)
  return {
    matched: esito.stats.matched,
    added: esito.stats.added,
    increased: esito.stats.increased,
    avgIncreasePct: esito.stats.avgIncreasePct,
  }
}
