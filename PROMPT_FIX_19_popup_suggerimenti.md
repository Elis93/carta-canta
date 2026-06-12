# PROMPT CODE — FIX 19: suggerimenti cliente assenti nel popup invio

> Incolla in Claude Code. **Leggi prima `CLAUDE.md` e `DECISIONI_E_FEEDBACK.md` (non annullare ✅).** Regole: tsc+build verdi; sez. C; push a fine task. Solo `master`, niente worktree.

## Problema
Nel **popup di invio** (`SendEmailDialog.tsx`, `ClientSearchInput`) NON compare alcun suggerimento, mentre nel form preventivo ora funziona. La tendina/portale e le soglie sono ok (FIX-16/17); il problema è che **`allClients` resta vuoto**.

## Causa probabile (da confermare)
`preloadClientsAction()` viene chiamata solo dentro `handleOpenChange` (`if (!hasClient)`). Ma il dialog può aprirsi in modo **programmatico/controllato** (es. `initialOpen`/`SendEmailDialogController`, apertura via `?send`), e in quel caso `handleOpenChange` **non scatta** → `setAllClients` non viene mai chiamato → nessun suggerimento. (Nel form `ClientAutocomplete` invece funziona perché precarica in un `useEffect` al mount — FIX-18.)

## Fix atteso
Rendi il precaricamento **robusto e indipendente** da `handleOpenChange`: aggiungi un `useEffect` in `SendEmailDialog` che, quando il dialog è **aperto** e **`!hasClient`** e `allClients` è ancora vuoto, chiama `preloadClientsAction().then(setAllClients)`. Così i clienti si caricano sia all'apertura manuale sia a quella automatica. (Puoi lasciare anche la chiamata in `handleOpenChange`, o rimuoverla in favore del solo `useEffect`.)

## Accettazione (browser, con clienti in rubrica)
Aprendo "Invia al cliente" su un documento **senza** cliente, digitando 1 lettera nel campo Nome/Email i suggerimenti **compaiono e restano** (come nel form).

## Definition of Done
- Precaricamento via `useEffect`; causa confermata.
- Test sez. C; tsc+build verdi. Aggiorna `DECISIONI_E_FEEDBACK.md` (T-18 resta 🟡 finché Eli conferma il popup).
- Commit `fix(invio): precarica clienti nel popup via useEffect (suggerimenti popup)`; `git push`; conferma `git log origin/master -1`.
