# PROMPT CODE — Ordine campi indirizzo: Città → Provincia → CAP (desktop e mobile)

> Incolla in Claude Code. **Leggi prima `CLAUDE.md`, `DECISIONI_E_FEEDBACK.md`, `DECISIONI_REDESIGN_MOBILE.md`.** Regole: tsc+build+test verdi; risposta sez. C; push a fine task. SOLO `master`, niente worktree.

## Obiettivo (decisione di Eli)
In TUTTE le schermate/form che chiedono l'indirizzo, i campi **Città, Provincia, CAP** devono comparire in **quest'ordine**: prima **Città**, poi **Provincia**, poi **CAP** (dall'alto verso il basso se impilati, da sinistra verso destra se in riga). Vale **sia su desktop sia su mobile** (stessi componenti responsive).

## Dove intervenire
File che usano i tre campi (hook `useComuneLookup`):
- `app/(app)/clienti/_components/ClientForm.tsx`
- `app/(app)/impostazioni/tabs/generali.tsx`
- `app/onboarding/page.tsx`

In ciascuno: riordinare il markup dei tre campi in **Città → Provincia → CAP**. NON cambiare i `name`/`id` dei campi né la logica di submit; cambia solo l'ordine visivo.

## Autocompletamento (verifica, già esistente)
`useComuneLookup` (`hooks/useComuneLookup.ts`) già fa: CAP 5 cifre → riempie Città+Provincia; Città (match) → riempie CAP+Provincia. **Mantenere invariato** questo comportamento dopo il riordino (è solo un riordino di markup, l'hook resta collegato agli stessi tre stati). Verificare che dopo lo spostamento l'autofill continui a funzionare nei tre form.

## Accettazione (browser)
In Nuovo/Modifica cliente, Impostazioni → Generale, e Onboarding: i campi compaiono nell'ordine Città, Provincia, CAP; l'autocompletamento continua a funzionare (digito CAP → si riempiono città+provincia; digito città → si riempiono CAP+provincia).

## Definition of Done
- Riordino applicato nei 3 file; autofill verificato per ispezione.
- Risposta sez. C; tsc+build+`npm test -- --run` verdi.
- Aggiorna `DECISIONI_REDESIGN_MOBILE.md` (sezione F: ordine campi → applicato anche desktop).
- Commit `fix(indirizzo): ordine campi Città → Provincia → CAP in clienti, impostazioni, onboarding`; `git push`; conferma `git log origin/master -1`.
