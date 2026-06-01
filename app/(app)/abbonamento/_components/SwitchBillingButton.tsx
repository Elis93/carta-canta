'use client'

import { useTransition } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createPortalSessionAction } from '@/lib/actions/subscription'

interface SwitchBillingButtonProps {
  /** Intervallo di fatturazione corrente: 'month' | 'year' */
  billingInterval: string | null
}

/**
 * Apre il portale Stripe direttamente sul flusso di cambio piano
 * (mensile ⇄ annuale). Stripe gestisce la proration automaticamente.
 */
export function SwitchBillingButton({ billingInterval }: SwitchBillingButtonProps) {
  const [pending, startTransition] = useTransition()

  // Mostriamo il bottone solo per abbonamenti ricorrenti (mensile/annuale)
  if (billingInterval !== 'month' && billingInterval !== 'year') return null

  const label = billingInterval === 'month'
    ? 'Passa alla fatturazione annuale (risparmia)'
    : 'Passa alla fatturazione mensile'

  function handleSwitch() {
    startTransition(async () => {
      await createPortalSessionAction({ switchPlan: true })
    })
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSwitch}
      disabled={pending}
    >
      {pending ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
      {label}
    </Button>
  )
}
