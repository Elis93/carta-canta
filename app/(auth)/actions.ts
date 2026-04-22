'use server'

import { redirect } from 'next/navigation'
import { createElement } from 'react'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { slugify } from '@/lib/utils'
import { sendEmail } from '@/lib/email/send'
import { WelcomeEmail } from '@/lib/email/templates/welcome'

type ActionResult = { error?: string; success?: string } | null

// ============================================================
// LOGIN
// ============================================================
export async function loginAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const redirectTo = (formData.get('redirect') as string) || '/dashboard'

  if (!email || !password) {
    return { error: 'Email e password sono obbligatorie.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.message.includes('Invalid login credentials')) {
      return { error: 'Email o password non corretti.' }
    }
    if (error.message.includes('Email not confirmed')) {
      return { error: 'Conferma la tua email prima di accedere.' }
    }
    return { error: 'Errore durante il login. Riprova.' }
  }

  redirect(redirectTo)
}

// ============================================================
// SIGNUP
// ============================================================
export async function signupAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const nome = (formData.get('nome') as string)?.trim()
  const cognome = (formData.get('cognome') as string)?.trim()
  const email = (formData.get('email') as string)?.trim()
  const password = formData.get('password') as string
  const workspaceName = (formData.get('workspace_name') as string)?.trim()

  if (!nome || !cognome || !email || !password || !workspaceName) {
    return { error: 'Tutti i campi sono obbligatori.' }
  }

  if (password.length < 8) {
    return { error: 'La password deve essere di almeno 8 caratteri.' }
  }

  const supabase = await createClient()

  // 1. Registrazione utente
  const { data: authData, error: signupError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { nome, cognome, full_name: `${nome} ${cognome}` },
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

  if (wsError) {
    // Rollback: cancella l'utente appena creato
    await adminClient.auth.admin.deleteUser(authData.user.id)
    return { error: 'Errore nella creazione del workspace. Riprova.' }
  }

  // Email di benvenuto — best-effort, non blocca il redirect
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://cartacanta.it'
  void sendEmail({
    to: email,
    subject: `Benvenuto in Carta Canta, ${nome}! 🎉`,
    react: createElement(WelcomeEmail, {
      userName: nome,
      workspaceName,
      dashboardUrl: `${appUrl}/dashboard`,
    }),
  }).catch(() => {})

  redirect('/onboarding')
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
// RESET PASSWORD — richiesta link
// ============================================================
export async function resetPasswordAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const email = (formData.get('email') as string)?.trim()

  if (!email) {
    return { error: 'Inserisci la tua email.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/confirm`,
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
  const code = (formData.get('code') as string)?.trim()

  if (!password || password.length < 8) {
    return { error: 'La password deve essere di almeno 8 caratteri.' }
  }

  const supabase = await createClient()

  // Scambia il codice PKCE con una sessione
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)
    if (exchangeError) {
      return { error: 'Link non valido o scaduto. Richiedi un nuovo link di reset.' }
    }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return { error: 'Errore durante il reset. Riprova.' }
  }

  redirect('/login')
}
