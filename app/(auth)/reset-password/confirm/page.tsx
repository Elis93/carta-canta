'use client'

import { Suspense, useActionState, useState } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { confirmResetPasswordAction } from '../../actions'

function ConfirmForm() {
  const [state, formAction, isPending] = useActionState(confirmResetPasswordAction, null)

  // FIX-1: stato controllato per validazione client-side conferma password
  // (stesso pattern della pagina signup)
  const [password, setPassword]               = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [confirmError, setConfirmError]       = useState<string | null>(null)

  // Intercetta submit e blocca se le password non corrispondono
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (password !== confirmPassword) {
      e.preventDefault()
      setConfirmError('Le password non corrispondono')
    } else {
      setConfirmError(null)
    }
  }

  return (
    <form action={formAction} onSubmit={handleSubmit}>
      <div className="flex flex-col gap-4">

        {/* Nuova password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">
            Nuova password
            <span className="ml-1 text-xs text-muted-foreground font-normal">
              (min. 8 caratteri)
            </span>
          </Label>
          <PasswordInput
            id="password"
            name="password"
            placeholder="Almeno 8 caratteri"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={isPending}
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              // aggiorna l'errore live se conferma è già stata toccata
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

        {/* FIX-1: Conferma password */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm_password">Conferma password</Label>
          <PasswordInput
            id="confirm_password"
            name="confirm_password"
            autoComplete="new-password"
            required
            disabled={isPending}
            aria-invalid={confirmError ? true : undefined}
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value)
              // aggiorna l'errore live una volta che l'utente ha iniziato a correggere
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

        {/* FIX-2: banner "stessa password" con due opzioni */}
        {state?.samePassword && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 space-y-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="size-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">La password inserita è uguale a quella attuale.</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  Vuoi mantenerla o sceglierne una nuova?
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="border-amber-300 text-amber-800 hover:bg-amber-100 hover:text-amber-900"
              >
                <Link href="/login">Mantieni password attuale</Link>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-amber-700 hover:bg-amber-100 hover:text-amber-900"
                onClick={() => {
                  setPassword('')
                  setConfirmPassword('')
                  setConfirmError(null)
                }}
              >
                Scegli una nuova password
              </Button>
            </div>
          </div>
        )}

        {state?.error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
            {state.error}
          </p>
        )}

        <Button
          type="submit"
          className="w-full"
          size="lg"
          disabled={isPending || !!confirmError}
        >
          {isPending && <Loader2 className="animate-spin" />}
          {isPending ? 'Salvataggio…' : 'Salva nuova password'}
        </Button>
      </div>
    </form>
  )
}

export default function ResetPasswordConfirmPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Nuova password</CardTitle>
        <CardDescription>Scegli una password sicura di almeno 8 caratteri.</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Loader2 className="mx-auto animate-spin text-muted-foreground" />}>
          <ConfirmForm />
        </Suspense>
      </CardContent>
    </Card>
  )
}
