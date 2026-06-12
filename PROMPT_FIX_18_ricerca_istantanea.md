# PROMPT CODE — FIX 18: ricerca cliente istantanea nel form (no "refresh" dopo 1s)

> Incolla in Claude Code. **Leggi prima `CLAUDE.md` e `DECISIONI_E_FEEDBACK.md`.** Regole: tsc+build verdi; formato sez. C; push a fine task. Solo `master`, niente worktree.

## Problema
Nel form preventivo (`components/shared/ClientAutocomplete.tsx`) i suggerimenti compaiono ma poi, dopo ~1s, si **aggiornano da soli** (effetto "ricaricamento"). Causa: `searchClientsAction` è una **chiamata server** con debounce → i risultati arrivano in ritardo e la lista si ri-renderizza. L'utente vuole che i suggerimenti siano **istantanei** (niente aggiornamento visibile).

## Fix atteso
Allinea `ClientAutocomplete` al comportamento **istantaneo** già usato nel popup invio (`ClientSearchInput` in `SendEmailDialog.tsx`): **precarica una volta** i clienti del workspace e **filtra in memoria**, invece di una ricerca server a ogni tasto.
- Al primo focus (o al mount del componente), carica i clienti del workspace **una sola volta** (riusa `preloadClientsAction` da `@/lib/actions/clients`, già usata dal popup; se restituisce ciò che serve, usala così com'è).
- I suggerimenti si calcolano **filtrando in memoria** la lista precaricata con un "contiene" (case-insensitive su nome+cognome+email, come fa `filterClients` del popup) → risultato **immediato**, nessun ritardo, nessun re-render ritardato.
- Rimuovi la chiamata `searchClientsAction` per-tasto e il relativo debounce dal form (la `searchClientsAction` può restare per altri usi, ma il form non la chiama più a ogni lettera).
- Mantieni invariati: selezione (`onMouseDown`), tendina a portale (FIX-16), soglia 1 lettera (FIX-17), `onCreateNew`.

## Accettazione (browser)
Digitando il nome di un cliente, i suggerimenti compaiono **istantaneamente** e non si "aggiornano" dopo un secondo.

## Definition of Done
- Form con filtro in memoria istantaneo; nessun flicker da ricarica server.
- Test sez. C; tsc + build verdi. Aggiorna `DECISIONI_E_FEEDBACK.md` (T-18 ✅ confermato + nota ricerca istantanea).
- Commit `fix(invio): ricerca cliente istantanea nel form (filtro in memoria)`; `git push`; conferma `git log origin/master -1`.
