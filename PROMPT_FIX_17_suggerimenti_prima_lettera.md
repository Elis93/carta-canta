# PROMPT CODE — FIX 17: suggerimenti cliente dalla 1ª lettera + niente flicker

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md` e `DECISIONI_E_FEEDBACK.md`.** Regole: tsc+build verdi; formato sez. C; push a fine task. Lavora SOLO su `master`, niente worktree.

## Richiesta utente
I suggerimenti cliente devono comparire **fin dalla prima lettera** (oggi nel popup invio servono 2 lettere). Inoltre la tendina non deve "lampeggiare" (comparire un attimo e sparire) digitando.

## Cosa fare
1. **Soglia a 1 lettera nel popup invio** (`app/(app)/preventivi/_components/SendEmailDialog.tsx`, `ClientSearchInput`):
   - `filterClients`: cambia `if (query.trim().length < 2) return []` → `< 1` (cioè: filtra già da 1 carattere; `''` resta vuoto).
   - `isOpen`: cambia `value.trim().length >= 2` → `>= 1`.
   - **[CAUSA PRINCIPALE] Ricerca form rotta** (`lib/actions/clients.ts`, `searchClientsAction`): oggi usa `.textSearch('search_vector', query, { type: 'websearch', config: 'italian' })` → il full-text matcha **parole intere**, non prefissi/sottostringhe: digitando "Ma" NON trova "Mario" → "Nessun cliente trovato" anche se il cliente esiste. **Sostituisci** la `textSearch` con una ricerca "contiene" su più campi, es. `.or('name.ilike.%Q%,surname.ilike.%Q%,email.ilike.%Q%,piva.ilike.%Q%')` (Q = query, con escape del `%`/`,` se serve). Così funziona da 1 lettera. Mantieni `eq('workspace_id', …)` e `limit(10)`.
2. **Niente flicker/auto-chiusura mentre si digita:** verifica che, con l'input a fuoco e mentre si digita (anche 1 sola lettera), la tendina **resti aperta** e non si chiuda da sola dopo un istante. In particolare controlla che:
   - `useAnchorRect`/`rect` non diventi `null` durante gli aggiornamenti (la condizione `{open && rect && createPortal(...)}` non deve perdere il `rect` mentre si digita);
   - `useCloseOnOutsideMouseDown` non scatti per eventi che non sono un vero clic fuori (la lista è nel portale: assicurati che `listRef` sia incluso nei ref "interni" così un'interazione sulla lista non la chiude);
   - nessun `onBlur` chiuda la tendina mentre il focus è ancora nell'input.
   Se trovi la causa del flicker, correggila; se non c'è flicker reale (era solo il passaggio tra "Ricerca…" e risultati), segnalalo.

## Criteri di accettazione (UI — verifica nel browser con almeno 2-3 clienti in rubrica)
1. Digitando **1 sola lettera** del nome di un cliente esistente, il suggerimento compare e **resta** (sia nel form sia nel popup invio).
2. Nessun lampeggio: la tendina non sparisce da sola mentre si digita.
3. Nessuna regressione su selezione cliente (FIX-08) / invio. `tsc` + `build` verdi.

## Definition of Done
- Soglia a 1 lettera applicata; flicker verificato/corretto.
- Test sez. C; T-18 resta **🟡 "da riconfermare nel browser"** finché Eli non conferma.
- Commit `fix(invio): suggerimenti cliente dalla prima lettera + no flicker`; `git push`; conferma `git log origin/master -1`.
