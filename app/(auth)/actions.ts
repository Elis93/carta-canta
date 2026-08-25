'use server'

import { redirect } from 'next/navigation'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createClient as createBareClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { slugify } from '@/lib/utils'
import { sendEmail } from '@/lib/email/send'
import { WelcomeEmail } from '@/lib/email/templates/welcome'
import {
  isAuthRateLimited,
  getLoginFailureCount,
  recordLoginFailure,
  clearLoginFailures,
  LOGIN_CAPTCHA_THRESHOLD,
} from '@/lib/auth-rate-limit'
import { registerReferralUse } from '@/lib/referral/register-use'
import { validatePasswordServer } from '@/lib/password'
import { verifyTurnstile } from '@/lib/turnstile'
import { sendSecurityAlert } from '@/lib/security/alert'
import { logSecurityEvent } from '@/lib/security/events'
import { clientIpFrom } from '@/lib/client-ip'
import { headers, cookies } from 'next/headers'

type ActionResult = {
  error?:         string
  success?:       string
  /** l'utente ha inserito la stessa password già in uso */
  samePassword?:  true
  /** troppi tentativi falliti: il client deve mostrare il captcha */
  needsCaptcha?:  true
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
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
      && !rawRedirect.includes(':') && !rawRedirect.includes('\\')
      && !rawRedirect.startsWith('/api/') // igiene: mai redirigere su una route API (audit 24 lug)
      ? rawRedirect
      : '/dashboard'

  if (!email || !password) {
    return { error: 'Email e password sono obbligatorie.' }
  }

  // ── Captcha dopo N tentativi falliti (soglia soft, audit 25 lug) ──────────
  // Oltre LOGIN_CAPTCHA_THRESHOLD fallimenti nella finestra (per IP), esigiamo
  // il captcha PRIMA di provare le credenziali: rallenta il credential-stuffing
  // automatizzato senza infastidire chi sbaglia una password una volta.
  // Il contatore è per IP (non spoofabile su Vercel): un bot non può azzerarlo
  // cambiando client. Se Turnstile non è configurato verifyTurnstile ritorna
  // true (fail-open) → nessun lockout.
  // ⚠️ Il gate esige ENTRAMBE le chiavi (review 25 lug A3): con la sola secret
  // e senza NEXT_PUBLIC_TURNSTILE_SITE_KEY il client non può renderizzare il
  // widget → chiedere il captcha sarebbe un lockout invisibile per chiunque
  // sbagli 3 volte.
  const captchaConfigured =
    !!process.env.TURNSTILE_SECRET_KEY && !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
  if (captchaConfigured) {
    const failCount = await getLoginFailureCount()
    if (failCount >= LOGIN_CAPTCHA_THRESHOLD) {
      if (!(await verifyTurnstile(formData))) {
        // ⚠️ Anche QUESTO ramo va nel registro: da qui in poi ogni tentativo
        // senza captcha esce PRIMA di provare le credenziali — senza questa
        // riga, un attacco insistito da un IP sarebbe visibile solo per i
        // primi 3 fallimenti e poi sparirebbe dal registro proprio mentre
        // continua per ore (trovato in revisione, 5 ago).
        await logSecurityEvent({
          kind: 'login_failed',
          ip: clientIpFrom(await headers()),
          meta: { motivo: 'captcha', fallimenti_ip: failCount },
        })
        return {
          error: 'Per sicurezza, completa la verifica antispam qui sotto e riprova.',
          needsCaptcha: true,
        }
      }
    }
  }

  // Rate limit applicato SOLO sui tentativi falliti: conta per IP i fallimenti
  // dell'autenticazione, non i login riusciti.
  // In questo modo utenti che fanno login regolare non vengono mai bloccati.
  const supabase = await createClient()
  const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    // Contatore leggibile per la soglia captcha (+1 su questo fallimento).
    const newFailCount = await recordLoginFailure()
    // Il client deve mostrare il captcha da qui in poi se ha superato la soglia
    // (solo se il widget PUÒ essere renderizzato — entrambe le chiavi presenti).
    const needsCaptcha = captchaConfigured && newFailCount >= LOGIN_CAPTCHA_THRESHOLD ? true : undefined

    // Registro di sicurezza — ⚠️ PRIMA del controllo sul rate limit, che esce
    // con un return: se lo mettessimo dopo, l'evento sparirebbe proprio quando
    // i tentativi diventano tanti, cioè nell'unico caso che vogliamo vedere.
    // ⚠️ NIENTE email qui: l'evento serve a contare i tentativi e a capire se
    // vengono sempre dalla stessa parte (impronta IP), non a sapere quale
    // casella è stata provata — quello sarebbe proprio l'elenco che un
    // attaccante vorrebbe trovare. `motivo` è un'etichetta nostra.
    await logSecurityEvent({
      kind: 'login_failed',
      ip: clientIpFrom(await headers()),
      meta: {
        motivo: error.message.includes('Email not confirmed') ? 'email_non_confermata'
          : error.message.includes('Invalid login credentials') ? 'credenziali'
          : 'altro',
        fallimenti_ip: newFailCount,
      },
    })

    // Conta il fallimento contro il rate limit (10 fallimenti / 15 min per IP)
    const limited = await isAuthRateLimited({
      action:    'login-fail',
      requests:  10,
      window:    '15 m',
      windowMs:  15 * 60 * 1000,
    })
    if (limited) {
      return { error: 'Troppi tentativi falliti. Riprova tra qualche minuto.', needsCaptcha }
    }

    if (error.message.includes('Email not confirmed')) {
      return { error: 'Conferma la tua email prima di accedere.', needsCaptcha }
    }
    if (error.message.includes('Invalid login credentials')) {
      // Messaggio UNICO e volutamente generico (audit sicurezza 20 lug): non
      // riveliamo se l'email è registrata o meno. Distinguere "email inesistente"
      // da "password errata" darebbe a un attaccante un oracolo per capire quali
      // email hanno un account (phishing mirato / credential stuffing).
      return { error: 'Email o password non corretti.', needsCaptcha }
    }
    return { error: 'Errore durante il login. Riprova.', needsCaptcha }
  }

  // Login riuscito → azzera il contatore fallimenti (niente captcha residuo).
  await clearLoginFailures()

  // Il login riuscito è l'evento che dà senso agli altri: è quello che dice
  // se il tentativo insistito è finito bene per l'attaccante, e da quale
  // impronta di rete è arrivato l'accesso che poi ha scaricato tutto.
  // L'utente arriva dalla risposta stessa di signInWithPassword: una
  // getUser() qui sarebbe un giro di rete in più nel punto più caldo
  // dell'app, solo per rileggere un dato che abbiamo già in mano.
  await logSecurityEvent({
    kind: 'login_ok',
    userId: authData?.user?.id ?? null,
    ip: clientIpFrom(await headers()),
  })

  // Qui si restituisce il path e naviga il client (router.push). Nota storica:
  // la motivazione originaria («redirect() non propaga i Set-Cookie») è stata
  // SMENTITA leggendo i sorgenti di Next 16.2.11 (i cookie mutati passano
  // attraverso il redirect delle server action). Il pattern resta perché
  // funziona e il client deve comunque gestire captcha/errori nel form.
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
    // ⚠️ ANTI-ENUMERAZIONE (audit sicurezza 24 lug): NON rivelare che l'email
    // esiste già — sarebbe un oracolo per costruire liste di account reali
    // (phishing/credential stuffing), e contraddirebbe l'hardening del login
    // ("Email o password non corretti" generico). Un'email già registrata
    // riceve lo STESSO esito di una nuova: "controlla la posta". Chi ha già un
    // account non riceve una seconda email di conferma (Supabase non la manda)
    // e trova comunque il link "Accedi" nella pagina.
    if (signupError.message.includes('User already registered')) {
      return { success: 'verifica-email' }
    }
    return { error: 'Errore durante la registrazione. Riprova.' }
  }

  if (!authData.user) {
    return { error: 'Errore imprevisto. Riprova.' }
  }

  // Supabase con "email confirmation" abilitato non ritorna errore per email già
  // registrate (anti-enumeration): restituisce l'utente esistente con identities=[].
  // Rileviamo questo caso per NON tentare il workspace creation (fallirebbe sul
  // unique constraint) né il rollback (cancellerebbe l'utente!). Stesso esito
  // neutro del signup nuovo — nessuna enumerazione.
  if ((authData.user.identities?.length ?? 0) === 0) {
    return { success: 'verifica-email' }
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
      // Niente email nei log (PII): l'userId basta per l'intervento manuale.
      console.error('[signupAction] Rollback deleteUser failed', {
        userId: authData.user.id,
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

  // Si restituisce un successo e naviga il client (router.push). Nota storica:
  // la motivazione originaria («redirect() non propaga i Set-Cookie») è stata
  // SMENTITA sui sorgenti di Next 16.2.11 — il pattern resta perché il client
  // deve comunque mostrare il pop-up «Account creato» prima di navigare.
  return { success: 'onboarding' }
}

// ============================================================
// LOGOUT
// ============================================================
export async function logoutAction() {
  const supabase = await createClient()
  // scope 'local': «Esci» slogga QUESTO dispositivo. Il default di supabase-js
  // è 'global' — uscire dal telefono buttava fuori anche il computer, che alla
  // riapertura chiedeva l'accesso «senza motivo» (audit 17 ago; stessa
  // decisione già presa il 12 ago per il bottone del login). Per chiudere
  // TUTTE le sessioni c'è l'azione dedicata in Account › Sicurezza.
  await supabase.auth.signOut({ scope: 'local' })
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

  // ANTI-ENUMERAZIONE (audit 24 lug): un errore specifico ("User already
  // confirmed" / email inesistente) rivelerebbe lo stato dell'account. Come il
  // reset password, si risponde SEMPRE con lo stesso messaggio neutro (l'errore
  // vero resta nei log). Chi ha già confermato semplicemente non riceve nulla.
  if (error) {
    console.warn('[resendVerification] esito non rivelato all’utente:', error.message)
  }
  return { success: 'Se l’indirizzo è corretto e in attesa di conferma, ti abbiamo inviato l’email. Controlla la casella (e lo spam).' }
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

  // ⚠️ Client USA-E-GETTA senza cookie (revisione 24 ago): il client di
  // sessione, in modalità PKCE, a ogni richiesta di reset scriveva nel
  // browser un cookie `-code-verifier` nuovo — SOVRASCRIVENDO quello di un
  // eventuale «Accedi con Google» avviato in un'altra scheda, che al ritorno
  // falliva con oauth_failed. Il template email usa il percorso token_hash
  // (/auth/confirm), quindi quel verifier non serviva comunque a nulla.
  // ⚠️ CONSEGUENZA (secondo ricontrollo 24 ago): questo client è in modalità
  // IMPLICIT (default di supabase-js) → nessun code_challenge nella richiesta
  // → il percorso PKCE (?code= su /auth/callback) per il recovery NON esiste
  // più. Il template Supabase «Reset password» che punta a
  // /auth/confirm?token_hash={{ .TokenHash }}&type=recovery è quindi un
  // REQUISITO, non una preferenza: col vecchio {{ .ConfirmationURL }} il
  // token verrebbe verificato alla GET (di nuovo bruciabile dagli scanner) e
  // i token arriverebbero nel fragment, invisibili al server → recovery rotto.
  const bare = createBareClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
  const { error } = await bare.auth.resetPasswordForEmail(email, {
    // Col template token_hash questo parametro non viene usato; NON è una
    // riserva funzionante (vedi nota sopra sul flusso implicit).
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=/reset-password/confirm`,
  })

  if (error) {
    // Nei log resta il motivo VERO (collaudo Eli 21 ago: il messaggio piatto
    // «Errore nell'invio» nascondeva il rate limit di Supabase). Niente email
    // dell'utente nei log.
    console.error('[reset-password] resetPasswordForEmail:', error.status, (error as { code?: string }).code, error.message)
    // Supabase limita l'invio per sicurezza: un link per indirizzo ogni ~60s,
    // più un tetto orario del progetto. Detto com'è, non «riprova» a vuoto.
    const code = (error as { code?: string }).code ?? ''
    if (error.status === 429 || code === 'over_email_send_rate_limit' || /rate limit|security purposes/i.test(error.message)) {
      return { error: 'Hai già richiesto un link da poco: per sicurezza se ne può chiedere un altro solo dopo qualche minuto. Quando arriva, apri l\u2019email più recente.' }
    }
    return { error: 'Errore nell\'invio dell\'email. Riprova.' }
  }

  return { success: 'Email inviata. Controlla la tua casella.' }
}

// ============================================================
// RESET PASSWORD — verifica del link dalla pagina-ponte
// ============================================================
// Il link dell'email NON verifica più il token alla GET (gli scanner di
// posta aprono i link e bruciavano il token monouso — collaudo Eli 21 ago,
// codice otp_expired su link fresco): atterra su /reset-password/verifica,
// e la verifica parte da QUI, su POST, quando l'utente tocca il bottone.
export async function confirmRecoveryLinkAction(): Promise<void> {
  // Freno: POST pubblica invocabile senza sessione — senza limite si potrebbe
  // martellare /verify di Supabase da un solo IP (revisione 24 ago).
  const limited = await isAuthRateLimited({
    action: 'recovery-verify', requests: 10, window: '15 m', windowMs: 15 * 60 * 1000,
  })
  if (limited) redirect('/reset-password?error=link_scaduto&m=troppi_tentativi')

  // Il token arriva dal COOKIE monouso scritto da /auth/confirm — mai dal
  // form, mai dall'URL (un segreto in un URL di pagina finisce in cronologia
  // e negli strumenti di statistica). Si cancella SUBITO: un secondo submit
  // (tasto indietro, cronologia) trova il cookie assente e riparte pulito
  // invece di bruciare la verifica appena riuscita.
  const cookieStore = await cookies()
  const tokenHash = cookieStore.get('cc_recovery_token')?.value?.trim() ?? ''
  cookieStore.delete('cc_recovery_token')
  if (!tokenHash || tokenHash.length > 255) redirect('/reset-password?error=link_scaduto')

  // Cintura come signupAction: un blip di rete verso Supabase non deve
  // diventare la pagina «Qualcosa è andato storto» senza uscita.
  let failCode: string | null = null
  try {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' })

    if (!error) redirect('/reset-password/confirm')

    console.error('[reset-password/verifica] verifyOtp:', error.status, error.code, error.message)
    // Verifica fallita: si chiude la sessione locale (chi torna al login non
    // deve ritrovarsi DENTRO l'app senza che nulla gli abbia chiesto una
    // password — motivo del 12 ago, conservato sul solo ramo di errore).
    const { error: outErr } = await supabase.auth.signOut({ scope: 'local' })
    if (outErr) console.warn('[reset-password/verifica] signOut:', outErr.message)
    failCode = error.code ?? 'sconosciuto'
  } catch (e) {
    // redirect() lancia NEXT_REDIRECT: va lasciato passare.
    if (e && typeof e === 'object' && 'digest' in e && String((e as { digest?: string }).digest).startsWith('NEXT_REDIRECT')) throw e
    console.error('[reset-password/verifica] eccezione:', e)
    failCode = 'errore_di_rete'
  }
  // Il codice d'errore viaggia nell'indirizzo (nessun dato personale): è la
  // diagnosi leggibile da una schermata fotografata.
  redirect(`/reset-password?error=link_scaduto&m=${encodeURIComponent(failCode ?? 'sconosciuto')}`)
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
    const e = error as unknown as { status?: number; code?: string; message?: string }
    // ⚠️ MAI classificare per il solo status 422 (revisione 24 ago): Supabase
    // lo usa anche per `weak_password` (es. protezione password compromesse) —
    // e l'utente leggeva «uguale a quella attuale» su una password nuova.
    const isSamePassword =
      e.code === 'same_password' ||
      /different from the old|same password/i.test(e.message ?? '')
    if (isSamePassword) {
      return { samePassword: true }
    }
    if (e.code === 'weak_password') {
      return { error: 'Questa password non è abbastanza sicura (potrebbe essere comparsa in violazioni di dati note): scegline un\u2019altra.' }
    }
    // Sessione di recupero assente o scaduta: «Riprova» qui non funzionerebbe
    // MAI — l'unica strada è riaprire il link o chiederne uno nuovo.
    if (e.code === 'session_missing' || e.status === 400 || e.status === 401) {
      return { error: 'La sessione di recupero non è più attiva. Riapri il link dall\u2019email più recente oppure richiedine uno nuovo dalla pagina «Reimposta password».' }
    }
    console.error('[reset-password/confirm] updateUser:', e.status, e.code, e.message)
    return { error: 'Errore durante il reset. Riprova.' }
  }

  // ⚠️ AVVISO DI SICUREZZA: una password cambiata a insaputa del titolare è il
  // primo passo di un account rubato. L'email arriva sempre, anche quando il
  // cambio è legittimo: è il fatto di arrivare SEMPRE che la rende utile.
  const { data: { user: updated } } = await supabase.auth.getUser()
  await sendSecurityAlert({
    to: updated?.email,
    title: 'Password modificata',
    what: 'La password del tuo account Carta Canta è stata cambiata.',
    actionPath: '/login',
    actionLabel: 'Vai a Carta Canta',
  })
  await logSecurityEvent({
    kind: 'password_changed',
    userId: updated?.id ?? null,
    ip: clientIpFrom(await headers()),
  })

  // Il senso del recupero è ESPELLERE chi era entrato: si revocano le sessioni
  // sugli ALTRI dispositivi (questa resta — l'utente ha appena provato di
  // essere lui). Best-effort: la password è già cambiata comunque.
  const { error: othersErr } = await supabase.auth.signOut({ scope: 'others' })
  if (othersErr) console.warn('[reset-password/confirm] signOut others:', othersErr.message)

  // Si atterra DENTRO l'app: la sessione è viva, e un redirect a /login
  // rimbalzerebbe comunque su /dashboard senza mai mostrare una conferma
  // (revisione 24 ago). Entrare con la password nuova È la conferma; l'email
  // di avviso qui sopra resta la traccia scritta.
  redirect('/dashboard')
}
