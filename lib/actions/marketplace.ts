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
import { checkCompanyRegistry } from '@/lib/marketplace/company-check'
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
    // Contatti in vetrina (064, decisione Eli 2 ago: opt-in, spenti di default).
    // public_email è un'email DEDICATA alla vetrina, mai quella di login.
    show_phone: formData.get('show_phone') === 'on',
    public_email: String(formData.get('public_email') ?? '').trim().slice(0, 120) || null,
  }
}

/** Email in vetrina: se compilata deve avere una forma sensata. */
function publicEmailError(profile: { public_email: string | null }): string | null {
  if (profile.public_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profile.public_email)) {
    return 'L\u2019email da mostrare in vetrina non sembra valida. Correggila o lascia il campo vuoto.'
  }
  return null
}

/** Upsert del profilo tollerante pre-064: colonne contatti assenti → ritenta senza. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 043/064 non ancora in types/database.ts
async function upsertProfileTollerante(db: any, base: Record<string, unknown>) {
  const { error } = await db.from('marketplace_profiles').upsert(base, { onConflict: 'workspace_id' })
  if (error && (error.code === '42703' || error.code === 'PGRST204')) {
    const { show_phone: _sp, public_email: _pe, ...senzaContatti } = base
    return db.from('marketplace_profiles').upsert(senzaContatti, { onConflict: 'workspace_id' })
  }
  return { error }
}

export async function saveMarketplaceProfileAction(formData: FormData): Promise<PublishResult> {
  const ctx = await getContext()
  if (!ctx) return { error: 'Sessione scaduta. Ricarica la pagina.' }

  const profile = cleanProfile(formData)
  const emailErr = publicEmailError(profile)
  if (emailErr) return { error: emailErr }

  // ⚠️ L'upsert del CLIENT UTENTE deve toccare SOLO le colonne descrittive
  // CONCESSE: la migration 045 dà ad `authenticated` i permessi colonna per
  // colonna (la 064 estende il GRANT a show_phone/public_email). Includere
  // colonne non concesse produce "permission denied" (42501) sull'INTERA
  // scrittura — era il "Salvataggio non riuscito" del 29 lug (lat/lng).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- tabelle 043/055/064 non ancora in types/database.ts
  const db = ctx.supabase as any
  const base = { workspace_id: ctx.workspace.id, ...profile, updated_at: new Date().toISOString() }
  const { error } = await upsertProfileTollerante(db, base)

  if (error) {
    // Log dell'errore VERO: prima il messaggio citava "migration 043" (fuorviante,
    // è applicata da settimane) e inghiottiva la causa → impossibile diagnosticare
    // il fallimento visto da Eli il 22 lug. Ora la causa finisce nei log Vercel.
    console.error('[marketplace] salvataggio profilo fallito:', error)
    return { error: 'Salvataggio non riuscito. Riprova tra qualche istante.' }
  }

  // Coordinate "Vicino a me" (055): geocodifica del comune scritta con
  // l'ADMIN client — sono un dato DERIVATO dal comune, non dell'utente
  // (che infatti non ha il permesso di scriverle). Best-effort: se fallisce
  // il profilo resta salvato e cercabile per parola, senza ordinamento
  // per distanza. Tollerante pre-055 (colonne assenti → ignora).
  const coords = profile.city ? await geocodeCity(profile.city) : null
  if (coords) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- colonne 055 non ancora in types/database.ts
      const { error: geoError } = await (createAdminClient() as any)
        .from('marketplace_profiles')
        .update({ lat: coords.lat, lng: coords.lng })
        .eq('workspace_id', ctx.workspace.id)
      if (geoError && !isMissingColumnError(geoError)) {
        console.error('[marketplace] coordinate non salvate:', geoError)
      }
    } catch (e) {
      console.error('[marketplace] coordinate non salvate:', e)
    }
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

  // 3. P.IVA: prima VIES (gratis), poi Registro Imprese via OpenAPI
  // (decisione Eli 29 lug "opzione 1"): il VIES contiene solo le P.IVA
  // registrate per l'estero — molti artigiani italiani con P.IVA valida
  // non ci sono. Il Registro Imprese li copre; si paga (centesimi) solo
  // quando il VIES non conferma. Senza chiave configurata → solo VIES,
  // comportamento identico a prima.
  let viesOk = false
  let viesDetail = ''
  if (!ctx.workspace.piva) {
    viesDetail = 'Inserisci la P.IVA in Impostazioni › Fiscale e riprova.'
  } else {
    const vies = await checkViesVat(ctx.workspace.piva)
    if (vies === 'valid') {
      viesOk = true
      viesDetail = 'Riscontro automatico sul registro VIES'
    } else {
      const registry = await checkCompanyRegistry(ctx.workspace.piva)
      if (registry === 'valid') {
        viesOk = true
        viesDetail = 'Riscontro automatico sul Registro Imprese'
      } else if (registry === 'invalid' || (registry === 'unconfigured' && vies === 'invalid')) {
        viesDetail = 'P.IVA non trovata nei registri. Controlla la P.IVA in Impostazioni › Fiscale e riprova.'
      } else {
        viesDetail = 'I registri delle P.IVA non rispondono in questo momento. Riprova tra qualche minuto.'
      }
    }
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
