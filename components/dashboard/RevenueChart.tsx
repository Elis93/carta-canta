'use client'

import {
  Bar, BarChart, CartesianGrid,
  ResponsiveContainer, Tooltip, XAxis,
} from 'recharts'

export interface TrendPoint {
  label: string
  total: number
  count: number
}

interface TooltipRenderProps {
  active?: boolean
  payload?: Array<{ payload: TrendPoint }>
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
    <div className="rounded-lg border bg-background px-3 py-2 shadow-md text-xs">
      <p className="font-semibold mb-1 capitalize">{label}</p>
      <p className="text-foreground font-medium">{formatEur(point.total)}</p>
      <p className="text-muted-foreground mt-0.5">
        {point.count} preventiv{point.count === 1 ? 'o' : 'i'}
      </p>
    </div>
  )
}

export function RevenueChart({ data }: { data: TrendPoint[] }) {
  const hasData = data.some((d) => d.total > 0)

  if (!hasData) {
    return (
      <div className="flex items-center justify-center h-[160px] text-sm text-muted-foreground">
        Nessun dato ancora — i tuoi dati appariranno qui mese per mese.
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={160}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tick={{ fontSize: 11, fill: '#9ca3af' }}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: 'rgba(99,102,241,0.06)' }}
        />
        <Bar
          dataKey="total"
          fill="#6366f1"
          radius={[4, 4, 0, 0]}
          maxBarSize={48}
        />
      </BarChart>
    </ResponsiveContainer>
  )
}
