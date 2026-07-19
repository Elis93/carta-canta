# DECISIONI & FEEDBACK — Carta Canta (fonte di verità)

> **Registro di tutto ciò che Eli ha chiesto/deciso.** Serve a non ripetere i feedback e a non far "tornare indietro" o rifare a Code cose già decise.
> **Regola per Claude Code:** prima di cambiare UI/copy/comportamento, **leggi questo file**. **NON annullare le voci ✅ (bloccate) senza un'istruzione esplicita di Eli.** Se una modifica rischia di toccare una voce ✅, fermati e segnala.
> **Manutenzione:** lo aggiorna l'assistente di pianificazione (Cowork) a ogni feedback di Eli, e verifica ogni output di Code anche contro questo registro.
> **Legenda stato:** ✅ fatto/bloccato · ⏳ da fare · 🔁 superato (indica la voce valida) · ℹ️ chiarito/non è un bug.
> Per l'elenco operativo e l'ordine dei lavori vedi `BACKLOG_MIGLIORAMENTI.md` (sez. G/H). Qui stanno le **decisioni** e il loro stato.

---

## A. DECISIONI BLOCCATE (✅ — non annullare)

### UI mobile — feedback Eli (4–5 lug 2026)
- ✅ **Duplica ed Elimina SOLO dal menu ⋮ delle liste** (Preventivi e Fatture). **MAI dentro il dettaglio** del documento, né mobile né desktop. Eli l'ha ribadito più volte: NON riproporre "Altre azioni"/danger zone nel dettaglio.
- ✅ **Un solo bottone di invio, sempre "Invia al cliente"** (la parola "Condividi" sparisce), in ogni stato del documento → apre il pop-up coi canali (WhatsApp / Email / Altre app / Copia link). **L'icona Email apre l'attuale pop-up email** (oggetto, destinatario, testo). Per le bozze la consegna via link chiede prima "Segna come inviato" (come oggi).
- ✅ **Errori dei form: NON pastello** — restano rossi accesi. Tutti gli altri avvisi/stati informativi: **palette pastello** del design system.
- ✅ **Grigi: restano come sono** (non sostituire #a5a39b ecc. — proposta ritirata).
- ✅ **Scala tipografica unica in tutta l'app**: titolo pagina 20/600/#161616 · header con ← indietro 17/600/#161616 · titolo sezione 13/600/UPPERCASE/#6f6d64 · titoletto campo 12/600/UPPERCASE/#8a887f · testo 14/#161616 · secondario 13/#55534b · note 12/#767676. **Niente mezzi pixel** (13.5→14 · 12.5→13 · 11.5→12 · 10.5→11).
- ✅ **Salvataggio Impostazioni: toast di conferma** visibile in basso (stile allineato agli altri toast dell'app: 10 s + ✕), per tutti i tab.
- ✅ **Pop-up di successo** (es. invio email, bozza salvata): resta finché non lo si chiude. **Toast/banner**: auto-chiusura dopo 10 s con ✕.
- ✅ **Numero assegnato ben visibile** nel pop-up dopo salvataggio/invio di un nuovo documento.
- ✅ **CTA upgrade unificata: "Passa a Pro"** ovunque ("Abbonati" ammesso solo dentro le card prezzo).
- ✅ **Cronologia**: distinguere sempre le azioni del cliente ("Accettato dal cliente", "e firmato") da quelle manuali dell'artigiano ("Segnato come accettato manualmente").
- ✅ **Card Cliente nel dettaglio**: se il cliente non è in rubrica → niente link/freccia, mostrare "Non è in rubrica · Aggiungilo →". (Capita ad es. se il cliente è stato eliminato dalla rubrica dopo la creazione del documento.)
- ✅ **Impostazioni in Altro**: si raggiunge sia dalla scheda profilo sia dalla riga Account — tenere entrambe (deciso 5 lug).
- ✅ **Niente doppioni inutili**: la stessa azione deve comparire una sola volta per schermata (salvo decisione esplicita contraria).
- ✅ **Abbonamento mobile**: il prezzo mostrato e quello addebitato devono coincidere — scelta Mensile/Annuale anche su mobile (fix bug €182/anno vs checkout mensile).
- ✅ Punto 17: il tab Notifiche resta a **salvataggio automatico** (senza bottone Salva), con toast di conferma. Deciso 5 lug.
- ✅ Punti mappa tasti 5, 7–16, 18–21 — approvati da Eli e implementati (5 lug). Punto 6 = **NO** (deciso, vedi prima voce).
- ⏳ Punto 22 (wording pagina pubblica mobile vs desktop) — da confermare.

### Ciclo incasso — Bilancio / Pagamenti / Acconti (decisioni Eli 5 lug 2026, dai mockup)
- ✅ **Simbolo tipo documento (A2)**: foglio NAVY = preventivo · banconota ORO #b08d3e = fattura, accanto al titolo negli header. Implementato.
- ✅ **Bilancio**: categorie spese preimpostate + possibilità di crearne di personalizzate. Grafico semplice incluso da subito (scelta delegata a Code). Acconto incassato conta nelle Entrate del mese dell'incasso (criterio di cassa — scelta delegata).
- ✅ **Pagamenti F1**: QR bonifico EPC subito (è gratis, generato dall'app). PayPal/Satispay = campi facoltativi con aiuto guidato passo-passo (per utenti poco tecnologici); il metodo principale resta IBAN+QR. Campo note pagamento con placeholder GRIGIO sovrascrivibile "Accetto contanti in cantiere". Riquadro "Come pagare" anche sui PREVENTIVI ACCETTATI (per l'acconto) e in fondo al PDF/documento. Card "Segna come pagata": nota "un importo più basso del totale = acconto".
- ✅ **Acconti**: default proposto **30%** (modificabile) — prassi 10-30%, 30% comune per lavori piccoli. Campo dentro "Altre opzioni" (form snello). Riga acconto in fondo al documento/pagina pubblica. Fattura generata da preventivo con acconto: righe "Acconto già ricevuto −€X / Saldo €Y" (niente nuovo stato DB nell'MVP). **Promemoria automatico** se l'acconto non viene versato (riusa cron solleciti — deciso da Eli). ⚠️ Nota fiscale: all'incasso dell'acconto scatta l'obbligo di fattura d'acconto → quando si segna "Acconto ricevuto" l'app suggerisce di creare la fattura d'acconto.
- ✅ **AI Import**: confermata come feature (scopo = migrazione listino nel catalogo, mai copia "identica" del template). Proposta di implementazione in 3 blocchi presentata il 5 lug — in attesa di conferma numeri/entry point.

### Budget feature a costo variabile (decisione Eli 5 lug 2026 — VINCOLANTE)
- ✅ **Tetto di tasca propria: €50/mese TOTALI** per TUTTE le feature a costo variabile (AI import, future AI note, SDI dei Free, ecc.) — non €50 a feature. Il resto si finanzia con gli abbonamenti Pro.
- ✅ Ogni feature a pagamento va **organizzata e limitata**: sotto-budget per feature ripartiti in base all'uso, quote per utente calibrate perché il limite non si raggiunga subito, ma il tetto complessivo NON si supera mai (kill-switch).

### Cantiere — Sopralluoghi / Foto / Opzioni (decisioni Eli 5 lug 2026, dai mockup)
- ✅ **Badge con sfondo colorato SOLO per gli stati** (accettato, rifiutato, ecc.) — mai per altro. Altri badge = solo contorno; la spunta ✓ verde nella lista sopralluoghi va bene (icona, non sfondo).
- ✅ La voce in Altro si chiama **"Sopralluoghi"**.
- ✅ Foto agganciate al preventivo; l'artigiano può aggiungerle/toglierle con ✕.
- ✅ Foto al cliente: NON tutte — selezione esplicita dell'artigiano di quali mostrare (default: nessuna visibile al cliente).
- ✅ Opzioni a livelli: nomi **fissi proposti da noi** (Base / Consigliata / Premium); voci base duplicate nelle altre proposte ma **cancellabili**; feature **solo Pro**.

### Crescita — SDI / Recensioni / Marketplace (decisioni Eli 5 lug 2026, dai mockup)
- ✅ **SDI solo Pro** (per ora). Il costo provider (~€0,10/fattura) lo paga Carta Canta ed è coperto dall'abbonamento: **NON mostrare il costo all'artigiano** — dicitura "Incluso nel piano Pro · Conservazione a norma inclusa".
- ✅ **Fattura scartata dallo SDI → notifica in app + EMAIL** con il motivo.
- ✅ **Notifiche in Home (campanella)** con badge e lista avvisi; primo caso: fatture pagate non trasmesse allo SDI. Ogni tipo di avviso disattivabile da Impostazioni → Notifiche. (Mockup approvando.)
- ✅ **Recensioni: SOLO domande chiuse** (mai testo libero — scudo legale, già in spec §A.2; i rischi legali devono essere NULLI per qualsiasi feature). Solo cliente→artigiano. **NON è l'artigiano a chiederla**: si sblocca AUTOMATICAMENTE quando la fattura è pagata PER INTERO. Niente replica pubblica nell'MVP (con le domande chiuse non c'è testo a cui replicare): resta "Segnala" + rimozione.
- ✅ **Marketplace**: i profili PRO in cima ai risultati, ma i FREE compaiono comunque. **Verifica automatica** prima della pubblicazione (P.IVA su registro VIES + email confermata + profilo completo). Sezione **"Richieste"** nell'app; l'email di avviso dice SOLO chi ha contattato (dati cliente) SENZA i dettagli, con bottone "Apri la richiesta nell'app".

### Aggiornamenti Eli 5 lug (sera)
- ✅ **Marketplace: il beneficio "profilo in cima ai risultati" va pubblicizzato** nella lista vantaggi Pro (pagina Abbonamento + opt-in marketplace).
- ✅ **SDI anche ai Free**, con cap: proposta Code = max **8 trasmissioni SDI totali** per workspace Free (coerente col limite storico preventivi), dentro il sotto-budget globale €15/mese con kill-switch. ⚠️ Nota: i preventivi Free sono capati (8 storici) ma le FATTURE Free oggi NON hanno limite → il cap SDI per-utente è indispensabile.
- ✅ **SDI — budget riconciliato (Eli, 6 lug 2026):** vale il **tetto unico €50/mese** del 5 luglio → sotto-budget SDI Free = **€15/mese** con kill-switch (SUPERA il "€30/mese" del documento di ricerca del 14 giugno). Il cap per-utente Free resta da confermare (5 a vita del doc di giugno vs 8 proposti il 5 lug — chiesto a Eli).
- ✅ **Estetica (rinforzo regola)**: app facile, intuitiva, elegante; colori del logo SENZA abbondare — colori/icone colorate SOLO per le azioni importanti (badge di stato, errori). Nei mockup non stravolgere le pagine esistenti.
- ✅ **AI Import: voci estratte MODIFICABILI riga per riga** (non solo cancellabili) — se è sbagliata una lettera si corregge, non si butta.
- ✅ **Notifiche**: pallino blu "non letta" resta finché l'artigiano non tocca QUELLA notifica. **Campanella anche per i Free.**
- ✅ **Performance**: la navigazione tra pagine è lenta → priorità a velocizzare i caricamenti (skeleton, meno query in serie, prefetch).
- ⏳ **Feature futura — Calendario sopralluoghi**: appuntamenti con indirizzo; dall'appuntamento del giorno, tap sull'icona → apre Google Maps già impostato per la navigazione. (Si integra con la sezione Sopralluoghi.)
- Scelte Code su domande minori (delegate): foto prima/dopo solo su pagina pubblica nell'MVP (non nel PDF) · limite foto per documento: 6 su Free, illimitate su Pro · campanella solo in Home per ora.

### Documenti / numerazione
- ✅ Numeri documento nel formato `NNN/YYYY` **senza prefissi** "Prev"/"Fatt". In-app le fatture mostrano il marcatore "Fatt. NNN/YYYY"; il prefisso legacy va sempre strippato (anche nel link cliente e nel CSV). *(FIX-03)*
- ✅ Bozze senza numero → etichetta "Bozza senza numero" (non "–"). *(FIX-03)*
- ✅ Watermark diagonale rimosso per tutti; resta solo il footer "generato con Carta Canta" (Free). *(sessioni precedenti)*

### Email al cliente
- ✅ L'email invia **solo il link** al documento, **nessun PDF allegato**; il testo non deve mai dire "PDF allegato". *(FIX-04)*
- ✅ `reply-to` = email dell'artigiano: le risposte del cliente arrivano all'artigiano (anche se il mittente è noreply). *(verificato)*
- ✅ Mostrare nell'email il contatto email dell'artigiano come link cliccabile (`mailto`). *(T-12, FIX-11)*
- ✅ La pagina pubblica `/p/[token]` **non** espone l'email personale dell'account: mostra "Contatta {azienda}". *(FIX-04)*

### Invio / reinvio
- ✅ Dopo l'invio lo stato si aggiorna subito (no "Bozza" residua); cliente associato visibile. *(FIX-01/FIX-08)*
- ✅ Selezione contatto da autocomplete → nessun falso conflitto "stessa email". *(FIX-08)*
- ✅ "Reinvia": email destinatario **in sola lettura** sul cliente (reinvio = stesso doc, stesso cliente). *(FIX-09)*
- ✅ Badge "Modificato" sui preventivi, **"Modificata"** sulle fatture. *(FIX-10)*
- ✅ Il badge "Modificato" deve comparire anche cambiando solo descrizione/unità di una voce. *(FIX-08)*

### Coerenza fatture vs preventivi
- ✅ Fatture: stati "Inviata/Pagata/Annullata/Scaduta" (mai "Visto"); sezione "Voci fattura"; campo "Scadenza pagamento"; niente "valido fino al"; avviso "non sostituisce la fattura elettronica (SdI)". *(FIX-02)*
- ✅ Template **Bold**: "TOTALE" sui preventivi, "TOTALE DA PAGARE" sulle fatture. *(FIX-10)*

### Form / voci / dashboard
- ✅ Nuova voce nasce con **Q.tà = 1**. *(FIX-05)*
- ✅ Form snellito: in cima Cliente → Voci → Riepilogo → bottoni; il resto sotto "Altre opzioni" (chiuso in creazione). I campi restano nel DOM (niente perdita dati al salvataggio). *(IMPROVE M1)*
- ✅ Dashboard "azioni prima dei numeri": "Prossima scadenza" in cima, poi KPI "questo mese" (niente "-100%" aggressivo a inizio mese). *(IMPROVE M3 / FIX-05)*
- ✅ Etichette semplici: "Oggetto" → "Titolo del lavoro"; "Validità" → "Il preventivo vale (giorni)". *(IMPROVE M6)*
- ✅ Automazioni/reminder ON di default per i nuovi workspace. *(IMPROVE M5)*
- ✅ Iniziali avatar dalla **ragione sociale**, sempre maiuscole, coerenti col logo. *(T-4, FIX-11)*

### Budget / costi (principio generale)
- ✅ **Eli NON ha budget infinito:** ogni funzione che genera **spesa variabile senza incasso** (es. chiamate AI di utenti Free) va **sempre limitata/capata** (cap per utente, quota, serbatoio legato ai ricavi, e/o tetto di spesa mensile con kill-switch). Mai costi variabili illimitati per i Free. *(deciso giu 2026)*

### AI import (acceleratore onboarding — deciso giu 2026; spec completa in `SPEC_NUOVE_FEATURE.md`)
- ✅ Scopo: **migrazione/onboarding** → importa **voci nel catalogo**. NON funzione quotidiana. MVP solo voci; niente copia del template utente.
- ✅ Copy: MAI "identico" né "simile" → è un **ADATTAMENTO** dei contenuti al template dell'app. Sempre anteprima + modifica prima di salvare.
- ✅ Free: **1 import gratis** (contato solo a salvataggio), poi congelato. Serbatoio gratuito globale = base + N per Pro attivo, ricarica mensile + tetto di spesa mensile (kill-switch).
- ✅ A serbatoio esaurito → **messaggio opzione A**: "Hai finito gli import gratuiti. Con Pro importi quando vuoi." + "Passa a Pro". NON "riprova più tardi".
- ✅ Piattaforma: **Mistral (UE) primario** + OpenAI gpt-4o-mini fallback. Flusso "Completa il profilo" (listino/logo/ATECO, "1 di 3 fatto").

### Collaudo Eli 17–19 lug 2026 (PR #121–#135 — le PR fino alla #132 verificate il 18 lug sera con ri-review a 2 agent)
- ✅ **Avvio app**: all'apertura si vede lo splash di SISTEMA (navy + icona) per pochissimo, poi la pagina statica **`/avvio`** (precacheata dal service worker, start_url del manifest) con marchio nello stesso punto dell'icona + "Carta Canta" + "il tuo ufficio in tasca" + spinner, SENZA durata fissa. 🔁 Supera sia l'AppSplash rimosso il 17 lug sia il divieto di splash custom: il boot in streaming è deliberato (istruzione esplicita Eli 18 lug). NON re-introdurre splash a durata fissa.
- ✅ **"Calendario" si chiama "Agenda"** (solo etichette; la rotta `/calendario` NON si tocca). Card **"Oggi in agenda" SEMPRE in Home**: con impegni → lista ora+titolo+cliente; oggi libero → "Nessun impegno oggi"; agenda vuota del tutto → CTA "Aggiungi il tuo primo appuntamento".
- ✅ **Tab delle liste (Preventivi/Fatture/Lavori) TUTTE su una riga**, spazi uguali tra le parole, riga piena (flex-grow); scroll solo nei casi estremi. 🔁 Supera la scelta "a capo" del 16 lug (istruzione esplicita Eli: "Rifiutati non deve andare a capo").
- ✅ **Font dei template SELF-HOSTED** (`/public/fonts`, GDPR ok): slot 'Helvetica' → **Atkinson Hyperlegible** ("grande e chiaro"), Georgia con fallback **Lora**. ⚠️ Regola: gli stack dei template NON devono contare sui font di sistema (Android non ha Georgia/Trebuchet/Verdana → tutto diventava Roboto). **Georgia in corsivo** nel bottoncino font e nel nome azienda dell'Elegante; il corpo resta dritto per leggibilità.
- ✅ **Colore accento template**: i colori medi (oro/verde/terracotta) NON ricadono più sul navy — vengono SCURITI mantenendo la tinta (`darkenToReadable`); solo i quasi-bianchi → navy. Il numero documento dell'Elegante resta navy (decisione storica).
- ✅ **Preventivi con più proposte — resa al cliente**: nel PDF/"documento completo" le voci sono RAGGRUPPATE per proposta; riepilogo in-app etichettato; pagina pubblica "Totale proposta Base". Mai più liste appiattite con totale scollegato. 🔁 **Superata il 19 lug** (Eli: "non si capisce come vengono calcolati i totali, le due proposte dovrebbero essere separate"): ogni proposta è ora un BLOCCO AUTONOMO — banda col nome (★ Consigliata), le sue voci e il SUO mini-riepilogo (Subtotale/Sconto/IVA/Marca da bollo → "Totale Proposta X") — e il riepilogo di documento (Imponibile/Bollo/Totale + nota ambra) con più proposte NON compare più: al suo posto il box **"Le proposte a confronto"** (una riga per proposta col totale, ★ sulla consigliata, nota "si sceglie una sola proposta"). Il box acconto con importi assoluti è sospeso con più proposte (riga descrittiva nel confronto: "acconto del X% sulla proposta scelta"). Vale per i 4 preset; con una proposta sola tutto invariato.
- ✅ **Base = Premium identiche → BLOCCATO** al salvataggio manuale e all'invio ("cambia qualcosa o disattiva «Proponi più opzioni»"); rimossa la frase "Le voci della Base sono copiate nella Premium…".
- ✅ **Foto allegabili DAL form** del nuovo preventivo (sezione "Foto lavoro" in Altre opzioni, upload immediato, collegate alla creazione); resta la regola: **di default il cliente non vede nessuna foto** (le mostra l'artigiano con l'occhio). Copy: "Vengono collegate al preventivo appena creato. Scegli poi quali mostrare al cliente."
- ✅ **"Segna come Inviato"**: rimosso "Riceverà il numero progressivo" (il numero c'è già dalla creazione).
- ✅ **Dialog invio email compatto** (messaggio 4 righe, doppioni rimossi). **Banner "Installa l'app" in Home**: solo dal browser, sparisce PER SEMPRE al primo tocco (Installa/istruzioni/✕); la voce di Altro › Strumenti resta.
- ✅ **VersionGuard**: al rientro in app la build viene confrontata col server — in background ≥30 min → ricarica da sola, altrimenti toast "Ricarica" (fix del "Segna tutte come lette non fa nulla" da PWA con build vecchia; gli errori ora si vedono sempre).
- ✅ **Misure calcolate nel sopralluogo** (migration 054): salvate CON gli input, un tocco le riapre precompilate, ✕ elimina; alla trasformazione passano nelle Note interne.
- ✅ **Numeri manuali duplicati bloccati** (17 lug) · **tondo di Altro** = stesse iniziali della Home (persona) o logo.
- ⏳ **Piano Pro**: proposta di Code del 18 lug (candidati Pro al lancio: rapportino firmato, richiami automatici, pacchetto/area commercialista; Agenda/Lavori/calcolatrice restano gratis) — **decisione Eli pendente**, nessun cambio di gating fino ad allora.
- ✅ **Boot ≥3 secondi con preriscaldamento** (18 lug sera, 🔁 supera "nessuna durata fissa"): la schermata `/avvio` resta ALMENO 3 secondi e nel frattempo SCALDA le pagine base (dashboard/preventivi/fatture/altro); le tab della barra in basso hanno `prefetch` pieno → cambio pagina rapido.
- ✅ **Card della Home separate da un bordino ORO leggero su un lato** (`2px #e5d3a1` a sinistra): agenda, scadenza, KPI, attività recente (le card già bordate — quota, installa, profilo — restano col loro oro pieno).
- ✅ **Riga "Ordina" di Preventivi/Fatture in un riquadro BIANCO bordato** (prima si perdeva sul fondo grigio).
- ✅ **Barra delle tab di stato in un riquadro bianco con bordo** e **tab attiva = pillola NAVY con testo bianco** (Eli: "più visibili, un riquadro sullo sfondo con bordo"). Vale per Preventivi/Fatture/Lavori (cc-filter-scroll); le tab di Impostazioni restano com'erano.
- ✅ **Card delle proposte (pagina cliente): TUTTE le voci con l'importo dentro la card** — descrizione a capo (mai troncata), riga "qtà × prezzo" quando la quantità ≠ 1, totale riga a destra. Il cliente confronta Base e Premium SENZA passare da "Vedi documento completo" (Eli 18 lug sera).
- ✅ **★ "Segna come Consigliata" RIMOSSA (19 lug, Eli: "non ha senso")** 🔁 supera la parte "Segna Consigliata" di F8: niente interruttore nel form, niente badge sulle card del cliente, niente stelle nel documento; la proposta di riferimento dei totali è SEMPRE la Base e le stelle già salvate si azzerano al primo salvataggio. NON re-introdurre senza istruzione esplicita.
- ✅ **"Vedi il documento completo" a BOTTONE** (19 lug): sulla pagina cliente mobile è un bottone bianco bordato con icona, non più un link piccolo "che non si nota".
- ✅ **⚠️ REGOLA (19 lug): il simbolo € non va MAI a capo da solo** — tra importo e € sempre spazio unificatore (NBSP), in PDF, pagina cliente e app.
- ✅ **"Apri lavoro" → "Apri la scheda lavoro"** (19 lug) con sottotitolo "Ore in cantiere, foto e rapportino di fine lavoro": il bottone da solo non si capiva.
- ✅ **Rapportino di fine lavoro COMPLETO** (19 lug): mostra anche le ore segnate e le foto del lavoro. Le foto restano quelle rese visibili con l'occhio (la regola "di default il cliente non vede nessuna foto" vale anche qui).
- ✅ **Foto trasportate dal preventivo alla fattura** (19 lug): la card Foto lavoro della fattura creata da conversione mostra e gestisce anche le foto del preventivo di origine; idem la pagina pubblica della fattura (solo quelle visibili).
- ✅ **Anteprima documento in overlay su telefono** (19 lug): si chiude con la X e si torna esattamente al punto in cui si era — niente più navigazione che perdeva la posizione.

### Processo / git (anti-perdita lavoro)
- ✅ Code lavora **su `master`**, nella cartella `C:\Users\Public\carta-canta`, **niente worktree/branch `claude/*`**, e fa **`git push` a ogni task** (verità = `origin/master` su GitHub).
- ✅ **Backup NAS opzionale** (14 giu 2026): GitHub/origin è il **backup primario**; `git push nas master` solo occasionale e solo col drive Z: montato (utente `moian`). Con `elisa` il push NAS fallisce ed è **normale** — non bloccarsi.
- ✅ Pagamenti: modello "bring your own" (IBAN/QR/PayPal/Satispay) + "segna pagato"; carta via Stripe Connect come perk Pro (Fase 2). *(decisione prodotto)*
- ✅ Recensioni solo cliente→artigiano per ora; SdI con provider gestito; marketplace come fase a parte. *(roadmap)*

---

## B. FEEDBACK APERTI (⏳)
Elenco completo e ordine in `BACKLOG_MIGLIORAMENTI.md` sez. H (T-1…T-18) e sez. A-E. In sintesi i prossimi:
- ✅ Fatto: batch bug mobile `PROMPT_FIX_11` (T-4, T-6, T-7, T-8, T-12, T-15, T-16) — commit `2482124`, verificato nel codice e (T-4,6,7,8,15,16) confermati nel test.
- ✅ Fatto (sessione FIX-13): **T-13** (etichetta "Importa da preventivo" sempre visibile su mobile in `fatture/page.tsx`).
- 🟡 **T-18** — **da riconfermare nel browser** (ultima sessione: FIX-POPUP-CLICK-2). Storia completa: FIX-16 ha portato la tendina su portale `document.body` per evitare il clipping dall'`overflow-y-auto` del `DialogContent`. FIX-POPUP-CLICK ha aggiunto `data-dropdown-portal` + `onPointerDownOutside`→`preventDefault` per bloccare il dismiss del dialog al click sulla tendina. Ma i click ancora non funzionavano: la causa reale è che Radix Dialog (modal=true) chiama `disableBodyPointerEvents()` che imposta `document.body.style.pointerEvents = 'none'` — la tendina eredita `none` dal body e non riceve eventi. **Fix (FIX-POPUP-CLICK-2):** `pointerEvents: 'auto'` aggiunto inline sull'`<ul>` portale in `SendEmailDialog.tsx` e `ClientAutocomplete.tsx` — sovrascrive il `none` ereditato. Il `data-dropdown-portal`+`onPointerDownOutside` rimangono per impedire il dismiss. I tentativi precedenti NON vanno segnati ✅ — questo NON va segnato ✅ finché Eli non lo conferma nel browser. Vedi CLAUDE.md sessioni FIX-16/FIX-17/FIX-18/FIX-19/FIX-20/FIX-POPUP-CLICK/FIX-POPUP-CLICK-2.
- ✅ Fatto (sessione FIX-13): **T-12bis** rifinitura testo email → solo "scrivimi a {email}" (rimosso "rispondi direttamente a questa email o…").
- ✅ Fatto (sessione FIX-13): **T-19** — riapertura automatica del popup invio al reload della pagina (causata da `?send=1` residuo in URL) risolta con `history.replaceState` dopo l'apertura iniziale.
- ✅ Fatto (sessione FIX-13): **T-20** — guardia server-side robusta in `send-email/route.ts`: nessun invio possibile senza almeno una voce completa (descrizione+prezzo+quantità), indipendentemente dallo stato (non salvato) del form. Vedi CLAUDE.md per dettagli/scelta.

> ⚠️ NOTA (assistente Cowork, sessione notturna): i punti FIX-13 sopra sono **applicati nel codice ma NON ancora confermati nel browser da Eli**. In particolare **T-18 (suggerimenti) era già stato segnato ✅ una volta e poi NON funzionava** → trattare come "da confermare" finché Eli non lo verifica nel test.

### Nuovi punti aperti (sessione notturna — prompt pronti)
- ✅ **T-21a** [bug]: messaggio "Nessun template disponibile" fuorviante → sostituito con testo muted neutro "Stai usando il template predefinito Classico…". *(FIX-14)*
- ✅ **T-21b**: banner quota Free non bloccante → reso discreto (`text-xs text-muted-foreground`, non box colorato). Blocco attivo resta prominente (rosso). *(FIX-14)*
- ℹ️ **T-21c**: posizione "Invia al cliente" — creazione (fondo form) vs dettaglio (toolbar) sono schermate diverse, la struttura è corretta. Nessun micro-fix necessario.
- ✅ **Bonus FIX-14**: query indipendenti nelle pagine `preventivi/[id]`, `fatture/[id]` e `dashboard` parallelizzate con `Promise.all` → riduzione latenza (~30-60% sulle pagine di dettaglio con più round-trip).
- ✅ **T-9 / T-22 (PERF-01)**: pagine lente + errore fattura al riapri (cold start Vercel). Parallelizzate con `Promise.all` le query sequenziali indipendenti in: `preventivi/page.tsx` (ricerca: matchingClients+matchingItems; post-lista: convertedRows+viewRows+counts in parallelo), `fatture/page.tsx` (ricerca: matchingClients+matchingItems), `clienti/[id]/page.tsx` (client+documents), `p/[token]/page.tsx` (isOwner+getUserById). Cold start: `@sparticuz/chromium`/`puppeteer-core` sono solo in route AI/PDF (dynamic import), non pesano sulle pagine principali. Il ritardo ~20s su fatture è cold start Vercel (limite del piano) — non implementato warm-ping cron (aggiungerebbe route senza fix definitivo del cold start; documentato come limite da monitorare).
- ✅ **Data contestuale nelle liste** (feat DATA_CONTESTUALE + fix grammatica): nelle liste preventivi e fatture la data accanto a ogni documento è ora contestuale allo stato: bozza → "Modificato il…" (preventivo) / "Modificata il…" (fattura), inviato → "Inviato/a il…" o "Scade tra N g" (rosso se ≤7gg), accettato → "Accettato il…"/"Pagata il…", rifiutato → "Rifiutato il…"/"Annullata il…", scaduto → "Scaduto/Scaduta il…". Helper condiviso `lib/utils/document-date.ts` — tutti gli stati differenziati per genere in base a `docType`. Select Supabase aggiornate. Badge "Modificato/a" e logica di ordinamento invariati.
- ✅ **Filtri di stato anche su Fatture** (feat FATTURE_FILTRI_STATO): la lista Fatture ha ora i tab Tutte / Bozze / Inviate / Pagate / Annullate, identici per markup/stile ai tab della lista Preventivi. `status` aggiunto ai searchParams; filtro applicato in AND con ricerca e filtri avanzati esistenti; `inviate` → `.in('status', ['sent','viewed'])`; empty state contestuale senza CTA fuorviante; conteggio intestazione include il tab attivo.
- ⏳ **Feature**: catalogo + autocompletamento voci → `PROMPT_IMPROVE_catalogo_autocomplete` (arricchito col pattern tendina-a-portale di T-18). È la leva "risparmia-ore" da implementare.
- ✅ Fatto: T-14 (sconto globale > totale voci → totale negativo) — sessione FIX-12, causa A confermata, fix applicato (vedi CLAUDE.md).
- Da indagare: T-9 (lentezza caricamento).
- UX mobile: T-3 (margini/bordi), T-17 (riepilogo voci su una riga).
- Feature: T-1 (CAP→indirizzo), T-5 (catalogo+autocomplete), T-11 (click cliente → pagina cliente), T-2 (ATECO più completi), MOB-1b (invito a installare l'app).

---

## C. ℹ️ Chiariti / non bug
- ℹ️ Link "generato con Carta Canta" nell'email → porta alla landing con "Prova gratis"/registrazione. Eli vedeva l'onboarding perché loggata. *(CHECK-8)*
- ℹ️ "Rispondi a questa email" funziona (reply-to = artigiano). Si rende solo più esplicito. *(T-12)*
