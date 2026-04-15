'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod/v4'

// ── SCHEMA ────────────────────────────────────────────────────
const TemplateSchema = z.object({
  name: z.string().min(2, 'Il nome deve essere di almeno 2 caratteri'),
  description: z.string().optional().or(z.literal('')),
  color_primary: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Colore non valido (es. #1a1a2e)')
    .default('#1a1a2e'),
  font_family: z.enum(['Inter', 'GeistSans', 'Helvetica', 'Georgia']).default('Inter'),
  show_logo: z.boolean().default(true),
  show_watermark: z.boolean().default(false),
  legal_notice: z.string().optional().or(z.literal('')),
  header_html: z.string().optional().or(z.literal('')),
  footer_html: z.string().optional().or(z.literal('')),
  is_default: z.boolean().default(false),
})

type ActionResult = { error?: string; success?: string; id?: string } | null

const FREE_TEMPLATE_LIMIT = 1

// ── HELPER ────────────────────────────────────────────────────
async function getWorkspaceWithPlan() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from('workspaces')
    .select('id, plan')
    .eq('owner_id', user.id)
    .maybeSingle()
  return data
}

// ── CREATE ─────────────────────────────────────────────────────
export async function createTemplateAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const workspace = await getWorkspaceWithPlan()
  if (!workspace) return { error: 'Non autenticato.' }

  // Controllo limite piano Free
  if (workspace.plan === 'free') {
    const { count } = await supabase
      .from('templates')
      .select('id', { count: 'exact', head: true })
      .eq('workspace_id', workspace.id)
    if ((count ?? 0) >= FREE_TEMPLATE_LIMIT) {
      return {
        error: `Il piano Free include ${FREE_TEMPLATE_LIMIT} template. Passa a Pro per template illimitati.`,
      }
    }
  }

  const raw = {
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || '',
    color_primary: (formData.get('color_primary') as string) || '#1a1a2e',
    font_family: (formData.get('font_family') as string) || 'Inter',
    show_logo: formData.get('show_logo') === 'true',
    show_watermark: formData.get('show_watermark') === 'true',
    legal_notice: (formData.get('legal_notice') as string) || '',
    header_html: (formData.get('header_html') as string) || '',
    footer_html: (formData.get('footer_html') as string) || '',
    is_default: formData.get('is_default') === 'true',
  }

  const parsed = TemplateSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  // Se is_default, rimuovi default dagli altri
  if (parsed.data.is_default) {
    await supabase
      .from('templates')
      .update({ is_default: false })
      .eq('workspace_id', workspace.id)
  }

  const { data: tmpl, error } = await supabase
    .from('templates')
    .insert({
      workspace_id: workspace.id,
      ...parsed.data,
      description: parsed.data.description || null,
      legal_notice: parsed.data.legal_notice || null,
      header_html: parsed.data.header_html || null,
      footer_html: parsed.data.footer_html || null,
    })
    .select('id')
    .single()

  if (error) return { error: 'Errore nel salvataggio del template.' }

  revalidatePath('/(app)/template', 'page')
  redirect(`/template/${tmpl.id}`)
}

// ── UPDATE ─────────────────────────────────────────────────────
export async function updateTemplateAction(
  templateId: string,
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const workspace = await getWorkspaceWithPlan()
  if (!workspace) return { error: 'Non autenticato.' }

  const raw = {
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || '',
    color_primary: (formData.get('color_primary') as string) || '#1a1a2e',
    font_family: (formData.get('font_family') as string) || 'Inter',
    show_logo: formData.get('show_logo') === 'true',
    show_watermark: formData.get('show_watermark') === 'true',
    legal_notice: (formData.get('legal_notice') as string) || '',
    header_html: (formData.get('header_html') as string) || '',
    footer_html: (formData.get('footer_html') as string) || '',
    is_default: formData.get('is_default') === 'true',
  }

  const parsed = TemplateSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  if (parsed.data.is_default) {
    await supabase
      .from('templates')
      .update({ is_default: false })
      .eq('workspace_id', workspace.id)
      .neq('id', templateId)
  }

  const { error } = await supabase
    .from('templates')
    .update({
      ...parsed.data,
      description: parsed.data.description || null,
      legal_notice: parsed.data.legal_notice || null,
      header_html: parsed.data.header_html || null,
      footer_html: parsed.data.footer_html || null,
    })
    .eq('id', templateId)
    .eq('workspace_id', workspace.id)

  if (error) return { error: 'Errore nel salvataggio.' }

  revalidatePath(`/template/${templateId}`)
  revalidatePath('/(app)/template', 'page')
  return { success: 'Template salvato.' }
}

// ── DELETE ─────────────────────────────────────────────────────
export async function deleteTemplateAction(templateId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const workspace = await getWorkspaceWithPlan()
  if (!workspace) return { error: 'Non autenticato.' }

  const { error } = await supabase
    .from('templates')
    .delete()
    .eq('id', templateId)
    .eq('workspace_id', workspace.id)

  if (error) return { error: 'Errore nella rimozione del template.' }

  revalidatePath('/(app)/template', 'page')
  redirect('/template')
}

// ── SET DEFAULT ────────────────────────────────────────────────
export async function setDefaultTemplateAction(templateId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const workspace = await getWorkspaceWithPlan()
  if (!workspace) return { error: 'Non autenticato.' }

  await supabase
    .from('templates')
    .update({ is_default: false })
    .eq('workspace_id', workspace.id)

  const { error } = await supabase
    .from('templates')
    .update({ is_default: true })
    .eq('id', templateId)
    .eq('workspace_id', workspace.id)

  if (error) return { error: 'Errore.' }

  revalidatePath('/(app)/template', 'page')
  return { success: 'Template predefinito aggiornato.' }
}
