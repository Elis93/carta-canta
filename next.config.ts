import type { NextConfig } from 'next'

const securityHeaders = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // La UI dichiara "max 2MB"; il default Next.js è 1MB — insufficiente
      // per loghi PNG che sono spesso 1-3MB (compressione lossless).
      // Impostiamo 4MB per avere margine senza rischi di memory pressure.
      bodySizeLimit: '4mb',
    },
    // PERF (feedback Eli 5 lug): il router client riusa per 30s le pagine
    // dinamiche gia' visitate -> tornare indietro / rivisitare una lista e'
    // istantaneo invece di rifare tutte le query. I dati si riallineano con
    // i router.refresh() gia' presenti dopo le azioni.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  async headers() {
    return [
      {
        // Tutte le route: applica gli header di sicurezza completi (X-Frame-Options: DENY)
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // Route PDF pubbliche e private: sovrascrive X-Frame-Options con SAMEORIGIN
        // per permettere l'embedding nell'iframe della pagina pubblica /p/[token]
        source: '/api/:path*/pdf',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
        ],
      },
    ]
  },
}

export default nextConfig
