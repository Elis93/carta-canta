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
- [ ] **Monitoraggio errori**: attivare **Sentry** (gratis fino a 5k errori/mese) — oggi se l'app dà errore a un utente NON lo sappiamo
- [ ] **Uptime monitor**: es. UptimeRobot gratuito su cartacanta.app → avviso se il sito è giù
- [ ] **Analytics prodotto**: attivare **PostHog EU** (già predisposto) con 3 eventi chiave: registrazione → primo preventivo creato → primo preventivo INVIATO (= "attivazione")
- [ ] **Backup**: verificare i backup Supabase e **provare un ripristino** una volta (documentare come si fa)
- [x] **Anti-spam registrazioni** ✅ CABLATO (8 lug) — captcha Cloudflare Turnstile sul signup, disattivato finché non metti le chiavi. **DA FARE da Eli:** su dash.cloudflare.com → Turnstile crea un widget per cartacanta.app, poi metti `NEXT_PUBLIC_TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` su Vercel e fai Redeploy. (Utile soprattutto quando partono le ads.)
- [x] **Account demo** ✅ SCRIPT PRONTO (8 lug) — `npm run seed:demo` crea/ripristina `demo@cartacanta.app` (pw `CartaCanta-Demo-2026`, piano Pro) con idraulico + clienti + catalogo + 5 documenti + spese. Idempotente. **DA FARE da Eli:** lanciarlo una volta dal PC prima di inviare l'app al Play Store (istruzioni in `scripts/README.md`); cambiare la password se preferisci
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
- **Incentivo pilota**: `[DA COMPILARE: proposta — Pro gratis 12 mesi ai primi 15 + ascolto prioritario]`
- **Cosa chiedere dopo 2 settimane** (5 domande, per telefono o di persona):
  1. Sei riuscito a inviare un preventivo vero a un cliente vero? Dove ti sei bloccato?
  2. Cosa usavi prima (carta/Excel/altro)? Questa è più veloce o più lenta?
  3. C'è una cosa che ti aspettavi e non hai trovato?
  4. La useresti a €19/mese quando finisce la prova? Se no, a quanto?
  5. La consiglieresti a un collega? (sì/no e perché)
- **Criteri per passare alla Fase 2**: almeno `[DA COMPILARE: es. 8]` pilota attivi che hanno inviato ≥3 preventivi veri, e nessun bug bloccante aperto.

## 3. FASE 2 — Beta pubblica + Play Store (`[DATA]` → `[DATA]`)

- [ ] **Play Store**: decidere account Personale vs **Organizzazione** (consigliata: salta i 12 tester — vedi guida PDF), 25 $, materiali scheda (screenshot, descrizioni) `[DA COMPILARE]`
- [ ] **Referral attivo**: il sistema c'è già — promuoverlo ai pilota ("porta un collega")
- [ ] **Contenuti semplici**: 2-3 video da 60 secondi ("preventivo in 60 secondi dal telefono") girati col telefono — YouTube/TikTok/gruppi FB. Chi li fa: `[DA COMPILARE]`
- [ ] **SEO locale**: pagina landing per mestiere? (es. "preventivi per idraulici") — da valutare
- [ ] App resta **gratuita** (nessun incasso finché niente P.IVA)
- **Criterio per la Fase 3**: `[DA COMPILARE: es. 100 registrati, 40% attivati, retention >30%]`

## 4. FASE 3 — Lancio commerciale (`[DATA]`)

- [ ] P.IVA aperta + **Stripe live** (config portale già documentata in CLAUDE.md)
- [ ] Prezzi definitivi confermati: Free (8 preventivi) / Pro €`[19?]`/mese, €`[182?]`/anno
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

*Sezioni 5/5-bis integrate con la ricerca web dell'8 lug 2026 (fonti nel report in chat). Sezione 9: punti 1-4-5-6 implementati. Della checklist pre-spesa restano a Eli: video demo, email di benvenuto (in backlog Code), pagina FB/IG, casella supporto@, copy annunci.*
