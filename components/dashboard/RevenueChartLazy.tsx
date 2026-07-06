'use client'

// PERF (fase 3): recharts pesa ~170 KB e serviva solo per il grafico della
// Home. Import dinamico senza SSR: la pagina arriva subito, il grafico si
// idrata un attimo dopo (con placeholder shimmer della stessa altezza).

import dynamic from 'next/dynamic'

export const RevenueChartLazy = dynamic(
  () => import('./RevenueChart').then((m) => m.RevenueChart),
  {
    ssr: false,
    loading: () => (
      <div
        className="animate-pulse"
        style={{ height: 300, borderRadius: 12, background: '#f2f2f4' }}
        aria-hidden
      />
    ),
  }
)
