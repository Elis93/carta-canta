# 📒 REGISTRO AGGIORNAMENTI — Carta Canta

> **Chi tiene questo file:** **Code Mobile** (l'assistente Claude che lavora sulla parte **mobile** dell'app, in coppia con Eli).
> **Cosa contiene:** TUTTO quello che ho fatto io — modifiche apportate, bug trovati/risolti, feedback ricevuti da Eli e come li ho recepiti, con l'esito di ogni intervento.
> **Regola:** ordino per data, dalla più recente in cima. A fine di ogni intervento aggiungo qui la voce, poi `git push` su `origin/master` (→ deploy Vercel).
> **Legenda esito:** ✅ verificato in browser da Eli · 🟡 fix applicato (tsc+build+test verdi, da verificare da Eli) · ⏳ in corso · ❌ aperto.
>
> Nota: questo è il changelog "operativo" di Code Mobile. Le **decisioni** stanno in `DECISIONI_E_FEEDBACK.md`/`DECISIONI_UI_CONSOLIDATE.md`, la **revisione UI** in `REVISIONE_UI.md`, le **regole/handoff** in `CLAUDE.md`. Qui c'è il "cosa ho cambiato e perché".

---

## 1 luglio 2026 — Copia link conferma "Inviato" + tutte le pagine del mockup `pagine2` (Code Mobile)

Metodo: pixel-perfect al mockup, override degli stili shadcn dove differiscono, **niente valori inventati** (i dubbi lasciati indietro e raccolti in fondo per Eli). Componenti condivisi e pagine preventivo (bloccate) NON toccati.

### `<share>` — Condividi: "Copia link" chiede conferma per segnare come Inviato (bozze) 🟡
- **Feedback Eli:** cliccando "Copia link" nel pop-up Condividi, chiedere conferma per segnare il preventivo come **Inviato** (NON aggiungere "Segna come inviato" al ⋮ della lista).
- **Fatto:** `ShareButton.copyLink` → su una **bozza**, dopo aver copiato il link compare una conferma inline *"Vuoi segnare questo preventivo come Inviato? Riceverà il numero progressivo."* con **Non ora** / **Segna come inviato** (auto-salva + `registerManualSendAction`). Documenti già inviati/scaduti: comportamento invariato.
- **File:** `app/(app)/preventivi/_components/ShareButton.tsx`.

### `0d3b118` — Pixel-perfect di TUTTE le 26 schermate del mockup `Carta_Canta_mockup_pagine2.html` 🟡
- **Richiesta Eli:** "procedi con la modifica delle pagine come descritto nel nuovo mockup. Falle tutte. Se hai dubbi, lasciali indietro… alla fine chiedimi i dubbi prima di applicarli."
- **Fatto (33 file, solo layout mobile; desktop `lg:` preservato):**
  - **Clienti** — Lista (fascia bianca, righe avatar/nome/sottotitolo/chevron, rimosso badge P.IVA), Scheda (header+chip Chiama/Modifica, info-card, documenti, Elimina outline), Nuovo/Modifica form (label uppercase, asterischi oro, bottone navy 50px).
  - **Catalogo** — lista raggruppata per categoria (bande #ececef), righe `unità · IVA%`, form voce mockup.
  - **Fatture** — Dettaglio (header+matita, card Cliente/Riepilogo, banner "Da preventivo", azioni Anteprima/Condividi, "Segna pagata" navy), Nuova fattura (Cliente + Voci + Altre opzioni + bottoni).
  - **Altro** (hub) + **Impostazioni** (tab-bar mobile, tab Generale/Fiscale/Notifiche/Piano Free+Pro, ToggleSwitch mockup).
  - **Abbonamento** (Free: quota+card oro Pro; Pro: piano attivo+annuale), **Template** (griglia preset 2×2+personalizzazione Pro), **Cestino** (banner 15gg, righe con Ripristina/Elimina).
  - **Pagina pubblica** — card documento, bottom-sheet Firma/Rifiuta, stati grazie/scaduto/rifiutato.
  - **Auth** — Login, Signup, Verifica email; **Onboarding** passo 1.
- **Metodo:** 7 gruppi in parallelo su file disgiunti; tsc + build + 178/178 test verdi prima del push.
- **DUBBI raccolti (da decidere con Eli PRIMA di applicare — vedi messaggio dedicato):** SearchBar/OAuthButtons/PasswordStrength condivisi (ritocco pixel fuori area); Template Pro personalizzazione inline vs editor; griglia preset interattiva al tap; Bonus edilizio toggle vs Select 4 opzioni; "Chiama l'artigiano" (manca telefono workspace nel DB); IVA mista in Riepilogo/pagina pubblica; onboarding campi extra (ATECO/indirizzo) vs card snella; form modifica fattura mobile usa `PreventivoForm` (bloccato).

---

## 29 giugno 2026 — Sessione Dettaglio preventivo + Pop-up Condividi (Code Mobile)

Metodo: Eli è il giudice visivo (screenshot dal telefono); io leggo sempre il codice reale, replico il mockup **al pixel** (`mockup-mobile/Carta_Canta_mockup_app.html` + `DESIGN_TOKENS.md`), e pubblico su `master` (Vercel). Eli ha autorizzato il push diretto su `master` (nessun cliente reale ancora).

### `8775992` — Cronologia preventivo: nodo finale "Scade il {data}" 🟡
- **Feedback Eli:** nella cronologia aggiungere in fondo quando scade il documento. Etichetta "**Scade il**" confermata da Eli.
- **Fatto:** cronologia mobile del dettaglio preventivo → per Inviato/Visto con scadenza futura, nodo finale "Scade il {data}" (ambra, Clock). Allinea il mobile al desktop.
- **File:** `app/(app)/preventivi/[id]/page.tsx`.

### `dc8e91e` — Dettaglio preventivo: rimossa "Altre azioni" (no doppioni col ⋮) 🟡
- **Feedback Eli:** ripetizione di comandi (Duplica/Elimina) tra ⋮ della lista e "Altre azioni" del dettaglio → **opzione B**: gestione solo dalla lista ("solo da fuori schermata preventivo").
- **Fatto:** rimossa la card "Altre azioni" dal dettaglio preventivo mobile (Duplica/Elimina restano nel ⋮ della lista: Usa come modello / Invia bozze / Elimina). Rimossi import inutilizzati.
- **Aperti/segnalati:** "Segna come inviato" (bozze) esce dal dettaglio mobile (resta desktop; da aggiungere al ⋮ se Eli vuole). **Dettaglio FATTURA non toccato**: la sua "Altre azioni" include "Segna pagata/Annullata" (non nel ⋮) → da sistemare quando si fa la pagina Fattura Dettaglio col mockup `pagine2`.
- **File:** `app/(app)/preventivi/[id]/page.tsx`.

### `408dea7` — og card firma come default per TUTTA l'app (verificato) 🟡
- **Feedback Eli:** condividendo il link di una **pagina interna** (es. `/fatture/[id]?edit=1`) su WhatsApp compariva ancora la vecchia icona CC.
- **Causa:** le pagine interne sono dietro login → il crawler non autenticato viene rediretto al **login**, che non aveva `og:image` → icona CC di default. Il logo firma era solo su `/p/[token]`.
- **Fatto:** aggiunto `app/opengraph-image.tsx` (root) → la card 1200×630 col logo firma è ora il **default per tutta l'app**; `/p/[token]` mantiene il suo override. Logo colocato in `app/logo-firma.png`.
- **Verificato in produzione:** `cartacanta.app/login` espone `og:image = /opengraph-image` (1200×630, image/png). ✅
- **Cache WhatsApp:** vale sempre (link nuovo / re-scrape).

### `1ab116c` — Sconto globale: chiusura con X + form fattura allineato al preventivo 🟡
- **Feedback Eli:** (a) nel preventivo lo sconto si apriva col "+" ma non c'era modo di richiuderlo; (b) lo sconto era gestito diversamente tra preventivo (dentro il Riepilogo) e fattura (card separata "Sconti globali").
- **Verifica (chiesta prima di toccare):** confermato — preventivo usava `discountSlot` dentro `FiscalSummary`, fattura aveva la `Card 4` separata (incoerenza storica: G-QA3.4 aveva aggiornato solo il preventivo).
- **Fatto:** `PreventivoForm` → bottone **X** nel pannello sconto aperto che **chiude e azzera** Sconto %/€ (icona scelta da Eli). `FatturaForm` → sconto spostato **dentro il Riepilogo** (stesso discountSlot, apri/chiudi con X), **rimossa** la card separata.
- **Nota:** validazione "sconto > totale" (T-14) resta solo nel preventivo (non portata in fattura — da fare se Eli vuole).
- **File:** `PreventivoForm.tsx`, `FatturaForm.tsx`.

### `169714c` — Form fattura: numero in Inter (no monospace) + rimosso "(opzionale)" 🟡
- **Feedback Eli:** sulla pagina Fatture il numero aveva un font diverso dal resto; e "Sconti globali (opzionale)" → togliere "opzionale".
- **Fatto:** `FatturaForm` → campo Numero fattura non più `monospace` (ora Inter, coerente). Rimosso "(opzionale)" da "Sconti globali" e da "Titolo del lavoro" (regola DESIGN_TOKENS: opzionale è implicito).
- **File:** `FatturaForm.tsx`.

### `33eee9a` — og card: logo più grande (meno spazio attorno) 🟡
- **Feedback Eli:** il logo nell'anteprima WhatsApp aveva troppo spazio attorno.
- **Fatto:** `opengraph-image.tsx` → logo da 820→1000px di larghezza (margini ridotti, un po' d'aria mantenuta).
- **Cache WhatsApp:** la nuova dimensione si vede solo con un link nuovo / re-scrape.

### `56bdc0e` — Pop-up: anche "Copia" fa ripartire la validità (scaduto) 🟡
- **Feedback Eli:** per un preventivo scaduto anche il pulsante "Copia" deve far ripartire la scadenza, con un avviso.
- **Fatto:** in `ShareButton.copyLink`, se il preventivo è scaduto: copia il link + chiama `resendExpiredAction` (reimposta scadenza + stato Inviato) + toast "Link copiato. La validità riparte: scade tra N giorni." + chiude il pop-up. Negli altri stati "Copia" resta semplice copia.
- **File:** `app/(app)/preventivi/_components/ShareButton.tsx`.

### Pop-up Condividi centrato + og card 500→edge (verificata 200) 🟡
- **Feedback Eli:** il pop-up sembrava "spostato in basso" (bottom-sheet senza margine inferiore visibile) → **centrarlo nella pagina**.
- **Bug trovato (dai log Vercel):** la card OG dava **500** in produzione → `fetch failed: not implemented` (il runtime **nodejs** non legge i file locali via fetch). Per questo WhatsApp non mostrava immagine anche sui link nuovi.
- **Fatto:** (1) `ShareButton` → pop-up reso **card centrata** (overlay flex, margini su tutti i lati, angoli arrotondati, scroll se alta). (2) `opengraph-image.tsx` → runtime **edge** + data-URI base64 robusto. **Verificato in produzione: la route risponde 200 (PNG)**.
- **File:** `app/(app)/preventivi/_components/ShareButton.tsx`, `app/p/[token]/opengraph-image.tsx`.
- **Cache WhatsApp:** i link già condivisi restano con la vecchia anteprima → serve link NUOVO o re-scrape su Meta Sharing Debugger.

### og:image come card 1200×630 generata (WhatsApp non mostrava nulla) 🟡
- **Bug/feedback Eli:** con un link nuovo l'anteprima WhatsApp non mostrava **alcun** logo. Causa: l'`og:image` era il logo "largo" 900×210 → WhatsApp scarta le immagini troppo strette.
- **Fatto:** creata `app/p/[token]/opengraph-image.tsx` (Next `ImageResponse`, runtime nodejs) → **card 1200×630** col logo firma centrato su sfondo crema `#f3ede0`. Logo colocato in `app/p/[token]/logo-firma.png`. In `generateMetadata` rimosso l'`og:image` manuale (lo fornisce la card). Rimosso `public/og-logo-firma.png` (superato).
- **Nota cache:** vale sempre la cache di WhatsApp → testare con link NUOVO o re-scrape dal Meta Sharing Debugger.

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
