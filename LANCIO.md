# 🚀 LANCIO.md — Piano di lancio di Carta Canta

> **Come usare questo file:** è il piano operativo del lancio, da compilare e spuntare.
> I campi `[DA COMPILARE]` li riempi tu (o li decidiamo insieme); le checkbox `[ ]` si spuntano man mano.
> Aggiornalo a ogni sessione: è la fonte di verità del lancio.
> *Creato il 7 luglio 2026. Bozza da integrare con la ricerca web di dettaglio (in coda).*

---

## 0. Stato attuale — cosa è già pronto

| Area | Stato |
|---|---|
| Prodotto (preventivi, fatture, clienti, catalogo, bilancio, sopralluoghi+agenda, acconti, pagamenti BYO, recensioni, marketplace, follow-up, AI import/scontrino) | ✅ Live |
| Sicurezza applicativa (RLS, header, rate limit, anti-injection) | ✅ Fatta |
| Testi legali (privacy/termini/informative/cancella-account) | 🟡 Bozze pronte, campi da compilare dopo ok avvocato |
| PWA installabile + service worker + offline | ✅ Fatta |
| Play Store | 🟡 Tecnica pronta; mancano account e materiali (vedi §1.3) |
| Fiscale (P.IVA) | 🟡 Ricerca fatta: beta gratuita finché non si incassa; nodo forfettario da commercialista |
| Email transazionali (Resend) | ✅ Attive · DMARC da alzare a quarantine |
| Test | ✅ 185/185 verdi, audit completo tasti/funzioni fatto |

---

## 1. PREREQUISITI per diventare operativi (da chiudere PRIMA del lancio pubblico)

### 1.1 Fiscale / societario
- [ ] Consulto col **commercialista** (domande pronte in `CartaCanta_Commercialista.pdf`)
- [ ] Decisione forma giuridica: `[DA COMPILARE dopo il consulto]`
- [ ] P.IVA: aprire SOLO prima di attivare i pagamenti. Data prevista: `[DA COMPILARE]`
- [ ] Regime scelto: `[DA COMPILARE: forfettario se possibile / semplificato]`

### 1.2 Legale
- [ ] Revisione avvocato dei testi (PDF `CartaCanta_Avvocato.pdf`)
- [ ] Compilare i campi gialli in Privacy/Termini: ragione sociale `[DA COMPILARE]`, P.IVA `[DA COMPILARE]`, foro `[DA COMPILARE]`, email privacy `[DA COMPILARE]`
- [ ] Creare caselle: `privacy@cartacanta.app` [ ] · `segnalazioni@cartacanta.app` [ ]

### 1.3 Operativo — **aspetti NON ancora coperti** (valutazione del 7 lug 2026)
Questi mancano del tutto e servono per essere "un'azienda", non solo un'app:

- [ ] **Supporto clienti**: casella `supporto@cartacanta.app` + voce **"Aiuto e contatti"** dentro l'app (oggi un utente in difficoltà non sa chi scrivere!) + 3-5 FAQ scritte. Tempo di risposta promesso: `[DA COMPILARE: es. 1 giorno lavorativo]`
- [x] **Monitoraggio errori** ✅ CABLATO (8 lug) — Sentry disattivato finché non metti la chiave. **DA FARE da Eli:** crea progetto su Sentry (gratis fino a 5k errori/mese), metti lo stesso DSN in `SENTRY_DSN` e `NEXT_PUBLIC_SENTRY_DSN` su Vercel, Redeploy.
- [ ] **Uptime monitor**: es. UptimeRobot gratuito su cartacanta.app → avviso se il sito è giù
- [x] **Analytics prodotto** ✅ CABLATO (8 lug) — PostHog EU disattivato finché non metti la chiave. Cattura pageview + click + evento `signup_completed` con le UTM. **DA FARE da Eli:** crea progetto su PostHog EU, metti `NEXT_PUBLIC_POSTHOG_KEY` su Vercel, Redeploy; poi costruisci il funnel registrazione → primo preventivo (da pageview /preventivi/nuovo e /preventivi/[id]).
- [ ] **Backup**: verificare i backup Supabase e **provare un ripristino** una volta (documentare come si fa)
- [x] **Anti-spam registrazioni** ✅ CABLATO (8 lug) — captcha Cloudflare Turnstile sul signup, disattivato finché non metti le chiavi. **DA FARE da Eli:** su dash.cloudflare.com → Turnstile crea un widget per cartacanta.app, poi metti `NEXT_PUBLIC_TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` su Vercel e fai Redeploy. (Utile soprattutto quando partono le ads.)
- [x] **Account demo** ✅ SCRIPT PRONTO (8 lug) — `npm run seed:demo` crea/ripristina `demo@cartacanta.app` (password letta da `DEMO_PASSWORD` in `.env.local`, MAI scritta nel repo — vedi regola B.1.2-bis; piano Pro) con idraulico + clienti + catalogo + 5 documenti + spese. Idempotente. **DA FARE da Eli:** lanciarlo una volta dal PC prima di inviare l'app al Play Store (istruzioni in `scripts/README.md`); cambiare la password se preferisci
- [ ] **Novità/changelog per gli utenti**: canale per dire "abbiamo aggiunto X" (anche solo email mensile)
- [ ] **Procedura data breach**: chi fa cosa nelle prime 72h (bozza nel PDF sicurezza) — referente: `[DA COMPILARE]`

---

## 2. FASE 1 — Beta privata con artigiani pilota (ORA → `[DATA FINE]`)

**Obiettivo:** 10–20 artigiani veri che usano l'app gratis e ci dicono cosa non va, PRIMA di farci conoscere pubblicamente.

- Target pilota: `[DA COMPILARE: quanti? es. 15]` artigiani, mestieri diversi (idraulico, elettricista, imbianchino…)
- **Dove trovarli** (in ordine di semplicità per te):
  - [ ] Conoscenze dirette tue/famiglia/amici: `[DA COMPILARE: nomi]`
  - [ ] Artigiani che hanno lavorato a casa tua/di conoscenti
  - [ ] Gruppi Facebook di categoria della tua zona: `[DA COMPILARE: quali gruppi]`
  - [ ] Fornitori/rivendite edili di zona (lasciare un volantino?): `[DA COMPILARE]`
- **Incentivo pilota** (ricerca 8 lug — vedi §10): **offerta ibrida consigliata** → 10-15 "Soci Fondatori" a invito, gratis durante la beta in cambio di uso reale + 1 call di feedback; annunciare da subito che al lancio sarà a pagamento ma i fondatori avranno **Pro a metà prezzo bloccato per sempre** + riconoscimento. NON "gratis a vita" pieno.
- **Cosa chiedere dopo 2 settimane** (5 domande, per telefono o di persona):
  1. Sei riuscito a inviare un preventivo vero a un cliente vero? Dove ti sei bloccato?
  2. Cosa usavi prima (carta/Excel/altro)? Questa è più veloce o più lenta?
  3. C'è una cosa che ti aspettavi e non hai trovato?
  4. La useresti a €19/mese quando finisce la prova? Se no, a quanto?
  5. La consiglieresti a un collega? (sì/no e perché)
- **Criteri per passare alla Fase 2**: almeno `[DA COMPILARE: es. 8]` pilota attivi che hanno inviato ≥3 preventivi veri, e nessun bug bloccante aperto.

## 3. FASE 2 — Beta pubblica + Play Store (`[DATA]` → `[DATA]`)

- [ ] **Play Store** (ricerca 8 lug — vedi §10): account **Organizzazione** consigliato SE apri/hai P.IVA ditta individuale (salta i 12 tester; chiedi il **D-U-N-S subito**, ~30gg) — altrimenti **Personale** con 12 tester × 14gg preparati in anticipo. 25$ una tantum. Scheda: primi 3 screenshot Valore→Uso→Fiducia, keyword artigiane in descrizione, 5-10 recensioni vere prima della spinta.
- [ ] **Referral attivo**: il sistema c'è già — promuoverlo ai pilota ("porta un collega")
- [ ] **Contenuti semplici**: 2-3 video da 60 secondi ("preventivo in 60 secondi dal telefono") girati col telefono — YouTube/TikTok/gruppi FB. Chi li fa: `[DA COMPILARE]`
- [ ] **SEO locale**: pagina landing per mestiere? (es. "preventivi per idraulici") — da valutare
- [ ] App resta **gratuita** (nessun incasso finché niente P.IVA)
- **Criterio per la Fase 3**: `[DA COMPILARE: es. 100 registrati, 40% attivati, retention >30%]`

## 4. FASE 3 — Lancio commerciale (`[DATA]`)

- [ ] P.IVA aperta + **Stripe live** (config portale già documentata in CLAUDE.md)
- [ ] Prezzi definitivi (ricerca 8 lug — vedi §10): il mercato target sta a **4-15€/mese**; **19€ è alto** finché l'SdI reale non è incluso. Proposta: Pro ~**9,90€/mese** (~89€/anno) al lancio; 19€ come prezzo futuro con SdI. Decidere al lancio coi dati PostHog. Free = 8 preventivi.
- [ ] Periodo di grazia per i beta user: `[DA COMPILARE: es. 3 mesi Pro gratis]`
- [ ] Attivare **SdI** (serve contratto provider OpenAPI + ok legale)
- [ ] Pagamento con carta nel link pubblico (Stripe Connect — perk Pro, fase 2 del piano pagamenti)
- [ ] Annuncio: email a tutti gli utenti + post nei canali usati in Fase 2

---

## 5. Canali per raggiungere gli artigiani (confermati dalla ricerca — 8 lug 2026)

Ordinati per rapporto costo/beneficio per questo target:

1. **Passaparola/referral strutturato** — il canale n.1 per i mestieri; il sistema referral è già nell'app: spingerlo ai pilota costa zero
2. **Gruppi Facebook di categoria** — community attive (es. "Elettricisti per passione"); partecipare come persona, rispondere a problemi veri, citare l'app solo se pertinente
3. **Contenuti verticali brevi** (Reels/TikTok/Shorts) — riusano le creatività delle ads; l'algoritmo li spinge anche senza follower
4. **CNA/Confartigianato (sede provinciale)** — convenzioni ai soci: canale grosso ma lento (6-12 mesi) e vorranno un interlocutore con P.IVA → avviare il contatto, non aspettarsi frutti subito
5. **Rivendite edili/grossisti** — volantino/QR alla cassa: funziona ma non scala, buono come test locale
6. **SEO/blog** ("come fare un preventivo edile") — rende a 6+ mesi
7. Fiere locali — solo se occasione comoda

`[DA COMPILARE: 3 canali su cui concentrarsi il primo mese]`

## 5-bis. SPONSORIZZATE SOCIAL (piano dalla ricerca — 8 lug 2026)

**Piattaforma: Meta (Facebook+Instagram).** È dove stanno gli artigiani 30-55; CPC 2-5€ vs 8-15€ di LinkedIn. TikTok: rimandare (target giovane, B2B acerbo). Google Search: piccolo affiancamento in fase 2 su keyword esatte ("app preventivi artigiani").

**⚠️ Decisione chiave — SENZA pixel all'inizio:** il Pixel Meta richiederebbe cookie banner con consenso preventivo (CMP, Linee guida Garante) che oggi NON abbiamo (il sito usa solo cookie tecnici = niente banner). Soluzione pulita per il test:
- **Campagna Lead Ads con modulo nativo** (la conversione avviene dentro Facebook: zero pixel, zero banner) → email automatica col link di registrazione
- **+ campagna Traffico verso la landing con UTM** (le UTM non sono tracker: si contano le registrazioni nel database per fonte)
- CMP + Pixel + CAPI solo in fase 2, quando i volumi giustificano l'ottimizzazione a conversione

**Test consigliato:** 300 € su 14 giorni (Lead Ads ~15€/g + Traffico ~5-7€/g), UNA campagna per ramo, pubblico Italia 28-55 ampio + interessi seme (edilizia, ristrutturazioni, P.IVA, admin pagine business), Advantage+, NIENTE targeting locale. Non toccare per 7 giorni.
- KPI stop/go: CPL modulo < 6 € · costo/registrazione < 12 € · ≥30% dei registrati crea un preventivo

**Creatività (fai-da-te col telefono):** 2-3 video verticali 20-40s con sottotitoli — (1) demo "preventivo fatto dal furgone in 60 secondi", (2) testimonianza di un beta tester vero (nome, mestiere, città, consenso scritto), (3) problema→soluzione con la voce della fondatrice + 2 statici screenshot. Stile spontaneo/UGC batte il patinato.

**Claim a norma (microimprese = tutela come consumatori, AGCM):**
- ✅ "Gratis durante la beta" · "Chi entra ora avrà condizioni riservate"
- ❌ "Gratis per sempre" · "fattura elettronica inclusa" (finché SdI non è live) · "a norma di legge/sostituisce il commercialista" · numeri inventati · nascondere che è una beta

**Checklist PRIMA di spendere 1 €:**
- [x] Landing dedicata `/prova` ✅ FATTA (8 lug) — 1 claim, 1 CTA "Provala gratis", 3 passi, proof, FAQ, mobile-first. Manca solo il VIDEO demo (da girare da Eli, si incorpora dopo)
- [x] **UTM salvate alla registrazione** ✅ FATTO (8 lug) — first-touch in sessionStorage → user_metadata alla signup. Conteggio per fonte: query su auth.users (raw_user_meta_data->>'utm_source')
- [x] **Email di benvenuto** ✅ FATTA (8 lug) — parte alla conferma email (primo accesso vero); guida al primo preventivo, contatto supporto@, zero emoji. Resta da fare: email automatica per i lead dei moduli Lead Ads (si imposta in Meta o con un piccolo webhook quando parte la campagna)
- [ ] Pagina Facebook/Instagram curata (bio, 5-6 post) — l'artigiano controlla il profilo prima di fidarsi
- [ ] Casella supporto@ attiva e presidio risposte
- [ ] Copy annunci validato sulla lista claim qui sopra
- [ ] KPI stop/go scritti prima di partire

## 6. Metriche del lancio (poche e chiare)

| Metrica | Definizione | Obiettivo Fase 2 |
|---|---|---|
| **Attivazione** | % registrati che INVIANO il 1° preventivo entro 7 giorni | `[DA COMPILARE: es. 40%]` |
| **Retention 4 sett.** | % attivati ancora attivi dopo 4 settimane | `[DA COMPILARE: es. 30%]` |
| **Preventivi/utente/mese** | mediana degli attivi | `[DA COMPILARE]` |
| **Free→Pro** (Fase 3) | % che paga entro 30gg dal limite | `[DA COMPILARE: es. 5%]` |
| **NPS pilota** | "lo consiglieresti?" | `[DA COMPILARE]` |

Strumento: PostHog EU (gratis fino a 1M eventi/mese) — da attivare (§1.3).

## 7. Budget e tempi

| Voce | Costo | Quando |
|---|---|---|
| Google Play Console | 25 $ una tantum | Fase 2 |
| Vercel Pro + Supabase + Resend + Upstash | attuali `[DA COMPILARE €/mese]` | già attivi |
| AI (Mistral/OpenAI) | tetto ~€10-15/mese impostato | già attivo |
| Revisione avvocato mirata | ~`[300-800€?]` una tantum | Fase 1-2 |
| Commercialista | `[DA COMPILARE]` | Fase 1 (consulto) / Fase 3 (gestione) |
| Marketing | ~0 € (canali organici) | — |

## 8. Errori da evitare (solo-founder)

- Lanciare "in grande" senza pilota: prima 15 artigiani veri, poi il mondo.
- Costruire nuove funzioni invece di parlare con gli utenti: in Fase 1-2 il tempo va 70% ad ascoltare/sistemare, 30% a costruire.
- Prezzi decisi al buio: chiedere ai pilota (domanda 4 del questionario).
- Monetizzare prima della P.IVA: mai (vedi ricerca fiscale).
- Ignorare il supporto: una risposta rapida a un artigiano vale più di una feature.
- Fare tutto insieme: una fase alla volta, coi criteri di passaggio scritti qui sopra.

---

## 9. Migliorie prodotto per il vero "ufficio in tasca" (valutazione 7 lug 2026)

Cosa manca/è poco profondo rispetto ai leader (Jobber, ServiceM8, Tradify) — ordinato per impatto sull'artigiano singolo:

| # | Miglioria | Cosa dà | Priorità |
|---|---|---|---|
| 1 | **Gestione Lavori (commesse)** — dal preventivo accettato nasce un "Lavoro" con stati (da iniziare / in corso / finito / fatturato), note, foto, materiali | Oggi il ciclo si ferma ad "accettato→fattura": manca il pezzo centrale della giornata dell'artigiano | 🔴 ALTA |
| 2 | **Agenda completa** — vista calendario settimana con TUTTI gli impegni (sopralluoghi + lavori), non solo la lista dei prossimi | L'agenda è il cuore dell'ufficio in tasca | 🔴 ALTA |
| 3 | **Rapportino di fine lavoro firmato** ✅ FATTO (8 lug) — a lavoro finito/fatturato, card sul dettaglio Lavoro → link pubblico `/r/[token]` → il cliente firma sul telefono (FES: nome+IP+UA+timestamp, come i preventivi) | Prova del lavoro consegnato = meno contestazioni | 🔴 ALTA |
| 4 | **"Sto arrivando"** — messaggio WhatsApp precompilato dall'appuntamento (orario stimato) | Professionalità percepita altissima, costo minimo | 🟡 MEDIA-ALTA |
| 5 | **Margine per lavoro** — collegare le spese del Bilancio al singolo lavoro: preventivato vs speso vs guadagnato | Risponde a "ci ho guadagnato davvero?" | 🟡 MEDIA |
| 6 | Contratti di manutenzione / fatture ricorrenti (caldaie, condizionatori) | Utile per alcuni mestieri, non per tutti | 🟢 MEDIA-BASSA |
| 7 | Ore lavorate (timesheet) sul lavoro | Per chi fattura a ore | 🟢 BASSA |
| 8 | Offline completo in cantiere (bozze senza rete) | Il SW attuale copre la velocità; l'offline vero è un progetto grosso | 🟢 BASSA (rivalutare) |

`[DA DECIDERE: quali fare prima del lancio pubblico? Consiglio: 1+2 (Lavori+Agenda) come blocco unico, poi 3 e 4 che sono piccole]`

---

*Sezioni 5/5-bis integrate con la ricerca web dell'8 lug 2026 (fonti nel report in chat). Sezione 9: punti 1-4-5-6 implementati. Della checklist pre-spesa restano a Eli: video demo (NotebookLM), pagina FB/IG, casella supporto@, copy annunci.*

---

## 10. Ricerche di mercato (8 lug 2026) — sintesi per le decisioni aperte

*Ricognizioni web, NON pareri. Fonti complete nel report in chat.*

**A. Cancellazione account vs conservazione fatture (GDPR).** Il diritto all'oblio (art. 17 GDPR) NON è assoluto: cede davanti all'obbligo di legge (art. 17.3.b + art. 2220 c.c. = fatture 10 anni). L'obbligo di conservare le fatture è del **titolare P.IVA (l'artigiano)**; noi siamo responsabile del trattamento. → Flusso: cancella subito account/login/marketing/analytics/foto/bozze/preventivi non convertiti; trattieni le **fatture + dati minimi 10 anni** in archivio congelato (solo fini fiscali, no marketing). Formulazione UI e campi minimi da far validare all'avvocato. **Code può costruirlo su questa logica.**

**B. Prezzi.** Mercato target artigiani/forfettari = **4-15€/mese** (Fatture in Cloud: forfettari 4€, standard 12€ con SdI incluso; PreventivAI mobile ~9,90€). **19€/mese è alto** finché l'SdI reale non è incluso. Proposta lancio: Pro ~**9,90€/mese (~89€/anno)**; 19€ come prezzo futuro con SdI. Non urgente: prezzo si fissa al lancio commerciale coi dati di attivazione (PostHog).

**C. Play Store — account.** **Organizzazione** consigliato se apre/ha P.IVA ditta individuale: salta il requisito 12 tester × 14gg (in vigore per gli account Personali post-nov 2023), dà più fiducia. Serve **D-U-N-S** (gratis, ~30gg → chiederlo subito) + P.IVA. Altrimenti **Personale** con 12 tester (primi artigiani) organizzati 2 settimane prima. 25$ una tantum entrambi. **Scheda:** primi 3 screenshot Valore→Uso→Fiducia, keyword artigiane in descrizione (ASO), 5-10 recensioni vere prima della spinta; conta più retention che download.

**D. Incentivo pilota.** **Offerta ibrida** (non gratis-a-vita): 10-15 "Soci Fondatori" a invito (scarsità = valore), gratis durante la beta in cambio di uso reale + 1 call di feedback; annunciare da subito che al lancio sarà a pagamento ma i fondatori avranno **Pro a metà prezzo bloccato per sempre** + riconoscimento (muro fondatori). Evita la "trappola dello zero" e i costi perenni del gratis-a-vita.

---

## 11. Marketplace — come attrarre il lato domanda (ricerca 9 lug)

*Chi cerca un artigiano (privati/aziende) come scopre la vetrina `/professionisti`. Ricognizione, non consulenza.*

**Lezioni chiave.** (1) I marketplace vincenti risolvono l'uovo-e-gallina con lo **"strumento prima, vetrina dopo"** (OpenTable, GrubHub) — Carta Canta è già così, è un vantaggio. (2) In Italia la domanda si costruisce con **SEO locale programmatica** ("mestiere + città", es. ProntoPro ~60% del traffico da SEO), non con la TV (Instapro, costosa). (3) La SEO locale rende in **3-6 mesi**, lenta ma economica. (4) **L'artigiano stesso porta la domanda**: ogni preventivo/recensione inviato ai suoi clienti espone il brand (flywheel di Jobber/Housecall Pro).

**Piano a fasi.**
- **ORA (budget ~0):** footer discreto "Fatto con Carta Canta" sui documenti pubblici (già presente sul Free); profili `/professionisti` ben indicizzati (URL puliti + schema.org LocalBusiness — TODO code); concentrarsi su **1 città + pochi mestieri** con densità di artigiani; attivare il ciclo recensioni→visibilità (già nel prodotto).
- **FASE 2 (offerta sufficiente):** pagine SEO automatiche mestiere+città (es. `/idraulico/torino`) popolate dagli artigiani reali; **Google Ads locali** su query urgenti.
- **DA EVITARE ora:** TV/brand advertising, espansione multi-città nazionale, far pagare i lead — costoso o prematuro.

**Quando passare a Fase 2:** ~20-30 artigiani attivi per città/mestiere · visite organiche non-brand sulle pagine · richieste inbound dal marketplace in crescita mese/mese.

*Fonti: a16z The Cold Start Problem · Lenny Rachitsky · caso ProntoPro (mariosantella.com) · Il Sole 24 Ore (Instapro) · Housecall Pro / Jobber / Backlinko. Dettaglio nel report in chat.*

---

## 12. Canale COMMERCIALISTI — come renderli un motore di acquisizione (ricerca 9 lug)

*I commercialisti hanno tanti clienti artigiani e sono fidati → canale potente per l'offerta. Ricognizione, non consulenza.*

**⚠️ VINCOLO DEONTOLOGICO (verificato):** il Codice Deontologico dei commercialisti (agg. nov 2025) **VIETA le retrocommissioni** — non si può pagare il commercialista per portare clienti a un software (anche via accordi occulti col fornitore), pena sanzioni fino alla radiazione. Quindi l'idea "gli riconosco una % se mi porta gli artigiani" NON è percorribile. **Lecito invece:** licenza studio gratuita, **sconti/benefici ai suoi CLIENTI** (non a lui), co-marketing trasparente/informativo.

**Modello che funziona (Fatture in Cloud, TeamSystem):** non paghi il commercialista, gli togli il dolore n.1 (raccogliere i documenti dai clienti). **È il cliente che invita il suo commercialista** → account studio **gratuito in sola lettura** che scarica da sé le fatture del cliente. Un commercialista soddisfatto porta 10-30 artigiani spontaneamente.

**Cosa integrare (prioritizzato):**
- **MVP (ora, anche senza SdI):** (1) "Invita il commercialista" — email studio → accesso read-only ai documenti di quel cliente; (2) **export ordinato** CSV/Excel fatture+incassi per periodo + ZIP PDF, colonne da prima nota (data, numero, imponibile, IVA per aliquota, totale) — estende l'export CSV bilancio esistente. Pagina "Il mio commercialista" in Impostazioni.
- **Fase 2 (dopo SdI):** cruscotto multi-cliente per lo studio; export **XML FatturaPA** (formato che quasi tutti i gestionali importano); tracciato CSV per TeamSystem/Zucchetti.
- **Evitare ora:** integrazioni API dirette coi gestionali di studio (Lynfa/Polyedro), prima nota/partita doppia, provvigioni al commercialista.

**Programma lecito:** ORA in beta = account studio gratis + eventuale beneficio ai CLIENTI che registra (mesi Pro gratis all'artigiano). AL LANCIO = licenza studio sempre gratuita come amo, si monetizza sull'artigiano; mai provvigioni al commercialista.

**Domande per Stefano (validazione):** (1) quale export = "compatibile con lo studio" (XML SdI / CSV / tracciato del suo gestionale)? (2) accesso read-only o pacchetto periodico? quali campi per la prima nota? (3) cosa lo spinge a consigliare un software e cosa è off-limits? (4) un cruscotto multi-cliente serve davvero o basta l'export per cliente?

*Fonti: Fatture in Cloud (commercialista connesso) · TeamSystem Studio · Danea commercialisti · Agenda Digitale · Commercialista Telematico + Codice Deontologico CNDCEC 2025 (divieto retrocommissioni). Dettaglio nel report in chat.*

---

## 12-bis. MAPPA D'INTEGRAZIONE COMMERCIALISTI (definitiva — doppia ricerca 9 lug, verificata)

*Sintesi di 2 ricerche approfondite: (1) esigenze reali degli studi (flussi forfettario/semplificata, formati d'import, errori che li fanno arrabbiare, normativa) e (2) analisi funzione-per-funzione dei competitor (FIC, TeamSystem, Danea, Aruba, Zucchetti, QuickBooks, Xero).*

### ⚠️ PREMESSA NORMATIVA (verificata su più fonti — cambia le priorità)
Dal **1° gennaio 2024 l'obbligo di fattura elettronica via SdI vale per TUTTI i forfettari e minimi** (sanzioni 250–2.000 € per fattura non elettronica). Conseguenza: **le "fatture" PDF di Carta Canta oggi valgono solo come copia di cortesia/proforma** — la fattura fiscale l'artigiano la emette altrove finché il nostro SdI non è live. I **preventivi** invece non hanno alcun obbligo (restano il cuore legittimo dell'app, insieme a incassi/spese/lavori). → **L'SdI (blocco 7, già pronto nel codice, bloccato su credenziali OpenAPI di Eli) è il must-have n.1** sia per il canale commercialisti sia per la piena legalità del modulo fatture. Nel frattempo: valutare copy in-app che non prometta valore fiscale della fattura PDF (da vedere con l'avvocato).

### Cosa vuole DAVVERO lo studio (dai flussi reali)
- **Forfettario** (il nostro target principale): lavora **per cassa** → allo studio serve **l'INCASSATO con le date** (non l'emesso), 1 volta l'anno + bollo trimestrale. Niente registri IVA.
- **Semplificata**: fatture attive+passive ogni mese/trimestre; molti studi usano il criterio del "registrato".
- **Import universale**: l'**XML FatturaPA** è il formato che tutti i gestionali di studio (TeamSystem, Zucchetti, Wolters Kluwer) importano in automatico. Il CSV va bene se ha colonne mappabili: data, numero, cliente+P.IVA/CF, imponibile, IVA/natura, bollo, totale, **data incasso**.
- **Errori che odiano**: natura IVA sbagliata (N2.1 vs N2.2), bollo dimenticato (sanzione 25%), numerazione incoerente, email disordinate. (Il nostro motore fiscale già gestisce N2.2/bollo/dicitura ✓)

### LA MAPPA — 3 fasi

**FASE A — ✅ FATTA (9 lug, stessa sessione della mappa):**
- **A1. Export "Pacchetto commercialista"**: CSV **registro fatture emesse per periodo** con le colonne da prima nota — data emissione (`sent_at`, fallback data creazione, dichiarato nel file), numero, cliente, P.IVA/CF, **imponibile netto sconti** (calcolato: `subtotal` a DB è pre-sconto), IVA, bollo, totale, stato incasso, **totale incassato + data ULTIMO incasso** — separatore ";", BOM, anti-injection. Modello "consegna file" alla Danea: l'artigiano lo scarica e lo manda al suo commercialista. Insieme all'export Bilancio (entrate/uscite per cassa) copre il fabbisogno annuale del forfettario.
- **Limiti dichiarati (dalla verifica adversariale):** il modello dati ha UNA sola coppia `paid_at/paid_amount` per fattura (gli acconti si cumulano sovrascrivendo la data) → il CSV espone "totale incassato / data ultimo incasso", NON un registro incassi movimento-per-movimento; per quello servirà tracciare i singoli incassi (fase futura, con acconto+saldo in anni diversi il per-cassa puro richiede i movimenti). Il **ciclo passivo** (fatture d'acquisto) è fuori scope (le `expenses` sono spese manuali senza XML/IVA). **Numerazione:** le bozze cancellate lasciano buchi by design — rischio noto col canale studi, domanda già nel PDF commercialista.

**FASE B — ✅ FATTA (9 lug):**
- **B1. "Il tuo commercialista"** (card in Impostazioni › Generale): l'artigiano inserisce l'email dello studio → invito email (`AccountantInviteEmail`, no emoji) + link attivo. Lista degli invitati con stato (Collegato / Invito inviato) e revoca in un tocco. Rate-limit 10 inviti/ora per workspace.
- **B2. Area `/studio` in SOLA LETTURA** per il commercialista: si registra/accede gratis con l'email invitata → griglia dei clienti che l'hanno invitato → per cliente: KPI (Fatturato/Incassato) + elenco fatture con stato incasso + download del Pacchetto A1 (`/api/studio/[id]/export`). Layout dedicato (non la shell dell'artigiano). Multi-cliente gratis per lo studio.
- **B3. Sicurezza implementata:** tabella `accountant_links` (migration 051) con **RLS abilitata SENZA policy** → raggiungibile solo dal service role. NON riusa `workspace_members`. `lib/studio.ts`: `getStudioUser()` richiede `email_confirmed_at`; `assertAccountantAccess(user, wsId)` verifica SEMPRE il link attivo (match email esatto lowercased — NO `ilike` per evitare i wildcard `_`/`%`; `revoked_at IS NULL`) prima di restituire il workspace → **mai fidarsi del solo parametro URL** (IDOR bloccato). Revoca con effetto immediato (check per-request). Azioni artigiano (`lib/actions/accountant.ts`) solo dopo verifica proprietario del workspace. Validato su PG16 (7 test: unique case-insensitive, revoca, re-invito, IDOR, cascade, RLS). **GDPR (TODO Eli/avvocato):** il commercialista è un nuovo destinatario dei dati → aggiornare privacy policy + punto nel PDF avvocato.

**FASE C — dopo SdI live:**
- **C0. Note di credito (TD04)** — ⏸️ in attesa (decisione Eli 19 lug): storno totale/parziale di una fattura trasmessa, con trasmissione ed esito SdI. Struttura dati quasi pronta; sblocca con la risposta del commercialista sulla numerazione (serie vs sezionale). Progetto: `PROGETTO_NOTE_CREDITO.md`.
- **C1. Export XML FatturaPA massivo** (ZIP per periodo) — l'import universale degli studi.
- **C2.** Stati SdI nel cruscotto studio + promemoria bollo trimestrale (F24 codici 2521-2524; per sanzioni/interessi esistono anche 2525/2526).
- **C3.** Tracciato TeamSystem/standard AssoSoftware solo se richiesto dai primi studi veri.

**NON FARE:** API dirette coi gestionali di studio (onerose), prima nota/partita doppia (siamo "a monte"), provvigioni al commercialista (vietate dal codice deontologico, art. 14 c.7), conservazione a norma propria (per le fatture SdI basta il servizio gratuito AdE — che però richiede ADESIONE esplicita dell'artigiano sul portale Fatture e Corrispettivi: da spiegare in una FAQ; e la card SdI in-app promette già "conservazione inclusa" via OpenAPI — tenere coerenti i due messaggi).

### Priorità operativa
1. **Eli**: sbloccare l'SdI (registrazione OpenAPI + contratto da far vedere all'avvocato) — è il vero cancello.
2. **Code**: FASE A ✅ → FASE B ✅ → FASE C quando l'SdI è live.
