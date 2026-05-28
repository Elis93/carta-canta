'use client'

import { useActionState } from 'react'
import Link from 'next/link'
import { Mail, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'
import { resendVerificationEmailAction } from '@/app/(auth)/actions'

export default function VerificaEmailPage() {
  const [state, action, pending] = useActionState(resendVerificationEmailAction, null)

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-primary/10">
          <Mail className="size-6 text-primary" />
        </div>
        <CardTitle className="text-xl">Controlla la tua email</CardTitle>
        <CardDescription>
          Abbiamo inviato un link di conferma al tuo indirizzo.
          Clicca il link per attivare l&apos;account e completare l&apos;iscrizione.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-center text-sm text-muted-foreground">
          Non vedi la mail? Controlla la cartella spam o posta indesiderata.
        </p>

        {/* Resend section */}
        {state?.success ? (
          <p className="rounded-md bg-green-50 px-4 py-3 text-center text-sm text-green-700">
            {state.success}
          </p>
        ) : (
          <form action={action} className="space-y-2">
            <Input
              type="email"
              name="email"
              placeholder="La tua email"
              required
              className="text-center"
            />
            {state?.error && (
              <p className="text-center text-sm text-destructive">{state.error}</p>
            )}
            <Button
              type="submit"
              variant="outline"
              className="w-full"
              disabled={pending}
            >
              <RefreshCw className={`mr-2 size-4 ${pending ? 'animate-spin' : ''}`} />
              {pending ? 'Invio in corso…' : 'Rinvia email di verifica'}
            </Button>
          </form>
        )}

        <Button asChild variant="ghost" className="w-full">
          <Link href="/login">Torna al login</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
