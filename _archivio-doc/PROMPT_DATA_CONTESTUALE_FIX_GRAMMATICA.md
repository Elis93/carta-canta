# PROMPT CODE — Data contestuale: grammatica femminile per le fatture (bozza)

> Incolla in Claude Code. **Leggi prima `CLAUDE.md` e `DECISIONI_E_FEEDBACK.md` (non annullare le voci ✅).** Regole: `npx tsc --noEmit` + `npm run build` verdi prima del commit; risposta nel formato sez. C; push a fine task. Lavora SOLO su `master`, niente worktree.

## Problema
In `lib/utils/document-date.ts` (`getContextualDate`), il caso **bozza** (`draft`, ultima riga) ritorna sempre `"Modificato il {updated_at}"` al **maschile**, ignorando `docType`. Per una **fattura** in bozza dovrebbe dire `"Modificata il {updated_at}"` (femminile), coerente con tutti gli altri stati che sono già differenziati per genere (Pagata/Scaduta/Inviata/Annullata).

## Fix
- Nel branch `draft`, rendi la stringa dipendente da `docType`:
  - fattura → `"Modificata il {updated_at}"`
  - preventivo → `"Modificato il {updated_at}"`
- **Verifica l'intero helper**: ogni altra stringa deve già essere coerente col genere per `docType`. Controlla in particolare il caso `rejected` — assicurati che per la fattura sia `"Annullata il …"` e per il preventivo `"Rifiutato il …"` (NON deve esserci un "Rifiutata"/"Annullato" misto). Se trovi altre incongruenze di genere, correggile nello stesso commit.

## Vincoli
- Solo testo/grammatica. Nessun cambio alla logica di scelta della data, ai colori/urgenza, alle select o al rendering delle liste.
- Nessuna migration.

## Accettazione (browser)
Una fattura in bozza nella lista mostra "Modificata il …"; un preventivo in bozza mostra "Modificato il …". Tutti gli altri stati restano corretti per genere in entrambe le liste.

## Definition of Done
- Branch `draft` differenziato per `docType`; resto dell'helper verificato per coerenza di genere.
- Risposta nel formato sez. C; `tsc` + `build` verdi.
- Aggiorna `DECISIONI_E_FEEDBACK.md` (nota nella voce "Data contestuale": grammatica femminile fatture).
- Commit `fix(liste): grammatica femminile per le fatture nella data contestuale (bozza)`; `git push`; conferma con `git log origin/master -1`.
