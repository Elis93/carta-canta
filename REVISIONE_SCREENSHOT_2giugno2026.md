# Revisione UX/funzionale da screenshot — 2 giugno 2026

> Analisi delle 95 schermate fornite (account "Eli Impianti", piano Pro, regime forfettario). Per ogni problema: dove l'ho visto (n. schermata indicativo), perché è un problema, cosa sistemare. Priorità: 🔴 funzionale/bloccante · 🟠 logico/coerenza · 🟡 estetico/UX.
> Nota: parte dei dati è di test (nomi lunghissimi tipo "Gianfeli…", "22", "333", "wew") — non sono bug, ma rivelano dove manca il troncamento.

---

## 🔴 FUNZIONALI (impattano l'uso — priorità massima)

**F1 — Lo stato non si aggiorna dopo l'invio.** Dopo "Invia email", la pagina di dettaglio del documento resta su **Bozza** finché non si torna manualmente alla lista. Visto sulla fattura 008 (segnalato anche da te: *"non si aggiorna in automatico… rimane con stato bozza finché non torno nella schermata con tutte le fatture"*). Manca un `revalidate`/refresh dopo l'invio. Vale sia per fatture sia per preventivi.

**F2 — "Ripristina versione inviata" su una fattura porta a "Pagina non trovata" (404).** Dopo il ripristino l'utente finisce sulla pagina 404 (lo hai segnalato: *"Dà errore"*). L'evento "Ripristinato alla versione inviata" viene comunque registrato in cronologia, quindi è un **redirect sbagliato** post-azione: punta a `/preventivi/[id]` invece di `/fatture/[id]`.

**F3 — L'email dice "PDF allegato" ma si invia solo il link.** Il corpo dell'email recita *"La fattura/Il preventivo in formato PDF è allegato a questa email"* (vista su fattura 007 e preventivo 009), ma l'architettura attuale invia **solo il link** al documento, niente PDF. O il testo è fuorviante (più probabile) o contraddice la scelta "no allegato". Da correggere il testo dell'email (o decidere se allegare davvero il PDF).

**F4 — Conversione preventivo → fattura: il cliente non viene riportato subito.** Creando la fattura 008 dal preventivo 010, la fattura mostra **"Nessun cliente"** (campo Cliente vuoto, PDF "Nessun cliente") anche se il preventivo aveva il cliente. Il cliente ricompare solo dopo. Da verificare e correggere il carryover del cliente in fase di conversione.

**F5 — Email del preventivo non sempre recapitata (deliverability).** Hai annotato *"riprovo a inviare un preventivo dato che non è arrivato"*; poi è arrivata su Outlook. Probabile finita in spam/ritardo su Gmail. → completare il percorso **DMARC** (none → quarantine → reject) e verificare SPF/DKIM, come già previsto in CLAUDE.md.

---

## 🟠 LOGICI / COERENZA

**L1 — Le fatture mostrano stati da preventivo ("Visto").** In lista fatture compaiono badge **"Visto"** (giallo) su Fatt. 004 e 006. Per le fatture gli stati sensati sono Bozza/Inviata/Pagata/Scaduta/Annullata. "Visto" è un concetto da preventivo che non dovrebbe applicarsi alle fatture.

**L2 — La fattura usa concetti/etichette del preventivo.** "Valido fino al 02/07/2026" sulla fattura (intestazione PDF e pagina pubblica), "Scade il" in cronologia, header sezione **"VOCI PREVENTIVO"** dentro una fattura, campo **"Validità (giorni)"** nel form fattura. Una fattura non "scade" come un preventivo: ha una **scadenza di pagamento**. Il form/preview fattura sembra clonato dal preventivo senza adattare le diciture.

**L3 — Dialog "aggiornato"/"ripristina" dicono sempre "preventivo".** Aggiornando una **fattura** compare *"Preventivo aggiornato… Vuoi reinviare il preventivo adesso?"* (lo hai annotato), e il dialog di ripristino dice *"Il preventivo tornerà alla versione…"*. Testi hardcoded "preventivo" da rendere dipendenti dal tipo documento.

**L4 — Grammatica femminile per le fatture.** "Lo stato passerà a **Inviato**", badge **"Inviato"**, "Fattura **inviato** tramite Carta Canta". Per le fatture va al femminile: **Inviata**.

**L5 — Numerazione bozze incoerente.** Alcune bozze hanno il numero (008, 009, 012), altre compaiono come **"–"** (nessun numero) nelle liste e nel CSV. Contraddice sia l'helper text sia la decisione "numero assegnato subito alla creazione".

**L6 — Helper text del numero contraddittorio.** Nel nuovo preventivo: *"Le bozze non hanno un numero ufficiale…"*; ma le bozze hanno il numero. Altrove: *"Numero manuale — verrà usato all'invio"*. Uniformare il messaggio alla logica reale.

**L7 — Il prefisso "Prev" riaffiora (anche lato cliente).** Il campo Numero mostra **"Prev009/2026"**, l'export CSV mescola "Prev009…" e "010…", e — più grave — la **pagina pubblica del cliente** mostra **"#Prev009/2026"**. Altrove il prefisso è giustamente nascosto: va nascosto ovunque, soprattutto nel documento che vede il cliente.

**L8 — Dashboard (mese corrente) vs liste (totali) si contraddicono.** La dashboard mostra *Preventivi accettati 0 · Valore 0,00 € · -100%*, mentre la pagina Preventivi mostra *Accettati 2 · €103*. Le KPI sono "del mese", le liste "totali": l'utente lo legge come un errore. Inoltre **"-100%" in rosso** al 2° giorno del mese è demoralizzante e poco significativo. Suggerimento: etichettare meglio ("questo mese") e ammorbidire il confronto a inizio mese.

**L9 — Empty state sbagliato sui filtri.** Il tab **"Rifiutati"** vuoto mostra *"Nessun preventivo ancora — Crea il primo preventivo"*: fuorviante, i preventivi esistono, semplicemente nessuno è rifiutato. Serve un messaggio tipo *"Nessun preventivo rifiutato"*.

**L10 — Conteggio "totali" sotto ricerca.** In Fatture, cercando "Pagata" l'intestazione diventa **"1 fatture totali"**: (a) dice "totali" ma conta i filtrati; (b) grammatica: *"1 fattura"* (singolare).

**L11 — "AI Import" promesso come incluso ma è "IN ARRIVO".** Il piano (Impostazioni → Piano e Abbonamento) elenca *"AI Import (foto→preventivo) — Incluso"*, ma nel form il bottone è **"IN ARRIVO"** disabilitato. Allineare la comunicazione finché non è attivo.

**L12 — Email personale dell'artigiano esposta al cliente.** Sulla pagina pubblica: *"Contatta Eli Impianti: elly.4ee@gmail.com"* — è l'**email personale dell'account**. Meglio mostrare un'email business / il reply-to del workspace, non l'indirizzo personale.

**L13 — Nota legale "ritenuta d'acconto 20%" su un forfettario.** Alcuni documenti riportano *"Soggetto a ritenuta d'acconto del 20%…"*. È una nota **selezionabile manualmente** dal template (quindi non un bug automatico — la ritenuta automatica è OFF), ma per un forfettario è fiscalmente incoerente. L'app potrebbe avvisare quando la nota scelta confligge col regime.

---

## 🟡 ESTETICI / UX

**E1 — Doppio bottone "Nuovo preventivo" sulla dashboard.** Uno nell'header e uno nell'hero, vicinissimi e identici. Ridondante: tenerne uno.

**E2 — Il documento (anteprima e pagina pubblica) richiede scroll orizzontale e taglia il contenuto.** Su finestra stretta si vede "PREVENTIVO"→"PREV", il totale tagliato, ecc. La **pagina pubblica è la pagina di conversione del cliente**: deve essere pienamente responsive (scalare il foglio A4 alla larghezza), non scrollare in orizzontale.

**E3 — Nomi cliente lunghi non troncati.** In dashboard "Prossima scadenza" e nelle card "Preventivi in attesa" il nome lunghissimo va a capo su più righe. Troncare con ellissi come nelle liste.

**E4 — Il tasto "+" accanto a "Esporta CSV" non ha stato hover.** (Lo hai notato.) Manca il feedback hover/cursore che invece ha il bottone export. Uniformare gli stati interattivi.

**E5 — Nuova voce: Q.tà e Prezzo a 0 di default.** Una voce nasce con Q.tà 0 → totale 0. Default più sensato: **Q.tà = 1**.

**E6 — Grafico "Andamento" senza scala sull'asse Y.** Le barre non hanno valori di riferimento; l'hover mostra i numeri ma manca una scala. Aggiungere etichette asse Y o i valori sopra le barre.

**E7 — Modifica voce di catalogo non precarica l'Unità di misura.** Aprendo la modifica di "Manodopera idraulica" il select **Unità è vuoto** invece di mostrare "h". Precaricare il valore salvato.

**E8 — Logo placeholder grigio nell'header.** Ovunque appare un rettangolo grigio al posto del logo (probabile account di test senza logo), ma è poco elegante: prevedere un fallback con iniziali del workspace anche nell'header (come già fatto altrove).

**E9 — Template "Bold": "TOTALE DA PAGARE" anche sui preventivi.** Su un preventivo "da pagare" è improprio (è da *accettare*). Valutare "TOTALE" sui preventivi e "TOTALE DA PAGARE" sulle fatture.

---

## ✅ Cosa funziona bene (da non toccare)

- **Accettazione pubblica con firma grafica + checkbox consenso + registrazione IP/UA/data**: professionale e legalmente solido.
- **Conferme intelligenti**: conversione di un preventivo non ancora accettato (avviso chiaro), rifiuto con motivo facoltativo.
- **Filtri avanzati fatture** (data/importo), **timeline documento** completa, **banner "modificato dopo invio" + ripristino**.
- **Email professionale e ben impaginata**, mittente corretto `noreply@send.cartacanta.app`, reply-to all'artigiano.
- **Pulsante "Contatta" già presente sul link pubblico**: ottima base per la futura chat preventivo (feature #6).
- **Gestione cliente dal popup di invio** (match/creazione, conferma duplicati).

---

## Priorità consigliata di fix
1. **F1, F2** (stato post-invio + 404 ripristino fattura): rompono il flusso quotidiano.
2. **F3, F4** (testo "PDF allegato" + cliente perso in conversione): toccano la professionalità verso il cliente.
3. **L1–L4** (fattura che parla da "preventivo": stati, "valido fino al", grammatica, dialog): coerenza percepita.
4. **L7, E2** (prefisso "Prev" e documento non responsive sul link cliente): è ciò che vede il cliente → impatto su immagine e conversione.
5. **L5/L6, L8, L9, L10, E1, E5, E7** (pulizia di coerenza e micro-UX).
6. Resto (estetici) a seguire.

> Questi fix sono per lo più di **copy, stato e redirect** — interventi mirati, non riscritture. Si possono raggruppare in 1–2 sessioni di Claude Code. Quando vuoi preparo i prompt mirati (es. "fix coerenza fatture" e "fix flusso invio/ripristino").
