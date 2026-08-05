/**
 * ============================================================
 * SMOKE TEST PAGINE PUBBLICHE — Carta Canta
 * ============================================================
 * Avvia il build di produzione in locale (con credenziali Supabase
 * FINTE: nessun contatto col database) e verifica che le pagine
 * pubbliche rispondano 200 col contenuto giusto, che le route
 * protette reindirizzino al login e che i file della PWA siano
 * raggiungibili.
 *
 * Perché esiste: il crash della pagina pubblica /p/[token] del
 * 6 lug 2026 ("qualcosa è andato storto" per giorni) sarebbe stato
 * intercettato da un controllo così PRIMA del deploy.
 *
 * COME LANCIARLO (serve un build fresco):
 *   npm run build && npm run smoke:public
 *
 * Esce con codice 0 se tutti i controlli passano, 1 altrimenti.
 * ============================================================
 */

import { spawn } from 'node:child_process'

const PORT = 3111
const BASE = `http://127.0.0.1:${PORT}`

// Env stub: le pagine pubbliche non devono MAI toccare il database.
// Se una pagina pubblica prova a farlo, il fetch fallisce → il check fallisce
// → è esattamente il segnale che vogliamo.
const env = {
  ...process.env,
  NODE_ENV: 'production',
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://stub.supabase.co',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'stub-anon-key',
  NEXT_PUBLIC_APP_URL: `http://127.0.0.1:${PORT}`,
}

// ── Controlli ────────────────────────────────────────────────────────────────
// contains: stringa che DEVE comparire nell'HTML (case-sensitive)
const CHECKS = [
  // Pagine pubbliche di marketing
  { path: '/', status: 200, contains: 'Carta Canta' },
  { path: '/prova', status: 200, contains: 'furgone' },
  // Auth (raggiungibili da sloggati)
  { path: '/login', status: 200, contains: 'Accedi' },
  { path: '/signup', status: 200, contains: 'email' },
  { path: '/verifica-email', status: 200 },
  // Pagine legali (richieste anche dal Play Store)
  { path: '/privacy', status: 200, contains: 'Privacy' },
  { path: '/termini', status: 200, contains: 'Termini' },
  { path: '/cancella-account', status: 200, contains: 'account' },
  // PWA (regressione PR #11: senza PUBLIC_PATHS finivano in redirect)
  { path: '/manifest.webmanifest', status: 200, contains: 'Carta Canta' },
  { path: '/sw.js', status: 200 },
  { path: '/offline.html', status: 200 },
  // Partenza PWA: statica, deve caricarsi da sloggati (start_url del manifest)
  { path: '/avvio', status: 200, contains: 'Carta ' },
  // Font self-hosted dei template: servono anche ai clienti sloggati su /p/
  { path: '/fonts/atkinson-hyperlegible-400.woff2', status: 200 },
  { path: '/opengraph-image', status: 200 },
  // SEO (i crawler sono sloggati: senza PUBLIC_PATHS finirebbero al login)
  { path: '/robots.txt', status: 200, contains: 'Sitemap:' },
  { path: '/sitemap.xml', status: 200, contains: 'cartacanta.app' },
  // Route PROTETTE: per gli sloggati devono reindirizzare (302/307/308)
  { path: '/dashboard', redirect: true },
  { path: '/preventivi', redirect: true },
  { path: '/impostazioni', redirect: true },
  { path: '/account', redirect: true },
]

// ── Header di sicurezza (5 ago) ─────────────────────────────────────────────
// PERCHÉ: `Permissions-Policy: geolocation=()` era in produzione da luglio e
// negava la posizione ANCHE al nostro sito → "Vicino a me" non poteva
// funzionare, e l'errore del browser sembrava un permesso rifiutato
// dall'utente. Una regressione così va vista qui, non dal telefono di Eli.
const HEADER_CHECKS = [
  { path: '/', header: 'permissions-policy', includes: 'geolocation=(self)' },
  { path: '/', header: 'permissions-policy', includes: 'microphone=(self)' },
  { path: '/', header: 'strict-transport-security', includes: 'max-age=' },
  { path: '/', header: 'x-content-type-options', includes: 'nosniff' },
  { path: '/', header: 'x-frame-options', includes: 'DENY' },
  { path: '/', header: 'content-security-policy', includes: "object-src 'none'" },
  { path: '/', header: 'content-security-policy', includes: "frame-ancestors 'none'" },
  // La policy stretta viaggia in ascolto: se sparisce, ce ne accorgiamo
  { path: '/', header: 'content-security-policy-report-only', includes: 'report-uri /api/csp-report' },
]

function fetchNoRedirect(url) {
  return fetch(url, { redirect: 'manual', headers: { 'user-agent': 'cc-smoke/1' } })
}

async function waitForServer(timeoutMs = 60_000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetchNoRedirect(`${BASE}/`)
      if (res.status > 0) return
    } catch { /* non ancora su */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`Il server non è partito entro ${timeoutMs / 1000}s`)
}

async function main() {
  // Guardia: se la porta è già occupata (server orfano di un run precedente,
  // o altro servizio) i check girerebbero contro il processo SBAGLIATO.
  try {
    await fetchNoRedirect(`${BASE}/`)
    console.error(`❌ La porta ${PORT} è già occupata: chiudi il processo che la usa e rilancia.`)
    process.exit(1)
  } catch { /* porta libera: ok */ }

  console.log(`→ Avvio next start sulla porta ${PORT} (Supabase stub: nessun contatto col DB)`)
  // shell:true su Windows: gli shim .cmd di npx non partono senza shell
  // (hardening Node post CVE-2024-27980) — il PC di Eli è Windows.
  const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: process.platform === 'win32',
  })
  let serverLog = ''
  server.stdout.on('data', (d) => { serverLog += d })
  server.stderr.on('data', (d) => { serverLog += d })

  const kill = () => { try { server.kill('SIGTERM') } catch { /* già morto */ } }
  process.on('exit', kill)

  let failures = 0
  try {
    await waitForServer()
    console.log('→ Server pronto, eseguo i controlli:\n')

    for (const check of CHECKS) {
      const url = `${BASE}${check.path}`
      let ok = true
      let detail = ''
      try {
        const res = await fetchNoRedirect(url)
        if (check.redirect) {
          ok = [302, 303, 307, 308].includes(res.status)
          detail = `status ${res.status}${ok ? '' : ' (attesa una redirect 30x al login)'}`
          if (ok) {
            const loc = res.headers.get('location') ?? ''
            if (!loc.includes('/login')) { ok = false; detail += ` → location "${loc}" non punta a /login` }
          }
        } else {
          ok = res.status === check.status
          detail = `status ${res.status}`
          if (ok && check.contains) {
            const body = await res.text()
            if (!body.includes(check.contains)) {
              ok = false
              detail += ` ma NON contiene "${check.contains}"`
            }
          }
        }
      } catch (e) {
        ok = false
        detail = `errore: ${e instanceof Error ? e.message : e}`
      }
      console.log(`  ${ok ? '✅' : '❌'} ${check.path.padEnd(24)} ${detail}`)
      if (!ok) failures++
    }

    for (const hc of HEADER_CHECKS) {
      let ok = true
      let detail = ''
      try {
        const res = await fetchNoRedirect(`${BASE}${hc.path}`)
        const value = res.headers.get(hc.header) ?? ''
        ok = value.includes(hc.includes)
        detail = ok ? `${hc.header}: ${hc.includes}` : `${hc.header} NON contiene "${hc.includes}" (valore: "${value.slice(0, 90)}")`
      } catch (e) {
        ok = false
        detail = `errore: ${e instanceof Error ? e.message : e}`
      }
      console.log(`  ${ok ? '✅' : '❌'} ${hc.path.padEnd(24)} ${detail}`)
      if (!ok) failures++
    }
  } finally {
    kill()
  }

  if (failures > 0) {
    console.error(`\n❌ SMOKE TEST FALLITO: ${failures} controlli non passati`)
    console.error('— Ultime righe del server —')
    console.error(serverLog.split('\n').slice(-15).join('\n'))
    process.exit(1)
  }
  console.log(`\n✅ SMOKE TEST OK: ${CHECKS.length + HEADER_CHECKS.length} controlli passati`)
  process.exit(0)
}

main().catch((e) => {
  console.error('❌ Smoke test non eseguibile:', e instanceof Error ? e.message : e)
  process.exit(1)
})
