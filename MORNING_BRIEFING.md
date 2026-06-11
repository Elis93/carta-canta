# ☀️ BRIEFING DEL MATTINO — sessione notturna (per Eli)

> Riepilogo di cosa ho fatto stanotte e cosa fare al risveglio. Tutto è pronto da incollare a Code.

## ⚠️ Premessa onesta
Da Cowork **non posso fare `git push`** (mancano le credenziali GitHub in questo ambiente: i push li fa Code dal tuo PC). Non posso nemmeno far girare build/test in modo affidabile. Quindi **non ho toccato il codice di produzione** — sarebbe stato codice non testato e non pushabile, cioè a rischio di perdita (proprio ciò che evitiamo). Ho invece fatto la cosa di massimo valore e a rischio zero: **verificato l'ultimo lavoro, diagnosticato i bug rimasti, e lasciato pronti i prompt** (file su disco che Code esegue e pusha). Così stamattina sei subito operativa.

## ✅ Cosa ho verificato
- **FIX-13** (commit `815c823`) — verificato nel codice, **corretto**: testo email "scrivimi a {email}"; `?send` rimosso dall'URL (niente popup al reload); `Input` ora `forwardRef` + tendina suggerimenti con `PopoverAnchor`/`onInteractOutside` (approccio giusto); "Importa da preventivo" sempre visibile; guardia server che blocca l'invio senza voci complete.
  - 🟡 **Da confermare nel tuo test**, soprattutto i **suggerimenti cliente (T-18)**: erano già stati dati per risolti una volta e poi non funzionavano. Controllali bene.

## 🔍 Cosa ho diagnosticato (bug/cause trovate stanotte)
- **T-21a [BUG]** — l'avviso "Nessun template disponibile" è **fuorviante**: il template Classico è sempre disponibile, il documento si genera comunque. Va tolto/ammorbidito. (Solo nei preventivi, non nelle fatture.) → `PROMPT_FIX_14`.
- **T-9 / T-22 [lentezza]** — l'errore-poi-ok-dopo-20s è un **cold start di Vercel**; `comuni.ts` e le deps PDF NON sono la causa (non sono nel bundle delle pagine). Va misurato e poi ottimizzato (parallelizzare query, warm-ping). → `PROMPT_PERF_01`.
- **MOB-3 [rischio]** — in **creazione** preventivo non c'è autosalvataggio (solo in modifica): chiudendo la pagina a metà si perdono i dati. Da affrontare (backlog).

## 📋 Ordine consigliato al risveglio (incolla a Code uno alla volta)
**Passo 0 — metti al sicuro su GitHub TUTTI i documenti di stanotte (sono solo locali, non ancora pushati):** fai fare a Code: `git status` per vederli, poi `git add` dei .md nuovi/aggiornati (MORNING_BRIEFING, PROMPT_FIX_14, PROMPT_PERF_01, PROMPT_FEAT_01, PROMPT_IMPROVE_catalogo_autocomplete, DECISIONI_E_FEEDBACK, BACKLOG_MIGLIORAMENTI) → commit "docs: sessione notturna — prompt FIX-14/PERF-01/FEAT-01 + registro" → `git push`. **Importante: senza questo passo i prompt di stanotte restano solo sul disco e potrebbero perdersi.**

Poi, uno alla volta:
1. **`PROMPT_FIX_14_template_e_invio_ux.md`** — bug "nessun template" + UX (veloce).
2. **`PROMPT_PERF_01_lentezza_caricamento.md`** — lentezza (misura → ottimizza).
3. **`PROMPT_IMPROVE_catalogo_autocomplete.md`** — **la feature**: catalogo che si riempie da solo + autocompletamento voci (la leva che fa risparmiare più tempo). L'ho arricchita col pattern tendina-a-portale imparato da T-18.
4. (extra, quick win) **`PROMPT_FEAT_01_click_cliente.md`** — clic sul cliente nel preventivo → apre la sua scheda (T-11, me l'avevi chiesta).

Frase per Code (per ciascuno): «Lavora SOLO su master in C:\Users\Public\carta-canta (niente worktree). Committa+pusha i file nuovi, poi leggi ed esegui PROMPT_xxx.md. Rispetta DECISIONI_E_FEEDBACK.md (non annullare le voci ✅). tsc+build (+test se tocchi voci) verdi. A fine task git push e conferma git log origin/master -1.»

## 🧪 Da testare (quando puoi) — priorità ai fix non confermati
Soprattutto **FIX-13**: (1) suggerimenti cliente che **compaiono e restano** nel popup invio e nel form; (2) reload di una bozza non riapre il popup; (3) "Importa da preventivo" visibile su mobile; (4) email "scrivimi a…"; (5) impossibile inviare un preventivo senza voci complete.
Poi la lista cumulativa già nota (FIX-02→12 + IMPROVE + PWA).

## 📌 Stato generale
Fatto e online: tutta la coda bug (FIX-01→13), IMPROVE, PWA, registro decisioni/feedback. Pronti: FIX-14, PERF-01, feature catalogo. Da fare dopo: UX mobile (T-3 margini, T-17 riepilogo voci — meglio quando puoi guardare e iterare), feature T-1 (CAP→indirizzo), T-11 (click cliente→scheda), T-2 (ATECO più completi), MOB-1b (invito a installare), MOB-3 (autosave in creazione).
