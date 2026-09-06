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
import { Avviso } from '@/components/shared/Avviso'

function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState(resetPasswordAction, null)
  const searchParams = useSearchParams()
  const urlError = searchParams.get('error')
  // Motivo tecnico restituito da Supabase (nessun dato personale): serve a
  // capire DAVVERO perché un link fresco viene rifiutato — senza, una
  // schermata fotografata dice solo «non valido» (collaudo Eli 21 ago).
  const motivo = searchParams.get('m')

  return (
    <>
      {/* Banner d'errore dalla pagina-ponte. ⚠️ Non tutti i fallimenti sono
          «link scaduto» (secondo ricontrollo 24 ago): il rate limit e un blip
          di rete lasciano il token ANCORA VALIDO — dire «richiedine uno nuovo»
          lì spingeva a invalidare un link buono e a sbattere nel limite dei
          60 secondi di Supabase. Basta riaprire il link dall'email. */}
      {urlError === 'link_scaduto' && (motivo === 'troppi_tentativi' || motivo === 'errore_di_rete') && (
        <Avviso gravita="attenzione" icon={<AlertCircle size={16} />} className="mb-4" sotto={motivo === 'troppi_tentativi'
          ? 'Il link è ancora valido, ma per sicurezza serve una pausa: aspetta qualche minuto e riapri il link dall’email più recente.'
          : 'La verifica non è arrivata a Supabase: il link è ancora valido. Riapri il link dall’email più recente e riprova.'}>
          <b>{motivo === 'troppi_tentativi' ? 'Troppi tentativi' : 'Connessione non riuscita'}</b>
        </Avviso>
      )}
      {urlError === 'link_scaduto' && motivo !== 'troppi_tentativi' && motivo !== 'errore_di_rete' && (
        <Avviso gravita="attenzione" icon={<AlertCircle size={16} />} className="mb-4" sotto={
          <>
            Ogni link di reset vale una sola volta e resta valido solo l&rsquo;ultimo
            ricevuto: se hai più email di reset in casella, apri la più recente.
            Altrimenti richiedine uno nuovo qui sotto.
            {motivo && (
              <p className="text-[11px] opacity-80 mt-1.5">
                Codice: {motivo}
              </p>
            )}
          </>
        }>
          <b>Link non più valido</b>
        </Avviso>
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
                placeholder="esempio: nome@dominio.it"
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
    // mx/mt: il layout (auth) non dà padding orizzontale (login e signup hanno
    // i loro margini inline) → senza, la card tocca i bordi dello schermo.
    <Card className="mx-4 mt-8">
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
