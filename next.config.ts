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

// ── CSP STRETTA, per ora solo in ascolto (5 ago) ───────────────────────────
// Stessa policy di sopra ma senza il generico `https:` sugli script e senza
// 'unsafe-eval': gli script possono arrivare SOLO da noi e dalle quattro
// origini che usiamo davvero. Viaggia come `Report-Only`: non blocca niente,
// ma ogni risorsa che violerebbe la regola viene segnalata a /api/csp-report.
// ⚠️ Quando i log restano puliti per qualche giorno di traffico vero, questa
// diventa la CSP effettiva (si scambiano le due chiavi qui sotto). Stringerla
// al buio significherebbe scoprire in produzione che il login non funziona.
// Senza il replace, un URL con la barra finale in .env produrrebbe una CSP
// malformata (e quindi ignorata dal browser proprio dove serve).
const SUPABASE_ORIGIN = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://*.supabase.co').replace(/\/+$/, '')
const cspStrict = (frameAncestors: string) => [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
  `frame-ancestors ${frameAncestors}`,
  // 'unsafe-inline' resta: Next inietta script inline (e noi con LockVeil).
  // Il salto successivo è il nonce, che richiede un collaudo dal vivo.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === 'production' ? '' : " 'unsafe-eval'"} https://challenges.cloudflare.com https://js.stripe.com https://*.posthog.com`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob: ${SUPABASE_ORIGIN} https://*.supabase.co`,
  "font-src 'self' data:",
  // ⚠️ Sentry e Stripe: wildcard sul dominio principale, NON sul sottodominio.
  // `*.ingest.sentry.io` non copre `o123.ingest.us.sentry.io` (regione USA) e
  // `api.stripe.com` non copre le chiamate che Stripe.js fa a m./q.stripe.com:
  // con una lista troppo stretta il registro delle violazioni si riempirebbe
  // di falsi allarmi e non capiremmo più cosa stringere davvero.
  `connect-src 'self' ${SUPABASE_ORIGIN} https://*.supabase.co wss://*.supabase.co https://*.posthog.com https://*.sentry.io https://*.stripe.com https://*.stripe.network https://challenges.cloudflare.com`,
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
  "media-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  'upgrade-insecure-requests',
  'report-uri /api/csp-report',
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp("'none'") },
  { key: 'Content-Security-Policy-Report-Only', value: cspStrict("'none'") },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  // ⚠️ FIX 5 ago: `geolocation=()` nega la posizione a TUTTI, noi compresi —
  // VERIFICATO con Chromium: con quell'header "Vicino a me" riceveva
  // "Geolocation has been disabled in this document by permissions policy"
  // ANCHE con il permesso concesso dall'utente, e la UI lo raccontava come
  // "permesso negato" (il caso segnalato da Eli il 29 lug). Con `(self)` la
  // posizione funziona per il nostro sito e resta negata a eventuali iframe
  // di terze parti. Stesso ragionamento per microfono (dettatura) e
  // fotocamera (foto del lavoro): concessi a noi, negati a terzi.
  // Tutto il resto resta negato a chiunque.
  {
    key: 'Permissions-Policy',
    value: [
      'geolocation=(self)',
      'microphone=(self)',
      'camera=(self)',
      'payment=()',
      'usb=()',
      'magnetometer=()',
      'gyroscope=()',
      'accelerometer=()',
      'midi=()',
      'serial=()',
      'bluetooth=()',
      'idle-detection=()',
      'local-fonts=()',
      'display-capture=()',
    ].join(', '),
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
          { key: 'Content-Security-Policy-Report-Only', value: cspStrict("'self'") },
        ],
      },
    ]
  },
}

export default nextConfig
