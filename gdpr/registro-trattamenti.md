# Registro dei trattamenti — Carta Canta

> ⚠️ BOZZA. Obbligo ai sensi dell'art. 30 GDPR. È un documento **interno** (non si pubblica):
> va conservato e mostrato al Garante solo se richiesto. Compila i `[PLACEHOLDER]` e tienilo
> aggiornato quando cambi fornitori o finalità.
> Ultimo aggiornamento: [DATA].
>
> ---
>
> ## 🔴 ATTENZIONE (6 agosto 2026): questo registro NON è aggiornato — non usarlo così com'è
>
> È rimasto fermo a giugno, mentre il prodotto è andato avanti. **Oggi dichiara cose non vere**
> e questo, in un documento che si mostra al Garante, è peggio del non averlo compilato:
>
> - dice che *"la funzione di estrazione AI è attualmente disabilitata in produzione"*: è
>   **attiva** da settimane (lettura dei listini, preventivo dalle foto, foto dello scontrino),
>   e l'informativa pubblica la dichiara agli utenti;
> - **mancano trattamenti interi** nati dopo: foto dei lavori, firme del cliente sui preventivi
>   e sui rapportini, recensioni, richieste dalla vetrina pubblica, verifica della partita IVA
>   (VIES e Registro Imprese tramite Openapi), statistiche d'uso con consenso (PostHog),
>   registro degli eventi di sicurezza;
> - **mancano fornitori** che oggi sono responsabili del trattamento a tutti gli effetti:
>   Openapi S.p.A., PostHog, Sentry, Cloudflare;
> - i `[PLACEHOLDER]` (ragione sociale, P.IVA, sede, email privacy) non sono mai stati compilati
>   perché dipendono da una decisione che Eli non ha ancora preso.
>
> **La versione attendibile di cosa trattiamo e con chi** è l'informativa pubblicata:
> `app/(legal)/privacy/page.tsx` (§2-bis dati trattati, §3 finalità e basi giuridiche,
> §5 fornitori, §5-bis cookie e statistiche). Da lì si ricostruisce il registro in mezz'ora.
>
> **Va rifatto insieme all'avvocato**, nella stessa occasione in cui si sciolgono i campi
> gialli dell'informativa — è annotato in `COSE_DA_FARE_ELI.md` §2. Fino ad allora questo file
> resta qui solo perché il registro art. 30 non sparisca del tutto dal repository.

## Titolare del trattamento

- [RAGIONE SOCIALE] — P.IVA [P.IVA] — [SEDE] — [EMAIL PRIVACY]

---

## Trattamento 1 — Gestione account e utenti del servizio

| Campo | Valore |
|---|---|
| Finalità | Registrazione, autenticazione ed erogazione del servizio agli utenti (artigiani) |
| Categorie di interessati | Utenti registrati (titolari di account) |
| Categorie di dati | Email, password cifrata, ragione sociale, P.IVA/CF, indirizzo, regime fiscale, codici ATECO, logo |
| Base giuridica | Esecuzione del contratto (art. 6.1.b) |
| Conservazione | Durata del rapporto + [X] mesi/anni |
| Responsabili esterni | Supabase/AWS (DB), Vercel (hosting) |
| Trasferimenti extra-UE | No (dati in UE) |
| Misure di sicurezza | RLS, cifratura at-rest/in-transit, 2FA accessi admin, log accessi |

## Trattamento 2 — Dati dei clienti finali inseriti dagli utenti

| Campo | Valore |
|---|---|
| Finalità | Creazione e invio di preventivi/fatture per conto dell'utente |
| Ruolo | **Responsabile** del trattamento (titolare = l'utente artigiano) |
| Categorie di interessati | Clienti finali degli artigiani |
| Categorie di dati | Nome/ragione sociale, indirizzo, email, telefono, P.IVA/CF, importi |
| Base giuridica | Definita dal titolare (l'artigiano); noi trattiamo su sua istruzione |
| Conservazione | Secondo istruzioni del titolare; documenti fiscali fino a 10 anni |
| Responsabili esterni (sub-responsabili) | Supabase/AWS, Vercel, Resend (email) |
| Misure di sicurezza | Come sopra + link pubblico con token casuale 128 bit |

## Trattamento 3 — Pagamenti e abbonamenti

| Campo | Valore |
|---|---|
| Finalità | Gestione abbonamenti, fatturazione del servizio |
| Categorie di dati | Dati di fatturazione; **i dati di carta sono gestiti da Stripe** (non li conserviamo) |
| Base giuridica | Esecuzione del contratto (art. 6.1.b); obblighi fiscali (art. 6.1.c) |
| Conservazione | Obblighi fiscali (in genere 10 anni) |
| Responsabili esterni | Stripe |
| Trasferimenti extra-UE | Sì (Stripe USA) — garanzie: SCC / Data Privacy Framework |

## Trattamento 4 — Email transazionali e comunicazioni

| Campo | Valore |
|---|---|
| Finalità | Invio email di servizio (verifica, reset password, invio preventivi al cliente) |
| Categorie di dati | Email, contenuto del documento, nome destinatario |
| Base giuridica | Esecuzione del contratto (art. 6.1.b) |
| Responsabili esterni | Resend |
| Trasferimenti extra-UE | Sì (Resend USA) — garanzie: SCC / Data Privacy Framework |

## Trattamento 5 — Sicurezza, log e prevenzione abusi

| Campo | Valore |
|---|---|
| Finalità | Sicurezza, rate limiting, prevenzione frodi/abusi, tracciamento aperture link |
| Categorie di dati | Indirizzo IP, user agent, timestamp di accesso/apertura |
| Base giuridica | Legittimo interesse (art. 6.1.f) |
| Conservazione | [es. 12 mesi] |
| Responsabili esterni | Upstash (rate limiting), Supabase |

## Trattamento 6 — Funzioni AI (vocale / estrazione da foto) — _se attive_

| Campo | Valore |
|---|---|
| Finalità | Dettatura vocale delle voci; estrazione dati da foto/PDF |
| Categorie di dati | Audio/immagini caricate dall'utente e relativo contenuto |
| Base giuridica | Esecuzione del contratto (art. 6.1.b) |
| Responsabili esterni | AssemblyAI; [OpenAI / Mistral] |
| Trasferimenti extra-UE | Sì (USA) — garanzie: SCC / Data Privacy Framework |
| Nota | La funzione di estrazione AI è attualmente disabilitata in produzione |
