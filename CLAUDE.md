# CLAUDE.md — Memoria permanente del progetto Carta Canta

> **Fonte di verità per Claude Code.** Va aggiornato a fine di ogni sessione di lavoro con:
> nuove feature implementate, decisioni prese, bug emersi, cose rimandate, cambi di direzione.
> L'obiettivo è non dover ricostruire il contesto da chat diverse ogni volta.
>
> **Ultima sessione:** 10 maggio 2026 (sessione 2)

---

## 0. REGOLE DI COMPORTAMENTO PER CLAUDE CODE

1. Leggi TUTTO questo file prima di scrivere una riga di codice
2. NON chiedere conferma per ogni singola decisione — questo documento è la fonte di verità
3. Se un'informazione non è qui → applicare best practice 2026 del tech stack scelto
4. MAI usare `any` in TypeScript — tutto tipato con Zod e tipi generati da Supabase
   _(eccezione temporanea: tabelle non ancora in `types/database.ts`, documentare con commento ESLint)_
5. MAI esporre chiavi API nel client — tutto passa da Server Actions o API Routes
6. MAI skipare i test sui calcoli fiscali — copertura 100% obbligatoria
7. Commit atomici con conventional commits: `feat/fix/chore/docs/test`
8. Ogni feature nuova va sotto feature flag Flagsmith prima del deploy in produzione
9. Distinguere sempre tra: **implementato** / **deciso ma rimandato** / **idea strategica** / **bug noto**

---

## 1. IDENTITÀ, VISIONE E POSIZIONAMENTO

### Il problema che risolviamo

Milioni di artigiani, freelance e piccole realtà italiane gestiscono ancora preventivi e
fatture in modo manuale: fogli Excel, Word, carta, WhatsApp. Perdono tempo, fanno errori,
fanno fatica a sembrare professionali. Non hanno voglia (né tempo) di imparare un software
gestionale complesso.

### Target reale

- **Primario:** Artigiani italiani (idraulici, elettricisti, falegnami, imbianchini,
  geometri freelance, installatori) — spesso in giro per cantieri, usano prevalentemente
  il telefono
- **Secondario:** Freelance e professionisti (consulenti, designer, traduttori) in regime
  forfettario o ordinario
- **Terziario:** Piccole realtà con 2-5 persone (imprese edili, studi tecnici)

Caratteristica chiave: **utenti poco digitalizzati**, che non vogliono configurare software,
non capiscono API, non hanno un commercialista disponibile h24.

### Visione del prodotto

Carta Canta è l'assistente documentale intelligente per chi lavora con le mani.
Non un gestionale. Non un ERP. Un prodotto semplice, mobile-first, molto italiano,
che trasforma il lavoro documentale in qualcosa di veloce, ordinato e comprensibile.

**In futuro:** piattaforma dove i professionisti pubblicano i propri listini e i clienti
finali possono cercare lavori, confrontare prezzi e ottenere stime automatiche — senza
dover chiamare 5 professionisti per avere un preventivo.

### Promessa del brand / posizionamento

> "Preventivi professionali in 60 secondi. Senza Excel, senza carta."

- **Non siamo** un software di contabilità
- **Non siamo** un ERP per PMI
- **Siamo** l'alternativa moderna al blocco note e al foglio Excel per chi lavora sul campo
- **UX mobile-first** è non negoziabile: ogni funzionalità deve funzionare perfettamente
  dal telefono prima che dal computer

### Caratteristiche distintive del posizionamento

1. Estrema semplicità d'uso — onboarding in < 5 minuti, primo preventivo in < 3 minuti
2. Italiano nativo — regime forfettario, marca da bollo, ritenuta d'acconto, SDI
3. Mobile-first reale — non responsive, ma pensato per il pollice
4. AI come assistente, non come feature "wow" — riduce l'attrito, non aggiunge complessità

---

## 2. TECH STACK — VERSIONI ESATTE

| Componente | Tecnologia | Versione / Note |
|---|---|---|
| Framework | Next.js (App Router) | **16.2.3** — NON 15 |
| Runtime UI | React | 19.2.4 |
| Database | Supabase (PostgreSQL 16) | `@supabase/supabase-js` 2.103 |
| Auth | Supabase Auth (PKCE flow) | — |
| Hosting | Vercel | Pro ($20/mo) — Frankfurt fra1 |
| Pagamenti | Stripe | SDK 22.x — subscriptions + one-time + tax |
| Email | Resend + React Email | — |
| AI import | **Mistral (primario)** + OpenAI (fallback) | `@mistralai/mistralai` 2.x, `openai` 6.x |
| Voice input | AssemblyAI SDK | 4.32.1 |
| Rate limiting | Upstash Redis + `@upstash/ratelimit` | sliding window |
| CSS | Tailwind CSS v4 | — |
| Componenti UI | shadcn/ui (Radix UI) | `radix-ui` 1.4.x |
| PDF | `@react-pdf/renderer` | 4.x — **NON Playwright** |
| Analytics | PostHog | EU region (non ancora configurato in prod) |
| Feature flags | Flagsmith | cloud free tier (non ancora configurato in prod) |
| Error tracking | Sentry | (non ancora configurato in prod) |
| Testing | Vitest (unit) + Playwright (E2E) + axe-core (a11y) | — |
| Linguaggio | TypeScript | 5.x strict mode |
| CI/CD | GitHub Actions → Vercel preview → Vercel prod | — |
| Monitoraggio | Sentry + UptimeRobot | — |

---

## 3. INFO OPERATIVE E REPOSITORY

```
Repo:            github.com/Elis93/carta-canta
Dev locale:      C:\progetti\carta-canta
Backup NAS:      Z:\CARTA CANTA  (gestire con attenzione — non sovrascrivere)
Hosting:         Vercel Pro $20/mese (fra1 Frankfurt — EU data residency)
                 Abilita: Cron Jobs avanzati, build illimitate e funzionalità
                 non disponibili sul piano Free.
DB:              Supabase — project ID ivbzuhgwszkdnlsybsao
URL produzione:  https://cartacanta.app
```

**Note operative:**
- Il backup su NAS va sincronizzato manualmente dopo sessioni di sviluppo significative
- Non pushare mai branch instabili su `main` — usare branch feature + PR
- `types/database.ts` va rigenerato dopo ogni nuova migrazione SQL

---

## 4. STRUTTURA PROGETTO

```
carta-canta/
├── app/
│   ├── (marketing)/           # Landing page, pricing, blog — pubbliche
│   │   ├── page.tsx           # Homepage
│   │   ├── prezzi/page.tsx    # Pricing page
│   │   └── [ateco]/page.tsx   # Pagine SEO programmatiche per ATECO
│   ├── (app)/                 # Route protette (autenticazione richiesta)
│   │   ├── layout.tsx         # Shell con sidebar + header
│   │   ├── _components/       # NavItem, sidebar, header app
│   │   ├── dashboard/         # Home app (KPI, attività recente)
│   │   ├── preventivi/        # Lista + creazione + dettaglio
│   │   │   └── _components/   # PreventivoForm, VociTable, CatalogPicker...
│   │   ├── fatture/           # Lista fatture
│   │   ├── clienti/           # Rubrica clienti
│   │   ├── template/          # Gestione template PDF
│   │   ├── impostazioni/      # Workspace settings
│   │   ├── abbonamento/       # Billing, upgrade, piano
│   │   └── referral/          # Programma "Porta un amico"
│   │       └── _components/   # ReferralPageClient
│   ├── (auth)/                # Login, signup, reset password
│   │   ├── signup/
│   │   │   ├── page.tsx       # Server wrapper (legge ?ref= da searchParams)
│   │   │   └── _components/SignupForm.tsx  # Client form
│   │   └── actions.ts         # Server Actions auth (incluso referral registration)
│   ├── p/[token]/             # Pagina pubblica preventivo (link cliente, no auth)
│   ├── api/
│   │   ├── webhooks/stripe/   # Stripe webhook handler
│   │   ├── ai/extract/        # AI import endpoint (rate limited)
│   │   ├── voice/transcribe/  # POST — trascrizione audio con AssemblyAI
│   │   ├── cron/
│   │   │   ├── expire-documents/  # Scade documenti + reminder email
│   │   │   └── referral/          # Premi referral mensili
│   │   ├── preventivi/export-csv/ # Export CSV
│   │   └── health/            # Health check per UptimeRobot
│   └── onboarding/
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── shared/                # ClientAutocomplete, AtecoMultiSelect,
│   │                          # VoiceInput, SearchBar, StatusBadge...
│   └── pdf/                   # React component per PDF template
├── lib/
│   ├── actions/               # Server Actions: documents, referral, ai-import...
│   ├── supabase/              # client.ts, server.ts, admin.ts
│   ├── stripe/                # stripe.ts, plans.ts
│   ├── ai/                    # types.ts, import logic
│   ├── fiscal/                # calcoli.ts, arrotondamento.ts
│   ├── email/                 # send.ts, templates/
│   └── utils/                 # cn(), formatCurrency(), formatDate()
├── types/
│   ├── database.ts            # Generato da Supabase CLI — NON modificare manualmente
│   └── index.ts               # Tipi applicativi custom
├── hooks/                     # useWorkspace, useDocuments, useFeatureFlag
├── middleware.ts              # Auth check + rate limiting
├── supabase/
│   ├── migrations/            # 001–019 SQL migrations
│   └── seed.sql               # Seed dati di test
├── tests/
│   ├── unit/fiscal/           # Test calcoli fiscali (100% coverage)
│   └── e2e/                   # Test flows completi
├── vercel.json                # Cron jobs config
└── CLAUDE.md                  # Questo file
```

---

## 5. VARIABILI D'AMBIENTE

Tutte le variabili vanno messe in `.env.local` (sviluppo) e nelle **Environment Variables**
di Vercel (produzione). Le variabili `NEXT_PUBLIC_*` sono esposte al browser.

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # Solo server-side — bypassa RLS

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=           # price_xxx
STRIPE_PRICE_PRO_YEARLY=
STRIPE_PRICE_TEAM_MONTHLY=
STRIPE_PRICE_TEAM_YEARLY=
STRIPE_PRICE_LIFETIME=              # one-time payment €299

# AI
OPENAI_API_KEY=                     # Fallback AI import (vuota in prod)
MISTRAL_API_KEY=                    # Primario AI import (vuota in prod)
ASSEMBLYAI_API_KEY=                 # Trascrizione vocale ($50 crediti gratuiti inclusi)

# Email
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@send.cartacanta.app
RESEND_FROM_NAME=Carta Canta

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Cron jobs
CRON_SECRET=                        # Bearer token per autenticare cron Vercel

# Analytics e monitoring
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
NEXT_PUBLIC_FLAGSMITH_KEY=
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# App
NEXT_PUBLIC_APP_URL=https://cartacanta.app
NEXT_PUBLIC_APP_NAME=Carta Canta
```

---

## 6. PIANI E FEATURE GATING

```typescript
// lib/stripe/plans.ts
export const PLANS = {
  free: {
    maxDocuments: 10,       // limite totale, non mensile
    maxTemplates: 1,
    aiImport: false,
    watermark: true,
    teamMembers: 0,
    approvalWorkflow: false,
    voiceSeconds: 300,      // 5 min/mese
  },
  pro: {
    maxDocuments: Infinity,
    maxTemplates: Infinity,
    aiImport: true,
    watermark: false,
    teamMembers: 0,
    approvalWorkflow: false,
    voiceSeconds: 3600,     // 60 min/mese
  },
  team: {
    maxDocuments: Infinity,
    maxTemplates: Infinity,
    aiImport: true,
    watermark: false,
    teamMembers: 5,
    approvalWorkflow: true,
    voiceSeconds: 3600,
  },
  lifetime: { /* stesse feature di pro */ voiceSeconds: 3600 }
} as const
```

**Prezzi Stripe:**
```
Piano Free:         €0 — nessun prodotto Stripe (solo DB flag)
Piano Pro Mensile:  €19.00/mese — Stripe recurring
Piano Pro Annuale:  €182.00/anno (€15.17/mese) — Stripe recurring
Piano Team Mensile: €49.00/mese — Stripe recurring
Piano Team Annuale: €470.00/anno (€39.17/mese) — Stripe recurring
Piano Lifetime:     €299.00 — Stripe one-time payment
```

---

## 7. DATABASE SCHEMA

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
`fiscal_regime`, `ateco_codes TEXT[]` (migration 014 — array illimitato),
`validity_days` (migration 016), `logo_url`, `bollo_auto`, `ritenuta_auto`.

#### `workspace_members` — team
PK composita `(workspace_id, user_id)`. Campo `accepted_at` per inviti pendenti.
Ruoli: `admin | operator | viewer`.
Nota: fallback access per membri invitati già implementato — `my_workspace_ids()` gestisce
sia owner che membri con `accepted_at IS NOT NULL`.

#### `clients` — rubrica clienti
`search_vector` tsvector generato per full-text search in italiano.
Campi: nome, email, phone, piva, codice_fiscale, indirizzo completo, paese, tags TEXT[].

#### `templates` — template PDF
Personalizzazione grafica: colori, font, logo, header/footer HTML, legal notice.
`is_default`, `show_watermark` (per piano Free).

#### `documents` — preventivi e fatture
`doc_type`: `'preventivo' | 'fattura'`. Status workflow: `draft → sent → viewed → accepted/rejected/expired`.
`public_token`: token univoco per il link cliente (accesso senza autenticazione).
`doc_number`: formato `NNN/YYYY` (es. `001/2026`), gestito da `invoice_sequences`.
`doc_year` e `doc_seq`: colonne generate per ordinamento (migration 002).
`search_vector`: full-text su title + notes.
`signature_image TEXT` (migration 009), `rejection_reason TEXT` (migration 010),
`bonus_edilizio TEXT`, `bonus_tipo TEXT` (migration 015).
`ai_generated`, `ai_confidence` per tracking AI import.

#### `document_items` — voci del documento
`sort_order`, `description`, `unit`, `quantity`, `unit_price`, `discount_pct`, `vat_rate`, `total`.
Campo `bonus_tipo TEXT` (migration 015) per voci bonus edilizio trainante/trainato.

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
UNIQUE su `(workspace_id, period)`. Limite: Free=300s/mese, Pro/Team/Lifetime=3600s/mese.

### Funzioni SQL rilevanti
- `is_workspace_member(workspace_id)` — helper RLS, SECURITY DEFINER
- `my_workspace_ids()` — SET di workspace accessibili dall'utente corrente (migration 018)
- `next_invoice_number(workspace, year)` — genera numero progressivo atomico
- `expire_overdue_documents()` — usata dal cron notturno
- `generate_referral_code()` — genera codice univoco 6 char (**variabile locale `v_code`, non `code`**)
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
| 014 | `ateco_codes_array` | `ateco_codes TEXT[]` su workspaces (array illimitato) |
| 015 | `bonus_edilizio` | Campi bonus edilizio su documents e document_items |
| 016 | `workspace_validity_days` | `validity_days` default per workspace |
| 017 | `storage_logos_public` | Bucket Storage Supabase per loghi workspace |
| 018 | `referral_system` | Tabelle referral_codes, referral_uses, referral_rewards + trigger + RLS + `my_workspace_ids()` |
| 019 | `voice_usage` | Tabella tracking utilizzo mensile trascrizione vocale |

---

## 8. MOTORE FISCALE — REGOLE INVIOLABILI

```typescript
// lib/fiscal/calcoli.ts

// ARROTONDAMENTO: sempre round half up — MAI toFixed() — MAI banker's rounding
export function roundFiscale(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// CALCOLO DOCUMENTO: ordine OBBLIGATORIO
export function calcolaDocumento(items: DocumentItem[], opts: FiscalOptions) {
  // 1. Totale per voce
  const itemTotals = items.map(item => ({
    ...item,
    total: roundFiscale(item.quantity * item.unit_price * (1 - (item.discount_pct ?? 0) / 100))
  }))

  // 2. Subtotale
  const subtotal = roundFiscale(itemTotals.reduce((s, i) => s + i.total, 0))

  // 3. Sconto globale
  const afterDiscount = roundFiscale(
    subtotal * (1 - (opts.discount_pct ?? 0) / 100) - (opts.discount_fixed ?? 0)
  )

  // 4. IVA PER VOCE (non sul totale — obbligatorio per legge IT)
  const taxAmount = opts.fiscal_regime === 'forfettario' ? 0 :
    roundFiscale(itemTotals.reduce((s, i) =>
      s + roundFiscale(i.total * ((i.vat_rate ?? opts.vat_rate_default ?? 22) / 100)), 0
    ))

  // 5. Ritenuta d'acconto (opzionale)
  const ritenuta = opts.ritenuta_pct
    ? roundFiscale(afterDiscount * opts.ritenuta_pct / 100)
    : 0

  // 6. Marca da bollo (forfettari con totale > 77.47)
  const bollo = (opts.fiscal_regime === 'forfettario' && afterDiscount > 77.47) ? 2.00 : 0

  // 7. Totale finale
  const total = roundFiscale(afterDiscount + taxAmount + bollo - ritenuta)

  return { subtotal, afterDiscount, taxAmount, ritenuta, bollo, total, itemTotals }
}

// STRINGA LEGALE FORFETTARIO — non modificabile
export const FORFETTARIO_LEGAL_NOTICE =
  "Operazione effettuata ai sensi dell'art. 1, commi 54-89, L. 190/2014 " +
  "(Regime Forfettario) – Operazione fuori campo IVA ai sensi del comma 58, " +
  "lettera a), del medesimo articolo"

// ALIQUOTE IVA DISPONIBILI
export const VAT_RATES = [
  { value: 22, label: "22% — Standard" },
  { value: 10, label: "10% — Ristrutturazioni su abitazioni" },
  { value: 5,  label: "5% — Servizi sociali" },
  { value: 4,  label: "4% — Prima necessità" },
  { value: 0,  label: "0% — Esente" },
]
```

---

## 9. FLOWS UTENTE COMPLETI

### FLOW 1 — Creazione Preventivo Manuale

```
1. Utente clicca FAB "+" o "Nuovo preventivo"
2. Apre modal/pagina: seleziona cliente (autocomplete) o crea nuovo
3. Seleziona template (default se uno solo)
4. Aggiunge voci: descrizione, qtà, UM, prezzo, IVA per voce
   → calcolo real-time al cambio di ogni campo
   → tooltip su "Unità di misura": pz/mq/ml/ore/kg/gg/mc
   → pulsante microfono per dettatura vocale del campo descrizione
5. Aggiunge note pubbliche e/o note interne (con pulsante microfono)
6. Sistema calcola automaticamente: subtotale, IVA, bollo, totale
7. Preview PDF in tempo reale (side panel su desktop, tab su mobile)
8. Salva bozza (auto-save ogni 30s)
9. Azione: Invia al cliente → scegli metodo (email / link WhatsApp / link diretto)
10. Documento passa a status "sent", genera public_token se non esiste
11. Cliente riceve email/link → apre pagina pubblica → può accettare/rifiutare
12. Al click "Accetto": salva timestamp + IP + UA → status "accepted" → notifica push all'utente
```

### FLOW 2 — AI Import da Foto/Documento

```
1. Utente clicca "Importa con AI"
2. Mobile: apre fotocamera posteriore direttamente (input[capture=environment])
   Desktop: apre file picker (immagini + PDF)
3. Loading state: "Sto analizzando il documento..." (skeleton animato)
4. AI estrae voci → mostra risultato in tabella editabile
   → ogni voce ha confidence score (verde >80%, giallo 50-80%, rosso <50%)
5. Utente può modificare/aggiungere/eliminare voci prima di salvare
6. Conferma → crea documento con flag ai_generated=true
7. Fallback: se Mistral fallisce → tenta OpenAI → se fallisce → mostra
   "AI non disponibile, compila manualmente" (mai bloccare l'utente)
```

### FLOW 3 — Link Pubblico Cliente

```
URL: cartacanta.app/p/[public_token]  ← MAI usare document.id nell'URL pubblico
- Pagina pubblica, no auth richiesta
- Mostra preventivo in formato professionale (stesso template)
- Header: "Preventivo da [Ragione Sociale]"
- Pulsanti: "✅ Accetto" / "❌ Declino" / "💬 Hai domande? Contatta [email/tel]"
- Al click Accetto: modale di conferma con nome + checkbox ToS semplice
- POST /api/documents/[token]/accept → salva IP, UA, timestamp
- Redirect a pagina di ringraziamento: "Preventivo accettato! [Ragione Sociale] ti contatterà presto."
- Email automatica all'artigiano: "🎉 Il cliente ha accettato il preventivo!"
- Se già accettato/scaduto: mostra stato appropriato
```

### FLOW 4 — Onboarding (Primo Accesso)

```
Step 1/3: "Come si chiama la tua attività?"
  → Ragione sociale, P.IVA, regime fiscale (forfettario/ordinario), ATECO
  → Il regime fiscale pre-configura: IVA, bollo, stringa legale

Step 2/3: "Carica il tuo logo" (opzionale, skip disponibile)
  → Upload immagine → crop quadrato → salva su Supabase Storage

Step 3/3: "Crea il tuo primo preventivo"
  → Direttamente nel form (non skip) — First Value in <5 minuti è KPI primario

Dopo step 3: confetti animation + "Preventivo creato! Invialo subito al cliente →"
Progress bar nell'header: 0/3 → 1/3 → 2/3 → 3/3 (scompare dopo completamento)
```

### FLOW 5 — Upgrade Piano

```
Trigger A: Utente crea il 10° preventivo (ultimo del piano Free)
  → Banner in-app: "Hai raggiunto il limite. Sblocca preventivi illimitati →"

Trigger B: Utente tenta di usare AI Import (feature Pro)
  → Modal paywall: "AI Import è disponibile nel piano Pro"

Trigger C: Utente va su /abbonamento
  → Pricing page in-app con 3 piani (Free / Pro / Team)

Azione: click su piano → createCheckoutSession() → redirect Stripe
Post-pagamento: webhook stripe → aggiorna plan nel DB → redirect app con ?success=1
Success banner: "🎉 Benvenuto nel piano Pro! Tutte le feature sono sbloccate."
```

### FLOW 6 — Dashboard Analytics Utente

```
KPI cards in cima:
- "Preventivi questo mese" (con delta % vs mese scorso)
- "Valore totale preventivi" (€)
- "Tasso di accettazione" (%)
- "Preventivi in attesa di risposta" (con link)

Lista attività recente: ultimi 10 eventi (preventivo inviato, accettato, scaduto)

Alert automatici (banner giallo):
- "Hai 3 preventivi senza risposta da 14+ giorni → Manda un reminder"
- "Il preventivo #2026/005 scade domani"
```

---

## 10. RATE LIMITING (Upstash Redis)

```typescript
// middleware.ts — applica prima di ogni route
const RATE_LIMITS = {
  default:    { requests: 200, window: "1m" },
  auth:       { requests: 10,  window: "15m" },
  api:        { requests: 60,  window: "1m" },
  ai_extract: { requests: 5,   window: "1m" },   // AI costa 10-20x
  pdf:        { requests: 10,  window: "1m" },
  upload:     { requests: 10,  window: "1h" },
}
```

---

## 11. FEATURE FLAGS (Flagsmith)

```typescript
// Flags da creare in Flagsmith PRIMA del deploy in produzione
const FLAGS = {
  FEATURE_AI_IMPORT:        true,   // kill switch AI import
  FEATURE_VOICE_INPUT:      true,   // kill switch input vocale
  FEATURE_WHATSAPP_SEND:    true,   // kill switch invio WhatsApp
  FEATURE_REFERRAL:         true,   // kill switch programma referral
  FEATURE_SDI_INTEGRATION:  false,  // Fase 2 — off per ora
  FEATURE_TEAM_PLAN:        true,
  FEATURE_LIFETIME_PLAN:    true,
  FEATURE_MARKETPLACE:      false,  // Fase 3
  FEATURE_PUBLIC_API:       false,  // Fase 3
}
```

---

## 12. FUNZIONALITÀ IMPLEMENTATE

### Autenticazione
- Signup con email/password + OAuth (Google, GitHub via Supabase)
- Conferma email obbligatoria (PKCE flow)
- Reset password via email → `/auth/callback?next=/reset-password/confirm`
  - **IMPORTANTE:** `exchangeCodeForSession` va fatto nel Route Handler `/auth/callback`,
    NON in una Server Action (i Set-Cookie non vengono propagati da SA non-redirect)
- Rate limiting su login/signup via Upstash Redis

### Onboarding
- Step multipli: dati fiscali, regime, ATECO codes, logo
- `ateco_codes`: array illimitato (rimosso limite 5 UI-only dopo migration 014)
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
- ⚠️ Testato in produzione — vedere sezione "Problemi noti" per errori emersi

### AI Import
- Import voci da foto/PDF con AI (Mistral primario, OpenAI fallback)
- Solo piano Pro/Team
- Chiavi non ancora configurate in produzione

### Sistema referral "Porta un amico"
- Codice univoco 6 char per workspace (generato automaticamente da trigger)
- Link condivisione `https://cartacanta.app/signup?ref=CODE`
- Campo opzionale nel form di signup (pre-popolato da URL `?ref=`)
- Premio: €19 di credito Stripe Customer Balance per ogni referee che converte a Pro
- Cron mensile `GET /api/cron/referral` (1° del mese ore 09:00 UTC)
- Pagina `/referral` con codice, link, statistiche (iscritti, conversioni, mesi gratuiti)
- Premi "pending" per referrer senza stripe_customer_id: applicati al giro mensile successivo

### Email transazionali (Resend)

| Trigger | Template | Subject |
|---|---|---|
| Signup | welcome.tsx | "Benvenuto in Carta Canta 🎉" |
| Preventivo inviato (al cliente) | preventivo_cliente.tsx | "[Ragione Sociale] ti ha inviato un preventivo" |
| Preventivo accettato (all'artigiano) | preventivo_accettato.tsx | "🎉 [Nome cliente] ha accettato il tuo preventivo!" |
| Preventivo rifiutato | preventivo_rifiutato.tsx | "Il cliente ha rifiutato il preventivo" |
| Reminder cliente (dopo 7gg) | reminder_cliente.tsx | "Hai ancora bisogno di questo preventivo?" |
| Preventivo in scadenza | scadenza_warning.tsx | "Il tuo preventivo scade domani" |
| Pagamento ok | payment_success.tsx | "Piano [X] attivato — grazie!" |
| Pagamento fallito | payment_failed.tsx | "Problema con il pagamento — aggiorna il metodo" |

### Abbonamento
- Piani: Free (10 preventivi max), Pro (€19/mese), Team (€49/mese), Lifetime (€299)
- Stripe Checkout per upgrade
- Webhook Stripe per aggiornamento piano
- Pagina `/abbonamento` con pricing

### Cron jobs (Vercel Pro)
| Endpoint | Schedule | Funzione |
|---|---|---|
| `/api/cron/expire-documents` | `0 2 * * *` | Scade documenti + reminder email |
| `/api/cron/referral` | `0 9 1 * *` | Premi referral mensili |

---

## 13. INTEGRAZIONI E INTEROPERABILITÀ

> **Principio guida:** Carta Canta non deve essere un sistema chiuso. Deve integrarsi
> con strumenti che gli utenti italiani usano già, riducendo l'attrito di adozione.
> Evitare integrazioni che richiedono configurazioni tecniche all'utente (es. API key manuali).
> **Prima consolidare il core, poi attivare integrazioni esterne.**

### 13.1 Fatturazione elettronica SDI — canale gestito da noi _(deciso, da implementare)_

**Scenario:** utente che **non ha** un gestionale esterno e vuole emettere fatture elettroniche
tramite Carta Canta.

- **Decisione:** usare un nostro account su provider SDI (es. Openapi.it o simile)
- L'utente finale non configura nulla di tecnico
- Il canale viene gestito interamente lato server da noi
- **Modello economico discusso:** ~€0,10 per fattura emessa tramite questo canale
  (pay-per-use pass-through — l'utente paga solo quando usa il canale SDI)
- Da definire: provider specifico, pricing esatto, UI di conferma costo, fiscalità
- **Stato:** decisione strategica presa, implementazione rimandata al consolidamento del core

### 13.2 Fatture in Cloud — integrazione OAuth _(considerata strategica, da pianificare)_

**Scenario:** utente che usa già Fatture in Cloud e vuole collegare Carta Canta.

- **Modello previsto:** OAuth / collegamento semplice — NON API key manuale inserita dall'utente
- Posizionamento: integrazione **complementare**, non sostitutiva
- Utenti FiC potrebbero usare Carta Canta per preventivi (migliore UX) e poi sincronizzare
  le fatture nel loro gestionale esistente
- **Stato:** direzione strategica approvata, non ancora in specifica funzionale
- Da fare: analisi API FiC, flusso OAuth, mappatura campi

### 13.3 Cloud always-on _(implementato — architettura attuale)_

- Il prodotto è accessibile via login da qualsiasi dispositivo (telefono, computer, tablet)
- I dati sono su Supabase (PostgreSQL) — non dipendono da un singolo dispositivo
- Sessioni gestite da Supabase Auth con PKCE flow

### 13.4 Local-first + sync Google/Apple _(direzione storica — abbandonata)_

- In una fase iniziale del progetto era stata discussa una direzione local-first con
  sincronizzazione tramite Google Drive o iCloud
- **Decisione: abbandonata.** L'architettura cloud (Supabase + Vercel) è quella definitiva
- Non implementare nulla in questa direzione

### 13.5 Import e continuità d'uso _(da pianificare)_

- Il prodotto deve facilitare la conversione da strumenti già usati (Excel, Word, altro)
- Obiettivo: abbassare l'attrito di ingresso per utenti che hanno già dati storici
- Feature AI import da foto/documento va in questa direzione (già implementata)
- Import strutturato da CSV/Excel è in roadmap

---

## 14. DIREZIONI STRATEGICHE DI PRODOTTO

> Queste sezioni descrivono direzioni approvate ma non ancora in specifica funzionale.
> NON sono da implementare senza una sessione di design/specifica dedicata.

### 14.1 Modello take rate / commissione _(idea strategica — pricing e UX da studiare)_

- È emersa l'idea di applicare una percentuale o fee su alcune transazioni/servizi
- **NON è una decisione finale** — pricing, fiscalità e UX vanno ancora studiati
- **Regola fondamentale:** si applica solo quando Carta Canta porta valore transazionale
  diretto (es. pagamento incassato via piattaforma, lead generato dal marketplace).
  **Mai su fatture normali create autonomamente dall'utente.**
- Casi d'uso sensati:
  - Pagamento incassato tramite piattaforma (es. link pagamento nella fattura)
  - Lead generato dal marketplace (professionista trovato tramite Carta Canta)
  - Uso del canale SDI gestito da noi (già discusso nella sezione 13.1)
- **Da studiare:** modello di pricing, impatto fiscale, soglie, UX di trasparenza verso l'utente

### 14.2 Carta Canta come motore di ricerca professionisti e stima lavori _(espansione futura)_

In futuro Carta Canta non sarà solo preventivi e fatture, ma anche una piattaforma dove:
- I professionisti pubblicano i propri listini con prezzi per tipologia di lavoro
- Un cliente finale cerca un lavoro (es. "imbiancare 10mq di parete a Milano")
- Il sistema restituisce una stima automatica basata su: prezzi dei professionisti iscritti,
  distanza geografica, tipo di lavoro, lavorazioni collegate

**Punto critico — modello dati delle lavorazioni:**
Un preventivo reale non è solo "voce = prezzo". Il sistema deve gestire:
- **Lavorazione principale** (es. imbiancatura)
- **Lavorazioni obbligatorie associate** (es. preparazione superficie, protezione area)
- **Lavorazioni opzionali** (es. rasatura, doppia mano, primer)
- **Regole e compatibilità** (es. "se muri in cartongesso → rasatura obbligatoria")
- **Unità di misura multiple** (mq, ml, ore, pz...)
- **Prezzo base + prezzo variabile** (costo minimo, costo per unità, maggiorazione distanza)
- **Costi fissi aggiuntivi** (sopralluogo, trasferta, materiali, smaltimento)

**Esempio:** se il cliente cerca "imbiancare 10mq di parete", il sistema non deve
mostrare solo il prezzo dell'imbiancatura, ma comporre automaticamente:
preparazione superficie + protezione area + imbiancatura + eventuale rasatura.

**Stato:** espansione strategica futura — da trasformare in specifica funzionale dedicata
prima di qualsiasi implementazione. Distinta dal core gestionale attuale.

---

## 15. ROADMAP — DECISO MA RIMANDATO

Queste feature sono state deliberatamente rimandate al consolidamento del core.
Non vanno implementate prima di avere UX, stabilità e retention del core funzionante.

| Feature | Motivo del rinvio | Note |
|---|---|---|
| **Team collaboration** | DB già pronto, manca UX inviti | Struttura `workspace_members` già in DB |
| **Portale cliente** | Dipende da stabilità core | Diverso dalla pagina pubblica p/[token] |
| **E-signature certificata** | Richiede integrazione terza | Firma semplice già presente |
| **Fatture in Cloud OAuth** | Prima consolidare core | Vedere sezione 13.2 |
| **SDI / fatturazione elettronica** | Prima consolidare core | Vedere sezione 13.1 |
| **Notifiche push mobile** | Infrastruttura da aggiungere | — |
| **Dashboard analytics avanzata** | Grafici, tasso accettazione, clienti top | KPI base già presenti |
| **Import da CSV/Excel** | Utile per conversione utenti | AI import già parziale |
| **Multi-lingua PDF** | Internazionalizzazione Fase 2 | — |
| **App mobile nativa** | Attualmente PWA | Valutare React Native solo dopo traction |
| **Firma digitale avanzata** | Servizi certificati — costo + UX | — |
| **Integrazione contabile** | XML/CSV per commercialisti | — |
| **Marketplace ATECO** | Pagine SEO — Fase 3 | — |
| **Public API** | Fase 3 — dopo traction | — |

**Principio guida:**
Prima consolidare core interno (UX, feature base, retention) senza connessioni esterne
complesse. Poi attivare provider esterni, OAuth, billing aggiuntivo e integrazioni terze.

---

## 16. PROBLEMI NOTI / DA SISTEMARE

> Questi sono bug o rifiniture UX emersi nei test. Da sistemare progressivamente,
> con priorità a ciò che blocca l'utente o genera confusione.

### UX / Form

| Problema | Descrizione | Priorità |
|---|---|---|
| **Form cliente — campi mancanti** | Servono email e telefono nel form creazione cliente | Alta |
| **Label campo fiscale** | Il campo va rinominato "Partita IVA / Codice Fiscale" (non solo P.IVA) | Media |
| **Separazione bozze / preventivi** | In UI manca distinzione chiara tra bozze e preventivi inviati | Alta |

### Dashboard

| Problema | Descrizione | Priorità |
|---|---|---|
| **KPI "preventivi di questo mese"** | Attualmente conta anche le bozze — deve contare solo i preventivi inviati | Alta |
| **Acceptance rate** | KPI demoralizzante per utenti nuovi con pochi dati — trovare metrica alternativa o contestualizzarla meglio | Media |
| **Recent activities** | Le bozze create non sono mostrate bene nelle attività recenti | Bassa |

### Autenticazione

| Problema | Descrizione | Priorità |
|---|---|---|
| **Google OAuth → sessione** | Dopo login con Google il sistema a volte chiede ancora credenziali — da sistemare il flusso di sessione post-OAuth | Alta |

### Template / PDF

| Problema | Descrizione | Priorità |
|---|---|---|
| **Logo PNG** | Il logo caricato non si vede correttamente nel PDF / nell'anteprima | Alta |
| **Font template** | Il cambio font nella pagina template non funziona come atteso | Media |

### Input vocale

| Problema | Descrizione | Priorità |
|---|---|---|
| **Errori nei test reali** | La feature è integrata ma nei test reali sono emersi errori (es. `speech_model` deprecato — già fixato). Monitorare usage e qualità trascrizioni in italiano | Media |

---

## 17. DEBITO TECNICO

### 17.1 ATECO — soluzione ponte _(da migrare)_
- In UI esiste il supporto a `ateco_codes[]` multipli (array)
- Nel DB esiste `ateco_codes TEXT[]` (migration 014) ma la logica applicativa in alcuni
  punti usa ancora il campo singolo `ateco_code`
- **Stato:** soluzione ponte — da allineare completamente UI + DB + logica

### 17.2 Termini di pagamento / scadenze _(da consolidare)_
- Sono stati aggiunti nuovi payment terms e suggerimenti automatici di scadenza
- Questa area va consolidata con: reminder automatici, integrazione pagamenti, logica fatture completa
- **Stato:** implementazione parziale — manca la parte di reminder e pagamenti

### 17.3 `types/database.ts` non aggiornato _(da rigenerare)_
- Le tabelle `referral_codes`, `referral_uses`, `referral_rewards`, `voice_usage`
  non sono ancora nei tipi generati
- Richiedono cast `as any` nei file che le usano (segnalati con commento ESLint)
- **Azione:** eseguire `supabase gen types typescript --project-id ivbzuhgwszkdnlsybsao > types/database.ts`
  dopo aver verificato che le migration siano tutte applicate

### 17.4 AI import disabilitato in produzione _(da attivare)_
- `OPENAI_API_KEY` e `MISTRAL_API_KEY` sono vuote in produzione
- La funzionalità è implementata ma non attivata
- Da attivare quando si vuole rendere disponibile la feature

### 17.5 PostHog / Flagsmith / Sentry _(da configurare)_
- Chiavi non configurate — i componenti ci sono ma non tracciano nulla
- Analytics, feature flags ed error tracking non sono operativi in produzione

---

## 18. SECURITY HEADERS (next.config.ts)

```typescript
const securityHeaders = [
  { key: "X-Frame-Options",           value: "DENY" },
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "X-XSS-Protection",          value: "1; mode=block" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
]
```

---

## 19. TESTING — REQUISITI MINIMI

```
Unit tests (Vitest):
  - lib/fiscal/calcoli.ts → 100% coverage OBBLIGATORIO
  - lib/ai/extract.ts → test su mock responses
  - lib/pdf/generate.ts → test output non vuoto

E2E tests (Playwright):
  - Signup → onboarding → primo preventivo (happy path)
  - AI import (con mock Mistral)
  - Pagina pubblica → accettazione preventivo
  - Upgrade piano Free → Pro (con Stripe test mode)

A11y tests (axe-core):
  - Tutte le pagine pubbliche: zero violations WCAG 2.2 AA
  - Form preventivo: zero violations
```

---

## 20. DEPLOYMENT

```
Branch main    → Vercel Production (cartacanta.app)
Branch staging → Vercel Preview (staging.cartacanta.app)
PRs            → Vercel Preview automatico (pr-XXX.cartacanta.app)

Region: fra1 (Frankfurt — EU data residency)
Environment variables: configurare in Vercel Dashboard per ciascun environment
```

---

## 21. DECISIONI ARCHITETTURALI FISSE

1. **Server Actions per mutazioni** — no client-side fetch su dati sensibili
2. **Supabase RLS è la prima linea di sicurezza** — non fidarsi mai del client
3. **Il calcolo fiscale avviene SEMPRE server-side** prima del salvataggio (validazione Zod)
4. **I PDF vengono generati on-demand** e cachati su Supabase Storage (URL firmato 1h)
5. **L'AI output viene sempre validato con schema Zod** prima di essere mostrato all'utente
6. **Feature flags controllano l'accesso** alle feature per ogni utente
7. **`public_token` nell'URL pubblico** — NON usare l'ID del documento nell'URL `/p/[token]`
8. **Il tasso di cambio viene "congelato"** al momento del salvataggio del documento
9. **La lingua del documento (PDF) è separata** dalla lingua dell'interfaccia
10. **Il numero fattura viene assegnato atomicamente** — nessuna race condition possibile

### Note su decisioni specifiche

**Auth: PKCE con Route Handler, non Server Action**
`exchangeCodeForSession(code)` **deve** essere chiamato in un Route Handler
(`/auth/callback/route.ts`) e non in una Server Action. Le Server Action che restituiscono
dati (non redirect) non propagano i `Set-Cookie` al browser.

**Dropdown: Radix Portal invece di position absolute**
`ClientAutocomplete` e `AtecoMultiSelect` usano `<PopoverContent>` (Radix portal)
invece di `div` con `position: absolute`. Motivazione: shadcn `Card` ha `overflow-hidden`
hardcoded nella classe base, che clippa i dropdown assoluti. Il portale Radix si monta
su `document.body` e bypassa il problema senza modificare il componente Card.

**AI import: Mistral come primario**
Mistral è più economico di OpenAI per l'analisi di immagini. OpenAI è configurato come
fallback. Le chiavi sono attualmente vuote in produzione (funzionalità non ancora attivata).

**Voice input: AssemblyAI invece di OpenAI Whisper**
- AssemblyAI Universal-3: ~$0.0035/min batch — 40% più economico di Whisper ($0.006/min)
- Supporto italiano nativo nel modello Universal
- SDK TypeScript ufficiale, gestisce upload + polling automaticamente
- Parametro corretto SDK v4: `speech_models: ['universal']` (NON `speech_model: 'best'`
  che è deprecato e causa errore a runtime pur essendo nei tipi TypeScript)

**Referral rewards: Stripe Customer Balance**
I premi referral vengono applicati come credito negativo sul Customer Balance Stripe
(`stripe.customers.createBalanceTransaction(customerId, { amount: -1900, currency: 'eur' })`).
Il credito si scala automaticamente dalla prossima fattura. Se il referrer non ha ancora
un `stripe_customer_id` (piano Free), il premio viene salvato come "pending" in
`referral_rewards.applied_at = null` e applicato al primo cron mensile successivo.

---

## 22. PATTERN E CONVENZIONI

### Struttura file

- Componenti: PascalCase, file = nome componente
- Server Actions: `camelCaseAction` suffix (es. `createDocumentAction`)
- API routes: kebab-case directory (es. `expire-documents`)
- Migrations: `NNN_nome_descrittivo.sql` con NNN a 3 cifre zero-padded
- DB columns: snake_case, timestamps sempre con timezone (`TIMESTAMPTZ`)

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

### Tipi database
`types/database.ts` è generato da `supabase gen types typescript`. Le nuove tabelle
create nelle ultime migrazioni (referral_codes/uses/rewards, voice_usage) non sono
ancora in questo file. Fino alla rigenerazione, usare cast `as any` sul client Supabase
con commento esplicativo. Comando per rigenerare:
```bash
supabase gen types typescript --project-id ivbzuhgwszkdnlsybsao > types/database.ts
```

### UX mobile-first
- Ogni componente ha layout stacked su mobile, griglia su `md+`
- Pulsanti azioni sempre raggiungibili con pollice su mobile
- Input vocale su mobile: pulsante 7×7 (size-7), icona size-3

---

## 23. COSA NON FARE (Anti-pattern)

- ❌ NON mettere logica fiscale nel client — solo server-side
- ❌ NON usare `document.id` nell'URL del link pubblico — usare `public_token`
- ❌ NON permettere di modificare un documento già inviato — crea nuova revisione
- ❌ NON loggare dati personali degli utenti (nome, email, P.IVA) nei log
- ❌ NON saltare la validazione Zod sull'output AI
- ❌ NON mostrare errori tecnici all'utente finale — messaggi human-friendly sempre
- ❌ NON fare chiamate AI sincrone che bloccano il rendering — loading state sempre
- ❌ NON usare `alert()` o `confirm()` nativi — usare componenti shadcn/ui
- ❌ NON usare `any` in TypeScript senza commento ESLint esplicativo
- ❌ NON skipare i test sui calcoli fiscali — 100% coverage obbligatoria
- ❌ NON esporre chiavi API nel client — tutto via Server Action o API Route
- ❌ NON usare `speech_model` (singolare) nell'SDK AssemblyAI — è deprecato a runtime
- ❌ NON implementare integrazioni esterne (SDI, FiC OAuth) prima del consolidamento del core

---

## 24. BUG NOTI E FIX APPLICATI

| Bug | Fix applicato |
|---|---|
| Password reset "link non valido" | Instradato PKCE code exchange attraverso `/auth/callback` (Route Handler) invece della Server Action |
| Dropdown ATECO/Client clippato da Card overflow-hidden | Radix PopoverContent (portal su document.body) |
| Qty default = 1 sulle nuove voci | Impostato `quantity: 0` in `PreventivoForm.newVoce()`, `VociTable` e `AiImportModal` |
| AssemblyAI `speech_model` deprecato → errore a runtime | Cambiato in `speech_models: ['universal']` (array) |
| Migration 018 — `column reference "code" is ambiguous` | Rinominata variabile locale `code` in `v_code` nella funzione `generate_referral_code()` |
| Overflow header mobile su /preventivi e /fatture | Layout `flex-col sm:flex-row` + testo nascosto su mobile |
| IVA default non salvata nel catalogo | `vatRate` inizializzato a `'22'` invece di `''` in `CatalogItemForm` |
| CatalogPicker inserisce voce dopo la riga vuota | Controlla se l'ultima riga è vuota e la sostituisce invece di accodarsi |
| Cliente non pre-popolato in modifica bozza | `pdfClient` query mancava `id`; `formDefaultClient` non passato a `PreventivoForm` |
| Sconto % mancante su mobile in VociTable | Aggiunta colonna "Sc.%" nella griglia mobile a 4 colonne |
| Numero preventivo non visibile in anteprima | PDF mostra "BOZZA" se null; FiscalSummary mostra `#{docNumber}` nell'header |
| Invio bloccato senza template (422) | Rimosso il blocco; `buildPdfHtml` gestisce `null` template con stili di default |
| Testo email automatico ridondante | Rimosso "o modifica"; "il preventivo allegato" → "il preventivo" (no doppio "allegato") |
| Font non visibili nell'anteprima template | Font stack corretti: `var(--font-geist-sans)` per Geist, stack completi per gli altri |
| Anteprima template identica per tutti i font | 4 preset di layout distinti applicati a preview e PDF (vedi sezione 24.1) |
| Numerazione preventivi riparte da 1 | `send-email` route non allocava `doc_number`; ora chiama `next_invoice_number` RPC prima di generare il PDF |
| Cestino disabilitato con una sola voce | Rimossa condizione `disabled={voci.length <= 1}`; `removeVoce` reinizializza con riga vuota se risultato è vuoto |
| IVA select mostrava `22%(def.)` e `22%` duplicati | Rimossa dicitura "(def.)"; `vatRates` filtrata per escludere la voce coincidente con il default |
| Totale non aggiornato svuotando un campo numerico | `NumericInput.onChange` chiama `onChange(0)` quando `raw.trim() === ''`, senza aspettare blur |

### 24.1 Template PDF — Preset di layout per font

I 4 font del template non cambiano solo il carattere, ma anche il layout del documento.
Questo è implementato sia nella **preview live** (`TemplatePreview.tsx`) che nel
**rendering PDF finale** (`lib/pdf/template.ts`).

| Font key | Stile | Header | Tabella | Note |
|---|---|---|---|---|
| `Inter` | Moderno | Split: logo sx, doc info dx | Fill leggero (α 0.10) | Baseline |
| `GeistSans` | Tecnico | Split, logo piccolo, spaziatura compatta | No fill, solo bordo inferiore 2px colorato | Usa `var(--font-geist-sans)` nel browser |
| `Helvetica` | Classico | Split, logo grande, padding generoso | Fill più marcato (α 0.18) | — |
| `Georgia` | Elegante | **Due fasce**: ragione sociale centrata + band doc-info | Fill standard, descrizioni in corsivo | Unico layout diverso |

**Nota implementativa:** il valore `font_family` salvato nel DB è la chiave (`Inter`, `GeistSans`, ecc.),
non il CSS stack. La traduzione avviene tramite `PREVIEW_FONTS` (browser) e `FONT_STACKS` (PDF).
Il font Geist nel browser usa `var(--font-geist-sans)` caricato da `next/font/google` in `layout.tsx`.

**Numerazione preventivi — flusso corretto (FIX-14):**
Il numero documento viene assegnato al momento dell'invio (non alla creazione della bozza).
**Due path di invio**, entrambi ora corretti:
1. `sendDocumentAction` (bottone "Invia" nel form) → chiama `allocateDocNumber()` ✅
2. `POST /api/documents/[id]/send-email` (SendEmailDialog) → chiama `next_invoice_number` RPC direttamente ✅

Precedentemente il path 2 non allocava il numero → sequenza non avanzava → numerazione
tornava a 001 al prossimo invio via path 1.

---

## 25. COMANDI UTILI

```bash
# Sviluppo locale
npm run dev

# Type check
npx tsc --noEmit

# Rigenerare tipi Supabase (dopo ogni nuova migrazione!)
supabase gen types typescript --project-id ivbzuhgwszkdnlsybsao > types/database.ts

# Build
npm run build

# Test
npm test
npm run test:e2e
```

---

## 26. NOTE IMPORTANTI

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
- **Piano Free:** limite di 10 documenti totali (non mensili). Dopo 10 → paywall
- **Il prodotto è in sviluppo attivo** — ogni sessione di lavoro deve essere
  orientata a migliorarlo progressivamente fino a essere pienamente funzionale e curato

---

## 27. REGOLA DI MANUTENZIONE DEL CLAUDE.md

**A fine di ogni sessione di lavoro aggiornare questo file con:**

1. ✅ Nuove feature implementate (con dettagli tecnici rilevanti)
2. 🔀 Decisioni prese (anche se non ancora implementate)
3. 🐛 Bug noti emersi durante i test
4. ⏸️ Cose rimandate e motivo
5. 🔄 Eventuali cambi di direzione (prodotto, pricing, integrazioni)

**Orario:** ogni sera alle 21:30, Claude deve chiedere all'utente il permesso
di aggiornare il CLAUDE.md prima di procedere. Non aspettare che sia l'utente
a chiederlo — l'iniziativa è di Claude.

**Se trovi punti contraddittori tra stato attuale e decisioni storiche:**
- NON eliminarli in silenzio
- Segnalarli come "decisione storica da riallineare" o "da validare"
- Aprire una discussione esplicita

**L'obiettivo è che questo file diventi la memoria permanente e affidabile del progetto,
senza dover ricostruire il contesto da chat diverse ogni volta.**
