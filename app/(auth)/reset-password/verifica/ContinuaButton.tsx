'use client'

// Bottone della pagina-ponte con stato di caricamento (revisione 24 ago):
// senza, tra il tocco e la navigazione non succedeva NULLA a schermo — su
// rete mobile sono secondi — e il secondo tocco istintivo bruciava il token
// appena verificato (e chiudeva la sessione appena creata). useFormStatus
// disabilita il tasto per tutta la durata del POST.

import { useFormStatus } from 'react-dom'
import { KeyRound, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function ContinuaButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" className="w-full" size="lg" disabled={pending}>
      {pending ? <Loader2 className="size-4 animate-spin" /> : <KeyRound className="size-4" />}
      {pending ? 'Verifica in corso…' : 'Continua'}
    </Button>
  )
}
