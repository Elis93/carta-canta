'use server'

import { revalidatePath } from 'next/cache'
import { sendSecurityAlert } from '@/lib/security/alert'
import { logSecurityEvent } from '@/lib/security/events'
import { clientIpFrom } from '@/lib/client-ip'
import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { z } from 'zod/v4'
import { slugify, parseImportoIt } from '@/lib/utils'
import { isMissingColumnError } from '@/lib/supabase/errors'

// ============================================================
// SCHEMA VALIDAZIONE
// ============================================================

const WorkspaceDataSchema = z.object({
  ragione_sociale: z.string().min(2, 'Inserisci la ragione sociale (min. 2 caratteri)'),
  piva: z
    .string()
    .regex(/^(\d{11}|[A-Z0-9]{16})$/i, 'P.IVA (11 cifre) o Codice Fiscale (16 caratteri)')
    .optional()
    .or(z.literal('')),
  // 'minimi' NON è più offerto dalla UI (decisione Eli 10 ago, N6) ma resta
  // accettato qui: un workspace che l'avesse già salvato deve poter salvare
  // il resto delle impostazioni senza che la validazione lo butti fuori.
  fiscal_regime: z.enum(['forfettario', 'ordinario', 'minimi']),
  ateco_codes: z.array(z.string()).default([]),
  phone: z.string().max(30, 'Numero di telefono troppo lungo').optional().or(z.literal('')),
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
  validity_days: z.coerce
    .number()
    .int('Il valore deve essere un numero intero')
    .min(1, 'La validità deve essere almeno 1 giorno')
    .max(365, 'La validità non può superare 365 giorni')
    .default(30),
  // Giorni di preavviso della card "In scadenza" in Home (073)
  scadenza_alert_days: z.coerce
    .number()
    .int('Il valore deve essere un numero intero')
    .min(1, 'Il preavviso deve essere almeno di 1 giorno')
    .max(90, 'Il preavviso non può superare 90 giorni')
    .default(10),
  // Acconto proposto sui NUOVI preventivi (077)
  deposit_default_type: z.enum(['percent', 'fixed']).nullable().default(null),
  deposit_default_value: z.coerce.number().positive().nullable().default(null),
})
  // ⚠️ I due campi vivono insieme: un tipo senza valore darebbe un acconto a
  // zero, un valore senza tipo un acconto che non esiste. Stessa regola del
  // vincolo in migration 077 — qui però l'errore si può SPIEGARE.
  .refine((d) => !(d.deposit_default_type && d.deposit_default_value == null), {
    message: 'Scrivi anche quanto vuoi di acconto (per esempio 30).',
    path: ['deposit_default_value'],
  })
  .refine((d) => !(d.deposit_default_type === 'percent' && (d.deposit_default_value ?? 0) > 100), {
    message: 'La percentuale dell’acconto non può superare 100.',
    path: ['deposit_default_value'],
  })

const WorkspaceFiscalSchema = z.object({
  fiscal_regime: z.enum(['forfettario', 'ordinario', 'minimi']),
  piva: z.string().max(16).optional(),
  ateco_codes: z.array(z.string()).default([]),
  invoice_prefix: z.string().max(10, 'Prefisso troppo lungo').optional().or(z.literal('')),
  // Costo orario manodopera (052) — stringa it-IT dal form, parse a parte
  hourly_cost: z.string().max(12).optional(),
  bollo_auto: z.boolean().optional(),
  ritenuta_auto: z.boolean().optional(),
  default_currency: z.enum(['EUR', 'GBP', 'CHF', 'PLN', 'USD']).optional(),
})

type ActionResult = { error?: string; success?: string; logoUrl?: string } | null

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
    ateco_codes: formData.getAll('ateco_codes[]').map(String).filter(Boolean),
    phone: (formData.get('phone') as string) || '',
    indirizzo: (formData.get('indirizzo') as string) || '',
    cap: (formData.get('cap') as string) || '',
    citta: (formData.get('citta') as string) || '',
    provincia: (formData.get('provincia') as string) || '',
    validity_days: (formData.get('validity_days') as string) || '30',
    scadenza_alert_days: (formData.get('scadenza_alert_days') as string) || '10',
    // Stringa vuota = "Nessuno": va a null, non a 0.
    deposit_default_type: (formData.get('deposit_default_type') as string) || null,
    deposit_default_value: (formData.get('deposit_default_value') as string) || null,
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

  // ATECO: aggiornati SOLO se il form li contiene. Il tab "Generale" non ha
  // il campo → prima azzerava sempre i codici impostati nel tab Fiscale.
  const hasAtecoFields = formData.getAll('ateco_codes[]').length > 0
  // ⚠️ Stessa cautela degli ATECO: il preavviso scadenze si scrive SOLO se il
  // form lo contiene davvero. L'onboarding usa questa stessa action senza quel
  // campo: senza la guardia, ogni salvataggio da lì riporterebbe il valore al
  // default cancellando in silenzio la scelta dell'artigiano.
  const hasScadenzaField = formData.get('scadenza_alert_days') !== null
  // ⚠️ Stessa cautela di ATECO e preavviso: l'ONBOARDING usa questa action
  // senza questi campi. Senza la guardia, ogni salvataggio da lì azzererebbe
  // in silenzio l'acconto di default scelto dall'artigiano.
  const hasAccontoFields = formData.get('deposit_default_type') !== null

  // Un tipo vuoto significa "Nessuno": si azzerano ENTRAMBE le colonne,
  // altrimenti resterebbe un valore orfano che il vincolo 077 rifiuta.
  // Tipo esplicito: senza, il ternario produce un'UNIONE di due forme e lo
  // spread condizionale più sotto perde le due chiavi.
  const accontoPayload: { deposit_default_type: string | null; deposit_default_value: number | null } =
    parsed.data.deposit_default_type
      ? { deposit_default_type: parsed.data.deposit_default_type, deposit_default_value: parsed.data.deposit_default_value }
      : { deposit_default_type: null, deposit_default_value: null }

  const payload = {
    ragione_sociale: parsed.data.ragione_sociale,
    fiscal_regime: parsed.data.fiscal_regime,
    piva: parsed.data.piva || null,
    ...(hasAtecoFields && { ateco_codes: parsed.data.ateco_codes }),
    phone: parsed.data.phone || null,
    indirizzo: parsed.data.indirizzo || null,
    cap: parsed.data.cap || null,
    citta: parsed.data.citta || null,
    provincia: parsed.data.provincia || null,
    validity_days: parsed.data.validity_days,
    ...(hasScadenzaField && { scadenza_alert_days: parsed.data.scadenza_alert_days }),
    ...(hasAccontoFields && accontoPayload),
  }

  let { error } = await supabase.from('workspaces').update(payload).eq('id', workspace.id)

  // Tollerante pre-073: se la colonna non esiste ancora, il resto dei dati si
  // salva lo stesso — perdere l'indirizzo perché manca una migration sarebbe
  // peggio del non poter cambiare il preavviso.
  if (error && hasScadenzaField && isMissingColumnError(error)) {
    const { scadenza_alert_days: _omit, ...senzaPreavviso } = payload
    void _omit
    ;({ error } = await supabase.from('workspaces').update(senzaPreavviso).eq('id', workspace.id))
  }

  // Tollerante pre-077, stessa ragione: senza le colonne dell'acconto non si
  // deve perdere l'indirizzo appena scritto.
  if (error && hasAccontoFields && isMissingColumnError(error)) {
    const { deposit_default_type: _t, deposit_default_value: _v, ...senzaAcconto } = payload
    void _t; void _v
    ;({ error } = await supabase.from('workspaces').update(senzaAcconto).eq('id', workspace.id))
  }

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

  // Validazione tipo MIME. SVG ESCLUSO di proposito (audit sicurezza 20 lug):
  // un SVG può contenere <script> e, aperto dall'URL grezzo dello storage,
  // eseguirebbe JS sul dominio Supabase (vettore stored-XSS/phishing). Accettiamo
  // solo formati raster, che non eseguono codice.
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedTypes.includes(file.type)) {
    return {
      error: `Formato non supportato: "${file.type || '(tipo vuoto)'}". Usa JPG, PNG o WebP.`,
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
  return { success: 'Logo caricato con successo.', logoUrl }
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
    piva: (formData.get('piva') as string | null) ?? undefined,
    ateco_codes: formData.getAll('ateco_codes[]').map(String).filter(Boolean),
    invoice_prefix: (formData.get('invoice_prefix') as string) || '',
    hourly_cost: (formData.get('hourly_cost') as string | null) ?? undefined,
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
      fiscal_regime:    parsed.data.fiscal_regime,
      ...(parsed.data.piva !== undefined && { piva: parsed.data.piva || null }),
      ateco_codes:      parsed.data.ateco_codes,
      invoice_prefix:   parsed.data.invoice_prefix || '',
      bollo_auto:       parsed.data.bollo_auto ?? true,
      ritenuta_auto:    parsed.data.ritenuta_auto ?? false,
      default_currency: parsed.data.default_currency ?? 'EUR',
    })
    .eq('id', workspace.id)

  if (error) return { error: 'Errore nel salvataggio.' }

  // Costo orario manodopera (colonna 052) — update separato e tollerante:
  // se la migration non è applicata, il resto del tab si salva comunque.
  if (parsed.data.hourly_cost !== undefined) {
    const rawCost = parsed.data.hourly_cost.trim()
    let hourlyCost: number | null = null
    if (rawCost !== '') {
      const n = parseImportoIt(rawCost)
      if (!Number.isFinite(n) || n < 0 || n > 999) {
        return { error: 'Costo orario non valido (es. 35 o 42,50).' }
      }
      hourlyCost = n
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonna 052 non ancora in types/database.ts
    const { error: costErr } = await (supabase as any)
      .from('workspaces')
      .update({ hourly_cost: hourlyCost })
      .eq('id', workspace.id)
    if (costErr && !isMissingColumnError(costErr)) {
      return { error: 'Impostazioni salvate, ma il costo orario no. Riprova.' }
    }
  }

  revalidatePath('/(app)', 'layout')
  return { success: 'Impostazioni fiscali salvate.' }
}

// ============================================================
// SALVA PREFERENZE NOTIFICHE
// ============================================================
const NotificationPrefsSchema = z.object({
  preventivo_accettato: z.boolean(),
  preventivo_rifiutato: z.boolean(),
  preventivo_scaduto:   z.boolean(),
  reminder_cliente:     z.boolean(),
  // Follow-up automatico al cliente dopo N giorni senza risposta — default OFF (opt-in)
  followup_auto:        z.boolean().default(false),
  // Notifiche in app (campanella) — default true
  inapp_visto:   z.boolean().default(true),
  inapp_acconto: z.boolean().default(true),
  inapp_richiamo: z.boolean().default(true),
  // Richieste nuove dalla vetrina dei professionisti (29 lug)
  inapp_richiesta: z.boolean().default(true),
  // Preventivo fermo da giorni senza risposta → promemoria sollecito (3 ago)
  inapp_preventivo_fermo: z.boolean().default(true),
  // Messaggio del cliente dalla pagina pubblica del documento (4 ago)
  inapp_messaggio: z.boolean().default(true),
  // SdI (attive solo con NEXT_PUBLIC_SDI_ENABLED)
  inapp_sdi_scarto:       z.boolean().default(true),
  inapp_sdi_trasmissione: z.boolean().default(true),
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
// ENSURE WORKSPACE — per nuovi utenti OAuth
// Controlla se esiste un workspace per l'utente; se no, ne crea uno
// derivando il nome da fullName o email.
// Restituisce 'existing' | 'created' | 'error'.
// Usa l'admin client per bypassare RLS (identico a signupAction).
// ============================================================
export async function ensureWorkspace(
  userId: string,
  { email, fullName }: { email?: string; fullName?: string }
): Promise<'existing' | 'created' | 'error'> {
  try {
    const adminClient = createAdminClient()

    // 1. Workspace già esistente?
    const { data: existing } = await adminClient
      .from('workspaces')
      .select('id')
      .eq('owner_id', userId)
      .maybeSingle()

    if (existing) return 'existing'

    // 2. Deriva nome e slug dal profilo OAuth
    const baseName =
      fullName?.trim() ||
      email?.split('@')[0]?.replace(/[._-]+/g, ' ') ||
      'La mia attività'

    const baseSlug = slugify(baseName)

    const { data: slugConflict } = await adminClient
      .from('workspaces')
      .select('id')
      .eq('slug', baseSlug)
      .maybeSingle()

    const slug = slugConflict
      ? `${baseSlug}-${Date.now().toString(36)}`
      : baseSlug

    const { error } = await adminClient.from('workspaces').insert({
      name: baseName,
      slug,
      owner_id: userId,
      plan: 'free',
      fiscal_regime: 'forfettario',
    })

    if (error) {
      console.error('[ensureWorkspace] insert error:', error)
      return 'error'
    }

    return 'created'
  } catch (err) {
    console.error('[ensureWorkspace] unexpected error:', err)
    return 'error'
  }
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

// ── markTourDoneAction ──────────────────────────────────────────────────────
// Tutorial primo accesso: segna il tour come completato/saltato per sempre.
// Tollerante alla colonna mancante (migration 037 non ancora applicata):
// in quel caso fallisce in silenzio e il tour resterà gestito da sessionStorage.

export async function markTourDoneAction(): Promise<void> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    let { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
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
      if (membership) workspace = { id: membership.workspace_id }
    }
    if (!workspace) return

    await supabase
      .from('workspaces')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonna 037 non ancora in types/database.ts
      .update({ onboarding_tour_done: true } as any)
      .eq('id', workspace.id)

    // Aggiorna la prop tourDone del layout alla prossima navigazione: senza,
    // resterebbe stantia per tutta la sessione SPA (il flag di sessione in
    // TourController copre la tab corrente, questo copre le altre).
    revalidatePath('/(app)', 'layout')
  } catch {
    // colonna mancante o errore di rete: non bloccare l'utente
  }
}

// ============================================================
// PAGAMENTI — "Come ti pagano i clienti" (Fase 1 bring-your-own)
// Colonne migration 038: payment_iban, payment_iban_holder,
// payment_paypal_url, payment_satispay_url, payment_notes
// ============================================================

export async function updateWorkspacePayments(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non autenticato.' }

  const { normalizeIban, isValidIban } = await import('@/lib/payments/iban')

  const ibanRaw = String(formData.get('payment_iban') ?? '').trim()
  const iban = ibanRaw ? normalizeIban(ibanRaw) : ''
  if (iban && !isValidIban(iban)) {
    return { error: 'L’IBAN inserito non è valido. Controlla le cifre e riprova.' }
  }

  const holder = String(formData.get('payment_iban_holder') ?? '').trim().slice(0, 70)
  if (iban && !holder) {
    return { error: 'Inserisci l’intestatario del conto (serve per il bonifico).' }
  }

  // PayPal.me / Satispay: accetta sia l'URL completo sia la forma breve
  // Restituisce: null = campo vuoto · 'invalid' = link non valido · string = URL pulito
  function cleanLink(raw: string, allowedHosts: string[]): string | null | 'invalid' {
    const v = raw.trim()
    if (!v) return null
    const withProto = /^https?:\/\//i.test(v) ? v : `https://${v}`
    try {
      const url = new URL(withProto)
      if (!allowedHosts.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`))) return 'invalid'
      return url.toString()
    } catch {
      return 'invalid'
    }
  }

  const paypal = cleanLink(String(formData.get('payment_paypal_url') ?? ''), ['paypal.me', 'paypal.com'])
  if (paypal === 'invalid') {
    return { error: 'Il link PayPal non sembra valido. Deve essere un link paypal.me (es. paypal.me/tuonome).' }
  }
  const satispay = cleanLink(String(formData.get('payment_satispay_url') ?? ''), ['satispay.com'])
  if (satispay === 'invalid') {
    return { error: 'Il link Satispay non sembra valido. Copialo dalla tua app Satispay Business.' }
  }

  const notes = String(formData.get('payment_notes') ?? '').trim().slice(0, 300)

  // Si leggono anche i valori PRECEDENTI: servono a capire se le coordinate
  // sono davvero cambiate (avviso di sicurezza qui sotto). Tollerante
  // pre-038: senza quelle colonne la select fallisce e si riprova col solo id.
  let workspace: {
    id: string
    payment_iban?: string | null
    payment_iban_holder?: string | null
    payment_paypal_url?: string | null
    payment_satispay_url?: string | null
    payment_notes?: string | null
  } | null = null
  {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
    const db = supabase as any
    const { data, error: readErr } = await db
      .from('workspaces')
      .select('id, payment_iban, payment_iban_holder, payment_paypal_url, payment_satispay_url, payment_notes')
      .eq('owner_id', user.id)
      .maybeSingle()
    if (!readErr && data) {
      workspace = data
    } else if (readErr && !isMissingColumnError(readErr)) {
      // ⚠️ Ripiegare su un errore QUALSIASI (un blip di rete) farebbe
      // credere che i valori precedenti fossero vuoti → l'avviso di
      // sicurezza potrebbe non partire proprio quando serve. Meglio
      // fermarsi: il titolare riprova e non perde nulla.
      return { error: 'Non riesco a leggere le impostazioni di pagamento: riprova tra qualche secondo.' }
    } else {
      const { data: base } = await db
        .from('workspaces')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()
      workspace = base
    }
  }
  if (!workspace) return { error: 'Workspace non trovato.' }

  // ⚠️ ADMIN, non il client di sessione. Dalla migration 070 un trigger vieta
  // di toccare queste cinque colonne a chiunque non sia il service role: così
  // l'unica strada per cambiare l'IBAN è QUESTA, che verifica di essere il
  // titolare (owner_id, qui sopra), valida i dati e manda l'avviso email. Chi
  // rubasse una sessione non può più aggirare l'avviso scrivendo diritto sul
  // database. L'autorizzazione è già stata fatta: `workspace` viene da una
  // query filtrata per owner_id = utente della sessione.
  const { error } = await createAdminClient()
    .from('workspaces')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 038 non ancora in types/database.ts
    .update({
      payment_iban: iban || null,
      payment_iban_holder: holder || null,
      payment_paypal_url: paypal,
      payment_satispay_url: satispay,
      payment_notes: notes || null,
    } as any)
    .eq('id', workspace.id)

  if (error) {
    return { error: 'Salvataggio non riuscito. Se il problema persiste, la migration 038 potrebbe non essere ancora applicata.' }
  }

  // ⚠️ AVVISO DI SICUREZZA: le coordinate di pagamento sono il bersaglio
  // numero uno di chi entra in un gestionale di fatture (cambia l'IBAN e
  // aspetta il bonifico). Se cambiano, il titolare lo deve sapere SUBITO —
  // anche quando è stato lui a cambiarle. Non blocca il salvataggio.
  //
  // ⚠️ Il confronto copre TUTTO il riquadro "Come pagare", non solo l'IBAN.
  // L'intestatario e le note libere compaiono accanto all'IBAN sul documento:
  // chi entra nell'account può lasciare l'IBAN intatto e scrivere nelle note
  // "attenzione, nuovo conto: IT60X…" — il cliente legge quello e bonifica lì.
  // Un avviso che guarda solo l'IBAN non vedrebbe niente.
  const prevIban = workspace.payment_iban ?? null
  const ibanCambiato = (iban || null) !== prevIban
  const cambiato =
    ibanCambiato ||
    (holder || null) !== (workspace.payment_iban_holder ?? null) ||
    paypal !== (workspace.payment_paypal_url ?? null) ||
    satispay !== (workspace.payment_satispay_url ?? null) ||
    (notes || null) !== (workspace.payment_notes ?? null)
  if (cambiato) {
    const dettaglio = ibanCambiato
      ? (iban
          ? `L'IBAN su cui i tuoi clienti pagano è stato modificato: ora termina con ${iban.slice(-4)}.`
          : 'L\'IBAN su cui i tuoi clienti pagano è stato rimosso.')
      : 'Le informazioni di pagamento mostrate ai tuoi clienti (intestatario, link PayPal o Satispay, note) sono state modificate.'
    await sendSecurityAlert({
      to: user.email,
      title: 'Coordinate di pagamento modificate',
      what: `${dettaglio} Da adesso è questo il dato che compare sui documenti che invii.`,
      actionPath: '/impostazioni?tab=pagamenti',
      actionLabel: 'Controlla le coordinate',
    })
    // ⚠️ Nel registro va SOLO quale campo è cambiato, mai il valore: un IBAN
    // in chiaro nel registro di sicurezza sarebbe la stessa cosa che stiamo
    // proteggendo, copiata in un secondo posto.
    await logSecurityEvent({
      kind: 'payment_changed',
      userId: user.id,
      workspaceId: workspace.id,
      ip: clientIpFrom(await headers()),
      meta: { campo: ibanCambiato ? 'iban' : 'altro' },
    })
  }

  revalidatePath('/impostazioni')
  return { success: 'Impostazioni pagamenti salvate.' }
}
