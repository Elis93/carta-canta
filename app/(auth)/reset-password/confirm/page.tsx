'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { confirmResetPasswordAction } from '../../actions'

function ConfirmForm() {
  const searchParams = useSearchParams()
  const code = searchParams.get('code') ?? ''
  const [state, formAction, isPending] = useActionState(confirmResetPasswordAction, null)

  if (!code) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm text-destructive bg-destructive/10 px-4 py-3 rounded-lg">
          Link non valido o scaduto. Richiedi un nuovo link di reset.
        </p>
        <Link
          href="/reset-password"
          className="text-sm underline underline-offset-2 hover:text-foreground text-muted-foreground"
        >
          Richiedi nuovo link
        </Link>
      </div>
    )
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="code" value={code} />
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="password">Nuova password</Label>
          <PasswordInput
            id="password"
            name="password"
            placeholder="Almeno 8 caratteri"
            autoComplete="new-password"
            minLength={8}
            required
            disabled={isPending}
          />
        </div>

        {state?.error && (
          <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
            {state.error}
          </p>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={isPending}>
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
