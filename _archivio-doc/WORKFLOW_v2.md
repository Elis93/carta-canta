# 🚀 WORKFLOW CLAUDE CODE — CARTA CANTA
## Guida Step-by-Step: 1% tu, 99% Claude Code
**Aprile 2026**

---

## COME FUNZIONA

1. Ogni STEP ha un numero e un'azione
2. Alcuni step li fai TU (⚙️ MANUALE) — sono cose che richiedono clic su siti web
3. Alcuni step li fa CLAUDE CODE (🤖 AUTONOMO) — copi il prompt e lo incolli in Claude Code
4. Dopo ogni step, confermi qui e ti do lo step successivo
5. Non saltare step — ognuno dipende dal precedente

---

## PRE-REQUISITI (fai questi UNA VOLTA sola)
## ⚙️ MANUALE — Prima di tutto

### Account da creare (se non li hai già):
- [ ] GitHub account (git.io)
- [ ] Vercel account (vercel.com) — collegato a GitHub
- [ ] Supabase account (supabase.com)
- [ ] Stripe account (stripe.com) — completa KYC
- [ ] Resend account (resend.com)
- [ ] Upstash account (upstash.com)
- [ ] PostHog account (posthog.com) — scegli region EU
- [ ] Flagsmith account (flagsmith.com)
- [ ] OpenAI account (platform.openai.com) — aggiungi crediti
- [ ] Sentry account (sentry.io)
- [ ] UptimeRobot account (uptimerobot.com)
- [x] cartacanta.app — dominio principale ✅ già registrato
- [ ] Porkbun/Namecheap — registra cartacanta.it + cartacanta.com (opzionali, come redirect)

**Tempo stimato: 2-3 ore**
**→ Dimmi quando hai finito i pre-requisiti per procedere con lo Step 1**

---

## STEP 1 — Inizializzazione Progetto
## ⚙️ MANUALE (5 minuti)

Apri il terminale sul tuo computer e copia questi comandi:

```bash
# 1. Installa Node.js LTS se non ce l'hai
# Verifica: node --version (deve essere >= 20)

# 2. Installa Supabase CLI
npm install -g supabase

# 3. Crea la cartella del progetto
mkdir carta-canta && cd carta-canta

# 4. Apri Claude Code in questa cartella
# (Menu: File → Open Folder → seleziona carta-canta)
```

Poi, in Claude Code, apri la finestra di chat e incolla questo:

---
### 📋 PROMPT STEP 1 — DA COPIARE IN CLAUDE CODE:

```
Leggi il file CLAUDE_v4.md che ti fornirò subito dopo questo messaggio.
Poi esegui queste operazioni in sequenza:

1. Crea un nuovo progetto Next.js 15 con questo comando:
   npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=no --import-alias="@/*"

2. Installa tutte le dipendenze necessarie:
   npm install @supabase/supabase-js @supabase/ssr stripe @stripe/stripe-js resend react-email @react-email/components posthog-js @flagsmith/react @upstash/redis @upstash/ratelimit openai playwright zod react-hook-form @hookform/resolvers date-fns lucide-react next-themes sonner

3. Installa shadcn/ui e inizializzalo:
   npx shadcn@latest init
   Scegli: New York style, Zinc color, CSS variables: yes

4. Aggiungi i componenti shadcn necessari:
   npx shadcn@latest add button input label card dialog sheet table badge avatar dropdown-menu select textarea separator skeleton toast form tabs command popover

5. Installa le dipendenze di sviluppo:
   npm install -D vitest @vitejs/plugin-react playwright axe-core @axe-core/playwright

6. Crea la struttura di cartelle esatta come indicata in CLAUDE_v4.md sezione 3

7. Crea il file .env.local con TUTTE le variabili da CLAUDE_v4.md sezione 4 (valori vuoti)

8. Crea il file .env.example uguale a .env.local

9. Crea .gitignore includendo .env.local

10. Inizializza git: git init && git add . && git commit -m "feat: initial project setup"

Dimmi quando hai finito ogni punto.
```
---

**→ Dimmi quando Claude Code ha completato per procedere con lo Step 2**

---

## STEP 2 — Supabase Setup
## ⚙️ MANUALE (20 minuti)

**Sul sito Supabase (app.supabase.com):**
1. Crea nuovo progetto: "carta-canta-prod"
2. Scegli region: West EU (Irlanda)
3. Salva la password del DB in un posto sicuro
4. Vai su Settings → API → copia:
   - `Project URL` → è il tuo `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public key` → è il tuo `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role key` → è il tuo `SUPABASE_SERVICE_ROLE_KEY`
5. Metti questi valori nel tuo `.env.local`

Poi in Claude Code:

---
### 📋 PROMPT STEP 2 — DA COPIARE IN CLAUDE CODE:

```
Esegui in sequenza:

1. Inizializza Supabase nel progetto:
   supabase init
   supabase login

2. Crea il file supabase/migrations/001_initial_schema.sql con
   TUTTO lo schema SQL dalla sezione 5 di CLAUDE_v4.md
   (inclusi ENUMS, tabelle, funzioni, indici e RLS policies)

3. Crea il file supabase/seed.sql con dati di test:
   - 1 workspace di test "Studio Rossi Test" con piano pro
   - 3 clienti di test
   - 2 preventivi di test (1 bozza, 1 inviato)
   - 1 template di test

4. Crea lib/supabase/client.ts (browser client con createBrowserClient)
5. Crea lib/supabase/server.ts (server client con createServerClient, usa cookies)
6. Crea lib/supabase/admin.ts (admin client con service_role per webhook)
7. Genera i tipi TypeScript dal schema:
   supabase gen types typescript --local > types/database.ts

8. Applica le migration in locale:
   supabase start
   supabase db push

9. Crea il file types/index.ts con i tipi applicativi custom:
   - WorkspaceWithPlan (workspace + piano corrente)
   - DocumentWithItems (document + array di items)
   - DocumentWithClient (document + client)
   - FiscalOptions (opzioni per il calcolo)

Testa che il DB sia up: supabase status
```
---

**→ Dimmi quando Claude Code ha completato per procedere con lo Step 3**

---

## STEP 3 — Autenticazione
## 🤖 AUTONOMO (Claude Code fa tutto)

---
### 📋 PROMPT STEP 3 — DA COPIARE IN CLAUDE CODE:

```
Implementa il sistema di autenticazione completo usando Supabase Auth.

1. Crea middleware.ts nella root con:
   - Refresh della sessione Supabase su ogni request
   - Redirect a /login se non autenticato (per route /dashboard/* e /app/*)
   - Rate limiting con Upstash Redis (usa i limiti da CLAUDE_v4.md sezione 9)
   - Supporto internazionalizzazione (it-IT default)

2. Crea le pagine auth (in app/(auth)/):
   - /login → form email + password + "Accedi con Google"
   - /signup → form nome + email + password + checkbox ToS
   - /reset-password → form email
   - /update-password → form nuova password (da link email)
   - Ogni pagina: responsive, WCAG 2.2 AA, errori human-friendly in italiano

3. Crea Server Actions in app/(auth)/actions.ts:
   - signIn(email, password)
   - signUp(email, password, nome)
   - signInWithGoogle()
   - signOut()
   - resetPassword(email)
   - updatePassword(newPassword)

4. Crea il hook hooks/useUser.ts che restituisce:
   - user (profilo Supabase)
   - workspace (workspace corrente dell'utente)
   - loading (boolean)
   - isAuthenticated (boolean)

5. Crea il callback OAuth: app/auth/callback/route.ts

6. Configura in Supabase Dashboard:
   - Abilita Google OAuth (istruzioni nel README)
   - Email template per reset password in italiano
   - Redirect URL: https://cartacanta.app/auth/callback

7. Scrivi test Vitest per le Server Actions
8. Scrivi test E2E Playwright per: signup → login → logout

Il tono di tutti i messaggi di errore è in italiano, semplice, 
non tecnico. Esempio: "Email o password non corretti" (non "Invalid credentials")
```
---

**→ Dimmi quando Claude Code ha completato per procedere con lo Step 4**

---

## STEP 4 — Onboarding e Workspace
## 🤖 AUTONOMO

---
### 📋 PROMPT STEP 4 — DA COPIARE IN CLAUDE CODE:

```
Implementa il flusso di onboarding e gestione workspace.

1. Crea app/(app)/onboarding/page.tsx con:
   - Step 1/3: Dati azienda (ragione sociale, P.IVA, regime fiscale, ATECO)
     → Select regime fiscale: forfettario (default) / ordinario
     → Autocomplete ATECO con i 50 codici più comuni per artigiani IT
   - Step 2/3: Logo upload (opzionale, con skip)
     → Upload su Supabase Storage bucket "logos"
     → Crop quadrato 1:1 con react-image-crop
   - Step 3/3: Crea primo preventivo (redirect a /preventivi/nuovo)
   - Progress bar in header: 0/3 → 1/3 → 2/3 → 3/3
   - Animazione confetti al completamento (usa canvas-confetti)

2. Crea app/(app)/layout.tsx con:
   - Sidebar (desktop): logo, nav links, workspace switcher, user menu
   - Bottom navigation (mobile): 4 tab principali
   - Header: titolo pagina + azioni contestuali
   - Check: se utente non ha workspace → redirect a /onboarding

3. Crea Server Actions per workspace:
   - createWorkspace(data)
   - updateWorkspace(id, data)
   - uploadLogo(workspaceId, file)
   - inviteMember(workspaceId, email, role) [solo piano Team]

4. Crea app/(app)/impostazioni/page.tsx:
   - Tab Generale: modifica dati azienda, logo
   - Tab Fiscale: regime, ATECO, P.IVA, numerazione fatture
   - Tab Notifiche: preferenze notifiche email/push
   - Tab Piano: stato abbonamento, link a /abbonamento

5. Hook hooks/useWorkspace.ts:
   - Carica il workspace corrente dell'utente
   - Funzione switchWorkspace(id) per multi-workspace

Segui i flows da CLAUDE_v4.md sezione 8 (FLOW 4 — Onboarding)
```
---

**→ Dimmi quando Claude Code ha completato per procedere con lo Step 5**

---

## STEP 5 — Core: Clienti e Template
## 🤖 AUTONOMO

---
### 📋 PROMPT STEP 5 — DA COPIARE IN CLAUDE CODE:

```
Implementa gestione clienti e template.

CLIENTI:
1. app/(app)/clienti/page.tsx → lista con search full-text (Supabase FTS)
2. app/(app)/clienti/nuovo/page.tsx → form creazione
3. app/(app)/clienti/[id]/page.tsx → dettaglio + preventivi del cliente
4. Server Actions: createClient, updateClient, deleteClient (soft delete)
5. Componente ClientAutocomplete per il form preventivo

TEMPLATE:
1. app/(app)/template/page.tsx → lista template (griglia card)
2. app/(app)/template/nuovo/page.tsx → editor template
3. app/(app)/template/[id]/page.tsx → modifica template
4. Editor template: colore brand (color picker), logo on/off, font (Inter/GeistSans/Helvetica)
5. Preview live del template mentre si modifica
6. Logica: plan Free → max 1 template (mostra paywall se tenta di crearne un secondo)

SEARCH:
- Implementa la search full-text come definito in CLAUDE_v4.md sezione 3
- Componente SearchBar riutilizzabile per clienti e documenti
- Debounce 300ms sulle query di ricerca
```
---

**→ Dimmi quando Claude Code ha completato per procedere con lo Step 6**

---

## STEP 6 — Core: Motore Fiscale + Preventivo
## 🤖 AUTONOMO (il cuore del prodotto)

---
### 📋 PROMPT STEP 6 — DA COPIARE IN CLAUDE CODE:

```
Implementa il motore fiscale e il form di creazione preventivo.
Questo è il core del prodotto — massima attenzione alla correttezza.

MOTORE FISCALE:
1. Crea lib/fiscal/calcoli.ts con ESATTAMENTE il codice da CLAUDE_v4.md sezione 7
2. Crea lib/fiscal/calcoli.test.ts con almeno 20 test Vitest:
   - Test arrotondamento round half up su valori critici
   - Test IVA per voce vs IVA sul totale (devono dare risultati diversi)
   - Test marca da bollo (sopra/sotto €77.47)
   - Test regime forfettario (no IVA, stringa legale)
   - Test con IVA mista (22% + 10% sullo stesso documento)
   - Test sconto percentuale + sconto fisso combinati
   - Test ritenuta d'acconto
   Coverage minima: 100% — usa "npm run test -- --coverage"

FORM PREVENTIVO:
1. app/(app)/preventivi/nuovo/page.tsx → form completo
2. Struttura form:
   - Sezione Cliente (autocomplete + crea nuovo inline)
   - Sezione Voci (tabella con drag-and-drop per riordinare)
     → Ogni voce: descrizione, qtà, UM (select con tooltip), prezzo, IVA, totale voce
     → Add voce (button) + Remove voce (icon)
   - Sezione Sconti (sconto % globale + sconto fisso)
   - Sezione Termini (validità giorni, termini pagamento, lingua documento)
   - Sezione Note (pubbliche + interne)
   - Preview totali (sempre visibile, aggiornata real-time)
3. Auto-save bozza ogni 30 secondi (debounced)
4. Calcolo real-time al cambio di ogni campo (usa lib/fiscal/calcoli.ts)
5. Validazione Zod prima del salvataggio server-side
6. Lista preventivi: app/(app)/preventivi/page.tsx
   → Filtri: status, data, cliente
   → Ricerca full-text
   → Bulk select + azioni (elimina, duplica, cambia stato)
7. Dettaglio preventivo: app/(app)/preventivi/[id]/page.tsx
   → Mostra dati + stato + timeline eventi (creato, inviato, accettato)
   → Azioni: Modifica (se bozza) / Duplica / Scarica PDF / Invia / Elimina
   → Note interne (solo per Team plan)
```
---

**→ Dimmi quando Claude Code ha completato per procedere con lo Step 7**

---

## STEP 7 — PDF Generation
## 🤖 AUTONOMO

---
### 📋 PROMPT STEP 7 — DA COPIARE IN CLAUDE CODE:

```
Implementa la generazione PDF professionale con Playwright.

1. Crea components/pdf/PreventivoPDF.tsx:
   Layout A4 professionale con:
   - Header: logo workspace (se presente) + ragione sociale + P.IVA + indirizzo
   - Meta: numero documento, data, validità
   - Sezione cliente: nome, indirizzo, P.IVA
   - Tabella voci: descrizione | qtà | UM | prezzo unit. | IVA% | totale
   - Box totali: subtotale / IVA dettagliata per aliquota / marca da bollo / totale
   - Footer: note, termini pagamento, stringa legale forfettario (se applicabile)
   - CTA visibile solo nella versione digitale (non nel PDF stampabile):
     bottone "Accetta preventivo" con URL pubblico
   Font: Inter embedded (no Google Fonts — includere come base64 o usare system fonts)
   Colori: usa color_primary dal template

2. Crea app/api/documents/[id]/pdf/route.ts:
   - Verifica auth + ownership del documento
   - Genera HTML dal componente React (renderToStaticMarkup)
   - Playwright: lancia browser headless → naviga all'HTML → esporta PDF
   - Upload PDF su Supabase Storage: /pdfs/[workspace_id]/[doc_id].pdf
   - Ritorna URL firmato (TTL 1 ora)
   - Cache: se PDF esiste già E documento non è stato modificato → ritorna URL esistente

3. Integra il bottone "Scarica PDF" nel dettaglio preventivo
4. Aggiungi "Preview PDF" nel form preventivo (pannello laterale su desktop, modal su mobile)

5. Testa con documenti di varie lunghezze (1 voce, 50 voci, 200 voci)
   → Multi-pagina deve funzionare con header/footer su ogni pagina
```
---

**→ Dimmi quando Claude Code ha completato per procedere con lo Step 8**

---

## STEP 8 — AI Import
## 🤖 AUTONOMO

---
### 📋 PROMPT STEP 8 — DA COPIARE IN CLAUDE CODE:

```
Implementa l'AI Import da foto/documento.

1. Crea lib/ai/extract.ts:
   - Funzione extractDocumentItems(input: string | Buffer, mimeType: string)
   - Prompt OpenAI ottimizzato per estrarre voci preventivo in italiano:
     Estrai TUTTE le voci come array JSON con campi:
     { description, quantity, unit, unit_price, vat_rate, confidence }
     confidence: 0.0-1.0 (quanto sei sicuro di aver estratto correttamente)
   - Fallback chain: GPT-4o-mini → Mistral-small → throw ExtractError
   - Validazione output con schema Zod PRIMA di ritornare
   - Timeout: 30s per chiamata
   - Retry: 1 tentativo automatico in caso di timeout

2. Crea app/api/ai/extract/route.ts:
   - Rate limiting: 5 req/min per utente (Upstash Redis)
   - Verifica feature flag FEATURE_AI_IMPORT (Flagsmith)
   - Verifica piano utente (solo Pro/Team)
   - Accetta: immagini (JPEG/PNG/WEBP) e PDF
   - Per immagini: passa direttamente a OpenAI Vision
   - Per PDF: converti prima pagina in immagine con Playwright

3. Crea components/preventivo/AIImportButton.tsx:
   - Input file con accept="image/*,application/pdf" capture="environment"
   - Su mobile: apre fotocamera posteriore direttamente
   - Loading state: skeleton animato con messaggio "Sto analizzando..."
   - Risultato: tabella voci con confidence badge (verde/giallo/rosso)
   - Ogni voce modificabile prima della conferma
   - Pulsante "Usa queste voci" → popola il form preventivo
   - Fallback UI se AI non disponibile: "AI momentaneamente non disponibile,
     compila manualmente" (mai bloccare l'utente)

4. Feature gate: se utente Free tenta di usare → mostra paywall modal
5. Scrivi test con mock OpenAI (non chiamare API reale nei test)
```
---

**→ Dimmi quando Claude Code ha completato per procedere con lo Step 9**

---

## STEP 9 — Link Pubblico + Accettazione
## 🤖 AUTONOMO

---
### 📋 PROMPT STEP 9 — DA COPIARE IN CLAUDE CODE:

```
Implementa la pagina pubblica di accettazione preventivo.

1. Crea app/p/[token]/page.tsx (pagina pubblica, NO auth):
   - Carica documento tramite public_token (query pubblica via RLS)
   - Se token non trovato / scaduto / già accettato → pagine di stato dedicate
   - Layout professionale (stesso stile del PDF)
   - Header: "Preventivo da [Ragione Sociale]" con logo
   - Mostra tutte le voci + totali
   - Pulsanti: "✅ Accetto il preventivo" / "❌ Declino"
   - Contatto artigiano: email + telefono (se presenti)
   - Meta SEO: noindex, nofollow (pagina privata)

2. Crea app/api/documents/[token]/accept/route.ts (POST):
   - Valida token
   - Salva: accepted_at=now(), accepted_ip=request.ip, accepted_ua=user-agent
   - Aggiorna status → "accepted"
   - Triggera email a artigiano (usa Resend)
   - Ritorna { success: true }

3. Crea app/api/documents/[token]/reject/route.ts (POST):
   - Stessa logica, status → "rejected"

4. Pagina post-accettazione: animazione confetti + messaggio di ringraziamento
5. Email automatiche (usa Resend + React Email):
   - A artigiano: "🎉 [Cliente] ha accettato il preventivo [titolo]!"
   - A cliente (conferma): "Hai accettato il preventivo di [Ragione Sociale]"

6. Webhook Supabase Realtime: notifica push in-app all'artigiano istantaneamente
   (usa Supabase Realtime subscriptions nel client)

Segui esattamente FLOW 3 da CLAUDE_v4.md sezione 8
```
---

**→ Dimmi quando Claude Code ha completato per procedere con lo Step 10**

---

## STEP 10 — Stripe + Abbonamenti
## 🤖 AUTONOMO

---
### 📋 PROMPT STEP 10 — DA COPIARE IN CLAUDE CODE:

```
Implementa il sistema di pagamento e abbonamenti.

1. Crea lib/stripe/stripe.ts: istanza Stripe server-side
2. Crea lib/stripe/plans.ts: costanti PLANS da CLAUDE_v4.md sezione 6

3. Server Actions in lib/stripe/actions.ts:
   - createCheckoutSession(priceId, workspaceId) → URL Stripe Checkout
   - createPortalSession(customerId) → URL Stripe Customer Portal
   - cancelSubscription(subscriptionId)

4. Webhook: app/api/webhooks/stripe/route.ts
   Gestisci TUTTI gli eventi da CLAUDE_v4.md sezione 5:
   - checkout.session.completed → aggiorna piano in DB
   - subscription.updated → aggiorna plan + subscription_ends_at
   - subscription.deleted → downgrade a Free
   - invoice.payment_failed → email all'utente
   - Verifica sempre la signature del webhook

5. Pagina abbonamento: app/(app)/abbonamento/page.tsx
   - Mostra piano corrente + data scadenza + prossima fattura
   - Pulsante "Gestisci abbonamento" → Customer Portal
   - Pulsante "Upgrade" se su Free

6. Pagina prezzi in-app (per upgrade contestuale):
   3 piani con decoy effect come da CLAUDE_v4.md sezione 11
   Toggle mensile/annuale con risparmio evidenziato
   Badge "Consigliato" sul piano Pro
   Garanzia 30 giorni rimborso

7. Feature gating: crea middleware/plans.ts
   - Funzione checkFeatureAccess(workspace, feature) → boolean
   - Usala in ogni Server Action che richiede Pro/Team
   - Se Free tenta feature Pro → ritorna PaywallError con piano richiesto

8. Stripe Tax: configura automatic_tax: enabled nel checkout
   (Stripe calcola automaticamente IVA per paese cliente)

## ⚙️ MANUALE REQUIRED prima di questo step:
   - Crea i prodotti in Stripe Dashboard con i prezzi di CLAUDE_v4.md
   - Copia i Price ID nei .env
   - Configura Stripe Tax nel Dashboard
   - Configura il Customer Portal nel Dashboard
```
---

**→ Dimmi quando Claude Code ha completato per procedere con lo Step 11**

---

## STEP 11 — Email System
## 🤖 AUTONOMO

---
### 📋 PROMPT STEP 11 — DA COPIARE IN CLAUDE CODE:

```
Implementa il sistema email completo con Resend + React Email.

1. Crea tutti i template email in lib/email/templates/:
   Vedi tabella completa in CLAUDE_v4.md sezione 12.
   Ogni template:
   - Componente React con props tipate
   - Design coerente: header con logo Carta Canta, font Inter, colori brand
   - Footer con: unsubscribe link + indirizzo legale
   - Mobile-responsive
   - Testato su: Gmail, Outlook, Apple Mail (usa MJML-safe CSS)

2. Crea lib/email/send.ts:
   Funzioni typed per ogni email:
   - sendWelcomeEmail(user)
   - sendPreventivoAlCliente(documento, cliente, artigiano)
   - sendPreventivoAccettato(documento, artigiano)
   - sendPreventivoRifiutato(documento, artigiano)
   - sendReminderCliente(documento, cliente)
   - sendPaymentSuccess(user, plan)
   - sendPaymentFailed(user)
   - sendScadenzaWarning(documento, artigiano)

3. Configura in Resend:
   - Dominio Resend: send.cartacanta.app (sottodominio dedicato — aggiungi DNS records)
   - From: noreply@send.cartacanta.app
   - Reply-to: support@cartacanta.app

4. Aggiungi job scheduled per:
   - Ogni giorno alle 9:00 IT: controlla preventivi in scadenza domani → invia warning
   - Ogni giorno alle 9:00 IT: controlla preventivi senza risposta da 7gg → invia reminder

   Usa Vercel Cron Jobs (vercel.json):
   {
     "crons": [
       { "path": "/api/cron/check-expiring", "schedule": "0 7 * * *" },
       { "path": "/api/cron/send-reminders",  "schedule": "0 7 * * *" }
     ]
   }
```
---

**→ Dimmi quando Claude Code ha completato per procedere con lo Step 12**

---

## STEP 12 — Dashboard + Analytics Utente
## 🤖 AUTONOMO

---
### 📋 PROMPT STEP 12 — DA COPIARE IN CLAUDE CODE:

```
Implementa la dashboard principale e gli analytics per l'utente.

1. app/(app)/dashboard/page.tsx:
   KPI cards in cima (segui FLOW 6 da CLAUDE_v4.md sezione 8):
   - Preventivi questo mese (N) con delta % vs mese scorso
   - Valore totale preventivi (€) con delta %
   - Tasso di accettazione (%)
   - Preventivi in attesa (N) con link alla lista filtrata

2. Lista attività recente:
   - Ultimi 10 eventi: preventivo creato/inviato/accettato/rifiutato/scaduto
   - Ogni evento: icona colorata + testo + data relativa (es. "2 ore fa")

3. Alert automatici (banner sticky giallo/arancio):
   - "Hai X preventivi senza risposta da 14+ giorni"
   - "Il preventivo [titolo] scade domani"
   - "Hai raggiunto 8/10 preventivi del piano Free" (a 80%)

4. Empty state intelligente per nuovi utenti:
   - Non "Nessun preventivo" vuoto
   - "Crea il tuo primo preventivo in 60 secondi →" con CTA primaria

5. Componente OnboardingProgress (se onboarding non completato):
   - Barra 0/3 → 1/3 → 2/3 → 3/3
   - Scompare dopo il completamento del 3° step

6. Grafici (usa recharts — già incluso in shadcn):
   - Trend mensile: preventivi inviati vs accettati (ultimi 6 mesi)
   - Solo per piano Pro/Team (Free vede placeholder con paywall)
```
---

**→ Dimmi quando Claude Code ha completato per procedere con lo Step 13**

---

## STEP 13 — Landing Page + SEO
## 🤖 AUTONOMO

---
### 📋 PROMPT STEP 13 — DA COPIARE IN CLAUDE CODE:

```
Implementa la landing page pubblica e le pagine SEO programmatiche.

LANDING PAGE (app/(marketing)/page.tsx):
Struttura in 8 sezioni:
1. Hero: headline + subheadline + CTA + demo video embedded (placeholder per ora)
   Headline: "Preventivi professionali in 60 secondi. Senza Excel, senza carta."
   CTA: "Inizia gratis — nessuna carta di credito"
2. Social proof bar: "Usato da 847 artigiani italiani" (numero da DB, live)
3. Come funziona: 3 step con icone animate (Importa → Personalizza → Invia)
4. Feature highlight: AI import, PDF professionale, link di accettazione, WhatsApp
5. Testimonials: 3 card con foto, nome, professione, città, citazione
6. Pricing: 3 piani con decoy effect (stesso componente dell'app)
7. FAQ: accordion con 7 domande (usa shadcn Accordion)
8. CTA finale: "Inizia gratis oggi →"

SEO:
- Meta title: "Carta Canta — Preventivi per Artigiani | Gratis"
- Meta description: "Crea preventivi professionali in 60 secondi con AI. Idraulici, elettricisti, falegnami. Gratis fino a 10 preventivi."
- OG image: genera con @vercel/og
- Schema.org SoftwareApplication markup
- sitemap.xml automatica (next-sitemap)

PAGINE SEO PROGRAMMATICHE (app/(marketing)/[ateco]/page.tsx):
Template per ogni codice ATECO:
- H1: "Preventivi per [categoria ATECO] — Carta Canta"
- Contenuto: template specifico per categoria
- Schema FAQ per la categoria
- CTA identica alla homepage
Genera almeno 50 pagine per i codici ATECO più ricercati.
Usa Next.js generateStaticParams() per SSG.
```
---

**→ Dimmi quando Claude Code ha completato per procedere con lo Step 14**

---

## STEP 14 — Testing + CI/CD + Deploy
## 🤖 AUTONOMO

---
### 📋 PROMPT STEP 14 — DA COPIARE IN CLAUDE CODE:

```
Configura testing completo, CI/CD e deploy in produzione.

TESTING:
1. Completa la suite unit test in tests/unit/fiscal/ (100% coverage su calcoli.ts)
2. Completa la suite E2E in tests/e2e/:
   - signup-to-preventivo.spec.ts (happy path completo — FLOW 1)
   - ai-import.spec.ts (con mock OpenAI)
   - public-acceptance.spec.ts (FLOW 3)
   - stripe-upgrade.spec.ts (Stripe test mode)
3. Test accessibilità: tests/a11y/pages.spec.ts
   axe-core su: homepage, login, signup, dashboard, form preventivo, pagina pubblica
4. Configura coverage threshold in vitest.config.ts:
   functions: 80, branches: 70, lines: 80
   lib/fiscal/calcoli.ts: 100% su tutto

CI/CD (GitHub Actions):
5. Crea .github/workflows/ci.yml:
   - On: push to main + PR
   - Steps: install → lint → type-check → unit tests → build
   - Fail fast se coverage sotto threshold

6. Crea .github/workflows/e2e.yml:
   - On: PR to main
   - Usa Supabase CLI per DB locale di test
   - Usa Stripe test mode

DEPLOY:
7. Crea vercel.json con:
   - Cron jobs (check-expiring + send-reminders)
   - Headers di sicurezza (CLAUDE_v4.md sezione 13)
   - Redirect: /app → /dashboard

8. Configura in Vercel Dashboard:
   - Environment variables (tutte da .env.local)
   - Region: Frankfurt (fra1)
   - Domain: cartacanta.app

9. Configura Sentry:
   - Error boundary in app/layout.tsx
   - Source maps upload in CI

10. Configura UptimeRobot:
    - Monitor HTTPS su cartacanta.app ogni 5 minuti
    - Monitor su cartacanta.app/api/health

11. Crea app/api/health/route.ts:
    - Verifica connessione DB
    - Ritorna { status: "ok", timestamp, version }

12. Esegui: npm run build → verifica zero errori TypeScript
    Esegui: npm run test → verifica tutti i test passano
    Deploy: vercel --prod
```
---

## ⚙️ MANUALE FINALE

Dopo che Claude Code ha deployato:
1. Verifica cartacanta.app funziona
2. Crea un account di test → fai il flow completo
3. Controlla Sentry → zero errori
4. Controlla UptimeRobot → monitor verde
5. Invia il primo preventivo reale a te stesso

**🎉 CARTA CANTA È LIVE!**

---

## RIEPILOGO STEPS

| Step | Chi | Cosa | Ore stimate |
|---|---|---|---|
| Pre-requisiti | ⚙️ Tu | Account e dominio | 2-3h |
| 1 | ⚙️ Tu + 🤖 CC | Init progetto | 1h |
| 2 | ⚙️ Tu + 🤖 CC | Supabase setup | 1h |
| 3 | 🤖 CC | Auth system | 2h |
| 4 | 🤖 CC | Onboarding + workspace | 2h |
| 5 | 🤖 CC | Clienti + template | 1.5h |
| 6 | 🤖 CC | Motore fiscale + preventivo | 3h |
| 7 | 🤖 CC | PDF generation | 2h |
| 8 | 🤖 CC | AI Import | 2h |
| 9 | 🤖 CC | Link pubblico + accettazione | 1.5h |
| 10 | ⚙️ Tu + 🤖 CC | Stripe + piani | 2h |
| 11 | 🤖 CC | Email system | 2h |
| 12 | 🤖 CC | Dashboard + analytics | 1.5h |
| 13 | 🤖 CC | Landing page + SEO | 2h |
| 14 | 🤖 CC | Testing + CI/CD + Deploy | 2h |
| **TOTALE** | | | **~28h Claude Code** |
