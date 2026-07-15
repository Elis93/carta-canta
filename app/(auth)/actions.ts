'use server'

import { redirect } from 'next/navigation'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { slugify } from '@/lib/utils'
import { sendEmail } from '@/lib/email/send'
import { WelcomeEmail } from '@/lib/email/templates/welcome'
import { isAuthRateLimited } from '@/lib/auth-rate-limit'
import { registerReferralUse } from '@/lib/referral/register-use'
import { validatePasswordServer } from '@/lib/password'
import { verifyTurnstile } from '@/lib/turnstile'

type ActionResult = {
  error?:         string
  success?:       string
  /** l'utente ha inserito la stessa password già in uso */
  samePassword?:  true
  /** l'email non è registrata — suggerisci la registrazione */
  suggestSignup?: true
} | null

// ============================================================
// LOGIN
// ============================================================
export async function loginAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  // ANTI OPEN-REDIRECT: solo path interni (no "//evil.com", no "https:...").
  // Stesso pattern di /auth/callback (PR #7); qui era stato dimenticato.
  const rawRedirect = (formData.get('redirect') as string) || '/dashboard'
  const redirectTo =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//') && !rawRedirect.includes(':') && !rawRedirect.includes('\\')
      ? rawRedirect
      : '/dashboard'

  if (!email || !password) {
    return { error: 'Email e password sono obbligatorie.' }
  }

  // Rate limit applicato SOLO sui tentativi falliti: conta per IP i fallimenti
  // dell'autenticazione, non i login riusciti.
  // In questo modo utenti che fanno login regolare non vengono mai bloccati.
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Conta il fallimento contro il rate limit (10 fallimenti / 15 min per IP)
    const limited = await isAuthRateLimited({
      action:    'login-fail',
      requests:  10,
      window:    '15 m',
      windowMs:  15 * 60 * 1000,
    })
    if (limited) {
      return { error: 'Troppi tentativi falliti. Riprova tra qualche minuto.' }
    }

    if (error.message.includes('Email not confirmed')) {
      return { error: 'Conferma la tua email prima di accedere.' }
    }
    if (error.message.includes('Invalid login credentials')) {
      // Distingui "email non registrata" da "password sbagliata" via Supabase Admin REST API.
      // Operazione server-side — non espone info al browser prima della verifica.
      try {
        const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL
        const serviceKey   = process.env.SUPABASE_SERVICE_ROLE_KEY
        if (supabaseUrl && serviceKey) {
          const res = await fetch(
            `${supabaseUrl}/auth/v1/admin/users?email=${encodeURIComponent(email)}&page=1&per_page=1`,
            { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
          )
          if (res.ok) {
            const body = await res.json() as { users?: unknown[] }
            if (!body.users?.length) {
              return { error: 'Nessun account trovato con questa email.', suggestSignup: true }
            }
          }
        }
      } catch {
        // Lookup fallita — usa messaggio generico sicuro
      }
      return { error: 'Password non corretta.' }
    }
    return { error: 'Errore durante il login. Riprova.' }
  }

  // NON usare redirect() qui: stessa ragione di signupAction — in Next.js 16
  // + Vercel, redirect() dentro una Server Action non propaga i Set-Cookie di
  // sessione Supabase. Restituiamo il path di destinazione e lasciamo che il
  // client navighi via router.push() quando i cookie sono già nel browser.
  return { success: redirectTo }
}

// ============================================================
// SIGNUP
// ============================================================
export async function signupAction(
  prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  // Guard globale: qualsiasi eccezione imprevista (rete, servizi esterni) diventa
  // un errore leggibile NEL FORM invece della pagina "Qualcosa è andato storto".
  try {
    return await signupActionInner(prevState, formData)
  } catch (e) {
    console.error('[signupAction] eccezione non gestita', e)
    return { error: 'Errore imprevisto durante la registrazione. Riprova tra qualche istante.' }
  }
}

async function signupActionInner(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = await isAuthRateLimited({
    action:    'signup',
    requests:  3,
    window:    '1 h',
    windowMs:  60 * 60 * 1000,
  })
  if (limited) {
    return { error: 'Troppi tentativi, riprova tra qualche minuto.' }
  }

  const nome = (formData.get('nome') as string)?.trim()
  const cognome = (formData.get('cognome') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const refCode = (formData.get('ref_code') as string | null)?.trim().toUpperCase() || null

  if (!nome || !cognome || !email || !password) {
    return { error: 'Tutti i campi sono obbligatori.' }
  }

  // Captcha anti-bot (attivo solo se TURNSTILE_SECRET_KEY è configurata)
  if (!(await verifyTurnstile(formData))) {
    return { error: 'Verifica antispam non superata. Riprova.' }
  }

  // Nome workspace auto-generato dal nome utente — modificabile in seguito dalle impostazioni
  const workspaceName = `${nome} ${cognome}`

  const pwError = validatePasswordServer(password)
  if (pwError) return { error: pwError }

  const supabase = await createClient()

  // 1. Registrazione utente
  const { data: authData, error: signupError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        nome, cognome, full_name: `${nome} ${cognome}`,
        // Attribuzione campagne (misura senza pixel): salvate nei metadati utente
        ...Object.fromEntries(
          ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']
            .map((k) => [k, String(formData.get(k) ?? '').slice(0, 100)])
            .filter(([, v]) => v)
        ),
        // Invito commercialista→artigiano: ricordiamo lo studio che l'ha portato
        // per suggerire il collegamento (che l'artigiano CONFERMA in Impostazioni)
        ...(() => {
          const studio = String(formData.get('studio_invite_email') ?? '').trim().toLowerCase().slice(0, 200)
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(studio) ? { studio_invite_email: studio } : {}
        })(),
      },
    },
  })

  if (signupError) {
    if (signupError.message.includes('User already registered')) {
      return { error: 'Esiste già un account con questa email.' }
    }
    return { error: 'Errore durante la registrazione. Riprova.' }
  }

  if (!authData.user) {
    return { error: 'Errore imprevisto. Riprova.' }
  }

  // Supabase con "email confirmation" abilitato non ritorna errore per email già
  // registrate (anti-enumeration): restituisce l'utente esistente con identities=[].
  // Rileviamo questo caso per evitare di tentare un workspace creation (che fallirebbe
  // con unique constraint) e soprattutto di fare rollback (che cancellerebbe l'utente!).
  if ((authData.user.identities?.length ?? 0) === 0) {
    return { error: 'Esiste già un account con questa email.' }
  }

  // 2. Creazione workspace con admin client (bypassa RLS per insert iniziale)
  const adminClient = createAdminClient()
  const baseSlug = slugify(workspaceName)
  let slug = baseSlug

  // Gestione slug duplicato — aggiungi timestamp se necessario
  const { data: existingSlug } = await adminClient
    .from('workspaces')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existingSlug) {
    slug = `${baseSlug}-${Date.now().toString(36)}`
  }

  const { error: wsError } = await adminClient.from('workspaces').insert({
    name: workspaceName,
    slug,
    owner_id: authData.user.id,
    plan: 'free',
    fiscal_regime: 'forfettario',
  })

  // 2b. Registra uso codice referral (best-effort — non blocca il signup).
  // Stessa logica riusata dal flusso OAuth in /auth/callback (helper condiviso).
  if (!wsError && refCode) {
    void registerReferralUse(refCode, authData.user.id)
  }

  if (wsError) {
    // Rollback: cancella l'utente appena creato per evitare account orfani.
    // Se anche il rollback fallisce, lo logghiamo (visibile nei log Vercel)
    // così possiamo intervenire manualmente: l'utente ha un account auth
    // senza workspace e al prossimo signup vedrebbe "email già registrata".
    const { error: rollbackError } = await adminClient.auth.admin.deleteUser(
      authData.user.id
    )
    if (rollbackError) {
      console.error('[signupAction] Rollback deleteUser failed', {
        userId: authData.user.id,
        email,
        wsError: wsError.message,
        rollbackError: rollbackError.message,
      })
      return {
        error: 'Errore tecnico durante la registrazione. Contatta il supporto.',
      }
    }
    return { error: 'Errore nella creazione del workspace. Riprova.' }
  }

  // Se Supabase richiede la conferma email, session è null: non c'è ancora
  // una sessione attiva. Mandiamo l'utente alla pagina "controlla email".
  // La sessione verrà creata quando l'utente cliccherà il link in /auth/confirm.
  if (!authData.session) {
    return { success: 'verifica-email' }
  }

  // Email di benvenuto — best-effort (il catch inghiotte gli errori) ma
  // ATTESA: su Vercel un fire-and-forget dopo il return può non partire mai
  // (lambda congelata). Inviata solo se l'email è già confermata (es. conferma
  // automatica in dev o se le conferme sono disabilitate in Supabase).
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.app'
  await sendEmail({
    to: email,
    subject: `Benvenuto in Carta Canta, ${nome}`,
    react: createElement(WelcomeEmail, {
      userName: nome,
      workspaceName,
      ctaUrl: `${appUrl}/preventivi/nuovo`,
    }),
  }).catch(() => {})

  // NON usare redirect() qui: terminerebbe la Server Action con una risposta
  // speciale che in alcuni runtime (Next.js 16 + Vercel Edge) non propaga
  // correttamente i Set-Cookie scritti da signUp(). Restituiamo invece un
  // successo e lasciamo che il client navighi via router.push() — in quel
  // momento i cookie di sessione sono già nel browser.
  return { success: 'onboarding' }
}

// ============================================================
// LOGOUT
// ============================================================
export async function logoutAction() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}

// ============================================================
// RINVIA EMAIL DI VERIFICA
// ============================================================
export async function resendVerificationEmailAction(
  prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  try {
    return await resendVerificationEmailInner(prevState, formData)
  } catch (e) {
    console.error('[resendVerificationEmailAction] eccezione non gestita', e)
    return { error: 'Errore imprevisto. Riprova tra qualche istante.' }
  }
}

async function resendVerificationEmailInner(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const limited = await isAuthRateLimited({
    action:   'resend-verification',
    requests: 3,
    window:   '30 m',
    windowMs: 30 * 60 * 1000,
  })
  if (limited) {
    return { error: 'Troppi tentativi, riprova tra qualche minuto.' }
  }

  const email = (formData.get('email') as string)?.trim()
  if (!email) {
    return { error: 'Inserisci la tua email.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resend({
    type:  'signup',
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  })

  if (error) {
    return { error: 'Impossibile inviare l\'email. Verifica l\'indirizzo e riprova.' }
  }

  return { success: 'Email inviata. Controlla la tua casella (e lo spam).' }
}

// ============================================================
// RESET PASSWORD — richiesta link
// ============================================================
export async function resetPasswordAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  // Rate limit: 3 richieste / 30 min per IP — previene email flooding.
  const limited = await isAuthRateLimited({
    action:   'reset-password',
    requests: 3,
    window:   '30 m',
    windowMs: 30 * 60 * 1000,
  })
  if (limited) {
    return { error: 'Troppi tentativi, riprova tra qualche minuto.' }
  }

  const email = (formData.get('email') as string)?.trim()

  if (!email) {
    return { error: 'Inserisci la tua email.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    // Usiamo il Route Handler /auth/callback come landing point del link email:
    // exchangeCodeForSession viene eseguito lì (dove i Set-Cookie vengono
    // propagati correttamente nel redirect), poi il browser arriva su
    // /reset-password/confirm già autenticato — senza bisogno di passare il code.
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password/confirm`,
  })

  if (error) {
    return { error: 'Errore nell\'invio dell\'email. Riprova.' }
  }

  return { success: 'Email inviata. Controlla la tua casella.' }
}

// ============================================================
// RESET PASSWORD — conferma nuova password
// ============================================================
export async function confirmResetPasswordAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const password = formData.get('password') as string

  if (!password) {
    return { error: 'Inserisci una nuova password.' }
  }
  const pwError = validatePasswordServer(password)
  if (pwError) return { error: pwError }

  // La sessione è già stata stabilita dal Route Handler /auth/callback
  // (che ha eseguito exchangeCodeForSession e propagato i cookie via redirect).
  // Qui ci limitiamo ad aggiornare la password con la sessione corrente.
  const supabase = await createClient()
  const { error } = await supabase.auth.updateUser({ password })

  if (error) {
    // FIX-2: rileva "stessa password" — Supabase restituisce status 422
    // con message "New password should be different from the old password."
    // oppure code "same_password" nelle versioni più recenti del client.
    const e = error as unknown as { status?: number; code?: string; message?: string }
    const isSamePassword =
      e.status === 422 ||
      e.code === 'same_password' ||
      (e.message?.toLowerCase().includes('same') ?? false)

    if (isSamePassword) {
      return { samePassword: true }
    }

    return { error: 'Errore durante il reset. Riprova.' }
  }

  redirect('/login')
}
