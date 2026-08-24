import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { confirmRecoveryLinkAction } from '../../actions'
import { ContinuaButton } from './ContinuaButton'

// Il percorso porta un segreto in cookie: mai indicizzare.
export const metadata = { title: 'Reimposta password', robots: { index: false, follow: false } }

// Pagina-PONTE del link di recupero (21 ago, rivista il 24). Il link
// dell'email atterra QUI senza consumare nulla: il token monouso vive in un
// COOKIE httpOnly scritto da /auth/confirm (mai nell'URL: un segreto nella
// query di una pagina finirebbe in cronologia, referer e statistiche) e si
// verifica solo quando l'utente tocca il bottone (POST della server action).
// Gli scanner della posta — Gmail compreso — aprono i link in GET per
// controllarli: prima bruciavano il token e il tocco umano trovava
// «otp_expired» anche su un link fresco.
export default async function VerificaResetPage() {
  const cookieStore = await cookies()
  // Senza il cookie (link già usato, scaduto da più di 10 minuti, o pagina
  // riaperta dalla cronologia) non c'è niente da verificare: si torna alla
  // richiesta, col banner che spiega.
  if (!cookieStore.get('cc_recovery_token')?.value) {
    redirect('/reset-password?error=link_scaduto')
  }

  return (
    <Card className="mx-4 mt-8">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Crea la nuova password</CardTitle>
        <CardDescription>
          Hai chiesto di reimpostare la password. Tocca il tasto per continuare:
          si apre il modulo dove scriverne una nuova.
          {' '}Se hai richiesto più link, <b>vale solo quello dell&rsquo;email più
          recente</b>: gli altri sono stati annullati.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={confirmRecoveryLinkAction} className="flex flex-col gap-4">
          <ContinuaButton />
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
