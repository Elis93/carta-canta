# SPEC NUOVE FEATURE — Carta Canta

> Documento di prodotto + architettura da passare a Claude Code.
> Una sezione per feature: **decisione presa**, perché, cosa fanno i competitor, schema DB/migration, flusso UX, fasi.
> Scritto il 30 maggio 2026. Stack di riferimento: Next.js 16 App Router, React 19, Supabase (PostgreSQL 16), Stripe, Resend, AssemblyAI, Tailwind v4 + shadcn/ui. Mobile-first non negoziabile.
> **Code: NON implementare tutto insieme. Una feature alla volta, nell'ordine di priorità in fondo. Ogni feature richiede `npx tsc --noEmit` + `npm run build` verdi + aggiornamento CLAUDE.md.**

---

## 0. SINTESI DELLE DECISIONI (leggi prima questo)

| # | Feature | Decisione presa | Sforzo | Quando |
|---|---|---|---|---|
| 3 | Tutorial primo accesso | **Driver.js** — tour leggero di 5-6 step, skippabile, una sola volta | Basso | Subito (quick win) |
| 1 | Bilancio costi/ricavi | Tabella `expenses` + report mensile entrate (da fatture pagate) − uscite. **Feature Pro** | Medio | Subito dopo #3 |
| 2 | Pagamento fattura | **Fase 1: "bring your own" (IBAN/PayPal/Satispay) + "Segna pagato". Fase 2: carta/Google Pay/Apple Pay via Stripe Connect come perk del piano Pro (senza nostra fee). Fase 3 opzionale: application fee 1%.** | Medio (F1) / Alto (F2) | Insieme a #1 |
| 4 | Note sopralluogo → preventivo | Editor note (testo + foto + voce) con placeholder guida, poi estrazione AI → preventivo. Riusa AI/voce già esistenti | Medio-Alto | Differenziatore chiave |
| 6 | Chat preventivo cliente↔artigiano | Thread di messaggi legato al documento, async, sul link pubblico `/p/[token]`. Notifica via email. Storico dentro il preventivo | Medio | Dopo #4 |
| 5 | Marketplace professionisti | Profilo pubblico + ricerca per mestiere e distanza (PostGIS). **MVP separato, fase futura.** Monetizzabile con lead/featured | Alto | Fase a parte |

**Nota monetizzazione ("entrata fissa"):** la rendita ricorrente vera è e resta **l'abbonamento Pro** — NON le commissioni sui pagamenti (sottili sui piccoli importi, irregolari, costose in supporto). Le feature che spingono l'upgrade a Pro sono **#1 (bilancio), #4 (note AI), #2 (incasso con carta/Google Pay)**. Tienile gated. Il marketplace (#5) è l'unica con potenziale di ricavo *nuovo* (lead a pagamento / featured listing), ma è anche la più costosa: trattala come scommessa separata, non come priorità.

**Spunti dai competitor (confermati): vedi APPENDICE A** — opzioni a livelli (#10), recensioni a doppio senso Airbnb-style (#9), acconti (#8), interventi ricorrenti (#7), foto prima/dopo (#11). **SDI / fatturazione elettronica = step PRIORITARIO dopo le quick win** (unico vero blocco all'adozione in Italia). Ordine completo in fondo ("ORDINE DI LAVORO"). **Criterio guida assoluto: tutto in una app ma SEMPLICE — niente bloat (vedi A.6).**

**⚖️ CONFORMITÀ & RISCHI LEGALI: vedi APPENDICE B** — checklist obbligatoria da rispettare quando si implementa ciascuna feature (SdI, recensioni/Omnibus, AI Act, GDPR, DSA marketplace, accessibilità) + **trigger futuri** (es. cosa scatta se cresce il fatturato/numero dipendenti). **APPENDICE C** = backlog "da valutare più avanti" (feature parcheggiate). Strategia: **app il più completa possibile per attrarre artigiani, ma semplice; il superfluo si parcheggia in C, non si scarta.**

---

## 1. BILANCIO — costi/ricavi mese per mese

### Decisione
Aggiungere il **lato uscite** (l'app già conosce le entrate dalle fatture). Nuova sezione `/bilancio` (Pro) con:
- Inserimento spese manuali, ricorrenti o una tantum, con categoria.
- Report mensile: **Entrate** (fatture con stato pagato nel mese) − **Uscite** (spese del mese) = **Margine**.
- Grafico a barre 12 mesi (riusa il pattern di `RevenueChart`).

### Cosa fanno i competitor
Danea Easyfatt e Fatture in Cloud hanno contabilità completa (prima nota, scadenzari) ma sono **percepiti come complessi**: il punto di forza riconosciuto di Easyfatt è proprio l'essere "per imprenditori, non per esperti fiscali". Jobber/Housecall mostrano report ricavi ma le spese restano deboli. **Spazio per noi: un bilancio ultra-semplice, 3 numeri (entrate, uscite, margine) + categorie preimpostate per il mestiere.** Non replicare la prima nota: l'artigiano non la vuole.

### Schema DB (migration nuova)
```sql
CREATE TABLE expenses (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  date          DATE NOT NULL,
  description   TEXT NOT NULL,
  amount        NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  category      TEXT,                         -- 'materiali','carburante','attrezzatura','tasse','altro'...
  is_recurring  BOOLEAN NOT NULL DEFAULT false,
  recurrence    TEXT,                          -- null | 'monthly' | 'yearly'
  vat_deductible BOOLEAN NOT NULL DEFAULT false,
  receipt_url   TEXT,                          -- opzionale: foto scontrino su Supabase Storage
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expenses_workspace" ON expenses
  USING (workspace_id IN (SELECT my_workspace_ids()));
CREATE INDEX idx_expenses_ws_date ON expenses(workspace_id, date) WHERE deleted_at IS NULL;
```

### Calcolo entrate
Le entrate del mese = somma `documents` con `doc_type='fattura'` e stato pagato (vedi #2 per il campo `paid_at`), filtrate per mese di incasso. **Non** usare `accepted_at` dei preventivi: il bilancio deve riflettere il denaro reale incassato.

### Flusso UX
- `/bilancio`: in alto 3 card (Entrate / Uscite / Margine del mese corrente), sotto grafico 12 mesi, sotto lista spese con `+ Aggiungi spesa`.
- Form spesa minimale: data (default oggi), descrizione, importo, categoria (dropdown), toggle "ricorrente". Foto scontrino opzionale.
- Spese ricorrenti: un cron mensile (riusa pattern `/api/cron/*`) materializza la spesa del mese, oppure si calcolano al volo. **Consiglio: calcolo al volo** (più semplice, niente cron, niente duplicati).

### Fasi
- **MVP:** tabella spese + 3 card mese corrente + lista. Niente grafico.
- **V2:** grafico 12 mesi + categorie + export CSV.
- **V3:** foto scontrino + ricorrenti + stima tasse forfettario.

---

## 2. PAGAMENTO FATTURA — come gestirlo

### Decisione (la più importante: leggila tutta)
**Approccio a 3 fasi. Principio guida: la rendita ricorrente viene dall'abbonamento, NON dalle commissioni sui pagamenti. I pagamenti servono a rinforzare l'abbonamento.**

- **Fase 1 — "Bring your own" + "Segna pagato" (subito, gratis per tutti, zero rischio).** Il denaro NON transita da Carta Canta. L'artigiano collega i SUOI canali e marca le fatture pagate.
- **Fase 2 — Carta / Google Pay / Apple Pay via Stripe Connect, come PERK del piano Pro, SENZA nostra fee.** Il denaro transita via Stripe ma noi non tratteniamo nulla: l'artigiano paga solo le commissioni Stripe. "Fatti pagare con un tap" diventa un motivo per abbonarsi → alimenta l'entrata fissa senza farci entrare nel business dei pagamenti. Google Pay/Apple Pay arrivano inclusi automaticamente con Stripe.
- **Fase 3 — Application fee opzionale (es. 1%) sopra Stripe.** Solo se i volumi la giustificano. Tecnicamente è un interruttore su Connect già integrato in Fase 2, non nuovo sviluppo.

> **Perché NON Connect-con-fee subito:** sui piccoli importi il margine è quasi nullo (su €100, al 2% incassiamo €2 ma Stripe ne trattiene ~€1,75). La fee conviene solo sui ticket alti ed è irregolare. La rendita prevedibile è l'abbonamento.
>
> **Su Google Pay:** non è un sistema di pagamento autonomo, è un *wallet*. Non esiste un "link Google Pay" come PayPal.me/Satispay. Funziona SOLO sopra un processore (Stripe). Quindi compare solo in Fase 2, non in Fase 1.
>
> **Nota normativa:** con Connect la licenza di pagamento la porta Stripe (noi NON diventiamo istituto di pagamento). Il KYC dell'artigiano è una procedura ospitata da Stripe, non da costruire. Restano comunque a nostro carico supporto, dispute/chargeback, riconciliazioni.

### Cosa fanno i competitor
Joist, Jobber e Housecall Pro hanno il pagamento con carta integrato dentro l'app (e ci guadagnano una fee). In Italia artigiani e clienti pagano soprattutto via **bonifico, Satispay e PayPal**, e in fattura si indica la modalità ("incasso avvenuto", "PayPal", ecc.). La nostra Fase 1 è allineata alle abitudini italiane; la Fase 2 ci porta al livello dei competitor internazionali sul "pagamento al volo", ma gating su Pro invece di fee per transazione.

### Schema DB
**Migration Fase 1:**
```sql
-- Stato pagamento sul documento (fatture)
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','partial','paid')),
  ADD COLUMN IF NOT EXISTS paid_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS paid_amount  NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS due_date     DATE;          -- scadenza pagamento fattura

-- Canali di incasso "bring your own" dell'artigiano (uno per workspace)
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS payment_iban         TEXT,
  ADD COLUMN IF NOT EXISTS payment_iban_holder  TEXT,
  ADD COLUMN IF NOT EXISTS payment_paypal_url   TEXT,
  ADD COLUMN IF NOT EXISTS payment_satispay_url TEXT,
  ADD COLUMN IF NOT EXISTS payment_notes        TEXT;  -- testo libero ("Pago anche in contanti in cantiere")
```

**Migration Fase 2 (Stripe Connect):**
```sql
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,        -- account connesso dell'artigiano
  ADD COLUMN IF NOT EXISTS stripe_connect_charges_enabled BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS stripe_connect_onboarded_at TIMESTAMPTZ;

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;
```

### Flusso UX
**Fase 1**
- **Dettaglio fattura**: badge stato pagamento (Non pagata / Acconto / Pagata) + bottone "Segna come pagato" (dialog: totale o importo parziale + data). `due_date` opzionale.
- **Impostazioni → Pagamenti** (nuovo tab): campi IBAN/PayPal/Satispay/note. Validazione IBAN.
- **Link pubblico `/p/[token]`** (solo fatture, se almeno un canale impostato): riquadro "Paga questa fattura". Dettaglio per canale (vedi verifiche sotto):
  - **Bonifico + QR EPC** (consigliato, gratis, precompila l'importo): IBAN + intestatario + causale + copia, **PIÙ un QR code in standard EPC/SEPA**. Il cliente lo scansiona con la sua app bancaria → si apre un bonifico **già compilato** con IBAN, importo e causale; lui conferma e basta. È gratuito, standard, supportato dalle principali app bancarie italiane/EU. Questo è il modo migliore per ottenere "importo precompilato" senza processore e senza fee.
  - **Satispay**: bottone/QR con il link di pagamento che l'artigiano copia dalla sua app Satispay Business (oppure, V2, generato via API "payment link" one-off).
  - **PayPal**: bottone con il link `PayPal.Me` dell'artigiano. ⚠️ Onestà: il link PayPal.Me standard **NON precompila l'importo** (il cliente lo digita). Per precompilarlo serve l'API PayPal Payment Links — integrazione extra, valutarla solo se richiesta.

### ⚠️ Verifiche (fatte, maggio 2026)
- **QR EPC/SEPA**: standard gratuito, integra IBAN/BIC/importo/causale/beneficiario in un QR; le app delle principali banche italiane (es. Intesa Sanpaolo) lo leggono e precompilano il bonifico. È la soluzione più solida per "paga senza fee con importo già pronto". Generabile lato server con una libreria QR (es. payload EPC + `qrcode`).
- **PayPal.Me**: importo NON preimpostabile via link semplice (confermato dalla doc PayPal). Serve l'API.
- **Satispay**: il payment link si crea anche **senza API**, copiandolo dall'app Business; esiste anche l'API one-off per generarlo a importo fisso.
- **Solleciti pagamento**: riusa il cron solleciti; se `payment_status != 'paid'` e oltre `due_date`, email promemoria pagamento (separata dal sollecito firma preventivo).

**Fase 2 (Pro)**
- **Impostazioni → Pagamenti**: bottone "Attiva incasso con carta" → Stripe Connect onboarding (account link ospitato da Stripe). Stato mostrato (in attesa / attivo). Webhook aggiorna `charges_enabled`.
- **Link pubblico fattura**: se l'artigiano è onboarded, oltre ai canali Fase 1 compare **"Paga ora con carta / Google Pay / Apple Pay"** → Stripe Checkout (destination charge verso l'account connesso, application_fee = 0 in Fase 2). Al successo, webhook segna la fattura `paid` automaticamente.
- **Gating**: il bottone "Attiva incasso con carta" è visibile solo su piano Pro/Team/Lifetime (riusa il pattern di feature gating esistente).

### Fasi
- **Fase 1 (MVP):** `payment_status` + "Segna come pagato" + badge + canali "bring your own" + riquadro "Paga" sul link pubblico. Alimenta il bilancio (#1).
- **Fase 2 (Pro):** Stripe Connect onboarding + Checkout con carta/Google Pay/Apple Pay sul link pubblico + webhook auto-"paid". Nessuna application fee (perk Pro). Richiede gestione webhook Stripe (riusa `/api/webhooks/stripe` già esistente, aggiungendo gli eventi Connect).
- **Fase 3 (opzionale):** attivare `application_fee` (% configurabile, es. 1%) sui destination charge. Decisione di business; tecnicamente già pronta dopo la Fase 2.

---

## 3. TUTORIAL PRIMO ACCESSO

### Decisione
Tour guidato con **Driver.js** (leggero, framework-agnostic, integra bene con Next.js App Router e client component; trigger on-demand). Alternative valutate: React Joyride (più React-first ma più da orchestrare su più route), Onborda (Next-specific). **Per un tour breve e una-tantum, Driver.js è il più semplice e robusto.**

Il tour parte **una sola volta** al primo accesso post-onboarding, è **skippabile** in ogni momento, e si può rilanciare da Impostazioni ("Rivedi il tutorial").

### Cosa fanno i competitor
Housecall Pro e Jobber puntano molto su onboarding guidato e UI "user-friendly" come leva di adozione. Per il nostro target (artigiani 20-60 che non amano il software), un tour **corto e concreto** che fa *fare* la cosa principale (creare e inviare il primo preventivo) batte qualsiasi video.

### Step consigliati (max 6, "show, don't tell")
1. Benvenuto + "Ti mostro come fare il tuo primo preventivo in 60 secondi" (skip sempre visibile).
2. Evidenzia bottone **"+ Nuovo preventivo"**.
3. Nella creazione: evidenzia **selezione cliente** e **aggiungi voce / microfono**.
4. Evidenzia **"Invia al cliente"**.
5. Mostra dove ritrovare lo **stato** (inviato/visto/accettato) e la **timeline**.
6. Fine: "Hai finito! Rivedi questo tutorial da Impostazioni quando vuoi." + CTA.

### Schema DB (minimo)
```sql
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS onboarding_tour_done BOOLEAN NOT NULL DEFAULT false;
```
Al completamento/skip → `onboarding_tour_done = true`. (In alternativa basterebbe `localStorage`, ma il flag DB segue l'utente su ogni device — preferibile.)

### Note per Code
- **`driver.js` v1.4.0, licenza MIT** (verificato maggio 2026). È **JavaScript vanilla** framework-agnostic: non dipende dalla versione di React, quindi nessun problema con React 19 — va solo montato in un **client component** dentro un `useEffect` (mai lato server). Questo è anche il modo corretto con l'App Router di Next.js 16.
- Tour attivo solo se `!onboarding_tour_done`; al completamento/skip → setta il flag via Server Action.
- Gli `data-tour="..."` vanno aggiunti agli elementi target (bottoni nav, form). Attenzione al mobile: gli step devono puntare a elementi visibili anche su 360px; alcuni step potrebbero richiedere di aprire prima il menu. Driver.js riposiziona il popover automaticamente, ma testare su 360px.
- Evitare wrapper React non mantenuti: usare direttamente la libreria ufficiale in `useEffect`.

### Fasi
- **MVP:** 6 step sulla dashboard + lista preventivi.
- **V2:** tooltip contestuali "primo utilizzo" su Note (#4) e Bilancio (#1) quando vengono aperti per la prima volta.

---

## 4. NOTE SOPRALLUOGO → PREVENTIVO

### Decisione
Nuova sezione `/note`. Una nota è un **foglio bianco** con: testo libero, **foto allegate / scattate** (upload + camera), **dettatura vocale** (riusa AssemblyAI già integrato). Dentro la nota, in **grigio (placeholder/ghost)**, suggerimenti su *cosa* annotare per favorire la conversione automatica. Poi: **"Trasforma in preventivo"** → estrazione AI struttura i dati nelle voci del preventivo (riusa la pipeline AI già presente `lib/ai/extract.ts`).

Questo è il **differenziatore forte**: nessun competitor italiano lo fa bene. Joist/Tradify allegano foto e note al lavoro, ma **non trasformano appunti grezzi in un preventivo compilato**.

### Il punto critico: i "suggerimenti grigi" guida
Per far funzionare bene l'estrazione AI, la nota deve guidare l'artigiano a scrivere ciò che serve. Mostrare placeholder grigio tipo:

> _Esempio: "Cliente: Mario Rossi, via Roma 10 — Bagno: sostituzione 2 rubinetti (€45 cad.), 6 ore di manodopera a €30/h, smaltimento materiale €20. IVA 22%."_
> _Indica per ogni voce: descrizione, quantità, unità, prezzo. E nome/ragione sociale del cliente._

In più, **chip/bottoni rapidi** sopra la tastiera ("➕ Cliente", "➕ Voce", "➕ Manodopera") che inseriscono uno scheletro di testo da riempire. Questo aumenta moltissimo la qualità dell'estrazione.

### Estrazione AI — come strutturarla
La pipeline (testo nota + trascrizione voce, eventualmente OCR foto) → LLM con **prompt a schema rigido** e **temperatura 0–0.1** (le best practice per output JSON affidabile lo confermano). Schema target = la struttura già usata dal preventivo:
```jsonc
{
  "cliente": { "nome": "", "cognome": "", "ragione_sociale": "", "indirizzo": "" },
  "voci": [
    { "descrizione": "", "quantita": 1, "unita": "pz", "prezzo_unitario": 0, "iva": 22, "sconto_pct": 0 }
  ],
  "note": ""
}
```
Regole prompt: definisci lo schema → 1 esempio perfetto → regole di formato → chiedi all'LLM di validare prima di rispondere. Campi mancanti = lasciati vuoti (mai inventare prezzi). Mostrare all'artigiano una **schermata di revisione** dei dati estratti prima di creare il preventivo: l'AI propone, l'artigiano conferma/corregge. **Mai creare il preventivo "al buio".**

### Foto → testo (OCR) — verificato
Per leggere appunti scritti a mano fotografati, misure, etichette materiali: **Mistral OCR** è la scelta consigliata. Dati verificati (maggio 2026): gestisce bene **scrittura a mano e moduli misti**, ~94–98% di accuratezza su documenti/fatture, costo ~**$2 / 1.000 pagine**, 25+ lingue. È anche **provider EU** (Mistral è francese), coerente con la data-residency già adottata dal progetto. ⚠️ Onestà: l'accuratezza specifica sull'**italiano** non è benchmarkata separatamente nelle fonti — fare un test reale su appunti italiani prima di affidarsi al 100%. OpenAI vision resta come fallback (riusa il pattern fallback già presente in `lib/ai/fallback.ts`). Per la **voce**, si riusa AssemblyAI già integrato (CLAUDE.md: SDK v4, `universal`).

Pipeline note→preventivo: (testo digitato) + (trascrizione voce) + (OCR foto, opzionale) → concatenati → singola chiamata LLM con schema rigido, temperatura 0–0.1 → revisione utente.

### Schema DB (migration nuova)
```sql
CREATE TABLE notes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title         TEXT,
  body          TEXT,                          -- testo + trascrizione voce concatenata
  client_id     UUID REFERENCES clients(id),   -- opzionale, se già noto
  converted_document_id UUID REFERENCES documents(id), -- se trasformata in preventivo
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at    TIMESTAMPTZ
);
CREATE TABLE note_attachments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id     UUID NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  file_url    TEXT NOT NULL,                    -- Supabase Storage
  kind        TEXT NOT NULL DEFAULT 'photo',
  sort_order  INT NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notes_workspace" ON notes
  USING (workspace_id IN (SELECT my_workspace_ids()));
CREATE POLICY "note_attachments_ws" ON note_attachments
  USING (note_id IN (SELECT id FROM notes WHERE workspace_id IN (SELECT my_workspace_ids())));
```
Serve un **bucket Storage** per le foto note (privato, RLS per workspace) — riusa il pattern dei loghi (migration 017).

### Flusso UX (mobile-first — questa feature si usa in cantiere)
- `/note` lista → `+ Nuova nota`.
- Editor: campo testo grande con placeholder guida grigio; toolbar con **🎤 detta**, **📷 foto** (input `capture="environment"` per fotocamera diretta su mobile), **🖼 galleria**; chip rapidi cliente/voce.
- Foto in griglia sotto il testo, eliminabili.
- Footer fisso: **Salva** | **Trasforma in preventivo**.
- "Trasforma" → spinner → schermata revisione dati estratti → "Crea preventivo" → apre il preventivo precompilato.

### Fasi
- **MVP:** nota testo + foto + voce + salvataggio. Nessuna AI ancora.
- **V2:** "Trasforma in preventivo" con estrazione AI + revisione. **Richiede le chiavi OpenAI/Mistral attive in prod** (oggi vuote — vedi CLAUDE.md, AI Import è disabilitato dietro `NEXT_PUBLIC_AI_IMPORT_ENABLED`).
- **V3:** OCR sulle foto (lettura di misure/etichette) come input aggiuntivo all'estrazione.

> ⚠️ Dipendenza: la V2 condivide infrastruttura e chiavi con l'AI Import già previsto. Attivare entrambe insieme dopo i test del piano Pro.

---

## 5. CHAT PREVENTIVO (cliente ↔ artigiano)

### Decisione
Thread di messaggi **legato al documento**, accessibile dal link pubblico `/p/[token]`. Sul link, accanto a Accetta/Rifiuta, bottone **"Hai domande o vuoi richiedere una modifica?"** che apre la chat. I messaggi sono **tracciati dentro l'app e visibili nello storico del preventivo** (l'artigiano li vede nel dettaglio, sotto la timeline).

Modalità: **asincrona** (non serve realtime puro per due persone non sempre online). Si può usare Supabase Realtime per aggiornare la chat aperta, ma la spina dorsale è: messaggi salvati in tabella + **notifica email** a entrambi quando arriva una risposta.

### Il problema "il cliente deve tornare a controllare"
Due livelli:
1. **Notifica email**: ad ogni risposta dell'artigiano, email automatica al cliente con link diretto alla chat ("Hai una risposta sul preventivo 12/2026 — apri la chat"). Stesso per l'artigiano quando scrive il cliente. Questo è il meccanismo principale e risolve la maggior parte del problema.
2. **Messaggio chiaro in pagina**: banner nella chat lato cliente — _"Le risposte dell'artigiano appariranno qui. Ti avviseremo via email, oppure torna su questa pagina per controllare."_ Salviamo l'email del cliente al primo messaggio proprio per poter notificare.

### Cosa fanno i competitor
Jobber e Housecall Pro hanno "two-way messaging" cliente-azienda e cronologia comunicazioni nel CRM: è una feature attesa e apprezzata. La nostra forza: la chat è **incollata al singolo preventivo** (contesto chiaro), non una casella generica → diventa lo *storico negoziazione* del documento.

### Schema DB (migration nuova)
```sql
CREATE TABLE document_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id  UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  sender       TEXT NOT NULL CHECK (sender IN ('owner','client')),
  body         TEXT NOT NULL,
  client_email TEXT,                            -- catturata al primo msg del cliente (per notifiche)
  read_by_owner_at  TIMESTAMPTZ,
  read_by_client_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE document_messages ENABLE ROW LEVEL SECURITY;
-- L'artigiano (owner) legge/scrive i messaggi dei propri documenti:
CREATE POLICY "doc_messages_owner" ON document_messages
  USING (document_id IN (
    SELECT id FROM documents WHERE workspace_id IN (SELECT my_workspace_ids())
  ));
-- Il cliente NON è autenticato: l'accesso lato pubblico passa SEMPRE da una
-- API route server-side che valida il public_token. NESSUNA policy anon di lettura
-- diretta sulla tabella. (Vedi nota sicurezza.)
```

### Nota sicurezza (importante per Code)
Il cliente è **anonimo** (no auth). **Non** esporre `document_messages` via policy anon. L'invio/lettura lato cliente deve passare da API route (`/api/p/[token]/messages` GET/POST) che valida il `public_token`, applica rate limit (riusa `lib/rate-limit.ts`) e usa il service role lato server. Se in futuro vuoi la chat live, usa Supabase Realtime **Broadcast su canale privato** con autorizzazione via `realtime.messages` RLS — ma per l'MVP basta polling/refresh, niente realtime.

### Flusso UX
- **Link pubblico**: sotto Accetta/Rifiuta, bottone "Hai domande o vuoi richiedere una modifica?". Apre pannello chat. Primo messaggio del cliente chiede nome + email (per notifiche). Banner "torna qui o controlla l'email per le risposte".
- **Email**: a ogni nuovo messaggio, notifica all'altra parte con link. (Riusa `lib/email/send.ts`, plain-text + HTML, no emoji nel subject.)
- **Dettaglio preventivo (artigiano)**: nuova sezione "Conversazione con il cliente" sotto la `DocumentTimeline`, con i messaggi e campo di risposta. Badge "nuovo messaggio" non letto in lista preventivi e dashboard.

### Fasi
- **MVP:** tabella + API route token-based + UI chat su link pubblico + sezione nel dettaglio + notifica email. Polling/refresh, niente realtime.
- **V2:** realtime (Supabase Broadcast privato), badge non letti, "richiesta modifica" strutturata che evidenzia la voce contestata.

---

## 6. MARKETPLACE PROFESSIONISTI (cliente cerca l'artigiano)

### Decisione
È di fatto un **secondo prodotto** (directory geolocalizzata a due lati: domanda/offerta). **Non è priorità e non va sviluppato insieme alle altre feature.** Qui definiamo la **visione + l'MVP** così, quando deciderai di partire, Code ha la rotta.

**MVP proposto (il più piccolo che ha senso):**
- L'artigiano **opt-in**: pubblica un **profilo pubblico** (mestiere/i, zona di lavoro/raggio, descrizione, foto lavori, contatti). Riusa i mestieri/ATECO già presenti.
- Pagina pubblica di **ricerca**: il cliente filtra per **mestiere** + **comune/CAP** e ordina per **distanza**. Risultati = schede professionista.
- Contatto: il cliente compila un form di richiesta → arriva all'artigiano (riusa l'infrastruttura chat/email di #6). Niente account cliente nell'MVP.

Niente recensioni, niente lead a pagamento, niente prenotazioni nell'MVP: si aggiungono dopo se la directory prende piede.

### Cosa fanno i competitor
In Italia il riferimento è **ProntoPro/Houzz-like**: il cliente descrive il lavoro, riceve preventivi/contatti da pro vicini; il modello di ricavo dei marketplace è **lead a pagamento** (il pro paga per essere contattato) e **featured listing**. Questo è anche il **nostro unico canale di ricavo nuovo** oltre agli abbonamenti — ma ha senso solo con massa critica di professionisti. Per questo: prima costruiamo la base utenti col gestionale (le feature 1-4-6), poi attiviamo il marketplace sopra quella base già esistente. È il nostro vantaggio: **abbiamo già i professionisti dentro l'app.**

### Schema DB (quando si parte)
```sql
-- Abilitare PostGIS una volta:  CREATE EXTENSION IF NOT EXISTS postgis;
CREATE TABLE pro_profiles (
  workspace_id  UUID PRIMARY KEY REFERENCES workspaces(id) ON DELETE CASCADE,
  is_public     BOOLEAN NOT NULL DEFAULT false,
  display_name  TEXT NOT NULL,
  trades        TEXT[] NOT NULL DEFAULT '{}',   -- mestieri (da ATECO/preset)
  bio           TEXT,
  service_radius_km INT NOT NULL DEFAULT 30,
  city          TEXT,
  postal_code   TEXT,
  location      geography(POINT),               -- lat/lng per ricerca distanza
  photos        TEXT[] DEFAULT '{}',
  phone_public  TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pro_location ON pro_profiles USING GIST (location);

-- Ricerca "vicino a me" (ordina per distanza, usa indice spaziale con <->)
CREATE OR REPLACE FUNCTION search_pros(p_lat float8, p_lng float8, p_trade text)
RETURNS SETOF pro_profiles LANGUAGE sql STABLE AS $$
  SELECT * FROM pro_profiles
  WHERE is_public
    AND (p_trade IS NULL OR p_trade = ANY(trades))
  ORDER BY location <-> ST_Point(p_lng, p_lat)::geography
  LIMIT 50;
$$;
```
PostGIS è disponibile come estensione Supabase; `geography(POINT)` + operatore `<->` con indice GIST è il pattern standard per "nearby ordinato per distanza".

### Geocoding (lat/lng) — verificato, scelta consigliata
Per la ricerca per distanza servono le coordinate. Approccio consigliato, in ordine:
1. **Coordinate precalcolate dei comuni**: arricchire il dataset `lib/data/comuni.ts` (già presente) con lat/lng di ogni comune/CAP (dataset ISTAT/OSM gratuiti). Così la ricerca "in zona X" **non chiama nessun servizio a runtime**. È la via più robusta e gratuita per il caso d'uso principale.
2. **Geolocalizzazione del browser** (`navigator.geolocation`) per il "vicino a me" del cliente: dà lat/lng direttamente, **zero geocoding**.
3. **Nominatim (OpenStreetMap)** solo per geocodificare l'indirizzo libero dell'artigiano **al salvataggio del profilo** (evento raro, user-triggered).

⚠️ Onestà sui limiti di Nominatim pubblico (policy verificata maggio 2026): **max 1 richiesta/secondo**, obbligo di `User-Agent`/attribuzione, **vietato** usarlo come funzione di geocoding primaria/massiva, accesso revocabile senza preavviso. Va benissimo per geocodificare un profilo ogni tanto, **non** per geocodificare a ogni ricerca. Se il marketplace scala, **self-host di Nominatim** o provider commerciale (Geoapify, ecc.). Per questo i punti 1 e 2 sopra (precalcolo + geolocalizzazione browser) coprono il 95% dei casi senza dipendere da Nominatim.

### Fasi
- **Fase A (futura):** profilo pubblico opt-in + pagina ricerca per mestiere/comune + ordinamento distanza + form contatto. Tutto gratis.
- **Fase B:** recensioni, profilo verificato, gallerie lavori.
- **Fase C (ricavo):** lead a pagamento / crediti contatto / featured listing. **Questa è la potenziale entrata nuova.** Richiede massa critica.

> Decisione di business da prendere prima della Fase C: il marketplace cannibalizza o alimenta l'abbonamento? Proposta: i professionisti **Pro** appaiono in cima / hanno profilo completo → il marketplace diventa una **leva di upgrade**, non solo un canale lead.

---

## ORDINE DI LAVORO CONSIGLIATO PER CODE

1. **#3 Tutorial** — quick win, 1-2 giorni, alza subito l'attivazione. → vedi `PROMPT_01_TUTORIAL.md`. *Abbinabile come quick win: **A.6 Invio su WhatsApp** (sforzo minimo, impatto alto sul target).*
2. **#1 Bilancio (MVP)** + **#2 Pagamenti Fase 1** ("segna pagato" + canali bring-your-own) — vanno insieme: il pagamento alimenta il bilancio. Feature Pro → spinge l'upgrade. Qui aggancia anche **#8 Acconti/depositi** (estende "segna pagato").
3. **#2 Pagamenti Fase 2** — Stripe Connect + carta/Google Pay/Apple Pay come perk Pro. (Fase 3 application fee: solo dopo, se i volumi la giustificano.)
4. **#4 Note (MVP senza AI)** → poi **#4 V2 con AI** (quando attivi le chiavi OpenAI/Mistral, insieme all'AI Import già previsto). Qui aggancia **#11 Foto prima/dopo** sul documento.
5. **#10 Opzioni a livelli nel preventivo** — piccolo upgrade del preventivo esistente, alto impatto su accettazione/scontrino. Vedi Appendice A.
6. **SDI — Fatturazione elettronica** ⭐ **PRIORITARIO dopo le quick win.** È l'unico vero blocco all'adozione in Italia (Fatture in Cloud/Danea ce l'hanno). Task grosso, richiede provider SDI gestito (~€0,10/fattura). Già citato in CLAUDE.md tra i task pianificati. Trattalo come grande step a sé, con la sua spec dedicata.
7. **#6 Chat preventivo (MVP)**.
8. **#9 Recensioni a doppio senso (Airbnb-style)** + **#7 Interventi ricorrenti** — vedi Appendice A. Le recensioni alimentano il marketplace, quindi prima di esso.
9. **#5 Marketplace** — progetto separato, solo quando la base utenti è solida e le recensioni esistono.

### Regole trasversali per ogni feature (da CLAUDE.md)
- Mobile-first sempre. `npx tsc --noEmit` + `npm run build` verdi prima del commit. `npm test` se tocchi validazioni/calcoli.
- Ogni migration → incollala all'utente in fondo al messaggio (blocco "⚠️ Migration da applicare").
- RLS attiva su ogni nuova tabella (vedi CVE-2025-48757: tabelle pubbliche per RLS spenta sono il rischio #1 su Supabase).
- Rigenera `types/database.ts` dopo ogni migration.
- Aggiorna CLAUDE.md a fine sessione.

---

## APPENDICE A — SPUNTI DAI COMPETITOR (backlog confermato)

Feature emerse dall'analisi competitor, confermate dall'utente. Principio guida: **aggiungono valore senza appesantire** l'UX. Se una di queste rende l'app meno intuitiva per l'artigiano poco tecnico, va semplificata o rimandata.

### A.1 — Opzioni a livelli nel preventivo (#10) — "Good/Better/Best"
**Cosa è.** Nello stesso preventivo l'artigiano propone fino a **3 pacchetti** (es. Base / Consigliato / Premium), ognuno con il proprio set di voci e il proprio totale. Il cliente, dal link pubblico, **ne sceglie uno e accetta quello**. Esempio imbianchino: Base €900 (1 mano) / Consigliato €1.300 (lavabile premium, 2 mani) / Premium €1.800 (+antimuffa +garanzia). Alza l'accettazione (la scelta è "quale?", non "sì/no") e lo scontrino medio (upsell verso il livello alto).

**Resta opzionale**: il preventivo a prezzo singolo continua a funzionare come oggi. Le opzioni sono una modalità in più.

**Schema (riusa `document_items`):**
```sql
CREATE TABLE document_options (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id   UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  label         TEXT NOT NULL,              -- "Base" | "Consigliato" | "Premium" (testo libero)
  sort_order    INT NOT NULL DEFAULT 0,
  is_recommended BOOLEAN NOT NULL DEFAULT false
);
ALTER TABLE document_items ADD COLUMN IF NOT EXISTS option_id UUID REFERENCES document_options(id) ON DELETE CASCADE;
-- option_id NULL = preventivo classico a prezzo singolo (comportamento attuale invariato)
ALTER TABLE documents ADD COLUMN IF NOT EXISTS accepted_option_id UUID REFERENCES document_options(id);
```

**Flusso.** In creazione: toggle "Preventivo a opzioni"; l'artigiano aggiunge 2-3 opzioni, ciascuna con le sue voci; può marcarne una "Consigliato". Sul link pubblico: il cliente vede le opzioni a confronto (card affiancate, "Consigliato" evidenziata), seleziona e accetta → `accepted_option_id` salvato → la fattura nasce da quell'opzione. **Mobile-first**: le card opzione vanno in colonna su telefono.

**Fasi.** MVP: 2-3 opzioni + selezione cliente. V2: confronto visivo "tabella feature" tra le opzioni.

### A.2 — Recensioni a doppio senso (#9) — modello Airbnb
**Decisione (confermata con l'utente).** Recensioni **bidirezionali** e **a sole domande chiuse** (no testo libero): il cliente recensisce l'artigiano **e** l'artigiano recensisce il cliente, rispondendo a un set fisso di domande. Meccanismo **a doppio cieco con finestra di 14 giorni** (come Airbnb): nessuno vede la recensione dell'altro finché **entrambi** hanno inviato o finché scadono i 14 giorni → niente ritorsioni. **Apertura della finestra**: quando la fattura è **pagata** (`payment_status='paid'`) **oppure** è **scaduta** (`status='expired'`).

> **Airbnb (verificato):** le due recensioni escono **insieme** quando entrambi hanno inviato, oppure allo scadere dei 14 giorni (quello che capita prima). Arriva la notifica che l'altro ha scritto, ma il contenuto resta nascosto finché non invii la tua o scade il termine. Replichiamo questo.

**Domande chiuse (no testo libero = no diffamazione da moderare):**
- *Cliente → artigiano* (pubblica): puntualità, qualità del lavoro, rispetto del preventivo, pulizia del cantiere, "lo consiglieresti?". (scala 1-5 o sì/no)
- *Artigiano → cliente* (interna): pagamento puntuale?, comunicazione chiara?, accesso al cantiere agevole?, lavoro conforme agli accordi?, "lo riprenderesti?".
- MVP: solo domande chiuse per entrambi. Eventuale commento libero **moderato** solo sul lato artigiano (pubblico) in una fase successiva.

**Identità del cliente (scelta aggiornata):** àncora primaria = **codice fiscale quando disponibile** — è univoco (niente scambio di persona) ed è **spesso già in archivio** perché la fattura a un privato lo richiede, proprio nel contesto in cui si apre la recensione. Fallback = **email** (già raccolta) + **telefono** come match secondario, quando il CF manca (così la feature non si blocca). La reputazione del cliente è legata a questa àncora così da seguirlo con altri artigiani.

> ⚠️ **Attenzione: il CF migliora la PRECISIONE dell'identità, NON è lo scudo legale.** La diffamazione dipende dal *contenuto*, non da quanto bene identifichi la persona; e costruire un DB di reputazione di persone fisiche legato a un identificativo forte come il CF è esso stesso un trattamento sensibile (il Garante italiano è storicamente ostile ai sistemi di "rating delle persone" — precedente da riverificare). Gli scudi reali contro la diffamazione sono: **doppio cieco**, recensioni **strutturate/fattuali** (es. "pagamento puntuale?", "accesso al cantiere?") invece di testo libero offensivo, **diritto di replica + rimozione + segnalazione**, e mantenere le recensioni-cliente **interne ai professionisti**. Validazione legale = prerequisito di lancio.

**Visibilità (⚠️ punto legale — vedi nota GDPR):**
- Recensione **cliente → artigiano**: **pubblica** sul profilo marketplace dell'artigiano (come le recensioni Google). Nessun problema.
- Recensione **artigiano → cliente**: visibile **solo agli altri professionisti Carta Canta** all'interno della piattaforma (e il cliente vede la propria), **NON** indicizzata sul web pubblico. È lo stesso spirito di Airbnb (la reputazione del viaggiatore è visibile agli host nella piattaforma, non su Google).
- **Cliente ↔ cliente: NESSUNA visibilità.** Un cliente non vede mai la reputazione di un altro cliente, e non esiste un elenco clienti consultabile dai clienti. La reputazione-cliente è una funzione riservata ai soli professionisti, mostrata in contesto (quando quel cliente ricompare in un loro documento).

> ⚠️ **NOTA GDPR / diffamazione — da validare con un legale prima del lancio.** Pubblicare valutazioni su **persone fisiche** (i clienti) in UE richiede base giuridica, minimizzazione dei dati, **diritto di replica** e **diritto di rimozione**, oltre a moderazione/segnalazione. Tenere le recensioni-cliente **interne alla rete professionale** (non pubbliche/indicizzate) riduce molto il rischio, ma NON lo azzera. Questa verifica legale è un prerequisito di lancio, non un dettaglio.

**Quadro verificato (maggio 2026):** il "rating reputazionale" di persone **non è vietato** in Italia — caso Mevaluate: il Garante lo bloccò (2016) ma la **Cassazione (ord. 28358/2023)** ha stabilito che è lecito **se** il consenso è libero/specifico e **il funzionamento/criteri sono trasparenti** per l'interessato, nel rispetto della dignità.

### Consenso + protezione legale della piattaforma (cosa ci tutela davvero)
Pacchetto di tutele da implementare insieme (UE: GDPR + Direttiva e-Commerce art.14 + Digital Services Act):
1. **Consenso GDPR valido** da entrambe le parti: casella **opt-in NON pre-spuntata**, **separata** dalle condizioni generali, specifica, informata, **revocabile** dalle impostazioni, e **registrata** (timestamp + versione del testo accettato). Pre-ticked = nullo (CJEU).
2. **Solo domande chiuse** → nessun testo offensivo da gestire.
3. **"Segnala" + rimozione rapida** su ogni recensione: il meccanismo notice-and-takedown (obbligo DSA) è ciò che dà alla piattaforma il **safe harbour** (esenzione di responsabilità da host neutrale). Agire in fretta sulle segnalazioni.
4. **Diritto di replica** del recensito.
5. **ToS** che attribuisce la responsabilità del contenuto a chi recensisce e qualifica Carta Canta come host neutrale.
6. **Trasparenza** sui criteri e sul calcolo della media (richiesto da Cassazione).

**Bozza testo di consenso** (da far validare a un legale):
> *Regolamento valutazioni reciproche* — A fine lavoro, tu e il professionista potete valutarvi a vicenda rispondendo a domande predefinite (es. puntualità, correttezza, chiarezza). La tua valutazione sul professionista sarà **pubblica** sul suo profilo. La valutazione del professionista su di te sarà visibile **solo agli altri professionisti di Carta Canta**, mai pubblicata sul web: potrai sempre vederla, replicare e chiederne la rimozione se inesatta. Le valutazioni si basano **solo** su queste domande, senza testo libero.
> ☐ *Ho letto e acconsento a partecipare al sistema di valutazione reciproca. Posso revocare il consenso in qualsiasi momento dalle impostazioni.* (NON pre-spuntata)

**Schema da aggiungere** per consenso e segnalazioni:
```sql
-- Registro dei consensi (accountability GDPR)
CREATE TABLE review_consents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_type  TEXT NOT NULL CHECK (subject_type IN ('pro','client')),
  workspace_id  UUID REFERENCES workspaces(id),   -- se pro
  client_email  TEXT,                              -- se client (+ phone/CF come da identità)
  consent_text_version TEXT NOT NULL,
  consented_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  withdrawn_at  TIMESTAMPTZ
);
-- (sulla tabella reviews: reported_at, removed_at, reply_body, reply_at già previsti)
-- Le risposte alle domande chiuse: salvarle strutturate, es. answers JSONB sulla tabella reviews.
```

**Schema:**
```sql
CREATE TABLE reviews (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id     UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  workspace_id    UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,  -- artigiano coinvolto
  client_id       UUID REFERENCES clients(id),
  client_email    TEXT,                       -- àncora identità cliente (+ phone come match secondario)
  direction       TEXT NOT NULL CHECK (direction IN ('client_to_pro','pro_to_client')),
  rating          INT  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  body            TEXT,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  window_expires_at TIMESTAMPTZ NOT NULL,      -- apertura finestra + 14 giorni
  published_at    TIMESTAMPTZ,                 -- valorizzata quando entrambe inviate O scade la finestra
  reply_body      TEXT, reply_at TIMESTAMPTZ,  -- diritto di replica
  reported_at     TIMESTAMPTZ, removed_at TIMESTAMPTZ,  -- moderazione / rimozione
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
-- L'artigiano accede alle review dei propri documenti; il cliente (anonimo) SEMPRE via API route con public_token.
```

**Logica doppio cieco.** `published_at` si valorizza quando esistono entrambe le `direction` per lo stesso `document_id`, **oppure** via **cron** quando `window_expires_at < now()` (pubblica ciò che c'è). Finché `published_at` è null, nessuna delle due parti vede il contenuto dell'altra.

**Flusso.** Alla pagatura/scadenza fattura → email a entrambi con link per recensire (cliente: via `public_token`, no account; artigiano: in-app). Reminder a metà finestra. Le recensioni-artigiano pubblicate compaiono sul profilo marketplace (#5); la reputazione-cliente è consultabile dall'artigiano quando quel cliente (email/telefono) ricompare in un nuovo documento.

**Dipendenze.** Si appoggia a #2 (stato pagamento) per il trigger e a #6 (infrastruttura email/notifiche). Le recensioni vanno fatte **prima** del marketplace (#5), che le mostra.

### A.3 — Acconti / depositi (#8)
Estende "Segna pagato" (#2 Fase 1): l'artigiano può registrare un **acconto** (es. 30%) e l'app traccia residuo. Sul link pubblico (Fase 2) si può chiedere l'acconto con carta/QR. Riusa `payment_status='partial'` + `paid_amount` già previsti nello schema di #2.

### A.4 — Interventi ricorrenti (#7)
Manutenzioni periodiche (caldaia annuale, condizionatori) con **promemoria automatico** ("è ora di ricontattare il cliente Rossi"). Dà entrate ripetute all'artigiano e retention a noi. Schema minimo: tabella `recurring_jobs` (workspace_id, client_id, descrizione, cadenza, prossima_data) + cron che genera il promemoria/bozza preventivo. Tenere semplicissimo: un promemoria, non uno scheduler complesso.

### A.5 — Foto prima/dopo (#11)
Estensione di #4 (Note): allegare foto **al preventivo/fattura** per documentare il lavoro. Riusa il bucket Storage e il pattern allegati delle Note.

### A.6 — Invio via WhatsApp ⭐ QUICK WIN (near-term)
Gli artigiani italiani comunicano coi clienti soprattutto su **WhatsApp**. Aggiungere accanto a "Invia via email" un bottone **"Invia su WhatsApp"** che apre `https://wa.me/<numero>?text=<messaggio+link pubblico>` con il link `/p/[token]` e un testo precompilato. Sforzo bassissimo (nessuna API, nessun costo: è un semplice deep link), impatto alto sull'adozione. **[CODE]**
- MVP: bottone su preventivo e fattura → apre WhatsApp con link + testo. Se il cliente ha un telefono in rubrica, precompila il numero.
- Da valutare in futuro: WhatsApp Business API per invio automatico/tracciato (a pagamento) → C.2.

### A.7 — Cosa NON fare (anti-bloat)
Per preservare semplicità e intuitività (criterio #1 dell'utente, target poco avvezzo al software): **niente** ottimizzazione percorsi/dispatching, tracking GPS "stile Uber", prenotazione self-service 24/7, marketing automation complessa. Sono feature per aziende strutturate con squadre, non per il singolo artigiano: ci farebbero perdere il vantaggio della semplicità.

---

## APPENDICE B — CONFORMITÀ & RISCHI LEGALI (checklist obbligatoria)

> **Principio: tutelarci il più possibile.** Ogni feature qui sotto va implementata rispettando i punti relativi. Legenda: **[CODE]** = lo fa Claude Code nell'app · **[LEGALE/OPS]** = task per l'utente/un legale (non codice) · **[TRIGGER FUTURO]** = non obbligatorio ora, scatta a una certa condizione. **Nota: questa è una guida pratica, NON un parere legale. La validazione di un legale resta prerequisito di lancio per recensioni, marketplace e pagamenti.**

### B.1 — Fatturazione elettronica SdI + conservazione ⭐ CRITICO
Dal 1° gen 2024 **tutte** le P.IVA (forfettari inclusi) devono emettere fattura via **SdI**; obbligo di **conservazione a norma 10 anni** (provider accreditato AgID o servizio Agenzia Entrate); sanzioni conservazione omessa **€1.000–8.000**.
- **[CODE] subito (interim, finché SdI non è integrato):** NON far credere che il PDF fattura assolva l'obbligo fiscale. Aggiungere un avviso chiaro nell'area Fatture e/o sul documento: *"Questo documento non sostituisce la fattura elettronica: trasmettila tramite SdI (tuo gestionale/commercialista)."* Evitare diciture come "fattura inviata/emessa" che implichino l'adempimento fiscale completo.
- **[LEGALE/OPS + CODE] step prioritario:** integrare un **provider SdI gestito** (~€0,10/fattura) per emissione + **conservazione sostitutiva**. Spec dedicata a parte. È lo step #6 dell'ORDINE DI LAVORO.

### B.2 — Recensioni: Direttiva Omnibus / Codice del Consumo
Vietato pubblicare recensioni non autentiche; **obbligo di dichiarare se/come si verificano**; sanzioni AGCM fino a **€10 mln o 4% fatturato**. (Vedi anche A.2.)
- **[CODE]** pubblicare **solo** recensioni legate a una fattura reale (pagata/scaduta) = verificate per definizione; mostrare badge **"Recensione verificata — da un lavoro reale"**.
- **[CODE]** pagina/sezione pubblica **"Come verifichiamo le recensioni"** (dichiarazione del metodo di verifica).
- **[CODE]** bottone **"Segnala"** + rimozione rapida (notice-and-takedown, dà il safe harbour DSA) + **diritto di replica**.
- **[CODE/OPS]** mai inserire recensioni finte, mai incentivarle.

### B.3 — AI Act, trasparenza (obblighi dal 2 agosto 2026)
- **[CODE]** sulle bozze generate dall'AI (Note→preventivo #4, AI Import): etichetta visibile **"Generato con AI — verifica prima di inviare"**.
- **[CODE]** informare l'utente quando una funzione usa AI/trascrizione vocale; se in futuro si aggiunge un assistente conversazionale, disclosure **"stai interagendo con un'AI"**.

### B.4 — GDPR: ruolo di responsabile del trattamento + nuovi dati
Carta Canta tratta i dati dei clienti dell'artigiano → **titolare = artigiano, responsabile = Carta Canta**.
- **[LEGALE/OPS]** nomina a responsabile / **DPA ex art.28** nel ToS; privacy policy; registro dei trattamenti; policy di retention; procedura notifica violazioni entro 72h.
- **[CODE]** per ogni NUOVO tipo di dato introdotto dalle feature — **foto** (Note #4 / #11), **registrazioni/trascrizioni vocali**, **messaggi chat** (#6), **codice fiscale** (recensioni #9): salvarli in **Storage privato con RLS**, renderli **cancellabili** (soft delete coerente col cestino), con una **retention** definita. Base giuridica + minimizzazione per ciascuno.
- **[CODE/OPS]** cookie banner a norma; pagina esercizio diritti (accesso/rettifica/cancellazione) — già agevolata da soft-delete/cestino esistenti.

### B.5 — Marketplace (#5): DSA + tutela del consumatore (quando si fa)
- **[CODE]** T&C chiare, **meccanismo di segnalazione (notice-and-action)**, punto di contatto, nessun monitoraggio generale dei contenuti.
- **[CODE]** **disclaimer di responsabilità**: Carta Canta non risponde della qualità/esito del lavoro dei professionisti (è intermediario).
- **[LEGALE/OPS]** Codice del Consumo per le transazioni facilitate; valutare verifica P.IVA/assicurazione dei pro prima della pubblicazione del profilo.

### B.6 — Pagamenti (Stripe Connect, Fase 2/3)
- **[CODE]** mostrare prezzi **IVA inclusa** ai consumatori; trasparenza sul **rinnovo ricorrente** dell'abbonamento.
- **[OPS]** SCA/PSD2 e KYC/antiriciclaggio sono gestiti da Stripe (siamo coperti); se in Fase 3 si attiva la nostra **application fee**, verificare gli obblighi su fatturazione della commissione.

### B.7 — Pagine legali di base [LEGALE/OPS + CODE]
ToS, Privacy Policy, Cookie policy, e **diritto di recesso** per abbonamenti verso consumatori. Code: predisporre le pagine/route; contenuti dal legale.

### B.8 — Accessibilità (European Accessibility Act) [TRIGGER FUTURO]
Dal 28 giu 2025 obbligo WCAG 2.1 AA / EN 301 549 per servizi digitali — **MA microimprese (<10 dipendenti E <€2 mln fatturato) ESENTI**. Oggi Carta Canta è verosimilmente **esente**.
- **[TRIGGER FUTURO]** appena si superano **10 dipendenti** OPPURE **€2 mln di fatturato** → accessibilità **obbligatoria** (sanzioni fino a €40.000).
- **[CODE] buona pratica già ora** (per non rifare tutto dopo): sfruttare i componenti accessibili di shadcn/Radix già in uso, contrasti adeguati, `aria-label`, navigazione da tastiera. Costo marginale oggi, risparmio enorme domani.

### B.9 — TABELLA TRIGGER FUTURI (cosa scatta al crescere)
| Condizione | Cosa diventa obbligatorio | Azione |
|---|---|---|
| >10 dipendenti **o** >€2 mln fatturato | Accessibilità EAA (WCAG 2.1 AA) | Audit accessibilità + adeguamento |
| Marketplace live (#5) | Obblighi DSA + Codice Consumo | T&C, notice-and-action, disclaimer |
| Application fee sui pagamenti (Connect Fase 3) | Obblighi su commissione/fatturazione | Verifica con commercialista |
| Trattamento dati su larga scala / categorie particolari | Possibile nomina **DPO** | Valutazione con legale |
| Volumi recensioni elevati | Moderazione strutturata, gestione richieste AGCM | Processo di moderazione |
| Espansione in altri Paesi UE | Localizzazione normativa | Analisi per Paese |

---

## APPENDICE C — BACKLOG FUTURO / DA VALUTARE

> Niente si scarta: ciò che oggi è superfluo o prematuro si parcheggia qui e si rivaluta. Strategia: app **completa ma semplice**.

### C.1 — Confermate, da fare (agganciate alle feature principali)
Sono già nell'ORDINE DI LAVORO / Appendice A: opzioni a livelli (#10), acconti (#8), interventi ricorrenti (#7), recensioni doppio senso (#9), foto prima/dopo (#11). Qui solo per memoria: **fare**, al momento giusto.

### C.2 — Da valutare più avanti (non ora, ma tracciate)
- **Commento libero moderato** sulle recensioni lato artigiano (oggi solo domande chiuse).
- **Codice fiscale come identità forte** nelle recensioni (oggi: CF se disponibile + email/telefono).
- **PayPal Payment Links API** per importo precompilato (oggi: link PayPal.Me senza importo).
- **Application fee 1%** sui pagamenti (Connect Fase 3): solo se i volumi la giustificano.
- **OCR foto** nelle Note (Mistral OCR) come input extra all'estrazione AI (dopo la V2 base).
- **Multi-lingua** PDF/app; **recensioni avanzate** e **lead a pagamento/featured** sul marketplace.
- **Preventivo con firma grafica avanzata**, **portale cliente** evoluto (oltre `/p/[token]`).
- **"Pacchetto commercialista"**: export fatture + incassi di un periodo (CSV/PDF) in un clic. Semplice, alto valore pratico. Buon candidato a diventare "da fare" presto.
- **PWA installabile + notifiche push** (preventivo visto / fattura scaduta / nuovo messaggio chat). Le notifiche push richiedono service worker + permessi; valutare dopo le feature core.
- **Modelli di voci per mestiere**: catalogo precompilato per idraulico/elettricista/imbianchino, ecc. (estende l'ATECO già presente). Accelera la creazione del primo preventivo.
- **Scadenzario unico "cosa fare oggi"**: vista che unisce preventivi in scadenza + fatture da incassare + manutenzioni ricorrenti (#7). Hub semplice, molto utile.
- **WhatsApp Business API** per invio automatico/tracciato dei documenti (a pagamento), evoluzione del deep link `wa.me` di A.6.

### C.3 — Tenute fuori di proposito (anti-bloat — vedi A.6)
NON implementare: ottimizzazione percorsi/dispatching, tracking GPS "stile Uber", prenotazione self-service 24/7, marketing automation complessa, gestione magazzino avanzata (stile Danea). Sono per aziende strutturate con squadre: ucciderebbero la semplicità che è il nostro vantaggio col singolo artigiano. Rivalutabili solo se il target cambia.

---

## FONTI RICERCA
- Stripe Connect / Payment Links per piattaforme: https://docs.stripe.com/connect/saas-platforms-and-marketplaces · https://stripe.com/connect
- Pagamenti fattura IT (PayPal/Satispay/bonifico): https://flextax.it/commercialisti-online/in-caso-di-pagamenti-ricevuti-tramite-paypal-o-satispay-la-procedura-di-fatturazione-e-la-stessa/ · https://support.satispay.com/it/articles/richiedere-un-pagamento
- Librerie product tour React/Next: https://usertourkit.com/blog/react-tour-library-benchmark-2026 · https://onboardjs.com/blog/5-best-react-onboarding-libraries-in-2025-compared
- Supabase Realtime + RLS chat: https://supabase.com/docs/guides/realtime/authorization · https://makerkit.dev/blog/tutorials/supabase-rls-best-practices
- PostGIS geo-query Supabase: https://supabase.com/docs/guides/database/extensions/postgis · https://blog.mansueli.com/leveraging-supabase-and-postgresql-for-distance-based-filtering-and-location-data-retrieval
- Estrazione strutturata LLM (JSON, temperatura, schema): https://thomas-wiegold.com/blog/building-reliable-invoice-extraction-prompts/ · https://www.cloudsquid.io/blog/structured-prompting
- Competitor field service (Jobber/Housecall/Joist/Tradify): https://www.getjobber.com/comparison/jobber-vs-housecall-pro/ · https://www.joist.com/ · https://www.tradifyhq.com/features/field-service-management-software-app
- Competitor IT (Danea/Fatture in Cloud): https://www.danea.it/software/easyfatt/caratteristiche/ · https://www.srlonline.com/software-gestionali-2026-fatture-in-cloud-vs-danea-teamsystem-confronto-prezzi-funzioni

### Verifiche aggiuntive (maggio 2026)
- Driver.js (v1.4.0, MIT): https://www.npmjs.com/package/driver.js · https://driverjs.com/docs/installation
- Mistral OCR (handwriting, prezzi, lingue): https://mistral.ai/news/mistral-ocr-3/ · https://aiproductivity.ai/tools/mistral-ocr/
- PayPal.Me (importo non preimpostabile) / Satispay payment link: https://www.paypal.com/us/cshelp/article/paypalme-frequently-asked-questions-help432 · https://developers.satispay.com/docs/payment-link
- QR EPC/SEPA (bonifico precompilato, gratis): https://it.qr-code-generator.com/solutions/epc-qr-code/ · https://www.dirittobancario.it/art/pagamenti-istantanei-e-qr-code-dallepc-le-proposte-di-standardizzazione/
- Nominatim usage policy (1 req/s, no uso primario): https://operations.osmfoundation.org/policies/nominatim/

### Recensioni — fonti legali/meccanismo (maggio 2026)
- Airbnb recensioni doppio cieco / 14 giorni: https://www.airbnb.com/help/article/13 · https://www.airbnb.com/help/article/995
- Rating reputazionale Italia (Mevaluate, Cassazione 28358/2023): https://www.ansa.it/sito/notizie/cronaca/2023/10/27/rating-reputazionale-cassazione-annulla-decisione-garante_f651ccd6-d2a9-42fd-bbfe-97b6c8532185.html · https://ntplusdiritto.ilsole24ore.com/art/rating-reputazionale-web-consenso-deve-riguardare-funzionamento-dell-algoritmo-AF1gU6BB
- Consenso GDPR valido (opt-in, non pre-spuntato, revocabile): https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/consent/what-is-valid-consent/
- Responsabilità piattaforma / notice-and-takedown (DSA, e-Commerce art.14): https://www.lexology.com/library/detail.aspx?g=dfee6202-da8e-4227-9b75-9bb23f21010d
