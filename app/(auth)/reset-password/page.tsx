'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { resetPasswordAction } from '../actions'

export default function ResetPasswordPage() {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, null)

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Reimposta password</CardTitle>
        <CardDescription>
          Inserisci la tua email e ti invieremo un link per creare una nuova password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {state?.success ? (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-center text-muted-foreground bg-muted/50 px-4 py-3 rounded-lg">
              {state.success}
            </p>
            <p className="text-center text-sm text-muted-foreground">
              <Link
                href="/login"
                className="font-medium text-foreground underline underline-offset-2"
              >
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
                <Link
                  href="/login"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  Torna al login
                </Link>
              </p>
            </div>
          </form>
        )}
      </CardContent>
    </Card>
  )
}
