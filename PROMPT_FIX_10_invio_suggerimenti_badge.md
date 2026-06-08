# PROMPT CODE — FIX 10: suggerimenti popup invio + badge "Modificata" sulle fatture

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md`.** Rispetta le regole CLAUDE.md (tsc + build verdi, formato risposta sez. C, aggiornare CLAUDE.md, commit conventional, push a fine task, mai dichiarare risolto senza causa confermata nel codice).
> Lavora SOLO su `master` in `C:\Users\Public\carta-canta` — niente worktree, niente branch `claude/*`.
> Due punti emersi testando. Cause indicate sotto: **per il CHECK-A confermala prima di toccare; il CHECK-B è un fix sicuro.**

---

## CHECK-A — Suggerimenti contatti spariti nel popup di invio (cliente non ancora selezionato)
**Sintomo:** aprendo "Invia al cliente" su un documento **senza cliente**, digitando ≥2 lettere nel campo **Nome** o **Email** non compaiono più i suggerimenti dei contatti esistenti (prima comparivano).
**Da confermare prima di correggere:** in `app/(app)/preventivi/_components/SendEmailDialog.tsx`:
- I contatti vengono pre-caricati in `handleOpenChange` con `preloadClientsAction()` **solo se `!hasClient`** (≈ riga 300) e salvati in `allClients`.
- I campi Nome ed Email usano `ClientSearchInput`, che mostra i suggerimenti tramite `filterClients(value, allClients, field)` (≈ righe 474 e 525).
**Verifica (in quest'ordine):**
1. Il documento di test **aveva già un cliente associato**? Se sì, `hasClient = true` → la variante con autocomplete non viene mostrata: in tal caso è **comportamento previsto**, segnalalo e NON modificare nulla.
2. Se invece il documento non ha cliente (`hasClient = false`): controlla che `preloadClientsAction()` ritorni davvero i contatti (non array vuoto/errore) e che `filterClients` produca risultati per ≥2 caratteri. Se è rotto (es. `allClients` resta vuoto, o un cambio recente ha spezzato `onChange`/`filterClients`), **correggi** ripristinando i suggerimenti. NON cambiare la logica `selectedClientId`/wrapper introdotta da FIX-08 (serve a evitare il falso conflitto): i suggerimenti devono funzionare **insieme** ad essa.
**Accettazione:** su un documento senza cliente, digitando ≥2 lettere nel Nome o nell'Email compaiono di nuovo i suggerimenti dei contatti; selezionandone uno, l'invio resta senza falso conflitto (regressione FIX-08 non reintrodotta).

---

## CHECK-B — Badge "Modificato" deve essere "Modificata" sulle fatture
**Sintomo:** sulle fatture compare il badge/testo **"Modificato"** (maschile). Per le fatture va al femminile: **"Modificata"**.
**Causa confermata:** l'etichetta è hardcoded "Modificato" in più punti:
- `app/(app)/fatture/page.tsx` (≈ riga 234)
- `app/(app)/dashboard/page.tsx` (≈ riga 560) — feed attività misto preventivi+fatture
- eventuali banner di dettaglio "… modificato — non ancora reinviato" in `app/(app)/fatture/[id]/page.tsx`
- (`app/(app)/preventivi/page.tsx` ≈ riga 443 e `preventivi/[id]` restano "Modificato" — sono preventivi)
**Fix atteso:** rendere l'etichetta dipendente dal tipo documento → **fattura = "Modificata"**, preventivo = "Modificato". In dashboard (feed misto) usa `doc.doc_type` per scegliere il genere riga per riga. Verifica anche eventuali testi "modificato" nei banner del dettaglio fattura e mettili al femminile. Solo testo visibile, nessun cambiamento ai dati.
**Accettazione:** una fattura modificata dopo l'invio mostra "Modificata" (lista fatture, dashboard, dettaglio); i preventivi restano "Modificato".

---

## Criteri di accettazione globali
1. CHECK-A: suggerimenti contatti di nuovo presenti nel popup invio per documenti senza cliente (oppure confermato che era comportamento previsto perché il doc aveva già un cliente).
2. CHECK-B: "Modificata" sulle fatture, "Modificato" sui preventivi, ovunque compaia il badge.
3. Nessun dato cambiato; nessuna nuova tabella; nessuna regressione su FIX-08 (conflitto cliente).
4. `npx tsc --noEmit` e `npm run build` verdi.

## Definition of Done
- CHECK-A confermato (corretto o "previsto") e CHECK-B implementato; causa/file/riga citati.
- Test in formato sez. C di CLAUDE.md.
- CLAUDE.md aggiornato; commit `fix(invio): suggerimenti popup + badge Modificata su fatture`.
- A fine task: `git push` e conferma che `git log origin/master --oneline -1` mostra il nuovo commit.
