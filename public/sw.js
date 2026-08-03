// Carta Canta — Service Worker (conservativo, sicuro).
//
// Strategia:
// - PAGINE (navigazioni): network-first. Si prova SEMPRE la rete; la cache
//   serve SOLO la pagina "offline" quando manca la connessione. Nessun rischio
//   di mostrare contenuti vecchi.
// - FILE STATICI hashati (/_next/static, icone, manifest): cache-first
//   (sono immutabili, con hash nel nome → nessun rischio di staleness).
// - Tutto il resto (API, auth, POST): passa direttamente in rete, mai in cache.
//
// Per aggiornare: incrementare CACHE_VERSION → l'activate cancella le cache vecchie.

const CACHE_VERSION = 'cc-v4'
const OFFLINE_URL = '/offline.html'
// /avvio: schermata di partenza della PWA — precacheata e servita
// CACHE-FIRST così il primo frame è istantaneo anche col server a freddo
// (lo splash di sistema Android sparisce subito). È solo marchio + redirect:
// una copia vecchia è innocua, e viene comunque riaggiornata in background.
const BOOT_URL = '/avvio'
const PRECACHE = [OFFLINE_URL, BOOT_URL, '/icon-192.png', '/icon-512.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

function isStaticAsset(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname === '/manifest.webmanifest' ||
    /\.(?:png|jpg|jpeg|webp|svg|ico|woff2?)$/.test(url.pathname)
  )
}

self.addEventListener('fetch', (event) => {
  const { request } = event

  // Solo GET same-origin; tutto il resto lo gestisce il browser normalmente.
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // /avvio (partenza PWA): cache-first per il primo frame istantaneo,
  // con riaggiornamento della copia in background (stale-while-revalidate).
  if (request.mode === 'navigate' && url.pathname === BOOT_URL) {
    event.respondWith(
      caches.match(BOOT_URL).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone()
              caches.open(CACHE_VERSION).then((cache) => cache.put(BOOT_URL, copy))
            }
            return response
          })
          .catch(() => cached ?? caches.match(OFFLINE_URL).then((r) => r ?? Response.error()))
        return cached ?? network
      })
    )
    return
  }

  // Navigazioni (pagine HTML): network-first, fallback offline.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match(OFFLINE_URL).then((r) => r ?? Response.error()))
    )
    return
  }

  // File statici immutabili: cache-first con aggiornamento in background.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response && response.status === 200) {
              const copy = response.clone()
              caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy))
            }
            return response
          })
          .catch(() => cached)
        return cached ?? network
      })
    )
    return
  }

  // Tutto il resto: rete diretta (nessuna cache).
})
