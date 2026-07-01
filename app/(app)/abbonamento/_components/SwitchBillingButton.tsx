'use client'

import { useTransition } from 'react'
import { Loader2, TrendingUp, Calendar } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { switchToAnnualAction } from '@/lib/actions/subscription'

interface SwitchBillingButtonProps {
  /** Intervallo di fatturazione corrente: 'month' | 'year' */
  billingInterval: string | null
  /** 'mobile' = bottone navy pieno (mockup card oro); default = outline desktop */
  variant?: 'mobile' | 'desktop'
}

/**
 * Passaggio MENSILE → ANNUALE (solo upgrade, monodirezionale).
 * Visibile solo per gli abbonamenti mensili. Apre il portale Stripe sul flusso
 * di conferma con il prezzo annuale già selezionato. Stripe gestisce la proration.
 * NB: il downgrade annuale → mensile non è offerto (scelta di prodotto).
 */
export function SwitchBillingButton({ billingInterval, variant = 'desktop' }: SwitchBillingButtonProps) {
  const [pending, startTransition] = useTransition()

  // Mostrato SOLO per gli abbonamenti mensili (upgrade ad annuale)
  if (billingInterval !== 'month') return null

  function handleSwitch() {
    startTransition(async () => {
      await switchToAnnualAction()
    })
  }

  if (variant === 'mobile') {
    return (
      <button
        onClick={handleSwitch}
        disabled={pending}
        style={{ width: '100%', background: '#1a1a2e', color: '#fff', borderRadius: 11, height: 46, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 600, marginTop: 12, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', cursor: 'pointer', opacity: pending ? 0.6 : 1 }}
      >
        {pending ? <Loader2 size={17} className="animate-spin" /> : <Calendar size={17} />}
        Passa all&rsquo;annuale
      </button>
    )
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
