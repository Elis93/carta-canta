# 📒 REGISTRO AGGIORNAMENTI — Carta Canta

> **Chi tiene questo file:** **Code Mobile** (l'assistente Claude che lavora sulla parte **mobile** dell'app, in coppia con Eli).
> **Cosa contiene:** TUTTO quello che ho fatto io — modifiche apportate, bug trovati/risolti, feedback ricevuti da Eli e come li ho recepiti, con l'esito di ogni intervento.
> **Regola:** ordino per data, dalla più recente in cima. A fine di ogni intervento aggiungo qui la voce, poi `git push` su `origin/master` (→ deploy Vercel).
> **Legenda esito:** ✅ verificato in browser da Eli · 🟡 fix applicato (tsc+build+test verdi, da verificare da Eli) · ⏳ in corso · ❌ aperto.
>
> Nota: questo è il changelog "operativo" di Code Mobile. Le **decisioni** stanno in `DECISIONI_E_FEEDBACK.md`/`DECISIONI_UI_CONSOLIDATE.md`, la **revisione UI** in `REVISIONE_UI.md`, le **regole/handoff** in `CLAUDE.md`. Qui c'è il "cosa ho cambiato e perché".

---

## 29 giugno 2026 — Sessione Dettaglio preventivo + Pop-up Condividi (Code Mobile)

Metodo: Eli è il giudice visivo (screenshot dal telefono); io leggo sempre il codice reale, replico il mockup **al pixel** (`mockup-mobile/Carta_Canta_mockup_app.html` + `DESIGN_TOKENS.md`), e pubblico su `master` (Vercel). Eli ha autorizzato il push diretto su `master` (nessun cliente reale ancora).

### `56bdc0e` — Pop-up: anche "Copia" fa ripartire la validità (scaduto) 🟡
- **Feedback Eli:** per un preventivo scaduto anche il pulsante "Copia" deve far ripartire la scadenza, con un avviso.
- **Fatto:** in `ShareButton.copyLink`, se il preventivo è scaduto: copia il link + chiama `resendExpiredAction` (reimposta scadenza + stato Inviato) + toast "Link copiato. La validità riparte: scade tra N giorni." + chiude il pop-up. Negli altri stati "Copia" resta semplice copia.
- **File:** `app/(app)/preventivi/_components/ShareButton.tsx`.

### (docs) — Rimando a questo registro in RIPARTI_QUI + verifica og:image
- Aggiunto in `RIPARTI_QUI.md` (sez. 1, voce 4-bis) il rimando a `REGISTRO_AGGIORNAMENTI.md`.
- **Verifica og:image (29 giu):** letto l'HTML LIVE di `cartacanta.app/p/[token]` via Vercel → la metadata è corretta (`og:image = https://cartacanta.app/og-logo-firma.png`, `og:title "Preventivo N · Azienda"`). L'immagine risponde 200. Quindi il "vecchio logo CC" che si vede su WhatsApp è **solo la cache di WhatsApp** (anteprima salvata al primo invio, prima della fix): si aggiorna con un link NUOVO o forzando il re-scrape dal Meta Sharing Debugger.

### `f5ee961` — Anteprima link WhatsApp = logo "firma" nuovo (og:image) 🟡
- **Feedback Eli:** nell'anteprima del link su WhatsApp deve comparire il logo nuovo (quello della Home), non l'icona "CC".
- **Bug/causa:** la pagina pubblica `/p/[token]` non aveva metadata Open Graph → WhatsApp ripiegava sull'icona app.
- **Fatto:** aggiunto `generateMetadata` alla pagina pubblica con `og:image` = logo firma, titolo "{Preventivo N · Azienda}" + descrizione. Asset copiato in `public/og-logo-firma.png`.
- **File:** `app/p/[token]/page.tsx`, `public/og-logo-firma.png` (nuovo).
- **Nota:** WhatsApp tiene in cache le anteprime → si vede solo su condivisioni NUOVE. Immagine attuale 900×210 (logo originale); eventuale "card" 1200×630 da fare se Eli vuole.

### `671327f` — Pop-up: X di chiusura + rinvio scaduto con scadenza a scelta 🟡
- **Feedback Eli:** (1) togliere il trattino grigio in alto (sembra trascinabile ma non lo è) e mettere una X per chiudere; (2) per lo scaduto "Rinvia al cliente" deve permettere di scegliere a mano tra quanti giorni scade.
- **Fatto:** rimossa la maniglia, aggiunta **X** in alto a destra. Per gli scaduti il pop-up mostra un menu a tendina **"Nuova scadenza"** (15/30/45/60/90 gg). Nuova server action `resendExpiredAction(documentId, validityDays)` (reimposta `expires_at` + stato sent, **senza** consumare quota Free). `ShareButton`: prop `isExpired` + `defaultValidityDays`.
- **File:** `ShareButton.tsx`, `app/(app)/preventivi/[id]/page.tsx`, `lib/actions/documents.ts`.

### `89011ec` — Pop-up Invia/Condividi → bottom-sheet (mockup) 🟡
- **Bug trovato:** il dialog centrato si tagliava a destra con nomi cliente lunghi → "Altre app" finiva fuori schermo.
- **Fatto:** sostituito il Dialog centrato con un **bottom-sheet** pixel dal mockup "Pop-up — Invia / Condividi": overlay scuro, sheet ancorato in basso (radius 22 in alto, ombra verso l'alto), 3 canali a piena larghezza (WhatsApp/Email/Altre app), link row con "Copia".
- **File:** `ShareButton.tsx`.

### `865eebe` — Dettaglio preventivo mobile pixel-perfect in TUTTI gli stati 🟡
- **Contesto:** il mockup è stato aggiornato da Eli con **6 schermate per stato** (BOZZA/INVIATO/VISTO/ACCETTATO/RIFIUTATO/SCADUTO) + card "Altre azioni".
- **Fatto:** vista mobile ricostruita per stato:
  - BOZZA: titolo "Bozza", "Creata il", banner Free, primario "Invia al cliente", in Altre azioni "Segna come inviato".
  - INVIATO: Anteprima + Condividi, Segna accettato/rifiutato.
  - VISTO: badge rosa, card "Visualizzazioni", cronologia con "Visto dal cliente".
  - ACCETTATO: banner verde firmato + "Crea fattura" navy.
  - RIFIUTATO: banner rosso + motivo.
  - SCADUTO: banner ambra + primario "Rinvia al cliente".
  - "Altre azioni" ridisegnata (card a tendina, righe Duplica/[Segna inviato]/Elimina), **prima** della Cronologia.
- **Componenti:** `ShareButton` (trigger label/icona parametrici), `StatusBadge` (padding 3px 11px da DESIGN_TOKENS), `MobileStatusChips` (icone Check/X), `Duplicate/Delete/RegisterManualSend` (variante `asRow`), `AltreAzioniCard` (riscritta), `globals.css` (divisori `.cc-altre-rows`).
- **File:** `app/(app)/preventivi/[id]/page.tsx` + i componenti sopra + `app/globals.css`. (Inclusa la regola fissa **pixel-perfect** in `RIPARTI_QUI.md` sez. 3.)

### `7b6cbc6` (28 giu) — Dettaglio preventivo (INVIATO) prima passata pixel 🟡
- **Feedback Eli (checklist):** header "Preventivo N" centrato + matita in cerchio; riga stato badge + "Inviato il"; banner Free oro; card Cliente; card Riepilogo (Subtotale/IVA/Totale/Valido fino al); Anteprima + **Condividi navy pieno**; "Segna accettato/rifiutato" bianchi con sola icona colorata; Cronologia coi toni dei badge.
- **Fatto:** prima ricostruzione mobile dell'INVIATO (poi estesa a tutti gli stati in `865eebe`). Desktop separato e invariato.

### `e80e531` (27 giu) — Dettaglio preventivo: prime rifiniture 🟡
- **Feedback Eli:** chip uniformi/stessa altezza, banner accettazione in verde **pastello** (non acceso), importi a 2 decimali, "Crea fattura" con etichetta visibile e non duplicato, "Segna accettato/rifiutato" su sfondo bianco con sola icona colorata.
- **Fatto:** applicate; poi consolidate nei commit successivi.

### Note di processo (29 giu)
- **Accesso GitHub:** all'inizio sessione il push falliva (403). Causa: rendendo il repo **privato**, l'app GitHub di Claude aveva perso la scrittura. Risolto da Eli **installando l'app Claude** sul repo (GitHub → app Claude → repository access → carta-canta). Da lì push OK.
- **Punti lasciati aperti / da decidere con Eli:** eventuale card og:image 1200×630; se "Cambia stato" va tenuto anche su mobile (ora solo desktop, come da mockup); "Altre azioni" default chiusa.

---

*Prima di questa data: lo storico dettagliato è in `CLAUDE.md` (sezione A — HANDOFF) e `STORICO_SESSIONI.md`.*
