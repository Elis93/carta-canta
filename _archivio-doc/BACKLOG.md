# BACKLOG — Carta Canta

> Unione di BACKLOG_MIGLIORAMENTI.md + AUDIT_FUNZIONI_MOBILE.md (consolidamento 14 giu 2026). Contenuto integrale.


<!-- ===== da BACKLOG_MIGLIORAMENTI.md ===== -->
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

### UX — Data contestuale allo stato (mobile E desktop)  ·  DA FARE (deciso col redesign)  ·  prompt: da scrivere
Nelle liste preventivi/fatture la data accanto a ogni documento deve essere **contestuale allo stato**: in attesa → "Scade tra X g / Scade il…" (urgenza); accettato → "Accettato il…"; rifiutato → "Rifiutato il…"; bozza → "Modificato il…". Oggi è ambigua. **Applicare la stessa logica anche sull'app desktop**, non solo mobile. Ordinamento "Più recenti" = per ultima attività (creato/aggiornato) discendente.

### FEAT — Agenda appuntamenti settimanali  ·  DA FARE (futuro, da progettare)  ·  prompt: da scrivere
L'artigiano deve poter inserire i propri appuntamenti della settimana e tenere sotto controllo da chi andare e quando, direttamente dall'app. Dettagli da definire più avanti (NON ora): possibile sincronizzazione con Google Calendar; possibilità di fissare già una data/appuntamento dentro il preventivo; vista settimanale/giornaliera; eventuali promemoria. Per ora solo registrata come feature pianificata.

### FEAT — Centro notifiche in-app (campanello Home)  ·  DA FARE (futuro, deciso col mockup)  ·  prompt: da scrivere
Il campanello in alto nella Home apre un elenco delle ultime novità in-app: preventivo accettato/rifiutato/visto, in scadenza. Oggi questi avvisi arrivano solo via email → aggiungere un centro notifiche dentro l'app. Deciso durante il redesign mobile.

### MOB-1b — Invito in-app a installare l'app  ·  DA FARE (dopo MOB-1)  ·  prompt: da scrivere
Molti utenti (50enni) non sanno dell'"Aggiungi a Home". Mostrare un invito gentile dentro l'app: su **Android** un bottone "Installa l'app" vero (intercettando `beforeinstallprompt`); su **iPhone** un suggerimento illustrato ("Tocca Condividi → Aggiungi a Home"). Mostrarlo una volta/dismissibile. **Non è sul Play Store** (è una PWA via add-to-home; eventuale pubblicazione Play Store via TWA = lavoro separato futuro). Da fare dopo che il manifest MOB-1 è online.

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

## H. TEST MOBILE — 18 punti (sessione test Eli)
> Feedback dal test reale su mobile. Stato: DA FARE salvo diversa indicazione.

**🔴 Bug (molti con causa confermata nel codice):**
- **T-7** — Popup non scorribili, la X di chiusura è tagliata fuori schermo su mobile. **CRITICO.** I `DialogContent` devono avere `max-height` + `overflow-y-auto`. (Spiega le segnalazioni precedenti sulla X irraggiungibile.)
- **T-6** — Voce da catalogo su preventivo nuovo va come 2ª invece di sostituire la 1ª riga vuota. Causa: la 1ª riga (PreventivoForm.newVoce) nasce con `quantity: 0`, ma il check "riga vuota" in `VociTable` ora richiede `quantity === 1` → mismatch. Fix: check vuoto robusto (`description === '' && unit_price === 0`, ignorando la quantità).
- **T-15** — Condivisione WhatsApp duplica il link. Causa: `ShareButton` — `buildShareText` include già l'URL e poi `navigator.share({text, url})` lo ripassa. Fix: testo senza URL quando si passa `url` separato; per `wa.me` (solo text) tenere l'URL nel testo.
- **T-16** — Togliere "Modifiche non ancora reinviate al cliente" dalla cronologia (`DocumentTimeline.tsx:147`). Ci sono già altri avvisi.
- **T-4** — Avatar mostra iniziali del nome utente ("DD") invece della ragione sociale, e con casing incoerente ("DD"/"dd"). Allineare all'iniziale dell'azienda, sempre maiuscolo, coerente col logo.
- **T-8** — L'errore "voci mancanti/non compilate" deve apparire PRIMA di aprire il popup invio cliente, non dopo.

**✅ Risolti:**
- **T-14** — Causa A confermata: sconto globale (% + fisso) > subtotale voci → totale negativo. Fix: `lib/fiscal/calcoli.ts` clampa `afterDiscount`/`total` a 0 (mai negativi); `PreventivoForm.tsx` blocca submit/salvataggio PRIMA con messaggio specifico vicino ai campi sconto (no scroll alle voci). Sessione FIX-12.
- **T-13 / T-13bis** — Etichetta "Importa da preventivo" sempre visibile (anche su mobile) sul bottone in `app/(app)/fatture/page.tsx`. Sessione FIX-13.
- **T-18 / T-18bis** — Suggerimenti cliente in `SendEmailDialog`/`ClientAutocomplete`: causa doppia — `components/ui/input.tsx` non era `React.forwardRef` (Radix `PopoverAnchor asChild` non riusciva ad ancorare correttamente) + `onInteractOutside` del `PopoverContent` trattava il pointerdown sull'input come "fuori dal popover" chiudendolo subito. Fix: `Input` convertito a `forwardRef`; aggiunto `anchorRef` escluso da `onInteractOutside` in entrambi i componenti. Sessione FIX-13.
- **T-19** — Reload di una bozza riapriva il popup invio (`?send=1` residuo in URL). Fix: `useEffect` in `SendEmailDialog.tsx` rimuove il param con `history.replaceState` dopo l'apertura automatica (no refetch). Sessione FIX-13.
- **T-20** — Invio dalla toolbar poteva inviare un documento "senza voci" se l'utente svuotava le voci nel form senza salvare. Causa: i guard client-side usano `hasVoci` calcolato server-side al caricamento pagina (stato salvato), non lo stato corrente del form. Fix scelto (minimo, indipendente dal client): `app/api/documents/[id]/send-email/route.ts` ora valida `document_items` con lo stesso predicato di `hasVoci` (descrizione+prezzo+quantità) prima di procedere — sostituisce il vecchio check `doc.total === 0`, insufficiente. Non implementato l'auto-save/blocco su stato non salvato (più invasivo, non richiesto come minimo). Sessione FIX-13.
- **T-12bis** — Testo email semplificato a "scrivimi a {email}" in `components/email/PreventivoEmail.tsx`. Sessione FIX-13.

**🟡 Da indagare:**
- **T-9** — Caricamento pagine lento. Investigazione performance (bundle `comuni.ts`, deps PDF morte OTT-2, cold start Vercel).

**🟢 Miglioramenti UX/mobile:**
- **T-3** — Su mobile bordi/margini delle sezioni troppo grandi → schiacciano testo e campi (troppo piccoli). Ridurre padding/bordi su mobile (lega a ERG-1).
- **T-17** — Riepilogo voci (visto da artigiano e cliente): Q.tà/Prezzo unit./Totale su righe diverse e schiacciate. Ridisegnare la riga voce per mobile; su desktop tutto su una riga senza andare a capo/sovrapporsi.

**✨ Feature:**
- **T-1** — Auto-compilazione indirizzo dal CAP (CAP→provincia/comune; se ambiguo, prima il comune→auto provincia/CAP). Ovunque ci sia un indirizzo. Usa `lib/data/comuni.ts` (già nel repo).
- **T-5** — Voci nuove salvate in catalogo → è la leva `PROMPT_IMPROVE_catalogo_autocomplete` (AUT-1). Decisione: NO auto-save di tutto (riempie di voci una-tantum) → suggerimento mentre scrivi + "salvo le N voci nuove?" al primo invio.
- **T-11** — Click sul cliente nel preventivo → apre la pagina cliente modificabile.
- **T-2** — ATECO più completi (manca "imbianchini"). Verificare/estendere `lib/data/ateco.ts` verso la lista ufficiale completa.

**ℹ️ Chiarimenti / già ok:**
- **T-12** — "Rispondi a questa email": il `reply-to` è già la mail dell'owner (`send-email/route.ts:401`) → le risposte arrivano all'artigiano anche se il mittente è noreply. Funziona; valutare solo se rendere il contatto più esplicito.
- **T-10** — ✅ Form snellito (IMPROVE) confermato funzionante dall'utente.

### Test mobile 2 (dopo FIX-11/12) — nuovi punti
- **T-21** — UX bottone "Invia al cliente": in creazione è in fondo, in dettaglio è nella bar

<!-- ===== da AUDIT_FUNZIONI_MOBILE.md ===== -->
# AUDIT — Funzioni app reale vs mockup mobile (13 giu 2026)

Confronto tra le funzioni presenti nel codice dell'app e i mockup mobile. Obiettivo: decidere insieme quali funzioni UTILI aggiungere ai mockup (e poi all'app mobile), tralasciando quelle poco utili da telefono.

Legenda: 🟢 consiglio di aggiungere (utile) · 🟡 da valutare · ⚪ secondaria (forse non serve su mobile) · 🔧 correzione mockup

---

## 0. Navigazione (gap importante)
- 🟢 La barra in basso ha 5 voci (Home, Preventivi, +, Clienti, Fatture). Mancano i collegamenti a **Catalogo, Template, Impostazioni, Scadenze, Abbonamento, Cestino**. Serve un punto d'accesso (es. voce "Altro"/menu, o menu profilo dall'avatar in Home). Oggi quelle schermate esistono ma non c'è come arrivarci.

## 1. Lista clienti
- 🟢 Manca il pulsante **"Nuovo cliente"** (su mobile non c'è modo di aggiungere un cliente; il "+" in basso crea un preventivo).
- ⚪ Avviso "email duplicate" (suggerisce di unire clienti) — secondaria.

## 2. Dettaglio preventivo / fattura
- 🟢 **Duplica** documento.
- 🟢 **Cambia stato** manuale (es. segna accettato/rifiutato/annullato).
- 🟢 **Banner accettazione**: quando il cliente accetta, mostra firma + data + IP (prova legale). Manca nei mockup.
- 🟡 **Storico aperture** (quante volte/quando il cliente ha aperto il link).
- 🟡 **Registra invio manuale** (se l'hai mandato fuori app).
- 🟡 (fattura) **Collega/scollega** preventivo di origine manualmente.

## 3. Lista preventivi
- 🟢 Badge **"Fattura collegata"** (pagata/emessa/bozza/annullata) sulla riga.
- 🟢 Badge **"Modificato"** (già deciso) + azioni riga **Duplica / Elimina / Invia** dal menu ⋮.
- 🟡 Numero **visualizzazioni** del preventivo.
- ⚪ **Esporta CSV** (poco utile da telefono).
- ⚪ **Filtri avanzati** per data/importo (ricerca + filtri stato forse bastano su mobile).

## 4. Lista fatture
- ⚪ Esporta CSV, filtri avanzati — come sopra.

## 5. Form Nuovo preventivo / fattura
- 🟢 **IVA per voce** (necessaria in regime ordinario) e **sconto per voce** — oggi nel mockup la voce non li mostra.
- 🟡 Dentro "Altre opzioni" (collassato) l'app ha: numero, titolo lavoro, validità (giorni), condizioni di pagamento, note, **bonus edilizio**, scelta template. Confermare che li teniamo lì.
- 🟡 **AI Import** (foto/PDF → voci) — funzione Pro, oggi "in arrivo".
- 🟡 **Salvataggio automatico bozza** + creazione rapida cliente dal form.

## 6. Catalogo
- 🟢 Azioni **Modifica / Elimina** su ogni voce (oggi le righe non hanno affordance).
- 🟡 Raggruppamento per **categoria**.

## 7. Dashboard / Home
- 🟡 **Grafico andamento** (fatturato ultimi 6 mesi).
- 🟡 **Banner quota piano Free** (preventivi rimasti / scadenza trial).
- 🟡 Alert "preventivi senza risposta da 14+ giorni" (link a Scadenze).

## 8. Pagina pubblica cliente (/p/[token])
- 🟢 **Accetta con firma digitale** (nome + email + firma disegnata/caricata) e **Rifiuta con motivo**. Oggi nel mockup solo Accetta/Rifiuta.

## 9. Impostazioni — 🔧 correzioni
- 🔧 P.IVA, Codice Fiscale, **Regime fiscale**, Bollo automatico, Ritenuta automatica stanno nel tab **Fiscale** (nel mockup ho messo la P.IVA in Generale).
- Tab **Notifiche**: 4 interruttori (accettato / rifiutato / scaduto / reminder cliente).
- Tab **Piano**: piano corrente, fatturazione mensile/annuale, gestisci abbonamento.

## 10. Form cliente — 🔧 minore
- 🔧 Esiste anche il campo **Paese** (oggi non nel mockup). Il campo unico P.IVA/CF è corretto.

## 11. Scadenze (pagina solleciti)
- 🟡 Esiste una pagina dedicata "Scadenze" con solleciti (singoli e in blocco) e data ultimo sollecito. Non c'è nei mockup né nella nav mobile.

---

## Cose nei mockup ma NON nell'app (da non implementare / inventate)
- Nessuna funzione inventata di rilievo trovata. (Lifetime già rimosso correttamente.)

## STATO: ✅ COMPLETATO NEI MOCKUP (13 giu)
Tutti gli essenziali + rifiniture sono stati applicati ai mockup (`Carta_Canta_mockup_mobile.html`, 20 schermate): navigazione con tab "Altro" + "+" centrale (Clienti dentro Altro), "Nuovo cliente", pagina pubblica con firma/motivo, dettaglio con banner accettazione + "Altre azioni" a tendina, Template Free con lucchetti Pro, IVA/sconto per voce, modifica catalogo, campo Paese, tab Fiscale (P.IVA/regime/bollo/ritenuta). Prossimo: prompt per Code per implementare nell'app.

## PIANO DECISO (13 giu) — cosa fare di ognuna

### Essenziali, in primo piano
- **Navigazione "Altro"**: serve accesso a Catalogo, Template, Scadenze, Impostazioni, Abbonamento, Cestino. Proposta: barra in basso = Home · Preventivi · Fatture · Clienti · **Altro (≡)**; il **"+" diventa un pulsante flottante** (nuovo preventivo) sopra la barra. "Altro" apre un foglio con le voci secondarie + Esci.
- **Lista clienti**: pulsante "Nuovo cliente" in alto.
- **Pagina pubblica**: accetta → step con **firma** (nome + firma); rifiuta → step con **motivo**. (Legale, essenziale.)
- **Dettaglio**: **banner accettazione** (firma/data) quando accettato.
- **Catalogo**: tap sulla voce = modifica; elimina nella modifica.
- **Form preventivo (ordinario)**: **IVA per voce** visibile solo se regime ordinario; **sconto per voce** dietro un piccolo "＋ sconto" per non appesantire.

### Secondarie → NON in primo piano (menu ⋮ / collassabile)
- Dettaglio: **Duplica, Cambia stato, Elimina, Registra invio manuale** → dentro il menu **⋮** in alto a destra.
- Lista: azioni riga **Duplica/Elimina/Invia** → menu ⋮ per riga (già presente).
- **Storico aperture / n. visualizzazioni** → dentro la "Cronologia" (collassabile).
- **AI Import** (Pro, "in arrivo") → dentro "Altre opzioni" del form.
- **Esporta CSV** → menu ⋮ della lista (in fondo).
- Dashboard: **banner quota Free** (solo Free) e, opzionale, mini-grafico andamento.

### Da NON mettere su mobile (semplicità)
- Filtri avanzati data/importo (bastano ricerca + tab stato).
- Avviso "email duplicate".
- (Referral: eventualmente solo dentro "Altro".)

### Free vs Pro (le pagine cambiano un po')
- **Template**: Free = solo Classico, watermark NON rimovibile, niente template custom → mostrare Bold/Tecnico/Elegante e l'interruttore Watermark con **lucchetto + "Pro"**.
- **AI Import**: solo Pro → lucchetto.
- **Abbonamento**: Free vede quota + upgrade (già).
- Faremo, dove serve, una **variante Free** della schermata (es. Template) accanto a quella Pro.
