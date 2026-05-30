'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Mail, X, Gift } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OAuthButtons } from '@/components/shared/OAuthButtons'
import { PasswordStrength, isPasswordStrong } from '@/components/shared/PasswordStrength'
import { signupAction } from '../../actions'

interface SignupFormProps {
  defaultRefCode?: string
}

export function SignupForm({ defaultRefCode }: SignupFormProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(signupAction, null)

  // Stato password + validazione
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmError, setConfirmError]       = useState<string | null>(null)
  const passwordStrong = isPasswordStrong(password)

  // FIX-21: banner persistente per email di verifica (no auto-dismiss, no redirect automatico)
  const [emailBannerDismissed, setEmailBannerDismissed] = useState(false)
  const showEmailBanner = state?.success === 'verifica-email' && !emailBannerDismissed

  // FIX-14: flag "redirect in corso" solo per il flusso onboarding (email già confermata)
  const isRedirecting = state?.success === 'onboarding'

  // Redirect automatico solo per onboarding (email già verificata).
  // Il caso verifica-email NON fa redirect: mostra il banner persistente sopra.
  useEffect(() => {
    if (state?.success === 'onboarding') router.push('/onboarding')
  }, [state, router])

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!passwordStrong) {
      e.preventDefault()
      return
    }
    if (password !== confirmPassword) {
      e.preventDefault()
      setConfirmError('Le password non corrispondono')
    } else {
      setConfirmError(null)
    }
  }

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Crea il tuo account</CardTitle>
        <CardDescription>
          Gratis. Nessuna carta di credito richiesta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* OAuth — accesso rapido senza form */}
        <OAuthButtons />

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">oppure registrati con email</span>
          </div>
        </div>

        {/* FIX-21: banner persistente di conferma email — rimane fino al click su X */}
        {showEmailBanner && (
          <div className="flex items-start gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 mb-4">
            <Mail className="size-4 shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <p className="font-semibold">Account creato! Controlla la tua email</p>
              <p className="text-xs text-green-700">
                Abbiamo inviato un link di conferma al tuo indirizzo.
                Clicca il link per attivare l&apos;account e completare l&apos;iscrizione.
              </p>
              <Link
                href="/verifica-email"
                className="text-xs text-green-700 underline underline-offset-2 hover:text-green-900"
              >
                Non hai ricevuto l&apos;email? Vai alla pagina di verifica →
              </Link>
            </div>
            <button
              type="button"
              aria-label="Chiudi"
              onClick={() => setEmailBannerDismissed(true)}
              className="shrink-0 rounded p-0.5 text-green-600 hover:text-green-900 hover:bg-green-100 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* Form tradizionale */}
        <form action={formAction} onSubmit={handleSubmit}>
          <div className="flex flex-col gap-4">
            {/* Nome + Cognome */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  name="nome"
                  type="text"
                  placeholder="Mario"
                  autoComplete="given-name"
                  required
                  disabled={isPending || isRedirecting || showEmailBanner}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cognome">Cognome</Label>
                <Input
                  id="cognome"
                  name="cognome"
                  type="text"
                  placeholder="Rossi"
                  autoComplete="family-name"
                  required
                  disabled={isPending || isRedirecting || showEmailBanner}
                />
              </div>
            </div>

            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="mario@esempio.it"
                autoComplete="email"
                required
                disabled={isPending || isRedirecting || showEmailBanner}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">Password</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                required
                disabled={isPending || isRedirecting || showEmailBanner}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (confirmPassword) {
                    setConfirmError(
                      e.target.value !== confirmPassword
                        ? 'Le password non corrispondono'
                        : null
                    )
                  }
                }}
              />
              <PasswordStrength password={password} />
            </div>

            {/* FIX-12 + FIX-13: Conferma password con PasswordInput (occhio) */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm_password">Conferma password</Label>
              <PasswordInput
                id="confirm_password"
                name="confirm_password"
                autoComplete="new-password"
                required
                disabled={isPending || isRedirecting || showEmailBanner}
                aria-invalid={confirmError ? true : undefined}
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value)
                  // aggiorna l'errore live una volta che l'utente ha cominciato a correggere
                  if (confirmError) {
                    setConfirmError(
                      password !== e.target.value
                        ? 'Le password non corrispondono'
                        : null
                    )
                  }
                }}
                onBlur={(e) => {
                  if (e.target.value && password !== e.target.value) {
                    setConfirmError('Le password non corrispondono')
                  } else {
                    setConfirmError(null)
                  }
                }}
              />
              {confirmError && (
                <p className="text-xs text-destructive">{confirmError}</p>
              )}
            </div>

            {/* Campo referral (opzionale) */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ref_code" className="flex items-center gap-1.5">
                <Gift className="size-3.5 text-muted-foreground" />
                Codice referral
                <span className="text-xs text-muted-foreground font-normal">(opzionale)</span>
              </Label>
              <Input
                id="ref_code"
                name="ref_code"
                type="text"
                placeholder="es. AB3X7Z"
                autoComplete="off"
                defaultValue={defaultRefCode ?? ''}
                disabled={isPending || isRedirecting || showEmailBanner}
                className="uppercase"
                maxLength={6}
              />
            </div>

            {state?.error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                {state.error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isPending || isRedirecting || showEmailBanner || !!confirmError || (password.length > 0 && !passwordStrong)}
            >
              {(isPending || isRedirecting) && <Loader2 className="animate-spin" />}
              {isPending
                ? 'Creazione account…'
                : isRedirecting
                  ? 'Reindirizzamento…'
                  : showEmailBanner
                    ? 'Email inviata ✓'
                    : 'Crea account gratuito'}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              Registrandoti accetti i nostri{' '}
              <Link href="/termini" className="underline underline-offset-2 hover:text-foreground">
                Termini di servizio
              </Link>{' '}
              e la{' '}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </form>

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Hai già un account?{' '}
          <Link
            href="/login"
            className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
          >
            Accedi
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
