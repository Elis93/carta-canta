# PROMPT CODE — FEATURE: clic sul cliente nel preventivo → apre la sua scheda (T-11)

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md` e `DECISIONI_E_FEEDBACK.md` (non annullare le voci ✅).** Regole: tsc+build verdi; formato sez. C; push a fine task. Lavora SOLO su `master`, niente worktree.

## Obiettivo (richiesta utente T-11)
Quando un cliente è selezionato in un preventivo/fattura, deve essere possibile **aprire la sua scheda** (`/clienti/[id]`) per modificarne i contatti, con un clic — senza dover andare a cercarlo nella rubrica.

## Cosa fare
- Individua dove viene mostrato il **cliente selezionato** nel form (`ClientAutocomplete` in `PreventivoForm.tsx` / `components/shared/ClientAutocomplete.tsx`): quando c'è un cliente scelto si vede nome + email + una "X" per rimuoverlo.
- Aggiungi, accanto al cliente selezionato, un **link/icona "Apri scheda"** (icona tipo `UserRound`/`ExternalLink` + tooltip) che porta a **`/clienti/[clientId]`**.
  - Aprilo in una **nuova scheda** (`target="_blank"`), così l'utente non perde il preventivo che sta compilando (evita la perdita di modifiche non salvate del form). In alternativa, se il form non ha modifiche non salvate, naviga normalmente.
- Il link deve comparire **solo quando un cliente è effettivamente selezionato** (ha un `id`). Non per i clienti "al volo" non ancora salvati.
- Mobile-first: l'icona deve essere ben toccabile (≥40px) e non rompere il layout del campo Cliente.

## Vincoli
- Non cambiare la logica di selezione/associazione cliente esistente (FIX-08 `selectedClientId`, ecc.).
- Non esporre dati personali oltre a quanto già mostrato.
- Solo aggiunta UI + link; nessun nuovo dato salvato, nessuna tabella.

## Criteri di accettazione
1. Con un cliente selezionato nel preventivo/fattura, un clic apre `/clienti/[id]` (nuova scheda) dove posso modificarne i contatti.
2. Senza cliente selezionato il link non c'è.
3. Nessuna regressione su selezione cliente / invio; `tsc` + `build` verdi.

## Definition of Done
- Feature implementata; file/righe citati.
- Test sez. C; aggiorna T-11 in `DECISIONI_E_FEEDBACK.md`/`BACKLOG` (✅).
- Commit `feat(clienti): apri scheda cliente dal preventivo/fattura (T-11)`; `git push`; conferma `git log origin/master -1`.
