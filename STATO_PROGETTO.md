# STATO PROGETTO — Carta Canta

> Unione di _RIPARTI_DA_QUI.md + MORNING_BRIEFING.md + HANDOFF_STATO_PROGETTO.md (consolidamento 14 giu 2026).


<!-- ===== da _RIPARTI_DA_QUI.md ===== -->
# _RIPARTI_DA_QUI — istruzioni di ripartenza per l'assistente (Cowork/Dispatch)

> Eli incolla "Leggi `_RIPARTI_DA_QUI.md` e dimmi a che punto siamo" all'inizio di ogni sessione.
> Questo file dice all'assistente come riprendere il lavoro su **Carta Canta** senza spiegazioni ripetute.

## Cosa devi fare, assistente, appena leggi questo file
1. **Leggi in quest'ordine** (nella cartella del progetto `C:\Users\Public\carta-canta`):
   - la tua **memoria** (regole di lavoro + contesto, caricata automaticamente);
   - `HANDOFF_STATO_PROGETTO.md` — indice e roadmap;
   - `DECISIONI_E_FEEDBACK.md` — **fonte di verità** dei feedback/decisioni di Eli con stato (✅ bloccato / ⏳ da fare / 🔁 superato). **Non annullare le voci ✅.**
   - `BACKLOG_MIGLIORAMENTI.md` — elenco miglioramenti/fix con ordine e stato (sez. G/H = feedback da test);
   - `CLAUDE.md` — memoria tecnica e handoff delle sessioni di Claude Code (sezione A in cima = ultima sessione);
   - i file `PROMPT_FIX_*` e `PROMPT_IMPROVE_*` pertinenti al prossimo passo.
2. **Controlla lo stato reale del codice** con `git log --oneline -5` per vedere l'ultimo commit/fix applicato.
3. **Riassumi a Eli in poche righe**: dov'eravamo, cosa è stato fatto per ultimo, e qual è il **prossimo passo** secondo l'ordine del backlog. Poi **chiedi conferma** prima di procedere.

## Ruoli e flusso (non cambiarli)
- **Io (assistente in Cowork) pianifico e verifico**; **Claude Code implementa**. Preparo prompt "blindati" (cosa/come/dove, niente interpretazioni) che Eli incolla in Claude Code; poi **verifico io nel codice reale** il risultato.

## Le 4 regole fisse (valgono sempre)
1. La frase/blocco **da incollare a Code va SEMPRE in fondo** al messaggio.
2. Alla **fine di ogni fase di Code, verifico nel codice reale** che tutto sia stato modificato correttamente (non mi fido del solo riepilogo).
3. Nei messaggi di fix, **prima del blocco da incollare** metto un **riassunto "cosa testare"**.
4. Quando Eli incolla l'output di Code, **se emerge un'azione manuale a suo carico** (migration su Supabase, variabile su Vercel, push NAS da `moian`, DNS, ecc.) **glielo segnalo in fondo**, evidenziato (lui non legge i messaggi di Code).

## Fatti operativi
- Percorso progetto: `C:\Users\Public\carta-canta` (spostato da `C:\progetti\carta-canta`).
- Deploy: `git push` (origin → Vercel, ~1-3 min, https://cartacanta.app). Backup NAS `git push nas master` funziona **solo con l'utente `moian`** (con `elisa` fallisce).
- Ordine di lavoro: vedi `BACKLOG_MIGLIORAMENTI.md` → "ORDINE DI ESECUZIONE CONSIGLIATO".
- Da fare lato Eli (non codice): DMARC e ToS/Privacy/Cookie (iubenda).


<!-- ===== da MORNING_BRIEFING.md ===== -->
# ☀️ BRIEFING DEL MATTINO — sessione notturna (per Eli)

> Riepilogo di cosa ho fatto stanotte e cosa fare al risveglio. Tutto è pronto da incollare a Code.

## ⚠️ Premessa onesta
Da Cowork **non posso fare `git push`** (mancano le credenziali GitHub in questo ambiente: i push li fa Code dal tuo PC). Non posso nemmeno far girare build/test in modo affidabile. Quindi **non ho toccato il codice di produzione** — sarebbe stato codice non testato e non pushabile, cioè a rischio di perdita (proprio ciò che evitiamo). Ho invece fatto la cosa di massimo valore e a rischio zero: **verificato l'ultimo lavoro, diagnosticato i bug rimasti, e lasciato pronti i prompt** (file su disco che Code esegue e pusha). Così stamattina sei subito operativa.

## ✅ Cosa ho verificato
- **FIX-13** (commit `815c823`) — verificato nel codice, **corretto**: testo email "scrivimi a {email}"; `?send` rimosso dall'URL (niente popup al reload); `Input` ora `forwardRef` + tendina suggerimenti con `PopoverAnchor`/`onInteractOutside` (approccio giusto); "Importa da preventivo" sempre visibile; guardia server che blocca l'invio senza voci complete.
  - 🟡 **Da confermare nel tuo test**, soprattutto i **suggerimenti cliente (T-18)**: erano già stati dati per risolti una volta e poi non funzionavano. Controllali bene.

## 🔍 Cosa ho diagnosticato (bug/cause trovate stanotte)
- **T-21a [BUG]** — l'avviso "Nessun template disponibile" è **fuorviante**: il template Classico è sempre disponibile, il documento si genera comunque. Va tolto/ammorbidito. (Solo nei preventivi, non nelle fatture.) → `PROMPT_FIX_14`.
- **T-9 / T-22 [lentezza]** — l'errore-poi-ok-dopo-20s è un **cold start di Vercel**; `comuni.ts` e le deps PDF NON sono la causa (non sono nel bundle delle pagine). Va misurato e poi ottimizzato (parallelizzare query, warm-ping). → `PROMPT_PERF_01`.
- **MOB-3 [rischio]** — in **creazione** preventivo non c'è autosalvataggio (solo in modifica): chiudendo la pagina a metà si perdono i dati. Da affrontare (backlog).

## 📋 Ordine consigliato al risveglio (incolla a Code uno alla volta)
**Passo 0 — metti al sicuro su GitHub TUTTI i documenti di stanotte (sono solo locali, non ancora pushati):** fai fare a Code: `git status` per vederli, poi `git add` dei .md nuovi/aggiornati (MORNING_BRIEFING, PROMPT_FIX_14, PROMPT_PERF_01, PROMPT_FEAT_01, PROMPT_IMPROVE_catalogo_autocomplete, DECISIONI_E_FEEDBACK, BACKLOG_MIGLIORAMENTI) → commit "docs: sessione notturna — prompt FIX-14/PERF-01/FEAT-01 + registro" → `git push`. **Importante: senza questo passo i prompt di stanotte restano solo sul disco e potrebbero perdersi.**

Poi, uno alla volta:
1. **`PROMPT_FIX_14_template_e_invio_ux.md`** — bug "nessun template" + UX (veloce).
2. **`PROMPT_PERF_01_lentezza_caricamento.md`** — lentezza (misura → ottimizza).
3. **`PROMPT_IMPROVE_catalogo_autocomplete.md`** — **la feature**: catalogo che si riempie da solo + autocompletamento voci (la leva che fa risparmiare più tempo). L'ho arricchita col pattern tendina-a-portale imparato da T-18.
4. (extra, quick win) **`PROMPT_FEAT_01_click_cliente.md`** — clic sul cliente nel preventivo → apre la sua scheda (T-11, me l'avevi chiesta).

Frase per Code (per ciascuno): «Lavora SOLO su master in C:\Users\Public\carta-canta (niente worktree). Committa+pusha i file nuovi, poi leggi ed esegui PROMPT_xxx.md. Rispetta DECISIONI_E_FEEDBACK.md (non annullare le voci ✅). tsc+build (+test se tocchi voci) verdi. A fine task git push e conferma git log origin/master -1.»

## 🧪 Da testare (quando puoi) — priorità ai fix non confermati
Soprattutto **FIX-13**: (1) suggerimenti cliente che **compaiono e restano** nel popup invio e nel form; (2) reload di una bozza non riapre il popup; (3) "Importa da preventivo" visibile su mobile; (4) email "scrivimi a…"; (5) impossibile inviare un preventivo senza voci complete.
Poi la lista cumulativa già nota (FIX-02→12 + IMPROVE + PWA).

## 📌 Stato generale
Fatto e online: tutta la coda bug (FIX-01→13), IMPROVE, PWA, registro decisioni/feedback. Pronti: FIX-14, PERF-01, feature catalogo. Da fare dopo: UX mobile (T-3 margini, T-17 riepilogo voci — meglio quando puoi guardare e iterare), feature T-1 (CAP→indirizzo), T-11 (click cliente→scheda), T-2 (ATECO più completi), MOB-1b (invito a installare), MOB-3 (autosave in creazione).


<!-- ===== da HANDOFF_STATO_PROGETTO.md ===== -->
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
