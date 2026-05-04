'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OAuthButtons } from '@/components/shared/OAuthButtons'
import { signupAction } from '../actions'

export default function SignupPage() {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(signupAction, null)

  // FIX-12/13: stato controllato per validazione client-side conferma password
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmError, setConfirmError]       = useState<string | null>(null)

  // FIX-14: flag "redirect in corso" per mostrare feedback visivo
  const isRedirecting =
    state?.success === 'onboarding' || state?.success === 'verifica-email'

  useEffect(() => {
    if (state?.success === 'onboarding')     router.push('/onboarding')
    if (state?.success === 'verifica-email') router.push('/verifica-email')
  }, [state, router])

  // FIX-12: intercetta submit e blocca se le password non corrispondono
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
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

        {/* FIX-14: feedback visivo mentre il redirect è in corso */}
        {isRedirecting && (
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 mb-4">
            <Mail className="size-4 shrink-0" />
            Account creato! Controlla la tua email per il link di conferma.
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
                  disabled={isPending || isRedirecting}
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
                  disabled={isPending || isRedirecting}
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
                disabled={isPending || isRedirecting}
              />
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">
                Password
                <span className="ml-1 text-xs text-muted-foreground font-normal">
                  (min. 8 caratteri)
                </span>
              </Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                minLength={8}
                required
                disabled={isPending || isRedirecting}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  // aggiorna l'errore live se il campo conferma è già stato toccato
                  if (confirmPassword) {
                    setConfirmError(
                      e.target.value !== confirmPassword
                        ? 'Le password non corrispondono'
                        : null
                    )
                  }
                }}
              />
            </div>

            {/* FIX-12 + FIX-13: Conferma password con PasswordInput (occhio) */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="confirm_password">Conferma password</Label>
              <PasswordInput
                id="confirm_password"
                name="confirm_password"
                autoComplete="new-password"
                required
                disabled={isPending || isRedirecting}
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

            {state?.error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                {state.error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={isPending || isRedirecting || !!confirmError}
            >
              {(isPending || isRedirecting) && <Loader2 className="animate-spin" />}
              {isPending
                ? 'Creazione account…'
                : isRedirecting
                  ? 'Reindirizzamento…'
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
