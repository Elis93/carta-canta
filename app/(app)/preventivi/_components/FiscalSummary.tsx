'use client'

import { calcolaDocumento } from '@/lib/fiscal/calcoli'
import type { FiscalOptions } from '@/types/index'
import type { VoceItem } from './PreventivoForm'

interface FiscalSummaryProps {
  voci: VoceItem[]
  fiscalOpts: FiscalOptions
  bonusEdilizio?: string
  /** Numero documento (es. '001/2026'). Mostrato nell'intestazione del riepilogo se presente. */
  docNumber?: string | null
  docType?: 'preventivo' | 'fattura' | 'nota_credito' | 'nota_debito'
  /** Slot per i campi sconto — renderizzato all'interno della card Riepilogo */
  discountSlot?: React.ReactNode
  /**
   * Con «Proponi più opzioni» attivo: nome della proposta a cui si riferiscono
   * QUESTI totali (es. "Base"). Senza, il numero resta anonimo e non si capisce
   * di quale proposta sia (Eli, 7 ago).
   */
  tierLabel?: string | null
  /** Le altre proposte, per vedere i due totali senza cambiare linguetta. */
  altreProposte?: Array<{ label: string; total: number }>
}

export function FiscalSummary({ voci, fiscalOpts, docNumber, docType = 'preventivo', discountSlot, tierLabel, altreProposte }: FiscalSummaryProps) {
  // Calcolo real-time client-side (solo per display — server ricalcola al salvataggio)
  const itemsForCalc = voci.map((v) => ({
    id: v.id ?? '',
    document_id: '',
    sort_order: v.sort_order,
    description: v.description,
    unit: v.unit,
    quantity: v.quantity,
    unit_price: v.unit_price,
    discount_pct: v.discount_pct,
    vat_rate: v.vat_rate,
    bonus_tipo: v.bonus_tipo ?? null,
    bene_significativo: v.bene_significativo ?? null,
    total: 0,
    ai_generated: false as boolean | null,
    ai_confidence: null as number | null,
  }))

  const fiscal = calcolaDocumento(itemsForCalc, fiscalOpts)
  const isForfettario = fiscalOpts.fiscal_regime === 'forfettario'
  const hasDiscount = fiscal.subtotal !== fiscal.afterDiscount

  // ── Sconti in chiaro (Eli, 17 ago: «visualizzare in modo chiaro sia gli
  // sconti applicati alle singole voci che quelli totali finali») ──────────
  // SOLO visualizzazione: i numeri vengono dagli stessi output del motore
  // (regola F — calcoli.ts non si tocca). Il «prezzo pieno» è la somma delle
  // voci SENZA lo sconto di voce, arrotondata per riga come fa il motore.
  const round2 = (v: number) => Math.round((v + Number.EPSILON) * 100) / 100
  const prezzoPieno = round2(itemsForCalc.reduce(
    (s, it) => s + round2(it.quantity * it.unit_price), 0
  ))
  const scontoVoci = round2(prezzoPieno - fiscal.subtotal)
  const scontoDoc = round2(fiscal.subtotal - fiscal.afterDiscount)
  const scontoTotale = round2(scontoVoci + scontoDoc)

  const fmt = (v: number) =>
    v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Spazio non-breaking tra simbolo € e cifra (stesso standard del PDF)
  const curr = (v: number) => `€ ${fmt(v)}`


  return (
    <div className="cc-card-md" style={{ padding: '14px 15px' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="cc-section-label">
          {tierLabel ? `Riepilogo — proposta ${tierLabel}` : 'Riepilogo'}
        </div>
        {docNumber && (
          <span className="text-xs font-mono text-muted-foreground">
            #{docNumber}
          </span>
        )}
      </div>
      {/* ── Lista voci LIVE (2 ago sera, Eli: "nel riepilogo voglio vedere le
          voci aggiunte, così controllo al volo descrizioni e prezzi") ──
          Si aggiorna a ogni modifica: stessa fonte dei totali qui sotto. */}
      {(() => {
        const meaningful = voci
          .map((v, i) => ({ v, tot: fiscal.itemTotals[i]?.total ?? 0 }))
          .filter(({ v }) => v.description.trim() !== '' || (v.unit_price ?? 0) > 0 || (v.quantity ?? 0) > 0)
        if (meaningful.length === 0) return null
        return (
          <div style={{ borderBottom: '0.5px solid var(--cc-border-color)', marginBottom: 10, paddingBottom: 8 }}>
            {meaningful.map(({ v, tot }, i) => (
              <div key={v.id ?? `r-${i}`} className="flex justify-between items-baseline" style={{ gap: 10, padding: '3px 0' }}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, color: '#55534b' }}>
                  {v.description.trim() || <i style={{ color: 'var(--cc-muted)' }}>Voce senza descrizione</i>}
                  {v.quantity > 0 && (
                    <span style={{ color: 'var(--cc-muted)' }}>
                      {' '}· {v.quantity.toLocaleString('it-IT')} {v.unit}
                    </span>
                  )}
                </span>
                {/* Sconto della SINGOLA voce, in chiaro (Eli, 17 ago): il
                    totale di riga è già scontato, ma senza questa nota lo
                    sconto dato sulla voce non si vedeva da nessuna parte.
                    FUORI dallo span troncabile: dentro, con una descrizione
                    lunga, l'ellissi si mangiava proprio la percentuale. */}
                {(v.discount_pct ?? 0) > 0 && (
                  <span style={{ flexShrink: 0, fontSize: 12, fontWeight: 700, color: '#2f8a63', whiteSpace: 'nowrap' }}>
                    −{(v.discount_pct as number).toLocaleString('it-IT')}%
                  </span>
                )}
                <span style={{ fontSize: 13, fontWeight: 600, color: '#161616', whiteSpace: 'nowrap' }}>{curr(tot)}</span>
              </div>
            ))}
          </div>
        )
      })()}

      <div className="space-y-2 text-sm">

          {/* Con sconti sulle voci: prima il conto INTERO, poi quanto è stato
              scontato voce per voce, poi il Subtotale — così i tre numeri si
              seguono senza fare i conti a mente (Eli, 17 ago). Senza sconti
              di voce le due righe non compaiono e resta il solo Subtotale. */}
          {scontoVoci > 0 && (
            <>
              <div className="flex justify-between text-muted-foreground">
                <span>Totale senza sconti</span>
                <span>{curr(prezzoPieno)}</span>
              </div>
              <div className="flex justify-between text-muted-foreground">
                <span>Sconti sulle voci</span>
                <span className="text-[#2f8a63]">−{curr(scontoVoci)}</span>
              </div>
            </>
          )}

          {/* Subtotale */}
          <div className="flex justify-between">
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--cc-muted)' }}>Subtotale</span>
            <span>{curr(fiscal.subtotal)}</span>
          </div>

          {/* Sconto a mano dell'artigiano — SUBITO sotto il Subtotale (Eli 15
              ago, #3): «Subtotale → possibilità di sconto → Imponibile → IVA →
              Totale». Compatto (un campo + interruttore %/€, in DiscountField). */}
          {discountSlot && (
            <div style={{ padding: '2px 0' }}>{discountSlot}</div>
          )}

          {/* Sconto sul documento — «sul totale» per distinguerlo dagli
              sconti delle singole voci qui sopra */}
          {hasDiscount && (
            <div className="flex justify-between text-muted-foreground">
              <span>Sconto sul totale</span>
              <span className="text-[#2f8a63]">
                −{curr(fiscal.subtotal - fiscal.afterDiscount)}
              </span>
            </div>
          )}

          {/* Imponibile (se c'è sconto) */}
          {hasDiscount && (
            <div className="flex justify-between text-muted-foreground">
              <span>Imponibile</span>
              <span>{curr(fiscal.afterDiscount)}</span>
            </div>
          )}

          {/* IVA */}
          {!isForfettario && fiscal.taxAmount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>IVA</span>
              <span>{curr(fiscal.taxAmount)}</span>
            </div>
          )}


          {/* Nota forfettario */}
          {isForfettario && (
            <div className="text-[12px] border-t pt-2" style={{ color: '#767676' }}>
              Regime forfettario — operazione fuori campo IVA
            </div>
          )}

          {/* Bollo */}
          {fiscal.bollo > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Marca da bollo</span>
              <span>{curr(fiscal.bollo)}</span>
            </div>
          )}

          {/* Ritenuta */}
          {fiscal.ritenuta > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Ritenuta d&apos;acconto</span>
              <span className="text-[#b0863e]">−{curr(fiscal.ritenuta)}</span>
            </div>
          )}

          {/* Totale */}
          <div className="flex justify-between font-bold text-base border-t pt-2">
            <span>
              {docType === 'nota_credito'
                // Sulla nota il denaro TORNA al cliente: mai «da pagare»
                ? 'Totale della nota'
                : docType === 'fattura'
                ? 'Totale da pagare'
                : tierLabel ? `Totale ${tierLabel}` : 'Totale'}
            </span>
            <span>{curr(fiscal.total)}</span>
          </div>

          {/* Sconto COMPLESSIVO (voci + totale) — solo quando ci sono
              entrambi: con un solo tipo di sconto la sua riga dice già tutto
              e questa sarebbe un doppione. La % è sul prezzo pieno. */}
          {scontoVoci > 0 && scontoDoc > 0 && prezzoPieno > 0 && (
            <div className="flex justify-between" style={{ fontSize: 12.5, color: '#2f8a63' }}>
              <span>Sconto complessivo</span>
              <span style={{ fontWeight: 600 }}>
                −{curr(scontoTotale)} · {(scontoTotale / prezzoPieno * 100).toLocaleString('it-IT', { maximumFractionDigits: 1 })}%
              </span>
            </div>
          )}

          {/* L'altra proposta, senza dover cambiare linguetta: con due totali
              a confronto si vede subito quanto costa la scelta. */}
          {altreProposte && altreProposte.length > 0 && (
            <div style={{ borderTop: '0.5px solid var(--cc-border-color)', paddingTop: 8, marginTop: 2 }}>
              {altreProposte.map((p) => (
                <div key={p.label} className="flex justify-between" style={{ fontSize: 13, color: 'var(--cc-muted)' }}>
                  <span>Totale {p.label}</span>
                  <span style={{ fontWeight: 600 }}>{curr(p.total)}</span>
                </div>
              ))}
            </div>
          )}

      </div>
    </div>
  )
}
