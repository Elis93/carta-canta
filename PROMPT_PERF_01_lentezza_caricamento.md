# PROMPT CODE — PERF 01: lentezza di caricamento (T-9 / T-22)

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md` e `DECISIONI_E_FEEDBACK.md`.** Regole: tsc+build verdi; formato sez. C; push a fine task. Lavora SOLO su `master`, niente worktree.
> **MISURA prima di ottimizzare.** Niente cambi di comportamento: solo rendere più veloce ciò che già fa.

## Contesto
L'utente segnala pagine lente e, su una fattura, un **errore con caricamento solo dopo ~20s** al riapri (sintomo tipico di **cold start serverless su Vercel**). Va capito dove si perde tempo e applicate ottimizzazioni **sicure**.

## Passo 1 — Misura / diagnosi (riporta nel report)
1. `npm run build` e guarda l'output: quali route hanno bundle/first-load JS grandi? Quali sono dinamiche (ƒ) e potenzialmente lente?
2. Individua nelle pagine pesanti (almeno: `app/(app)/dashboard/page.tsx`, `app/(app)/preventivi/[id]/page.tsx`, `app/(app)/fatture/[id]/page.tsx`, `app/p/[token]/page.tsx`) le query Supabase eseguite in **sequenza** con `await` una dopo l'altra ma **indipendenti** tra loro.
3. Verifica se sul caricamento pagina viene fatto lavoro pesante sincrono (es. generazione HTML PDF `buildPdfHtml`, import di moduli grandi).

## Passo 2 — Ottimizzazioni SICURE (nessun cambio di comportamento)
1. **Parallelizza** le query Supabase indipendenti con `Promise.all([...])` (oggi spesso sono `await` sequenziali). Esempio tipico nelle pagine di dettaglio: workspace, templates, documento, cliente — quelle che non dipendono l'una dall'altra vanno lanciate insieme. Mantieni identica la logica e i dati.
2. Se una pagina genera `buildPdfHtml` lato server al solo scopo di anteprima, valuta di **differirla** (caricarla on-demand quando serve l'anteprima) invece che al primo render — solo se non cambia il comportamento visibile.
3. **Cold start** (errore-poi-ok-dopo-20s): valuta un **cron "warm ping"** leggero (riusa il pattern `/api/cron/*` già presente) che tiene calde le funzioni critiche, oppure documenta che è un limite del piano e va monitorato. NON introdurre service worker / caching aggressivo.
4. Controlla che moduli grandi (es. `lib/data/comuni.ts`, dipendenze AI/PDF `@sparticuz/chromium`/`puppeteer-core`/`playwright-core`) **non** finiscano nel bundle client: devono restare server-only / import dinamico. (Le deps PDF servono solo all'AI import disattivato → confermare che non pesano sul runtime delle pagine; eventuale rimozione SOLO se non importate da codice attivo — OTT-2.)

## Vincoli
- **Nessun cambio di comportamento/UX**: solo velocità.
- Non rompere la generazione PDF/anteprima né l'AI import (anche se disattivato).
- Se un'ottimizzazione è rischiosa o cambia il comportamento, **non farla**: segnalala come proposta.

## Definition of Done
- Report con: route lente individuate, query parallelizzate (file/righe), e cosa NON hai toccato e perché.
- `tsc` + `build` verdi; nessuna regressione funzionale.
- CLAUDE.md aggiornato; aggiorna T-9/T-22 in `DECISIONI_E_FEEDBACK.md`/`BACKLOG`.
- Commit `perf: parallelizza query pagine dettaglio + diagnosi cold start`; `git push`; conferma `git log origin/master -1`.
