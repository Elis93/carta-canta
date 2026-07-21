import type { NextConfig } from 'next'

// Content-Security-Policy (audit sicurezza 20 lug). Scelta PRUDENTE: blocca i
// vettori ad alto valore e a rischio-zero di rottura — object/plugin
// (`object-src 'none'`), dirottamento del base URL (`base-uri 'self'`), invio
// form verso domini esterni (`form-action 'self'`) e clickjacking
// (`frame-ancestors`). Resta permissiva su script/style/connect ('unsafe-inline'
// + https:) per NON rompere Turnstile/PostHog/Sentry/Stripe/Supabase, che non
// si possono collaudare da qui. Il lockdown totale degli script (nonce +
// 'strict-dynamic') è un task dedicato con collaudo dal vivo — vedi
// PRIMA_DEL_LANCIO.md §sicurezza.
const csp = (frameAncestors: string) => [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  `frame-ancestors ${frameAncestors}`,
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https: wss:",
  "frame-src 'self' https:",
  "media-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  'upgrade-insecure-requests',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp("'none'") },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // Nega l'accesso a sensori/hardware dalle pagine: fotocamera e microfono
  // (foto e dettatura) passano dal file picker / getUserMedia della UI e non
  // vanno concessi come feature-policy globale. Riduce la superficie in caso
  // di contenuto iniettato.
  {
    key: 'Permissions-Policy',
    value: 'geolocation=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()',
  },
  // Isolamento cross-origin difensivo.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
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
        // (e frame-ancestors 'self' nella CSP) per permettere l'embedding
        // nell'iframe dell'anteprima same-origin.
        source: '/api/:path*/pdf',
        headers: [
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: csp("'self'") },
        ],
      },
    ]
  },
}

export default nextConfig
