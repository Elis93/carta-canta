'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { signupAction } from '../actions'

export default function SignupPage() {
  const [state, formAction, isPending] = useActionState(signupAction, null)

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Crea il tuo account</CardTitle>
        <CardDescription>
          Gratis. Nessuna carta di credito richiesta.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction}>
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
                  disabled={isPending}
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
                  disabled={isPending}
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
                disabled={isPending}
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
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                required
                disabled={isPending}
              />
            </div>

            <Separator />

            {/* Nome workspace */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="workspace_name">
                Nome della tua attività
              </Label>
              <Input
                id="workspace_name"
                name="workspace_name"
                type="text"
                placeholder="Es. Idraulica Rossi"
                autoComplete="organization"
                required
                disabled={isPending}
              />
              <p className="text-xs text-muted-foreground">
                Puoi modificarlo in seguito dalle impostazioni.
              </p>
            </div>

            {state?.error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                {state.error}
              </p>
            )}

            <Button type="submit" className="w-full" size="lg" disabled={isPending}>
              {isPending && <Loader2 className="animate-spin" />}
              {isPending ? 'Creazione account…' : 'Crea account gratuito'}
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
