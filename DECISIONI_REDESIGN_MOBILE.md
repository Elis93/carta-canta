# DECISIONI REDESIGN MOBILE — Carta Canta

> Registro di TUTTE le decisioni prese con Eli sul redesign mobile (mockup → poi implementazione).
> **Regola:** non annullare queste decisioni senza istruzione esplicita di Eli. Aggiornare a ogni nuovo feedback.
> Stato mockup: pagina HTML `Carta_Canta_mockup_mobile.html` (outputs). Implementazione nel codice: NON ancora fatta.

Ultimo aggiornamento: 13 giugno 2026

> **Feedback generale di Eli:** PRIMA di inserire o cambiare qualcosa nell'app/mockup, controllare SEMPRE questo file e le decisioni già prese — per non reintrodurre cose già scartate o rifare modifiche. (Es. il piano Lifetime era stato messo per errore: non va mostrato.)

---

## A. Navigazione
- Barra in basso a 5 slot: **Home · Preventivi · [ + ] · Clienti · Fatture**.
- Il **"+" centrale = SEMPRE "Nuovo preventivo"** (etichetta sotto: "Preventivo"), presente su ogni pagina. **NON** mettere due "+".
- Su **Fatture**: due pulsanti **in cima** → "Nuova fattura" (pieno navy) + "Da preventivo" (contorno). Il "+" in basso resta = preventivo.

## B. Filtri di stato (liste Preventivi e Fatture)
- Preventivi: Tutti / Bozze / In attesa / Accettati / Rifiutati. Fatture: Tutte / Bozze / Inviate / Pagate / Annullate.
- **UNA sola riga**, NON scorrevole, NON su due righe.
- Stile: **testo semplice con spazi UGUALI** tra le voci (space-between); voce **attiva = navy + sottolineatura** (NON pillola piena). Tutte le voci visibili senza tagli.
- "Ordina" presente nelle liste (Più recenti / Scadenza / Importo).
- (Desktop) Filtri di stato aggiunti anche a Fatture — già implementato da Code.

## C. Date nelle liste
- **Data contestuale allo stato** (già implementato da Code, mobile+desktop): accettato → "Accettato il…"; in scadenza → "Scade tra N g" (rosso); bozza → "Modificato/a il…"; fattura pagata → "Pagata il…"; rifiutato/annullato → "Rifiutato/Annullata il…".
- Badge "Modificato/a" resta separato dalla data.
- Un preventivo modificato dopo l'invio resta tra gli "In attesa" (stato sent/viewed invariato).

## D. Stile visivo (eleganza)
- **Schede bianche con OMBRA morbida** (no bordi marcati). NIENTE fondi **azzurro/grigio** decorativi.
- **Colore SOLO dove indica significato**: stati (pillole/testo colorato), avvisi (banner). Iniziali/avatar in neutro caldo (NON azzurro).
- **Nuovo preventivo** e **Nuova fattura**: ombre **più marcate** (tante schede da distinguere bene).
- Direzione "editoriale/hairline" (righe senza schede, stato a pallino, etichette maiuscoletto ovunque): **RIFIUTATA** — toglie chiarezza. Si mantiene lo stile a schede.
- Tipografia: font Inter; scritte più piccole **alzate** (11→12, 12→13 px); icone Tabler outline.

## E. Schermate creazione/dettaglio
- **Nuovo preventivo / Nuova fattura**: schede Cliente · Voci · Altre opzioni (collassabile) · Riepilogo; azioni "Salva bozza" + "Invia al cliente". Nuova fattura ha Numero + Data e "Totale da pagare".
- **Dettaglio preventivo/fattura**: azioni **Invia · Condividi · Anteprima** (NON un generico "PDF"). "Salva/stampa PDF" nel menu ⋮.
- **PDF/email**: l'email manda il LINK pubblico, **niente allegato PDF** (l'allegato non rispettava il template). "Anteprima" e "Salva/stampa PDF" invece esistono e rispettano il template (`buildPdfHtml`).

## F. Dati cliente
- **P.IVA / Codice Fiscale = UN UNICO campo** "P.IVA / Codice Fiscale" con rilevamento automatico (11 cifre = P.IVA, 16 caratteri = CF), come su desktop. **Adottare in OGNI interfaccia mobile** che raccoglie dati fiscali.
- Cliente: serve almeno **email o telefono** (obbligatorio per inviare).
- **Ordine campi indirizzo: Città → Provincia → CAP** (dall'alto verso il basso / da sinistra verso destra), in OGNI schermata che li chiede, sia **mobile sia desktop**.
- **Autocompletamento indirizzo già esistente** (hook `useComuneLookup`, mobile+desktop): CAP a 5 cifre → riempie città+provincia; città → riempie CAP+provincia. Mantenere.
- Tolta dalla scheda cliente la frase d'aiuto "P.IVA: 11 cifre · CF: 16 caratteri…" (non importante).

## G. Logo / brand
- **Logo definito** — file in `carta-canta/branding/` (varianti compatte, orizzontali, centrate, light/dark).
- Colori brand: navy **`#1a1a2e`**, oro **`#c9a44c`** (accento; variante scura `#b08d3e`), crema **`#f3ede0`**, grigio testo `#6b6a73`.
- Wordmark **serif Georgia** "Carta **Canta**" (con "Canta" in oro); icona = quadrato arrotondato navy con due archi a "C" concentrici (oro esterno + crema interno); tagline "il tuo ufficio in tasca".
- **Pagina di Accesso**: usa il logo centrato (`brand-extended-centered`). ✅ inserito nel mockup.
- DA VALUTARE con Eli: introdurre l'**oro `#c9a44c`** come accento in tutta l'app (oggi gli accenti sono navy).

## E-bis. Piani / abbonamento
- **NIENTE piano Lifetime / una-tantum** nell'UI: rimosso dalla vendita (FIX-28, "piano non più venduto"). Non mostrarlo. Piani offerti: Free, Pro (mensile/annuale). (Team è nascosto.)

---

## BUG / DA SISTEMARE (app reale)
- 🟡 **[BUG-MOB-1] Fix 2° tentativo — da verificare nel browser** (sessione FIX-POPUP-CLICK-2, 13 giugno 2026): causa reale confermata = Radix Dialog (modal=true) chiama `disableBodyPointerEvents()` che imposta `document.body.style.pointerEvents = 'none'` sul body. La tendina portata su `document.body` eredita `pointer-events: none` → visibile (z-index 9999) ma NON cliccabile. Il fix precedente (`onPointerDownOutside`+`data-dropdown-portal`) bloccava solo il dismiss, non ripristinava il click. Fix 2: `pointerEvents: 'auto'` aggiunto inline sull'`<ul>` portale (sovrascrive l'ereditato `none` dal body) in `SendEmailDialog.tsx` (`ClientSearchInput`) e `ClientAutocomplete.tsx`. Il `data-dropdown-portal` + `onPointerDownOutside` rimangono per impedire il dismiss del dialog al click. **Da verificare nel browser: clicco un suggerimento → cliente selezionato; scroll ok; dialog si chiude ancora con Esc/click fuori.**

## FEATURE PIANIFICATE (futuro — vedi BACKLOG_MIGLIORAMENTI.md)
- Agenda appuntamenti settimanali (sync Google Calendar, data nel preventivo).
- Centro notifiche in-app (campanello Home).
