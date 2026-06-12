# PROMPT CODE — FIX 20: suggerimenti popup allineati al form (stessi risultati)

> Incolla in Claude Code. **Leggi prima `CLAUDE.md` e `DECISIONI_E_FEEDBACK.md` (non annullare ✅).** Regole: tsc+build verdi; sez. C; push a fine task. Solo `master`, niente worktree.

## Problema
Nel **popup invio**, a parità di lettera digitata, compaiono **meno** suggerimenti che nella sezione Cliente del form (alcuni clienti non appaiono).

## Causa probabile (da confermare)
`filterClients` in `SendEmailDialog.tsx` (`ClientSearchInput`) filtra **per singolo campo** (`field`): il campo Nome cerca solo su nome+cognome, NON sull'email. Il form (`ClientAutocomplete.tsx`, FIX-18) invece cerca su **nome+cognome+email insieme**, quindi trova più clienti per la stessa lettera. Verifica anche che `preloadClientsAction` restituisca la **stessa** lista in entrambi (stesso limite/ordinamento) — se uno dei due ha un `limit` più basso, allinearli.

## Fix atteso
Rendi i suggerimenti del popup **coerenti col form**: nel campo **Nome** del popup, la ricerca deve matchare su **nome + cognome + email** (case-insensitive, "contiene"), come fa `filterClients` del form. (Il campo Email può restare specifico sull'email, o anch'esso broad — scegli la coerenza migliore e segnalala.) Stesso limite massimo di risultati del form. Risultato: stessa lettera → stessi suggerimenti nel popup e nel form.

## Accettazione (browser, con clienti in rubrica, anche con nomi simili/doppioni)
Digitando la stessa lettera nel form e nel popup invio, compaiono **gli stessi** clienti.

## Definition of Done
- Filtro popup allineato al form; causa confermata.
- Test sez. C; tsc+build verdi. Aggiorna `DECISIONI_E_FEEDBACK.md` (T-18, popup ↔ form coerenti).
- Commit `fix(invio): suggerimenti popup allineati al form (stessi campi di ricerca)`; `git push`; conferma `git log origin/master -1`.
