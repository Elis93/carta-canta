# PROMPT CODE — Popup invio: suggerimenti cliente non cliccabili / non scorribili

> Incolla in Claude Code. **Leggi prima `CLAUDE.md`, `DECISIONI_E_FEEDBACK.md` e `DECISIONI_REDESIGN_MOBILE.md` (non annullare le voci ✅/decisioni).** Regole: `npx tsc --noEmit` + `npm run build` verdi prima del commit; risposta nel formato sez. C; push a fine task. SOLO `master`, niente worktree.

## Problema (segnalato da Eli, app reale)
Nel **popup "Invia al cliente"** (`app/(app)/preventivi/_components/SendEmailDialog.tsx`, componente di ricerca cliente `ClientSearchInput`), digitando una lettera i suggerimenti **compaiono**, ma:
1. **non si riescono a cliccare** (la selezione del suggerimento non avviene);
2. **non si riesce a scorrere** la tendina né a vedere il **nome per intero** del contatto (nomi lunghi troncati, nessuno scroll).

La tendina è renderizzata via **portale** (`createPortal` su `document.body`, hook in `components/shared/dropdown-portal.ts` — vedi FIX-16) con `position:fixed` e coordinate da `getBoundingClientRect`.

## Cause probabili da verificare (in ordine)
1. **Click non registrato**: il `DialogContent` di Radix (modal) potrebbe intercettare/bloccare i `pointer`/`focus` events sugli elementi del portale che stanno FUORI dal DOM del dialog (focus trap / `onPointerDownOutside` / `aria-hidden`). Verificare se il portale della tendina è considerato "outside" dal dialog e quindi gli eventi vengono mangiati o la selezione chiude il dialog invece di selezionare.
2. **Selezione**: la voce usa `onMouseDown`+`preventDefault`; su alcuni casi il `mousedown` parte ma la chiusura/timing impedisce il `select`. Verificare che `onMouseDown` (o `onPointerDown`) sull'elemento lista chiami davvero `onSelectClient` e che non venga prima smontato.
3. **Scroll + troncamento**: la `<ul>` del portale non ha altezza/scroll adeguati e le voci troncano il nome con `text-overflow:ellipsis` senza possibilità di vederlo. Manca `max-height + overflow-y:auto` e/o larghezza adeguata.

## Fix atteso
- **Selezione funzionante** (desktop + touch): cliccando un suggerimento il cliente viene selezionato e la tendina si chiude. Se il problema è il modal di Radix che intercetta, risolvere in modo robusto (es. rendere il portale figlio del `DialogContent`/`DialogPortal` container invece di `document.body`, OPPURE marcare gli elementi della tendina in modo che Radix non li tratti come "outside" — es. `data-radix-*`/`onPointerDownOutside` che ignora i click dentro `listRef`). Scegliere la soluzione che NON reintroduce il clipping (vedi FIX-16) e NON rompe la chiusura su click-fuori.
- **Scroll + nome intero**: la tendina deve avere `max-height` con `overflow-y:auto` e mostrare il **nome completo** del contatto (niente troncamento, o wrap su due righe). Larghezza ≥ a quella dell'input.
- Allineare lo stesso comportamento, se serve, all'autocomplete del form (`components/shared/ClientAutocomplete.tsx`) che condivide il pattern.

## Accettazione (browser, desktop + mobile)
Nel popup "Invia al cliente", digitando una lettera: i suggerimenti compaiono, sono **cliccabili** (selezionano il cliente e chiudono la tendina), si possono **scorrere** e si legge il **nome completo**. Nessuna regressione su apertura/chiusura e su FIX-16/17/18/19/20.

## Definition of Done
- Causa confermata con citazione file/riga; fix robusto (no clipping, no rottura dismiss).
- Risposta formato sez. C; tsc+build verdi; `npm test -- --run` verde.
- Aggiorna `DECISIONI_REDESIGN_MOBILE.md` (BUG-MOB-1 → risolto/da verificare) e `DECISIONI_E_FEEDBACK.md` (T-18).
- Commit `fix(invio): suggerimenti cliente cliccabili e scorribili nel popup`; `git push`; conferma `git log origin/master -1`.
