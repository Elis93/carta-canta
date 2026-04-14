'use client'

import { useActionState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { loginAction } from '../actions'

function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, null)

  return (
    <form action={formAction}>
      <input type="hidden" name="redirect" value={redirectTo} />

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

        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="/reset-password"
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Hai dimenticato la password?
            </Link>
          </div>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
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
          {isPending ? 'Accesso in corso…' : 'Accedi'}
        </Button>
      </div>
    </form>
  )
}

export default function LoginPage() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Bentornato</CardTitle>
        <CardDescription>Accedi al tuo account Carta Canta</CardDescription>
      </CardHeader>
      <CardContent>
        <LoginForm redirectTo={redirectTo} />

        <p className="mt-4 text-center text-sm text-muted-foreground">
          Non hai un account?{' '}
          <Link
            href="/signup"
            className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
          >
            Registrati gratis
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
