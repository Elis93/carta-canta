'use client'

import { Suspense, useActionState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { OAuthButtons } from '@/components/shared/OAuthButtons'
import { loginAction } from '../actions'

function LoginForm({ redirectTo }: { redirectTo: string }) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(loginAction, null)

  useEffect(() => {
    if (state?.success) router.push(state.success)
  }, [state, router])

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
          <PasswordInput
            id="password"
            name="password"
            autoComplete="current-password"
            required
            disabled={isPending}
          />
        </div>

        {state?.error && (
          <div className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg space-y-1">
            <p>{state.error}</p>
            {state.suggestSignup ? (
              <p className="text-xs text-destructive/80">
                <Link href="/signup" className="font-medium underline underline-offset-2">
                  Registrati gratis →
                </Link>
              </p>
            ) : (
              <p className="text-xs text-destructive/80">
                <Link href="/reset-password" className="underline underline-offset-2">
                  Hai dimenticato la password?
                </Link>
              </p>
            )}
          </div>
        )}

        <Button type="submit" className="w-full" size="lg" disabled={isPending}>
          {isPending && <Loader2 className="animate-spin" />}
          {isPending ? 'Accesso in corso…' : 'Accedi'}
        </Button>
      </div>
    </form>
  )
}

function LoginPageContent() {
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect') || '/dashboard'
  const errorParam = searchParams.get('error')

  return (
    <>
      {/* Logo grande — solo mobile */}
      <div className="lg:hidden flex justify-center mb-2">
        <svg viewBox="0 80 760 300" xmlns="http://www.w3.org/2000/svg"
          style={{ display: 'block', width: '100%', maxWidth: 340, height: 'auto' }}>
          <g transform="translate(305,78) scale(0.293)">
            <rect width="512" height="512" rx="112" fill="#1a1a2e"/>
            <path d="M342 133 A150 150 0 1 0 342 379" fill="none" stroke="#c9a44c" strokeWidth="38" strokeLinecap="round"/>
            <path d="M307 175 A96 96 0 1 0 307 337" fill="none" stroke="#f3ede0" strokeWidth="30" strokeLinecap="round"/>
          </g>
          <text x="380" y="300" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="56" fill="#1a1a2e">
            {'Carta '}
            <tspan fill="#c9a44c">Canta</tspan>
          </text>
          <rect x="310" y="324" width="140" height="1.4" fill="#dcd3bf"/>
          <text x="380" y="368" textAnchor="middle" fontFamily="Georgia, 'Times New Roman', serif" fontSize="28" fontStyle="italic" fill="#b08d3e">
            il tuo ufficio in tasca
          </text>
        </svg>
      </div>

      <Card className="border-0 shadow-none lg:border lg:shadow-sm">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Bentornato</CardTitle>
        <CardDescription>Accedi al tuo account Carta Canta</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Errori da query param (link scaduto, OAuth fallito) */}
        {errorParam === 'link_scaduto' && (
          <p className="mb-4 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
            Il link di conferma è scaduto o non è più valido.
            Accedi per riceverne uno nuovo.
          </p>
        )}
        {errorParam === 'oauth_failed' && (
          <p className="mb-4 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
            Accesso con Google non riuscito. Riprova o usa email e password.
          </p>
        )}

        {/* OAuth */}
        <OAuthButtons />

        {/* Divider */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="bg-card px-2 text-muted-foreground">oppure continua con email</span>
          </div>
        </div>

        {/* Form email/password */}
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
    </>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageContent />
    </Suspense>
  )
}
