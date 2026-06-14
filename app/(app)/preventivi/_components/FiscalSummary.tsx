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
  docType?: 'preventivo' | 'fattura'
}

export function FiscalSummary({ voci, fiscalOpts, bonusEdilizio, docNumber, docType = 'preventivo' }: FiscalSummaryProps) {
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
    total: 0,
    ai_generated: false as boolean | null,
    ai_confidence: null as number | null,
  }))

  const fiscal = calcolaDocumento(itemsForCalc, fiscalOpts)
  const isForfettario = fiscalOpts.fiscal_regime === 'forfettario'
  const hasDiscount = fiscal.subtotal !== fiscal.afterDiscount

  const fmt = (v: number) =>
    v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  // Spazio non-breaking tra simbolo € e cifra (stesso standard del PDF)
  const curr = (v: number) => `€ ${fmt(v)}`

  // Subtotali per tipo bonus (mostra solo se bonus attivo e ci sono voci classificate)
  const trainanti = voci.filter((v) => v.bonus_tipo === 'trainante')
  const trainati  = voci.filter((v) => v.bonus_tipo === 'trainato')
  const hasBonusTipi = bonusEdilizio && (trainanti.length > 0 || trainati.length > 0)
  const calcSubtotale = (items: VoceItem[]) =>
    items.reduce((s, v) => s + v.quantity * v.unit_price * (1 - (v.discount_pct ?? 0) / 100), 0)

  return (
    <div className="cc-card-md" style={{ padding: '14px 15px' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="cc-section-label">Riepilogo</div>
        {docNumber && (
          <span className="text-xs font-mono text-muted-foreground">
            #{docNumber}
          </span>
        )}
      </div>
      <div className="flex justify-end">
        <div className="w-full max-w-xs space-y-2 text-sm">

          {/* Subtotale */}
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotale</span>
            <span>{curr(fiscal.subtotal)}</span>
          </div>

          {/* Sconto */}
          {hasDiscount && (
            <div className="flex justify-between text-muted-foreground">
              <span>Sconto</span>
              <span className="text-green-600">
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

          {/* Riepilogo bonus — subtotali trainante/trainato */}
          {hasBonusTipi && (
            <div className="border-t pt-2 mt-1 space-y-1">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Dettaglio bonus
              </p>
              {trainanti.length > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Trainanti ({trainanti.length})</span>
                  <span>{curr(calcSubtotale(trainanti))}</span>
                </div>
              )}
              {trainati.length > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Trainati ({trainati.length})</span>
                  <span>{curr(calcSubtotale(trainati))}</span>
                </div>
              )}
            </div>
          )}

          {/* Nota forfettario */}
          {isForfettario && (
            <div className="text-xs text-muted-foreground/70 border-t pt-2">
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
              <span className="text-amber-600">−{curr(fiscal.ritenuta)}</span>
            </div>
          )}

          {/* Totale */}
          <div className="flex justify-between font-bold text-base border-t pt-2">
            <span>{docType === 'fattura' ? 'Totale da pagare' : 'Totale'}</span>
            <span>{curr(fiscal.total)}</span>
          </div>

        </div>
      </div>
    </div>
  )
}
