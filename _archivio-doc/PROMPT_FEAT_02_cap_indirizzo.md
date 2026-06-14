# PROMPT CODE — FEATURE: auto-compilazione indirizzo dal CAP / comune (T-1)

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md` e `DECISIONI_E_FEEDBACK.md` (non annullare le voci ✅).** Regole: tsc+build verdi; formato sez. C; push a fine task. Lavora SOLO su `master`, niente worktree.

## Obiettivo (richiesta utente T-1)
Quando si inserisce un indirizzo, compilare **automaticamente** Comune e Provincia dal **CAP**; e se a un CAP corrispondono più comuni, far scegliere prima il **Comune** e poi auto-compilare Provincia (e CAP). Farlo **ovunque ci sia un indirizzo**.

## Dati già disponibili
`lib/data/comuni.ts` — array `COMUNI: [cap, comune, provincia][]` (7.904 comuni, un CAP principale per comune). ⚠️ È un file da **254 KB**: va usato **solo lato server** (mai importato in un client component — vedi OTT-4), altrimenti gonfia il bundle del browser.

## Passo 1 — Lookup server-side (no bundle client)
Crea un'azione/route server (es. `lib/actions/comuni.ts` con `'use server'`) che importa `COMUNI` e espone:
- `lookupComuniByCap(cap: string)` → lista di `{ comune, provincia }` per quel CAP (può essere 0, 1 o più).
- `searchComuni(query: string)` → lista di `{ cap, comune, provincia }` per nome comune (prefisso, max ~8 risultati).
Solo lettura in memoria sull'array (nessuna query DB). `COMUNI` non deve mai finire in un client component: importalo **solo** qui.

## Passo 2 — Collega ai 3 form con indirizzo
Applica a: `app/(app)/clienti/_components/ClientForm.tsx`, `app/(app)/impostazioni/tabs/generali.tsx`, `app/onboarding/page.tsx` (campi `indirizzo`, `cap`, `citta`, `provincia`).
Comportamento:
- **Da CAP:** quando l'utente ha digitato un CAP valido (5 cifre) — su `onBlur` o al 5° carattere — chiama `lookupComuniByCap`:
  - **1 risultato** → compila automaticamente **Comune** (`citta`) e **Provincia**.
  - **più risultati** → mostra un piccolo selettore (lista/`Select`) dei comuni di quel CAP; alla scelta, compila Comune + Provincia.
  - **0 risultati** → non fare nulla (lascia i campi liberi, niente errore bloccante).
- **Da Comune:** autocomplete sul campo Comune (riusa il **pattern tendina robusta di FIX-15**: `<ul>` assoluta, `onMouseDown`+`preventDefault`, niente Radix Popover) → digitando il nome compaiono i comuni; selezionandone uno, compila **CAP** e **Provincia**.
- **Non sovrascrivere** un valore già digitato a mano dall'utente senza che lui inneschi il lookup: in pratica, autocompila i campi **vuoti**; se l'utente cambia il CAP, puoi riproporre l'autocompletamento.
- Mobile-first (tocchi ≥40px), e nessun blocco se l'utente vuole inserire tutto a mano.

## Vincoli
- `comuni.ts` solo server-side; le chiamate dai form passano dall'azione server.
- Nessuna modifica ai dati salvati oltre a riempire i campi esistenti; nessuna nuova tabella.
- Non rompere il salvataggio esistente dei 3 form.

## Criteri di accettazione
1. Digito un CAP → Comune e Provincia si compilano da soli (o, se ambiguo, scelgo il comune e si completano).
2. Digito il nome del Comune → CAP e Provincia si compilano.
3. Funziona nei 3 form (cliente, impostazioni, onboarding); su mobile; senza bloccare l'inserimento manuale.
4. `comuni.ts` non finisce nel bundle client (verifica `npm run build`: nessun aumento anomalo del first-load JS dei form).
5. `tsc` + `build` verdi.

## Definition of Done
- Lookup server + collegamento nei 3 form; pattern tendina di FIX-15 riusato per il comune.
- Test sez. C; aggiorna T-1 in `DECISIONI_E_FEEDBACK.md`/`BACKLOG` (✅).
- Commit `feat(indirizzo): auto-compilazione comune/provincia da CAP (T-1)`; `git push`; conferma `git log origin/master -1`.
