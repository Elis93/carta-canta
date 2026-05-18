'use client'

import {
  Bar, BarChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis,
} from 'recharts'

export interface TrendPoint {
  label:     string
  total:     number   // valore preventivi accettati
  count:     number   // conteggio preventivi accettati
  totalAll?: number   // valore tutti i preventivi creati
  countAll?: number   // conteggio tutti i preventivi creati
}

interface TooltipRenderProps {
  active?: boolean
  payload?: Array<{ payload: TrendPoint; dataKey: string; color: string }>
  label?: string
}

function formatEur(v: number) {
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    maximumFractionDigits: 0,
  }).format(v)
}

function CustomTooltip({ active, payload, label }: TooltipRenderProps) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload
  if (!point) return null
  return (
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs space-y-1.5">
      <p className="font-semibold capitalize">{label}</p>
      <div className="flex items-center gap-1.5">
        <span className="inline-block size-2 rounded-full bg-indigo-500 shrink-0" />
        <span className="text-foreground font-medium">{formatEur(point.total)}</span>
        <span className="text-muted-foreground">accettati ({point.count})</span>
      </div>
      {point.totalAll !== undefined && point.totalAll > 0 && (
        <div className="flex items-center gap-1.5">
          <span className="inline-block size-2 rounded-full bg-indigo-200 shrink-0" />
          <span className="text-muted-foreground">{formatEur(point.totalAll)}</span>
          <span className="text-muted-foreground">creati ({point.countAll ?? 0})</span>
        </div>
      )}
    </div>
  )
}

export function RevenueChart({ data }: { data: TrendPoint[] }) {
  const hasData = data.some((d) => d.total > 0 || (d.totalAll ?? 0) > 0)

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[160px] text-sm text-muted-foreground">
        Nessun dato ancora — i tuoi dati appariranno qui mese per mese.
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 11, fill: '#9ca3af' }}
          />
          <Tooltip
            content={<CustomTooltip />}
            cursor={{ fill: 'rgba(99,102,241,0.04)' }}
          />
          {/* Barra sfondo: totale creati (più trasparente) */}
          <Bar
            dataKey="totalAll"
            fill="#c7d2fe"
            radius={[3, 3, 0, 0]}
            maxBarSize={44}
          />
          {/* Barra principale: solo accettati */}
          <Bar
            dataKey="total"
            fill="#6366f1"
            radius={[3, 3, 0, 0]}
            maxBarSize={44}
          />
        </BarChart>
      </ResponsiveContainer>
      {/* Legenda */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-indigo-500" />
          Valore preventivi accettati
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-indigo-200" />
          Totale preventivi creati
        </span>
      </div>
    </div>
  )
}
