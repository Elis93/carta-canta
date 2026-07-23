'use server'

// ============================================================
// Server Actions — Marketplace (migration 043, mockup crescita §3)
// Profilo pubblico OPT-IN con verifica automatica pre-pubblicazione:
// P.IVA su VIES + email confermata + profilo completo.
// ============================================================

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkViesVat } from '@/lib/marketplace/vies'
import { geocodeCity } from '@/lib/geocode'
import { isMissingColumnError } from '@/lib/supabase/errors'

type Check = { ok: boolean; label: string; detail: string }
export type PublishResult = {
  error?: string
  published?: boolean
  checks?: Check[]
} | null

async function getContext() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: workspace } = await supabase
    .from('workspaces')
    .select('id, piva, plan')
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!workspace) return null
  return { supabase, user, workspace }
}

function cleanProfile(formData: FormData) {
  return {
    public_name: String(formData.get('public_name') ?? '').trim().slice(0, 80),
    trade: String(formData.get('trade') ?? '').trim().slice(0, 80),
    city: String(formData.get('city') ?? '').trim().slice(0, 80),
    radius_km: Math.min(200, Math.max(1, Number(formData.get('radius_km') ?? 30) || 30)),
    phone: String(formData.get('phone') ?? '').trim().slice(0, 30) || null,
    bio: String(formData.get('bio') ?? '').trim().slice(0, 400) || null,
  }
}

export async function saveMarketplaceProfileAction(formData: FormData): Promise<PublishResult> {
  const ctx = await getContext()
  if (!ctx) return { error: 'Sessione scaduta. Ricarica la pagina.' }

  const profile = cleanProfile(formData)

  // Geocodifica del comune → coordinate per la ricerca "Vicino a me" (055).
  // Best-effort: se fallisce, si salva comunque senza coordinate.
  const coords = profile.city ? await geocodeCity(profile.city) : null

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 043/055 non ancora in types/database.ts
  const db = ctx.supabase as any
  const doUpsert = (payload: Record<string, unknown>) =>
    db.from('marketplace_profiles').upsert(payload, { onConflict: 'workspace_id' })

  const base = { workspace_id: ctx.workspace.id, ...profile, updated_at: new Date().toISOString() }
  let { error } = await doUpsert({ ...base, lat: coords?.lat ?? null, lng: coords?.lng ?? null })
  // Migration 055 non ancora applicata → riprova senza le colonne coordinate.
  if (error && isMissingColumnError(error)) {
    ;({ error } = await doUpsert(base))
  }

  if (error) {
    // Log dell'errore VERO: prima il messaggio citava "migration 043" (fuorviante,
    // è applicata da settimane) e inghiottiva la causa → impossibile diagnosticare
    // il fallimento visto da Eli il 22 lug. Ora la causa finisce nei log Vercel.
    console.error('[marketplace] salvataggio profilo fallito:', error)
    return { error: 'Salvataggio non riuscito. Riprova tra qualche istante.' }
  }
  revalidatePath('/marketplace')
  return null
}

/** Salva + esegue la verifica automatica; pubblica solo se TUTTI i controlli passano. */
export async function publishMarketplaceProfileAction(formData: FormData): Promise<PublishResult> {
  const ctx = await getContext()
  if (!ctx) return { error: 'Sessione scaduta. Ricarica la pagina.' }

  const profile = cleanProfile(formData)

  // Con un profilo GIÀ pubblicato, dati incompleti non vanno nemmeno
  // salvati: il profilo resterebbe online con campi vuoti mentre la UI
  // direbbe "in bozza".
  const isComplete = !!(profile.public_name && profile.trade && profile.city && profile.phone)
  if (!isComplete) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 043 non ancora in types/database.ts
      const { data: current } = await (ctx.supabase as any)
        .from('marketplace_profiles')
        .select('enabled')
        .eq('workspace_id', ctx.workspace.id)
        .maybeSingle()
      if (current?.enabled) {
        return { error: 'Il profilo pubblicato deve restare completo: servono nome pubblico, mestiere, comune e telefono. Le modifiche non sono state salvate.' }
      }
    } catch { /* tabella mancante */ }
  }

  // Salva la bozza prima dei controlli
  const saved = await saveMarketplaceProfileAction(formData)
  if (saved?.error) return saved
  const checks: Check[] = []

  // 1. Profilo completo
  const complete = !!(profile.public_name && profile.trade && profile.city && profile.phone)
  checks.push({
    ok: complete,
    label: complete ? 'Profilo completo' : 'Profilo incompleto',
    detail: complete
      ? 'Nome pubblico, mestiere, zona di lavoro e telefono presenti'
      : 'Servono nome pubblico, mestiere, comune e telefono.',
  })

  // 2. Email confermata (account Supabase)
  const emailOk = !!ctx.user.email_confirmed_at
  checks.push({
    ok: emailOk,
    label: emailOk ? 'Email confermata' : 'Email non confermata',
    detail: emailOk
      ? 'Indirizzo dell’account già verificato'
      : 'Conferma l’email dell’account dal link che ti abbiamo inviato.',
  })

  // 3. P.IVA su VIES
  let viesOk = false
  let viesDetail = ''
  if (!ctx.workspace.piva) {
    viesDetail = 'Inserisci la P.IVA in Impostazioni › Fiscale e riprova.'
  } else {
    const vies = await checkViesVat(ctx.workspace.piva)
    viesOk = vies === 'valid'
    viesDetail =
      vies === 'valid'
        ? 'Riscontro automatico sul registro VIES'
        : vies === 'invalid'
          ? 'P.IVA non trovata su VIES. Controlla la P.IVA in Impostazioni › Fiscale e riprova.'
          : 'Il registro VIES non risponde in questo momento. Riprova tra qualche minuto.'
  }
  checks.push({ ok: viesOk, label: viesOk ? 'P.IVA verificata' : 'P.IVA da verificare', detail: viesDetail })

  const allOk = checks.every((c) => c.ok)
  if (allOk) {
    // enabled/published_at si scrivono SOLO qui, con l'admin client:
    // dalla migration 045 la colonna non è più scrivibile dal client utente,
    // così la pubblicazione passa sempre dai controlli qui sopra.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 043 non ancora in types/database.ts
    const { error } = await (createAdminClient() as any)
      .from('marketplace_profiles')
      .update({
        enabled: true,
        published_at: new Date().toISOString(),
        vies_checked_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('workspace_id', ctx.workspace.id)
    if (error) {
      console.error('[marketplace] pubblicazione fallita:', error)
      return { error: 'Pubblicazione non riuscita. Riprova.' }
    }
  }

  revalidatePath('/marketplace')
  return { published: allOk, checks }
}

export async function unpublishMarketplaceProfileAction(): Promise<PublishResult> {
  const ctx = await getContext()
  if (!ctx) return { error: 'Sessione scaduta.' }
  // Admin client: enabled non è scrivibile dal client utente (migration 045)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 043 non ancora in types/database.ts
  const { error } = await (createAdminClient() as any)
    .from('marketplace_profiles')
    .update({ enabled: false, published_at: null, updated_at: new Date().toISOString() })
    .eq('workspace_id', ctx.workspace.id)
  if (error) {
    console.error('[marketplace] operazione fallita:', error)
    return { error: 'Operazione non riuscita.' }
  }
  revalidatePath('/marketplace')
  return null
}

export async function markRequestStatusAction(
  requestId: string,
  status: 'read' | 'replied'
): Promise<{ error?: string } | null> {
  const ctx = await getContext()
  if (!ctx) return { error: 'Sessione scaduta.' }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabella 043 non ancora in types/database.ts
  const { error } = await (ctx.supabase as any)
    .from('marketplace_requests')
    .update({ status })
    .eq('id', requestId)
    .eq('workspace_id', ctx.workspace.id)
  if (error) {
    console.error('[marketplace] aggiornamento fallito:', error)
    return { error: 'Aggiornamento non riuscito. Riprova.' }
  }
  revalidatePath('/richieste')
  revalidatePath('/altro') // il badge "richieste nuove" deve scendere subito
  return null
}
