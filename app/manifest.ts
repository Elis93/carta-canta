import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Carta Canta — Preventivi e Fatture',
    short_name: 'Carta Canta',
    description: 'Preventivi e fatture professionali in 60 secondi.',
    // /avvio: pagina statica precacheata dal SW → primo frame ISTANTANEO
    // (lo splash di sistema sparisce subito), poi naviga da sola a /dashboard.
    start_url: '/avvio',
    display: 'standalone',
    // Splash di SISTEMA della PWA (Android lo disegna da solo: questo sfondo
    // + icona al centro) — è l'UNICO splash: quello custom è stato rimosso
    // (decisione Eli 17 lug). Navy come logo e bottoni dell'app.
    background_color: '#1a1a2e',
    theme_color: '#1a1a2e',
    lang: 'it',
    icons: [
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
