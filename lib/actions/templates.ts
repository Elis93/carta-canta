'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { z } from 'zod/v4'

// ── SCHEMA ────────────────────────────────────────────────────
const TemplateSchema = z.object({
  name: z.string().min(1, 'Il nome deve avere almeno 1 carattere'),
  description: z.string().optional().or(z.literal('')),
  preset_key: z.enum(['classico', 'bold', 'tecnico', 'elegante']).default('classico'),
  color_primary: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Colore non valido (es. #1a1a2e)')
    .default('#1a1a2e'),
  font_family: z.enum(['Inter', 'GeistSans', 'Helvetica', 'Georgia']).default('Inter'),
  show_logo: z.boolean().default(true),
  show_watermark: z.boolean().default(true),
  logo_position: z.enum(['left', 'right']).default('left'),
  number_format: z.string().optional().or(z.literal('')),
  legal_notice: z.string().optional().or(z.literal('')),
  header_html: z.string().optional().or(z.literal('')),
  footer_html: z.string().optional().or(z.literal('')),
  is_default: z.boolean().default(false),
})

// Colore e font predefinito per ogni preset
const PRESET_DEFAULTS: Record<string, { color_primary: string; font_family: string }> = {
  classico: { color_primary: '#1a1a2e', font_family: 'Inter' },
  bold:     { color_primary: '#0f172a', font_family: 'Helvetica' },
  tecnico:  { color_primary: '#0369a1', font_family: 'GeistSans' },
  elegante: { color_primary: '#7c3aed', font_family: 'Georgia' },
}

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

  const isFree = workspace.plan === 'free'

  const raw = {
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || '',
    preset_key: (formData.get('preset_key') as string) || 'classico',
    color_primary: (formData.get('color_primary') as string) || '#1a1a2e',
    font_family: (formData.get('font_family') as string) || 'Inter',
    show_logo: formData.get('show_logo') === 'true',
    // Free: branding sempre visibile; Pro: controllato dall'utente
    show_watermark: isFree ? true : formData.get('show_watermark') === 'true',
    logo_position: isFree ? 'left' : ((formData.get('logo_position') as string) || 'left'),
    number_format: (formData.get('number_format') as string) || '',
    legal_notice: isFree ? '' : ((formData.get('legal_notice') as string) || ''),
    header_html: isFree ? '' : ((formData.get('header_html') as string) || ''),
    footer_html: isFree ? '' : ((formData.get('footer_html') as string) || ''),
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

  const { data: tmpl, error } = await supabase.from('templates')
    .insert({
      workspace_id: workspace.id,
      ...parsed.data,
      preset_key: parsed.data.preset_key,
      description: parsed.data.description || null,
      legal_notice: parsed.data.legal_notice || null,
      header_html: parsed.data.header_html || null,
      footer_html: parsed.data.footer_html || null,
      number_format: parsed.data.number_format || null,
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

  const isFreeUpdate = workspace.plan === 'free'

  const raw = {
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || '',
    preset_key: (formData.get('preset_key') as string) || 'classico',
    color_primary: (formData.get('color_primary') as string) || '#1a1a2e',
    font_family: (formData.get('font_family') as string) || 'Inter',
    show_logo: formData.get('show_logo') === 'true',
    show_watermark: isFreeUpdate ? true : formData.get('show_watermark') === 'true',
    logo_position: isFreeUpdate ? 'left' : ((formData.get('logo_position') as string) || 'left'),
    number_format: (formData.get('number_format') as string) || '',
    legal_notice: isFreeUpdate ? '' : ((formData.get('legal_notice') as string) || ''),
    header_html: isFreeUpdate ? '' : ((formData.get('header_html') as string) || ''),
    footer_html: isFreeUpdate ? '' : ((formData.get('footer_html') as string) || ''),
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

  const { error } = await supabase.from('templates')
    .update({
      ...parsed.data,
      preset_key: parsed.data.preset_key,
      description: parsed.data.description || null,
      legal_notice: parsed.data.legal_notice || null,
      header_html: parsed.data.header_html || null,
      footer_html: parsed.data.footer_html || null,
      number_format: parsed.data.number_format || null,
    })
    .eq('id', templateId)
    .eq('workspace_id', workspace.id)

  if (error) return { error: 'Errore nel salvataggio.' }

  revalidatePath(`/template/${templateId}`)
  revalidatePath('/(app)/template', 'page')
  redirect('/template')
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

// ── SELECT PRESET ──────────────────────────────────────────────
// Imposta il preset del template predefinito (o ne crea uno se non esiste).
// Non sovrascrive colore/font personalizzati se il template già esiste.
export async function selectPresetAction(presetKey: string): Promise<ActionResult> {
  const supabase = await createClient()
  const workspace = await getWorkspaceWithPlan()
  if (!workspace) return { error: 'Non autenticato.' }

  const validPresets = ['classico', 'bold', 'tecnico', 'elegante']
  if (!validPresets.includes(presetKey)) return { error: 'Preset non valido.' }

  const defaults = PRESET_DEFAULTS[presetKey] ?? PRESET_DEFAULTS.classico

  // Cerca il template predefinito
  const { data: existing } = await supabase
    .from('templates')
    .select('id')
    .eq('workspace_id', workspace.id)
    .eq('is_default', true)
    .maybeSingle()

  const tpl = supabase.from('templates')

  if (existing) {
    // Aggiorna solo preset_key — preserva le personalizzazioni Pro
    await tpl.update({ preset_key: presetKey }).eq('id', existing.id)
  } else {
    // Cerca qualsiasi template del workspace
    const { data: anyTemplate } = await supabase
      .from('templates')
      .select('id')
      .eq('workspace_id', workspace.id)
      .limit(1)
      .maybeSingle()

    if (anyTemplate) {
      // Promuove a default con il nuovo preset
      await tpl.update({ preset_key: presetKey, is_default: true }).eq('id', anyTemplate.id)
    } else {
      // Crea il primo template con i valori predefiniti del preset
      await tpl.insert({
        workspace_id: workspace.id,
        name: `Preset ${presetKey.charAt(0).toUpperCase() + presetKey.slice(1)}`,
        preset_key: presetKey,
        color_primary: defaults.color_primary,
        font_family: defaults.font_family,
        show_logo: true,
        show_watermark: true, // Free: branding sempre visibile
        logo_position: 'left',
        is_default: true,
      })
    }
  }

  revalidatePath('/(app)/template', 'page')
  return { success: `Preset aggiornato.` }
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
