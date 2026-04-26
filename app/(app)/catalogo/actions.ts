'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod/v4'
import { createClient } from '@/lib/supabase/server'

const ItemSchema = z.object({
  name:        z.string().min(1, 'Nome obbligatorio').max(200),
  description: z.string().max(500).optional(),
  unit:        z.string().min(1).max(20).default('pz'),
  unit_price:  z.coerce.number().min(0),
  vat_rate:    z.coerce.number().min(0).max(100).nullable().optional(),
  category:    z.string().max(100).optional(),
})

async function getWorkspace(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) redirect('/login')
  return workspace
}

export async function createCatalogItemAction(formData: FormData) {
  const supabase = await createClient()
  const workspace = await getWorkspace(supabase)

  const raw = {
    name:        formData.get('name'),
    description: formData.get('description') || undefined,
    unit:        formData.get('unit') || 'pz',
    unit_price:  formData.get('unit_price'),
    vat_rate:    formData.get('vat_rate') || null,
    category:    formData.get('category') || undefined,
  }

  const parsed = ItemSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi' }
  }

  const { data, error } = await supabase
    .from('catalog_items')
    .insert({
      workspace_id: workspace.id,
      name:         parsed.data.name,
      description:  parsed.data.description ?? null,
      unit:         parsed.data.unit,
      unit_price:   parsed.data.unit_price,
      vat_rate:     parsed.data.vat_rate ?? null,
      category:     parsed.data.category ?? null,
    })
    .select('id')
    .single()

  if (error) return { error: 'Errore nel salvataggio' }

  revalidatePath('/catalogo')
  return { success: true, id: data.id }
}

export async function updateCatalogItemAction(id: string, formData: FormData) {
  const supabase = await createClient()
  const workspace = await getWorkspace(supabase)

  const raw = {
    name:        formData.get('name'),
    description: formData.get('description') || undefined,
    unit:        formData.get('unit') || 'pz',
    unit_price:  formData.get('unit_price'),
    vat_rate:    formData.get('vat_rate') || null,
    category:    formData.get('category') || undefined,
  }

  const parsed = ItemSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi' }
  }

  const { error } = await supabase
    .from('catalog_items')
    .update({
      name:        parsed.data.name,
      description: parsed.data.description ?? null,
      unit:        parsed.data.unit,
      unit_price:  parsed.data.unit_price,
      vat_rate:    parsed.data.vat_rate ?? null,
      category:    parsed.data.category ?? null,
    })
    .eq('id', id)
    .eq('workspace_id', workspace.id)

  if (error) return { error: 'Errore nel salvataggio' }

  revalidatePath('/catalogo')
  return { success: true }
}

export async function deleteCatalogItemAction(id: string) {
  const supabase = await createClient()
  const workspace = await getWorkspace(supabase)

  const { error } = await supabase
    .from('catalog_items')
    .delete()
    .eq('id', id)
    .eq('workspace_id', workspace.id)

  if (error) return { error: 'Errore nella cancellazione' }

  revalidatePath('/catalogo')
  return { success: true }
}

export async function toggleCatalogItemAction(id: string, is_active: boolean) {
  const supabase = await createClient()
  const workspace = await getWorkspace(supabase)

  const { error } = await supabase
    .from('catalog_items')
    .update({ is_active })
    .eq('id', id)
    .eq('workspace_id', workspace.id)

  if (error) return { error: 'Errore aggiornamento voce catalogo' }

  revalidatePath('/catalogo')
  return { success: true }
}
