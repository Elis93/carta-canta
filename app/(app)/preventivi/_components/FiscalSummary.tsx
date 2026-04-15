'use client'

import { calcolaDocumento } from '@/lib/fiscal/calcoli'
import type { FiscalOptions } from '@/types/index'
import type { VoceItem } from './PreventivoForm'

interface FiscalSummaryProps {
  voci: VoceItem[]
  fiscalOpts: FiscalOptions
}

export function FiscalSummary({ voci, fiscalOpts }: FiscalSummaryProps) {
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
    total: 0,
    ai_generated: false as boolean | null,
    ai_confidence: null as number | null,
  }))

  const fiscal = calcolaDocumento(itemsForCalc, fiscalOpts)
  const isForfettario = fiscalOpts.fiscal_regime === 'forfettario'
  const hasDiscount = fiscal.subtotal !== fiscal.afterDiscount

  const fmt = (n: number) =>
    n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  return (
    <div className="rounded-lg border bg-card p-4 md:p-5">
      <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide mb-4">
        Riepilogo
      </h2>
      <div className="flex justify-end">
        <div className="w-full max-w-xs space-y-2 text-sm">

          {/* Subtotale */}
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotale</span>
            <span>€{fmt(fiscal.subtotal)}</span>
          </div>

          {/* Sconto */}
          {hasDiscount && (
            <div className="flex justify-between text-muted-foreground">
              <span>Sconto</span>
              <span className="text-green-600">
                −€{fmt(fiscal.subtotal - fiscal.afterDiscount)}
              </span>
            </div>
          )}

          {/* Imponibile (se c'è sconto) */}
          {hasDiscount && (
            <div className="flex justify-between text-muted-foreground">
              <span>Imponibile</span>
              <span>€{fmt(fiscal.afterDiscount)}</span>
            </div>
          )}

          {/* IVA */}
          {!isForfettario && fiscal.taxAmount > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>IVA</span>
              <span>€{fmt(fiscal.taxAmount)}</span>
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
              <span>€{fmt(fiscal.bollo)}</span>
            </div>
          )}

          {/* Ritenuta */}
          {fiscal.ritenuta > 0 && (
            <div className="flex justify-between text-muted-foreground">
              <span>Ritenuta d&apos;acconto</span>
              <span className="text-amber-600">−€{fmt(fiscal.ritenuta)}</span>
            </div>
          )}

          {/* Totale */}
          <div className="flex justify-between font-bold text-base border-t pt-2">
            <span>Totale</span>
            <span>€{fmt(fiscal.total)}</span>
          </div>

        </div>
      </div>
    </div>
  )
}
