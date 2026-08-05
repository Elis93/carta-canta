/**
 * ============================================================
 * CONTROLLO DI SICUREZZA — Carta Canta
 * ============================================================
 * Verifica dal VIVO le tre cose che dal codice non si possono controllare:
 *
 *   1. il sito in produzione manda davvero gli header di sicurezza giusti
 *      (compreso `geolocation=(self)`, senza il quale "Vicino a me" non
 *      funziona: bug rimasto in produzione da luglio ad agosto 2026);
 *   2. con la sola chiave pubblica (anon) NESSUNA tabella restituisce dati —
 *      è il test che smaschera una RLS dimenticata, la causa numero uno delle
 *      fughe di dati sui progetti Supabase;
 *   3. l'archivio delle foto non si lascia sfogliare da un anonimo (e dalla
 *      migration 068 è privato: si apre solo con indirizzi firmati a scadenza).
 *
 * COME LANCIARLO (dalla cartella del progetto):
 *   npm run security:check                      → controlla https://cartacanta.app
 *   npm run security:check -- http://localhost:3000
 *
 * Le chiavi le legge da .env.local (NEXT_PUBLIC_SUPABASE_URL e
 * NEXT_PUBLIC_SUPABASE_ANON_KEY). ⚠️ Usa SOLO la chiave pubblica: non serve
 * (e non va usata) la chiave di servizio.
 *
 * Esce con codice 0 se è tutto a posto, 1 se qualcosa non torna.
 * ============================================================
 */

import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const SITE = process.argv[2] || 'https://cartacanta.app'

// ── Chiavi da .env.local (senza dipendenze esterne) ─────────────────────────
function loadEnvLocal() {
  const out = {}
  for (const file of ['.env.local', '.env']) {
    try {
      const txt = readFileSync(resolve(process.cwd(), file), 'utf8')
      for (const line of txt.split('\n')) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
        if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, '')
      }
    } catch { /* file assente: va bene */ }
  }
  return out
}
const env = { ...loadEnvLocal(), ...process.env }
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Tutte le tabelle create dalle migration (001 → 069).
// ⚠️ Quando una migration crea una tabella, va aggiunta QUI: è l'unico posto
// da cui ci accorgeremmo di una RLS dimenticata.
const TABLES = [
  'accountant_links', 'ai_import_usage', 'catalog_items', 'clients', 'document_items',
  'document_views', 'documents', 'expenses', 'invoice_sequences', 'lavori',
  'marketplace_profiles', 'marketplace_requests', 'notification_reads', 'passkeys',
  'rate_limit_events',
  'referral_codes', 'referral_rewards', 'referral_uses', 'reviews', 'sdi_usage',
  'sopralluoghi', 'stripe_webhook_events', 'supplier_list_items', 'supplier_lists',
  'templates', 'voice_usage', 'work_photos', 'workspace_members', 'workspaces',
]

const HEADERS = [
  { name: 'permissions-policy', must: 'geolocation=(self)', why: 'senza, "Vicino a me" non funziona' },
  { name: 'permissions-policy', must: 'microphone=(self)', why: 'senza, la dettatura non funziona' },
  { name: 'strict-transport-security', must: 'max-age=', why: 'obbliga il browser a usare HTTPS' },
  { name: 'x-content-type-options', must: 'nosniff', why: 'niente file interpretati come script' },
  { name: 'x-frame-options', must: 'DENY', why: 'niente clickjacking' },
  { name: 'content-security-policy', must: "object-src 'none'", why: 'niente plugin' },
  { name: 'content-security-policy', must: "form-action 'self'", why: 'i form non possono inviare a domini esterni' },
  { name: 'referrer-policy', must: 'strict-origin', why: 'gli indirizzi dei link non escono interi' },
]

let fail = 0
const ok = (msg) => console.log(`  ✅ ${msg}`)
const ko = (msg) => { console.log(`  ❌ ${msg}`); fail++ }

async function checkHeaders() {
  console.log(`\n→ Header di sicurezza su ${SITE}`)
  let res
  try {
    res = await fetch(SITE, { redirect: 'manual', headers: { 'user-agent': 'cc-security-check/1' } })
  } catch (e) {
    ko(`il sito non risponde: ${e instanceof Error ? e.message : e}`)
    return
  }
  for (const h of HEADERS) {
    const value = res.headers.get(h.name) ?? ''
    if (value.includes(h.must)) ok(`${h.name}: ${h.must}`)
    else ko(`${h.name} NON contiene "${h.must}" — ${h.why} (valore: "${value.slice(0, 80)}")`)
  }
  // La policy stretta in ascolto: se sparisce, non stiamo più raccogliendo nulla
  if ((res.headers.get('content-security-policy-report-only') ?? '').includes('csp-report')) {
    ok('policy stretta in ascolto (report-only) attiva')
  } else {
    console.log('  ⚠️  policy stretta in ascolto assente (non è un buco, ma non stiamo raccogliendo dati)')
  }
}

async function checkRls() {
  console.log(`\n→ Tabelle leggibili con la sola chiave pubblica (anon)`)
  if (!SUPABASE_URL || !ANON_KEY) {
    ko('mancano NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (metti .env.local nella cartella)')
    return
  }
  let exposed = 0
  for (const table of TABLES) {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`
    try {
      const res = await fetch(url, { headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` } })
      if (res.status === 401 || res.status === 403) continue // protetta: l'anonimo è respinto
      if (res.status === 404) {
        // Può essere una tabella che non esiste (nome sbagliato qui) oppure
        // una migration non applicata: non è "protetta", è "non verificata".
        console.log(`  ⚠️  ${table}: non trovata (404) — nome sbagliato in questo elenco o migration non applicata`)
        continue
      }
      const body = await res.json().catch(() => null)
      if (Array.isArray(body) && body.length > 0) {
        ko(`TABELLA ESPOSTA: "${table}" restituisce dati a un anonimo → controlla subito la RLS`)
        exposed++
      } else if (res.ok) {
        // ⚠️ 200 con array VUOTO non è una promozione: la richiesta è passata,
        // la tabella semplicemente non aveva righe da mostrare in quel momento.
        // Con una RLS dimenticata su una tabella ancora vuota (o svuotata),
        // il vecchio controllo dava la spunta verde.
        ko(`TABELLA APERTA: "${table}" accetta la lettura da un anonimo (200) — oggi non ha righe da mostrare, ma la RLS non la sta fermando`)
        exposed++
      }
    } catch (e) {
      console.log(`  ⚠️  ${table}: non verificabile (${e instanceof Error ? e.message : e})`)
    }
  }
  if (exposed === 0) ok(`nessuna delle ${TABLES.length} tabelle restituisce dati a un anonimo`)
}

async function checkStorage() {
  console.log(`\n→ Archivio foto`)
  if (!SUPABASE_URL || !ANON_KEY) return
  const H = { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' }

  // ⚠️ Rendere privato il bucket chiude SOLO l'indirizzo /object/public. Gli
  // altri canali dello storage decidono con la RLS e la chiave di chi chiama —
  // e la chiave anon è pubblica per costruzione (sta nel JavaScript del sito).
  // È esattamente il buco rimasto aperto dalla 068 fino alla 069: la policy
  // "tutti possono leggere" della 041 non era stata rimossa, quindi con la
  // sola chiave anon si sfogliavano e si firmavano le foto di TUTTI.
  // Questi due controlli sono quelli che se ne accorgono.
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/list/work-photos`, {
      method: 'POST', headers: H, body: JSON.stringify({ prefix: '', limit: 5 }),
    })
    const body = await res.json().catch(() => null)
    if (Array.isArray(body) && body.length > 0) {
      ko('un anonimo può SFOGLIARE l\'elenco delle foto → togli la policy di lettura pubblica sul bucket work-photos (migration 069)')
    } else if (res.ok && Array.isArray(body)) {
      // Elenco vuoto ma richiesta accettata: oggi non vede nulla per caso.
      ko('un anonimo può interrogare l\'elenco delle foto (200): la lettura non è chiusa, oggi semplicemente non restituisce righe')
    } else {
      ok('un anonimo non può sfogliare l\'elenco delle foto')
    }
  } catch (e) {
    console.log(`  ⚠️  elenco foto: non verificabile (${e instanceof Error ? e.message : e})`)
  }

  // Il canale che permetterebbe di FARSI FIRMARE una foto altrui.
  try {
    const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/work-photos/controllo/inesistente.jpg`, {
      method: 'POST', headers: H, body: JSON.stringify({ expiresIn: 60 }),
    })
    const body = await res.json().catch(() => null)
    if (body && typeof body === 'object' && 'signedURL' in body) {
      ko('un anonimo può FARSI FIRMARE gli indirizzi delle foto → togli la policy di lettura pubblica (migration 069)')
    } else if (res.status === 400 || res.status === 404) {
      // "oggetto non trovato": la lettura sarebbe permessa, il file no.
      ko('un anonimo è autorizzato a chiedere la firma delle foto (risponde "non trovato" invece di negare l\'accesso) → controlla la policy di lettura')
    } else {
      ok('un anonimo non può farsi firmare gli indirizzi delle foto')
    }
  } catch (e) {
    console.log(`  ⚠️  firma foto: non verificabile (${e instanceof Error ? e.message : e})`)
  }
}

console.log('CONTROLLO DI SICUREZZA — Carta Canta')
await checkHeaders()
await checkRls()
await checkStorage()

console.log(
  fail === 0
    ? '\n✅ Tutto a posto.\n   Ricorda comunque i due controlli che si fanno solo a mano:\n   1) il 2FA sui tuoi account (Supabase, Vercel, GitHub, dominio, email)\n   2) il Security Advisor di Supabase (Dashboard → Advisors), una volta al mese\n'
    : `\n❌ ${fail} controlli non passati: vedi sopra.\n`
)
process.exit(fail === 0 ? 0 : 1)
