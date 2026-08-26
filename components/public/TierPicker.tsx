'use client'

// ============================================================
// TierPicker — "Scegli la proposta che preferisci" (mockup cantiere §3.2)
// Card IMPILATE in verticale sulla pagina pubblica. Documenti nuovi:
// Base + Premium (F8); i vecchi a 3 livelli mostrano anche Consigliata.
// La scelta viene letta al momento dell'accettazione (window.__cc_tier,
// stesso pattern di window.__cc_doSave usato altrove nell'app).
// ============================================================

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

// 18 lug (Eli: "voglio che già veda le singole voci lì"): le card mostrano
// TUTTE le voci della proposta con il loro importo — prima solo le prime 4
// descrizioni, e per capire le differenze serviva il documento completo.
export interface PublicTierItem {
  description: string
  quantity: number
  unit: string
  unit_price: number
  total: number
  /** Sconto della singola voce (25 ago): il totale è già scontato, la % va detta. */
  discount_pct?: number | null
}

export interface PublicTier {
  tier: 'base' | 'consigliata' | 'premium'
  label: string
  total: number
  items: PublicTierItem[]
}

function fmtEuro(v: number): string {
  return `€\u00A0${v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Chiave di una voce: descrizione + importo. Due righe con la STESSA chiave in
 * tutte le proposte sono «uguali» e si spengono; il resto è ciò che cambia.
 * ⚠️ Serve anche l'importo, non solo la descrizione: «Manodopera 45 €» e
 * «Manodopera 90 €» hanno lo stesso nome ma sono proprio la differenza da
 * mostrare — confrontare le sole descrizioni le avrebbe spente entrambe.
 */
function chiaveVoce(it: PublicTierItem): string {
  return `${it.description.trim().toLowerCase()}|${it.total.toFixed(2)}`
}

export function TierPicker({ tiers, initialTier }: { tiers: PublicTier[]; initialTier?: string | null }) {
  // 19 lug (Eli): niente più "★ Consigliata" — parte selezionata la prima
  // proposta (la Base) e il cliente sceglie liberamente. ECCEZIONE (B4): sui
  // documenti LEGACY i cui totali seguono ancora la proposta stellata, il
  // riepilogo mostra "Totale proposta {X}"; per non contraddirlo, il picker
  // preseleziona quella stessa proposta se esiste ancora tra i tier.
  const preselect = tiers.find((t) => t.tier === initialTier)?.tier
  const [selected, setSelected] = useState<PublicTier['tier']>(
    preselect ?? tiers[0]?.tier ?? 'base'
  )

  const active = tiers.length >= 2

  // ── Cosa è UGUALE in tutte le proposte (mockup C, scelta di Eli 9 ago) ──
  // Il difetto di prima: le card elencavano le stesse voci con lo stesso
  // aspetto, e l'unica differenza vera era una riga come tutte le altre — il
  // cliente vedeva due prezzi senza capire cosa cambia, e sceglieva il più
  // basso. Ora l'uguale si spegne e il diverso resta in evidenza.
  // ⚠️ MULTISET, non Set: due righe IDENTICHE nella stessa proposta contano
  // due volte. Con un Set, «Manodopera 45 €» ×2 nella Base e ×1 nella Premium
  // spegneva ENTRAMBE le righe della Base — e i 45 € di differenza restavano
  // inspiegati sotto la scritta «in evidenza c'è solo quello che cambia».
  // `comuni` = per ogni chiave, il MINIMO numero di occorrenze fra tutte le
  // proposte: le prime N occorrenze si spengono, le eccedenti restano accese.
  const comuni = (() => {
    const min = new Map<string, number>()
    if (tiers.length < 2) return min
    tiers.forEach((t, idx) => {
      const conta = new Map<string, number>()
      for (const it of t.items) {
        const k = chiaveVoce(it)
        conta.set(k, (conta.get(k) ?? 0) + 1)
      }
      if (idx === 0) {
        for (const [k, n] of conta) min.set(k, n)
      } else {
        for (const k of min.keys()) {
          const n = conta.get(k) ?? 0
          if (n === 0) min.delete(k)
          else min.set(k, Math.min(min.get(k)!, n))
        }
      }
    })
    return min
  })()
  // ⚠️ Se le proposte non hanno NIENTE in comune, spegnere non aiuta: sarebbe
  // tutto in evidenza, cioè niente in evidenza. In quel caso le card restano
  // come prima, tutte leggibili allo stesso modo.
  const evidenziaDifferenze = comuni.size > 0

  // Delta rispetto alla proposta MENO cara: è il numero che il cliente sta
  // davvero decidendo se pagare.
  const minTotale = Math.min(...tiers.map((t) => t.total))

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
      {/* Card impilate in verticale (scelta Eli 14 lug): tutte le proposte
          visibili subito, niente carosello da scorrere */}
      <div role="radiogroup" aria-label="Proposte" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
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
                background: '#fff', borderRadius: 14,
                border: isSel ? '1.5px solid #c9a44c' : '1px solid #e7e7ea',
                boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)',
                padding: '13px 14px', cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#161616' }}>{t.label}</span>
                {t.total > minTotale && (
                  <span style={{ background: '#f5e9d0', color: '#b0863e', borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    + {fmtEuro(t.total - minTotale)}
                  </span>
                )}
              </div>
              <div style={{ fontSize: 19, fontWeight: 700, color: '#1a1a2e', marginTop: 6 }}>{fmtEuro(t.total)}</div>
              <div style={{ fontSize: 11, color: 'var(--cc-muted)', marginTop: 1 }}>IVA inclusa</div>
              <div style={{ fontSize: 12, color: '#55534b', lineHeight: 1.5, marginTop: 8 }}>
                {(() => { const viste = new Map<string, number>(); return t.items.map((it, i) => {
                  // Conta le occorrenze DENTRO questa proposta: solo le prime
                  // `comuni.get(k)` si spengono, le eccedenti restano accese.
                  const k = chiaveVoce(it)
                  const occorrenza = (viste.get(k) ?? 0)
                  viste.set(k, occorrenza + 1)
                  const uguale = evidenziaDifferenze && occorrenza < (comuni.get(k) ?? 0)
                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex', gap: 8, alignItems: 'flex-start',
                        padding: uguale ? '4px 0' : '7px 8px',
                        marginTop: uguale ? 0 : 2,
                        borderTop: i > 0 && uguale ? '0.5px solid #f0f0f0' : 'none',
                        background: uguale ? 'none' : '#faf7ef',
                        borderRadius: uguale ? 0 : 8,
                        color: uguale ? 'var(--cc-muted)' : '#161616',
                      }}
                    >
                      <span style={{ flex: 1, minWidth: 0, fontWeight: uguale ? 400 : 600 }}>
                        {it.description}
                        {(it.discount_pct ?? 0) > 0 && (
                          <span style={{ fontSize: 11.5, fontWeight: 600, color: '#2f8a63', whiteSpace: 'nowrap' }}>
                            {' '}Sconto&nbsp;−{Number(it.discount_pct).toLocaleString('it-IT')}%
                          </span>
                        )}
                        {it.quantity !== 1 && (
                          <span style={{ display: 'block', fontSize: 11, color: 'var(--cc-muted)', marginTop: 1, fontWeight: 400 }}>
                            {it.quantity.toLocaleString('it-IT', { maximumFractionDigits: 3 })}{it.unit ? ` ${it.unit}` : ''} × {fmtEuro(it.unit_price)}
                          </span>
                        )}
                      </span>
                      <span style={{ fontWeight: uguale ? 500 : 700, whiteSpace: 'nowrap' }}>{fmtEuro(it.total)}</span>
                    </div>
                  )
                }) })()}
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
      {evidenziaDifferenze && (
        <p style={{ fontSize: 12, color: 'var(--cc-muted)', textAlign: 'center', margin: '9px 0 0', lineHeight: 1.45 }}>
          In grigio quello che è uguale in tutte le proposte: in evidenza c&rsquo;è
          solo quello che cambia.
        </p>
      )}
      <p style={{ fontSize: 12, color: '#767676', textAlign: 'center', margin: '4px 0 0' }}>
        Scegli la proposta e poi conferma con &ldquo;Accetta e firma&rdquo;.
      </p>
    </div>
  )
}
