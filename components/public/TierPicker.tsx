'use client'

// ============================================================
// TierPicker — "Scegli la proposta che preferisci" (mockup cantiere §3.2)
// Card scorrevoli Base / Consigliata / Premium sulla pagina pubblica.
// La scelta viene letta al momento dell'accettazione (window.__cc_tier,
// stesso pattern di window.__cc_doSave usato altrove nell'app).
// ============================================================

import { useEffect, useState } from 'react'
import { Check, Star } from 'lucide-react'

export interface PublicTier {
  tier: 'base' | 'consigliata' | 'premium'
  label: string
  total: number
  items: string[]
  recommended: boolean
}

function fmtEuro(v: number): string {
  return `€ ${v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function TierPicker({ tiers }: { tiers: PublicTier[] }) {
  const [selected, setSelected] = useState<PublicTier['tier']>(
    tiers.find((t) => t.recommended)?.tier ?? tiers[0]?.tier ?? 'base'
  )

  const active = tiers.length >= 2

  useEffect(() => {
    // Con meno di 2 proposte il picker non è visibile: non deve nemmeno
    // esporre la scelta, altrimenti l'accettazione invierebbe un tier
    // che il cliente non ha mai visto.
    if (!active) return
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- canale col flusso di accettazione
    ;(window as any).__cc_tier = selected
    return () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      delete (window as any).__cc_tier
    }
  }, [selected, active])

  if (!active) return null

  return (
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, color: '#161616', margin: '2px 2px 10px' }}>
        Scegli la proposta che preferisci
      </div>
      <div role="radiogroup" aria-label="Proposte" style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6, WebkitOverflowScrolling: 'touch' }}>
        {tiers.map((t) => {
          const isSel = selected === t.tier
          return (
            <div
              key={t.tier}
              onClick={() => setSelected(t.tier)}
              role="radio"
              aria-checked={isSel}
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelected(t.tier) } }}
              style={{
                flex: '0 0 auto', width: 200, background: '#fff', borderRadius: 14,
                border: isSel ? '1.5px solid #c9a44c' : '1px solid #e7e7ea',
                boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)',
                padding: '13px 14px', cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#161616' }}>{t.label}</div>
                {t.recommended && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, border: '1px solid #e8d6ad', background: '#fff', color: '#b0863e', fontSize: 11, fontWeight: 700, borderRadius: 999, padding: '2px 7px', whiteSpace: 'nowrap' }}>
                    <Star size={10} fill="#b0863e" /> Consigliata
                  </span>
                )}
              </div>
              <div style={{ fontSize: 19, fontWeight: 700, color: '#1a1a2e', marginTop: 6 }}>{fmtEuro(t.total)}</div>
              <div style={{ fontSize: 11, color: '#8a887f', marginTop: 1 }}>IVA inclusa</div>
              <div style={{ fontSize: 12, color: '#55534b', lineHeight: 1.65, marginTop: 8 }}>
                {t.items.slice(0, 4).map((desc, i) => (
                  <div key={i} style={{ display: 'flex', gap: 5 }}>
                    <Check size={12} style={{ color: '#2f8a63', flexShrink: 0, marginTop: 3 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{desc}</span>
                  </div>
                ))}
                {t.items.length > 4 && (
                  <div style={{ color: '#8a887f', marginTop: 2 }}>+{t.items.length - 4} altre voci</div>
                )}
              </div>
              <div
                style={{
                  marginTop: 10, height: 36, borderRadius: 10, fontSize: 12, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  background: isSel ? '#1a1a2e' : '#fff',
                  color: isSel ? '#fff' : '#1a1a2e',
                  border: isSel ? 'none' : '1px solid #e7e7ea',
                }}
              >
                {isSel ? <><Check size={13} /> Scelta</> : 'Scegli questa'}
              </div>
            </div>
          )
        })}
      </div>
      <p style={{ fontSize: 12, color: '#767676', textAlign: 'center', margin: '4px 0 0' }}>
        Scorri per vedere tutte le proposte → poi conferma con &ldquo;Accetta e firma&rdquo;.
      </p>
    </div>
  )
}
