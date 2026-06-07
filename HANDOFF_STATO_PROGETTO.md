# HANDOFF — Stato progetto Carta Canta (recap della chat, giugno 2026)

> Riassunto di tutte le decisioni prese in chat, per orientare una nuova sessione o Claude Code dopo lo spostamento della cartella (da `C:\progetti\carta-canta` a `C:\Users\Public\carta-canta`).
> I documenti di dettaglio sono i `.md` elencati sotto.

## Obiettivo prodotto (bussola)
App "tutto in una mano" per **artigiani 20–70 anni, poco avvezzi alla tecnologia**, che non vogliono perdere tempo: preventivi, fatture, fattura elettronica, clienti, reminder, bilancio — tutto in un posto, **automatizzato, veloce, semplice, intuitivo**. Niente bloat. Far risparmiare ore.

## Documenti del progetto
- **`SPEC_NUOVE_FEATURE.md`** — piano feature + conformità legale (Appendici A/B/C) + ORDINE DI LAVORO (blocco ORA / blocco DOPO).
- **`MAPPA_APP.md`** — mappa del codice (route, server action, componenti, lib, schema) + 10 ottimizzazioni tecniche (OTT-1…10).
- **`REVISIONE_SCREENSHOT_2giugno2026.md`** — analisi delle 95 schermate: bug 🔴/🟠/🟡.
- **`BACKLOG_MIGLIORAMENTI.md`** — traccia di TUTTI i miglioramenti emersi dal codice (automazione, chiarezza, ergonomia, mobile, pulizie) con ordine di esecuzione e stato. **Punto di partenza per i prossimi prompt.**
- **Prompt per Code (uno alla volta):**
  - `PROMPT_01_TUTORIAL.md` — tutorial primo accesso (Driver.js).
  - `PROMPT_FIX_01_invio_stato_ripristino.md` — stato post-invio, 404 ripristino fattura, cliente perso in conversione.
  - `PROMPT_FIX_02_coerenza_fatture.md` — fatture che "parlano da preventivo" + avviso SdI.
  - `PROMPT_FIX_03_numerazione_prefisso.md` — prefisso "Prev", bozze, helper text.
  - `PROMPT_FIX_04_email_e_pagina_pubblica.md` — email "PDF allegato", email personale esposta, documento pubblico responsive.
  - `PROMPT_FIX_05_dashboard_microux.md` — KPI mese, empty state, conteggi, stato fattura in lista preventivi, microfix.
  - `PROMPT_FIX_06_condividi_link.md` — Condividi via WhatsApp/menu nativo + marcatura Inviato.
  - `PROMPT_FIX_07_rifiniture_coerenza.md` — residui non coperti: "Totale da pagare" sui preventivi (Bold), "Voci preventivo" nelle fatture, Q.tà catalogo, verifiche troncamento/logo.
  - `PROMPT_IMPROVE_app_velocita.md` — miglioramenti di velocità/semplicità dell'app attuale (oltre ai bug).
  - `PROMPT_IMPROVE_catalogo_autocomplete.md` — catalogo che cresce da solo + autocompletamento voci (la leva "risparmia-ore"). Da eseguire dopo FIX_07 + IMPROVE.

## Roadmap decisa (giugno 2026)
**ORA (in ordine):** 1) fix esistenti (FIX_01→05) → 2) tutorial + condividi link → 3) Bilancio + Pagamenti Fase 1 (segna pagato + IBAN/QR) + acconti → 4) Note→preventivo (MVP senza AI) + foto → 5) opzioni a livelli → 6) **SDI completo** (provider gestito) → 7) **recensioni SOLO cliente→artigiano** → 8) **Marketplace MVP** (in fondo, è grosso).
**DOPO (quando crescono i volumi):** recensioni artigiano→cliente (serve check legale una-tantum), pagamenti con carta (Stripe Connect Fase 2), interventi ricorrenti, backlog C.2.
**Chat preventivo:** SOSTITUITA dalla condivisione WhatsApp/email (A.6).

## Decisioni chiave
- **Pagamenti:** modello "bring your own" (IBAN/QR EPC, PayPal, Satispay) + "segna pagato"; il denaro non passa da noi. Carta/Google Pay via Stripe Connect = solo Fase 2, come perk Pro, senza nostra fee. Rendita = abbonamento, non commissioni.
- **SDI:** si può offrire ora SENZA commercialista, con avviso di trasparenza ("non è la e-fattura"); integrazione vera con provider API gestito (Aruba/OpenAPI/Acube…), non serve assumere un professionista.
- **Recensioni:** partire SOLO cliente→artigiano (basso rischio, no legale, rispettare Omnibus: solo recensioni verificate da lavori reali). Direzione artigiano→cliente congelata (persona privata = rischio GDPR/diffamazione) finché non si fa un check legale.
- **Marketplace:** costruire "DSA-safe" (T&C, Segnala+rimozione, disclaimer responsabilità).
- **Note→preventivo:** OCR foto con Mistral OCR; voce con AssemblyAI già integrato; etichetta "generato con AI" (AI Act).

## Da fare lato utente (NON codice) — promemoria
- **DMARC**: completare none → quarantine → reject (DNS/OVH).
- **ToS + Privacy Policy + Cookie banner**: con un generatore affidabile (es. iubenda), senza avvocato. Tutela di base come responsabile del trattamento.

## Pulizia
- Cartella vuota `_screens_tmp` (creata per convertire gli screenshot, non rimovibile dagli strumenti) — eliminala a mano.

## Stato bug principali (dagli screenshot) — confermati dall'utente
- Stato non si aggiorna dopo invio (fattura/preventivo).
- "Ripristina versione inviata" su fattura → 404 (redirect a /preventivi).
- Cliente sparisce nella conversione preventivo→fattura (CONFERMATO: dato non riportato).
- Email "PDF allegato" mentre l'allegato è stato tolto di proposito (testo da correggere).
