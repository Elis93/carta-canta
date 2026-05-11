# CLAUDE.md — Memoria permanente del progetto Carta Canta

> **Fonte di verità per Claude Code.** Va aggiornato a fine di ogni sessione di lavoro con:
> nuove feature implementate, decisioni prese, bug emersi, cose rimandate, cambi di direzione.
> L'obiettivo è non dover ricostruire il contesto da chat diverse ogni volta.
>
> **Ultima sessione:** 11 maggio 2026 (sessione 3)

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
10. Un task alla volta — output sempre: file toccati + commit hash + `npx tsc --noEmit` + build verde
11. Non lasciare cast `as any` temporanei in produzione
12. Non lasciare migration non applicate — rigenerare `types/database.ts` subito dopo ogni migration

---

## 0-B. BACKUP NAS

```
NAS path:    Z:\CARTA CANTA
Remote git:  nas   (già configurato)
Comando:     git push nas master

File da ESCLUDERE sempre:
  node_modules/
  .next/
  dist/
  build/
  .claude/worktrees/
  supabase/.temp/

Quando fare backup: alla fine di ogni sessione di lavoro, DOPO aver aggiornato CLAUDE.md
Sequenza corretta:
  1. Aggiorna CLAUDE.md
  2. git add .
  3. git commit -m "backup serale GG-MM-YYYY — descrizione sessione"
  4. git push nas master
  5. git push (origin, deploy su Vercel)
```

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
| PDF | `@react-pdf/renderer` + Playwright Chromium | 4.x — Playwright per HTML→PDF |
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
Backup NAS:      Z:\CARTA CANTA  (remote git "nas" — gestire con attenzione)
Hosting:         Vercel Pro $20/mese (fra1 Frankfurt — EU data residency)
                 Abilita: Cron Jobs avanzati, build illimitate
DB:              Supabase — project ID ivbzuhgwszkdnlsybsao
URL produzione:  https://cartacanta.app
```

**Note operative:**
- Push su `master` → deploy automatico su Vercel Production entro 1-3 minuti
- Backup NAS: `git push nas master` a fine sessione
- `types/database.ts` va rigenerato dopo ogni nuova migrazione SQL
- Per forzare rigenerazione PDF su documento esistente: aggiungere `?force=1` all'URL del PDF

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
│   │   │   ├── page.tsx       # Pagina con PresetSelector + lista template
│   │   │   ├── nuovo/page.tsx
│   │   │   ├── [id]/page.tsx
│   │   │   └── _components/
│   │   │       ├── PresetSelector.tsx   # 4 card preset con mini-preview
│   │   │       ├── TemplateEditor.tsx   # Editor con gating Free/Pro
│   │   │       └── TemplatePreview.tsx  # Anteprima live browser
│   │   ├── impostazioni/      # Workspace settings
│   │   ├── abbonamento/       # Billing, upgrade, piano
│   │   └── referral/          # Programma "Porta un amico"
│   │       └── _components/ReferralPageClient.tsx
│   ├── (auth)/                # Login, signup, reset password
│   │   ├── signup/
│   │   │   ├── page.tsx       # Server wrapper (legge ?ref= da searchParams)
│   │   │   └── _components/SignupForm.tsx
│   │   └── actions.ts         # Server Actions auth (incluso referral registration)
│   ├── p/[token]/             # Pagina pubblica preventivo (link cliente, no auth)
│   ├── api/
│   │   ├── webhooks/stripe/   # Stripe webhook handler
│   │   ├── ai/extract/        # AI import endpoint (rate limited)
│   │   ├── voice/transcribe/  # POST — trascrizione audio con AssemblyAI
│   │   ├── cron/
│   │   │   ├── expire-documents/  # Scade documenti + reminder email
│   │   │   └── referral/          # Premi referral mensili (logica per piano)
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
│   │   └── templates.ts       # CRUD template + selectPresetAction + setDefaultTemplateAction
│   ├── supabase/              # client.ts, server.ts, admin.ts
│   ├── stripe/                # stripe.ts, plans.ts
│   ├── ai/                    # types.ts, import logic
│   ├── fiscal/                # calcoli.ts, arrotondamento.ts
│   ├── email/                 # send.ts, templates/
│   ├── pdf/
│   │   ├── template.ts        # buildPdfHtml — 4 layout distinti per preset
│   │   └── generate.ts        # Playwright HTML→PDF + cache Supabase Storage
│   └── utils/                 # cn(), formatCurrency(), formatDate()
├── types/
│   ├── database.ts            # Generato da Supabase CLI — NON modificare manualmente
│   └── index.ts               # Tipi applicativi custom
├── hooks/                     # useWorkspace, useDocuments, useFeatureFlag
├── middleware.ts              # Auth check + rate limiting
├── supabase/
│   ├── migrations/            # 001–021 SQL migrations
│   └── seed.sql               # Seed dati di test
├── tests/
│   ├── unit/fiscal/           # Test calcoli fiscali (100% coverage)
│   └── e2e/                   # Test flows completi
├── vercel.json                # Cron jobs config
└── CLAUDE.md                  # Questo file
```

---

## 5. VARIABILI D'AMBIENTE

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_YEARLY=
STRIPE_PRICE_TEAM_MONTHLY=
STRIPE_PRICE_TEAM_YEARLY=
STRIPE_PRICE_LIFETIME=

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
CRON_SECRET=

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
    voiceSeconds: 3600,
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
Piano Free:         €0
Piano Pro Mensile:  €19.00/mese
Piano Pro Annuale:  €182.00/anno (€15.17/mese)
Piano Team Mensile: €49.00/mese
Piano Team Annuale: €470.00/anno (€39.17/mese)
Piano Lifetime:     €299.00 one-time
```

**Template — gating Free vs Pro:**
- **Free**: scelta tra 4 preset base (Classico / Bold / Tecnico / Elegante). Un solo template.
- **Pro/Team**: personalizzazione avanzata sopra ogni preset (colore, font, logo, header/footer HTML, nota legale). Template illimitati.
- La distinzione NON è "altri template brutti per Free" — è livello di personalizzazione.

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
`owner_id`, `plan`, `stripe_customer_id`, `stripe_subscription_id`,
`billing_interval TEXT` (migration 020 — 'month' | 'year' | null),
`fiscal_regime`, `ateco_codes TEXT[]`, `validity_days`, `logo_url`, `bollo_auto`, `ritenuta_auto`.

#### `workspace_members` — team
PK composita `(workspace_id, user_id)`. Campo `accepted_at`. Ruoli: `admin | operator | viewer`.
`my_workspace_ids()` gestisce sia owner che membri.

#### `clients` — rubrica clienti
`search_vector` tsvector per full-text search. Campi: nome, email, phone, piva,
codice_fiscale, indirizzo completo, paese, tags TEXT[].

#### `templates` — template PDF
`preset_key TEXT CHECK ('classico'|'bold'|'tecnico'|'elegante')` (migration 021).
`color_primary`, `font_family`, `show_logo`, `show_watermark`, `legal_notice`,
`header_html`, `footer_html`, `is_default`.

#### `documents` — preventivi e fatture
`doc_type`: `'preventivo' | 'fattura'`. Status: `draft → sent → viewed → accepted/rejected/expired`.
`public_token`, `doc_number` (formato `NNN/YYYY`), `doc_year`, `doc_seq` (generated columns),
`search_vector`, `signature_image`, `rejection_reason`, `bonus_edilizio`, `bonus_tipo`,
`template_snapshot` (JSONB — snapshot template al momento dell'invio, include `preset_key`).
`ai_generated`, `ai_confidence`.

#### `document_items` — voci
`sort_order`, `description`, `unit`, `quantity`, `unit_price`, `discount_pct`, `vat_rate`, `total`, `bonus_tipo`.

#### `catalog_items` — listino prezzi (migration 007)
`workspace_id`, `name`, `description`, `unit`, `unit_price`, `vat_rate`, `category`, `is_active`.

#### `document_views` — tracking aperture (migration 005)
`document_id`, `viewed_at`, `user_agent`, `ip_address`.
⚠️ Questa tabella era assente nel DB remoto — applicata migration 005 manualmente nella sessione 2.

#### `invoice_sequences` — numerazione progressiva
PK `(workspace_id, year)`. Migration 012: sequenze separate per tipo. Migration 013: funzione unificata.

#### `rate_limit_events` (migration 011)

#### `referral_codes` (migration 018)
Un codice per workspace, 6 char alfanumerici. Generato da trigger su INSERT `workspaces`.

#### `referral_uses` (migration 018)
`referrer_workspace_id`, `referee_workspace_id` (UNIQUE), `code`, `used_at`.

#### `referral_rewards` (migration 018 + 020)
`workspace_id`, `referee_workspace_id` (UNIQUE), `reward_month TEXT` (formato `YYYY-MM` — migration 020),
`free_months`, `credit_amount_cents`, `stripe_balance_transaction_id`, `applied_at` (NULL = pending).
Nota: `reward_month` permette premi ricorrenti mensili (non solo one-shot).

#### `voice_usage` (migration 019)
`workspace_id`, `period TEXT` (formato `YYYY-MM`), `seconds_used`.
UNIQUE su `(workspace_id, period)`.

### Funzioni SQL rilevanti
- `is_workspace_member(workspace_id)` — helper RLS, SECURITY DEFINER
- `my_workspace_ids()` — SET di workspace accessibili (migration 018)
- `next_invoice_number(workspace, year)` — atomico
- `expire_overdue_documents()` — cron notturno
- `generate_referral_code()` — 6 char, variabile locale `v_code` (NON `code`)
- `get_or_create_referral_code(workspace_id)` — idempotente, SECURITY DEFINER
- `trg_auto_create_referral_code()` — trigger su INSERT workspaces

### Migrazioni applicate (ordine)

| # | File | Contenuto |
|---|------|-----------|
| 001 | `initial_schema` | Schema completo: workspaces, clients, templates, documents, RLS |
| 002 | `doc_number_title` | `doc_year`, `doc_seq` generated columns |
| 003 | `signer_name` | Campo nome firmatario |
| 004 | `viewed_status` | Status `viewed` nell'enum |
| 005 | `document_views` | Tabella tracking aperture ⚠️ era mancante in remoto, applicata sessione 2 |
| 006 | `notification_prefs` | Preferenze notifiche email |
| 007 | `catalog_items` | Listino prezzi |
| 008 | `fatture` | Supporto fatture |
| 009 | `signature_image` | Firma digitale |
| 010 | `rejection_reason` | Motivo rifiuto |
| 011 | `rate_limit_events` | Rate limiting DB-side |
| 012 | `invoice_sequences_per_doctype` | Sequenze per tipo documento |
| 013 | `next_invoice_unified` | Funzione unificata numerazione |
| 014 | `ateco_codes_array` | `ateco_codes TEXT[]` |
| 015 | `bonus_edilizio` | Campi bonus edilizio |
| 016 | `workspace_validity_days` | `validity_days` default |
| 017 | `storage_logos_public` | Bucket Storage loghi |
| 018 | `referral_system` | Tabelle referral + trigger + RLS + `my_workspace_ids()` |
| 019 | `voice_usage` | Tracking utilizzo vocale mensile |
| 020 | `billing_interval` | `billing_interval` su workspaces + `reward_month` su referral_rewards |
| 021 | `template_preset_key` | `preset_key TEXT CHECK(...)` su templates |

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
  // 5. Ritenuta d'acconto
  const ritenuta = opts.ritenuta_pct
    ? roundFiscale(afterDiscount * opts.ritenuta_pct / 100) : 0
  // 6. Marca da bollo (forfettari con totale > 77.47)
  const bollo = (opts.fiscal_regime === 'forfettario' && afterDiscount > 77.47) ? 2.00 : 0
  // 7. Totale finale
  const total = roundFiscale(afterDiscount + taxAmount + bollo - ritenuta)
  return { subtotal, afterDiscount, taxAmount, ritenuta, bollo, total, itemTotals }
}

export const FORFETTARIO_LEGAL_NOTICE =
  "Operazione effettuata ai sensi dell'art. 1, commi 54-89, L. 190/2014 " +
  "(Regime Forfettario) – Operazione fuori campo IVA ai sensi del comma 58, " +
  "lettera a), del medesimo articolo"

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
   → pulsante microfono per dettatura vocale
5. Aggiunge note pubbliche e/o note interne (con microfono)
6. Sistema calcola: subtotale, IVA, bollo, totale
7. Preview PDF in tempo reale (side panel desktop, tab mobile)
8. Salva bozza (auto-save ogni 30s)
9. Invia al cliente → email / link WhatsApp / link diretto
10. Documento → status "sent", genera public_token
11. Cliente apre pagina pubblica → accetta/rifiuta
12. Accettazione: salva IP + UA + timestamp → status "accepted" → notifica
```

### FLOW 2 — AI Import
```
1. Foto/PDF → API Mistral (fallback OpenAI) → voci estratte con confidence score
2. Tabella editabile con verde/giallo/rosso per confidence
3. Conferma → documento con ai_generated=true
4. Fallback: se AI fallisce → messaggio human-friendly, mai blocco
```

### FLOW 3 — Link Pubblico Cliente
```
URL: cartacanta.app/p/[public_token]  ← MAI usare document.id
- No auth, mostra preventivo in template
- Pulsanti: "✅ Accetto" / "❌ Declino" / Contatta
- Al click Accetto: modale conferma → POST → redirect grazie
- Email automatica all'artigiano
```

### FLOW 4 — Onboarding
```
Step 1/3: Ragione sociale, P.IVA, regime fiscale, ATECO
Step 2/3: Logo (opzionale)
Step 3/3: Primo preventivo (obbligatorio — First Value KPI)
→ confetti + "Invialo subito al cliente →"
```

### FLOW 5 — Upgrade Piano
```
Trigger A: 10° preventivo → banner paywall
Trigger B: AI Import → modal paywall
Trigger C: /abbonamento
→ Stripe Checkout → webhook → aggiorna plan → ?success=1
```

---

## 10. RATE LIMITING (Upstash Redis)

```typescript
const RATE_LIMITS = {
  default:    { requests: 200, window: "1m" },
  auth:       { requests: 10,  window: "15m" },
  api:        { requests: 60,  window: "1m" },
  ai_extract: { requests: 5,   window: "1m" },
  pdf:        { requests: 10,  window: "1m" },
  upload:     { requests: 10,  window: "1h" },
}
```

---

## 11. FEATURE FLAGS (Flagsmith)

```typescript
const FLAGS = {
  FEATURE_AI_IMPORT:        true,
  FEATURE_VOICE_INPUT:      true,
  FEATURE_WHATSAPP_SEND:    true,
  FEATURE_REFERRAL:         true,
  FEATURE_SDI_INTEGRATION:  false,
  FEATURE_TEAM_PLAN:        true,
  FEATURE_LIFETIME_PLAN:    true,
  FEATURE_MARKETPLACE:      false,
  FEATURE_PUBLIC_API:       false,
}
```

---

## 12. FUNZIONALITÀ IMPLEMENTATE

### Autenticazione
- Signup email/password + OAuth Google/GitHub
- Reset password via `/auth/callback` (Route Handler, NON Server Action)
- Rate limiting Upstash

### Onboarding
- Dati fiscali, regime, ATECO codes (array illimitato), logo
- Dropdown ATECO/Client usa Radix PopoverContent (portal) — evita clipping Card

### Preventivi
- CRUD completo, numerazione `NNN/YYYY` atomica
- Status workflow: draft → sent → viewed → accepted/rejected/expired
- Scadenza automatica (cron), link pubblico, firma digitale
- Vista lista + Kanban, filtri avanzati, full-text search, export CSV
- "Usa come modello" nel menu ⋮, pre-selezione cliente via `?client_id=xxx`
- Invio diretto dalla lista via `SendEmailDialog`
- Qtà default = 0 su nuove voci

### Catalogo prezzi
- CRUD con categoria, unità, prezzo, IVA
- `CatalogPicker` portal-based nel form preventivo

### Fatture
- Creazione separata + conversione preventivo → fattura

### Template PDF — 4 preset (sessione 3, completo)

I 4 template sono stati completamente riscritti per essere fedeli a render di riferimento visivi.

| Preset | Font default | Target utente | Layout chiave |
|---|---|---|---|
| **Classico** | Inter | Artigiani, imprese, installatori | Header bianco; "PREVENTIVO" 26px a destra; table header scuro pieno |
| **Bold** | Helvetica | Imprese, ristrutturazioni, artigiani visual | Header dark full-width; contact strip; badge pillola doc number; box "TOTALE DA PAGARE" |
| **Tecnico** | GeistSans | Elettricisti, idraulici, geometri, capitolati | Header uppercase + bordo 3px; strip 4 celle (Data/Scadenza/Destinatario/Totale IVA); colonna COD; totale sulla seconda riga della voce |
| **Elegante** | Georgia | Consulenti, creativi, fotografi, architetti | Logo bordato (non riempito); serif; "STUDIO · CITTÀ" sub-label; doc number grande italic; table senza fill header |

**File coinvolti:**
- `lib/pdf/template.ts` — `buildPdfHtml()` con switch su `presetKey`, 4 layout completamente distinti
- `app/(app)/template/_components/TemplatePreview.tsx` — 4 layout React per anteprima live
- `app/(app)/template/_components/PresetSelector.tsx` — 4 card con mini-preview (scale 0.4)
- `app/(app)/template/_components/TemplateEditor.tsx` — editor con gating Free/Pro
- `app/(app)/template/page.tsx` — server component con PresetSelector + lista template
- `lib/actions/templates.ts` — `selectPresetAction`, `PRESET_DEFAULTS`, schema con `preset_key`

**Gating:**
- Free: scelta tra i 4 preset base. Un template max. Nessuna personalizzazione avanzata.
- Pro/Team: colore, font, logo toggle, watermark, legal notice, header/footer HTML. Template illimitati.

**Flusso dati `preset_key`:**
1. Salvato in `templates.preset_key` (migration 021)
2. Snapshot al momento dell'invio in `documents.template_snapshot` (include `preset_key`)
3. Route PDF: legge `template_snapshot.preset_key` → fallback su `template.preset_key` → fallback su `fontFamilyToPreset(font_family)` per compat pre-021
4. Per forzare rigenerazione: `GET /api/documents/[id]/pdf?force=1`

**Nota font:**
Il valore `font_family` nel DB è la chiave (`Inter`, `GeistSans`, ecc.), non il CSS stack.
Traduzione: `PRESET_FONTS` (browser preview) e `FONT_STACKS` (PDF Playwright).

### Clienti
- Rubrica con ricerca full-text, `ClientAutocomplete` portal-based

### Input vocale (AssemblyAI)
- Microfono su: note pubbliche, note interne, descrizione voci
- Countdown 60s, quota mensile (Free: 300s, Pro/Team/Lifetime: 3600s)
- SDK v4: `speech_models: ['universal']` — NON `speech_model` (singolare, deprecato a runtime)
- Il testo viene accodato al contenuto esistente

### AI Import
- Mistral primario, OpenAI fallback — chiavi vuote in produzione (non attivato)

### Sistema referral "Porta un amico"

**Stato attuale (post sessione 2+3):**
- Codice 6 char per workspace, generato automaticamente da trigger
- Link: `https://cartacanta.app/signup?ref=CODE`
- Premio calcolato il 1° di ogni mese (cron `0 9 1 * *`)
- `billing_interval` su workspaces traccia 'month'/'year'
- `reward_month` su referral_rewards permette premi ricorrenti mensili

**Logica per piano (vedi sezione 13 per dettaglio completo):**
- Free → 1 mese Pro gratis
- Pro mensile → rinnovo non addebitato
- Pro annuale → +1 mese scadenza
- Team mensile → gratis o 50% sconto secondo tipo referral
- Team annuale → +1 mese o +2 settimane scadenza

**Pagina `/referral`:**
- Copy piano-specifico (headline, step 2, scenari)
- Tabella sinottica con righe per Team plans (2 righe ciascuna, separato da separatori)
- Statistiche: "Invitati registrati" / "Invitati abbonati" / "Benefici applicati" / "Benefici in attesa"
- Note legali: senza riferimenti a "Stripe" nel testo utente

### Webhook Stripe (sessione 2)
- `handleCheckoutCompleted`: salva `billing_interval` da `subscription.items.data[0].price.recurring.interval`
- `handleSubscriptionUpdated`: aggiorna `billing_interval`
- `handleSubscriptionDeleted`: reset `billing_interval = null`

### Email transazionali (Resend)

| Trigger | Template |
|---|---|
| Signup | welcome.tsx |
| Preventivo inviato | preventivo_cliente.tsx |
| Preventivo accettato | preventivo_accettato.tsx |
| Preventivo rifiutato | preventivo_rifiutato.tsx |
| Reminder cliente (7gg) | reminder_cliente.tsx |
| Preventivo in scadenza | scadenza_warning.tsx |
| Pagamento ok | payment_success.tsx |
| Pagamento fallito | payment_failed.tsx |

### Cron jobs (Vercel Pro)

| Endpoint | Schedule | Funzione |
|---|---|---|
| `/api/cron/expire-documents` | `0 2 * * *` | Scade documenti + reminder email |
| `/api/cron/referral` | `0 9 1 * *` | Premi referral mensili (logica per piano + billing_interval) |

---

## 13. LOGICA REFERRAL COMPLETA (da tenere in memoria)

La logica viene calcolata il **1° di ogni mese** dal cron `/api/cron/referral`.
Un premio si matura quando il referrer ha **3+ referee con abbonamento attivo** in quel momento.

| Piano referrer | Tipo referee | Beneficio |
|---|---|---|
| **Free** | Qualsiasi abbonamento attivo | 1 mese Piano Pro gratis |
| **Pro mensile** | Qualsiasi abbonamento attivo | Rinnovo mensile €19 non addebitato |
| **Pro annuale** | Qualsiasi abbonamento attivo | Scadenza abbonamento +1 mese |
| **Team mensile** | 3+ con Piano Team attivo | Rinnovo mensile €49 non addebitato |
| **Team mensile** | 3+ con Piano Pro attivo (non Team) | 50% sconto sul rinnovo (€24,50) |
| **Team annuale** | 3+ con Piano Team attivo | Scadenza +1 mese |
| **Team annuale** | 3+ con Piano Pro attivo (non Team) | Scadenza +2 settimane |

**Note implementative:**
- I premi mensili vengono salvati in `referral_rewards` con `reward_month = 'YYYY-MM'`
  — questo permette di applicare premi ricorrenti ogni mese senza UNIQUE collision.
- Se il referrer non ha `stripe_customer_id` (piano Free senza mai pagato), il premio è
  salvato con `applied_at = NULL` e applicato al cron mensile successivo.
- Per i piani mensili: credito negativo su Stripe Customer Balance
  (`stripe.customers.createBalanceTransaction(customerId, { amount: -1900, currency: 'eur' })`)
- Per i piani annuali: estensione data di scadenza diretta su Stripe

**Decisione aperta:** valutare se `referee_workspace_id` in `referral_rewards` deve essere
nullable per supportare premi pool (es. "3 referee totali" senza vincolo uno-a-uno). Attualmente
è NOT NULL UNIQUE → un referee genera un solo premio storico per il referrer.

---

## 14. 4 TEMPLATE PDF — SPECIFICHE VISIVE

Questi template sono stati disegnati su render di riferimento e devono rimanere fedeli ad essi.
NON modificare senza un nuovo set di screenshot di riferimento.

### CLASSICO (Inter)
- **Target:** artigiani, imprese, installatori generici
- **Header:** sfondo bianco, logo scuro (colore pieno) a sinistra, "PREVENTIVO" 26px/800 a destra, line-separator sotto
- **Sezione info:** "DESTINATARIO" label small caps + nome bold 13px | "DATA EMISSIONE" + data bold
- **Tabella:** header riempito scuro (colore), 4 colonne (Descrizione / Q.tà / Prezzo unit. / Totale)
- **Totali:** allineati a destra, Subtotale/IVA grigi, "TOTALE" 14px/800 con linea sottile sopra
- **Footer:** border-top 1px, testo grigio piccolo

### BOLD (Helvetica)
- **Target:** imprese, ristrutturazioni, artigiani con forte brand
- **Header:** band scura full-width (sfondo = colore), logo a sinistra, badge pillola bianca con "PREVENTIVO #NUM" a destra
- **Contact strip:** seconda riga scura con P.IVA, indirizzo, date (testo piccolo semitrasparente)
- **Info section:** box grigio chiaro con DESTINATARIO a sinistra + NUMERO PREVENTIVO grande a destra
- **Tabella:** header con fill leggero (α 0.09), 4 colonne (Descrizione lavori / Q.tà / Prezzo / Totale)
- **TOTALE:** box scuro (background = colore) con "TOTALE DA PAGARE" small caps + importo 24px/800

### TECNICO (GeistSans / monospace accenti)
- **Target:** elettricisti, idraulici, geometri, capitolati tecnici
- **Header:** sfondo bianco, nome azienda UPPERCASE 14px/800, bordo inferiore 3px solid colore, "#2026/047" grande a destra
- **Strip 4 celle:** griglia 4 colonne (Data / Scadenza / Destinatario / Totale IVA incl.) con bordi separatori
- **Tabella:** 6 colonne (Cod / Descrizione / U.M. / Q.tà / Prezzo unit. / Totale), header scuro
  - Codice riga: "01", "02", ... in monospace
  - Totale di riga mostrato sulla seconda riga della cella Descrizione in grassetto monospace
  - Ultima colonna (Totale header) presente ma vuota nelle righe
- **Totali:** full-width, etichette uppercase a sinistra, importi a destra, "TOTALE PREVENTIVO" 12px/800
- **Footer:** monospace, "Doc. #NUM · data"

### ELEGANTE (Georgia / serif)
- **Target:** consulenti, creativi, fotografi, architetti, studi
- **Header:** sfondo bianco, logo bordato (NON riempito, box con border 1.5px), nome serif 18px/700, "STUDIO · CITTÀ" sub-label 8.5px spaced caps, "Preventivo" spaced caps piccolo + "#2026/047" 30px italic a destra
- **Separatore:** linea sottile 1px `#d8d8d8`
- **Tabella:** NESSUN fill header — solo bordo inferiore 1px, header in small caps 8.5px/600 grigio chiaro
- **Righe:** testo regolare (NON italic), importi in colore neutro `#555`, separatori `#e8e8e8`
- **Totali:** "TOTALE" small caps + importo 20px/700 italic a destra
- **Footer:** testo molto chiaro `#ccc`

---

## 15. INTEGRAZIONI E INTEROPERABILITÀ

### 15.1 SDI / fatturazione elettronica _(deciso, da implementare)_
- Provider gestito da noi (es. Openapi.it), ~€0,10/fattura
- Stato: rimandato al consolidamento core

### 15.2 Fatture in Cloud OAuth _(direzione strategica, da pianificare)_
- OAuth, non API key manuale
- Stato: rimandato

### 15.3 Cloud always-on _(implementato)_
- Supabase + Vercel, sessioni PKCE

### 15.4 Local-first _(abbandonato)_
- Non implementare nulla in questa direzione

---

## 16. ROADMAP — DECISO MA RIMANDATO

### 16.0 PROSSIMA MODIFICA TEMPLATE — Styling avanzato per singolo elemento

> **Da implementare in una sessione separata. NON toccare prima di stabilizzare l'architettura preview.**

**Feature set (3 personalizzazioni per elemento, tutte Pro):**
1. **Colore del testo** — override colore per singolo elemento (nome azienda, numero doc, colonne, totale…)
2. **Font del testo** — font selector per singolo elemento (sovrascrive il font globale del preset)
3. **Dimensione del testo** — dimensione + peso per singolo elemento

**UX prevista:**
- L'utente clicca direttamente su un testo nel preview (`TemplatePreview` diventa interattivo in modalità edit)
- Appare un pannello inline/laterale dedicato con: color picker, font selector, size+weight
- Le modifiche sono persistite nel template (campo `element_styles JSONB`)
- Si propagano al PDF generato via `lib/pdf/template.ts` che legge `element_styles`

**Note tecniche:**
- Richiede migration per aggiungere `element_styles JSONB` alla tabella `templates`
- Gli elementi identificabili: `company_name`, `doc_number`, `doc_type_label`, `table_header`, `table_body`, `totals`, `footer`
- La UI "prossimamente" in `TemplateEditor.tsx` può essere aggiunta quando si vuole anticipare visivamente la feature

---

## 16. ROADMAP — DECISO MA RIMANDATO

| Feature | Note |
|---|---|
| **Team collaboration** | DB pronto, manca UX inviti |
| **Portale cliente** | Diverso da p/[token] |
| **E-signature certificata** | Firma semplice già presente |
| **SDI / fatturazione** | Sezione 15.1 |
| **Fatture in Cloud OAuth** | Sezione 15.2 |
| **Notifiche push mobile** | — |
| **Dashboard analytics avanzata** | KPI base già presenti |
| **Import CSV/Excel** | AI import già parziale |
| **Multi-lingua PDF** | Fase 2 |
| **App mobile nativa** | Valutare dopo traction |
| **Marketplace ATECO** | Fase 3 |
| **Public API** | Fase 3 |

---

## 17. PROBLEMI NOTI / DA SISTEMARE

### UX / Form

| Problema | Descrizione | Priorità |
|---|---|---|
| **Form cliente — campi mancanti** | Servono email e telefono nel form creazione cliente | Alta |
| **Label campo fiscale** | Va rinominato "Partita IVA / Codice Fiscale" | Media |
| **Separazione bozze / preventivi** | Manca distinzione chiara in UI | Alta |
| **Numerazione bozze separata** | Bozze → "Bozza 001", preventivi emessi → "001/2026" | Alta |
| **Layout mobile pagina bozza** | Overflow e testi tagliati ("Invia al cliente", "Duplica") | Alta |

### Dashboard

| Problema | Descrizione | Priorità |
|---|---|---|
| **KPI "preventivi di questo mese"** | Conta anche le bozze — deve contare solo gli inviati | Alta |
| **Acceptance rate** | Demoralizzante per utenti nuovi — contestualizzare | Media |
| **Recent activities bozze** | Non mostrate bene nelle attività recenti | Bassa |

### Autenticazione

| Problema | Descrizione | Priorità |
|---|---|---|
| **Google OAuth → sessione** | A volte chiede ancora credenziali post-OAuth | Alta |

### Template / PDF

| Problema | Descrizione | Priorità |
|---|---|---|
| **Logo PNG nel PDF** | Logo caricato non sempre visibile correttamente | Alta |

### Input vocale

| Problema | Descrizione | Priorità |
|---|---|---|
| **Errori nei test reali** | Monitorare qualità trascrizioni italiano | Media |

---

## 18. DEBITO TECNICO

### 18.1 ATECO — soluzione ponte
- `ateco_codes TEXT[]` nel DB, ma alcuni punti usano ancora `ateco_code` singolo
- Da allineare: UI + DB + logica

### 18.2 Termini di pagamento / scadenze
- Manca la parte di reminder e integrazione pagamenti

### 18.3 `types/database.ts` — stato aggiornato ✅
- Rigenerato nella sessione 2 dopo migration 021
- Include: `referral_codes`, `referral_uses`, `referral_rewards`, `voice_usage`, `preset_key`
- Cast `as any` rimossi da webhook e template actions
- **Prossima rigenerazione necessaria dopo ogni nuova migration:**
  ```bash
  npx supabase gen types typescript --project-id ivbzuhgwszkdnlsybsao > types/database.ts
  ```
  _(usare `npx supabase` se `supabase` CLI non è installato globalmente)_

### 18.4 AI import disabilitato in produzione
- `OPENAI_API_KEY` e `MISTRAL_API_KEY` vuote — da attivare quando pronto

### 18.5 PostHog / Flagsmith / Sentry
- Componenti presenti ma chiavi non configurate — non tracciano nulla in produzione

### 18.6 INET → TEXT per ip_address / accepted_ip _(opzionale)_
- Campo `ip_address` su `document_views` e `accepted_ip` su `documents` sono INET
- Valutare migrazione a TEXT per semplicità (decisione aperta, non urgente)

---

## 19. SECURITY HEADERS (next.config.ts)

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

## 20. TESTING — REQUISITI MINIMI

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

## 21. DEPLOYMENT

```
Branch master  → Vercel Production (cartacanta.app) — deploy automatico
PRs            → Vercel Preview automatico

Region: fra1 (Frankfurt — EU data residency)
Timeout cron:  5 min (Vercel Pro)
```

---

## 22. DECISIONI ARCHITETTURALI FISSE

1. **Server Actions per mutazioni** — no client-side fetch su dati sensibili
2. **Supabase RLS è la prima linea di sicurezza**
3. **Il calcolo fiscale avviene SEMPRE server-side** (validazione Zod)
4. **I PDF vengono generati on-demand** e cachati su Supabase Storage (URL firmato 1h)
5. **L'AI output viene sempre validato con schema Zod**
6. **Feature flags controllano l'accesso** alle feature
7. **`public_token` nell'URL pubblico** — NON `document.id`
8. **Il numero fattura viene assegnato atomicamente** — no race condition
9. **`preset_key` determina il layout** — `font_family` è solo override Pro del font
10. **`template_snapshot` congela il template** al momento dell'invio — il PDF usa sempre lo snapshot

### Note su decisioni specifiche

**Auth: PKCE con Route Handler**
`exchangeCodeForSession(code)` in `/auth/callback/route.ts`, NON in Server Action.

**Dropdown: Radix Portal**
`ClientAutocomplete` e `AtecoMultiSelect` usano `<PopoverContent>` (portal su `document.body`)
perché `Card` ha `overflow-hidden` hardcoded.

**Voice input: AssemblyAI**
`speech_models: ['universal']` (array) — NON `speech_model` singolare (deprecato a runtime).

**Referral rewards: Stripe Customer Balance**
`stripe.customers.createBalanceTransaction(customerId, { amount: -1900, currency: 'eur' })`.
Si scala automaticamente dalla prossima fattura.

**Template PDF: architettura preset_key**
Il dispatch avviene in `buildPdfHtml()` con `switch(presetKey)`.
Ogni preset ha il proprio blocco HTML completamente indipendente (no props condivisi).
Questo permette layout strutturalmente diversi senza conditional sparsi.

---

## 23. PATTERN E CONVENZIONI

- Componenti: PascalCase
- Server Actions: `camelCaseAction` suffix
- API routes: kebab-case
- Migrations: `NNN_nome.sql` zero-padded
- DB columns: snake_case, timestamp con timezone
- Server Action: mutazioni form
- Route Handler: cookie (auth), cron, webhook, upload, export
- `createClient()`: rispetta RLS | `createAdminClient()`: bypassa RLS (solo admin/cron)
- Mobile-first: layout stacked su mobile, griglia su `md+`

---

## 24. COSA NON FARE

- ❌ NON logica fiscale nel client
- ❌ NON `document.id` nell'URL pubblico — usare `public_token`
- ❌ NON modificare documento già inviato — crea revisione
- ❌ NON loggare dati personali
- ❌ NON saltare validazione Zod sull'output AI
- ❌ NON errori tecnici all'utente finale
- ❌ NON `any` in TypeScript senza commento ESLint
- ❌ NON skipare test fiscali — 100% coverage
- ❌ NON `speech_model` (singolare) nell'SDK AssemblyAI
- ❌ NON integrazioni esterne prima del consolidamento core
- ❌ NON toccare i 4 layout template senza screenshot di riferimento aggiornati
- ❌ NON fare commit senza `npx tsc --noEmit` verde

---

## 25. BUG NOTI E FIX APPLICATI

| Bug | Fix applicato |
|---|---|
| Password reset "link non valido" | PKCE code exchange in Route Handler `/auth/callback` |
| Dropdown ATECO/Client clippato | Radix PopoverContent (portal) |
| Qty default = 1 sulle nuove voci | `quantity: 0` in PreventivoForm, VociTable, AiImportModal |
| AssemblyAI `speech_model` deprecato | `speech_models: ['universal']` (array) |
| Migration 018 — `code` ambiguous | Variabile `v_code` in `generate_referral_code()` |
| Overflow header mobile | `flex-col sm:flex-row` + testo nascosto su mobile |
| IVA default non salvata nel catalogo | `vatRate` inizializzato a `'22'` |
| CatalogPicker inserisce dopo riga vuota | Controlla ultima riga vuota e la sostituisce |
| Cliente non pre-popolato in modifica bozza | `pdfClient` query mancava `id` |
| Sconto % mancante su mobile VociTable | Colonna "Sc.%" aggiunta nella griglia mobile |
| Numero preventivo non visibile in anteprima | PDF mostra "BOZZA" se null |
| Invio bloccato senza template (422) | `buildPdfHtml` gestisce `null` template |
| Testo email ridondante | Rimosso "o modifica", "il preventivo allegato" → "il preventivo" |
| Font non visibili nell'anteprima | Font stack corretti per tutti i preset |
| Anteprima template identica per tutti | 4 preset layout distinti in preview e PDF |
| Numerazione preventivi riparte da 1 | `send-email` route chiama `next_invoice_number` RPC |
| Cestino disabilitato con una sola voce | Rimossa condizione; reinizializza riga vuota |
| IVA select con duplicati "22%(def.)" | Rimossa dicitura; filtrata voce coincidente |
| Totale non aggiornato svuotando campo | `NumericInput.onChange` chiama `onChange(0)` su stringa vuota |
| Cast `as any` nel webhook Stripe | Rimossi dopo rigenerazione `types/database.ts` |
| `document_views` assente in remoto | Migration 005 applicata manualmente su Supabase SQL Editor |
| Etichette statistiche referral poco chiare | Rinominate: Invitati registrati / Invitati abbonati / Benefici applicati / Benefici in attesa |
| "dalla fattura Stripe" nel copy legale referral | Rimosso — ora "dalla prossima fattura" |
| SYNOPTIC_RULES Team su una riga con separatore `·` | Struttura `rows[]` per piano — ogni condizione/beneficio su riga separata |

---

## 26. SESSIONE 3 — 11 MAGGIO 2026 — RIEPILOGO

### Cosa è stato fatto

**Template PDF (completo):**
- Migration 021: `preset_key TEXT CHECK(...)` su `templates`
- `types/database.ts` rigenerato — `preset_key` nel tipo `TemplateRow`
- `lib/actions/templates.ts`: aggiunto `preset_key` a schema, `PRESET_DEFAULTS`, `selectPresetAction`
- `app/(app)/template/page.tsx`: redesign con `PresetSelector` + sezione Pro bloccata per Free
- `app/(app)/template/_components/PresetSelector.tsx`: NUOVO — 4 card con mini-preview scalata (0.4x)
- `app/(app)/template/_components/TemplateEditor.tsx`: redesign con gating Free/Pro
- `app/(app)/template/[id]/page.tsx` e `nuovo/page.tsx`: passaggio `isPro` all'editor
- `lib/pdf/template.ts`: riscrittura completa — 4 layout HTML indipendenti per preset
- `app/(app)/template/_components/TemplatePreview.tsx`: riscrittura completa — 4 layout React
- Route handlers aggiornati con `preset_key`: `api/documents/[id]/pdf`, `api/p/[token]/pdf`, `api/documents/[id]/send-email`

**Sezione referral:**
- `ReferralPageClient.tsx`: redesign completo con copy piano-specifico
- `SYNOPTIC_RULES`: struttura `{plan, rows[]}` per Team — ogni coppia condizione/beneficio su riga propria
- Statistiche rinominate: Invitati registrati / Invitati abbonati / Benefici applicati / Benefici in attesa
- Legal notice: rimosso "dalla fattura Stripe" → "dalla prossima fattura"

### Commit principali sessione 3
- `2051125` — feat(pdf): rewrite 4 template presets faithful to reference designs
- `17c45ee` — fix(referral): remove 'Stripe' from legal notice copy
- `0a043a2` — fix(referral): rename stats labels to clearer copy
- `b950fb5` — fix(referral): fix SYNOPTIC_RULES rendering for multi-row Team plans

### Cose aperte dopo sessione 3

| # | Punto | Stato |
|---|---|---|
| 1 | **Numerazione bozze separata**: bozze → "Bozza 001", preventivi emessi → "001/2026" | ❌ Aperto |
| 2 | **Layout mobile pagina bozza**: overflow testi ("Invia al cliente", "Duplica") | ❌ Aperto |
| 3 | **Verifica visiva template**: confrontare PDF generato con screenshot di riferimento | ✅ Risolto — template riscritti fedeli agli screenshot; verifica visiva finale è azione utente sull'app live |
| 4 | **Logo PNG nel PDF**: verifica resa del logo reale nei 4 preset | ❌ Aperto — `fetchLogoBase64` gestisce il pre-fetch, ma resa specifica da testare con logo reale |
| 5 | `referee_workspace_id` nullable — decisione di prodotto | ❌ Decisione aperta |
| 6 | INET → TEXT migration per `ip_address` — pulizia tipi | ❌ Opzionale |

---

## 27-B. SESSIONE 4 — 11 MAGGIO 2026 — RIEPILOGO

### Cosa è stato fatto

**Sezione template — refactor funzionale e di copy:**

- **Migration 022** (`template_logo_position.sql`): aggiunge `logo_position TEXT DEFAULT 'left' CHECK('left','right')` e `number_format TEXT`  
  ✅ **Applicata manualmente via Supabase SQL Editor** (sessione 5 — 11 maggio 2026)
- `types/database.ts`: rigenerato via `npx supabase gen types typescript` dopo applicazione migration 022

**Feature Pro implementate:**
- **Anteprima ingrandita**: click sulla mini-preview in `PresetSelector` → modale con preview a schermo + bottone "Usa questo layout"
- **Posizione logo sinistra/destra**: toggle nel `TemplateEditor` Pro — si riflette in preview live e nel PDF generato (tutti e 4 i preset)
- **Branding "Generato con Carta Canta"**: ora condizionale — Pro può nasconderlo via toggle (default: visibile); Free: sempre visibile; si applica al footer text (NON al watermark diagonale che era rimosso)
- **Font personalizzato**: già era Pro — ora etichettato correttamente nel copy
- **Nota legale / footer**: già era Pro — copy aggiornato
- **HTML intestazione/piè di pagina**: già era Pro — raggruppato in `<details>` avanzato
- **Formato numerazione custom**: campo UI aggiunto ma disabilitato con badge "prossimamente" — stored nel DB per uso futuro
- **Template multipli**: già implementato (FREE_TEMPLATE_LIMIT = 1)

**Gating Free/Pro ristrutturato:**
- Free: colore brand ✅ + logo toggle ✅ + scelta preset ✅ — ora accessibili senza lock
- Pro: posizione logo + font + watermark/branding + nota legale + HTML avanzato + numerazione + template multipli
- `lib/actions/templates.ts`: `show_watermark` forzato a `true` per Free; campi Pro ignorati server-side per Free

**Copy aggiornato:**
- `TemplateEditor.tsx`: upsell block Pro con lista feature corretta (rimuove "logo" dal Pro, aggiunge "posizione logo", "branding", "template multipli")
- `page.tsx`: sezione Free mostra il template esistente con bottone "Modifica" + upsell banner aggiornato

**Feature futura tracciata:**
- Sezione 16.0 in CLAUDE.md: editing inline font/dimensione per singolo elemento del template

### Commit sessione 4
- `40f2070` — feat(template): logo position, modal preview, Free/Pro gating refactor, branding control

### Commit sessione 5 (verifica finale + tipi)
- `types/database.ts` rigenerato da DB remoto post-migration 022 — `logo_position` e `number_format` ora auto-generati, non più manuali
- tsc --noEmit ✅ · build ✅

### Cose aperte dopo sessione 4–5
1. Numerazione bozze separata (bozze → "Bozza 001", preventivi emessi → "001/2026")
2. Layout mobile pagina bozza (overflow testi: "Invia al cliente", "Duplica")
3. Logo PNG nel PDF — test con logo reale
4. `referee_workspace_id` nullable — decisione aperta
5. INET → TEXT — opzionale

---

## 27. COMANDI UTILI

```bash
# Sviluppo locale
npm run dev

# Type check
npx tsc --noEmit

# Rigenerare tipi Supabase (OBBLIGATORIO dopo ogni nuova migrazione)
npx supabase gen types typescript --project-id ivbzuhgwszkdnlsybsao > types/database.ts

# Build
npm run build

# Test
npm test
npm run test:e2e

# Backup NAS
git push nas master

# Forzare rigenerazione PDF per documento (bypassa cache)
GET /api/documents/[id]/pdf?force=1
```

---

## 28. REGOLA DI MANUTENZIONE DEL CLAUDE.md

**A fine di ogni sessione aggiornare con:**
1. ✅ Nuove feature implementate (con dettagli tecnici e commit hash)
2. 🔀 Decisioni prese
3. 🐛 Bug noti emersi
4. ⏸️ Cose rimandate e motivo
5. 🔄 Cambi di direzione

**Poi eseguire il backup NAS prima di chiudere.**

**Se trovi punti contraddittori:** non eliminarli in silenzio — segnalarli come
"decisione storica da riallineare" e aprire discussione esplicita.
