# 🚀 RIPARTI_QUI — punto di accensione per Claude (Dispatch)

> **Eli dice "leggi RIPARTI_QUI.md e riparti da dove avevamo lasciato".**
> Questo file è il bootstrap: leggi prima questo, poi i file indicati, poi riparti dal punto in **STATO ATTUALE**.
> ⚠️ A FINE SESSIONE aggiorna il blocco **STATO ATTUALE** qui sotto (e i file di registro). Così il prossimo avvio riparte preciso.

---

## 1. COSA LEGGERE (in quest'ordine)

1. **`CLAUDE.md`** — fonte di verità del progetto (stack, regole, handoff sessioni, formato risposta sez. C). Leggilo per intero, almeno sezioni A, B, C, D.
2. **`DECISIONI_E_FEEDBACK.md`** — decisioni BLOCCATE (✅). **NON annullarle** senza un ok esplicito di Eli.
3. **`REVISIONE_UI.md`** — revisione UI pagina per pagina (mockup ↔ app). Qui si segna lo stato di ogni schermata.
4. **`DECISIONI_UI_CONSOLIDATE.md`** — registro dettagliato di TUTTE le decisioni UI recenti (Nuovo preventivo + collegate), voce per voce con valori esatti (colori, dimensioni, font).
5. **`mockup-mobile/DESIGN_TOKENS.md`** — **CRITERI ESTETICI + token aggiornati** (palette, badge/stati, tipografia e gerarchia dei grigi, ombre/forme, componenti, header/nav, Free/Pro). **Da leggere PRIMA di toccare il mockup o di implementare:** è il "perché" e i valori esatti da rispettare per restare coerenti ed eleganti. Il mockup resta la verità AL PIXEL; questo file spiega le scelte.
6. Mockup di riferimento: cartella **`mockup-mobile/`** — in particolare **`Carta_Canta_mockup_app.html`** (file unico: Home, Preventivi, Fatture, Nuovo preventivo, Dettaglio preventivo in tutti gli stati, Pop-up Invia/Condividi, Pop-up catalogo). Gli altri .html sono mockup per singola schermata.

---

## 2. STATO ATTUALE  ⬅️ *(aggiornato il 19 giu 2026)*

- **Ultimo commit:** `5113d7e` (docs) · codice: `940a633` (Commit Q — Nuovo preventivo, parentesi Note + SUBTOTALE).
- **Branch:** `master`. tsc + build + 178/178 test verdi.
- **Pagine BLOCCATE (non toccare senza ok di Eli):**
  - ✅ **HOME** (mockup `home_v2.html`) — bloccata 15 giu.
  - ✅ **NUOVO PREVENTIVO / NUOVA FATTURA** (form) — **BLOCCATA** dopo un giro completo di rifiniture (header fascia bianca + ✕ in cerchio, campi/select stile mockup #e3e3e6/r10, microfono dentro al campo, bonus toggle oro + BadgePercent, gerarchia grigi #6f6d64/#8a887f, titoletti MAIUSCOLI, SUBTOTALE come titolo, 3 frasette 12px/#767676). Dettagli voce per voce in **`DECISIONI_UI_CONSOLIDATE.md`**. ⚠️ Due micro-tweak OPZIONALI non ancora applicati (vedi quel file): "(visibili/non visibili al cliente)" da rendere uguali a "NOTE", e "Subtotale" da allineare a "Termini di pagamento" — da fare o ignorare a scelta di Eli.
- **🟡 PAGINA IN LAVORAZIONE ORA → DETTAGLIO PREVENTIVO**
  - Mockup di riferimento: **`mockup-mobile/m_dett_preventivo.html`** (stato preventivo *accettato*).
  - Contenuto mockup: header (← · numero+cliente · badge "Accettato" · ⋮) → banner verde "Accettato e firmato dal cliente" (firmatario · data · IP) → riga azioni **Condividi + Anteprima** → card date Emesso/Accettato + voci + Totale → bottone scuro **Crea fattura** → **Altre azioni** a tendina → **Cronologia** (Creato/Inviato/Accettato).
  - File app reali: `app/(app)/preventivi/[id]/page.tsx` + `_components/` (DocumentTimeline, PdfActions, ShareButton, StatusBadge, MobileStatusChips…).
  - Storia: il commit D (vedi CLAUDE.md cont. 11) aveva già toccato questa pagina (banner oro, azioni 48px, rimosso "Salva PDF").

### PROSSIMO PASSO concreto
Riprendere la **revisione del Dettaglio preventivo**: Eli guarda la pagina sul telefono e manda i feedback uno a uno (oppure chiede a Claude il confronto mockup ↔ codice come checklist). Registrare ogni feedback in `REVISIONE_UI.md`. **Nessun prompt/modifica a Code finché Eli non approva.**

---

## 3. COME LAVORIAMO (metodo fisso — non cambiarlo)

- **⭐ REGOLA FISSA — PIXEL-PERFECT (vale da ORA e per TUTTE le pagine, sempre).** Riproduci il mockup **per filo e per segno**: è la specifica **AL PIXEL**. Per ogni schermata replica ESATTAMENTE ogni colore (hex), dimensione font, peso, padding/spaziatura, raggio, bordo, icona/simbolo, allineamento, presenza/assenza di sfondi e ombre. NON improvvisare, NON "avvicinarti", NON lasciare gli stili di default di shadcn se differiscono → **sovrascrivili**. Se un valore non è chiaro, **CHIEDI a Eli** invece di inventare. A fine lavoro confronta **elemento per elemento** col mockup prima di dire "fatto". **`DECISIONI_UI_CONSOLIDATE.md` ha priorità e integra il mockup.**
  - **Mockup = fonte di verità, su GitHub:** **`mockup-mobile/Carta_Canta_mockup_app.html`** (file unico, una schermata per blocco, ognuna con titolo `<h2>`). Le altre `*.html` nella cartella possono essere meno aggiornate.
- **Lingua:** italiano. Messaggi **brevi**; in fondo sempre un riassunto di 2 righe o la domanda da fare. Eli non legge messaggi lunghi.
- **Sincerità prima di tutto:** mai dare per risolto un bug solo perché hai trovato la causa. Verifica sempre nel codice reale. Cita le fonti.
- **Loop con Code:** Claude (coordinatore) prepara **un solo prompt** quando Eli rimanda la risposta di Code. Mentre Code lavora, NON preparare prompt: accumula i feedback. Dopo ogni fase di Code, **verifica nel codice reale** che le modifiche siano davvero applicate.
- **Revisione UI pagina per pagina:** giudice dell'estetica = Eli con gli screenshot dal telefono (il browser di Claude è inaffidabile). Registra ogni feedback prima di implementare.
- **Mockup pixel-perfect:** l'implementazione deve combaciare col mockup al pixel.
- **Desktop ⊇ mobile:** il desktop ha sempre più densità/funzioni del mobile.
- **Azioni manuali di Eli:** se dall'output di Code emergono cose da fare a mano (DNS, Stripe, env Vercel…), segnalale a Eli in fondo al messaggio.
- **Prima di ogni commit:** `npx tsc --noEmit` + `npm run build` verdi. Test su `lib/fiscal/` sempre 100%.
- **Backup/deploy:** `git push` su **origin** = backup primario + deploy Vercel automatico (1-3 min, https://cartacanta.app). Confermare a Eli con l'URL. Push NAS (`git push nas master`) **opzionale** (con utente `elisa` fallisce: è normale).
- **NON toccare senza screenshot/test:** `lib/fiscal/calcoli.ts`, `lib/pdf/template.ts`, `TemplatePreview.tsx`, webhook Stripe.

---

## 4. RICORDA DI AGGIORNARE
A fine task/sessione: aggiorna **STATO ATTUALE** qui sopra + `CLAUDE.md` (formato sez. C) + `REVISIONE_UI.md` se hai chiuso/bloccato una pagina, poi `git push` origin.
