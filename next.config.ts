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
  // @react-pdf/renderer usa API browser (canvas, blob) e non può essere
  // bundlato per il server. Questo istruisce Next.js a trattarlo come
  // dipendenza esterna anziché bundlarla nel bundle server-side.
  serverExternalPackages: ['@react-pdf/renderer'],

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
