# ⚙️ SETUP MANUALE — CHECKLIST PRE-SVILUPPO
## Cosa fare PRIMA di aprire Claude Code
## Carta Canta — Aprile 2026

---

## STIMA TEMPO: 2-3 ore | Da fare UNA sola volta

---

## 📦 STEP 0A — Crea gli Account (60 min)

### Account obbligatori
- [ ] **GitHub** → github.com — se non ce l'hai
- [ ] **Vercel** → vercel.com → Sign in with GitHub
- [ ] **Supabase** → supabase.com → Sign in with GitHub
- [ ] **Stripe** → stripe.com → crea account + completa KYC (richiede documento ID)
- [ ] **Resend** → resend.com → Sign up
- [ ] **Upstash** → upstash.com → Sign up
- [ ] **PostHog** → posthog.com → Sign up → scegli region: EU (Frankfurt)
- [ ] **Flagsmith** → flagsmith.com → Sign up → crea progetto "carta-canta"
- [ ] **OpenAI** → platform.openai.com → crea account → aggiungi €20 di crediti
- [ ] **Sentry** → sentry.io → Sign in with GitHub → crea progetto Next.js
- [ ] **UptimeRobot** → uptimerobot.com → Sign up (free)

### Account opzionali (ma consigliati)
- [ ] **Mistral** → console.mistral.ai → Sign up → API key (fallback AI)
- [ ] **Cookiebot** → cookiebot.com → free tier (cookie banner GDPR)

---

## 🌐 STEP 0B — Dominio (20 min)

### Su Porkbun (porkbun.com) — consigliato per .it economico
- [x] **cartacanta.app** → dominio principale ✅ già acquistato
- [ ] Cerca: **cartacanta.it** → acquista come redirect (~€8-12/anno, opzionale)
- [ ] Cerca: **cartacanta.com** → acquista come redirect (~€10/anno, opzionale)
- [ ] Abilita WHOIS Privacy su tutti
- [ ] Salva le credenziali del registrar in un posto sicuro

### DNS da configurare dopo (lo fa Claude Code / Vercel automaticamente)
- Vercel aggiunge automaticamente A/CNAME quando colleghi il dominio
- Resend richiede TXT record per verifica dominio email

---

## 🗄️ STEP 0C — Supabase Project (10 min)

Sul sito app.supabase.com:
- [ ] Crea nuovo progetto → nome: "carta-canta-prod"
- [ ] Region: **West EU (Ireland)** — ✅ data residency EU
- [ ] Salva la **database password** (non la recuperi più)
- [ ] Vai su Settings → API → copia e salva:
  - `Project URL` (es. https://xxx.supabase.co)
  - `anon public` key
  - `service_role` key (⚠️ mai esporre nel client)

---

## 💳 STEP 0D — Stripe Setup (30 min)

### Prodotti da creare (Stripe Dashboard → Products)
Crea questi prodotti NELL'ORDINE indicato:

| Nome Prodotto | Tipo | Prezzo | Intervallo |
|---|---|---|---|
| Carta Canta Pro Mensile | Recurring | €19.00 | Monthly |
| Carta Canta Pro Annuale | Recurring | €182.00 | Yearly |
| Carta Canta Team Mensile | Recurring | €49.00 | Monthly |
| Carta Canta Team Annuale | Recurring | €470.00 | Yearly |
| Carta Canta Lifetime | One-time | €299.00 | — |

Per ogni prodotto, aggiungi metadata:
- `plan`: pro / team / lifetime
- `billing`: monthly / yearly / lifetime

- [ ] Copia i **Price ID** (iniziano con `price_`) → ti servono per .env
- [ ] Abilita **Customer Portal**: Stripe → Settings → Billing → Customer portal
  - Abilita: upgrade/downgrade, cancellation, invoice history, payment methods
- [ ] Configura **Stripe Tax**: Stripe → Tax → Enable → Add tax registration (Italy)
- [ ] Attiva **Stripe Radar** (antifrode — è gratis e già attivo di default)

### Webhook da configurare
- [ ] Stripe → Developers → Webhooks → Add endpoint
  - URL: https://cartacanta.app/api/webhooks/stripe
  - Events: checkout.session.completed, customer.subscription.*, invoice.payment_*
  - Copia il **Webhook Secret** (inizia con `whsec_`)

---

## 📧 STEP 0E — Resend Domain (10 min)

- [ ] Resend → Domains → Add domain → inserisci: **send.cartacanta.app** (sottodominio dedicato invio)
- [ ] Resend ti dà dei DNS records (TXT/CNAME) da aggiungere sul registrar
- [ ] Aggiungi i TXT/CNAME records sul registrar → DNS Management
- [ ] Torna su Resend e clicca "Verify" (ci vogliono 10-30 minuti)
- [ ] Crea API key → nome: "carta-canta-prod" → Full access

---

## 📊 STEP 0F — PostHog (5 min)

- [ ] PostHog → crea progetto "Carta Canta" → region: EU
- [ ] Copia il **Project API Key** (inizia con `phc_`)
- [ ] Il host EU è: `https://eu.posthog.com`

---

## 🚩 STEP 0G — Flagsmith (10 min)

- [ ] Flagsmith → crea organizzazione "Carta Canta"
- [ ] Crea progetto "carta-canta-prod"
- [ ] Crea questi feature flags (tutti ON):
  - `FEATURE_AI_IMPORT`
  - `FEATURE_WHATSAPP_SEND`
  - `FEATURE_TEAM_PLAN`
  - `FEATURE_LIFETIME_PLAN`
  - Questi OFF (per ora):
  - `FEATURE_SDI_INTEGRATION` (OFF)
  - `FEATURE_MARKETPLACE` (OFF)
  - `FEATURE_PUBLIC_API` (OFF)
- [ ] Copia la **Environment Key** (Production)

---

## ⚡ STEP 0H — Upstash Redis (5 min)

- [ ] Upstash → crea database Redis
  - Nome: "carta-canta-rate-limit"
  - Region: EU-West-1 (Ireland)
  - Type: Regional
- [ ] Copia: `UPSTASH_REDIS_REST_URL` e `UPSTASH_REDIS_REST_TOKEN`

---

## 🔐 STEP 0I — Raccogli Tutte le Credenziali

Compila questo file (NON metterlo su GitHub):

```env
# ====== SUPABASE ======
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx
SUPABASE_SERVICE_ROLE_KEY=eyJxxx

# ====== STRIPE ======
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_xxx
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PRICE_PRO_MONTHLY=price_xxx
STRIPE_PRICE_PRO_YEARLY=price_xxx
STRIPE_PRICE_TEAM_MONTHLY=price_xxx
STRIPE_PRICE_TEAM_YEARLY=price_xxx
STRIPE_PRICE_LIFETIME=price_xxx

# ====== AI ======
OPENAI_API_KEY=sk-xxx
MISTRAL_API_KEY=xxx

# ====== RESEND ======
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=noreply@send.cartacanta.app
RESEND_FROM_NAME=Carta Canta

# ====== UPSTASH ======
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# ====== POSTHOG ======
NEXT_PUBLIC_POSTHOG_KEY=phc_xxx
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com

# ====== FLAGSMITH ======
NEXT_PUBLIC_FLAGSMITH_KEY=xxx

# ====== SENTRY ======
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# ====== APP ======
NEXT_PUBLIC_APP_URL=https://cartacanta.app
NEXT_PUBLIC_APP_NAME=Carta Canta
```

---

## ✅ CHECKLIST FINALE PRIMA DI INIZIARE

- [ ] Tutti gli account creati
- [x] Dominio cartacanta.app registrato ✅
- [ ] Supabase project creato e credenziali copiate
- [ ] Stripe: prodotti + prezzi + webhook + Customer Portal + Tax configurati
- [ ] Resend: dominio verificato
- [ ] PostHog: progetto EU creato
- [ ] Flagsmith: flags creati
- [ ] Upstash: database Redis creato
- [ ] File .env.local compilato con tutte le credenziali
- [ ] Node.js >= 20 installato (verifica con: node --version)
- [ ] Claude Code installato e aperto

**→ Quando tutto questo è completato, apri WORKFLOW_CLAUDECODE.md e inizia dallo Step 1**
