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
      className="w-full flex items-center justify-center gap-2 text-white disabled:opacity-60"
      style={{ background: '#1a1a2e', borderRadius: 12, height: 50, boxSizing: 'border-box', boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', fontSize: 14, fontWeight: 600 }}
    >
      {pending ? <Loader2 size={18} className="animate-spin" /> : <Crown size={18} />}
      Passa a Pro
    </button>
  )
}
