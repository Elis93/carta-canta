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
  // Dipendenze con binari nativi o non-bundlabili: trattate come esterne dal
  // server-side bundle. playwright-core e @sparticuz/chromium usano binari
  // nativi e path lookup a runtime — non devono essere bundlati da webpack.
  serverExternalPackages: ['@react-pdf/renderer', 'playwright-core', '@sparticuz/chromium'],

  // Il file tracer di Next.js/Vercel non include file non-JS come
  // playwright-core/browsers.json (richiesto da coreBundle.js all'avvio del modulo).
  // Includiamo esplicitamente tutti i file dei pacchetti Playwright/Chromium
  // nei route che generano PDF, altrimenti il Lambda crasha prima di entrare
  // nell'handler e restituisce HTML invece di JSON.
  outputFileTracingIncludes: {
    '/api/documents/[id]/send-email': [
      './node_modules/playwright-core/**',
      './node_modules/@sparticuz/chromium/**',
    ],
    '/api/documents/[id]/pdf': [
      './node_modules/playwright-core/**',
      './node_modules/@sparticuz/chromium/**',
    ],
  },

  experimental: {
    serverActions: {
      // La UI dichiara "max 2MB"; il default Next.js è 1MB — insufficiente
      // per loghi PNG che sono spesso 1-3MB (compressione lossless).
      // Impostiamo 4MB per avere margine senza rischi di memory pressure.
      bodySizeLimit: '4mb',
    },
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
