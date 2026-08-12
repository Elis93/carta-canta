'use client'

import { Suspense, useActionState, useState } from 'react'
import Link from 'next/link'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { confirmResetPasswordAction } from '../../actions'
import { PasswordStrength, isPasswordStrong } from '@/components/shared/PasswordStrength'

function ConfirmForm() {
  const [state, formAction, isPending] = useActionState(confirmResetPasswordAction, null)

  const [password, setPassword] = useState('')
  const passwordStrong = isPasswordStrong(password)

  // ⚠️ NIENTE campo «Conferma password» (decisione di Eli, 12 ago), come nella
  // registrazione: non aggiunge sicurezza — protegge da un refuso, non da un
  // attacco, e il refuso lo previene già il tasto «mostra password». Tenerlo
  // solo qui avrebbe dato due comportamenti diversi per la stessa cosa.
  return (
    <form action={formAction}>
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
            autoComplete="new-password"
            required
            disabled={isPending}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <PasswordStrength password={password} />
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
                onClick={() => setPassword('')}
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
          disabled={isPending || (password.length > 0 && !passwordStrong)}
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
