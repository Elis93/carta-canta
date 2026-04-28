import type { Metadata } from 'next'
import Link from 'next/link'
import { Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Card, CardContent, CardDescription, CardHeader, CardTitle,
} from '@/components/ui/card'

export const metadata: Metadata = { title: 'Verifica email' }

export default function VerificaEmailPage() {
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

      <CardContent className="space-y-3">
        <p className="text-center text-sm text-muted-foreground">
          Non trovi la mail? Controlla anche la cartella <strong>spam</strong>.
        </p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Torna al login</Link>
        </Button>
      </CardContent>
    </Card>
  )
}
