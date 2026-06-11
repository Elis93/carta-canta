# PROMPT CODE — FIX 16: tendina suggerimenti via PORTALE (T-18, causa: clipping)

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md` e `DECISIONI_E_FEEDBACK.md`.** Regole: tsc+build verdi; formato sez. C; push a fine task. Lavora SOLO su `master`, niente worktree.

## Causa identificata
La riscrittura FIX-15 ha tolto Radix Popover (giusto, per il bug di dismiss) **ma anche il suo portale**: ora la tendina `<ul absolute>` viene **tagliata dall'`overflow-hidden`/`overflow-y-auto`** dei contenitori (in particolare il `DialogContent` del popup invio, modificato in T-7). Per questo i suggerimenti **non compaiono più**. Servono entrambe le cose: tendina **fuori dai contenitori (portale)** **e** **senza** il dismiss-layer di Radix.

## Cosa fare — `components/shared/ClientAutocomplete.tsx` e `ClientSearchInput` in `SendEmailDialog.tsx`
Mantieni TUTTA la logica attuale di FIX-15 (stato `isFocused`, ricerca/filtro, selezione con `onMouseDown`+`preventDefault`, condizione `open`/`isOpen`) ma **renderizza la lista `<ul>` tramite React Portal su `document.body`**, posizionata con coordinate calcolate dal campo input:

1. Aggiungi un `ref` all'`<input>` (o al wrapper dell'input). Quando la tendina è aperta, calcola `rect = inputRef.current.getBoundingClientRect()`.
2. Renderizza la lista con `import { createPortal } from 'react-dom'`: `createPortal(<ul style={{ position: 'fixed', left: rect.left, top: rect.bottom + 4, width: rect.width, zIndex: 9999 }} …>…</ul>, document.body)`. Usa `position: fixed` (coordinate viewport) così **esce da qualsiasi overflow** (dialog, card).
3. **Riposiziona** mentre è aperta: ricalcola `rect` su `window` `scroll` (con `capture: true`, così intercetta anche lo scroll interno del dialog) e su `resize`. Aggiungi/rimuovi i listener in un `useEffect` legato allo stato aperto.
4. **Selezione robusta invariata:** voci con `onMouseDown={(e) => { e.preventDefault(); handleSelect(c) }}` (funziona anche attraverso il portale).
5. **Chiusura:** su selezione, `Esc`, o **clic/tap davvero fuori** — siccome la lista è nel portale (fuori dal wrapper), il check "fuori dal wrapper" non basta: usa un listener `mousedown` su `document` (mentre è aperta) che chiude **solo se** il target non è dentro l'input **né** dentro la lista portata (tieni un `listRef` sul `<ul>` e controlla `inputRef.contains(target) || listRef.contains(target)`).
6. Niente Radix Popover. Stesso identico pattern nei due componenti.

## Criteri di accettazione (UI — verifica nel browser)
1. Digitando ≥2 lettere, i suggerimenti **compaiono** (anche dentro il popup invio, NON tagliati dal bordo del dialog) e **restano** finché non seleziono o cambio testo.
2. La tendina è posizionata correttamente sotto il campo anche scrollando dentro il dialog.
3. Selezione con clic/tap funziona; chiusura solo su selezione/Esc/clic-fuori.
4. Nessuna regressione su selezione cliente (FIX-08) né invio. `tsc` + `build` verdi.

## Definition of Done
- Tendina a portale applicata a entrambi i componenti; causa (clipping) citata.
- Test sez. C; T-18 resta **🟡 "da riconfermare nel browser"** in `DECISIONI_E_FEEDBACK.md` finché Eli non lo verifica.
- Commit `fix(invio): tendina suggerimenti via portale (T-18 — fix clipping)`; `git push`; conferma `git log origin/master -1`.
