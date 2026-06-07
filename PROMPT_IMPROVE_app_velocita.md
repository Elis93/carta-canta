# PROMPT CODE — MIGLIORAMENTI app attuale: velocità, semplicità, automazione (oltre ai bug)

> Incolla in Claude Code. Autocontenuto. **Leggi prima `CLAUDE.md` e `MAPPA_APP.md`.** Rispetta le regole CLAUDE.md (tsc + build verdi, formato sez. C, aggiornare CLAUDE.md, mobile-first, commit conventional).
> **Da applicare DOPO i fix `PROMPT_FIX_01→05`** (alcuni punti si coordinano con FIX-15 e FIX-19).
>
> ## OBIETTIVO (vincolante — non uscirne)
> Target: **artigiani 20–70 anni, poco avvezzi alla tecnologia, che non vogliono perdere tempo.** Questo intervento serve SOLO a rendere **più veloce e semplice ciò che l'app già fa** (preventivi, fatture, clienti, reminder). **Regole assolute:**
> - **NON aggiungere nuove feature, nuove pagine o nuove tabelle.** Solo: riordinare, nascondere il superfluo, dare default sensati, semplificare le etichette.
> - **NON rimuovere campi né cambiare i dati salvati** (`name=...`, payload, server action invariati): si cambia solo cosa è **visibile** e **l'ordine**.
> - Tutto deve restare **mobile-first** (test a 360px), con tocchi grandi (≥40px).
> - Se un punto richiede più di un riordino/CSS/condizione, **fermati e segnalalo** invece di improvvisare.

---

## M1 — Form preventivo/fattura: "essenziale visibile, resto sotto «Altre opzioni»"
**Dove:** `app/(app)/preventivi/_components/PreventivoForm.tsx`, sezione "Informazioni" (attualmente righe ~488–707) e, identica logica, `app/(app)/fatture/_components/FatturaForm.tsx`.
**Problema:** il form mostra subito troppi campi (Numero, Oggetto, Cliente, Template, Note pubbliche, Note interne, Validità, Termini, Bonus edilizio). Per un artigiano è troppo: il percorso veloce è **cliente → voci → invia**.
**Come, esattamente:**
- **Restano SEMPRE visibili, in quest'ordine:** campo **Cliente** (`ClientAutocomplete`), poi la sezione **VOCI** (già sotto), poi **RIEPILOGO**, poi i bottoni Salva bozza / Invia.
- **Spostare dentro un blocco collassabile «Altre opzioni» (CHIUSO di default)** questi campi che oggi sono sempre visibili: **Oggetto**, **Template**, **Note (visibili al cliente)**, **Note interne**, **Validità (giorni)**, **Termini di pagamento**, **Bonus edilizio**, e — **solo per i preventivi** — **Numero preventivo** (è opzionale/auto).
  - **Eccezione fattura:** "Numero fattura" è obbligatorio → per le FATTURE resta visibile (NON collassato). Per i PREVENTIVI il numero va dentro "Altre opzioni".
- **Implementazione:** usare il componente esistente `components/ui/accordion.tsx` (oppure `<details>/<summary>` nativo se più semplice). Testo dell'intestazione: **«Altre opzioni (numero, titolo, validità, pagamento, note, template)»**.
- **Stato iniziale:** chiuso in creazione. In **modifica** di un documento esistente: se almeno uno di quei campi ha un valore diverso dal default (note non vuote, validità ≠ default workspace, bonus attivo, template non Classico…), **aprire** il blocco di default così l'utente vede che contiene dati.
- I campi nascosti **restano nel DOM e nel submit** (niente unmount che perde i valori): nascondere via accordion, non rimuovere.
**Accettazione:** aprendo "Nuovo preventivo" vedo in cima solo Cliente + Voci + Riepilogo + bottoni; "Altre opzioni" chiuso; aprendolo trovo tutti i campi di prima, funzionanti; salvataggio identico a prima. Su 360px il form sta in poche schermate.

## M2 — Prima voce pronta + focus immediato
**Dove:** `app/(app)/preventivi/_components/VociTable.tsx` (coordinare con FIX-19: Q.tà default = 1).
**Come:** all'apertura di "Nuovo preventivo" deve già esserci **una riga voce vuota** (è già così) con **Q.tà = 1**, e il **focus automatico** sul campo **Descrizione** della prima voce (autoFocus o `useEffect` con `ref.focus()` al mount, solo in create mode). Verificare che il pulsante **microfono di dettatura** accanto alla descrizione abbia area di tocco ≥40px su mobile.
**Accettazione:** aprendo nuovo preventivo il cursore è già nella descrizione della prima voce; Q.tà = 1; microfono ben toccabile.

## M3 — Dashboard "azioni prima, numeri dopo"
**Dove:** `app/(app)/dashboard/page.tsx` (riordino di sezioni ESISTENTI, NON creare nuove sezioni/dati).
**Come, esattamente:** cambiare l'ordine verticale dei blocchi già presenti:
1. **In cima: il blocco azioni** — l'attuale "Prossima scadenza" (con "Sollecita via email") va spostato **sopra** le card KPI. È ciò su cui l'artigiano deve agire.
2. **Sotto: le KPI** (Preventivi accettati, Valore preventivi, Valore fatturato, Bozze) come riepilogo, con etichetta **"questo mese"** (coordinato con FIX-15; niente "-100%" aggressivo a inizio mese).
3. **In fondo:** grafico "Andamento" e "Attività recente" come sono.
**Accettazione:** aprendo la dashboard la prima cosa visibile è "cosa devo fare" (scadenze/solleciti), non le percentuali.

## M4 — Azioni rapide a un tocco (meno passaggi) — verificare l'esistente e renderlo prominente
**Dove:** `app/(app)/preventivi/[id]/page.tsx`, liste, client detail. **NON duplicare logica**: queste azioni esistono già, vanno rese evidenti e a un tocco.
- **Preventivo accettato →** il bottone **"Crea fattura"** (conversione già esistente) deve essere l'**azione primaria** (stile bottone pieno) nella barra del preventivo accettato.
- **Preventivo in attesa →** "Sollecita via email" resta a un tocco (già c'è).
- **Ripescare/ripetere un cliente →** "Nuovo preventivo per questo cliente" (client detail) e "Duplica" (`DuplicateDocumentButton`) devono essere visibili e a un tocco.
**Accettazione:** da un preventivo accettato creo la fattura in **1 tocco**; da un cliente rifaccio un preventivo simile in **1–2 tocchi**.

## M5 — Automazioni ON di default (verifica, non reintrodurre attrito)
**Dove:** `app/(app)/impostazioni/tabs/notifiche.tsx` e creazione workspace / default `notification_prefs`.
**Come:** **verificare** che per un **nuovo** workspace tutte le notifiche/automazioni siano **ON di default**, in particolare **"Reminder automatico al cliente (1 giorno prima della scadenza)"**. È l'automazione che fa risparmiare tempo: deve essere attiva senza che l'utente la cerchi. Se il default non è ON, **renderlo ON**. (Non aggiungere nuove notifiche.)
**Accettazione:** un account appena creato ha già i reminder automatici attivi.

## M6 — Etichette più semplici per chi non è tecnico
**Dove:** label visibili nei form/dialog. **Cambiare SOLO le label visibili, MAI gli attributi `name`/`id`/payload.**
- "Oggetto" → **"Titolo del lavoro"**.
- "Validità (giorni)" → **"Il preventivo vale (giorni)"**.
- Rimuovere eventuale gergo tecnico/inglese dalle UI rivolte all'utente.
- Mantenere coerenza con i fix di coerenza fatture (FIX_02): niente "validità" sulle fatture.
**Accettazione:** le etichette sono comprensibili a un non-tecnico; nessun termine tecnico/inglese in UI; nessun cambiamento ai dati salvati.

---

## Criteri di accettazione globali
1. Il percorso "fai un preventivo" è più corto: **Cliente → Voci → Invia**, col resto sotto "Altre opzioni".
2. Nessuna funzione persa, nessun dato perso: salvataggi e invii identici a prima.
3. Dashboard orientata all'azione; automazioni ON di default; azioni quotidiane a 1–2 tocchi.
4. Mobile-first a 360px verificato; tocchi ≥40px.
5. `npx tsc --noEmit` e `npm run build` verdi.

## Definition of Done
- Ogni punto M1–M6 implementato come specificato (nessuna nuova feature/pagina/tabella).
- Test descritti (sez. C CLAUDE.md), inclusi screenshot mobile di: nuovo preventivo (form snellito) e dashboard riordinata.
- CLAUDE.md aggiornato.
- Commit `refactor(ux): form snellito + dashboard azioni + automazioni default + copy semplice`.

> Se un punto risultasse più invasivo del previsto (es. M1 su FatturaForm con struttura diversa), implementa prima i punti sicuri e **segnala** quello dubbio invece di forzare: meglio parziale e corretto che completo e fuori obiettivo.
