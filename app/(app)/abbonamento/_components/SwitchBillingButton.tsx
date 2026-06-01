'use client'

import { useTransition } from 'react'
import { Loader2, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { switchToAnnualAction } from '@/lib/actions/subscription'

interface SwitchBillingButtonProps {
  /** Intervallo di fatturazione corrente: 'month' | 'year' */
  billingInterval: string | null
}

/**
 * Passaggio MENSILE → ANNUALE (solo upgrade, monodirezionale).
 * Visibile solo per gli abbonamenti mensili. Apre il portale Stripe sul flusso
 * di conferma con il prezzo annuale già selezionato. Stripe gestisce la proration.
 * NB: il downgrade annuale → mensile non è offerto (scelta di prodotto).
 */
export function SwitchBillingButton({ billingInterval }: SwitchBillingButtonProps) {
  const [pending, startTransition] = useTransition()

  // Mostrato SOLO per gli abbonamenti mensili (upgrade ad annuale)
  if (billingInterval !== 'month') return null

  function handleSwitch() {
    startTransition(async () => {
      await switchToAnnualAction()
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSwitch}
      disabled={pending}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <TrendingUp className="size-4" />}
      Passa alla fatturazione annuale (risparmia)
    </Button>
  )
}
