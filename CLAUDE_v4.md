# CLAUDE.md v4.0 — CARTA CANTA
## Documento Master per Claude Code — Aprile 2026
## ⚠️ LEGGERE PRIMA DI OGNI SESSIONE DI SVILUPPO

---

## 0. REGOLE DI COMPORTAMENTO PER CLAUDE CODE

1. Leggi TUTTO questo file prima di scrivere una riga di codice
2. NON chiedere conferma per ogni singola decisione — questo documento è la fonte di verità
3. Se un'informazione non è qui → applicare best practice 2026 del tech stack scelto
4. MAI usare `any` in TypeScript — tutto tipato con Zod e tipi generati da Supabase
5. MAI esporre chiavi API nel client — tutto passa da Server Actions o API Routes
6. MAI skipare i test sui calcoli fiscali — copertura 100% obbligatoria
7. Commit atomici con conventional commits: feat/fix/chore/docs/test
8. Ogni feature va sotto feature flag Flagsmith prima del deploy

---

## 1. IDENTITÀ DEL PROGETTO

**Nome prodotto:** Carta Canta
**Tagline:** "Preventivi professionali in 60 secondi. Senza Excel, senza carta."
**Target primario:** Artigiani italiani (idraulici, elettricisti, falegnami, imbianchini, geometri freelance)
**Mercato iniziale:** Italia → espansione EU per fasi (roadmap separata)
**URL prodotto:** https://cartacanta.app
**Stack lingua default:** it-IT

---

## 2. TECH STACK — VERSIONI ESATTE

```
Framework:     Next.js 15 (App Router, TypeScript strict)
Database:      Supabase (PostgreSQL 16, Auth, Storage, Realtime)
Hosting:       Vercel (Edge Functions, ISR)
UI:            shadcn/ui + Tailwind CSS v4
Pagamenti:     Stripe (subscriptions + one-time + tax)
Email:         Resend + React Email
Analytics:     PostHog (self-hosted EU region)
Feature Flags: Flagsmith (cloud free tier)
Rate Limiting: Upstash Redis (sliding window)
AI:            OpenAI GPT-4o-mini (primary) → Mistral-small (fallback)
PDF:           Playwright (headless, serverless-compatible)
Testing:       Vitest (unit) + Playwright (E2E) + axe-core (a11y)
CI/CD:         GitHub Actions → Vercel preview → Vercel prod
Monitoraggio:  Sentry (free) + UptimeRobot (free)
```

---

## 3. STRUTTURA PROGETTO

```
carta-canta/
├── app/
│   ├── (marketing)/           # Landing page, pricing, blog — pubbliche
│   │   ├── page.tsx           # Homepage
│   │   ├── prezzi/page.tsx    # Pricing page
│   │   ├── blog/              # MDX blog
│   │   └── [ateco]/page.tsx   # Pagine SEO programmatiche per ATECO
│   ├── (app)/                 # App autenticata
│   │   ├── layout.tsx         # Shell con sidebar + header
│   │   ├── dashboard/         # Home app (KPI, attività recente)
│   │   ├── preventivi/        # Lista + creazione + dettaglio
│   │   ├── fatture/           # Lista fatture (Fase 2)
│   │   ├── clienti/           # Rubrica clienti
│   │   ├── template/          # Gestione template
│   │   ├── impostazioni/      # Workspace settings
│   │   └── abbonamento/       # Billing, upgrade, piano
│   ├── (auth)/                # Login, signup, reset password
│   ├── p/[token]/             # Pagina pubblica preventivo (link cliente)
│   ├── api/
│   │   ├── webhooks/stripe/   # Stripe webhook handler
│   │   ├── ai/extract/        # AI import endpoint (rate limited)
│   │   ├── documents/[id]/pdf/ # PDF generation endpoint
│   │   └── health/            # Health check per UptimeRobot
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── preventivo/            # Form, preview, items table
│   ├── pdf/                   # React component per PDF template
│   ├── dashboard/             # KPI cards, charts
│   └── shared/                # Header, sidebar, modals, toasts
├── lib/
│   ├── supabase/              # client.ts, server.ts, admin.ts
│   ├── stripe/                # stripe.ts, plans.ts
│   ├── ai/                    # extract.ts, fallback.ts
│   ├── pdf/                   # generate.ts (Playwright)
│   ├── fiscal/                # calcoli.ts, arrotondamento.ts
│   ├── email/                 # templates/, send.ts
│   └── utils/                 # cn(), formatCurrency(), formatDate()
├── types/
│   ├── database.ts            # Generato da Supabase CLI
│   └── index.ts               # Tipi applicativi custom
├── hooks/                     # useWorkspace, useDocuments, useFeatureFlag
├── middleware.ts              # Auth check + rate limiting + i18n
├── supabase/
│   ├── migrations/            # SQL migrations ordinate
│   └── seed.sql               # Seed dati di test
└── tests/
    ├── unit/fiscal/           # Test calcoli fiscali (100% coverage)
    └── e2e/                   # Test flows completi
```

---

## 4. VARIABILI D'AMBIENTE RICHIESTE

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # Solo server-side

# Stripe
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=           # price_xxx
STRIPE_PRICE_PRO_YEARLY=
STRIPE_PRICE_TEAM_MONTHLY=
STRIPE_PRICE_TEAM_YEARLY=
STRIPE_PRICE_LIFETIME=

# OpenAI
OPENAI_API_KEY=

# Mistral (fallback AI)
MISTRAL_API_KEY=

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@send.cartacanta.app
RESEND_FROM_NAME=Carta Canta

# Upstash Redis (rate limiting)
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# PostHog
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com

# Flagsmith
NEXT_PUBLIC_FLAGSMITH_KEY=

# Sentry
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=

# App
NEXT_PUBLIC_APP_URL=https://cartacanta.app
NEXT_PUBLIC_APP_NAME=Carta Canta
```

---

## 5. DATABASE SCHEMA COMPLETO

```sql
-- ENUMS
CREATE TYPE plan_type      AS ENUM ('free','pro','team','lifetime');
CREATE TYPE fiscal_regime  AS ENUM ('forfettario','ordinario','minimi');
CREATE TYPE doc_status     AS ENUM ('draft','sent','accepted','rejected','expired');
CREATE TYPE user_role      AS ENUM ('admin','operator','viewer');
CREATE TYPE currency_code  AS ENUM ('EUR','GBP','CHF','PLN','USD');

-- WORKSPACES
CREATE TABLE workspaces (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                    TEXT NOT NULL,
  slug                    TEXT UNIQUE NOT NULL,
  owner_id                UUID NOT NULL REFERENCES auth.users(id),
  plan                    plan_type NOT NULL DEFAULT 'free',
  stripe_customer_id      TEXT,
  stripe_subscription_id  TEXT,
  subscription_ends_at    TIMESTAMPTZ,
  fiscal_regime           fiscal_regime NOT NULL DEFAULT 'forfettario',
  ateco_code              TEXT,
  piva                    TEXT,
  ragione_sociale         TEXT,
  indirizzo               TEXT,
  cap                     TEXT,
  citta                   TEXT,
  provincia               CHAR(2),
  logo_url                TEXT,
  ui_language             CHAR(5)  NOT NULL DEFAULT 'it-IT',
  default_currency        currency_code NOT NULL DEFAULT 'EUR',
  invoice_prefix          TEXT     NOT NULL DEFAULT '',
  invoice_counter         INT      NOT NULL DEFAULT 0,
  bollo_auto              BOOLEAN  NOT NULL DEFAULT true,
  ritenuta_auto           BOOLEAN  NOT NULL DEFAULT false,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

-- WORKSPACE MEMBERS
CREATE TABLE workspace_members (
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role          user_role NOT NULL DEFAULT 'operator',
  invited_by    UUID REFERENCES auth.users(id),
  invited_at    TIMESTAMPTZ DEFAULT now(),
  accepted_at   TIMESTAMPTZ,
  PRIMARY KEY   (workspace_id, user_id)
);

-- CLIENTS
CREATE TABLE clients (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  email         TEXT,
  phone         TEXT,
  piva          TEXT,
  codice_fiscale TEXT,
  indirizzo     TEXT,
  cap           TEXT,
  citta         TEXT,
  provincia     CHAR(2),
  paese         CHAR(2) NOT NULL DEFAULT 'IT',
  notes         TEXT,
  tags          TEXT[],
  search_vector tsvector GENERATED ALWAYS AS (
    to_tsvector('italian', coalesce(name,'')||''||coalesce(email,'')||''||coalesce(phone,''))
  ) STORED,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- TEMPLATES
CREATE TABLE templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  description     TEXT,
  header_html     TEXT,
  footer_html     TEXT,
  color_primary   CHAR(7)  DEFAULT '#1a1a2e',
  font_family     TEXT     DEFAULT 'Inter',
  show_logo       BOOLEAN  DEFAULT true,
  show_watermark  BOOLEAN  DEFAULT false,
  legal_notice    TEXT,
  is_default      BOOLEAN  DEFAULT false,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- DOCUMENTS (preventivi + fatture)
CREATE TABLE documents (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id           UUID REFERENCES clients(id) ON DELETE SET NULL,
  template_snapshot   JSONB,
  doc_type            TEXT     NOT NULL DEFAULT 'preventivo',
  status              doc_status NOT NULL DEFAULT 'draft',
  doc_number          TEXT,
  title               TEXT     NOT NULL,
  notes               TEXT,
  internal_notes      TEXT,
  document_language   CHAR(5)  NOT NULL DEFAULT 'it-IT',
  validity_days       INT      DEFAULT 30,
  payment_terms       TEXT     DEFAULT '30 giorni',
  currency            currency_code NOT NULL DEFAULT 'EUR',
  exchange_rate       DECIMAL(10,6) NOT NULL DEFAULT 1.0,
  subtotal            DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_pct        DECIMAL(5,2)  DEFAULT 0,
  discount_fixed      DECIMAL(10,2) DEFAULT 0,
  tax_amount          DECIMAL(10,2) NOT NULL DEFAULT 0,
  bollo_amount        DECIMAL(10,2) NOT NULL DEFAULT 0,
  total               DECIMAL(10,2) NOT NULL DEFAULT 0,
  vat_rate_default    DECIMAL(5,2),
  ritenuta_pct        DECIMAL(5,2),
  public_token        TEXT UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'),
  accepted_at         TIMESTAMPTZ,
  accepted_ip         INET,
  accepted_ua         TEXT,
  sent_at             TIMESTAMPTZ,
  expires_at          TIMESTAMPTZ,
  pdf_url             TEXT,
  ai_generated        BOOLEAN DEFAULT false,
  ai_confidence       DECIMAL(3,2),
  created_by          UUID REFERENCES auth.users(id),
  search_vector       tsvector GENERATED ALWAYS AS (
    to_tsvector('italian', coalesce(title,'')||''||coalesce(notes,''))
  ) STORED,
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_doc_number_unique ON documents(workspace_id, doc_number)
  WHERE doc_number IS NOT NULL;
CREATE INDEX idx_documents_workspace_status  ON documents(workspace_id, status);
CREATE INDEX idx_documents_workspace_created ON documents(workspace_id, created_at DESC);
CREATE INDEX idx_documents_public_token      ON documents(public_token) WHERE public_token IS NOT NULL;
CREATE INDEX idx_documents_search            ON documents USING GIN(search_vector);
CREATE INDEX idx_clients_workspace           ON clients(workspace_id);
CREATE INDEX idx_clients_search              ON clients USING GIN(search_vector);

-- DOCUMENT ITEMS
CREATE TABLE document_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  sort_order    INT  NOT NULL DEFAULT 0,
  description   TEXT NOT NULL,
  unit          TEXT DEFAULT 'pz',
  quantity      DECIMAL(10,3) NOT NULL DEFAULT 1,
  unit_price    DECIMAL(10,2) NOT NULL DEFAULT 0,
  discount_pct  DECIMAL(5,2)  DEFAULT 0,
  vat_rate      DECIMAL(5,2),
  total         DECIMAL(10,2) NOT NULL DEFAULT 0,
  ai_generated  BOOLEAN DEFAULT false,
  ai_confidence DECIMAL(3,2)
);

-- INVOICE SEQUENCES
CREATE TABLE invoice_sequences (
  workspace_id  UUID     NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  year          SMALLINT NOT NULL,
  last_number   INT      NOT NULL DEFAULT 0,
  PRIMARY KEY   (workspace_id, year)
);

CREATE OR REPLACE FUNCTION next_invoice_number(p_workspace UUID, p_year SMALLINT)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_next INT;
BEGIN
  INSERT INTO invoice_sequences(workspace_id,year,last_number) VALUES(p_workspace,p_year,1)
  ON CONFLICT(workspace_id,year)
  DO UPDATE SET last_number = invoice_sequences.last_number + 1
  RETURNING last_number INTO v_next;
  RETURN v_next;
END;$$;

-- RLS
ALTER TABLE workspaces         ENABLE ROW LEVEL SECURITY;
ALTER TABLE workspace_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients            ENABLE ROW LEVEL SECURITY;
ALTER TABLE templates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents          ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_items     ENABLE ROW LEVEL SECURITY;

-- Workspaces: visibili solo ai propri membri
CREATE POLICY ws_access ON workspaces FOR ALL USING (
  owner_id = auth.uid() OR
  id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND accepted_at IS NOT NULL)
);
-- Clients, templates, documents: ereditano dal workspace
CREATE POLICY clients_ws   ON clients    FOR ALL USING (workspace_id IN (SELECT id FROM workspaces));
CREATE POLICY templates_ws ON templates  FOR ALL USING (workspace_id IN (SELECT id FROM workspaces));
CREATE POLICY docs_ws      ON documents  FOR ALL USING (workspace_id IN (SELECT id FROM workspaces));
CREATE POLICY items_doc    ON document_items FOR ALL USING (
  document_id IN (SELECT id FROM documents)
);
-- Documenti pubblici via token
CREATE POLICY docs_public ON documents FOR SELECT USING (
  public_token IS NOT NULL AND status IN ('sent','accepted')
);
```

---

## 6. PIANI E FEATURE GATING

```typescript
// lib/stripe/plans.ts
export const PLANS = {
  free: {
    maxDocuments: 10,
    maxTemplates: 1,
    aiImport: false,
    watermark: true,
    teamMembers: 0,
    approvalWorkflow: false,
  },
  pro: {
    maxDocuments: Infinity,
    maxTemplates: Infinity,
    aiImport: true,
    watermark: false,
    teamMembers: 0,
    approvalWorkflow: false,
  },
  team: {
    maxDocuments: Infinity,
    maxTemplates: Infinity,
    aiImport: true,
    watermark: false,
    teamMembers: 5,
    approvalWorkflow: true,
  },
  lifetime: { /* stesso di pro */ }
} as const
```

---

## 7. MOTORE FISCALE — REGOLE INVIOLABILI

```typescript
// lib/fiscal/calcoli.ts

// ARROTONDAMENTO: sempre round half up — MAI toFixed() — MAI banker's rounding
export function roundFiscale(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100
}

// CALCOLO DOCUMENT: ordine OBBLIGATORIO
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

## 8. FLOWS COMPLETI (User Stories)

### FLOW 1 — Creazione Preventivo Manuale

```
1. Utente clicca FAB "+" o "Nuovo preventivo"
2. Apre modal/pagina: seleziona cliente (autocomplete) o crea nuovo
3. Seleziona template (default se uno solo)
4. Aggiunge voci: descrizione, qtà, UM, prezzo, IVA per voce
   → calcolo real-time al cambio di ogni campo
   → tooltip su "Unità di misura": pz/mq/ml/ore/kg/gg/mc
5. Aggiunge note pubbliche e/o note interne
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
7. Fallback: se OpenAI fallisce → tenta Mistral-small → se fallisce → mostra
   "AI non disponibile, compila manualmente" (mai bloccare l'utente)
```

### FLOW 3 — Link Pubblico Cliente

```
URL: cartacanta.app/p/[public_token]
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
  → Pricing page in-app con 3 piani

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

## 9. RATE LIMITING (Upstash Redis)

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

## 10. FEATURE FLAGS (Flagsmith)

```typescript
// Flags da creare in Flagsmith PRIMA del deploy
const FLAGS = {
  FEATURE_AI_IMPORT:        true,   // kill switch OpenAI
  FEATURE_WHATSAPP_SEND:    true,   // kill switch WhatsApp
  FEATURE_SDI_INTEGRATION:  false,  // Fase 2 — off per ora
  FEATURE_TEAM_PLAN:        true,
  FEATURE_LIFETIME_PLAN:    true,
  FEATURE_MARKETPLACE:      false,  // Fase 3
  FEATURE_PUBLIC_API:       false,  // Fase 3
}
```

---

## 11. PIANI PREZZI STRIPE

```
Piano Free:        €0 — nessun prodotto Stripe (solo DB flag)
Piano Pro Mensile: €19.00/mese — Stripe recurring
Piano Pro Annuale: €182.00/anno (€15.17/mese) — Stripe recurring
Piano Team Mensile: €49.00/mese — Stripe recurring
Piano Team Annuale: €470.00/anno (€39.17/mese) — Stripe recurring
Piano Lifetime:    €299.00 — Stripe one-time payment
```

---

## 12. EMAIL TRANSAZIONALI (Resend + React Email)

| Trigger | Template | Subject |
|---|---|---|
| Signup | welcome.tsx | "Benvenuto in Carta Canta 🎉" |
| Preventivo inviato (al cliente) | preventivo_cliente.tsx | "[Ragione Sociale] ti ha inviato un preventivo" |
| Preventivo accettato (all'artigiano) | preventivo_accettato.tsx | "🎉 [Nome cliente] ha accettato il tuo preventivo!" |
| Preventivo rifiutato | preventivo_rifiutato.tsx | "Il cliente ha rifiutato il preventivo" |
| Reminder cliente (dopo 7gg) | reminder_cliente.tsx | "Hai ancora bisogno di questo preventivo?" |
| Pagamento ok | payment_success.tsx | "Piano [X] attivato — grazie!" |
| Pagamento fallito | payment_failed.tsx | "Problema con il pagamento — aggiorna il metodo" |
| Preventivo in scadenza | scadenza_warning.tsx | "Il tuo preventivo scade domani" |

---

## 13. SECURITY HEADERS (next.config.ts)

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

## 14. TESTING — REQUISITI MINIMI

```
Unit tests (Vitest):
  - lib/fiscal/calcoli.ts → 100% coverage OBBLIGATORIO
  - lib/ai/extract.ts → test su mock responses
  - lib/pdf/generate.ts → test output non vuoto

E2E tests (Playwright):
  - Signup → onboarding → primo preventivo (happy path)
  - AI import (con mock OpenAI)
  - Pagina pubblica → accettazione preventivo
  - Upgrade piano Free → Pro (con Stripe test mode)

A11y tests (axe-core):
  - Tutte le pagine pubbliche: zero violations WCAG 2.2 AA
  - Form preventivo: zero violations
```

---

## 15. DEPLOYMENT

```
Branch main    → Vercel Production (cartacanta.app)
Branch staging → Vercel Preview (staging.cartacanta.app)
PRs            → Vercel Preview automatico (pr-XXX.cartacanta.app)

Environment variables: configurare in Vercel Dashboard
Region: fra1 (Frankfurt — EU data residency)
```

---

## 16. DECISIONI ARCHITETTURALI FISSE

1. Server Actions per mutazioni (no client-side fetch su dati sensibili)
2. Supabase RLS è la prima linea di sicurezza — non fidarsi del client
3. Il calcolo fiscale avviene SEMPRE server-side prima del salvataggio (validazione Zod)
4. I PDF vengono generati on-demand e cachati su Supabase Storage (URL firmato 1h)
5. L'AI output viene sempre validato con schema Zod prima di essere mostrato all'utente
6. Feature flags controllano l'accesso alle feature per ogni utente
7. Ogni documento ha un public_token random — NON usare l'ID del documento nell'URL pubblico
8. Il tasso di cambio viene "congelato" al momento del salvataggio del documento
9. La lingua del documento (PDF) è separata dalla lingua dell'interfaccia
10. Il numero fattura viene assegnato atomicamente — nessuna race condition possibile

---

## 17. COSA NON FARE (Anti-pattern)

- ❌ NON mettere logica fiscale nel client — solo server-side
- ❌ NON usare document.id nell'URL del link pubblico
- ❌ NON permettere di modificare un documento già inviato (crea nuova revisione)
- ❌ NON loggare dati personali degli utenti (nome, email, P.IVA) nei log
- ❌ NON saltare la validazione Zod sull'output AI
- ❌ NON mostrare errori tecnici all'utente finale — messaggi human-friendly sempre
- ❌ NON fare chiamate AI sincrone che bloccano il rendering — loading state sempre
- ❌ NON usare `alert()` o `confirm()` nativi — usare componenti shadcn/ui
