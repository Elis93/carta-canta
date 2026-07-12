# CLAUDE.md — Memoria permanente del progetto Carta Canta

> **Fonte di verità per Claude Code.**
> Va aggiornato a fine di ogni sessione con: feature implementate, decisioni prese, bug emersi, cose rimandate.
> Storico sessioni precedenti spostato in `STORICO_SESSIONI.md` (consolidamento doc 14 giu 2026).
> **Ultima sessione:** 7 luglio 2026 (COMPLIANCE + CYBERSECURITY — irrobustimento sicurezza, informative legali, 3 PDF per professionisti). Changelog operativo recente in `REGISTRO_AGGIORNAMENTI.md`.

---

## A0. HANDOFF — SESSIONE 7 lug (parte 2): export GDPR, fisco frontaliera, foto scontrino, Play Store

### Fatto anche (11-12 lug — collaudo di Eli: PR #44→#53, config esterne COMPLETATE)
- **Config esterne CHIUSE da Eli (verificate una a una):** Turnstile ATTIVO su /signup (widget verificato in prod) · caselle OVH `supporto@/privacy@/segnalazioni@` → redirect alla casella dedicata FUNZIONANTI (l'inoltro OVH ritarda di qualche minuto: normale; filtri Gmail "non spam" creati) · tetti spesa OpenAI $10 + Mistral 10€ prepagato · PostHog riceve eventi · Sentry riceve errori (testato con sonda temporanea poi rimossa, PR #45/#46) · **DMARC → p=quarantine** su OVH · AI Import ATTIVO (`NEXT_PUBLIC_AI_IMPORT_ENABLED=true` + chiavi). Flagsmith NON serve (mai cablato, ignorare).
- **🔴 BUG CRITICO fixato (PR #51, CONFERMATO da Eli in prod):** `/p/[token]` crashava ("qualcosa è andato storto") dal 6 lug — `hasPaymentChannels` esportata da un file `'use client'` e chiamata dalla pagina server → client reference invocata dal server. Trovato via Sentry/Vercel runtime errors. Fix: funzione+tipo in `lib/payments/channels.ts` (server-safe). **Lezione: mai chiamare dal server helper esportati da moduli client.**
- **PR #47 — spazi mangiati da Turbopack** (10 punti in aiuto/privacy/termini/ShareButton/PaymentInfoCard) fixati con `{' '}`, metodo: scan del BUILD compilato (regola permanente in B.2). + **Form di contatto in /aiuto** (`sendSupportMessageAction` → email a supporto@ con replyTo utente, rate-limit 5/h) al posto del solo mailto (che senza client di posta non fa nulla).
- **PR #48 — lotto feedback UX:** /altro riorganizzato in gruppi (**"Il tuo ufficio"** [rinominato da Eli, PR #52]: Lavori/Calendario/Sopralluoghi/Clienti · **Soldi** · **Farsi conoscere** · **Strumenti** · Account); spinner foto per-bottone (Scatta/Galleria); dialog "Segna come inviato" dice che la scadenza riparte da oggi (verificato: expires_at ricalcolato); overlay "Bozza salvata" col numero assegnato e 4s (era 1,5s); hint foto in creazione preventivo.
- **PR #49 — AI voci dal sopralluogo:** `lib/ai/extract-text.ts` (prompt per appunti sbrigativi, Mistral small→OpenAI fallback, Zod) + `POST /api/ai/extract-voci` (stessa quota AI import, consumo solo a successo, 5/min) + bottone oro "Compila le voci dalle note (AI)" in create mode; le voci estratte si aggiungono a quelle manuali.
- **PR #50/#52** — voce "Vetrina dei professionisti" in Altro (apre /professionisti, prima irraggiungibile dall'app) + rinomina gruppo. **PR #53 — tutorial:** passo 3 evidenzia ANCHE le voci (data-tour="cliente" su wrapper Cliente+Voci), passo 4 popover sopra il bottone, fasi intermedie con "Avanti" (non "Fine") + toast che spiega che il tour continua sul preventivo salvato (sembrava bloccato a 4/6); tasto Esci bianco. **PR #44** — istruzioni PayPal.me (paypal.com/paypalme) e Satispay (serve account BUSINESS, dashboard.satispay.com) corrette dopo test reale.
- **⚠️ APERTO — demo senza documenti:** Eli ha lanciato `seed:demo`, login ok ma "non ha documenti pronti". Lo script THROWA con errore visibile se un documento fallisce → attesa dell'output del terminale al prossimo run per diagnosi.
- Backlog manuale Eli rimasto: avvocato (3 PDF + campi gialli + punto commercialista in privacy), SdI/OpenAPI (cancello n.1), Play Store (account + D-U-N-S), Stripe live+P.IVA.

### Fatto anche (9 lug — canale commercialisti FASE B: invito + area /studio read-only)
- **B implementata (dopo FASE A/export).** ⚠️ **Migration 051 (`accountant_links`) DA APPLICARE.** Tabella con **RLS abilitata SENZA policy** → raggiungibile solo via service role (admin client), controlli espliciti nel codice. NON riusa `workspace_members` (le sue RLS non applicano il ruolo → un viewer potrebbe scrivere/auto-invitarsi).
- **Lato artigiano** (`lib/actions/accountant.ts`, card `AccountantCard` in Impostazioni›Generale sotto "Scarica i tuoi dati"): `inviteAccountantAction(email)` (solo proprietario, email validata+lowercased, rate-limit 10/h per workspace, upsert idempotente su `(workspace,email)`, invia `AccountantInviteEmail` senza emoji), `revokeAccountantAction` (scoped al workspace), `listAccountantLinks` (stato Collegato/Invito inviato). Tutto tollerante pre-migration.
- **Lato commercialista** (`app/studio/*`, layout dedicato — NON la shell artigiano): `/studio` = griglia dei clienti che l'hanno invitato; `/studio/[workspaceId]` = KPI Fatturato/Incassato + elenco fatture read-only + download Pacchetto A1 (`/api/studio/[id]/export`). `lib/studio.ts`: `getStudioUser()` richiede `email_confirmed_at`; `assertAccountantAccess(user, wsId)` verifica SEMPRE il link attivo (match email **esatto** lowercased — no `ilike`/wildcard; `revoked_at IS NULL`) prima di restituire il workspace → **IDOR bloccato, mai fidarsi del solo URL** (l'admin client bypassa la RLS). Revoca a effetto immediato (check per-request).
- **Condivisione codice CSV:** `buildRegistroFattureCsv` estratto in `lib/fiscal/registro-fatture.ts`, usato sia da `/api/commercialista/export` (artigiano) sia da `/api/studio/[id]/export` (commercialista).
- Proxy: `/studio` non è pubblico → sloggato reindirizzato a `/login?redirect=/studio`; loggato passa. Validato su PG16 (7 test: unique case-insensitive, revoca, re-invito, IDOR cross-tenant, cascade, RLS senza policy). tsc+build+**190/190** verdi.
- **TODO GDPR (Eli/avvocato):** il commercialista è un nuovo destinatario dati → privacy policy + punto nel PDF avvocato. FASE C (XML FatturaPA massivo) resta bloccata su SdI live.
- **Completamento B (10 lug, migration 051 APPLICATA da Eli):** `/studio/[id]` ora mantiene la promessa "fatture, incassi E SPESE" — KPI Spese + **export Bilancio (entrate/uscite per cassa)** anche dallo studio: `buildBilancioCsv` estratto in `lib/fiscal/bilancio-csv.ts` (condiviso con `/api/bilancio/export`, che resta Pro-gated lato artigiano; lato studio nessun gate — sono i dati del cliente), nuova route `/api/studio/[id]/export-bilancio` (stessa `assertAccountantAccess`). `ExportCommercialistaButton` ha prop `kind: 'registro'|'bilancio'` (copy dedicata). FAQ "Come collego il mio commercialista?" in /aiuto + voce in /novita.
- **Loop virale bidirezionale (10 lug, zero migration):** (1) **invito inverso studio→artigiano**: card "Porta un tuo cliente" in `/studio` → `inviteClientFromStudioAction` (rate-limit 10/h per studio, NESSUNA scrittura DB) invia `StudioClientInviteEmail` con link `/signup?studio=<email>&utm_source=studio`; `UtmCapture` salva `?studio=` in sessionStorage (`cc_studio`) → hidden field in SignupForm → `user_metadata.studio_invite_email`; in AccountantCard `getSuggestedAccountantEmail()` mostra il banner oro "Il tuo commercialista ti ha invitato — Collega" (un tocco → `inviteAccountantAction`) → **il consenso alla condivisione resta SEMPRE all'artigiano** (niente auto-link). (2) **Bottone WhatsApp sul referral** (artigiano→collega, messaggio precompilato col link ?ref=).

### Fatto e già in produzione (PR mergiate su master)
- **PR #8** `1574da1` — **"Scarica i tuoi dati"** (Impostazioni › Generale): `GET /api/account/export` → JSON con account, attività, clienti, preventivi/fatture+voci, spese. Sola lettura. Chiude gap portabilità GDPR art. 20.
- **PR #9** `d9227b6` — **Foto scontrino (AI)** nel Bilancio: `lib/ai/receipt.ts` (Mistral pixtral primario → OpenAI fallback, categoria normalizzata sui preset) + `POST /api/ai/scan-receipt` (stessa quota/rate-limit dell'AI import) + bottone in `AddExpenseDialog` (dietro `NEXT_PUBLIC_AI_IMPORT_ENABLED`; amount/date resi controllati). **+ Pagina pubblica `/cancella-account`** (app/(legal)/cancella-account) — richiesta dal Data Safety del Play Store; link nel footer legale. Manifest già con icona maskable.

### Ricerche web consegnate a Eli (nella guida PDF)
- **Fisco frontaliera + P.IVA:** non obbligata ad aprirla finché non incassa → tenere l'app in **beta gratuita**; SaaS ad abbonamenti = attività abituale (servirà P.IVA quando monetizza); **forfettario probabilmente precluso** perché il reddito da frontaliera (>35k) conta nella causa ostativa. Da confermare col commercialista (domande pronte nel PDF).
- **Play Store:** via **TWA + PWABuilder**; nodo = tipo account **Personale (12 tester/14gg) vs Organizzazione (D-U-N-S, esente)**; serve assetlinks.json (fingerprint da lei), account demo per il review, Data Safety + URL cancellazione (fatto).
- **Compliance self-serve:** privacy/cookie/termini/registro trattamenti/DPA fornitori/Data Safety = fai-da-te; **no DPO**; servono professionisti solo per doppio ruolo+DPA utenti+AI (avvocato) e **tutta la parte fiscale** (commercialista).

### PDF consegnati a Eli (scratchpad/legal-pdf, via SendUserFile)
`CartaCanta_GUIDA_Eli.pdf` (guida operativa: cosa fare / cosa chiedere / Play Store / fai-da-te / cosa manca) + i 3 PDF professionisti (avvocato/commercialista/sicurezza).

### Fatto anche (PR #10 `feat: follow-up + service worker`)
- **Follow-up automatici (opt-in, default OFF)**: cron notturno invia UN sollecito al cliente se un preventivo è sent/viewed da ≥3gg, mai sollecitato e non in scadenza (riusa SollecitoClienteEmail + last_reminder_at). Toggle in Impostazioni›Notifiche. Chiave `followup_auto` nel JSONB notification_prefs → nessuna migration.
- **Service worker** (`public/sw.js`, conservativo network-first per le pagine + cache statici + `offline.html`): registrato solo in prod via `components/shared/ServiceWorkerRegister.tsx`. Velocità percepita + punteggio PWA per il Play Store.

### Fatto anche (PR #11 `e5bca20` — fix da ri-verifica runtime)
**BUG TROVATO col `next start` locale:** il matcher del proxy esclude solo le immagini → `/manifest.webmanifest` (bug pre-esistente!), `/sw.js`, `/offline.html` e `/cancella-account` venivano rediretti a /login per gli sloggati (SW non registrabile, install PWA rotta sulla landing, pagina Play Store non pubblica). Fix: aggiunti a PUBLIC_PATHS in proxy.ts. Verificato in locale: 200 su tutte, /dashboard resta 307. ⚠️ Lezione: ogni nuova route/file pubblico va aggiunto a PUBLIC_PATHS (il matcher NON esclude .js/.html/.webmanifest).

### Fatto anche (PR #13 `2659e45` — calendario sopralluoghi + camera + prefill)
- **Calendario sopralluoghi** (decisione vincolante DECISIONI_E_FEEDBACK): campo Appuntamento (datetime-local) sul sopralluogo; card "Prossimi appuntamenti" in cima alla lista con bottone **navigazione Google Maps** (`google.com/maps/dir/?api=1&destination=`). Orari in **Europe/Rome** (`romeIso()` in lib/actions/sopralluoghi.ts per il parsing con offset CET/CEST; display con timeZone). **⚠️ Migration 047** (`scheduled_at` + indice) validata 2× su PG16 — **da applicare da Eli**; query/salvataggi tolleranti pre-migration (retry senza colonna).
- **Scatta foto** nel sopralluogo: secondo input `capture="environment"` → tile "Scatta" apre la fotocamera; "Galleria" per la selezione multipla.
- **Prefill richiesta marketplace → preventivo**: "Crea preventivo" passa `?titolo=&nota=`; PreventivoForm ha `initialTitle`/`initialInternalNotes` (create mode) e apre "Altre opzioni" col prefill.
- Verificato anche: promemoria acconto = notifica campanella già esistente (lib/notifications.ts); due_date hint già nel form fatture. NON restano feature promesse non implementate salvo quelle bloccate su Eli/professionisti.

### Audit tasti/funzionalità — COMPLETATO (PR #16 `669186c`)
4 agent paralleli, findings verificati di persona. 8 fix: **ATECO azzerati salvando il tab Generale** (ALTA — update condizionale); **Riapri preventivo scaduto** falliva (expired→sent mancante + rinnovo expires_at); pagine `/p/[token]/grazie|scaduto|rifiutato` senza filtro deleted_at; "Importa con AI" assente su desktop Catalogo; agenda sopralluoghi con query dedicata; follow-up con finestra 30gg su sent_at; KPI "In attesa" include expired; categoria scontrino case-insensitive. **Fix precedente (PR #15 `42d3316`):** bottone Cerca fuori schermo su /professionisti (input senza minWidth:0) + stesso pattern in Signup/Marketplace/Onboarding/ImportWizard. Resto dell'app verificato pulito (foto-scontrino e2e, cron follow-up anti-spam, pubbliche, Stripe, auth, notifiche, Europe/Rome round-trip).

### Fatto anche (sera 7 lug — PR #19/#20/#21)
- **PR #19**: /calendario (appuntamenti raggruppati per giorno + Maps) + voce in Altro; Bilancio: finestra grafico ancorata al mese selezionato, MonthPicker nativo (input type=month trasparente sul titolo), navigazione con replace (freccia indietro esce dalla pagina), clamp mesi futuri; spinner per-azione in MarketplaceProfileForm e SopralluogoForm (bug: girava sul bottone non premuto).
- **PR #20 (lotto 1 lista mancanti)**: /aiuto (6 FAQ + supporto@cartacanta.app — CASELLA DA CREARE da Eli) e /novita (changelog utente) in Altro›Account; "Sto arrivando" WhatsApp precompilato nel Calendario.
- **PR #21 — GESTIONE LAVORI (decisione Eli: opzione A, sezione dedicata)**: tabella `lavori` (⚠️ **migration 048 da applicare**, validata 2× su PG16 con test vincoli); "Apri lavoro" sul preventivo accettato (idempotente, indice univoco document_id); /lavori (filtri pill per stato), /lavori/[id] (stepper stati da_iniziare→in_corso→finito→fatturato con started_at/finished_at, note+dettatura, Maps, link preventivo/fattura, WorkPhotosCard sul documento di origine), /lavori/nuovo; lib/actions/lavori.ts tollerante pre-migration; voce Lavori in Altro›Strumenti. PROSSIMI della lista: agenda settimanale coi Lavori (#4), rapportino firmato (#5), margine per lavoro (#6), Sentry/PostHog (#8, servono chiavi), captcha (#9), account demo (#10). LANCIO.md creato (PR #18) con piano di lancio da compilare.

### Fatto anche (8 lug — PR #23 + audit-2 + piano sponsorizzate)
- **PR #23 — agenda settimanale (#4) + margine per lavoro (#6)**: ⚠️ **migration 049 APPLICATA da Eli** (lavori.scheduled_at+report_*, expenses.lavoro_id). /calendario → vista settimanale (?w=, lun-dom, sopralluoghi+lavori uniti, chips "Lavori in corso", WhatsApp "sto arrivando" + Maps per evento); campo "Prossimo intervento" sul Lavoro; card "Economia del lavoro" (Preventivato/Speso/Margine) con spese collegate via `expenses.lavoro_id` (select Lavoro in AddExpenseDialog, sticky nel dettaglio lavoro). Fix successivi (`fe52294`): reset lavoroId nel dialog, Novità gated sul flag AI, toast creazione lavoro.
- **Ricerche recuperate dopo le interruzioni** (limiti di sessione avevano ucciso gli agent): piano sponsorizzate consegnato — **Meta senza pixel** (Lead Ads nativi + campagna Traffico con UTM; CMP+Pixel solo in fase 2), test 300€/14gg, KPI CPL<6€/reg<12€/attivazione≥30%, claim vietati per microimprese (AGCM). Tutto in **LANCIO.md §5-bis**. Audit tasti round-2 completato (tutti i findings fixati).

### Fatto anche (8 lug — rapportino #5 + pre-sponsorizzate: /prova + UTM)
- **Rapportino di fine lavoro firmato (#5)**: card sul dettaglio Lavoro (compare a stato finito/fatturato o se già creato) — testo con dettatura, `saveRapportoAction` (lib/actions/lavori.ts) genera token una tantum → link pubblico **`/r/[token]`** (testo + firma nome/tocco, admin client come /p/) + `POST /api/r/[token]/sign` (rate-limit 5/h per token, update condizionale `.is('report_signed_at', null)` anti doppia-firma, salva nome/IP/UA/timestamp — stessa FES dei preventivi). Dopo la firma il testo è bloccato (server-side in saveRapportoAction); banner verde "Firmato da X il …"; bottone WhatsApp precompilato. Usa le colonne `report_*` della **049 già applicata — NESSUNA nuova migration**. Token UUID validato con regex prima della query (evita errore cast PG). `/r/` in PUBLIC_PREFIXES.
- **Landing ads `/prova`** (pubblica, in PUBLIC_PATHS): claim unico "Il preventivo è fatto prima di risalire sul furgone", CTA→/signup, 3 passi, proof, checklist feature, mini-FAQ, footer legale. Copy conforme ai claim leciti (beta gratuita, MAI "gratis per sempre"). Manca solo il video demo (lo gira Eli).
- **UTM alla registrazione**: `components/shared/UtmCapture.tsx` nel layout root (first-touch → sessionStorage `cc_utm`) → hidden fields in SignupForm → `signupAction` le salva in `user_metadata` (utm_source/medium/campaign/content/term, max 100 char). Zero cookie, zero pixel — attribution per fonte da `auth.users.raw_user_meta_data->>'utm_source'`.
- Verificato con `next start` locale: /prova 200 pubblica; /r/ token invalido e inesistente → 404 (non redirect a login); /lavori e /dashboard restano 307; API sign risponde 404 JSON corretti.

### Fatto anche (8 lug — email di benvenuto: BUG trovato + fix)
- **BUG:** la welcome email (`lib/email/templates/welcome.tsx`) esisteva ma **in produzione non partiva mai**. `signupAction` la inviava solo se `authData.session` esisteva, ma con le conferme email attive (prod) la sessione al signup è null → la action esce prima con `verifica-email`. Il codice della welcome era di fatto **raggiungibile solo in dev** (auto-confirm). Inoltre il template violava 2 regole del progetto: **emoji** (🎉 ✅ — regola B.6 spam score) e claim errato **"8 preventivi (30 giorni di prova)"** (il Free è 8 storici, niente scadenza a 30gg).
- **FIX:** invio spostato in `app/auth/confirm/route.ts` quando `type === 'signup'` (il punto in cui l'utente vero conferma l'email) — `sendWelcomeBestEffort()` legge nome da user_metadata + workspace, await breve prima del redirect (Resend ~200-500ms, la lambda non si congela), best-effort (non blocca mai l'onboarding), token monouso = invio unico. Il path dev in signupAction resta (nessun doppio invio: i due percorsi si escludono). Template riscritto: **niente emoji**, claim corretto (8 preventivi, beta gratuita), CTA "Crea il primo preventivo" → /preventivi/nuovo (attivazione), contatto supporto@. Prop `dashboardUrl`→`ctaUrl`.
- Verificato: tsc+build+185 test verdi; render del template controllato (0 emoji, 0 claim "giorni di prova", CTA e supporto@ presenti). ⚠️ Da verificare in prod: registrare un'email vera e confermare → deve arrivare la welcome (richiede RESEND_API_KEY, già in prod).

### Fatto anche (8 lug — script account demo #10)
- **`scripts/seed-demo.ts`** (+ `npm run seed:demo`, + `scripts/README.md`): crea/RIPRISTINA un account dimostrativo per il **Play Store** (i revisori devono poter entrare) e per le demo di vendita. Utente `demo@cartacanta.app` / `CartaCanta-Demo-2026` creato con `email_confirm: true` (login immediato, niente conferma). Workspace idraulico (Idraulica Bianchi, forfettario, piano `pro`) con 4 clienti, 6 voci catalogo, 5 documenti (fattura pagata + preventivo accettato/firmato + inviato + scaduto + bozza, totali dal motore fiscale `calcolaDocumento`), 4 spese per il Bilancio, `invoice_sequences` allineate. **Idempotente**: `wipeUserWorkspaces` azzera i dati del solo demo e li ricrea. Env caricate da `.env.local`/`.env` con parser inline (nessuna dipendenza). Import statico di `createAdminClient` (niente top-level await: tsx→cjs non lo supporta).
- ⚠️ Lo script **lo lancia Eli** dal suo PC (`npm run seed:demo`): scrive sul DB di produzione (SERVICE_ROLE_KEY). Io non l'ho eseguito. Dry-run validato con env finte: env-loader + import + logica + gestione errori OK, fallisce solo alla chiamata di rete (atteso). tsc+build+185 verdi.

### Fatto anche (8 lug — captcha Turnstile #9, cablato e disattivato)
- **Cloudflare Turnstile sulla registrazione**: `components/shared/TurnstileWidget.tsx` (client, explicit render, rimonta su errore per token fresco) + `lib/turnstile.ts` (verifica server via siteverify, IP da x-forwarded-for) + call in `signupActionInner` dopo la validazione campi. **Gated**: senza `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (client) e `TURNSTILE_SECRET_KEY` (server) il widget non compare e la verifica ritorna true → registrazione IDENTICA a oggi. Fail-open se Cloudflare irraggiungibile (non perde iscrizioni legittime). Nessun CSP da toccare (next.config non ha CSP; X-Frame-Options DENY riguarda il framing delle NOSTRE pagine, non l'iframe di Turnstile). Env in `.env.example`.
- ⚠️ Per attivarlo Eli: su Cloudflare (dash → Turnstile) crea un widget per cartacanta.app → mette le 2 chiavi su Vercel → redeploy (il site key è inlined a build-time). Verificato in locale (senza chiavi): /signup 200, zero script/campo Turnstile, registrazione invariata. Percorso attivo da verificare in prod con chiave reale. tsc+build+185 verdi.

### Fatto anche (8 lug — PostHog analytics #8, cablato e disattivato)
- **PostHog EU** (`posthog-js` già in deps): `components/shared/PostHogProvider.tsx` (init gated su `NEXT_PUBLIC_POSTHOG_KEY`, host EU, `capture_pageview:false` + pageview manuale su cambio pathname, autocapture, `person_profiles:'identified_only'`) montato nel layout root; `lib/analytics.ts` → `phCapture(event, props)` no-op senza chiave. Evento esplicito **`signup_completed`** con le UTM in SignupForm (guard `signupTracked` anti-doppio) → attribution sponsorizzate. Il resto del funnel (primo preventivo creato/inviato) è ricostruibile da pageview+autocapture SENZA toccare il form fiscale (la creazione fa redirect server-side, nessun hook client pulito). Verificato senza chiave: /, /signup, /prova 200, nessun posthog.init. tsc+build+185 verdi.
- ⚠️ Per attivarlo Eli: crea progetto su PostHog EU → mette `NEXT_PUBLIC_POSTHOG_KEY` (+ eventuale `NEXT_PUBLIC_POSTHOG_HOST`) su Vercel → redeploy. Poi costruisce il funnel in PostHog: pageview /signup → signup_completed → pageview /preventivi/nuovo → pageview /preventivi/[id].

### Fatto anche (8 lug — Sentry monitoraggio errori #8, cablato e disattivato)
- **Sentry** (`@sentry/nextjs ^10`): `instrumentation.ts` (register server/edge + `onRequestError`, tutto gated sul DSN con import dinamico → niente Sentry caricato/eseguito senza chiave), `instrumentation-client.ts` (init browser con import dinamico dietro `NEXT_PUBLIC_SENTRY_DSN` inlined a build-time → dead-code + zero peso nel bundle se off), `sentry.server.config.ts` + `sentry.edge.config.ts` (init gated). Replay disattivato, `sendDefaultPii:false`. **NON** ho aggiunto `withSentryConfig` a next.config (evita il webpack plugin + rischio build): la cattura errori a runtime funziona comunque; le source map (stack leggibili) si aggiungono dopo con `withSentryConfig` + `SENTRY_AUTH_TOKEN` se serve. Verificato senza DSN: build verde, /, /dashboard(307), /signup ok, nessuna attività Sentry. tsc+build+185 verdi.
- ⚠️ Per attivarlo Eli: crea progetto su Sentry → mette lo stesso DSN in `SENTRY_DSN` e `NEXT_PUBLIC_SENTRY_DSN` su Vercel → redeploy.

### Fatto anche (9 lug — cancellazione account self-service, Opzione A)
- **Decisione Eli (ricerca + suo pop-up):** Opzione A = cancella subito account+dati personali NON fiscali, **conserva le fatture 10 anni** (art. 17.3.b GDPR + art. 2220 c.c.; obbligo del titolare P.IVA, noi teniamo la sua copia). ⚠️ **Migration 050** (`workspaces.deleted_at` + `anonymized_at` + indice) DA APPLICARE.
- **`lib/actions/account.ts` → `deleteAccountAction(confirmText)`**: solo il PROPRIETARIO; richiede di digitare "ELIMINA". Via admin client: rimuove i file storage (work-photos + logo); cancella le tabelle NON fiscali del workspace (catalog_items, expenses, lavori, sopralluoghi, work_photos, templates, marketplace_*, reviews, notification_reads, voice_usage, sdi_usage, ai_import_usage, document_views, workspace_members, invoice_sequences); cancella i **preventivi** (`documents doc_type<>'fattura'` → voci in cascade); cancella i **clienti non fatturati** (tiene quelli referenziati da una fattura); **congela il workspace** (deleted_at/anonymized_at, azzera logo/phone/notification_prefs, TIENE ragione_sociale/piva perché servono sulle fatture); infine **elimina l'utente auth** (login impossibile) + signOut. Le fatture + voci + clienti fatturati + identità fiscale del workspace RESTANO congelati.
- **`components/shared/DeleteAccountCard.tsx`**: card "Elimina account" in Impostazioni›Generale (sotto "Scarica i tuoi dati") → pop-up che spiega cosa si cancella/cosa resta, offre "Scarica i tuoi dati", richiede di scrivere ELIMINA; a fine mostra congedo e va a "/". Pagina pubblica `/cancella-account` aggiornata (in-app come via primaria).
- **Validato su PG16** (stub con FK reali): dopo la cancellazione restano SOLO la fattura + le sue 2 voci + il cliente fatturato + workspace congelato; tutto il resto a 0. tsc+build+185 verdi.
- ⚠️ **Da testare da Eli sull'account DEMO** (`npm run seed:demo` lo ricrea), NON sul suo reale, prima di fidarsi. Formulazione esatta e campi minimi da far validare all'avvocato. Il purge definitivo dopo 10 anni (cron su `deleted_at`) è un TODO futuro.

### Fatto anche (9 lug — canale commercialisti: mappa verificata + FASE A implementata)
- **Doppia ricerca** (esigenze studi + analisi competitor FIC/TeamSystem/Danea/Aruba/Zucchetti/QBO/Xero) → **mappa in LANCIO.md §12-bis**, poi **verificata adversarialmente** (norme via web indipendente + claim tecnici sul codice + sicurezza design): tutti i claim normativi confermati, 8 precisazioni integrate.
- **⚠️ SCOPERTA NORMATIVA CHIAVE (verificata 2×):** dal 1/1/2024 obbligo fattura elettronica via SdI per TUTTI i forfettari → le fatture PDF di Carta Canta valgono solo come copia di cortesia/proforma finché l'SdI non è live (fattura non-SdI = "non emessa", sanzioni 250-2.000€). I preventivi non hanno obblighi. **L'SdI (bloccato su credenziali OpenAPI di Eli) è il must-have n.1.** Da valutare con l'avvocato il copy in-app sulla fattura PDF.
- **FASE A implementata — Export "Pacchetto commercialista"**: `GET /api/commercialista/export?from&to` = registro CSV delle fatture emesse nel periodo (data emissione `sent_at`→fallback created_at dichiarato, numero, cliente, P.IVA/CF, **imponibile netto sconti**, IVA, bollo, totale, stato incasso, incassato totale + data ULTIMO incasso; annullate nel registro ma fuori dai totali → spiegano i buchi di numerazione; note esplicative nel file). Formato Excel IT (`;`+BOM), anti-injection via **`lib/csv.ts`** (helper estratti dall'export bilancio, che ora li importa). **`lib/fiscal/imponibile.ts`** (`imponibileNettoSconti`, stessa formula afterDiscount del motore) + **5 test** che lo confrontano con calcolaDocumento → 190 test totali. UI: `ExportCommercialistaButton` (dialog date, default anno corrente) nel header desktop /fatture + card in Impostazioni›Generale. Senza gate di piano (sono i dati dell'utente, come l'export fatture). Voce in /novita.
- **Limite dichiarato:** una sola coppia `paid_at/paid_amount` per fattura (acconti cumulativi sovrascrivono la data) → colonne "incassato totale/data ultimo incasso", NON registro movimenti. FASE B (invito commercialista + area /studio read-only con `accountant_links`, MAI riusare workspace_members: RLS senza enforcement ruolo, viewer potrebbe scrivere/auto-invitare) e FASE C (XML FatturaPA post-SdI) in LANCIO §12-bis — B parte al prossimo ok di Eli.

### Backlog residuo (non fatto)
FASE B commercialisti (invito + /studio read-only — design in LANCIO §12-bis, GDPR: aggiornare privacy + punto avvocato) e FASE C (XML post-SdI); video demo su /prova (lo gira Eli con NotebookLM) + email automatica per i lead dei moduli Meta Lead Ads (si imposta quando parte la campagna); Sentry (#8) + PostHog (#8) CABLATI — Eli mette solo le chiavi; captcha Turnstile (#9) CABLATO — Eli mette le chiavi Cloudflare; account demo (#10) SCRIPT PRONTO — Eli lo lancia col Play Store; pagamento carta nel link (dopo P.IVA+Stripe); cron purge workspace cancellati >10 anni; 2FA/CSP/pen-test; SdI reale; assetlinks.json per il Play Store (serve fingerprint da Eli).

### Migration: 047+048+049+050 tutte APPLICATE. Il lotto commercialisti FASE A NON richiede migration. Test: tsc verde · build verde · **190/190** verdi.

---

## ⏰ PROMEMORIA PER ELI — DA MOSTRARE L'8 LUGLIO 2026 (richiesto il 7 lug: "ricordamelo domani")

> Ieri Eli non poteva fare azioni manuali. Ricordarle queste cose (nessuna urgenza tecnica, l'app è già live e schermata):
> 1. **Far leggere i 3 PDF** ai professionisti (avvocato, commercialista, sicurezza) — inviati in chat il 7 lug.
> 2. **Compilare i campi in giallo** nelle pagine Privacy e Termini (ragione sociale, P.IVA, foro, email privacy) DOPO l'ok dell'avvocato.
> 3. **Decidere la forma giuridica / questione Partita IVA** — vedi ricerca fiscale frontaliera nel report del 7 lug: da validare col commercialista.
> 4. **Creare la casella** segnalazioni@cartacanta.app.
> 5. In sospeso da prima: **DMARC** OVH (none→quarantine), **OpenAI** key su Vercel per AI Import, **Stripe** live quando pronta.
> 6. ~~Migration 047~~ FATTA da Eli il 7 lug sera. **Applicare la migration 048 (Lavori)** su Supabase SQL Editor — testo nel messaggio del 7 lug notte.
> 7. **Creare la casella supporto@cartacanta.app** (la pagina Aiuto in app la usa già).

---

## A. HANDOFF — SESSIONE COMPLIANCE + SICUREZZA (7 luglio 2026)

### Contesto
Sessione lunga con Eli: (1) portare in produzione i fix dell'audit via PR; (2) UI campi ricerca a sfondo bianco; (3) simulazione completa flussi artigiano+cliente con fix; (4) notifiche navigabili; (5) Bilancio con grafico cliccabile + export CSV per il commercialista; (6) **compliance legale + cybersecurity**: brainstorming multi-agent, ricerca web, implementazione protezioni e testi legali, 3 PDF per avvocato/commercialista/consulente sicurezza.

### Fatto in questa sessione (PR mergiate su master, deploy Vercel)
- **PR #1** `25c83fe` — fix audit correttezza/sicurezza/UI (Commit A+B della sessione 6 lug).
- **PR #2** `3bc0955` — catalogo: un solo bottone navy, CTA card AI in oro.
- **PR #3** `dfab89f` — ri-audit UX: notifiche navigabili, marketplace raggiungibile (link in landing), niente ripetizioni/tasti inutili, badge non-stato a contorno, input 16px (no zoom iOS).
- **PR #4** `f2fe0cc` — campi ricerca a sfondo bianco (SearchBar, Catalogo, Sopralluoghi, Professionisti, ClientAutocomplete).
- **PR #5** `b32b0f6` — Bilancio: colonne grafico cliccabili (naviga al mese) + Esporta CSV con intervallo date (criterio di cassa, `;` + BOM per Excel IT). Solo Pro.
- **PR #6** `819fa03` — simulazione percorsi: quota Free non consuma slot su fatture né su ri-invio; cestino non operabile (route pubbliche/cron/liste); acconti post-conversione. **Migration 046 applicata da Eli.**
- **PR #7** `3ca83b8` — **COMPLIANCE + SICUREZZA (questo lotto):**
  - **Sicurezza:** header `Permissions-Policy`/`Cross-Origin-Opener-Policy`/`X-Permitted-Cross-Domain-Policies` (next.config.ts); `lib/public-rate-limit.ts` (Upstash persistente + fallback in-memory) su accept/decline/review/marketplace-richiesta/ai-extract/view; open-redirect fix su auth/callback+confirm (solo path interni); anti CSV/formula-injection negli export (bilancio/preventivi/fatture); webhook SdI con `timingSafeEqual`; iframe pubblico in `sandbox`; log senza email/destinatari; retention GDPR nel cron (`document_views` >12 mesi, `marketplace_requests` >12 mesi).
  - **Legale:** privacy (doppio ruolo Titolare/Responsabile, fornitori Mistral/OpenAI/AssemblyAI + basi DPF/SCC, trasparenza AI); termini (no consulenza fiscale, contenuti utente, funzioni AI, recensioni/directory come hosting provider, recesso+conservazione fiscale); informative nei punti di raccolta (accettazione preventivo=FES, recensioni, richiesta marketplace, footer link pubblico, tooltip dettatura).
- **3 PDF generati** (scratchpad, inviati a Eli via file): `CartaCanta_Avvocato.pdf`, `CartaCanta_Commercialista.pdf`, `CartaCanta_Sicurezza.pdf` — ricognizioni tecniche con domande aperte per ciascun professionista. Non sono pareri, da validare.

### Migration: NO in questo lotto compliance (retention usa tabelle esistenti). 046 già applicata da Eli in PR #6.

### Gap/backlog emersi (NON implementati — richiedono decisione)
1. **Cancellazione account + export completo self-service in-app** (gap GDPR ALTO): oggi via email. Serve sign-off legale su cosa trattenere (conservazione fiscale).
2. **2FA opzionale (TOTP)**, **CSP con nonce**, **Sentry in prod**, **penetration test indipendente**, **procedura data breach formale** — raccomandazioni pre-lancio commerciale.
3. **TOP feature da ricerca web** (Jobber/ServiceM8/Tradify): follow-up automatici, pagamento con carta nel link pubblico, foto scontrino spese → da valutare, non implementati.
4. **PWA/offline** per velocità percepita (manifest + install + Serwist) → proposto, non implementato.
5. **Numerazione fatture con buchi** (bozze cancellate): valutare assegnazione all'emissione — domanda posta al commercialista nel PDF.
6. SdI/OpenAPI: bloccato su credenziali + validazione legale (invariato).

### Azioni manuali per Eli (config esterna) — vedi fondo dell'ultimo messaggio in chat
Compilare i campi `[…]` nei testi legali (ragione sociale, P.IVA, foro, email privacy), decidere forma giuridica, casella segnalazioni@, revisione professionale dei 3 PDF.

### Test eseguiti
tsc verde · build verde · **185/185** verdi (dopo il lotto compliance). Deploy Vercel #7 partito su master. Non testato in browser.

### Esito finale
🟡 FIX APPLICATO + PDF CONSEGNATI — da verificare in browser e da far validare ai professionisti. Nessuna migration in questo lotto.

---

## A-old. HANDOFF — SESSIONE AUDIT (6 luglio 2026) — audit completo app + fix

### Contesto
Eli ha chiesto un audit di TUTTA la app (funzioni, tasti, coerenza, estetica, copertura decisioni .md, sensatezza dei flussi). Eseguito con 4 agent paralleli (UI blocchi 1-5, UI blocchi 6-9, flussi/sicurezza, copertura decisioni .md). Fix applicati in 2 commit sul branch `claude/dettaglio-preventivo-review-gyavu7`.

### Fatto in questa sessione
1. **Commit A (`7ac51f5`) — correttezza/sicurezza:**
   - **saveDraftAction riparata** (bug grave introdotto il 6 lug): non gestiva option_tier/fiscalDoc/acconti — l'auto-save corrompeva i preventivi con opzioni a livelli. Ora replica create/update; totali NON azzerati se il parse voci fallisce durante la digitazione.
   - `parseImportoIt` condiviso in `lib/utils` (+7 test → 185 totali): le 5 copie locali leggevano "85.50" come 8550 (fallback irraggiungibile). Usato ovunque (expenses, SegnaPagata, AccontoCard, ImportWizard, acconti form/server).
   - Accept pubblico: update condizionale `.in('status',['sent','viewed'])` (no doppia accettazione) + le proposte non scelte si cancellano SOLO dopo lo status update.
   - `/api/fatture/[id]/status`: acconti CUMULATIVI (prima il secondo sovrascriveva il primo) + blocco importo > residuo.
   - `registerDepositReceivedAction`: valida doc_type=preventivo, status=accepted, importo ≤ totale.
   - Opzioni a livelli: gate server-side piano Free (`parseOptionsFields(data, isPro)`).
   - Converti-fattura: 409 se più proposte e nessuna `accepted_tier`.
   - SDI: claim atomico anti doppio-invio (sdi_status→'inviata' condizionale, ripristino su errore provider); 422 su sconti e IVA mista (XML fase 1 non li rappresenta); webhook accetta esiti solo da 'inviata'.
   - AI extract: tetto estrazioni SU DB (righe `plan_at_use='extract'` in ai_import_usage: 10 Free / 60 Pro / 3000 globale mese) — il costo AI nasce all'estrazione; quote di salvataggio filtrate su `plan_at_use IN ('free','pro')`.
   - Ricerche: sanitizzati `,()` nei filtri `.or()` ilike (6 punti).
   - Marketplace: publish/unpublish via ADMIN client (enabled/published_at non più scrivibili dal client → migration 045); Invio nel form salva bozza (intentRef, non più submitter).
   - Pagina pubblica: acconto già ricevuto mostrato anche sul preventivo, QR EPC sul saldo ("Saldo …").
   - Update tolleranti 038/041 SEPARATI (`applyDepositAndOptions`).
2. **Commit B (`c98226f`) — coerenza UI/UX:** scala tipografica nelle nuove feature (sezioni 11→13px, KPI 10→12, badge 10→11); header mobile normalizzati (titolo a sinistra, spacer 24); campanella anche su desktop dashboard; notifiche navigate-first; badge richieste NUOVE in Altro; WorkPhotosCard conferma eliminazione + avviso >6 foto; dropzone cliccabile; sopralluogo photo-first (titolo default datato); Segna pagata blocco > totale; published sync marketplace; pill Marketplace in /abbonamento; validazione contatto RequestForm; stelle tap 32px; copy serbatoio/intestatario/directory vuota; medie recensioni su 500.

### Migration: SÌ — **045_security_fixes.sql** da applicare da Eli (validata su PG16 locale, idempotente)
Storage work-photos scoped alla cartella `{user_id}/`; reviews aggiornabili solo su reported_at/report_reason; marketplace_profiles enabled/published_at/vies_checked_at solo service-role; marketplace_requests solo cambio status dal client. ⚠️ Da applicare INSIEME al codice (il publish marketplace ora usa l'admin client, funziona anche pre-045; ma senza 045 le colonne privilegiate restano scrivibili dal client).

### Gap emersi dall'audit NON ancora implementati (prossimi task)
1. **Cron promemoria acconto** (decisione vincolante in DECISIONI_E_FEEDBACK — backlog).
2. **Consensi/testi legali**: click-through conservazione SDI, privacy sub-responsabile AI/SDI, consenso recensioni (prerequisito di LANCIO recensioni+marketplace — validazione legale da Eli).
3. **due_date fatture + sollecito pagamento** (colonna 038 esiste, UI mai fatta).
4. **Prefill richiesta marketplace → nuovo preventivo**.
5. Rate limit Upstash (persistente) sugli endpoint pubblici — oggi in-memory.
6. XML SDI: ScontoMaggiorazione + DatiRiepilogo per aliquota (fase 2 — per ora bloccati con 422).

### Test eseguiti
tsc verde · build verde · **185/185** verdi (7 nuovi test parseImportoIt). Migration 045 applicata 2 volte su PostgreSQL 16 locale con stub Supabase (idempotente, grants verificati). Non testato in browser.

### Esito finale
🟡 FIX APPLICATO — da verificare in browser da Eli. ⚠️ Migration 044 (se non già fatta) + 045 da applicare.

---

## A-pre. HANDOFF — SESSIONE FEATURE-PACK (5 luglio 2026) — perf + Bilancio

### Contesto
Eli ha approvato in blocco l'intero pacchetto feature (mockup in `mockup-mobile/`): Bilancio → Pagamenti F1 → Acconti → AI Import → Notifiche Home → Sopralluoghi/Foto/Opzioni → SDI → Recensioni → Marketplace. Decisioni vincolanti in `DECISIONI_E_FEEDBACK.md` (sez. "Ciclo incasso", "Budget €50", "Cantiere", "Crescita"). Un blocco = un commit; procedere in autonomia.

### Fatto in questa sessione
1. **Perf fase 1** (`6a34dc9`): `PageSkeleton` + `loading.tsx` su 9 route + `staleTimes {dynamic:30, static:180}`.
2. **Perf fase 2** (`419a4a3`): `lib/workspace-context.ts` — `getSessionWorkspace()` con `React.cache()`; layout + 20 pagine convertite. **Le nuove pagine DEVONO usare questo helper.**
3. **Blocco 1 Bilancio (Pro)** (`fe521ab`): route `/bilancio` (mese ‹›, KPI Entrate/Uscite/Utile, grafico 6 mesi, lista spese, `AddExpenseDialog`, `DeleteExpenseButton`), `lib/actions/expenses.ts`, `lib/constants/expense-categories.ts`, voce in Altro›Strumenti (pill PRO), lock Free. Entrate a cassa (paid_at/paid_amount, fallback accepted).
4. **Blocco 2 Pagamenti F1** (`9a6e7a4`): tab Impostazioni›Pagamenti (IBAN mod-97, PayPal/Satispay con aiuto passo-passo, note placeholder contanti), `lib/payments/iban.ts`+`epc.ts` (QR EPC via `qrcode`), `PaymentInfoCard` su `/p/[token]` (fatture da pagare + preventivi accettati), sezione "Come pagare" in fondo al PDF (4 preset, prima della nota legale), `SegnaPagataButton` → dialog importo+data (importo<totale → payment_status `partial`, stato invariato), route `/api/fatture/[id]/status` estesa.
5. **Blocco 3 Acconti** (`d8fa81f`): toggle in Altre opzioni (pillole %/€, default 30, anteprima live), persistenza `deposit_type/deposit_value` (update tollerante in create/saveDraft), riga ambra acconto su pagina pubblica (MobilePublicCard `deposit` prop) + PDF (`depositHtml`), `AccontoCard` nel dettaglio preventivo accettato + `registerDepositReceivedAction`, QR EPC con importo acconto/saldo, conversione → fattura `partial` con spostamento incasso (no doppio conteggio).
6. **Blocco 4 AI Import** (`aee4af4`): card oro nel Catalogo + route `/catalogo/importa` (`ImportWizard`: upload → estrazione → righe EDITABILI → salva), `lib/ai/quota.ts` (Free 1 a vita contato al salvataggio, Pro 15/mese, serbatoio 300+100×Pro, kill-switch 1500), `importCatalogItemsAction`, `/api/ai/extract` aperto ai Free con quota + **Mistral primario/OpenAI fallback** (corretto l'ordine), voce "Carica il listino nel catalogo" in Completa il profilo. Tutto dietro `NEXT_PUBLIC_AI_IMPORT_ENABLED`.
7. **Blocco 5 Notifiche Home** (`d9e05b2`): campanella nell'header dashboard (badge non lette, anche Free), route `/notifiche` (`NotificationList`: pallino blu per-notifica, Segna tutte lette), `lib/notifications.ts` (tipi: viewed, acconto — SDI arriverà), `markNotificationsReadAction`, toggle in Impostazioni›Notifiche (`inapp_visto`, `inapp_acconto` in notification_prefs).

### Migration: SÌ — TRE da applicare da Eli (in ordine)
- **038_ciclo_incasso.sql**: `expenses` + `documents.payment_status/paid_at/paid_amount/due_date` + canali pagamento workspace + `deposit_type/deposit_value` + retrofill fatture accepted→paid.
- **039_ai_import_usage.sql**: registro utilizzi AI Import.
- **040_notification_reads.sql**: stato lettura notifiche campanella.
Tutto il codice è TOLLERANTE pre-migration (query con `as any` + try/fallback). `types/database.ts` NON rigenerato → nuove tabelle/colonne accedute via cast con commento eslint.

### Prossimi blocchi (ordine concordato — decisioni in DECISIONI_E_FEEDBACK.md)
6. ✅ FATTO (6 lug — commit `f1f3754` + `16b790a`): Sopralluoghi (`/sopralluoghi`, trasforma in preventivo con Note interne + foto collegate) · Foto prima/dopo (WorkPhotosCard su entrambi i dettagli, occhio visibilità default OFF, 6 Free/∞ Pro, pagina pubblica non PDF) · Opzioni a livelli (toggle Pro nel form, tier su document_items.option_tier, TierPicker pubblico, accettazione tiene solo la proposta scelta e ricalcola i totali). Migration 041 APPLICATA da Eli.
7. **SDI** (Pro + Free cap 8 trasmissioni totali; sotto-budget €15 kill-switch; costo MAI mostrato — "Incluso nel piano Pro · Conservazione a norma inclusa"; scartata → notifica app + EMAIL; provider gestito da scegliere — vedi ricerca-fatturazione-elettronica/DECISIONE_SDI.md; servono credenziali provider da Eli — BLOCCANTE).
8. ✅ FATTO (6 lug — commit `6ce9a46`): Recensioni a domande chiuse (4 stelle + Sì/No), sblocco automatico a fattura `payment_status='paid'`, nome puntato, pagina `/recensioni` con aggregati, Segnala (notice-and-takedown). Migration 042 APPLICATA da Eli.
9. ✅ FATTO (6 lug — commit `5e42767`): Marketplace MVP — `/marketplace` opt-in con verifica automatica (VIES via `lib/marketplace/vies.ts` + email confermata + profilo completo), directory pubblica `/professionisti` (Pro "In evidenza" in cima), `/richieste` in app (Nuova/Letta/Risposta), email teaser senza dettagli. Migration 043 APPLICATA da Eli. NB: creare casella `segnalazioni@cartacanta.app`; validazione legale = prerequisito di LANCIO per recensioni+marketplace.
Backlog: calendario sopralluoghi con deep-link Google Maps; promemoria acconto via cron; tipi notifica SDI (col blocco 7).
7-bis. ✅ STRUTTURA SDI FATTA (6 lug): migration 044 (codice_destinatario/pec su clients, stati sdi_* su documents, sdi_config_done_at, tabella sdi_usage) · `lib/sdi/` (types, xml FatturaPA RF19/N2.2/bollo/dicitura, quota Free 8 a vita + kill-switch 85/mese ≈ €15, provider mock + skeleton OpenAPI) · `POST /api/fatture/[id]/sdi` (validazioni dati fiscali/cliente, canale destinatario/PEC salvato in rubrica, ensureConfiguration una tantum) · `POST /api/webhooks/sdi` (esiti → stati + email scarto `sdi_scartata.tsx`) · `SdiCard` sul dettaglio fattura (costo MAI mostrato — "Incluso nel piano Pro · Conservazione a norma inclusa"; Free "N di 8"; badge PROVA col mock) · notifiche campanella `sdi_scartata`/`sdi_da_trasmettere` + toggle in Impostazioni. Tutto dietro `NEXT_PUBLIC_SDI_ENABLED`; senza `OPENAPI_SDI_API_KEY` → provider MOCK. ⚠️ Endpoint/payload OpenAPI DA VERIFICARE IN SANDBOX quando arrivano le chiavi.
**RESTANO (bloccati su Eli) per il go-live SDI:** (1) screenshot contratto/DPA OpenAPI da far revisionare, (2) registrazione su console.openapi.com + chiavi sandbox/prod + credito, (3) validazione testi legali. Decisioni: OpenAPI, SOLO INVIO, Pro illimitato, layer astrazione lib/sdi/. BUDGET RICONCILIATO (Eli 6 lug): sotto-budget Free €15/mese (tetto unico €50) — supera il €30 del doc di giugno. Cap per-utente Free (5 a vita vs 8): chiesto a Eli.

### Test eseguiti
tsc verde · build verde · 178/178 verdi dopo OGNI blocco. Non testato in browser — verifiche da Eli elencate in REGISTRO_AGGIORNAMENTI.md per blocco.

### Esito finale
🟡 FIX APPLICATO — da verificare in browser da Eli. ⚠️ Migration 038+039+040 da applicare.

---

## A. HANDOFF — SESSIONE UI-Rev (18 giugno 2026) — continuazione (22)

### Fix applicati — RIFINITURE Nuovo preventivo (1 commit `940a633`)

**COMMIT Q — Note parentesi eredita Label; SUBTOTALE allineato ai Label campi**

**(1) Note/Note interne — parentesi uniforme alla Label:**
- Rimosso `style={{ fontSize: 14, fontWeight: 400, color: '#8a887f' }}` dagli `<span>` "(visibili al cliente)" e "(non visibili al cliente)"
- Gli span ora ereditano lo stile della Label padre (12px/600/#8a887f/letterSpacing 0.05em/uppercase)
- Risultato: "NOTE (VISIBILI AL CLIENTE)" tutto uniforme

**(2) FiscalSummary SUBTOTALE — allineato ai Label dei campi:**
- `fontSize: 13, letterSpacing: '.07em', color: '#6f6d64'` → `fontSize: 12, letterSpacing: '0.05em', color: '#8a887f'`
- `fontWeight: 600` e `textTransform: 'uppercase'` invariati

### File toccati (sessione UI-Rev — commit Q)
```
app/(app)/preventivi/_components/PreventivoForm.tsx  [1: rimossi override span Note/Note interne]
app/(app)/preventivi/_components/FiscalSummary.tsx   [2: Subtotale 12px/#8a887f/0.05em]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — "NOTE (VISIBILI AL CLIENTE)" uniforme; "SUBTOTALE" stesso stile di "TERMINI DI PAGAMENTO".

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (18 giugno 2026) — continuazione (21)

### Fix applicati — RIFINITURE Nuovo preventivo (1 commit `8880eeb`)

**COMMIT P — pt-3 su div "Altre opzioni" (spazio tra toggle e primo campo)**

- `PreventivoForm.tsx` ~705: `altreOpzioniOpen ? 'space-y-5 pb-4'` → `'space-y-5 pb-4 pt-3'`
- Aggiunge ~12px di padding-top quando il pannello è aperto → stacco visivo tra "ALTRE OPZIONI" e "NUMERO PREVENTIVO".

### File toccati
```
app/(app)/preventivi/_components/PreventivoForm.tsx  [pt-3 su div Altre opzioni]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — più spazio tra toggle "ALTRE OPZIONI" e primo campo.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (18 giugno 2026) — continuazione (20)

### Fix applicati — RIFINITURE Nuovo preventivo (1 commit `71b0806`)

**COMMIT O — label MAIUSCOLO, 3 frasette identiche, SUBTOTALE uppercase**

**(1) Label 8 campi "Altre opzioni" → MAIUSCOLO:**
- Aggiunto `textTransform: 'uppercase'` allo style esistente (replace_all)
- Stile finale: `fontSize: 12, fontWeight: 600, color: '#8a887f', letterSpacing: '0.05em', textTransform: 'uppercase'`

**(2) 3 frasette aiuto — unificate a 12px + #767676:**
- "Numero assegnato automaticamente..." (PreventivoForm ~736): `text-[14px] text-muted-foreground` → `text-[12px]` + `style={{ color: '#767676' }}`
- "Percentuale di detrazione..." (PreventivoForm ~953): stessa trasformazione, mantenuto `maxWidth: 320`
- "Regime forfettario — operazione fuori campo IVA" (FiscalSummary ~99): `text-xs` + `color: #6f6d64` → `text-[12px]` + `style={{ color: '#767676' }}`

**(3) "SUBTOTALE" — stile uguale a cc-section-label:**
- FiscalSummary ~65: `<span>Subtotale</span>` → `<span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64' }}>Subtotale</span>`
- Rimossa classe `text-muted-foreground` dal div wrapper (il valore € destra invariato)

### File toccati (sessione UI-Rev — commit O)
```
app/(app)/preventivi/_components/PreventivoForm.tsx  [1: textTransform uppercase Labels; 2: frasette 12px/#767676]
app/(app)/preventivi/_components/FiscalSummary.tsx   [2: frasette 12px/#767676; 3: Subtotale uppercase #6f6d64]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — label MAIUSCOLE, 3 frasette stessa dimensione/colore, SUBTOTALE uppercase.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (18 giugno 2026) — continuazione (19)

### Fix applicati — RIFINITURE Nuovo preventivo (1 commit `789557b`)

**COMMIT N — FiscalSummary nota regime forfettario leggibile**

- `FiscalSummary.tsx` riga regime forfettario: `className="text-xs text-muted-foreground/70 border-t pt-2"` → `className="text-xs border-t pt-2" style={{ color: '#6f6d64' }}`
- Motivo: `text-muted-foreground/70` produceva un grigio al 70% di opacità — quasi invisibile. `#6f6d64` è il grigio scuro già in uso per `.cc-section-label`.

### File toccati
```
app/(app)/preventivi/_components/FiscalSummary.tsx  [color #6f6d64, rimossa opacità /70]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — nota "Regime forfettario — operazione fuori campo IVA" visibile nel riepilogo.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (18 giugno 2026) — continuazione (18)

### Fix applicati — RIFINITURE Nuovo preventivo (1 commit `231e7a5`)

**COMMIT M — gerarchia titoli, icona bonus, valori voce 13px, catalogo**

**(1) `.cc-section-label` color più scuro:**
- `globals.css`: `color: #8a887f` → `#6f6d64`

**(2) "Altre opzioni" toggle → stile cc-section-label:**
- `<span>` toggle: `fontSize: 16, fontWeight: 600, color: 'var(--cc-text)'` → `fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64'`

**(3) `<Label>` campi "Altre opzioni" → 12px small-caps:**
- Tutti i `<Label style={{ fontSize: 15, fontWeight: 600, color: '#161616' }}>` → `style={{ fontSize: 12, fontWeight: 600, color: '#8a887f', letterSpacing: '0.05em' }}` (replace_all, 8 occorrenze)

**(4) Tag → BadgePercent in badge "Bonus attivo":**
- Import: `Tag` rimosso, `BadgePercent` aggiunto
- `<Tag size={16} /> Bonus attivo` → `<BadgePercent size={16} /> Bonus attivo`

**(5) Rimosso badge "Bonus N%" accanto a "VOCI":**
- Rimosso il blocco `{bonusAttivo && <span>...<Tag size={14} /> Bonus {bonusPerc}%</span>}` dall'header card VOCI

**(6) Valori campi riga voce fontSize 14 → 13:**
- VociTable: `fontSize: 14, height: 44` → `fontSize: 13, height: 44` (replace_all, 10 occorrenze: 5 campi × desktop+mobile)
- NON toccati: textarea Descrizione, totale riga, etichette colonne, VOCE N

**(7) CatalogPicker bande categoria #ececef:**
- `className="px-4 py-1.5 bg-muted border-b sticky top-0"` → `className="px-4 py-1.5 border-b sticky top-0" style={{ background: '#ececef' }}`

### File toccati (sessione UI-Rev — commit M)
```
app/globals.css                                              [1: cc-section-label color #6f6d64]
app/(app)/preventivi/_components/PreventivoForm.tsx          [2: Altre opzioni; 3: Labels; 4: BadgePercent; 5: no badge VOCI]
app/(app)/preventivi/_components/VociTable.tsx               [6: fontSize 14→13 campi voce]
app/(app)/preventivi/_components/CatalogPicker.tsx           [7: bande #ececef]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — titoli sezione più scuri, Altre opzioni stile uppercase, label campi piccole grigie, icona BadgePercent, no badge VOCI, campi voce 13px, bande catalogo #ececef.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (18 giugno 2026) — continuazione (17)

### Fix applicati — RIFINITURE Nuovo preventivo (1 commit `aaf5321`)

**COMMIT L — label 16→15, bottoni height:50, campi voce fontSize 15→14**

**(1) Label campi "Altre opzioni" 16 → 15:**
- `<Label style={{ fontSize: 16, ... }}>` → `fontSize: 15` su tutti gli 8 campi (Numero/Titolo/Template/Note/Note interne/Validità/Termini/Bonus edilizio)

**(2) Bottoni altezza fissa 50px:**
- CAUSA: `<Button>` shadcn ha `h-9` (36px) nel className base; il padding inline non aumenta l'altezza con `box-sizing:border-box`
- FIX: aggiunto `height: 50, boxSizing: 'border-box'` su:
  - Edit mode draft "Salva bozza": `style={{ flex: 1 }}` → `style={{ flex: 1, height: 50, boxSizing: 'border-box' }}`
  - Edit mode "Aggiorna preventivo/fattura": stessa aggiunta
  - Create mode "Salva bozza": rimosso `padding: '14px 13px'`, aggiunto `height: 50, boxSizing: 'border-box'`
  - Create mode "Invia al cliente": rimosso `padding: '14px 13px'`, aggiunto `height: 50, boxSizing: 'border-box'`

**(3) Campi numerici riga voce: fontSize 15 → 14:**
- Solo i valori dentro i campi (Unità, Q.tà, Prezzo, Sconto, IVA), desktop e mobile
- Descrizione textarea (15) e totale riga (15) invariati
- Etichette colonna (13) invariate

### File toccati (sessione UI-Rev — commit L)
```
app/(app)/preventivi/_components/PreventivoForm.tsx  [1: label 16→15; 2: bottoni height:50]
app/(app)/preventivi/_components/VociTable.tsx        [3: campi voce fontSize 15→14]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — label più piccole, bottoni più alti, campi voce.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (18 giugno 2026) — continuazione (16)

### Fix applicati — RIFINITURE Nuovo preventivo (1 commit `4c9c2d4`)

**COMMIT K — SelectTrigger w-full+items-start + font +1px globale**

**(A) Allineamento riga voce:**
- Desktop grid: `items-center` → `items-start` (campi si allineano al top, immune a elementi Radix extra nel flusso)
- Mobile grid: `items-end` → `items-start`
- Tutti i SelectTrigger (Unità desktop+mobile, IVA desktop+mobile): aggiunto `className="w-full"` (il select ora riempie la colonna come gli Input)
- Mobile Unità: `className="truncate"` → `className="w-full truncate"`

**(B) Font +1px (tutte le scritte di Nuovo preventivo, stesse eccezioni precedenti):**
- `cc-section-label` (globals.css): `font-size: 12px` → `13px` (CLIENTE/VOCI/RIEPILOGO)
- Etichette colonne voce desktop: `text-xs` → `text-[13px]`
- Etichette colonne voce mobile (Descrizione/Unità/Q.tà/Prezzo/Sconto/IVA): `fontSize: 12` → `13`
- "VOCE N": `fontSize: 11` → `12`
- Testo dentro i campi (VociTable + PreventivoForm Input/Select/Textarea): `fontSize: 14` → `15`
- Totale riga voce (desktop + mobile): `fontSize: 14` → `15`
- Label form (PreventivoForm): `fontSize: 15` → `16`
- Toggle "Altre opzioni": `fontSize: 15` → `16`
- Sub-label (visibili/non visibili, bonus badge VOCI): `fontSize: 12/13` → `13/14`
- Help text (`text-[13px]`): → `text-[14px]`
- Discount labels (Sconto %/€): `fontSize: 13` → `14`
- Link "Gestisci i template": `fontSize: 13` → `14`
- "* Campo obbligatorio": `fontSize: '13px'` → `'14px'`
- **ECCEZIONI rispettate:** header "Nuovo preventivo" (17px) ✓, TOTALE Riepilogo ✓, bottoni 14px ✓

### File toccati (sessione UI-Rev — commit K)
```
app/(app)/preventivi/_components/VociTable.tsx     [A: items-start, w-full; B: font sizes]
app/(app)/preventivi/_components/PreventivoForm.tsx [B: font sizes labels/fields/sub-labels/help]
app/globals.css                                     [B: cc-section-label 12→13px]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — allineamento 5 campi riga voce, font più grandi.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (18 giugno 2026) — continuazione (15)

### Fix applicati — RIFINITURE Nuovo preventivo (1 commit `2d4df9f`)

**COMMIT J — altezza 44px uniforme + Aggiungi voce a sinistra**

**(1) Altezza 44px uniforme su tutti i 5 campi voce (desktop + mobile):**
- Tutti i campi: `height: 44, boxSizing: 'border-box'`, padding orizzontale only (`'0 10px'` semplici, `'0 20px 0 10px'` per Prezzo/Sconto con simbolo €/%)
- Desktop Unità SelectTrigger: rimosso `className="h-9"`, aggiunto height+boxSizing+padding inline
- Desktop Q.tà NumericInput: aggiunto height+boxSizing+padding inline
- Desktop Prezzo NumericInput: rimosso `className="pr-5"`, aggiunto height+boxSizing+padding inline
- Desktop Sconto Input: rimosso `className="pr-5"`, aggiunto height+boxSizing+padding inline
- Desktop IVA SelectTrigger: rimosso `className="h-9"`, aggiunto height+boxSizing+padding inline
- Mobile tutti e 5: `padding: '11px ...'` + `height: 'auto'` → `padding: '0 ...'` + `height: 44, boxSizing: 'border-box'`

**(2) "Aggiungi voce" allineato a sinistra:**
- Footer: `<div className="px-4 py-3 border-t flex gap-3">` → `style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}`
- `<Button variant="ghost" size="sm" className="flex-1">` → `<button>` plain con `style={{ color: '#1a1a2e', fontWeight: 500, fontSize: 14, padding: 0, background: 'none', border: 'none' }}`
- `<Plus className="size-4" />` → `<Plus size={18} />`
- CatalogPicker resta a destra invariato

### File toccati (sessione UI-Rev — commit J)
```
app/(app)/preventivi/_components/VociTable.tsx   [1: height 44px tutti i campi desktop+mobile; 2: footer aggiungi voce]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — altezza uniforme 5 campi, "Aggiungi voce" a sinistra.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (17 giugno 2026) — continuazione (14)

### Fix applicati — RIFINITURE Nuovo preventivo (1 commit `d27a4d9`)

**COMMIT I — 9 RIFINITURE pixel-identical al mockup**

**(1) Link "Gestisci i template →":**
- Aggiunto sotto il SelectContent Template in PreventivoForm `Altre opzioni`
- `<Link href="/template">` con `Settings size={15}`, `fontSize: 13, color: #1a1a2e, fontWeight: 500`
- Aggiunti imports: `Link` da 'next/link', `Settings` da lucide-react

**(2) font-family: inherit su tutti i form inputs (globals.css):**
- Aggiunto in `@layer base`: `input, textarea, select { font-family: inherit; }`
- Garantisce Inter su tutti i campi (evita font di sistema su iOS/Android)

**(3) Badge oro Bonus N% vicino a "VOCI":**
- Quando `bonusAttivo = true`, a destra dell'etichetta "VOCI" compare: `<Tag size={14} /> Bonus {bonusPerc}%`
- `fontSize: 12, fontWeight: 600, color: '#b08d3e'`
- `cc-section-label` con `marginBottom: 0` nel flex row del VOCI header

**(4) Bottoni più alti:**
- Salva bozza: `padding: '13px'` → `'14px 13px'`
- Invia al cliente: `padding: '13px'` → `'14px 13px'`

**(5) Campo Prezzo 2 decimali formato italiano:**
- `NumericInput` refactored: aggiunto `locale?: boolean` prop + `isFocused` state
- `formatVal(v)` → quando `locale=true`: `toLocaleString('it-IT', {minimumFractionDigits:2,maximumFractionDigits:2})`
- `onFocus`: `setIsFocused(true)` + `e.currentTarget.select()` (select-all per editing)
- `useEffect` aggiornato con guard `!isFocused` (evita snap durante digitazione)
- `onBlur`: formatta con `formatVal`, svuota se NaN
- `locale` applicato su: desktop Prezzo NumericInput, mobile Prezzo NumericInput

**(6) Caret ClientAutocomplete centrato:**
- Input: rimossi `p-0 h-auto text-[13px]` dalla className
- Aggiunto `style={{ fontSize: 14, fontFamily: 'inherit', height: 20, lineHeight: '20px', padding: 0 }}`
- `height: 20px = lineHeight` → cursore centrato nel flex container

**(7) Filtro lettere in tempo reale:**
- `NumericInput.onChange`: aggiunto `raw = e.target.value.replace(/[^\d.,]/g, '')`
- Sconto VociTable (desktop + mobile): aggiunto `onKeyDown={(e) => { if (['e','E','+','-'].includes(e.key)) e.preventDefault() }}`
- `onChange` Sconto: guard `!isNaN(n)` per evitare NaN nel discount_pct
- Stessa logica aggiunta ai campi Sconto globale in PreventivoForm discountSlot

**(8) Altezza uniforme mobile (item 8 — Unità = Q.tà = Prezzo = Sconto):**
- Mobile Q.tà: rimosso `className="h-9"` → `style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 10px', fontSize: 14, height: 'auto' }}`
- Mobile Prezzo: rimosso `className="h-9 pr-5"` → `style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 20px 11px 10px', fontSize: 14, height: 'auto' }}`
- Mobile Sconto: rimosso `className="h-9 pr-5"` → `style={{ border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 20px 11px 10px', fontSize: 14, height: 'auto' }}`
- Tutti ~40px allineati con Unità SelectTrigger (stesso padding 11px)

**(9) +1px a tutte le scritte (eccezioni rispettate):**
- `cc-section-label` globals.css: `font-size: 11px` → `12px` (CLIENTE/VOCI/RIEPILOGO)
- Etichette colonne mobile VociTable: `fontSize: 11` → `12`
- Testo campi VociTable (textarea, NumericInput, Select): `fontSize: 13` → `14`
- "VOCE N": `fontSize: 10` → `11`
- Totale riga (desktop + mobile): `fontSize: 13` → `14`
- Label form PreventivoForm: `fontSize: 14, fontWeight: 600` → `fontSize: 15`
- Input/Select/Textarea PreventivoForm: `fontSize: 13` → `14`
- Sub-label (visibili/non-visibili): `fontSize: 12` → `13`
- Help text (`text-xs`): → `text-[13px]`
- Discount labels: `fontSize: 12` → `13`
- `* Campo obbligatorio`: `fontSize: '12px'` → `'13px'`
- **ECCEZIONI rispettate:** header "Nuovo preventivo" (17px) ✓, TOTALE Riepilogo ✓, bottoni (14px) ✓

### File toccati (sessione UI-Rev — commit 14)
```
app/globals.css                                              [2: font-family inherit; 9: cc-section-label 12px]
app/(app)/preventivi/_components/VociTable.tsx               [5: NumericInput locale+isFocused; 7: lettera filter+onKeyDown; 8: mobile height uniforme; 9: font sizes +1px]
app/(app)/preventivi/_components/PreventivoForm.tsx          [1: template link; 3: bonus badge VOCI; 4: bottoni padding; 6: ClientAutocomplete; 9: font sizes +1px]
components/shared/ClientAutocomplete.tsx                     [6: caret alignment height 20px]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — template link, bonus badge VOCI, prezzo 2 decimali, caret cliente, altezza campi uniforme, font +1px tutto form.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (17 giugno 2026) — continuazione (13)

### Fix applicati — Nuovo preventivo pixel-identical al mockup (1 commit `6e56a69`)

**COMMIT H — 10 fix pixel-identici al mockup**

**(1) Header mobile (`preventivi/nuovo/page.tsx`):**
- Sfondo `#fff`, `borderBottom: '0.5px solid #eeeeee'`, `padding: '12px 15px'`
- X in cerchio `34×34px`, `borderRadius: 50%`, `background: #f4f4f5`; icona X `size={19}` `color: #55534b`
- Titolo `17px/600/#161616`; spacer `width: 34px`

**(2) ClientAutocomplete.tsx — box mockup:**
- Stato ricerca (no cliente): `background: #f7f7f8; border: 0.5px solid #e6e6e6; borderRadius: 11px; padding: 11px 13px; display: flex; alignItems: center; gap: 8px`
- Search icon: `size={18}` `color: #8a887f` `flexShrink: 0`
- Input: `border-0 bg-transparent shadow-none focus-visible:ring-0 p-0 h-auto flex-1 text-[13px] placeholder:text-[#8a887f]`
- Stato selezionato: stessa struttura flex con stesso sfondo/bordo

**(3) VoiceInput.tsx — prop `compact`:**
- `compact?: boolean` — quando true: `<button>` plain senza shadcn Button, icona `14×14px`, `color: inherit` (o `#ef4444` quando recording), nessun testo feedback
- Tutti i chiamanti in VociTable e PreventivoForm usano `compact`

**(4) VociTable.tsx — descrizione flex container (desktop + mobile):**
- Rimossa struttura `relative` + mic assoluto; ora `display: flex; alignItems: center; gap: 8; border: 1px solid #e3e3e6; borderRadius: 10; padding: 11px 12px`
- Textarea: `flex: 1; border: none; padding: 0; fontSize: 13`
- VoiceInput: `compact; className="flex-none text-[#8a887f]"`

**(5) VociTable — SelectTrigger mobile (Unità + IVA):**
- Override: `border: 1px solid #e3e3e6; borderRadius: 10; padding: 11px 10px; fontSize: 13; height: auto`

**(6) VociTable — VOCE N letterSpacing:** `0.04em` → `0.05em`

**(7) VociTable — totale (desktop + mobile):**
- Formato: `€ {lineTotal.toLocaleString('it-IT', {minimumFractionDigits:2, maximumFractionDigits:2})}`
- Colori: `13px #8a887f` per label, `bold #161616` per importo
- Rimosso import `formatCurrency` da VociTable (non più usato)

**(8) PreventivoForm — vari fix:**
- Asterisco "Numero fattura \*": `text-destructive` → `style={{ color: '#b08d3e' }}`
- SelectTrigger Template e Termini: `border: 1px solid #e3e3e6; borderRadius: 10; padding: 11px 12px; fontSize: 13; height: auto`
- Note VoiceInput: `compact` + rimosso `size-6` dal className
- Textarea "Personalizzati": aggiunto `border: 1px solid #e3e3e6; borderRadius: 10; padding: 11px 12px`

**(9) PreventivoForm — Bonus edilizio active state:**
- Label dello switch sempre "Attiva bonus edilizio" (non mostra più `Bonus {bonusPerc}%`)
- Quando attivo: flex row con input `width: 118px; border: #e3e3e6; borderRadius: 10; padding: 11px 28px 11px 12px; fontSize: 13` + badge `<Tag size={16} /> Bonus attivo` in oro `#b08d3e`
- Aggiunto `Tag` agli import lucide-react

**(10) PreventivoForm — Sconto (discountSlot):** Input `border: #e3e3e6; borderRadius: 10; padding: 11px 28px 11px 12px; fontSize: 13`

### File toccati (sessione UI-Rev — commit 13)
```
components/shared/VoiceInput.tsx                             [prop compact]
components/shared/ClientAutocomplete.tsx                     [box mockup flex, selected style]
app/(app)/preventivi/nuovo/page.tsx                          [header mobile mockup]
app/(app)/preventivi/_components/VociTable.tsx               [desc flex, select style, totale format, letterSpacing]
app/(app)/preventivi/_components/PreventivoForm.tsx          [asterisco, select, VoiceInput compact, bonus, sconto]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — header mobile, ClientAutocomplete box, mic compatto, desc flex, select style, totale formato, bonus active.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (17 giugno 2026) — continuazione (12)

### Fix applicati — Nuovo preventivo pixel-identical al mockup (1 commit `e75fa36`)

**COMMIT G — globals.css + PreventivoForm + VociTable: form pixel-identical al mockup**

**(1) globals.css:**
- `.cc-card-md`: `border-radius: 13px` → `14px`; shadow → `0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)`; `padding: 14px 15px` → `15px 15px`
- `.cc-section-label`: `font-size: 12px` → `11px`; `font-weight: 500` → `600`; `letter-spacing: 0.08em` → `.07em`; `color: var(--cc-text-tertiary)` → `#8a887f`; `margin-bottom: 12px` → `11px`

**(2) PreventivoForm.tsx:**
- Card 1 padding: `14px 15px` → `15px 15px` (inline override)
- "Altre opzioni" toggle: `fontSize 14, fontWeight 500` → `fontSize 15, fontWeight 600`
- Content div: `space-y-4` → `space-y-5` (20px tra i gruppi)
- Rimosso `(opzionale)` da: Numero preventivo, Titolo del lavoro, percentuale bonus
- Label field in "Altre opzioni": `style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}` su tutti i Label
- Note/note interne: `space-y-1.5` → `space-y-2`; Label → `fontSize 14/600/#161616` con sub-text `12px/#8a887f`; Textarea `border #e3e3e6, borderRadius 10, padding 11px 36px 11px 12px`; VoiceInput `right-[11px] top-[11px] text-[#8a887f]`
- Inputs (doc_number, title, validity_days, bonus%): `border #e3e3e6, borderRadius 10, padding 11px 12px, fontSize 13`
- Bonus Switch: `className="data-[state=checked]:bg-[#c9a44c]"` (oro quando attivo)
- Bonus label: mostra `Bonus {bonusPerc}%` in oro invece di "Bonus attivo" con Zap
- `Zap` rimosso dagli import
- "* Campo obbligatorio": `style={{ fontSize: '12px', color: '#b08d3e', margin: '14px 15px 10px' }}`
- Bottone container: `gap: 9` → `gap: 11, padding: '0 15px'`
- "Salva bozza" (create mode): `border #e3e3e6, borderRadius 12, padding 13px, fontSize 14, fontWeight 500`
- "Invia al cliente" (create mode): `flex 1.2, borderRadius 12, padding 13px, fontSize 14, fontWeight 600, boxShadow mockup-exact`

**(3) VociTable.tsx:**
- Textarea descrizione (desktop + mobile): `border #e3e3e6, borderRadius 10, padding 11px 36px 11px 12px, fontSize 13`; rimossi `rounded-md border border-input px-3 py-2 pr-9` dalla className
- VoiceInput (desktop + mobile): `right-[11px] top-[11px] text-[#8a887f]`
- Label colonne mobile (Descrizione, Unità, Q.tà, Prezzo, Sconto, IVA): `fontSize 11, color #8a887f` inline style

### File toccati (sessione UI-Rev — commit 12)
```
app/globals.css                                              [1: cc-card-md, cc-section-label]
app/(app)/preventivi/_components/PreventivoForm.tsx          [2: tutto il form]
app/(app)/preventivi/_components/VociTable.tsx               [3: textarea, VoiceInput, label colonne]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — Nuovo preventivo (form), Altre opzioni aperte, Bonus edilizio attivo.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (17 giugno 2026) — continuazione (11)

### Fix applicati — Allineamento mockup mobile Commits A–F (6 commit)

**COMMIT A — VociTable: mic overlay, trash top-right, VOCE label, unità 90px** (`ebe4b2d`)

1. Mic `VoiceInput` posizionato in overlay assoluto dentro textarea descrizione (`absolute right-1 top-1 size-6`, parent `relative`; `pr-9` sulla textarea).
2. Trash `Trash2` in alto a destra accanto alla label "VOCE N" (10px, 600, #8a887f). Rimosso dal footer.
3. Label "VOCE N": `fontSize 10, fontWeight 600, color '#8a887f', letterSpacing 0.04em`.
4. Grid mobile unità: `90px` (era `52px`). Grid desktop: `2fr 90px 90px 100px 80px [90px] 32px`.
5. Tutti i campi `style={{ fontSize: 13 }}` uniforme.
6. Asterischi → `<span style={{ color: '#b08d3e' }}>*</span>` (oro, era Tailwind `text-destructive`).
7. Rimossa colonna Tipo (Standard/Trainante/Trainato) completamente dal VociTable.

**COMMIT B — PreventivoForm, FiscalSummary, lib/constants/units** (`c55b5b4`)

8. Note/note-interne: `VoiceInput` in overlay assoluto (`absolute right-1 top-1 size-6`); `pr-9` su Textarea; `fontSize: 13`.
9. "* Campo obbligatorio" asterischi: `style={{ color: '#b08d3e' }}`.
10. Payment terms "Personalizzati": rimosso `name` dal Select; aggiunto `<input type="hidden" name="payment_terms" value={paymentTerms === 'Personalizzati' ? paymentTermsCustom : paymentTerms}>` + Textarea condizionale per testo libero.
11. Scadenza stimata (`dueDateHint`): visibile solo per `docType === 'fattura'` (rimossa per preventivi).
12. Bonus edilizio: `Checkbox` → `Switch` (oro quando attivo); label con `Zap` icon; `onCheckedChange` chiama `setVatRateDefault(10)` / `null`.
13. Nuovo help text bonus: "Percentuale di detrazione, indicata al cliente solo a titolo informativo..."
14. IVA 10% default quando bonus attivo già implementato via `setVatRateDefault`.
15. `lib/constants/units.ts`: aggiunti `{ value: 'a corpo' }` e `{ value: 'cad' }` → 12 unità totali. `PreventivoForm` ora usa `UNIT_VALUES` importato da `lib/constants/units`.
16. `FiscalSummary`: rimosso calcolo trainanti/trainati e relativo render (colonna `bonusEdilizio` rimossa dal destructuring).

**COMMIT C — CatalogPicker: asterischi oro** (`90e5dcf`)

17. Entrambi i `text-destructive` nel form creazione voce → `style={{ color: '#b08d3e' }}`.

**COMMIT D — Dettaglio preventivo: banner oro, azioni 48px, no Salva PDF** (`143c9af`)

18. Banner quota Free: `<p>` testuale → card bianca con bordo sinistro oro 3px, icona ♛, `{N}/{MAX} preventivi gratuiti`, Link "Passa a Pro →".
19. Rimosso info text "Stai usando il template predefinito Classico...".
20. `PdfActions.tsx`: rimosso bottone "Salva o stampa il PDF" — resta solo "Anteprima".
21. `chipBase`: `height: 48, borderRadius: 13, fontSize: 14, border: '1px solid #e7e7ea', boxShadow: '0 1px 2px rgba(20,20,40,.04)'`. Azioni mobili redesign: Anteprima (grigio `#6b6f7a`, Eye), Condividi (navy fill), MobileStatusChips per `sent/viewed`.
22. Nuovo `MobileStatusChips.tsx`: client component con chip Accettato (verde #2f8a63, CheckCircle2) e Rifiutato (rosso #b05656, XCircle) — chiama `PATCH /api/preventivi/[id]/status`.

**COMMIT E — DocumentTimeline: badge pastello per stato** (`084a382`)

23. Ogni fase usa `badgeBg` + `badgeColor` inline style (al posto di Tailwind classes):
    - `created`: bg `#f0f0f2`, icon `#b3b1ab`
    - `sent/resent`: bg `#d8e8fb`, icon `#3f6fb0`
    - `viewed`: bg `#fbe1ee`, icon `#c25b91`
    - `accepted/restored/fattura`: bg `#d4efe2`, icon `#2f8a63`
    - `rejected`: bg `#f5dede`, icon `#b05656`
    - `expired/expires`: bg `#f5e9d0`, icon `#b0863e`
    - `modified`: bg `#ede9f7`, icon `#7c3aed`
    - Linea connettore: `borderLeft: '1.5px solid #e5e5ea'` (era `border-border` Tailwind).
    - Badge circle: `outline: '2px solid #fff'` invece di `ring-2 ring-background`.

**COMMIT F — ShareButton: dialog unificato con canali** (`084a382`)

24. Titolo dialog: `"Invia {docLabel} {numClean}"`, sottotitolo `"Scegli come inviarlo a {clientName}."`.
25. Link row: URL senza protocollo troncato + bottone "Copia" (Copy 14px).
26. Tre cerchi canale 46px (`#f2f2f5` bg, border `#e7e7ea`, navy icon 20-21px): WhatsApp (SVG ufficiale), Email (`Mail`), Altre app (`Share2` + `navigator.share`).
27. Rimosso Popover fallback e tile "Copia link" (Copia rimasta solo nella link row).
28. Info note per bozze: "Condividendo, questo {docLabel} verrà segnato come Inviato e riceverà il numero progressivo."
29. Rimosso dialog conferma separato + flusso "Ho già inviato per altra via".
30. Flusso `openChannel`: se `isDraft` → auto-save (`window.__cc_doSave`) → `registerManualSendAction` → `router.refresh()` → apri canale. Aggiunta prop `clientName?: string | null`.
    - `fatture/[id]/page.tsx` e `preventivi/[id]/page.tsx` aggiornati con `clientName={clientName}`.

### File toccati (sessione UI-Rev — commit 11)
```
app/(app)/preventivi/_components/VociTable.tsx         [A: mic, trash, VOCE, unità 90px, font 13, asterischi oro, no Tipo]
lib/constants/units.ts                                  [B: +a corpo, +cad]
app/(app)/preventivi/_components/PreventivoForm.tsx    [B: mic note, custom payment, bonus Switch, units import, asterischi oro]
app/(app)/preventivi/_components/FiscalSummary.tsx     [B: rimosso trainanti/trainati]
app/(app)/preventivi/_components/CatalogPicker.tsx     [C: asterischi oro]
app/(app)/preventivi/_components/PdfActions.tsx        [D: rimosso Salva PDF]
app/(app)/preventivi/_components/MobileStatusChips.tsx [D: nuovo — chip Accettato/Rifiutato]
app/(app)/preventivi/[id]/page.tsx                     [D: chipBase 48px, banner oro, no template info, azioni mobili; F: clientName]
app/(app)/preventivi/_components/DocumentTimeline.tsx  [E: badge pastello inline styles]
app/(app)/preventivi/_components/ShareButton.tsx       [F: dialog unificato, canali cerchi, no Popover]
app/(app)/fatture/[id]/page.tsx                        [F: clientName a ShareButton]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: tutti i commit A–F da verificare da Eli (VociTable mic, custom payment terms, bonus Switch, azioni mobile 48px, MobileStatusChips, DocumentTimeline pastello, ShareButton dialog canali).

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (10)

### Fix applicati — Bug ShareButton hasVoci stale (1 commit `7ceb719`)

**COMMIT 15 — ShareButton: guard live + auto-save prima di condividere**

**Bug trovato:** `hasVoci` è una prop calcolata server-side (`docItems.some(...)` nel documento salvato). Se l'utente aggiunge voci nel form senza salvare, la prop è stale → ShareButton mostra toast "Aggiungi almeno una voce" anche se le voci sono presenti nel form.

**Causa reale:** il guard `if (!hasVoci)` in `handleShareClick` usa la prop di pagina, non lo stato corrente del form.

**Fix implementato:**

**(1) PreventivoForm.tsx — due nuovi `useEffect`:**
- `useEffect([doSave])`: espone `doSave` su `window.__cc_doSave` (rimosso on unmount). ShareButton chiama questo per auto-salvare prima di condividere.
- `useEffect([voci])`: dispatcha `cartacanta:voci-changed` con `{ hasVoci: boolean }` ad ogni modifica alle voci nel form.

**(2) ShareButton.tsx:**
- Import `useEffect` aggiunto.
- `hasVociLocal = useState(hasVoci)` + `useEffect` che ascolta `cartacanta:voci-changed` → aggiorna `hasVociLocal` in tempo reale.
- Guard `if (!hasVoci)` → `if (!hasVociLocal)` (usa stato corrente del form).
- `handleConfirm`: chiama `window.__cc_doSave()` (auto-save) prima di `registerManualSendAction`. Se il salvataggio fallisce, mostra l'errore nel dialog e non procede.

**(3) lib/actions/documents.ts:**
- `'Il documento non ha voci'` → `'Il preventivo non ha voci salvate. Salva le modifiche prima di condividere.'` (fallback se auto-save non disponibile).

**Flusso risultante:**
1. Utente aggiunge voci → `cartacanta:voci-changed` → `hasVociLocal=true` → guard non blocca
2. Utente clicca Condividi → dialog "Segna come inviato" si apre
3. Utente conferma → `window.__cc_doSave()` salva le voci → `registerManualSendAction` → successo
4. Caso limite (no form montato): server restituisce messaggio chiaro "Salva le modifiche prima"

### File toccati (sessione UI-Rev — commit 15)
```
app/(app)/preventivi/_components/PreventivoForm.tsx  [window.__cc_doSave; cartacanta:voci-changed dispatch]
app/(app)/preventivi/_components/ShareButton.tsx     [hasVociLocal; ascolta evento; auto-save in handleConfirm]
lib/actions/documents.ts                             [errore server migliorato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: verificare da Eli — aggiungere voci, NON salvare, cliccare Condividi → deve salvare e condividere senza errori.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (9)

### Fix applicati — Note, CatalogPicker (1 commit `14c31eb`)

**COMMIT 14 — Note auto-espandibili, icona Nuova voce, titoli categoria**

**(1) Textarea note auto-espandibili (PreventivoForm.tsx):**
- Entrambi i campi (`notes` e `internal_notes`): rimosso `rows={N}`, aggiunto `className="resize-none overflow-hidden"`, `style={{ minHeight: '40px' }}`.
- Callback ref: `ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px' } }}` — imposta l'altezza iniziale al contenuto pre-compilato.
- `onChange` aggiornato: resetta a `'auto'` poi imposta a `scrollHeight + 'px'` — il box cresce col testo.

**(2) Icona "Nuova voce" in CatalogPicker (CatalogPicker.tsx):**
- `<PackagePlus>` → `<Plus>` sul bottone "Nuova voce" (riga ~369). `PackagePlus` rimosso dagli import se inutilizzato.

**(3) Titoli categoria CatalogPicker più chiari (CatalogPicker.tsx):**
- Banda categoria: `bg-muted/50` → `bg-muted`; span: `font-semibold text-muted-foreground` → `font-bold text-foreground/70`. Si distingue nettamente dalle voci sottostanti.

### File toccati (sessione UI-Rev — commit 14)
```
app/(app)/preventivi/_components/PreventivoForm.tsx  [1: note/note-interne auto-espandibili]
app/(app)/preventivi/_components/CatalogPicker.tsx   [2: icona Plus; 3: header categoria]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser** — verificare da Eli.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (8)

### Fix applicati — Sfondo grigio #fafafa su mobile (1 commit `5a16004`)

**COMMIT 13 — AppShell: bg-[#fafafa] su mobile**

- `app/(app)/_components/AppShell.tsx`: `<main>` → aggiunta classe `bg-[#fafafa] lg:bg-background`.
- Risultato: tutte le pagine app su mobile hanno sfondo #fafafa; le card e la fascia titolo bianca rimangono su `#fff`; su desktop resta `bg-background` (invariato).

### File toccati (sessione UI-Rev — commit 13)
```
app/(app)/_components/AppShell.tsx   [bg-[#fafafa] lg:bg-background su <main>]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- **Non testato in browser** — verificare da Eli che lo sfondo grigio compaia su mobile e non su desktop.

### Esito finale
🟡 FIX APPLICATO — tsc+build verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (7)

### Fix applicati — Nuovo Preventivo / Nuova Fattura (1 commit `ab05d45`)

**COMMIT 12 — VociTable formatCurrency, griglia prezzo, AI pill, placeholder cliente, spaziatura**

**(1) Totale voce formato italiano:**
- `VociTable.tsx`: aggiunto import `formatCurrency` da `@/lib/utils`.
- Mobile (riga Totale): `€{lineTotal.toFixed(2)}` → `{formatCurrency(lineTotal)}` → es. "€ 2.800,00".
- Desktop (riga `= …`): stessa sostituzione.

**(2) Campo Prezzo più largo su mobile:**
- `VociTable.tsx` riga griglia numerica: `grid-cols-4` → `grid-cols-[52px_1fr_1.5fr_1fr]` (Unità fissa 52px, Q.tà normale, Prezzo 1.5fr, Sconto normale). Con IVA si torna a `sm:grid-cols-5` da sm+.

**(3) AiImportButton "IN ARRIVO" discreto:**
- `AiImportButton.tsx`: il branch `!AI_IMPORT_ENABLED` ora restituisce `<span>` (non Button) — fontSize 11, color `var(--cc-text-3)`, opacity 0.75, icona Wand2 11px. Testo: "Importa con AI · in arrivo". Meno ingombrante accanto al titolo VOCI.

**(4) Placeholder ClientAutocomplete:**
- `components/shared/ClientAutocomplete.tsx`: default `placeholder` cambiato da `'Cerca cliente…'` a `'Cerca o crea cliente…'`. Si applica ovunque il componente è usato (form preventivo, fattura, cliente nuovo).

**(5) Spaziatura card Cliente:**
- `PreventivoForm.tsx`: `<div className="cc-section-label">` nella card Cliente/Fattura → aggiunto `style={{ marginBottom: 0 }}`. La card ha `gap: 14` (flexbox), quindi il totale era gap(14) + marginBottom(12) = 26px. Ora è solo 14px.

### File toccati (sessione UI-Rev — commit 12)
```
app/(app)/preventivi/_components/VociTable.tsx      [1: formatCurrency; 2: grid 52px_1fr_1.5fr_1fr]
app/(app)/preventivi/_components/AiImportButton.tsx  [3: pillola discreta]
app/(app)/preventivi/_components/PreventivoForm.tsx  [5: marginBottom:0 su cc-section-label]
components/shared/ClientAutocomplete.tsx             [4: placeholder "Cerca o crea cliente…"]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: totale voce formato italiano; Prezzo non troncato; AI pillola discreta; placeholder cliente; spaziatura card — verificare da Eli.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (6)

### Fix applicati — spaziatura Home, fascia-titolo, gap card (1 commit `6b66304`)

**COMMIT 11 — spaziatura Home, fascia bianca Preventivi/Fatture, marginBottom card**

**(1) Ombra ripristinata (via git revert):** commit `3e4fc8f` ha annullato `9a26537` (ombra troppo forte). L'ombra card è tornata a `0 1px 2px rgba(20,20,40,.04), 0 6px 16px -8px rgba(20,20,40,.13)` (valore originale in `--cc-shadow`).

**(2) Home — più spazio tra le card (dashboard/page.tsx + MobileScadenzaCard.tsx):**
- Banner quota: `margin: '13px 15px 0'` → `'18px 15px 0'`
- MobileScadenzaCard outer div: `margin: '13px 15px 0'` → `'18px 15px 0'`
- KPI grid: `margin: '15px 15px 0'` → `'20px 15px 0'`
- Activity card: `margin: '18px 15px 18px'` → `'23px 15px 18px'`

**(3) Fascia bianca titolo su Preventivi e Fatture (mobile only):**
- `preventivi/page.tsx` e `fatture/page.tsx`: aggiunto `<div className="lg:hidden -mx-4 -mt-4 mb-4" style={{ background: '#fff', borderBottom: '0.5px solid var(--cc-border-color)', padding: '15px 15px 13px' }}>` come primo figlio del container, con h1 dentro.
- Il `-mx-4 -mt-4` cancella il `p-4` del container mobile → la fascia va a piena larghezza.
- L'header originale (h1 + bottoni desktop) è diventato `hidden lg:flex` su entrambe le pagine.
- Il banner Free, la ricerca, i filtri e le card restano sul grigio di sfondo sotto la fascia.

**(4) Più spazio tra i documenti:**
- `preventivi/page.tsx` e `fatture/page.tsx`: card wrapper `marginBottom: 12` → `marginBottom: 16`.

### File toccati (sessione UI-Rev — commit 11)
```
app/(app)/dashboard/page.tsx                          [2: margini banner/KPI/activity]
app/(app)/dashboard/_components/MobileScadenzaCard.tsx [2: margin 13→18]
app/(app)/preventivi/page.tsx                         [3: fascia bianca mobile; 4: marginBottom 16]
app/(app)/fatture/page.tsx                            [3: fascia bianca mobile; 4: marginBottom 16]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: spaziatura Home; fascia bianca titolo Preventivi/Fatture; gap card — verificare da Eli.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (5)

### Fix applicati — Home + badge + Ordina (1 commit `09d197f`)

**COMMIT 10 — KPI mese centrate, no logo, altri-N in card, WA precompilato; Visto lilla; Ordina min-w**

**(A1) KPI grid mobile (dashboard/page.tsx):** cards centrate (`textAlign:'center'`), padding `14px 12px`, label rinominate ("Preventivi accettati" / "Fatturato"), aggiunta riga mese corrente sotto il valore (`fontSize 11, color #8a887f, marginTop 2`). `meseCorrente` calcolato da `now.toLocaleDateString('it-IT', { month: 'long' })`.

**(A2) Rimozione logo azienda dall'header (dashboard/page.tsx):** rimosso blocco `{workspace.logo_url && (<img.../>)}`. Resta solo "Ciao, {fullName}" + workspaceName a sinistra e avatar a destra.

**(A3) "Altri N in scadenza" dentro la card (dashboard/page.tsx + MobileScadenzaCard.tsx):** rimossa la card separata "Altri N in scadenza" (`allPendingCount > 1` block). Aggiunta prop `otherPendingCount` a MobileScadenzaCard. Se > 0: dentro la card, sotto l'hint, linea grigia + Link a `/preventivi/scadenze` con `AlertTriangle` + conteggio.

**(A4) WhatsApp messaggio precompilato (MobileScadenzaCard.tsx):** aggiunte props `publicToken`, `workspaceName`, `expiresAt`. Se `publicToken` disponibile: `whatsappHref = https://wa.me/${phoneDigits}?text=${encodeURIComponent(msg)}`. Messaggio: "Buongiorno {clientName}, le ricordo il preventivo {docNumber} in scadenza il {gg/mm}. Può visionarlo qui: {link}. Cordiali saluti, {workspaceName}". Anche `public_token` aggiunto alla query in dashboard/page.tsx.

**(B) SortSelect min-w (SortSelect.tsx):** `<DropdownMenuContent>` → `className="min-w-[190px]"` per evitare che "Scadenza vicina" / "Ultima modifica" vadano a capo.

**(C) Badge "Visto" colore lilla (StatusBadge.tsx + dashboard/page.tsx):** viewed bg `#d8e8fb` → `#e2e3f7` (lilla-azzurro, distinto da sent `#d8e8fb`). `getMobileBadgeBg`: `sent` e `viewed` ora separati (non più nel fall-through).

### File toccati (sessione UI-Rev — commit 10)
```
app/(app)/dashboard/page.tsx                          [A1/A2/A3/A4/C: KPI, no logo, altri-N props, public_token, getMobileBadgeBg]
app/(app)/dashboard/_components/MobileScadenzaCard.tsx [A3/A4: otherPendingCount, publicToken, WA msg, Link+ArrowRight]
app/(app)/preventivi/_components/SortSelect.tsx        [B: min-w-[190px]]
app/(app)/preventivi/_components/StatusBadge.tsx       [C: viewed #e2e3f7]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: KPI centrate con mese; header senza logo; "Altri N" dentro la card; WA messaggio precompilato; badge Visto lilla; Ordina senza testo troncato.

### Fix aggiuntivi — 3 micro-fix (1 commit `3bad10f`)

**(A) Badge "Visto" rosa:** viewed bg `#e2e3f7` → `#fbe1ee` (StatusBadge + getMobileBadgeBg in dashboard).

**(B) SearchBar placeholder più piccolo:** aggiunta classe `placeholder:text-sm` all'Input — placeholder a 14px, testo digitato resta 16px → niente zoom automatico su iOS.

**(C) Placeholder unificato:** mobile SearchBar su Preventivi e Fatture usa "Cerca numero, cliente, voce…".

**(D) Ombra card più marcata (commit `9a26537`):** `--cc-shadow` aggiornato in `globals.css` → `0 2px 5px rgba(20,20,40,.07), 0 10px 28px -8px rgba(20,20,40,.22)`. Aggiornate anche le costanti `SH` hardcoded in `dashboard/page.tsx` e `MobileScadenzaCard.tsx`. Non tocca `--cc-shadow-md/fab/btn`.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (4)

### Fix applicati — 5 fix CSS/UX (1 commit `2e76148`)

**COMMIT 9 — ombra pillola, Ordina→DropdownMenu, SearchBar focus, badge colori, sort scadenza vicina**

**(1) Ombra pillola non tagliata (globals.css):** `.cc-tabs` padding `6px 0` → `10px 0 15px`. Il container `.cc-tabs` aveva `overflow-x: auto` (da `.cc-filter-scroll`) che tagliava l'ombra verticale `.cc-tab-active`. Il padding extra crea spazio sopra/sotto l'ombra prima del clip.

**(2) SortSelect: Select → DropdownMenu modal={false}:** sostituito l'intero `<Select>` Radix con `<DropdownMenu modal={false}> + <DropdownMenuRadioGroup> + <DropdownMenuRadioItem>`. Il `<Select>` usava `react-remove-scroll` → aggiungeva `padding-right` al body per compensare la scrollbar → la pagina si restringeva all'apertura. Con `modal={false}` non blocca lo scroll e non compensa. Trigger: testo con `ChevronDown size 14`, border-0 bg-transparent. Mantenuta tutta la logica (sessionStorage, router.push ?sort=, displaySort ottimistico).

**(3) SearchBar: digitazione non cancellata dal sync URL:** aggiunto `inputRef = useRef<HTMLInputElement>(null)`. Nel `useEffect` che sincronizza il valore dall'URL, aggiunto guard: `if (inputRef.current && document.activeElement === inputRef.current) return`. L'Input ora ha `ref={inputRef}`. Problema precedente: il router ripristinava l'URL (con il debounce) e il `useEffect` rimpiazzava il valore locale mentre l'utente stava ancora digitando.

**(4) Colori StatusBadge allineati alla palette Home:** viewed `#f7e6c8` → `#d8e8fb` (blu chiaro = coerente con "Inviato"), rejected `#fadfdf` → `#f5dede` (rosa tenue), expired `#f7e6c8` → `#f5e9d0` (ambra tenue). Si applica su preventivi + fatture + dettaglio (intenzionale). La Home NON è stata toccata (usa `getMobileBadgeBg` separato).

**(5) Sort "Scadenza vicina" — pending prima:** il DB non supporta ORDER BY CASE via Supabase. Soluzione: quando `sort === 'expiry'`, limit aumentato a 200 (da 50) + JS sort dopo il fetch. Grouping: pending (status in ['sent','viewed','expired']) per `expires_at ASC` (null in fondo), gli altri (accepted/rejected/draft) per `updated_at DESC`. La variabile `displayDocuments` contiene il risultato ordinato; il render usa `displayDocuments.map(` invece di `(documents ?? []).map(`.

### File toccati (sessione UI-Rev — commit 9)
```
app/globals.css                                          [cc-tabs padding 10px 0 15px]
app/(app)/preventivi/_components/SortSelect.tsx          [Select → DropdownMenu modal=false]
components/shared/SearchBar.tsx                          [inputRef + guard activeElement]
app/(app)/preventivi/_components/StatusBadge.tsx         [viewed/rejected/expired colori]
app/(app)/preventivi/page.tsx                            [sort=expiry: limit 200 + JS sort displayDocuments]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: ombra pillola non tagliata; Ordina non restringe la pagina; digitazione non cancellata in SearchBar; badge colori aggiornati; "Scadenza vicina" mostra pending prima.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (3)

### Fix applicati — 5 fix CSS/UX trasversali (1 commit)

**COMMIT 8 — CSS duplicato rimosso, Ordina popper, ricerca modificato, sort Fatture**

**(1) CSS duplicato rimosso (globals.css):** eliminato il blocco vecchio `.cc-tabs/.cc-tab/.cc-tab-active` con `border-bottom` (~righe 343-364) — causava la sottolineatura residua sui filtri. Resta solo la definizione pill-style.

**(2) SortSelect menu in basso (position popper):** `<SelectContent>` → `position="popper" align="end" sideOffset={6}`. Vale per Preventivi e (tramite lo stesso componente) Fatture.

**(3) Ricerca "modificato" su Preventivi:** nel blocco di ricerca testuale, prima del ramo statusMatch, aggiunto controllo `MODIFIED_KW` → `.not('updated_after_send_at', 'is', null)`. Parole: modificato/a/i/e (exact + prefisso min 4 chars).

**(4) Ricerca "modificata" su Fatture:** stesso pattern aggiunto nel blocco ricerca fatture.

**(5) "Ordina" funzionante su Fatture:** aggiunto `sort?` a searchParams, import `SortSelect`, ordinamento dinamico (default `updated_at ASC` = "Meno recenti", coerente con Preventivi). Il testo statico "Più recenti" è sostituito con `<SortSelect currentSort={sort} />`.

### File toccati (sessione UI-Rev — commit 8)
```
app/globals.css                          [rimosso blocco cc-tabs duplicato con border-bottom]
app/(app)/preventivi/_components/SortSelect.tsx  [SelectContent position=popper align=end]
app/(app)/preventivi/page.tsx            [ricerca "modificato"]
app/(app)/fatture/page.tsx               [ricerca "modificata" + sort funzionante]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: filtri senza sottolineatura; menu Ordina si apre sotto; ricerca "modificato/a" filtra correttamente; ordinamento Fatture funziona — verificare da Eli.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione (2)

### Fix applicati — Pagina Fatture: allineamento mockup + ⋮ per riga (1 commit)

**COMMIT 7 — Fatture: filtri pill, bottoni restyled, badge affiancato, ⋮ per riga, redirect fix**

**(0) CSS valori esatti del mockup (globals.css — condiviso Preventivi+Fatture):**
- `.cc-tab`: padding `6px 9px` → `6px 5px` (inattivo più compatto)
- `.cc-tab-active`: padding `7px 16px` → `10px 22px` (attivo più grande)

**(1) Filtri Fatture scorrevoli:** `className="cc-tabs"` → `className="cc-tabs cc-filter-scroll"`

**(2) Rimosso ⋮ mobile CSV:** eliminato `<a lg:hidden ... MoreVertical>`. Rimosso `MoreVertical` dall'import.

**(3) Badge "Modificata" affiancato al badge stato (riga 1):** rimosso da riga 2, spostato inline con StatusBadge in `<div display:flex gap:6>`. Stile: bg `#e9e0f7`, color `#2b2b2b`, 11px weight 600, radius 999, padding `2px 8px`.

**(4) Bottoni creazione restyled (mobile):**
- "Da preventivo" PRIMARIO a sinistra: navy bg, bianco, borderRadius 14, boxShadow navy, con icona `FileInput`
- "Nuova fattura" SECONDARIO a destra: bianco, bordo `#ededf0`, var(--cc-shadow), con icona `Plus`

**(5) Titolo "Fatture" fontWeight 500 → 600**

**(6) ⋮ per riga:**
- Card fattura avvolta in `<div position:relative marginBottom:12>`. Link padding `'14px 50px 14px 15px'`.
- `DocumentRowActions` in absolute top/right, fuori dal Link (tap su ⋮ non naviga).
- workspace select aggiornato con `name, ragione_sociale`; clients select con `email`.

**(DocumentRowActions — reso doc-type-aware):**
- Aggiunto prop `docType?: 'preventivo' | 'fattura'` (default 'preventivo').
- Dialog "Elimina preventivo" → dinamico. aria-label dinamico.

**(duplicateDocumentAction — fix redirect per fatture):**
- `lib/actions/documents.ts`: redirect ora va a `/fatture/${newDoc.id}` se `doc_type === 'fattura'`, altrimenti `/preventivi/`. Aggiunto `revalidatePath('/fatture')`.

### File toccati (sessione UI-Rev — commit 7)
```
app/globals.css                                          [cc-tab/cc-tab-active valori esatti mockup]
app/(app)/fatture/page.tsx                               [tutti i fix 0-6]
app/(app)/preventivi/_components/DocumentRowActions.tsx  [prop docType; dialog/aria dinamici]
lib/actions/documents.ts                                 [duplicateDocumentAction redirect doc-type-aware]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser reale**: filtri Fatture pill, bottoni restyled, badge affiancato, ⋮ per riga, redirect "Usa come modello" su fattura va a /fatture/ — verificare da Eli.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026) — continuazione

### Fix applicati — Allineamento mockup Preventivi + scaduti in "In attesa" (1 commit)

**COMMIT 6 — 7 fix Preventivi: shift, filtri CSS, ricerca, ordina, puntini, banner, scaduti**

**(1) Shift laterale — fix vero:**
- `app/(app)/_components/AppShell.tsx`: `<main>` → `style={{ scrollbarGutter: 'stable' }}`. Elemento corretto (scrollabile è `<main>`, non `html`).

**(2) Filtri CSS shared (no più inline):**
- `app/globals.css`: aggiunte classi `.cc-tabs`, `.cc-tab`, `.cc-tab-active` (pill style).
- `app/(app)/preventivi/page.tsx`: div filtri ora usa `className="cc-tabs cc-filter-scroll"` + `<Link className={isActive ? 'cc-tab-active' : 'cc-tab'}>`.

**(3) SearchBar più alta:**
- `components/shared/SearchBar.tsx`: aggiunto `h-11` all'Input (44px, combacia col mockup).

**(4) "Ordina" solo testo:**
- `app/(app)/preventivi/_components/SortSelect.tsx`: `SelectTrigger` → `border-0 bg-transparent shadow-none h-auto`. Appare come testo "Meno recenti ▾" senza riquadro.

**(5) Puntini ⋮ grigi:**
- `app/(app)/preventivi/_components/DocumentRowActions.tsx`: `MoreHorizontal` → `className="size-4 text-muted-foreground"`.

**(6) Banner Free — card corta oro:**
- `app/(app)/preventivi/page.tsx`: banner ambra lungo sostituito con card bianca, bordo sinistro oro `#c9a44c`, icona ♛, testo "{N}/{MAX} preventivi gratuiti" + link "Passa a Pro →".

**(7) "In attesa" include gli scaduti:**
- `app/(app)/preventivi/page.tsx`: query `status === 'attesa'` → `.in('status', ['sent','viewed','expired'])`. Mappa ricerca testuale 'attesa'/'in attesa' → stessa terna. Cast TypeScript aggiornato. I preventivi scaduti restano visibili sotto "In attesa" e non spariscono dal tab.

### File toccati (continuazione sessione UI-Rev — commit 6)
```
app/(app)/_components/AppShell.tsx                      [scrollbarGutter stable su main]
app/globals.css                                         [cc-tabs, cc-tab, cc-tab-active]
app/(app)/preventivi/page.tsx                           [filtri CSS, banner oro, scaduti in attesa]
components/shared/SearchBar.tsx                         [h-11]
app/(app)/preventivi/_components/SortSelect.tsx         [SelectTrigger senza bordo]
app/(app)/preventivi/_components/DocumentRowActions.tsx [MoreHorizontal grigio]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser reale**: verificare da Eli shift laterale, filtri pill, ordina testuale, banner oro, scaduti in "In attesa".

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

### Fix applicati — Pillole filtro e scroll orizzontale (1 commit)

**COMMIT 5 — Filtri Preventivi: pillole più piccole + niente slittamento laterale**

**(a) Pillole più piccole:**
- `app/(app)/preventivi/page.tsx`: tab attivo `8px 16px` → `6px 13px`; tab inattivo `6px 10px` → `5px 9px`.

**(b) Scroll orizzontale senza shift di pagina:**
- `app/globals.css`: aggiunta utility `.cc-filter-scroll` (overflow-x auto, scrollbar nascosta). Aggiunto `scrollbar-gutter: stable` su `html`.
- `app/(app)/preventivi/page.tsx`: aggiunto `className="cc-filter-scroll"` al container flex dei tab, così i 5 filtri scorrono DENTRO la barra senza spingere la pagina.

### File toccati (continuazione sessione UI-Rev)
```
app/(app)/preventivi/page.tsx   [pad pillole ridotto; cc-filter-scroll su container tab]
app/globals.css                 [utility cc-filter-scroll; scrollbar-gutter: stable su html]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser reale**: verificare da Eli che i filtri non causino più scroll laterale di pagina.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE UI-Rev (16 giugno 2026)

### Fix applicati — Revisione UI mobile (4 commit)

**COMMIT 1 — Salvataggio lavoro non committato**
- `mockup-mobile/home_v2.html`: mockup di riferimento Home + Preventivi
- `ricerca-fatturazione-elettronica/implementazione-e-testi-legali.md`: nuova ricerca SDI
- `ricerca-fatturazione-elettronica/DECISIONE_SDI.md`, `fonti.md`: aggiornamenti

**COMMIT 2 — Normalizzazione fine-riga a LF**
- Creato `.gitattributes` con `* text=auto eol=lf`
- `git add --renormalize .` → eliminati ~81 file di rumore CRLF dal working tree
- `REVISIONE_UI.md`: aggiornato (segnata sessione Home implementata)

**COMMIT 3 — Home: testo Attività recente grigio scuro**
- `app/(app)/dashboard/page.tsx`: riga mobile activity feed — aggiunto `color: 'var(--cc-text-2)'` al div del nome/numero documento (era colore default del tema, troppo scuro/nero)

**COMMIT 4 — Preventivi (lista) mobile: restyling completo**

**(a) Rimosso ⋮ mobile (Export CSV):**
- `app/(app)/preventivi/page.tsx`: rimossa l'ancora `<a>` mobile con `MoreVertical` a lines ~263-266. Rimossi `MoreVertical` e `Bell` (inutilizzato) dall'import lucide-react.

**(b) Badge "Modificato" affiancato a StatusBadge in riga 1:**
- Riga 1 (numero · cliente | badge): StatusBadge e badge "Modificato" ora avvolti in `<div display:flex gap:6>`. Stile badge: `#e9e0f7` bg, `#2b2b2b` testo, fontSize 11, fontWeight 600, borderRadius 999, padding `2px 8px`.
- Rimosso il vecchio badge "Modificato" (viola scuro `#7c3aed`) dalla riga 2.

**(c) StatusBadge restyling globale:**
- `app/(app)/preventivi/_components/StatusBadge.tsx`: sostituito approccio Tailwind className con inline styles. Niente più bordi colorati. Testo sempre `#2b2b2b`, fontWeight 600. Sfondi tenue: draft `#e8e8e8` · sent `#d8e8fb` · viewed `#f7e6c8` · accepted `#d4efe2` · rejected `#fadfdf` · expired `#f7e6c8`. Si applica ovunque (fatture, dettaglio — intenzionale).

**(d) SearchBar più elegante:**
- `components/shared/SearchBar.tsx`: Input → `rounded-xl border-[#e6e6e6] bg-[#f7f7f8] focus:bg-white focus-visible:bg-white`. Si applica su tutte le pagine che usano SearchBar.

**(e) Più spazio attorno a "Ordina":**
- `app/(app)/preventivi/page.tsx`: riga Ordina → `py-3` → `py-4`.

**(f) Filtri tab stile B (pill):**
- Container filtri: `background:#f2f2f4, borderRadius:999, padding:3px 4px`. Rimosso `borderBottom`.
- Tab attivo: pillola bianca `bg:#fff`, `boxShadow` galleggiante, `color:var(--cc-navy)`, fontWeight 600, padding `8px 16px`.
- Tab inattivo: solo testo `color:var(--cc-text-2)`, padding `6px 10px`, nessun bg/bordo.

### File toccati (sessione UI-Rev)
```
.gitattributes                                          [nuovo — normalizzazione LF]
mockup-mobile/home_v2.html                              [nuovo — mockup riferimento]
ricerca-fatturazione-elettronica/implementazione-e-testi-legali.md  [nuovo — ricerca SDI]
ricerca-fatturazione-elettronica/DECISIONE_SDI.md       [aggiornato]
ricerca-fatturazione-elettronica/fonti.md               [aggiornato]
REVISIONE_UI.md                                         [aggiornato]
app/(app)/dashboard/page.tsx                            [COMMIT 3: color cc-text-2 su activity feed]
app/(app)/preventivi/page.tsx                           [COMMIT 4: no ⋮ mobile, badge affiancato, py-4, filtri B]
app/(app)/preventivi/_components/StatusBadge.tsx        [COMMIT 4: restyling inline style — si applica globalmente]
components/shared/SearchBar.tsx                         [COMMIT 4: rounded-xl, bg #f7f7f8, border #e6e6e6]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser reale**: filtri pill B, badge Modificato affiancato, StatusBadge nuovi colori, SearchBar restyle, testo activity feed grigio — verificare da Eli sul telefono.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli.

---

## A. HANDOFF — SESSIONE G-QA-R (15 giugno 2026)

### Fix applicati — Re-test mobile (commit `fix(mobile): G-QA-R`)

**QA-R1 — Menu ⋮ bloccava l'app**
- `DocumentRowActions.tsx`: aggiunto `modal={false}` a `<DropdownMenu>` → Radix non imposta più `pointer-events:none` sul body durante l'apertura del menu → no freeze.
- `preventivi/[id]/page.tsx` e `fatture/[id]/page.tsx`: rimosso il pulsante `<a href="#mobile-altre-azioni">⋮</a>` dal mobile header (anchor scroll su pagine pesanti causava freeze). Sostituito con `<Link href="?edit=1"><Pencil /></Link>`.

**QA-R2 — "Condividi" icona senza etichetta vs "Anteprima" enorme**
- `ShareButton.tsx`: rimosso `hidden sm:inline` dalla span label → "Condividi" sempre visibile. Aggiunto prop `triggerStyle?: React.CSSProperties` applicato al Button trigger.
- `preventivi/[id]/page.tsx` e `fatture/[id]/page.tsx`: passato `triggerStyle={chipBase}` a ShareButton nella sezione chip mobile → stessa dimensione di "Anteprima".

**QA-R3 — Form editabile sempre visibile anche per doc non modificabili**
- `preventivi/[id]/page.tsx`: `searchParams` esteso con `edit?: string`; `PreventivoForm` avvolto in `<div className={edit !== '1' ? 'hidden lg:block' : undefined}>`. Pencil nel header → `?edit=1` mostra il form.
- `fatture/[id]/page.tsx`: stessa logica + fattura accepted/rejected → form non compare mai su mobile. Chip "Modifica" cambiato da `href="#fattura-form-section"` a `href="/fatture/[id]?edit=1"` (Link, non anchor scroll).

**QA-R4 — "Ordina:" vuoto su mobile**
- `SortSelect.tsx`: `SelectTrigger` da `w-full sm:w-40` → `w-36` (larghezza fissa, evita collapse nel flex container). Label mostrata con `useState` locale + aggiornamento ottimistico in `handleChange`, invece di `<SelectValue />` che non rendeva il testo su mobile.

### File toccati (sessione G-QA-R)
```
app/(app)/preventivi/_components/DocumentRowActions.tsx  [QA-R1: modal=false]
app/(app)/preventivi/_components/ShareButton.tsx         [QA-R2: label visibile + triggerStyle prop]
app/(app)/preventivi/_components/SortSelect.tsx          [QA-R4: w-36 + label con stato locale]
app/(app)/preventivi/[id]/page.tsx                       [QA-R1: no ⋮, Pencil→?edit=1; QA-R2: triggerStyle; QA-R3: form hidden]
app/(app)/fatture/[id]/page.tsx                          [QA-R1: no ⋮, Pencil→?edit=1; QA-R2: triggerStyle; QA-R3: form hidden + chip Modifica]
DECISIONI_REDESIGN_MOBILE.md                             [sezione G-QA-R aggiunta]
CLAUDE.md                                                [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser**: tutti e 4 i punti G-QA-R da verificare da Eli sul telefono.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli (lista in `DECISIONI_REDESIGN_MOBILE.md` sezione G-QA-R).

---

## A-quater. HANDOFF — SESSIONE G-QA (14 giugno 2026)

### Fix applicati — QA mobile (3 commit: G-QA1+QA2, G-QA3)

**G-QA1.1 — Impostazioni: tab orizzontali su mobile**
- `app/(app)/impostazioni/page.tsx`: Tabs root → `flex flex-col` su mobile (invece del layout sidebar). Icone tab nascoste con `hidden lg:block`. Label sempre visibile.

**G-QA1.2 — Abbonamento Pro: card dettagli piano**
- `app/(app)/abbonamento/page.tsx`: aggiunta card Pro con feature list, fatturazione mensile/annuale, SwitchBillingButton, link "Gestisci abbonamento" via `createPortalSessionAction`.

**G-QA2.1 — Clienti: righe lista tappabili su tutta la riga**
- `app/(app)/clienti/page.tsx`: aggiunto `active:bg-muted/50 cursor-pointer` alle Link della lista.

**G-QA2.2 — Scheda cliente: sola lettura + Modifica via URL**
- `app/(app)/clienti/[id]/page.tsx`: form edit nascosto di default su mobile (`hidden lg:block`); chip "Modifica" usa `?edit=1`; chip "Preventivo" rimosso; chip "Chiama" rimasto.

**G-QA2.3 — Cestino: spinner infinito→stato vuoto**
- `app/(app)/cestino/page.tsx`: `setLoading(false)` negli early-return quando `!user` o `!workspaceId`.

**G-QA3.1 — Doppie etichette rimosse**
- `PreventivoForm.tsx`: rimossa Label "Cliente" ridondante. `VociTable.tsx`: rimosso h2 "Voci preventivo".

**G-QA3.2 — Header creazione compatto (✕ · Titolo)**
- `preventivi/nuovo/page.tsx` e `fatture/nuovo/page.tsx`: header mobile `lg:hidden` con X link + titolo centrato + spacer. Breadcrumb/titolo desktop in `hidden lg:block`.

**G-QA3.3 — FiscalSummary a piena larghezza**
- `FiscalSummary.tsx`: rimosso wrapper `flex justify-end`. Il riepilogo ora occupa tutta la larghezza disponibile.

**G-QA3.4 — Sconto dentro Riepilogo**
- `PreventivoForm.tsx`: rimossa Card 4 "Sconti globali" separata. Sconto spostato dentro FiscalSummary via prop `discountSlot`. Aggiunto stato `discountOpen` + hidden inputs quando il pannello sconto è chiuso.
- `FiscalSummary.tsx`: aggiunto `discountSlot?: React.ReactNode` con separatore visivo.

**G-QA3.5 — Banner accettato completo + Crea fattura su mobile**
- `preventivi/[id]/page.tsx`: banner "Accettato e firmato dal cliente" (sempre, non condizionale); IP mostrato se presente. `ConvertiFatturaButton` aggiunto anche nel gruppo azioni mobile (`lg:hidden`).

**G-QA3.6 — Catalogo: ⋮ header + IVA% in riga**
- `catalogo/page.tsx`: MoreVertical al posto del contatore voci nell'header mobile.
- `CatalogItemRow.tsx`: sottotitolo mobile `unit · IVA X%`; colonne unità e IVA desktop `hidden lg:inline`.

**G-QA3.7 — Wording: "Da catalogo" · "Salva" · badge scadenze**
- `CatalogPicker.tsx`: "Dal catalogo" → "Da catalogo".
- `template/page.tsx`: bottone navy "Personalizza" → "Salva".
- `altro/page.tsx`: query scadenze entro 3gg; badge oro con contatore su "Scadenze e solleciti".

### File toccati (sessione G-QA)
```
app/(app)/impostazioni/page.tsx                [QA1.1: flex-col mobile, icone hidden lg:block]
app/(app)/abbonamento/page.tsx                 [QA1.2: card Pro con dettagli]
app/(app)/clienti/page.tsx                     [QA2.1: active:bg-muted cursor-pointer]
app/(app)/clienti/[id]/page.tsx                [QA2.2: form hidden lg:block, ?edit=1, chip Preventivo rimosso]
app/(app)/cestino/page.tsx                     [QA2.3: setLoading(false) negli early-return]
app/(app)/preventivi/_components/PreventivoForm.tsx  [QA3.1: no Label Cliente; QA3.4: no Card4, discountSlot]
app/(app)/preventivi/_components/VociTable.tsx  [QA3.1: no h2 Voci]
app/(app)/preventivi/nuovo/page.tsx            [QA3.2: header mobile ✕·Titolo]
app/(app)/fatture/nuovo/page.tsx               [QA3.2: header mobile ✕·Titolo]
app/(app)/preventivi/_components/FiscalSummary.tsx  [QA3.3: no flex justify-end; QA3.4: discountSlot prop]
app/(app)/preventivi/[id]/page.tsx             [QA3.5: banner + IP + ConvertiFatturaButton mobile]
app/(app)/catalogo/page.tsx                    [QA3.6: MoreVertical]
app/(app)/catalogo/_components/CatalogItemRow.tsx  [QA3.6: mobile subtitle unit·IVA%]
app/(app)/preventivi/_components/CatalogPicker.tsx  [QA3.7: "Da catalogo"]
app/(app)/template/page.tsx                    [QA3.7: "Salva"]
app/(app)/altro/page.tsx                       [QA3.7: scadenze badge]
DECISIONI_REDESIGN_MOBILE.md                   [sezione G-QA aggiunta]
CLAUDE.md                                      [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde (dopo ogni gruppo G-QA1+QA2, G-QA3)
- `npm run build` → verde
- `npm test -- --run` → 178/178 verdi
- **Non testato in browser reale**: tutti e 13 i punti G-QA vanno verificati da Eli sul telefono.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli (lista completa in `DECISIONI_REDESIGN_MOBILE.md` sezione G-QA).

---

## A-bis. HANDOFF — SESSIONE G6 (14 giugno 2026 — precedente)

### Fix applicati (commit `fix(mobile): G6 — template Classico no-Pro label + P.IVA spostata in tab Fiscale`)

**G6a — Template: Classico non mostra mai "Pro"**
- `app/(app)/template/page.tsx` riga 164: `{isActive ? 'Attivo' : (locked ? 'Pro' : 'Pro')}` → `{isActive ? 'Attivo' : preset.pro ? 'Pro' : ''}`. Entrambi i branch restituivano `'Pro'` — anche il Classico (senza `preset.pro`) mostrava "Pro" quando non era il preset attivo. Ora mostra stringa vuota per i preset senza `preset.pro`.

**G6b — Impostazioni: P.IVA / Codice Fiscale spostato da tab Generale a tab Fiscale**
- `app/(app)/impostazioni/tabs/generali.tsx`: rimosso il blocco `grid-cols-2` che conteneva P.IVA + Email account (righe 97-112). L'email (auth, read-only) ora è un campo standalone con label "Email" (non più "Email account").
- `app/(app)/impostazioni/tabs/fiscali.tsx`: aggiunto `Input` per "P.IVA / Codice Fiscale" in testa alla card (rinominata "Dati fiscali"); `useState` per `piva`; hidden field per inviarlo col form; campo controllato visibile.
- `lib/actions/workspace.ts`: `WorkspaceFiscalSchema` esteso con `piva: z.string().max(16).optional()`; `raw` del parsing include `formData.get('piva')`; l'update usa spread condizionale `...(parsed.data.piva !== undefined && { piva: parsed.data.piva || null })` per rispettare il tipo Supabase.

### File toccati (sessione G6)
```
app/(app)/template/page.tsx                   [riga 164: preset.pro ? 'Pro' : '' invece di always 'Pro']
app/(app)/impostazioni/tabs/generali.tsx      [rimosso P.IVA; Email standalone con label "Email"]
app/(app)/impostazioni/tabs/fiscali.tsx       [aggiunto Input piva + useState + hidden field; card rinominata "Dati fiscali"]
lib/actions/workspace.ts                      [WorkspaceFiscalSchema +piva; raw +piva; update spread condizionale]
DECISIONI_REDESIGN_MOBILE.md                  [FASE 6 aggiornata con nota G6]
CLAUDE.md                                     [aggiornato]
```

### Migration: No

### Test eseguiti
- `npx tsc --noEmit` → verde
- `npm run build` → verde, tutte le route generate
- `npm test -- --run` → 178/178 verdi
- Verifica per ispezione codice: `preset.pro` è definito solo su Bold/Tecnico/Elegante (non su Classico) → Classico ora mostra '' quando non attivo; campo P.IVA in Fiscale usa `useState` + hidden field (pattern identico a `bolloAuto`, `fiscalRegime` etc.).
- **Non testato in browser reale**: (1) pagina Template su mobile → Classico inattivo mostra stringa vuota; (2) Impostazioni → tab Fiscale mostra il campo P.IVA con il valore attuale; (3) salvataggio P.IVA dal tab Fiscale funziona.

### Esito finale
🟡 FIX APPLICATO — tsc+build+test verdi. Da verificare in browser da Eli: i 3 punti sopra.

---

## ⚠️ CONFIG STRIPE DA FARE (sessione 26 — cambio fatturazione SOLO mensile→annuale)

> **Decisione prodotto:** consentito SOLO l'upgrade mensile → annuale, MAI il downgrade
> annuale → mensile. Il bottone "Passa alla fatturazione annuale" in `/abbonamento` compare
> solo per gli abbonamenti mensili e usa `switchToAnnualAction` → portale Stripe con flow
> `subscription_update_confirm` e prezzo annuale **pre-selezionato** (l'utente vede solo la conferma).
>
> **Config Stripe Dashboard (1 volta, sia in sandbox/test sia poi in live):**
> Stripe Dashboard → Settings → Billing → **Customer portal** (in italiano: Impostazioni →
> Fatturazione → Portale clienti):
> 1. Sezione **"Subscriptions"** → attivare **"Customers can switch plans"** (necessario perché
>    il flow `subscription_update_confirm` funzioni).
> 2. Aggiungere il prodotto **Pro** con entrambi i prezzi (Mensile + Annuale).
> 3. Proration: **"Create prorations"** (accredita i giorni non usati al cambio).
>
> ⚠️ **Sandbox vs Live:** la config va rifatta anche in modalità LIVE quando si va in produzione
> (le impostazioni sandbox NON si propagano al live).
>
> **Nota one-directional:** la nostra app offre solo l'upgrade. Stripe però, con "switch plans"
> attivo, tecnicamente permetterebbe il downgrade a chi raggiunge il portale generico
> ("Gestisci abbonamento"). Esposizione minima (l'app non offre quel percorso). Se in futuro
> serve blindarlo del tutto: fare lo switch via `stripe.subscriptions.update()` diretto + dialog
> di conferma in-app, e disabilitare lo switch nel portale.
> Il webhook `customer.subscription.updated` sincronizza già `billing_interval` nel DB.

---

## ⏰ PROMEMORIA — CONFIGURAZIONI DA RICORDARE A ELI A FINE PACCHETTO FEATURE (richiesto da Eli 6 lug 2026)

> Quando TUTTE le nuove feature (blocchi 1-9) sono implementate, ricordare a Eli queste azioni manuali:
> 1. **AI Import** — su Vercel: `NEXT_PUBLIC_AI_IMPORT_ENABLED=true` + `MISTRAL_API_KEY` (console.mistral.ai) + `OPENAI_API_KEY` (platform.openai.com) + Redeploy. Impostare TETTO DI SPESA mensile su entrambi i pannelli provider (~€10-15) — doppia cintura oltre al kill-switch nel codice.
> 2. **Stripe Customer Portal** — config "switch plans" per upgrade mensile→annuale (dettagli nella sezione "CONFIG STRIPE DA FARE" qui sotto). Sandbox E live.
> 3. **SDI** — credenziali del provider di fatturazione elettronica (quando scelto — vedi ricerca-fatturazione-elettronica/DECISIONE_SDI.md).

---

## ⏰ TASK IMMINENTI DA FARE NEI PROSSIMI GIORNI (confermati dall'utente — sessione 25)

> **1. DMARC → quarantine** (azione manuale OVH dell'utente)
> L'utente riceve le email. Prima di passare a `p=quarantine`: controllare i report DMARC
> (SPF+DKIM pass) + test reale a Gmail/Outlook (inbox, non spam). Vedi checklist completa sotto.
> Sequenza obbligatoria: `none → quarantine → reject` (mai saltare a reject).
>
> **2. Attivare AI Import**
> Bottone oggi "IN ARRIVO" disabilitato. Per attivare: `NEXT_PUBLIC_AI_IMPORT_ENABLED=true` su Vercel
> + chiavi `OPENAI_API_KEY` / `MISTRAL_API_KEY`. Da fare dopo i test del piano Pro.
>
> **3. Fatturazione elettronica (SDI)** — task grosso pianificato. Richiede provider SDI gestito (~€0.10/fattura).

---

## ⏰ PROMEMORIA DATATO — DA LEGGERE SE LA DATA È INTORNO AL 15 GIUGNO 2026

> **DMARC cartacanta.app — verifica e aggiornamento policy**
>
> Il 15 maggio 2026 è stato configurato DMARC su OVH Cloud con `p=none`.
> Trascorse ~4 settimane → è il momento di controllare i report e aggiornare.
>
> **Checklist:**
> 1. Verifica report DMARC nella casella `rua=` — devono esserci report XML da Gmail/Outlook.
>    Se SPF e DKIM passano → si può procedere.
> 2. Invia preventivo di test a Gmail e Outlook → verifica inbox, non spam.
> 3. Se tutto ok: OVH Cloud → DNS → `_dmarc.cartacanta.app` → cambia da `p=none` a `p=quarantine`
>    Nuovo valore: `v=DMARC1; p=quarantine; rua=mailto:tuaemailpersonale@gmail.com;`
> 4. Se ci sono errori → NON cambiare policy. Segnala e risolvi prima.
>
> **Regola ferrea:** mai saltare da `p=none` a `p=reject`. Sequenza: `none → quarantine → reject`.

---

## B. REGOLE DI COMPORTAMENTO

### B.1 Regole TypeScript / codice

1. MAI `any` senza commento ESLint esplicito
2. MAI chiavi API nel client — tutto passa da Server Actions o API Routes
3. MAI skipare i test sui calcoli fiscali — coverage 100% obbligatoria su `lib/fiscal/`
4. Commit atomici con conventional commits: `feat/fix/chore/docs/test`
5. Ogni modifica: `npx tsc --noEmit` + `npm run build` devono essere verdi prima del commit
6. `types/database.ts` va rigenerato dopo ogni migration (`npx supabase gen types typescript --project-id ivbzuhgwszkdnlsybsao > types/database.ts`). Non editare manualmente salvo aggiunta urgente documentata.

### B.2 Regole UX/UI permanenti

- **⚠️ SPAZI NEL TESTO JSX (bug Turbopack — scoperto 11 lug 2026):** lo spazio tra un elemento inline (`</b>`, `</strong>`, `</Link>`) e il testo che segue può venire MANGIATO dal compilatore quando il testo contiene accenti/apostrofi tipografici (es. "…</b> e scarica" → "…e scarica" attaccato), anche se nel sorgente lo spazio c'è. **Regola: usare SEMPRE `{' '}` esplicito tra un elemento inline e il testo adiacente** nei copy visibili. Verifica ground-truth: `grep -roh '}),"[a-zàèéìòù][^"]\{0,50\}' .next/server/chunks/ssr/*.js | sort -u` dopo il build (devono restare solo valori tecnici).
- **Mobile-first è non negoziabile.** Ogni funzionalità deve funzionare perfettamente su telefono prima che su desktop.
- `ClientAutocomplete`, `AtecoMultiSelect`, `CatalogPicker`: usano `<PopoverContent>` Radix (portal su `document.body`) — NON rimuovere, evita clipping da `Card overflow-hidden`.
- Dropdown bot `KanbanView` e `ViewToggle` sono stati rimossi definitivamente (session 12). Non re-aggiungere.
- `StatusBadge` con prop `docType` per distinguere fatture da preventivi (accepted→"Pagata", rejected→"Annullata").
- IVA visibile su mobile per regime ordinario (grid-cols-5 nel VociTable mobile).
- `safeAccentColor` obbligatorio in `TemplatePreview.tsx` e `template.ts` per evitare testo chiaro su sfondo bianco.
- **Ordinamento lista preventivi (aggiornato sessione 26):** default = **`oldest` ("Meno recenti", `updated_at ASC`)** — NON più `recent`. La preferenza utente è in **sessionStorage** (chiave `preventivi_sort_v2`), vale solo per la sessione. Questo elimina il "flip" all'apertura della pagina (prima il default server `recent` + localStorage `oldest` causava un `router.replace` visibile). NB: supera le note della sessione 18 che descrivevano localStorage + default `recent`.

### B.3 Regole numerazione documenti

**⚠️ AGGIORNATO sessione 25: NON ci sono più prefissi Prev/Fatt.**
I numeri sono nel formato `{NNN}/{YYYY}` (es. `001/2026`) per **entrambi** preventivi e fatture.
In `lib/actions/documents.ts`:
- `allocateDocNumber()` → `{NNN}/{YYYY}` (es. "001/2026") — sequenza `doc_type = 'preventivo'`
- `allocateInvoiceNumber()` → `{NNN}/{YYYY}` (es. "001/2026") — sequenza `doc_type = 'fattura'`
- `peekNextDocNumber()` / `peekNextInvoiceNumber()` → preview (usano colonna `doc_type` su `invoice_sequences`, NON `seq_type`)
- `formatDocNumber()` in `lib/utils/index.ts` rimuove eventuali prefissi letterali legacy (`replace(/^[A-Za-z]+/, '')`) per i documenti vecchi che avevano "Prev"/"Fatt".

**Differenziazione fattura (sessione 25):** il numero salvato nel DB è identico per entrambi
("001/2026"), MA in **visualizzazione in-app** `formatDocNumber(num, 'fattura')` antepone il
marcatore **"Fatt."** → le fatture appaiono come **"Fatt. 001/2026"**, i preventivi come "001/2026".
Questo evita confusione senza migration. Email e PDF usano il numero grezzo (il PDF ha già la
testata "FATTURA"/"PREVENTIVO"). I punti che mostrano una fattura collegata DENTRO un testo già
prefissato (es. "Fattura {numero}") NON passano 'fattura' per evitare "Fattura Fatt. ..." ridondante.

**Non c'è più una card "Numerazione documenti" in impostazioni** (rimossa in session 13 — 3d671d3). Il formato non è configurabile dall'utente.

**⚠️ AGGIORNATO sessione 26 — il numero viene assegnato SUBITO alla creazione (anche per le bozze).**
`createDocumentAction` chiama `allocateDocNumber()` prima dell'INSERT per OGNI nuovo documento
(sia "Salva bozza" sia "Invia al cliente"), a meno che non sia stato passato un numero manuale valido.
Quindi **una bozza ha già un `doc_number` dal momento della creazione** (non più `null`).
Motivo: l'utente vuole vedere il numero progressivo subito.
Conseguenza nota: le bozze cancellate lasciano "buchi" nella sequenza (la RPC non li riempie). Accettato.

**`intent` nel form:** valori usati = `'save_draft'` | `'send'` (preventivo), `'save'` | `'send'` (FatturaForm),
`'create'` (preventivo→fattura). Nello schema Zod `DocumentFormSchema.intent` è `z.string().optional()`
(NON un enum ristretto: un enum `['save','send']` rompeva il salvataggio bozza con
"Invalid option: expected one of save|send"). Ogni action interpreta i valori che le servono.

**`send-email/route.ts`** mantiene il fallback: se per qualche motivo `doc_number` è ancora null al primo invio, lo assegna lì.

**La RPC usa INSERT ... ON CONFLICT DO UPDATE incrementando `last_number`** — non riempie i buchi. Se l'ultimo allocato è 5, il prossimo è 6 anche se 3 e 4 sono stati cancellati.

### B.4 Regole preventivi / fatture / collegamenti

**Soft delete:** i documenti vengono spostati nel cestino (`deleted_at = now()`), non cancellati. Il cestino è a `/cestino`, recupero entro 15 giorni, poi purge automatico via cron. Tutte le query lista **devono filtrare `deleted_at IS NULL`** — se aggiungi una query sui documenti, controlla.

**Preventivo accettato — re-edit:** un preventivo `accepted` può essere ri-editato (saveDraftAction lo resetta a `draft`) **a meno che non abbia una fattura collegata con status accepted**. In quel caso è locked.

**Preventivo → fattura:** 
- Entry point 1: dal dettaglio preventivo accettato → "Converti in fattura"
- Entry point 2: `/fatture/nuovo` → `CreateFromPreventivoButton` — mostra tutti i preventivi non-bozza/non-scaduti con status badge; se non-accepted, chiede conferma prima di convertire
- La funzione `convert_preventivo_to_fattura` SQL è idempotente: se la fattura esiste già la restituisce
- Collegamento bidirezionale: la fattura ha `origin_document_id`; sul dettaglio fattura c'è `LinkToPreventivoButton` per agganciare/sganciare manualmente

**Fattura → preventivo:** su `/fatture/[id]` c'è il banner collegato o il pulsante "Collega a preventivo" se `origin_document_id = null`.

**DocumentTimeline:** presente su tutti i preventivi (bozze incluse). Mostra eventi created/sent/viewed/accepted/rejected/expired + eventuale "Fattura collegata". Non c'è una colonna `rejection_at` — usa `sent_at` come fallback per l'evento Rifiutato.

### B.5 Regole autenticazione / rate limiting

**Login rate limit** (post-fix sessione 13): il rate limit viene chiamato SOLO su autenticazione fallita. I login riusciti non consumano token. Limite: 10 fallimenti / 15 min per IP. Key: `auth:login-fail:{ip}`.

**Verifica email:** `/verifica-email` è in `PUBLIC_PATHS` del proxy. Gli utenti non autenticati (appena registrati con email non confermata) possono accedere a questa pagina senza essere rimandati al login.

**OAuth bfcache:** `OAuthButtons.tsx` ha listener `pageshow` che resetta lo stato loading quando `e.persisted === true` (tornare dalla pagina Google su mobile).

### B.6 Regole email / deliverability

**`sendEmail`** in `lib/email/send.ts` invia sia HTML che plain-text (generato automaticamente strippando i tag HTML). NON aggiungere emoji nei subject o nel body — peggiorano lo spam score.

**FROM:** `Carta Canta <noreply@send.cartacanta.app>` — non modificare il dominio mittente senza aggiornare anche DKIM/SPF.

**replyTo:** le email di invio preventivo al cliente usano l'email dell'owner come `reply_to` — se il cliente risponde, arriva all'artigiano.

### B.7 Regola migration — COME COMUNICARLE ALL'UTENTE

**OGNI VOLTA che il codice richiede una nuova migration SQL, incollare il testo della migration in fondo al messaggio inviato all'utente**, in un blocco SQL ben visibile con titolo "⚠️ Migration da applicare". L'utente la copia direttamente su Supabase SQL Editor.

Formato obbligatorio da usare alla fine del messaggio:

```
---
### ⚠️ Migration da applicare su Supabase SQL Editor

\```sql
-- testo della migration qui
\```
```

**Non inviare il messaggio senza questo blocco se c'è una migration.** L'utente non deve cercarla nel codice.

### B.8 Regole PDF — ARCHITETTURA POST-SESSIONE 16 (aggiornata sessione 23)

**`buildPdfHtml()` in `lib/pdf/template.ts` è LA FONTE UNICA DI VERITÀ.**
Tutte le superfici visive usano questa funzione. Non creare layout alternativi.

**Watermark (sessione 23):** Il watermark diagonale "Carta Canta" è stato RIMOSSO per tutti i piani.
Rimane solo il footer `"Preventivo generato con Carta Canta · cartacanta.app"` (10px, visibile solo se `showWatermark=true` = Free).
Pro può disabilitare anche il footer impostando `show_watermark=false`.

**Font size (sessione 23):** tutti i font size in `lib/pdf/template.ts` sono stati scalati ×1.2 (es. 11px→13px, 14px→17px, 26px→31px).
Anche `TemplatePreview.tsx` è stato allineato con le stesse proporzioni.

**Email non allega PDF:** Il documento viene inviato come LINK pubblico (`/p/[token]`). Nessun allegato PDF.
Il testo default del messaggio email è "Le faccio avere il link a ${ref} come da nostra intesa."

**⚠️ Chromium headless NON funziona su Vercel Lambda** — nessuna versione di `@sparticuz/chromium` funziona (manca `libnss3` nel runtime serverless). Non tentare di reintrodurlo senza un piano alternativo (microservizio separato su Render/Railway).

**Architettura definitiva:**

```
buildPdfHtml(data: PdfDocumentData) → HTML string
  → /api/documents/[id]/pdf?preview=1  → tab solo visualizzazione (no stampa)
  → /api/documents/[id]/pdf            → tab con window.print() automatico → utente salva come PDF
  → /api/p/[token]/pdf                 → idem (pagina pubblica cliente)
  → lib/pdf/generate.ts → generatePdfBuffer() → @react-pdf/renderer → Buffer
      → /api/documents/[id]/send-email  (allegato email — visivamente diverso ma funzionale)

buildPdfHtml(data) → HTML string
  → app/p/[token]/page.tsx → <DocumentFrame html={html} />  → <iframe srcDoc> 
  → app/(app)/preventivi/[id]/page.tsx → <DocumentFrame> (anteprima in-app)
```

**`preparePrintHtml(html, triggerPrint)`** in `lib/pdf/logo.ts`:
- Inietta `@media print { print-color-adjust: exact }` — forzare colori/sfondi senza che l'utente spunti "Grafica in background"
- Se `triggerPrint=true`: inietta `window.onload=()=>window.print()`

**PdfActions** (`app/(app)/preventivi/_components/PdfActions.tsx`):
- "Anteprima": `/api/documents/[id]/pdf?preview=1` → solo visualizzazione
- "Salva come PDF": `/api/documents/[id]/pdf` → apre dialogo stampa automaticamente

**Logo:** `fetchLogoBase64()` in `lib/pdf/logo.ts` — URL → data-URI base64 (timeout 5s).

**`template_snapshot`** congela il template al momento dell'invio.
- `saveDraftAction` salva lo snapshot se viene cambiato `template_id`
- `send-email/route.ts` sovrascrive sempre lo snapshot al primo invio

**Fallback chain per il template** (identica in tutti i route e pagine):
1. `doc.template_snapshot` (congelato all'invio)
2. Template default del workspace (`is_default = true`)
3. Qualsiasi template del workspace (`limit 1`)
4. `null` → `buildPdfHtml()` usa stili hardcoded di default

**Performance:** `maxDuration = 60` sulle route PDF (Vercel Pro). Chromium startup ~5-15s. Cold start può richiedere fino a 20s al primo invio.

**`PreventivoPDF.tsx`** — NON più in uso nella chain di produzione. Candidato alla rimozione.

---

## C. FORMATO RISPOSTA OBBLIGATORIO PER OGNI TASK

Quando chiudi (o aggiorni) un task, la risposta **deve** contenere:

```
1. Bug/problema trovato
   - Causa reale confermata (dove nel codice, quale riga)

2. Fix implementato
   - Cosa esattamente è cambiato

3. File toccati
   - Lista con motivo della modifica

4. Migration necessarie
   - Sì / No — se sì, specifica SQL e se applicata

5. Test eseguiti
   - Cosa è stato verificato e COME (codice tracciato / browser reale / nessun test)

6. Esito finale
   - ✅ CHIUSO — verificato end-to-end nel browser
   - ⚠️ PARZIALE — fix codice ok, ma parte del fix richiede azione esterna o test non ancora fatto
   - 🟡 FIX APPLICATO — codice corretto per logica, da verificare manualmente
   - ❌ APERTO — causa identificata ma fix non ancora implementato
```

**Regola assoluta:** non scrivere "✅ CHIUSO" se non è stato verificato end-to-end nel browser reale o in un test automatico che riproduce il flusso.

---

## D. STATO PROGETTO — FEATURE COMPLETE (aggiornato sessione 23)

| Area | Stato | Note |
|---|---|---|
| Auth (email + OAuth) | ✅ Stabile | bfcache fix; rate limit fallimenti; reset password via /auth/confirm |
| Onboarding multi-step | ✅ Stabile | |
| Password sicura | ✅ Implementato | `PasswordStrength.tsx` — 4 requisiti validati client+server |
| Rinvia email verifica | ✅ Implementato | `/verifica-email` ha form resend via `supabase.auth.resend()` |
| Preventivi CRUD | ✅ Stabile | soft delete, re-edit, timeline, scadenze, Modificato banner |
| Fatture CRUD | ✅ Stabile | doppio entry point, Invia al cliente, timeline, Modificato banner |
| Clienti rubrica | ✅ Stabile | email/telefono obbligatori, full-text search, CF dedup |
| Catalogo CRUD | ✅ Stabile | |
| Template PDF — 4 preset | ✅ Stabile | font +20%, watermark diagonale rimosso, footer solo Free |
| Template — personalizzazioni Pro | ✅ Stabile | logo, font, legal notice |
| DocumentTimeline | ✅ Stabile | preventivi + fatture; eventi: sent/resent/modified/restored/accepted/rejected |
| Piano Free — quota storica | ✅ Stabile | `FREE_DOC_LIMIT = 8` |
| Soft delete + cestino | ✅ Stabile | `/cestino`, 15gg, cron purge |
| Dashboard KPI | ✅ Stabile | 4 card (accettati, valore prev, valore fatt, bozze); KPI fatturato → `/fatture?q=Pagata`; Prossima Scadenza → expires_at ASC |
| RevenueChart | ✅ Stabile | dual-bar accettati + fatturato |
| Referral system | ✅ Stabile | Team rimosso dall'UI referral |
| Piano Team | ⏸️ Nascosto | Card nascosta da abbonamento + referral fino al lancio |
| Stripe webhook | ✅ Stabile | |
| Voice input | ✅ Implementato | AssemblyAI SDK v4 |
| Export CSV preventivi | ✅ Implementato | |
| Cron scadenze + reminder | ✅ Stabile | |
| AI import | ⏸️ Disabilitato via flag | Bottone "IN ARRIVO" (flag `NEXT_PUBLIC_AI_IMPORT_ENABLED`). Per attivare: flag=true + chiavi OpenAI/Mistral |
| PostHog / Flagsmith / Sentry | ⏸️ Non configurati | |

---

## E. DECISIONI DI PRODOTTO CONFERMATE

| Decisione | Stato |
|---|---|
| Piano Team nascosto | ✅ Sessione 23 — nascosto da abbonamento + referral fino al lancio |
| Piano Team ⊇ Piano Pro | ✅ Confermato — nella logica interna Team include Pro |
| Limite Free: 8 preventivi storici (sent_quota_used) | ✅ Confermato — `FREE_DOC_LIMIT = 8` |
| Consumo Free: conta al primo invio | ✅ Implementato — non si decrementa alla cancellazione |
| Soft delete + cestino 15gg | ✅ Implementato |
| Numerazione: formato {NNN}/{YYYY} senza prefissi (no Prev/Fatt) | ✅ Confermato sessione 25 |
| Watermark diagonale rimosso | ✅ Sessione 23 — rimosso per tutti; solo footer Free |
| Font PDF +20% | ✅ Sessione 23 — confermato definitivo |
| `expires_at` riparte SOLO al (re)invio | ✅ Sessione 23 — salvataggio manuale non cambia scadenza |
| Email/telefono obbligatori per ogni cliente | ✅ Sessione 23 — bloccante in tutti i form creazione |
| Password: 4 requisiti obbligatori | ✅ Sessione 23 — maiuscola, minuscola, numero, simbolo |
| Email invio: link (no PDF allegato) | ✅ Confermato — testo default aggiornato |
| Template Free: preset non resetta colore | ✅ Confermato |
| Template Elegante: doc number NO brand color | ✅ Confermato — usa `safeAccentColor` |
| Preventivo accepted re-editabile se no fattura | ✅ Implementato |
| Kanban view rimosso | ✅ Definitivamente rimosso |
| AI import: attivare dopo test Pro | ✅ Confermato — key mancanti in prod |

---

## F. COSA NON TOCCARE SENZA SCREENSHOT/TEST

| Area | Motivo | Regola |
|---|---|---|
| `lib/fiscal/calcoli.ts` | Motore fiscale — 100% test coverage | Non toccare senza test. Nessuna eccezione. |
| `lib/pdf/template.ts` | 4 layout PDF su design di riferimento | Non modificare senza screenshot aggiornati |
| `TemplatePreview.tsx` | 4 layout React distinti, safeAccentColor | Non modificare senza screenshot |
| Stripe webhook handler | Funziona in produzione | Testare sempre in Stripe test mode prima |
| `template_snapshot` formato | I PDF vecchi usano snapshot congelato | Non cambiare formato senza considerare retrocompatibilità |

---

## 0. REGOLE BASE PER CLAUDE CODE

1. Leggi TUTTO questo file prima di scrivere codice
2. Un task alla volta — output sempre: file toccati + commit hash + tsc verde + build verde
3. Sequenza: capire → implementare → `npx tsc --noEmit` → `npm run build` → verificare → commit
4. Mai interpretare arbitrariamente una decisione di prodotto — se non è documentata qui, chiedi
5. Non reimplementare da zero senza prima trovare la causa precisa del problema
5-B. Prima di cambiare UI/copy/comportamento, leggi DECISIONI_E_FEEDBACK.md. NON annullare le voci ✅ (bloccate) senza istruzione esplicita di Eli.
6. **A fine di OGNI task** (non solo a fine sessione): aggiornare CLAUDE.md + `git push` (origin → Vercel) — questo è il backup primario. Confermare all'utente che il push è andato a buon fine. **Backup NAS (`git push nas master`) ora OPZIONALE** (decisione Eli 14 giu 2026): GitHub è la fonte di verità/backup; il NAS solo occasionale e solo quando il drive Z: è montato (utente `moian`). Con l'utente `elisa` il push NAS fallisce ed è normale — non bloccarsi.
7. `types/database.ts` va rigenerato dopo ogni migration
8. **Non dichiarare risolto un bug solo perché hai trovato la causa nel codice.** Usa il formato sezione C.

---

## 0-B. BACKUP NAS

```
NAS path:    Z:\CARTA CANTA
Remote git:  nas   (già configurato)
Comando:     git push nas master

File da ESCLUDERE sempre: node_modules/ .next/ dist/ build/ .claude/worktrees/ supabase/.temp/

⚠️ AGGIORNATO 14 giu 2026 — il NAS NON è più obbligatorio a ogni task. GitHub (origin) è il backup primario.
  1. Aggiorna CLAUDE.md
  2. git add <file specifici> && git commit -m "..."
  3. git push              (origin → Vercel Production, deploy automatico entro 1-3 min) — OBBLIGATORIO
  4. git push nas master   (OPZIONALE — backup NAS, solo se il drive Z: è montato; con utente 'elisa' fallisce ed è normale)
  5. Confermare all'utente: "Push origin riuscito — deploy Vercel partito. URL: https://cartacanta.app"

Nota: il drive Z: (NAS) è montato solo con l'utente 'moian'. Con l'utente 'elisa'
git push nas master fallisce con "does not appear to be a git repository".
In quel caso: eseguire solo git push origin, segnalare il fallimento NAS all'utente.
```

---

## 1. IDENTITÀ E POSIZIONAMENTO

**Carta Canta** è una SaaS italiana per preventivi e fatture, rivolta ad artigiani, freelance e piccole imprese.

- **Target primario:** Artigiani italiani (idraulici, elettricisti, falegnami, imbianchini, installatori) — usano prevalentemente il telefono, spesso in cantiere
- **Target secondario:** Freelance/professionisti in regime forfettario o ordinario
- **Target terziario:** Piccole realtà 2-5 persone (imprese edili, studi tecnici)

**Promessa:** *"Preventivi professionali in 60 secondi. Senza Excel, senza carta."*

UX mobile-first è **non negoziabile**: ogni funzionalità deve funzionare perfettamente dal telefono prima che dal computer.

---

## 2. TECH STACK

| Componente | Tecnologia | Versione / Note |
|---|---|---|
| Framework | Next.js App Router | **16.2.3** — NON 15 |
| Runtime UI | React | 19.2.4 |
| Database | Supabase (PostgreSQL 16) | `@supabase/supabase-js` 2.103 |
| Auth | Supabase Auth (PKCE flow) | Route Handler `/auth/callback`, NON Server Action |
| Hosting | Vercel Pro | Frankfurt fra1 — EU data residency |
| Pagamenti | Stripe | SDK 22.x |
| Email | Resend + React Email | HTML + plain-text (generato da strip HTML) |
| AI import | Mistral (primario) + OpenAI (fallback) | Disabilitato in prod (chiavi vuote) |
| Voice input | AssemblyAI SDK | 4.32.1 — `speech_models: ['universal']` (array, NON singolare) |
| Rate limiting | Upstash Redis + `@upstash/ratelimit` | sliding window |
| CSS | Tailwind CSS v4 | |
| Componenti UI | shadcn/ui (Radix UI) | `radix-ui` 1.4.x |
| PDF | `playwright-core` + `@sparticuz/chromium` | `buildPdfHtml()` → HTML → Chromium headless → PDF. `@react-pdf/renderer` / `PreventivoPDF.tsx` non più usati in produzione. |
| Analytics | PostHog EU | Non configurato in prod |
| Feature flags | Flagsmith | Non configurato in prod |
| Error tracking | Sentry | Non configurato in prod |
| Testing | Vitest (unit) + Playwright (E2E) | |
| Linguaggio | TypeScript 5.x strict mode | |

---

## 3. INFO OPERATIVE

```
Repo:           github.com/Elis93/carta-canta
Dev locale:     C:\Users\Public\carta-canta   (⚠️ spostato da C:\progetti\carta-canta — giugno 2026)
Backup NAS:     Z:\CARTA CANTA  (remote git "nas")
Hosting:        Vercel Pro fra1
DB:             Supabase — project ID ivbzuhgwszkdnlsybsao
URL prod:       https://cartacanta.app
Deploy:         push su master → Vercel Production automatico entro 1-3 min
```

---

## 4. STRUTTURA PROGETTO (rilevante)

```
app/
├── (app)/
│   ├── dashboard/                  # KPI, attività recente, PendingDocCard
│   ├── preventivi/
│   │   ├── page.tsx                # Lista con search unificata, filtri, tab status
│   │   ├── [id]/page.tsx           # Dettaglio con timeline, PDF, send
│   │   ├── scadenze/page.tsx       # Preventivi in scadenza entro 3gg
│   │   └── _components/           # PreventivoForm, VociTable, CatalogPicker,
│   │                               # DocumentTimeline, PdfActions, StatusBadge...
│   ├── fatture/
│   │   ├── page.tsx
│   │   ├── [id]/page.tsx           # Con LinkToPreventivoButton
│   │   └── _components/           # CreateFromPreventivoButton, LinkToPreventivoButton
│   ├── cestino/page.tsx            # Soft delete — recupero/purge (15gg)
│   ├── clienti/[id]/page.tsx
│   ├── template/                   # 4 preset, PresetSelector, TemplateEditor, Preview
│   ├── catalogo/                   # CRUD + AtecoCatalogSuggestion
│   ├── impostazioni/tabs/          # generali, fiscali (senza card Numerazione), piano, notifiche
│   ├── abbonamento/page.tsx        # Quota bar free, piano explanation
│   └── referral/
├── (auth)/
│   ├── login/page.tsx
│   ├── signup/
│   ├── verifica-email/page.tsx     # Accessibile senza auth (in PUBLIC_PATHS)
│   └── actions.ts                  # loginAction, signupAction, ecc.
├── p/[token]/                      # Pagina pubblica preventivo
├── api/
│   ├── documents/[id]/pdf/         # GET — genera/serve PDF (inline o attachment)
│   ├── documents/[id]/send-email/  # POST — invia email con PDF allegato
│   ├── preventivi/[id]/status/     # PATCH — cambio stato manuale
│   ├── p/[token]/accept|decline|view/
│   ├── cron/expire-documents/
│   ├── cron/referral/
│   └── webhooks/stripe/
lib/
├── actions/documents.ts            # Server Actions: create, saveDraft, send, duplicate,
│                                   # restore, purge, linkDocument, peekNextDoc/Invoice
├── actions/templates.ts            # CRUD template + selectPresetAction
├── fiscal/calcoli.ts               # INTOCCABILE — 100% coverage
├── pdf/template.ts                 # buildPdfHtml — 4 layout — INTOCCABILE senza screenshot
├── pdf/generate.ts                 # Playwright HTML→PDF + cache Supabase Storage
├── email/send.ts                   # sendEmail — HTML + plain-text generato
├── free-trial.ts                   # checkFreeBlock — FREE_DOC_LIMIT = 8
└── auth-rate-limit.ts              # isAuthRateLimited — Upstash Redis
proxy.ts                            # Middleware Next.js — PUBLIC_PATHS include /verifica-email
types/database.ts                   # GENERATO — non modificare manualmente
```

---

## 5. VARIABILI D'AMBIENTE

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_PRO_MONTHLY=
STRIPE_PRICE_PRO_YEARLY=
STRIPE_PRICE_TEAM_MONTHLY=
STRIPE_PRICE_TEAM_YEARLY=
STRIPE_PRICE_LIFETIME=
OPENAI_API_KEY=           # Fallback AI (vuota in prod)
MISTRAL_API_KEY=          # Primario AI (vuota in prod)
ASSEMBLYAI_API_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@send.cartacanta.app
RESEND_FROM_NAME=Carta Canta
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=
CRON_SECRET=
NEXT_PUBLIC_POSTHOG_KEY=
NEXT_PUBLIC_POSTHOG_HOST=https://eu.posthog.com
NEXT_PUBLIC_FLAGSMITH_KEY=
SENTRY_DSN=
NEXT_PUBLIC_APP_URL=https://cartacanta.app
NEXT_PUBLIC_APP_NAME=Carta Canta
NEXT_PUBLIC_AI_IMPORT_ENABLED=    # 'true' per mostrare il bottone AI Import (richiede anche OPENAI/MISTRAL key)
NEXT_PUBLIC_SDI_ENABLED=          # 'true' per mostrare la card SDI sulle fatture
OPENAPI_SDI_API_KEY=              # chiave OpenAPI (vuota = provider MOCK di prova, nessuna trasmissione reale)
OPENAPI_SDI_BASE_URL=             # default sandbox https://test.invoice.openapi.com (prod: da doc OpenAPI)
SDI_WEBHOOK_SECRET=               # segreto per /api/webhooks/sdi?secret=...
```

---

## 6. PIANI E FEATURE GATING

```typescript
// lib/stripe/plans.ts — valori effettivi in produzione
Piano Free:         limit = 8 preventivi storici (sent_quota_used in lib/free-trial.ts)
                    1 template, watermark visibile, voice 300s/mese
Piano Pro:          preventivi illimitati, template illimitati, no watermark, voice 3600s/mese
Piano Team:         tutto Pro + 5 collaboratori + approval workflow
Piano Lifetime:     tutto Pro, pagamento one-time
```

**Prezzi Stripe:**
```
Free:           €0
Pro Mensile:    €19.00/mese
Pro Annuale:    €182.00/anno
Team Mensile:   €49.00/mese
Team Annuale:   €470.00/anno
Lifetime:       €299.00 one-time
```

**Template gating:**
- Free: scelta 4 preset base, 1 template max, nessuna personalizzazione avanzata
- Pro/Team: colore, font, logo position, watermark, legal notice, header/footer HTML, template illimitati

---

## 7. DATABASE SCHEMA

### Enums
```sql
plan_type:     free | pro | team | lifetime
fiscal_regime: forfettario | ordinario | minimi
doc_status:    draft | sent | viewed | accepted | rejected | expired
```

### Tabelle principali

**`workspaces`**: `owner_id`, `plan`, `stripe_customer_id`, `stripe_subscription_id`, `billing_interval`, `fiscal_regime`, `ateco_codes TEXT[]`, `validity_days`, `logo_url`, `bollo_auto`, `ritenuta_auto`, `sent_quota_used INT`.

**`documents`**: `doc_type` ('preventivo'|'fattura'), `status`, `public_token`, `doc_number`, `doc_year`, `doc_seq`, `template_snapshot JSONB`, `signature_image`, `rejection_reason`, `bonus_edilizio`, `origin_document_id UUID` (per fatture da preventivo), `last_reminder_at TIMESTAMPTZ`, `deleted_at TIMESTAMPTZ` (null = attivo, non-null = nel cestino), `accepted_at`, `accepted_ip`, `accepted_ua`, `signer_name`.

**`document_items`**: `sort_order`, `description`, `unit`, `quantity`, `unit_price`, `discount_pct`, `vat_rate`, `total`, `bonus_tipo`.

**`invoice_sequences`**: PK `(workspace_id, year, doc_type)`. Colonne: `doc_type TEXT`, `seq_type TEXT` (legacy), `last_number INT`, `year`, `workspace_id`. Funzione RPC `next_invoice_number(p_workspace, p_year, p_doc_type)` — atomica, usa INSERT ON CONFLICT DO UPDATE.

**`templates`**: `preset_key TEXT CHECK('classico'|'bold'|'tecnico'|'elegante')`, `color_primary`, `font_family`, `show_logo`, `show_watermark`, `legal_notice`, `header_html`, `footer_html`, `logo_position TEXT('left'|'right')`, `is_default`.

**`catalog_items`**: `workspace_id`, `name`, `description`, `unit`, `unit_price`, `vat_rate`, `category`, `is_active`.

**`document_views`**: `document_id`, `viewed_at`, `user_agent`, `ip_address`.

**`referral_codes`**, **`referral_uses`**, **`referral_rewards`**: vedi sezione 13.

**`voice_usage`**: `workspace_id`, `period TEXT` (YYYY-MM), `seconds_used`. UNIQUE su `(workspace_id, period)`.

### Migration applicate (001–031)

| # | Contenuto |
|---|---|
| 001 | Schema completo: workspaces, clients, templates, documents, RLS |
| 002 | `doc_year`, `doc_seq` generated columns |
| 003–010 | signer_name, viewed_status, document_views, notification_prefs, catalog_items, fatture, signature_image, rejection_reason |
| 011 | rate_limit_events |
| 012–013 | invoice_sequences per doctype, next_invoice_number unificata |
| 014–017 | ateco_codes array, bonus_edilizio, workspace_validity_days, storage logos |
| 018 | Referral system + trigger + RLS + my_workspace_ids() |
| 019 | voice_usage |
| 020 | billing_interval su workspaces + reward_month su referral_rewards |
| 021 | template preset_key CHECK |
| 022 | template logo_position + number_format |
| 023 | pdf_downloaded_at |
| 024 | free_trial_expires_at |
| 025 | sent_quota_used su workspaces |
| 026 | origin_document_id su documents |
| 027 | fix doc_seq prefix per prefissi non-numerici |
| 028 | repair invoice_sequences (aggiunge doc_type, ricrea PK, aggiorna RPC) |
| 029 | last_reminder_at TIMESTAMPTZ su documents |
| 030 | deleted_at TIMESTAMPTZ su documents + indici parziali (soft delete) |
| 031 | next_invoice_number: SECURITY DEFINER + GREATEST anti-gap (applicata 20 mag 2026) |

---

## 8. MOTORE FISCALE — REGOLE INVIOLABILI

```typescript
// lib/fiscal/calcoli.ts — NON TOCCARE senza test

// ARROTONDAMENTO: sempre round half up — MAI toFixed() — MAI banker's rounding
function roundFiscale(v: number) { return Math.round((v + Number.EPSILON) * 100) / 100 }

// ORDINE CALCOLO OBBLIGATORIO:
// 1. totale per voce (qty × price × (1 - discount%))
// 2. subtotale
// 3. sconto globale
// 4. IVA PER VOCE (non sul totale — obbligatorio per legge IT)
// 5. ritenuta d'acconto
// 6. marca da bollo (forfettari con afterDiscount > 77.47 → €2.00)
// 7. totale finale
```

---

## 9. FLOWS UTENTE

### Creazione preventivo
1. Nuovo → seleziona cliente → aggiunge voci (con microfono) → salva bozza
2. Invia al cliente → email con PDF → public_token generato → status 'sent'
3. Cliente apre `/p/[token]` → accetta/rifiuta → notifica email all'artigiano
4. Accettazione: salva IP + UA + timestamp → status 'accepted'
5. Opzionale: converte in fattura (doppio entry point)

### Link pubblico cliente
- URL: `/p/[token]` — MAI `/preventivi/[id]`
- No auth, mostra preventivo nel template
- Email `reply_to` impostata sull'email dell'owner

### Re-edit preventivo accepted
- Disponibile se non ha fattura collegata con status accepted
- `saveDraftAction` resetta status a 'draft', azzera `accepted_at`
- Se ha fattura collegata accepted → locked, solo lettura

### Soft delete
- `deleteDocumentAction` imposta `deleted_at = now()`
- `/cestino` mostra i documenti nel cestino con countdown 15gg
- `restoreDocumentAction` azzera `deleted_at`
- `purgeDeletedDocumentAction` cancella definitivamente
- Cron auto-purge documenti con `deleted_at > 15gg`

---

## 10. RATE LIMITING

```typescript
// lib/auth-rate-limit.ts
// Auth login: 10 fallimenti / 15min per IP — conta solo errori, non login riusciti
// Key: auth:login-fail:{ip}

// lib/rate-limit.ts (in-memory fallback)
// send-email: 10/ora per user
// accept/decline: 5/ora per token
// AI extract: 5/min
// PDF: 10/min
```

---

## 11. FEATURE FLAGS (Flagsmith — non configurato in prod)

```typescript
FEATURE_AI_IMPORT: true (ma chiavi vuote)
FEATURE_VOICE_INPUT: true
FEATURE_REFERRAL: true
FEATURE_SDI_INTEGRATION: false
FEATURE_MARKETPLACE: false
FEATURE_PUBLIC_API: false
```

---

## 12. FUNZIONALITÀ IMPLEMENTATE (sintesi)

- Auth: email/password + OAuth Google (solo Google — GitHub non implementato) + bfcache fix mobile
- Onboarding multi-step (fiscali, ATECO, logo)
- Preventivi CRUD + status workflow + DocumentTimeline + re-edit accepted
- Soft delete + cestino + recupero 15gg
- Pagina scadenze `/preventivi/scadenze`
- Fatture CRUD + conversione da preventivo (doppio entry point + idempotenza)
- Collegamento bidirezionale preventivo ↔ fattura
- Clienti: rubrica + full-text search + StatusBadge + CF dedup
- Catalogo: CRUD + suggerimento ATECO verificato in produzione
- Template PDF: 4 preset (Classico, Bold, Tecnico, Elegante)
- Template: personalizzazioni Free/Pro + safeAccentColor + logo position
- PdfActions: server-side links (non più client-side)
- Dashboard: 5 KPI + RevenueChart dual-bar + PendingDocCard solleciti
- Referral: codici, cron premi mensili, pagina piano-specifica
- Stripe: webhook + billing_interval + subscription lifecycle
- Voice input: AssemblyAI SDK v4, quota mensile per piano
- AI import: endpoint pronto, disabilitato in prod (chiavi vuote)
- Export CSV preventivi
- Cron: scadenze + last_reminder_at + referral premi
- Email: HTML + plain-text, replyTo owner, no emoji nei subject/body

---

## 13. LOGICA REFERRAL

La logica viene calcolata il **1° di ogni mese** dal cron `/api/cron/referral`. Premio quando il referrer ha **3+ referee con abbonamento attivo**.

| Piano referrer | Tipo referee | Beneficio |
|---|---|---|
| Free | Qualsiasi abbonamento | 1 mese Pro gratis |
| Pro mensile | Qualsiasi abbonamento | Rinnovo €19 non addebitato |
| Pro annuale | Qualsiasi abbonamento | Scadenza +1 mese |
| Team mensile | 3+ Piano Team | Rinnovo €49 non addebitato |
| Team mensile | 3+ Piano Pro (non Team) | 50% sconto rinnovo (€24,50) |
| Team annuale | 3+ Piano Team | Scadenza +1 mese |
| Team annuale | 3+ Piano Pro (non Team) | Scadenza +2 settimane |

---

## 14. 4 TEMPLATE PDF — SPECIFICHE VISIVE

**NON modificare senza screenshot di riferimento aggiornati.**

| Preset | Font | Target | Caratteristica chiave |
|---|---|---|---|
| **Classico** | Inter | Artigiani, imprese | Header bianco, "PREVENTIVO" 26px a destra, table header scuro |
| **Bold** | Helvetica | Imprese, ristrutturazioni | Header dark full-width, badge pillola doc number, box "TOTALE DA PAGARE" |
| **Tecnico** | GeistSans | Elettricisti, idraulici, geometri | Strip 4 celle, colonna COD, totale sulla seconda riga voce |
| **Elegante** | Georgia | Consulenti, creativi, architetti | Logo bordato (non riempito), serif, doc number grande italic, no fill header table |

`safeAccentColor` è obbligatorio: se il colore brand è chiaro (luminosità > soglia), usa `#1a1a2e` per il testo — mai testo chiaro su sfondo bianco.

---

## 15. DEBITO TECNICO

| Voce | Priorità | Stato |
|---|---|---|
| AI import attivazione | Media | Chiavi vuote in prod — attivare quando pronto |
| PostHog / Flagsmith / Sentry | Bassa | Configurare chiavi in prod |
| INET → TEXT per `ip_address` | Bassa | Opzionale, non urgente |
| `referee_workspace_id` nullable | Bassa | Decisione aperta |
| Logo PNG nel PDF | Alta | Non testato con logo reale — da verificare |
| Email spam | Alta | Fix codice applicato (plain-text + no emoji). DNS da verificare. |

---

## 16. ROADMAP — DECISO MA RIMANDATO

| Feature | Note |
|---|---|
| Numerazione bozze separata | "Bozza 001" vs "Prev001/2026" — proposta non confermata. Migration + logica separata. |
| TASK 13 — Template preview consistency | Descrizione vaga. Non procedere. |
| SDI / fatturazione elettronica | Provider gestito, ~€0.10/fattura. Rimandato. |
| Team collaboration UI | DB pronto, manca UX inviti. |
| Portale cliente avanzato | Diverso da p/[token]. |
| Notifiche push mobile | — |
| Multi-lingua PDF | Fase 2. |
| Marketplace ATECO | Fase 3. |

---

## 17. COMMIT RECENTI RILEVANTI

```
83f1b89  fix(bugs): 7 bug fix — auth, PDF, numerazione, email, mobile         ← SESSIONE 13
a9ea4fe  fix(ux): tasks 29-45 — doc number prefix, template fields, CF dedup  ← pre-sessione 13
53b2c61  fix(ux): mobile fixes, auth email URL, fattura-da-preventivo          ← pre-sessione 13
58438b1  feat(preventivi): timeline always visible, link fattura, quota fix    ← pre-sessione 13
741ee8c  feat(preventivi): accepted→draft re-edit, DocumentTimeline            ← pre-sessione 13
d4dbddf  fix(ux): doc number prefixes, segna accettato, status dropdown        ← pre-sessione 13
92670ce  fix(ux): sollecito ripetibile, login hints, VociTable lg, dual-bar    ← SESSIONE 12
225c949  fix(ux): OAuth bfcache, login error hints, VociTable mobile, no kanban← SESSIONE 12
7ec389b  feat(ux): soft delete cestino + dashboard KPI fatturato               ← pre-sessione 12
3d671d3  fix(ux): hardcode prefixes + scadenze page + update overlay           ← pre-sessione 12
066dee1  feat(solleciti): last_reminder_at + email deliverability fixes        ← SESSIONE 11
356b9f3  fix(dashboard): split draft KPI preventivi + fatture                  ← SESSIONE 11
```

---

## 18. COMANDI UTILI

```bash
# Sviluppo
npm run dev

# Type check (OBBLIGATORIO prima di ogni commit)
npx tsc --noEmit

# Rigenerare tipi Supabase (dopo ogni migration)
npx supabase gen types typescript --project-id ivbzuhgwszkdnlsybsao > types/database.ts

# Build
npm run build

# Test
npm test

# Backup NAS
git push nas master

# Forzare rigenerazione PDF
GET /api/documents/[id]/pdf?force=1
```

---

## 19. CHECKLIST PER RIPRENDERE IL LAVORO

- [ ] Leggi questo file per intero (almeno sezioni A, B, C, D)
- [ ] `git log --oneline -5` — capire l'ultimo stato
- [ ] Verifica bug aperti in sezione A prima di iniziare nuovi task
- [ ] Prima di ogni modifica: capire la causa reale nel codice
- [ ] Dopo ogni modifica: `npx tsc --noEmit` + `npm run build` — entrambi verdi
- [ ] Aggiorna CLAUDE.md a fine sessione con formato sezione C
- [ ] Backup NAS + push origin prima di chiudere
