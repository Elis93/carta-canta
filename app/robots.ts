import type { MetadataRoute } from 'next'

// ============================================================
// /robots.txt — istruzioni per i crawler (Google, Bing, ...).
//
// Logica:
// - Le pagine dell'app (dietro login) sono escluse dal crawl:
//   tanto risponderebbero con un redirect a /login, ma senza
//   robots.txt i crawler le tenterebbero comunque tutte.
// - /p/ e /r/ (link pubblici con token) NON sono bloccate qui
//   APPOSTA: hanno il meta robots "noindex" sulla pagina, e
//   Google può vederlo solo se gli è permesso scaricarla.
//   Bloccarle nel robots.txt lascerebbe gli URL indicizzabili
//   "alla cieca" (link-only indexing).
// ============================================================

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/auth/',
          '/dashboard',
          '/preventivi',
          '/fatture',
          '/clienti',
          '/catalogo',
          '/lavori',
          '/sopralluoghi',
          '/calendario',
          '/bilancio',
          '/impostazioni',
          '/account',
          '/altro',
          '/cestino',
          '/farti-trovare',
          '/calcoli',
          '/scadenze',
          '/notifiche',
          '/abbonamento',
          '/referral',
          '/richieste',
          '/recensioni',
          '/marketplace',
          '/template',
          '/studio',
          '/onboarding',
          '/aiuto',
          '/novita',
          '/avvio',
        ],
      },
    ],
    sitemap: 'https://cartacanta.app/sitemap.xml',
  }
}
