'use client'

import { Suspense, useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { resetPasswordAction } from '../actions'

function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, null)
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')

  return (
    <>
      {/* Banner link scaduto (quando si clicca una seconda volta sul link email) */}
      {urlError === 'link_scaduto' && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 mb-4">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Link non più valido</p>
            <p className="text-xs text-amber-700 mt-0.5">
              Ogni link di reset vale una sola volta e resta valido solo l&rsquo;ultimo
              ricevuto: se hai più email di reset in casella, apri la più recente.
              Altrimenti richiedine uno nuovo qui sotto.
            </p>
          </div>
        </div>
      )}

      {state?.success ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-center text-muted-foreground bg-muted/50 px-4 py-3 rounded-lg">
            {state.success}
          </p>
          <p className="text-center text-sm text-muted-foreground">
            <Link href="/login" className="font-medium text-foreground underline underline-offset-2">
              Torna al login
            </Link>
          </p>
        </div>
      ) : (
        <form action={formAction}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="mario@esempio.it"
                autoComplete="email"
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
              {isPending ? 'Invio in corso…' : 'Invia link di reset'}
            </Button>

            <p className="text-center text-sm text-muted-foreground">
              <Link href="/login" className="underline underline-offset-2 hover:text-foreground">
                Torna al login
              </Link>
            </p>
          </div>
        </form>
      )}
    </>
  )
}

export default function ResetPasswordPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Reimposta password</CardTitle>
        <CardDescription>
          Inserisci la tua email e ti invieremo un link per creare una nuova password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<Loader2 className="mx-auto animate-spin text-muted-foreground" />}>
          <ResetPasswordForm />
        </Suspense>
      </CardContent>
    </Card>
  )
}
