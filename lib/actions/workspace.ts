'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod/v4'

// ============================================================
// SCHEMA VALIDAZIONE
// ============================================================

const WorkspaceDataSchema = z.object({
  ragione_sociale: z.string().min(2, 'Inserisci la ragione sociale (min. 2 caratteri)'),
  piva: z
    .string()
    .regex(/^\d{11}$/, 'La P.IVA deve essere di 11 cifre')
    .optional()
    .or(z.literal('')),
  fiscal_regime: z.enum(['forfettario', 'ordinario', 'minimi']),
  ateco_code: z.string().optional().or(z.literal('')),
  indirizzo: z.string().optional().or(z.literal('')),
  cap: z
    .string()
    .regex(/^\d{5}$/, 'Il CAP deve essere di 5 cifre')
    .optional()
    .or(z.literal('')),
  citta: z.string().optional().or(z.literal('')),
  provincia: z
    .string()
    .length(2, 'La provincia deve essere di 2 lettere')
    .toUpperCase()
    .optional()
    .or(z.literal('')),
})

const WorkspaceFiscalSchema = z.object({
  fiscal_regime: z.enum(['forfettario', 'ordinario', 'minimi']),
  ateco_code: z.string().optional().or(z.literal('')),
  piva: z
    .string()
    .regex(/^\d{11}$/, 'La P.IVA deve essere di 11 cifre')
    .optional()
    .or(z.literal('')),
  invoice_prefix: z.string().max(10, 'Prefisso troppo lungo').optional().or(z.literal('')),
  bollo_auto: z.boolean().optional(),
  ritenuta_auto: z.boolean().optional(),
  default_currency: z.enum(['EUR', 'GBP', 'CHF', 'PLN', 'USD']).optional(),
})

type ActionResult = { error?: string; success?: string } | null

// ============================================================
// GET WORKSPACE CORRENTE
// ============================================================
export async function getWorkspace() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data } = await supabase
    .from('workspaces')
    .select('*')
    .eq('owner_id', user.id)
    .maybeSingle()

  return data
}

// ============================================================
// AGGIORNA DATI GENERALI WORKSPACE (Step 1 onboarding)
// ============================================================
export async function updateWorkspaceData(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const raw = {
    ragione_sociale: formData.get('ragione_sociale') as string,
    piva: (formData.get('piva') as string) || '',
    fiscal_regime: formData.get('fiscal_regime') as string,
    ateco_code: (formData.get('ateco_code') as string) || '',
    indirizzo: (formData.get('indirizzo') as string) || '',
    cap: (formData.get('cap') as string) || '',
    citta: (formData.get('citta') as string) || '',
    provincia: (formData.get('provincia') as string) || '',
  }

  const parsed = WorkspaceDataSchema.safeParse(raw)
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Dati non validi.'
    return { error: firstError }
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) return { error: 'Workspace non trovato.' }

  const { error } = await supabase
    .from('workspaces')
    .update({
      ragione_sociale: parsed.data.ragione_sociale,
      fiscal_regime: parsed.data.fiscal_regime,
      piva: parsed.data.piva || null,
      ateco_code: parsed.data.ateco_code || null,
      indirizzo: parsed.data.indirizzo || null,
      cap: parsed.data.cap || null,
      citta: parsed.data.citta || null,
      provincia: parsed.data.provincia || null,
    })
    .eq('id', workspace.id)

  if (error) return { error: 'Errore nel salvataggio. Riprova.' }

  revalidatePath('/(app)', 'layout')
  return { success: 'Dati salvati.' }
}

// ============================================================
// UPLOAD LOGO
// ============================================================
export async function uploadLogo(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const file = formData.get('logo') as File | null

  if (!file || file.size === 0) return { error: 'Nessun file selezionato.' }

  // Validazione tipo MIME
  // NOTA: in alcuni browser file.type può essere vuoto per file SVG rinominati.
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
  if (!allowedTypes.includes(file.type)) {
    return {
      error: `Formato non supportato: "${file.type || '(tipo vuoto)'}". Usa JPG, PNG, WebP o SVG.`,
    }
  }

  // Validazione dimensione
  if (file.size > 2 * 1024 * 1024) {
    return { error: `Il file è troppo grande (${(file.size / 1024 / 1024).toFixed(1)} MB, max 2 MB).` }
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) return { error: 'Workspace non trovato.' }

  // Normalizza l'estensione (lowercase, sicura)
  const rawExt = file.name.split('.').pop()?.toLowerCase() ?? 'png'
  const ext = allowedTypes.includes(file.type) ? rawExt : 'png'
  const storagePath = `${workspace.id}/logo.${ext}`

  // Dopo il guard `if (!file || file.size === 0)` qui sopra, TypeScript ha già
  // ristretto `file` a `File` — il ternario instanceof era codice morto e
  // causava l'errore "Property 'arrayBuffer' does not exist on type 'never'".
  // Passiamo il File direttamente: il SDK Supabase lo accetta nativamente.
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('logos')
    .upload(storagePath, file, {
      contentType: file.type,
      upsert: true,          // sovrascrive se esiste già (utile in re-upload)
    })

  // ── LOG COMPLETO dell'errore Supabase ──────────────────────────────────────
  if (uploadError) {
    // StorageError espone statusCode e error (stringa breve)
    const se = uploadError as unknown as {
      message: string
      name: string
      statusCode?: string | number
      error?: string
    }
    console.error('[uploadLogo] Supabase Storage error:', {
      message:    se.message,
      name:       se.name,
      statusCode: se.statusCode,
      error:      se.error,
      // dump completo per non perdere nulla
      raw: JSON.stringify(uploadError),
    })

    // Messaggi specifici per codice HTTP
    const status = Number(se.statusCode ?? 0)
    if (status === 404) {
      return {
        error:
          'Bucket "logos" non trovato su Supabase Storage. ' +
          'Crealo dal dashboard → Storage → New bucket (nome esatto: logos).',
      }
    }
    if (status === 403 || status === 401) {
      return {
        error:
          'Upload bloccato (403 Forbidden). ' +
          'Controlla le Storage Policy del bucket "logos": ' +
          'ci deve essere una policy INSERT (e UPDATE per upsert) per authenticated users.',
      }
    }
    if (status === 409) {
      return {
        error:
          'Conflitto file (409). Il file esiste ma la policy UPDATE non è abilitata. ' +
          'Aggiungi una policy UPDATE per authenticated users sul bucket "logos".',
      }
    }

    // Fallback: mostra il messaggio reale di Supabase
    return {
      error: `Errore upload: ${se.message}${se.error ? ` (${se.error})` : ''}`,
    }
  }

  // Costruisci URL pubblico con cache-buster
  const { data: urlData } = supabase.storage.from('logos').getPublicUrl(storagePath)
  const logoUrl = `${urlData.publicUrl}?v=${Date.now()}`

  const { error: updateError } = await supabase
    .from('workspaces')
    .update({ logo_url: logoUrl })
    .eq('id', workspace.id)

  if (updateError) {
    console.error('[uploadLogo] DB update error:', updateError)
    return { error: 'Logo caricato su Storage ma errore nel salvataggio URL. Riprova.' }
  }

  revalidatePath('/(app)', 'layout')
  return { success: 'Logo caricato con successo.' }
}

// ============================================================
// RIMUOVI LOGO
// ============================================================
export async function removeLogo(): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) return { error: 'Workspace non trovato.' }

  const { error } = await supabase
    .from('workspaces')
    .update({ logo_url: null })
    .eq('id', workspace.id)

  if (error) return { error: 'Errore nella rimozione del logo.' }

  revalidatePath('/(app)', 'layout')
  return { success: 'Logo rimosso.' }
}

// ============================================================
// AGGIORNA IMPOSTAZIONI FISCALI
// ============================================================
export async function updateWorkspaceFiscal(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const raw = {
    fiscal_regime: formData.get('fiscal_regime') as string,
    ateco_code: (formData.get('ateco_code') as string) || '',
    piva: (formData.get('piva') as string) || '',
    invoice_prefix: (formData.get('invoice_prefix') as string) || '',
    bollo_auto: formData.get('bollo_auto') === 'on',
    ritenuta_auto: formData.get('ritenuta_auto') === 'on',
    default_currency: (formData.get('default_currency') as string) || 'EUR',
  }

  const parsed = WorkspaceFiscalSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? 'Dati non validi.' }
  }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) return { error: 'Workspace non trovato.' }

  const { error } = await supabase
    .from('workspaces')
    .update({
      fiscal_regime: parsed.data.fiscal_regime,
      ateco_code: parsed.data.ateco_code || null,
      piva: parsed.data.piva || null,
      invoice_prefix: parsed.data.invoice_prefix || '',
      bollo_auto: parsed.data.bollo_auto ?? true,
      ritenuta_auto: parsed.data.ritenuta_auto ?? false,
      default_currency: parsed.data.default_currency ?? 'EUR',
    })
    .eq('id', workspace.id)

  if (error) return { error: 'Errore nel salvataggio.' }

  revalidatePath('/(app)', 'layout')
  return { success: 'Impostazioni fiscali salvate.' }
}

// ============================================================
// SALVA PREFERENZE NOTIFICHE
// ============================================================
const NotificationPrefsSchema = z.object({
  preventivo_accettato: z.boolean(),
  preventivo_rifiutato: z.boolean(),
  preventivo_scaduto: z.boolean(),
  reminder_cliente: z.boolean(),
  pagamento_ok: z.boolean(),
  pagamento_fallito: z.boolean(),
})

export type NotificationPrefs = z.infer<typeof NotificationPrefsSchema>

export async function updateNotificationPrefs(
  prefs: NotificationPrefs
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const parsed = NotificationPrefsSchema.safeParse(prefs)
  if (!parsed.success) return { error: 'Dati non validi.' }

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) return { error: 'Workspace non trovato.' }

  const { error } = await supabase
    .from('workspaces')
    .update({ notification_prefs: parsed.data })
    .eq('id', workspace.id)

  if (error) return { error: 'Errore nel salvataggio.' }

  revalidatePath('/impostazioni')
  return { success: 'Preferenze notifiche salvate.' }
}

// ============================================================
// INVITA MEMBRO (solo piano Team)
// ============================================================
export async function inviteMember(
  workspaceId: string,
  email: string,
  role: 'admin' | 'operator' | 'viewer'
): Promise<ActionResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  // Verifica piano
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('plan')
    .eq('id', workspaceId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!workspace) return { error: 'Workspace non trovato.' }
  if (workspace.plan !== 'team') {
    return { error: 'La funzione team è disponibile solo nel piano Team.' }
  }

  const adminClient = createAdminClient()

  // Cerca utente per email
  const { data: invitedUser } = await adminClient.auth.admin.listUsers()
  const targetUser = invitedUser.users.find((u) => u.email === email)
  if (!targetUser) {
    return { error: 'Utente non trovato. Assicurati che si sia registrato su Carta Canta.' }
  }

  const { error } = await supabase.from('workspace_members').insert({
    workspace_id: workspaceId,
    user_id: targetUser.id,
    role,
    invited_by: user.id,
  })

  if (error) {
    if (error.code === '23505') return { error: 'Questo utente è già membro del workspace.' }
    return { error: 'Errore nell\'invio dell\'invito.' }
  }

  revalidatePath('/(app)/impostazioni')
  return { success: `Invito inviato a ${email}.` }
}
