import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Carta Canta — Preventivi e Fatture',
    short_name: 'Carta Canta',
    description: 'Preventivi e fatture professionali in 60 secondi.',
    start_url: '/dashboard',
    display: 'standalone',
    // Splash di SISTEMA della PWA (Android lo disegna da solo: questo sfondo
    // + icona al centro). Navy come l'AppSplash interno → all'apertura si
    // vede un'unica schermata blu, niente più flash bianco (feedback Eli 17 lug).
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
