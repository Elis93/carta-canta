import { redirect } from 'next/navigation'
import Link from 'next/link'
import { KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { confirmRecoveryLinkAction } from '../../actions'

export const metadata = { title: 'Reimposta password' }

// Pagina-PONTE del link di recupero (21 ago). Il link dell'email atterra QUI
// senza consumare nulla: il token monouso si verifica solo quando l'utente
// tocca il bottone (POST della server action). Gli scanner della posta —
// Gmail compreso — aprono i link in GET per controllarli: prima bruciavano
// il token e il tocco umano trovava «otp_expired» anche su un link fresco.
export default async function VerificaResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string }>
}) {
  const { token_hash } = await searchParams
  if (!token_hash) redirect('/reset-password')

  return (
    <Card>
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Crea la nuova password</CardTitle>
        <CardDescription>
          Hai chiesto di reimpostare la password. Tocca il tasto per continuare:
          si apre il modulo dove scriverne una nuova.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={confirmRecoveryLinkAction} className="flex flex-col gap-4">
          <input type="hidden" name="token_hash" value={token_hash} />
          <Button type="submit" className="w-full" size="lg">
            <KeyRound className="size-4" /> Continua
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Non l&rsquo;hai chiesto tu? Ignora questa pagina e{' '}
            <Link href="/login" className="underline underline-offset-2 hover:text-foreground">
              torna al login
            </Link>
            : la tua password resta quella di sempre.
          </p>
        </form>
      </CardContent>
    </Card>
  )
}
