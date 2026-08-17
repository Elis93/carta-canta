'use client'

// Card "Passa a Pro" (mobile, piano Free) con scelta Mensile/Annuale.
// FIX bug prezzo (5 lug): la card precedente mostrava "€ 182/anno" ma il
// bottone avviava il checkout col price MENSILE — prezzo promesso ≠ addebitato.
// Ora l'utente sceglie l'intervallo e il bottone dice e addebita esattamente quello.

import { useState, useTransition } from 'react'
import { createCheckoutSessionAction } from '@/lib/actions/subscription'
import { Check, Crown, Loader2 } from 'lucide-react'

const FEATURES = [
  'Preventivi e fatture illimitati',
  'Template illimitati e personalizzabili',
  'Nessuna filigrana sul PDF',
  'AI Import (foto → preventivo)',
  'Bilancio entrate/uscite mese per mese',
  'Preventivi con più proposte (Base/Premium)',
  'Profilo «In evidenza» nel marketplace',
]

export function MobileProCard({
  monthlyPriceId,
  yearlyPriceId,
}: {
  monthlyPriceId: string
  yearlyPriceId: string
}) {
  const [interval, setInterval] = useState<'month' | 'year'>('year')
  const [pending, startTransition] = useTransition()

  const isYear = interval === 'year'
  const priceId = isYear ? yearlyPriceId : monthlyPriceId
  const priceLabel = isYear ? '€ 182/anno' : '€ 19/mese'

  const pillBase: React.CSSProperties = {
    flex: 1, textAlign: 'center', padding: '8px 0', fontSize: 13,
    borderRadius: 999, border: 'none', background: 'transparent',
    color: '#55534b', cursor: 'pointer',
  }
  const pillActive: React.CSSProperties = {
    ...pillBase, background: '#fff', fontWeight: 600, color: '#1a1a2e',
    boxShadow: '0 1px 3px rgba(20,20,40,.12)',
  }

  return (
    <>
      <div
        style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '15px 15px', border: '1px solid #ecd9ad' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <Crown size={20} style={{ color: '#c9a44c' }} />
          <span style={{ fontSize: 17, fontWeight: 700, color: '#161616' }}>Passa a Pro</span>
        </div>

        {/* Selettore Mensile / Annuale */}
        <div style={{ display: 'flex', background: '#f2f2f4', borderRadius: 999, padding: '3px 4px', margin: '10px 0 2px' }}>
          <button type="button" style={isYear ? pillBase : pillActive} onClick={() => setInterval('month')}>
            Mensile €&nbsp;19
          </button>
          <button type="button" style={isYear ? pillActive : pillBase} onClick={() => setInterval('year')}>
            Annuale €&nbsp;182
          </button>
        </div>
        <div style={{ fontSize: 12, color: '#b08d3e', fontWeight: 600, margin: '8px 0 11px', minHeight: 15 }}>
          {isYear ? '2 mesi gratis rispetto al mensile (€\u00A019/mese)' : "Con l'annuale risparmi 2 mesi (€ 182 invece di € 228)"}
        </div>

        <div style={{ height: '0.5px', background: '#eee', margin: '0 -15px 8px' }} />
        {FEATURES.map((f) => (
          <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '6px 0', fontSize: 14, color: '#161616' }}>
            <Check size={17} style={{ color: '#2f8a63', flex: '0 0 auto' }} />
            {f}
          </div>
        ))}
      </div>

      <div style={{ padding: '0 15px', marginTop: 16 }}>
        <button
          disabled={pending || !priceId}
          onClick={() => priceId && startTransition(() => createCheckoutSessionAction(priceId, 'subscription'))}
          className="w-full flex items-center justify-center gap-2 text-white disabled:opacity-60"
          style={{ background: '#1a1a2e', borderRadius: 12, height: 50, boxSizing: 'border-box', boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', fontSize: 14, fontWeight: 600 }}
        >
          {pending ? <Loader2 size={18} className="animate-spin" /> : <Crown size={18} />}
          Passa a Pro — {priceLabel}
        </button>
      </div>
    </>
  )
}
