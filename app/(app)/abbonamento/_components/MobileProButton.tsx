'use client'

import { useTransition } from 'react'
import { createCheckoutSessionAction } from '@/lib/actions/subscription'
import { Crown, Loader2 } from 'lucide-react'

export function MobileProButton({ priceId }: { priceId: string }) {
  const [pending, startTransition] = useTransition()
  return (
    <button
      disabled={pending || !priceId}
      onClick={() => priceId && startTransition(() => createCheckoutSessionAction(priceId, 'subscription'))}
      className="w-full flex items-center justify-center gap-2 rounded-[9px] py-3.5 text-white disabled:opacity-60"
      style={{ background: '#1a1a2e', boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', fontSize: 14, fontWeight: 500 }}
    >
      {pending ? <Loader2 size={16} className="animate-spin" /> : <Crown size={16} />}
      Passa a Pro
    </button>
  )
}
