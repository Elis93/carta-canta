# CLAUDE.md — Memoria permanente del progetto Carta Canta

> Questo file è la fonte di verità per Claude. Va aggiornato ad ogni sessione di lavoro
> aggiungendo funzionalità implementate, decisioni prese e note rilevanti.
> **Ultima sessione:** maggio 2026

---

## Descrizione del progetto

**Carta Canta** è un'applicazione SaaS italiana per la gestione di preventivi e fatture,
rivolta ad artigiani, liberi professionisti e piccole imprese italiane.

**Obiettivo:** permettere a un idraulico, un elettricista o un falegname di creare un
preventivo professionale in pochi minuti, inviarlo al cliente tramite link, riceverne
l'accettazione digitale e convertirlo in fattura — tutto da mobile, senza bisogno di
commercialisti o software complessi.

**Target utente:** artigiani italiani, spesso in giro per cantieri, che usano principalmente
il telefono. UX mobile-first è prioritaria.

---

## Stack tecnologico

| Componente | Tecnologia | Versione |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.3 |
| Runtime UI | React | 19.2.4 |
| Database | Supabase (PostgreSQL) | `@supabase/supabase-js` 2.103 |
| Auth | Supabase Auth (PKCE flow) | — |
| Hosting | Vercel | Pro ($20/mo) |
| Pagamenti | Stripe | SDK 22.x |
| Email | Resend + React Email | — |
| AI import | Mistral (primario) + OpenAI (fallback) | `@mistralai/mistralai` 2.x, `openai` 6.x |
| Voice input | AssemblyAI SDK | 4.32.1 |
| Rate limiting | Upstash Redis + `@upstash/ratelimit` | — |
| CSS | Tailwind CSS v4 | — |
| Componenti UI | shadcn/ui (Radix UI) | `radix-ui` 1.4.x |
| PDF | `@react-pdf/renderer` | 4.x |
| Analytics | PostHog | — |
| Feature flags | Flagsmith | — |
| Error tracking | Sentry | — |
| Testing | Vitest + Playwright | — |
| Linguaggio | TypeScript | 5.x |

---

## Variabili d'ambiente

Tutte le variabili vanno messe in `.env.local` (sviluppo) e nelle **Environment Variables**
di Vercel (produzione). Le variabili `NEXT_PUBLIC_*` sono esposte al browser.

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL          URL del progetto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY     Chiave pubblica anon (safe per client)
SUPABASE_SERVICE_ROLE_KEY         Chiave service role (solo server, bypassa RLS)

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY  Chiave pubblica Stripe
STRIPE_SECRET_KEY                   Chiave segreta Stripe (solo server)
STRIPE_WEBHOOK_SECRET               Secret per verifica webhook Stripe
STRIPE_PRICE_PRO_MONTHLY            Price ID piano Pro mensile
STRIPE_PRICE_PRO_YEARLY             Price ID piano Pro annuale
STRIPE_PRICE_TEAM_MONTHLY           Price ID piano Team mensile
STRIPE_PRICE_TEAM_YEARLY            Price ID piano Team annuale

# AI
OPENAI_API_KEY      Chiave OpenAI (fallback AI import — attualmente vuota in prod)
MISTRAL_API_KEY     Chiave Mistral (primario AI import — attualmente vuota in prod)
ASSEMBLYAI_API_KEY  Chiave AssemblyAI (trascrizione vocale — $50 crediti gratuiti inclusi)

# Email
RESEND_API_KEY      Chiave Resend per invio email transazionali
RESEND_FROM_EMAIL   Indirizzo mittente (es. noreply@send.cartacanta.app)
RESEND_FROM_NAME    Nome mittente (es. Carta Canta)

# Rate limiting
UPSTASH_REDIS_REST_URL    URL REST di Upstash Redis
UPSTASH_REDIS_REST_TOKEN  Token di autenticazione Upstash

# Cron jobs
CRON_SECRET  Secret condiviso per autenticare le chiamate dei cron Vercel (Bearer token)

# Analytics e monitoring
NEXT_PUBLIC_POSTHOG_KEY     Chiave PostHog (analytics prodotto)
NEXT_PUBLIC_POSTHOG_HOST    Host PostHog (es. https://eu.posthog.com)
NEXT_PUBLIC_FLAGSMITH_KEY   Chiave Flagsmith (feature flags)
SENTRY_DSN                  DSN Sentry (error tracking server-side)
NEXT_PUBLIC_SENTRY_DSN      DSN Sentry (error tracking client-side)

# App
NEXT_PUBLIC_APP_URL   URL base dell'app (es. https://cartacanta.app)
NEXT_PUBLIC_APP_NAME  Nome dell'app (es. Carta Canta)
```

---

## Struttura database (PostgreSQL via Supabase)

### Enums
```sql
plan_type:     free | pro | team | lifetime
fiscal_regime: forfettario | ordinario | minimi
doc_status:    draft | sent | viewed | accepted | rejected | expired
user_role:     admin | operator | viewer
currency_code: EUR | GBP | CHF | PLN | USD
```

### Tabelle principali

#### `workspaces` — tenant principale
Ogni utente ha un workspace. Contiene tutti i dati fiscali/anagrafici dell'azienda.
Campi chiave: `owner_id`, `plan`, `stripe_customer_id`, `stripe_subscription_id`,
`fiscal_regime`, `ateco_codes TEXT[]` (migration 014), `validity_days` (migration 016),
`logo_url`, `bollo_auto`, `ritenuta_auto`.

#### `workspace_members` — team
PK composita `(workspace_id, user_id)`. Campo `accepted_at` per inviti pendenti.
Ruoli: `admin | operator | viewer`.

#### `clients` — rubrica clienti
`search_vector` tsvector generato per full-text search in italiano.
Campi: nome, email, phone, piva, codice_fiscale, indirizzo completo, tags TEXT[].

#### `documents` — preventivi e fatture
`doc_type`: `'preventivo' | 'fattura'`. Status workflow: `draft → sent → viewed → accepted/rejected/expired`.
`public_token`: token univoco per il link cliente (accesso senza autenticazione).
`doc_number`: formato `NNN/YYYY` (es. `001/2026`), gestito da `invoice_sequences`.
`doc_year` e `doc_seq`: colonne generate per ordinamento (migration 002).
`search_vector`: full-text su title + notes.
`signature_image TEXT` (migration 009), `rejection_reason TEXT` (migration 010),
`bonus_edilizio TEXT`, `bonus_tipo TEXT` (migration 015).

#### `document_items` — voci del documento
`sort_order`, `description`, `unit`, `quantity`, `unit_price`, `discount_pct`, `vat_rate`, `total`.
Campo `bonus_tipo TEXT` (migration 015) per voci bonus edilizio trainante/trainato.

#### `templates` — template PDF
Personalizzazione grafica: colori, font, logo, header/footer HTML, legal notice.

#### `catalog_items` — listino prezzi (migration 007)
`workspace_id`, `name`, `description`, `unit`, `unit_price`, `vat_rate`, `category`, `is_active`.
Usato dal `CatalogPicker` nel form preventivo.

#### `document_views` — tracking aperture (migration 005)
`document_id`, `viewed_at`, `user_agent`, `ip_address`. Ogni apertura del link cliente
crea un record e aggiorna lo status a `viewed`.

#### `invoice_sequences` — numerazione progressiva
PK `(workspace_id, year)`. Funzione `next_invoice_number()` con lock atomico.
Migration 012: sequenze separate per tipo documento. Migration 013: funzione unificata.

#### `rate_limit_events` — rate limiting DB-side (migration 011)
Backup per operazioni critiche (accettazione preventivo, AI import) in aggiunta a Upstash.

#### `referral_codes` — sistema referral (migration 018)
Un codice per workspace, generato automaticamente da trigger su INSERT in `workspaces`.
Formato: 6 caratteri alfanumerici senza ambiguità visive (no I/O/0/1).

#### `referral_uses` — iscrizioni via referral (migration 018)
`referrer_workspace_id`, `referee_workspace_id` (UNIQUE — un workspace può essere referred una sola volta), `code`, `used_at`.

#### `referral_rewards` — premi maturati (migration 018)
`workspace_id` (referrer), `referee_workspace_id` (UNIQUE), `free_months`, `credit_amount_cents`,
`stripe_balance_transaction_id`, `applied_at` (NULL = pending).

#### `voice_usage` — utilizzo trascrizione vocale (migration 019)
`workspace_id`, `period TEXT` (formato `YYYY-MM`), `seconds_used`.
UNIQUE su `(workspace_id, period)`. Limite: Free=300s/mese, Pro/Team=3600s/mese.

### Funzioni SQL rilevanti
- `is_workspace_member(workspace_id)` — helper RLS, SECURITY DEFINER
- `my_workspace_ids()` — SET di workspace accessibili dall'utente corrente (migration 018)
- `next_invoice_number(workspace, year)` — genera numero progressivo atomico
- `expire_overdue_documents()` — usata dal cron notturno
- `generate_referral_code()` — genera codice univoco 6 char
- `get_or_create_referral_code(workspace_id)` — idempotente, SECURITY DEFINER
- `trg_auto_create_referral_code()` — trigger su INSERT workspaces

### Migrazioni applicate (in ordine)
| # | File | Contenuto |
|---|------|-----------|
| 001 | `initial_schema` | Schema completo: workspaces, clients, templates, documents, document_items, invoice_sequences, RLS |
| 002 | `doc_number_title` | `doc_year`, `doc_seq` colonne generate per ordinamento |
| 003 | `signer_name` | Campo nome firmatario sui documenti |
| 004 | `viewed_status` | Aggiunge status `viewed` all'enum doc_status |
| 005 | `document_views` | Tabella tracking aperture link cliente |
| 006 | `notification_prefs` | Preferenze notifiche email per workspace |
| 007 | `catalog_items` | Tabella listino prezzi |
| 008 | `fatture` | Supporto fatture (doc_type, sequenze separate) |
| 009 | `signature_image` | Campo firma digitale su documents |
| 010 | `rejection_reason` | Motivo rifiuto preventivo |
| 011 | `rate_limit_events` | Rate limiting lato DB |
| 012 | `invoice_sequences_per_doctype` | Sequenze numerazione separate per tipo |
| 013 | `next_invoice_unified` | Funzione unificata numerazione |
| 014 | `ateco_codes_array` | `ateco_codes TEXT[]` su workspaces (rimosso limite 5) |
| 015 | `bonus_edilizio` | Campi bonus edilizio su documents e document_items |
| 016 | `workspace_validity_days` | `validity_days` default per workspace |
| 017 | `storage_logos_public` | Bucket Storage Supabase per loghi workspace |
| 018 | `referral_system` | Tabelle referral_codes, referral_uses, referral_rewards + trigger + RLS |
| 019 | `voice_usage` | Tabella tracking utilizzo mensile trascrizione vocale |

---

## Funzionalità implementate

### Autenticazione
- Signup con email/password + OAuth (Google, GitHub via Supabase)
- Conferma email obbligatoria (PKCE flow)
- Reset password via email → `/auth/callback?next=/reset-password/confirm`
  - **IMPORTANTE:** `exchangeCodeForSession` va fatto nel Route Handler `/auth/callback`,
    NON in una Server Action (i Set-Cookie non vengono propagati da SA non-redirect)
- Rate limiting su login/signup via Upstash Redis

### Onboarding
- Step multipli: dati fiscali, regime, ATECO codes, logo
- `ateco_codes`: array illimitato (rimosso limite 5 UI-only che era rimasto dopo migration 014)
- Dropdown ATECO usa Radix `PopoverContent` (portal) per evitare clipping da `Card` overflow-hidden

### Preventivi
- CRUD completo: crea, modifica, duplica, elimina
- Numerazione automatica `NNN/YYYY` con sequenza atomica per workspace+anno
- Stato workflow: bozza → inviato → visto → accettato/rifiutato/scaduto
- Scadenza automatica (cron notturno `/api/cron/expire-documents`)
- Link pubblico cliente con accettazione digitale e firma
- Vista lista + vista Kanban
- Filtri avanzati: per stato, cliente, data, importo
- Full-text search (tsvector italiano)
- Export CSV `/api/preventivi/export-csv`
- **"Usa come modello"** nel menu ⋮ di ogni riga: duplica senza aggiungere "(copia)"
- **Pre-selezione cliente** via `?client_id=xxx` nell'URL di nuovo preventivo
- **Invio diretto** dalla lista (menu ⋮, solo bozze) via `SendEmailDialog` controllato
- Qtà default = 0 (non 1) su nuove voci

### Catalogo prezzi
- CRUD voci catalogo con categoria, unità, prezzo, IVA
- `CatalogPicker` nel form preventivo (pulsante "Dal catalogo" outline, portal-based)

### Fatture
- Creazione fatture separate dai preventivi
- Conversione preventivo → fattura

### Template PDF
- Personalizzazione colori, font, logo, header/footer, nota legale
- Anteprima PDF in tempo reale
- Watermark automatico per piano Free

### Clienti
- Rubrica con ricerca full-text
- `ClientAutocomplete` con dropdown portal-based (evita clipping)

### Input vocale (AssemblyAI)
- Pulsante microfono toggle on/off accanto a:
  - Campo "Note pubbliche" nel form preventivo
  - Campo "Note interne" nel form preventivo
  - Campo "Descrizione" di ogni voce nella tabella voci (desktop + mobile)
- Countdown 60s, auto-stop, stati idle/recording/processing/success/error
- API route `POST /api/voice/transcribe`:
  - Verifica quota mensile (Free: 300s, Pro/Team/Lifetime: 3600s)
  - Trascrive con AssemblyAI `speech_models: ['universal']`, `language_code: 'it'`, `format_text: true`
  - Aggiorna `voice_usage` per workspace+mese
  - Risposta 429 con messaggio leggibile se quota esaurita
- Il testo trascritto viene **accodato** al testo esistente nel campo

### AI Import
- Import voci da foto/PDF con AI (Mistral primario, OpenAI fallback)
- Solo piano Pro/Team

### Sistema referral "Porta un amico"
- Codice univoco 6 char per workspace (generato automaticamente)
- Link condivisione `https://cartacanta.app/signup?ref=CODE`
- Campo opzionale nel form di signup (pre-popolato da URL `?ref=`)
- Premio: €19 di credito Stripe Customer Balance per ogni referee che converte a Pro
- Cron mensile `POST /api/cron/referral` (1° del mese ore 09:00 UTC)
- Pagina `/referral` con codice, link, statistiche (iscritti, conversioni, mesi gratuiti)
- Premi "pending" per referrer senza stripe_customer_id: applicati al giro mensile successivo

### Email transazionali (Resend)
- Benvenuto nuovo utente
- Invio preventivo al cliente
- Promemoria scadenza (3 giorni, 1 giorno — owner + cliente)
- Notifica accettazione/rifiuto
- Notifica scadenza avvenuta
- Template React Email

### Abbonamento
- Piani: Free (10 preventivi max), Pro ($19/mese), Team ($49/mese)
- Stripe Checkout per upgrade
- Webhook Stripe per aggiornamento piano
- Pagina `/abbonamento` con pricing

### Cron jobs (Vercel, piano Pro)
| Endpoint | Schedule | Funzione |
|---|---|---|
| `/api/cron/expire-documents` | `0 2 * * *` | Scade documenti + reminder email |
| `/api/cron/referral` | `0 9 1 * *` | Premi referral mensili |

---

## Funzionalità in roadmap

- [ ] **Team collaboration** — inviti, permessi per ruolo (struttura DB già pronta)
- [ ] **Notifiche push** — notifica mobile accettazione preventivo
- [ ] **Dashboard analytics** — grafici fatturato, tasso accettazione, clienti top
- [ ] **Firma digitale avanzata** — integrazione con servizi certificati
- [ ] **Integrazione contabile** — export per commercialisti (XML, CSV strutturato)
- [ ] **Multi-lingua PDF** — preventivi in inglese/francese/tedesco
- [ ] **App mobile nativa** — attualmente PWA, valutare React Native
- [ ] **PostHog/Flagsmith/Sentry** — chiavi non ancora configurate in produzione
- [ ] **AI import** — chiavi Mistral/OpenAI non ancora configurate in produzione

---

## Decisioni architetturali

### Auth: PKCE con Route Handler, non Server Action
`exchangeCodeForSession(code)` **deve** essere chiamato in un Route Handler
(`/auth/callback/route.ts`) e non in una Server Action. Le Server Action che restituiscono
dati (non redirect) non propagano i `Set-Cookie` al browser. Il Route Handler usa
`redirectWithSession()` che copia i cookie nella risposta 302.

### Dropdown: Radix Portal invece di position absolute
`ClientAutocomplete` e `AtecoMultiSelect` usano `<PopoverContent>` (Radix portal)
invece di `div` con `position: absolute`. Motivazione: shadcn `Card` ha `overflow-hidden`
hardcoded nella classe base, che clippa i dropdown assoluti. Il portale Radix si monta
su `document.body` e bypassa il problema senza modificare il componente Card.

### AI import: Mistral come primario
Mistral è più economico di OpenAI per l'analisi di immagini. OpenAI è configurato come
fallback. Le chiavi sono attualmente vuote in produzione (funzionalità non ancora attivata).

### Voice input: AssemblyAI invece di OpenAI Whisper
- AssemblyAI Universal-3: ~$0.0035/min batch — 40% più economico di Whisper ($0.006/min)
- Supporto italiano nativo nel modello Universal
- SDK TypeScript ufficiale, gestisce upload + polling automaticamente
- Parametro corretto SDK v4: `speech_models: ['universal']` (NON `speech_model: 'best'`
  che è deprecato e causa errore a runtime pur essendo nei tipi TypeScript)

### Referral rewards: Stripe Customer Balance
I premi referral vengono applicati come credito negativo sul Customer Balance Stripe
(`stripe.customers.createBalanceTransaction(customerId, { amount: -1900, currency: 'eur' })`).
Il credito si scala automaticamente dalla prossima fattura. Se il referrer non ha ancora
un `stripe_customer_id` (piano Free), il premio viene salvato come "pending" in
`referral_rewards.applied_at = null` e applicato al primo cron mensile successivo in cui
il referrer ha sottoscritto un piano.

### Cron jobs: Vercel Pro (piano a $20/mese)
Scelto Vercel Pro invece di pg_cron (richiede Supabase Pro a $25/mese aggiuntivi).
Vercel Pro include cron senza limiti di frequenza e timeout fino a 5 minuti.
Il piano Hobby aveva limite 1 job/giorno — non adatto per job mensili.

### Numerazione documenti: sequenza atomica per workspace+anno
`invoice_sequences(workspace_id, year)` con `INSERT ... ON CONFLICT DO UPDATE`
garantisce unicità senza race condition. La funzione `next_invoice_number()` è
chiamata al momento del salvataggio definitivo, non alla creazione bozza
(per evitare "buchi" nella numerazione).

### Nuovo preventivo: qty default = 0
Le nuove voci hanno `quantity: 0` di default (non 1) perché gli artigiani preferiscono
inserire esplicitamente la quantità piuttosto che dimenticare di cambiarla da 1.
Fix applicato in: `PreventivoForm.newVoce()`, `VociTable` e `AiImportModal`.

---

## Pattern e convenzioni

### Struttura file
```
app/
  (app)/          # Route protette (autenticazione richiesta)
    _components/  # Componenti specifici della sezione
    preventivi/
      _components/  PreventivoForm, VociTable, CatalogPicker, VoiceInput wrappers...
      [id]/         Dettaglio preventivo
      nuovo/        Nuovo preventivo
  (auth)/         # Route pubbliche auth (login, signup, reset...)
  api/
    cron/         expire-documents, referral
    voice/        transcribe
    preventivi/   export-csv
    webhooks/     stripe
  onboarding/
components/
  shared/         Componenti riutilizzabili: ClientAutocomplete, AtecoMultiSelect,
                  CatalogPicker, VoiceInput, SearchBar, StatusBadge...
  ui/             shadcn/ui components
lib/
  actions/        Server Actions: documents, referral, ai-import...
  supabase/       client.ts, server.ts, admin.ts
  stripe/         stripe.ts, plans.ts
  email/          send.ts, templates/
  ai/             types.ts, import logic
supabase/
  migrations/     001–019 SQL migration files
types/
  database.ts     Tipi generati da Supabase CLI (NON modificare manualmente)
```

### Tipi database
`types/database.ts` è generato da `supabase gen types typescript`. Le nuove tabelle
create nelle ultime migrazioni (referral_codes/uses/rewards, voice_usage) non sono
ancora in questo file. Fino alla rigenerazione, usare cast `as any` sul client Supabase
con commento esplicativo. Comando per rigenerare:
```bash
supabase gen types typescript --project-id <project-id> > types/database.ts
```

### Server Actions vs Route Handler
- **Server Action**: mutazioni form, operazioni che non necessitano di Set-Cookie
- **Route Handler**: operazioni che devono impostare cookie (auth), cron job, webhook,
  upload file (voce), export file

### Supabase client
- `createClient()` (server.ts): per operazioni utente, rispetta RLS
- `createAdminClient()` (admin.ts): service role, bypassa RLS — solo per operazioni
  amministrative (cron, signup, operazioni cross-workspace)

### Admin client nei cron
I cron usano `createAdminClient()` che bypassa RLS. Protezione via `CRON_SECRET`
nell'header `Authorization: Bearer <secret>`.

### Naming
- Componenti: PascalCase, file = nome componente
- Server Actions: `camelCaseAction` suffix (es. `createDocumentAction`)
- API routes: kebab-case directory (es. `expire-documents`)
- Migrations: `NNN_nome_descrittivo.sql` con NNN a 3 cifre zero-padded
- DB columns: snake_case, timestamps sempre con timezone (`TIMESTAMPTZ`)

### UX mobile-first
- Ogni componente ha layout stacked su mobile, griglia su `md+`
- Pulsanti azioni sempre raggiungibili con pollice su mobile
- Input vocale su mobile: pulsante 7×7 (size-7), icona size-3

---

## Note importanti

### Cose da non dimenticare
- **Dopo ogni nuova migrazione:** eseguirla su Supabase SQL Editor E rigenerare
  `types/database.ts` per eliminare i cast `as any` nei file TypeScript
- **ASSEMBLYAI_API_KEY:** configurata su Vercel (Production + Preview + Development)
  e in `.env.local`. Ha $50 di crediti gratuiti iniziali
- **AssemblyAI SDK v4:** il parametro `speech_model` (singolare) è deprecato a runtime
  anche se presente nei tipi TypeScript. Usare sempre `speech_models: ['universal']`
- **Stripe Customer Balance:** crediti referral vanno sul Customer Balance come importo
  negativo (es. `-1900` per €19). Si scalano automaticamente dalla prossima fattura
- **CRON_SECRET:** usato per autenticare i cron Vercel via header `Authorization: Bearer`
- **Piano Vercel Pro:** $20/mese, timeout cron fino a 5 min, no limiti frequenza

### Limitazioni note
- **`types/database.ts` non aggiornato:** le tabelle `referral_codes`, `referral_uses`,
  `referral_rewards`, `voice_usage` non sono ancora nei tipi generati. Richiedono
  cast `as any` nei file che le usano (segnalati con commento ESLint)
- **AI import disabilitato in prod:** `OPENAI_API_KEY` e `MISTRAL_API_KEY` sono vuote
  in produzione — la funzionalità è implementata ma non attivata
- **PostHog/Flagsmith/Sentry:** chiavi non configurate — i componenti ci sono ma
  non tracciano nulla
- **Piano Free:** limite di 10 documenti totali (non mensili). Dopo 10 → paywall

### Bug noti e fix applicati
- **Password reset "link non valido":** fixato instradando il PKCE code exchange
  attraverso `/auth/callback` (Route Handler) invece che nella Server Action
- **Dropdown ATECO/Client clippato:** fixato con Radix PopoverContent (portal)
- **Qty default = 1:** fixato in `PreventivoForm.newVoce()`, `VociTable`, `AiImportModal`
- **AssemblyAI `speech_model` deprecato:** fixato con `speech_models: ['universal']`

### Comandi utili
```bash
# Sviluppo locale
npm run dev

# Type check
npx tsc --noEmit

# Rigenerare tipi Supabase
supabase gen types typescript --project-id ivbzuhgwszkdnlsybsao > types/database.ts

# Build
npm run build

# Test
npm test
npm run test:e2e
```
