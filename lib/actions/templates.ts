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
    .default('#374151'),
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
  classico: { color_primary: '#374151', font_family: 'Inter' },
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
  // Per Free: il font è sempre quello canonico del preset scelto (non personalizzabile)
  const submittedPresetKey = (formData.get('preset_key') as string) || 'classico'
  const presetDefaultFont = PRESET_DEFAULTS[submittedPresetKey]?.font_family ?? 'Inter'

  const raw = {
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || '',
    preset_key: submittedPresetKey,
    // Free: colore accento è Pro — forzato al default del preset (mockup: "Colore = Pro")
    color_primary: isFree
      ? (PRESET_DEFAULTS[submittedPresetKey]?.color_primary ?? '#374151')
      : ((formData.get('color_primary') as string) || '#374151'),
    // Free: font forzato al default del preset; Pro: libero
    font_family: isFree ? presetDefaultFont : ((formData.get('font_family') as string) || 'Inter'),
    show_logo: formData.get('show_logo') === 'true',
    // Free: branding sempre visibile; Pro: controllato dall'utente
    show_watermark: isFree ? true : formData.get('show_watermark') === 'true',
    logo_position: isFree ? 'left' : ((formData.get('logo_position') as string) || 'left'),
    number_format: (formData.get('number_format') as string) || '',
    // Nota legale in calce: disponibile anche al Free (mockup Free vs Pro)
    legal_notice: (formData.get('legal_notice') as string) || '',
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

  revalidatePath('/template')
  redirect(`/template/${tmpl.id}`)
}

// ── CREATE BLANK (template personalizzato auto-nominato, solo Pro) ──────
// Crea "Template personalizzato N" con i default Classico e apre subito l'editor.
// Il nome è modificabile dall'utente nell'editor (decisione: nomi automatici ma rinominabili).
export async function createBlankCustomTemplateAction(): Promise<void> {
  const supabase = await createClient()
  const workspace = await getWorkspaceWithPlan()
  if (!workspace) redirect('/login')
  // I template multipli sono una funzione Pro (il Free ha solo il Default)
  if (workspace.plan === 'free') redirect('/template')

  // Conta i personalizzati esistenti (escluso il "Template predefinito" di sistema)
  const { data: existing } = await supabase
    .from('templates')
    .select('name')
    .eq('workspace_id', workspace.id)

  const customCount = (existing ?? []).filter((t) => t.name !== 'Template predefinito').length
  const name = `Template personalizzato ${customCount + 1}`

  const { data: tmpl, error } = await supabase
    .from('templates')
    .insert({
      workspace_id: workspace.id,
      name,
      preset_key: 'classico',
      color_primary: '#374151',
      font_family: 'Inter',
      show_logo: true,
      show_watermark: false,
      logo_position: 'left',
      legal_notice: null,
      is_default: false,
    })
    .select('id')
    .single()

  if (error || !tmpl) redirect('/template')
  revalidatePath('/template')
  redirect(`/template/${tmpl.id}`)
}

// ── EDIT DEFAULT (apre l'editor completo sul template "Default") ────────
// Trova (o crea) la riga "Template predefinito" e apre il suo editor `/template/[id]`,
// così anche il Free può personalizzare il Default (colore + logo; preset resta Classico).
export async function editDefaultTemplateAction(): Promise<void> {
  const supabase = await createClient()
  const workspace = await getWorkspaceWithPlan()
  if (!workspace) redirect('/login')

  let { data: row } = await supabase
    .from('templates')
    .select('id')
    .eq('workspace_id', workspace.id)
    .eq('name', 'Template predefinito')
    .maybeSingle()

  if (!row) {
    // C'è già un template attivo (custom)? Se sì, il Default nasce NON attivo.
    const { data: hasDefault } = await supabase
      .from('templates')
      .select('id')
      .eq('workspace_id', workspace.id)
      .eq('is_default', true)
      .maybeSingle()

    const { data: created } = await supabase
      .from('templates')
      .insert({
        workspace_id: workspace.id,
        name: 'Template predefinito',
        preset_key: 'classico',
        color_primary: '#374151',
        font_family: 'Inter',
        show_logo: true,
        show_watermark: true,
        logo_position: 'left',
        legal_notice: null,
        is_default: !hasDefault,
      })
      .select('id')
      .single()
    row = created ?? null
  }

  if (!row) redirect('/template')
  revalidatePath('/template')
  redirect(`/template/${row.id}`)
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
  // Per Free: il font è sempre quello canonico del preset scelto (non personalizzabile)
  const submittedPresetKeyUpdate = (formData.get('preset_key') as string) || 'classico'
  const presetDefaultFontUpdate = PRESET_DEFAULTS[submittedPresetKeyUpdate]?.font_family ?? 'Inter'

  const raw = {
    name: formData.get('name') as string,
    description: (formData.get('description') as string) || '',
    preset_key: submittedPresetKeyUpdate,
    // Free: colore accento è Pro — forzato al default del preset (mockup: "Colore = Pro")
    color_primary: isFreeUpdate
      ? (PRESET_DEFAULTS[submittedPresetKeyUpdate]?.color_primary ?? '#374151')
      : ((formData.get('color_primary') as string) || '#374151'),
    // Free: font forzato al default del preset; Pro: libero
    font_family: isFreeUpdate ? presetDefaultFontUpdate : ((formData.get('font_family') as string) || 'Inter'),
    show_logo: formData.get('show_logo') === 'true',
    show_watermark: isFreeUpdate ? true : formData.get('show_watermark') === 'true',
    logo_position: isFreeUpdate ? 'left' : ((formData.get('logo_position') as string) || 'left'),
    number_format: (formData.get('number_format') as string) || '',
    // Nota legale in calce: disponibile anche al Free (mockup Free vs Pro)
    legal_notice: (formData.get('legal_notice') as string) || '',
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
  revalidatePath('/template')
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

  revalidatePath('/template')
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

  revalidatePath('/template')
  return { success: `Preset aggiornato.` }
}

// ── CLEAR DEFAULT (torna al template di sistema Classico) ──────
export async function clearDefaultTemplateAction(): Promise<ActionResult> {
  const supabase = await createClient()
  const workspace = await getWorkspaceWithPlan()
  if (!workspace) return { error: 'Non autenticato.' }

  await supabase
    .from('templates')
    .update({ is_default: false })
    .eq('workspace_id', workspace.id)

  revalidatePath('/template')
  return { success: 'Template di default ripristinato.' }
}

// ── SAVE DEFAULT SETTINGS (branding + nota legale per template default) ───
// Usato dalla pagina /template/default — mini-editor per chi usa il Default Classico.
// Se esiste già un template is_default=true → aggiorna show_watermark e legal_notice.
// Se non esiste → crea un template Classico con is_default=true.
export async function saveDefaultSettingsAction(formData: FormData): Promise<void> {
  const supabase = await createClient()
  const workspace = await getWorkspaceWithPlan()
  if (!workspace) redirect('/login')
  if (workspace.plan === 'free') redirect('/template')

  const show_watermark = formData.get('show_watermark') === 'true'
  const show_logo      = formData.get('show_logo') !== 'false'  // default true
  const legal_notice   = (formData.get('legal_notice') as string | null) ?? ''

  // Cerca prima il template is_default=true; se non c'è, cerca per nome convenzionale
  let { data: existing } = await supabase
    .from('templates')
    .select('id')
    .eq('workspace_id', workspace.id)
    .eq('is_default', true)
    .maybeSingle()

  if (!existing) {
    const { data: byName } = await supabase
      .from('templates')
      .select('id')
      .eq('workspace_id', workspace.id)
      .eq('name', 'Template predefinito')
      .maybeSingle()
    existing = byName
  }

  if (existing) {
    await supabase
      .from('templates')
      .update({ show_watermark, show_logo, legal_notice: legal_notice || null, is_default: true })
      .eq('id', existing.id)
  } else {
    await supabase
      .from('templates')
      .insert({
        workspace_id: workspace.id,
        name: 'Template predefinito',
        preset_key: 'classico',
        color_primary: '#374151',
        font_family: 'Inter',
        show_logo,
        show_watermark,
        logo_position: 'left',
        legal_notice: legal_notice || null,
        is_default: true,
      })
  }

  revalidatePath('/template')
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

  if (error) return { error: 'Impossibile impostare il template predefinito. Riprova.' }

  revalidatePath('/template')
  return { success: 'Template predefinito aggiornato.' }
}
