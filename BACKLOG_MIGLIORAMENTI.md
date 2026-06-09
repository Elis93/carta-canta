# BACKLOG MIGLIORAMENTI — Carta Canta

> Traccia di tutti i miglioramenti emersi analizzando il **codice reale** (giugno 2026), oltre ai bug.
> Bussola: app per **artigiani 20–70 anni poco tecnologici** → più **automatica, veloce, semplice, intuitiva**, "tutto in una mano". Niente bloat, solo feature che non ci espongono legalmente.
> Convenzione stato: **DA FARE** · **PARZIALE** (esiste già in parte) · **GIÀ OK** (verificato, nessun intervento) · **DA DECIDERE** (serve una scelta di prodotto).
> Ogni voce indica il **prompt Code** collegato (se già scritto) o "da scrivere".

---

## ORDINE DI ESECUZIONE CONSIGLIATO

1. **Bug** — `PROMPT_FIX_01 → 06` (esistenti) + `PROMPT_FIX_07_rifiniture_coerenza` + `PROMPT_FIX_08_invio_cliente_modificato` (nuovi).
2. **Snellimento app** — `PROMPT_IMPROVE_app_velocita` (M1–M6, esistente).
3. **Tutorial primo accesso** — `PROMPT_01_TUTORIAL` (esistente).
4. **Catalogo che cresce + autocompletamento voci** → `PROMPT_IMPROVE_catalogo_autocomplete` (nuovo) — *la leva che fa risparmiare più ore*.
5. **Precarica voci del mestiere all'onboarding** (B).
6. **Promemoria "accettato ma non fatturato"** (C).
7. **App installabile sul telefono / PWA** (F).
8. **Default ricordati** (D) + **menu sfoltito** (E).
9. **Rifiniture di chiarezza** (testo/etichette) (CHIAR-1…4).
10. **Ergonomia tocco & leggibilità** (ERG-1) — intervento a sé, con screenshot.
11. **Offline minimo** (G).
12. **Niente perdita dati in creazione** (leva #2).
13. **Barra in basso su mobile** (leva #3) — *da decidere* (capire perché fu rimossa).
14. **Pulizie tecniche** (deps PDF morte, accessibilità pagina pubblica).

> Regola: si parte dall'alto. Le leve 4→ si costruiscono **dopo** che fix e snellimento hanno assestato il form, per non rilavorare.

---

## A. AUTOMAZIONE (togliere lavoro all'artigiano)

### AUT-1 — Catalogo che cresce + autocompletamento voci  ·  DA FARE  ·  prompt: `PROMPT_IMPROVE_catalogo_autocomplete` (scritto)
Mentre si scrive la descrizione di una voce, suggerire le voci del catalogo e, alla scelta, precompilare prezzo/unità/IVA (Q.tà = 1). In più: poter **salvare nel catalogo** una voce digitata direttamente dalla riga, così il catalogo si riempie da solo. *Le due cose vanno insieme: l'autocompletamento è utile solo se il catalogo si popola senza fatica.* Riusa `catalog_items`, `createCatalogItemAction`, e la mappatura già usata dal `CatalogPicker`.

### AUT-2 — Precarica le voci del mestiere all'onboarding  ·  DA FARE  ·  prompt: da scrivere
La logica preset ATECO esiste già (`lib/catalog/ateco-presets.ts`, `importAtecoCatalogAction`) ma è "sepolta" in `/catalogo`, dove molti non andranno mai. Aggiungere all'onboarding un passo "Vuoi caricare le voci tipiche del tuo mestiere?" → import in un tocco. Rende l'app utile dal primo preventivo.

### AUT-3 — Promemoria "accettato ma non fatturato"  ·  DA FARE  ·  prompt: da scrivere
Oggi nulla ricorda di emettere la fattura dopo che un preventivo è accettato → l'artigiano dimentica di incassare. Avviso in dashboard (riusa `origin_document_id`, **nessuna nuova tabella**) per i preventivi `accepted` senza fattura collegata. Eventuale email è opzionale (fase 2).

### AUT-4 — Default "tuoi" ricordati  ·  DA FARE  ·  prompt: da scrivere (micro)
"Termini di pagamento" parte sempre da `30 giorni` hardcoded (`PreventivoForm`). Renderlo un'impostazione del workspace (ricorda l'ultima scelta). Toglie una scelta ripetuta a ogni preventivo. (Validità è già un default workspace.)

### Già coperto / esistente (per onestà)
- **Reminder automatici** (owner + cliente 1 giorno prima, notifica scadenza): GIÀ OK (`api/cron/expire-documents`, default ON in `notifiche.tsx`).
- **Numero/data/IVA automatici**: GIÀ OK.
- **Suggerimento catalogo per mestiere** quando il catalogo è vuoto: PARZIALE (esiste in `/catalogo` via `AtecoCatalogSuggestion`; AUT-2 lo porta nell'onboarding).
- **Salva nel catalogo**: PARZIALE (esiste solo dentro il dialog `CatalogPicker`; AUT-1 lo porta sulla riga digitata).

---

## B. CHIAREZZA / INTUITIVITÀ (testo ed etichette — nessun dato cambia)

### CHIAR-1 — Spiegare "Salva o stampa il PDF"  ·  DA FARE  ·  prompt: da scrivere
Il bottone apre la **finestra di stampa** del browser (non scarica un file): un non-tecnico pensa "perché mi esce la stampa?". Aggiungere hint/tooltip: *"Si aprirà la finestra di stampa: scegli 'Salva come PDF'."* File: `PdfActions.tsx`.

### CHIAR-2 — Menu in italiano semplice  ·  DA FARE  ·  prompt: da scrivere
"Dashboard" → **"Home"** (o "Riepilogo"); "Template" → **"Modelli"** (o "Aspetto documento"). Solo etichette (`NavItem.tsx`). Estende M6 di `IMPROVE`.

### CHIAR-3 — Etichette sulle azioni con sola icona  ·  DA FARE  ·  prompt: da scrivere
Esporta CSV, "+", ecc. sono icone senza testo (su mobile niente hover). Mettere etichetta visibile accanto alle icone chiave, almeno su mobile. (FIX-22 sistema solo l'hover desktop.)

### CHIAR-4 — Stato "Visto" → "Aperto dal cliente"  ·  DA FARE  ·  prompt: da scrivere
"Visto" è ambiguo. Sui **preventivi** rinominare in "Aperto dal cliente". (Sulle **fatture** "Visto" va rimosso del tutto → già in `PROMPT_FIX_02`.)

### CHIAR-5 — Coerenza bottone primario preventivo vs fattura  ·  DA DECIDERE
Preventivo = "Invia al cliente" (chiaro); fattura = "Salva e apri" + invio da toolbar (meno ovvio). Non sono identici per natura (la fattura non si manda "per accettazione"). Valutare se rendere il percorso fattura altrettanto lineare.

---

## C. ERGONOMIA & LEGGIBILITÀ (dimensioni, tocco)

### ERG-1 — Ingrandire elementi toccati e testo di aiuto  ·  DA FARE (con screenshot)  ·  prompt: da scrivere (blindato)
Misure attuali sotto la soglia comoda per il target: bottoni `sm` h-7 = **28px**, `default` h-8 = **32px**; input h-8 = **32px**; testo di aiuto/label `text-xs` = **12px**. Riferimento tocco: ~44px.
Intervento: alzare a **~44px su mobile** gli elementi più toccati (bottoni principali Invia/Salva/Aggiungi voce/Nuovo, campi numerici delle voci, microfono) e portare il testo di aiuto importante **da 12px a 14px** (selettivo).
⚠️ **Alto impatto**: tocca componenti base usati ovunque (`button.tsx`, `input.tsx`) e layout densi (griglia voci). Fare come passata deliberata con **screenshot prima/dopo** su desktop e a 360px. Nota: il requisito "≥40px" di `IMPROVE` dipende da questo.

---

## D. ROBUSTEZZA & MOBILE

### MOB-1 — App installabile sul telefono (PWA)  ·  IN CORSO  ·  prompt: `PROMPT_IMPROVE_pwa_installabile`
Aggiungere `manifest` + icone + meta tag per avere l'icona "Carta Canta" sulla Home → un tocco e sei dentro. **Versione sicura: niente service worker** (l'offline è MOB-2, separato — evita problemi di cache vecchia). Le icone iniziali sono placeholder sostituibili col logo definitivo.

### MOB-2 — Offline minimo  ·  DA FARE  ·  prompt: da scrivere
In cantiere la rete va e viene. Oggi un invio senza linea dà solo "Errore di rete". Aggiungere banner "sei offline" + messaggi rassicuranti ("il preventivo è salvato, riprova l'invio quando torna la linea"). *La creazione offline con sync è grossa → fase futura.*

### MOB-3 — Niente perdita dati in creazione (leva #2)  ·  DA FARE  ·  prompt: da scrivere
L'autosalvataggio bozza esiste solo in **modifica**, non in **creazione** (`PreventivoForm`: l'interval parte solo se `mode === 'edit'`). Se il telefono si chiude a metà, si perde tutto. Estendere l'autosave alla creazione (coerente con B.3: numero già assegnato alla creazione).

### MOB-4 — Barra in basso su mobile (leva #3)  ·  DA DECIDERE
Le sezioni principali sono dietro l'hamburger (2 tocchi). Una barra fissa in basso (4 voci: Dashboard, Preventivi, Clienti, Fatture) le porta a 1 tocco. ⚠️ Era stata **rimossa di proposito** (CLAUDE.md sessione 12): capire il motivo prima di reintrodurla.

---

## E. PULIZIE TECNICHE (non rivolte all'utente, ma salute del progetto)

### TEC-1 — Rimuovere dipendenze PDF morte (OTT-2)  ·  DA FARE
`@sparticuz/chromium`, `puppeteer-core`, `playwright-core` in `package.json` ma non usate (~centinaia di MB). Verificare che non siano importate e rimuoverle (+ `serverExternalPackages` in `next.config.ts`).

### TEC-2 — Accessibilità pagina pubblica `/p/[token]` (OTT-9)  ·  DA FARE
È la pagina che converte, e anche i clienti possono avere 60-70 anni: contrasto, dimensione testo, `aria`. Costo basso.

> Altri OTT (helper workspace DRY, monolite `documents.ts`, rate limit AI su Upstash, ecc.) restano in `MAPPA_APP.md` §8 — si affrontano "cogliendo l'occasione" quando si tocca l'area.

---

## G. FIX TROVATI IN TEST (dopo FIX_01) — raccolti in `PROMPT_FIX_08`
> Bug emersi testando in browser i fix di FIX_01. Stato: **DA VERIFICARE** dopo l'esecuzione di FIX_08.

- **CHECK-1** — Falso conflitto "stessa email, contatto diverso" quando selezioni un contatto dall'autocomplete nel popup di invio. Causa: in `send-email/route.ts` il confronto usa `name` (solo nome) contro nome+cognome digitato, e la selezione non passa l'id del contatto. → `PROMPT_FIX_08`.
- **CHECK-2** — Dopo l'invio il cliente non appare nel dettaglio. Causa: `client_id` è salvato, ma `PreventivoForm` non ri-sincronizza `selectedClient` al `router.refresh()`. → `PROMPT_FIX_08`.
- **CHECK-3** — Il badge "Modificato" non compare cambiando solo descrizione/unità di una voce. Causa: `publicFieldsChanged` (in `saveDraftAction`/`updateDocumentAction`) guarda solo i campi documento + il totale, non le voci. → `PROMPT_FIX_08`.
- **CHECK-4** — Cliente trasferito da preventivo a fattura (FIX-3): ✅ verificato OK in test.
- **CHECK-5** — "Reinvia" lascia modificare l'email ma la modifica non persiste e il cliente non cambia (la route gestisce il cliente solo se `!doc.client_id`). Decisione: in reinvio l'email è **sola lettura** sul cliente. → `PROMPT_FIX_09_reinvio_email_bloccata`. ✅ Applicato (commit `0718822`), verificato nel codice; test browser da fare.

### Test dell'8 giugno 2026 (dopo FIX-02/03) — nuovi punti
- **CHECK-6** — Suggerimenti contatti spariti nel popup di invio (campo Nome/Email) quando il documento non ha cliente. Da indagare: o il doc aveva già un cliente (comportamento previsto), o `preloadClientsAction`/`filterClients` è rotto. → `PROMPT_FIX_10`. Stato: DA INDAGARE.
- **CHECK-7** — Email cliente dice ancora "PDF allegato". **Non è un nuovo bug: è esattamente `PROMPT_FIX_04`** (non ancora eseguito).
- **CHECK-8** — ✅ **NON è un bug (chiuso).** Il link "generato con Carta Canta" punta a `https://cartacanta.app` (landing con "Accedi" e "Prova gratis" → `/signup` = registrazione email). Eli ha visto l'onboarding perché era **loggata** con onboarding incompleto (il middleware manda gli autenticati lì). Un nuovo visitatore sloggato atterra sulla landing → registrazione. Nessuna modifica necessaria.
- **CHECK-9** — Badge "Modificato" → deve essere "Modificata" sulle fatture (lista fatture, dashboard, dettaglio). → `PROMPT_FIX_10`. Stato: DA FARE.
- **CHECK-10 (feature)** — In dashboard aggiungere "Fatture in attesa di pagamento" accanto a "Preventivi in attesa". Richiede lo stato pagamento sulle fatture → si fa **con la feature Pagamenti (SPEC #2)**. Vedi sotto in "Nota feature".

---

### Stato FIX_07 (rifiniture coerenza)
- RIF-2 (header "Voci fattura") → ✅ già fatto da FIX-02. RIF-3 (Q.tà voce catalogo) → ✅ già fatto da FIX-05.
- RIF-1 (template Bold "Totale da pagare" sui preventivi) → **spostato in `PROMPT_FIX_10` (CHECK-C)**, unico residuo reale.
- RIF-4/RIF-5 erano solo verifiche (troncamento/logo) → già a posto. **`PROMPT_FIX_07` non va più eseguito.**

### Nota feature — "Fatture in attesa di pagamento" in dashboard (CHECK-10)
Da realizzare **insieme alla feature Pagamenti (SPEC #2)**, perché richiede lo stato pagamento sulle fatture (`payment_status`, `paid_at`, `due_date`). Struttura coerente con l'app:
- In dashboard, accanto al blocco "Preventivi in attesa", un blocco **"Fatture da incassare"**: fatture inviate non ancora pagate, ordinate per scadenza pagamento, con importo e un'azione rapida (es. "Segna come pagata" / "Sollecita pagamento").
- Riusa il pattern di `PendingDocCard` e degli alert dashboard (nessuna pagina nuova). L'obiettivo è "tutto ciò che c'è da fare nella prima pagina": preventivi da seguire + soldi da incassare.
- Si attiva quando esiste lo stato pagamento → fa parte di Pagamenti Fase 1 nel `SPEC_NUOVE_FEATURE.md`.

---

## F. PROMEMORIA UTENTE (NON codice)
- **DMARC**: completare `none → quarantine → reject` (DNS/OVH).
- **ToS + Privacy + Cookie banner** con generatore affidabile (es. iubenda).
