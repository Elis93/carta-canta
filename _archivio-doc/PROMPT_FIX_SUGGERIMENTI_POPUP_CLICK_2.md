# PROMPT CODE — BUG-MOB-1 (2° tentativo): suggerimenti popup invio VISIBILI ma NON cliccabili

> Incolla in Claude Code. **Leggi prima `CLAUDE.md`, `DECISIONI_E_FEEDBACK.md`, `DECISIONI_REDESIGN_MOBILE.md`.** Regole: tsc+build+test verdi; risposta sez. C; push a fine task. SOLO `master`, niente worktree.

## Stato
Il 1° fix (FIX-POPUP-CLICK: `data-dropdown-portal` + `onPointerDownOutside` con `preventDefault`) **NON ha risolto**. Test reale di Eli: nel **form Clienti** la selezione funziona; nel **popup "Invia al cliente"** i suggerimenti **si vedono ma il click NON seleziona** — "come se ci fosse uno strato protettivo davanti".

## Causa molto probabile (verificare e confermare)
Il `Dialog` di Radix in modalità **modale** rende il contenuto interattivo SOLO dentro `DialogContent`: applica `pointer-events: none` (e/o `aria-hidden`) a tutto ciò che sta **fuori** dal dialog. La tendina dei suggerimenti è renderizzata via `createPortal` su **`document.body`** (FIX-16, per evitare il clipping) → è **fuori** dal `DialogContent`, quindi resta **visibile** (z-index 9999) ma **non riceve gli eventi pointer/click**. L'`onMouseDown` del bottone lista non scatta proprio perché l'elemento non è interattivo, non per il dismiss.

Verificare in DevTools: con il popup aperto, ispezionare l'`<ul data-dropdown-portal>` e controllare il `pointer-events` calcolato (atteso: `none` ereditato) e quale elemento riceve il click in quel punto.

## Fix richiesto (scegliere la soluzione robusta)
**Opzione A (preferita): portare la tendina DENTRO il dialog mantenendo `position:fixed`.**
- Far sì che, quando il componente è usato dentro un `Dialog`, il `createPortal` usi come target il **nodo del `DialogContent`** (passare un `containerRef`/portalContainer via prop, con fallback `document.body` quando non in un dialog) invece di `document.body`.
- Mantenere `position:fixed` + coordinate da `getBoundingClientRect` (così niente clipping da `overflow`, come da FIX-16). Essendo dentro il sottoalbero interattivo del dialog, il `pointer-events` torna `auto` e il click funziona.

**Opzione B (minima, se A è complessa): forzare `pointer-events:auto`.**
- Aggiungere `pointer-events:auto` (inline style) all'`<ul>` portale dei suggerimenti (e a un eventuale wrapper), così da sovrascrivere il `pointer-events:none` ereditato dal body quando il dialog modale è aperto. Verificare che lo z-index (9999) resti sopra l'overlay del dialog.

Mantenere comunque `data-dropdown-portal` + `onPointerDownOutside`/`preventDefault` (servono a non far chiudere il dialog quando si clicca nella tendina). NON reintrodurre il clipping. La selezione usa già `onMouseDown`+`preventDefault`: non cambiarla se non necessario.

## Accettazione (browser, desktop + mobile)
Nel **popup "Invia al cliente"** (documento senza cliente): digito una lettera → compaiono i suggerimenti → **clicco/tocco un suggerimento → il cliente viene selezionato e la tendina si chiude**. Scroll della tendina ok, nome intero visibile. Nessuna regressione: form Clienti continua a funzionare; il dialog si chiude ancora con Esc e con click fuori (non sulla tendina).

## Definition of Done
- Causa confermata in DevTools (pointer-events) con citazione; fix robusto (A o B) applicato a `SendEmailDialog.tsx` (`ClientSearchInput`) e, se serve per coerenza, `ClientAutocomplete.tsx`.
- Risposta sez. C; tsc+build+`npm test -- --run` verdi.
- Aggiorna `DECISIONI_REDESIGN_MOBILE.md` (BUG-MOB-1 → risolto/da verificare) e `DECISIONI_E_FEEDBACK.md` (T-18).
- Commit `fix(invio): tendina suggerimenti cliccabile dentro il dialog (pointer-events)`; `git push`; conferma `git log origin/master -1`.
