# DECISIONI REDESIGN MOBILE — Carta Canta

> Registro di TUTTE le decisioni prese con Eli sul redesign mobile (mockup → poi implementazione).
> **Regola:** non annullare queste decisioni senza istruzione esplicita di Eli. Aggiornare a ogni nuovo feedback.
> Stato mockup: pagina HTML `Carta_Canta_mockup_mobile.html` (outputs). Implementazione nel codice: NON ancora fatta.

Ultimo aggiornamento: 13 giugno 2026

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

## G. Logo / brand
- I colori del logo sono in definizione (altra chat cowork). Quando disponibili → **rivestire l'app** (accenti, header, "+", stati). Per ora navy `#1a1a2e`.

---

## BUG / DA SISTEMARE (app reale)
- 🟡 **[BUG-MOB-1] Popup invio — suggerimenti cliente non cliccabili / non scorribili.** Fix applicato (sessione FIX-POPUP-CLICK, 13 giugno 2026): causa confermata = `DismissableLayer` di Radix Dialog intercettava il `pointerdown` sulla tendina portale (su `document.body`, fuori dal DOM del dialog) → chiudeva il dialog prima che `onMouseDown` potesse selezionare il cliente. Fix: `data-dropdown-portal` sull'`<ul>` + `onPointerDownOutside` nel `DialogContent` che chiama `e.preventDefault()` quando il click è dentro `[data-dropdown-portal]`. **Da verificare nel browser: seleziona un suggerimento → cliente selezionato, tendina chiusa; scroll della tendina funziona; no regressione dismiss dialog.**

## FEATURE PIANIFICATE (futuro — vedi BACKLOG_MIGLIORAMENTI.md)
- Agenda appuntamenti settimanali (sync Google Calendar, data nel preventivo).
- Centro notifiche in-app (campanello Home).
