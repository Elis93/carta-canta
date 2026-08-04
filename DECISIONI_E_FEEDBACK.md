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
- ✅ **Agenda a CALENDARIO mensile** (19 lug): i giorni del mese come un calendario, pallino oro sui giorni con appuntamenti, tocchi un giorno e vedi cosa c'è (ora/con chi/dove), tocchi l'appuntamento e si apre. Default = oggi. Naviga per mese. 🔁 Supera la lista settimanale precedente.
- ✅ **Trova professionista: ricerca per parola parziale** (19 lug): basta una parte della professione o di un servizio (es. "serbatoi" trova "pulizie dei serbatoi") — cerca ogni parola digitata dentro mestiere, presentazione e nome. Nel form marketplace il campo è ora "Mestiere e servizi" con l'invito a elencare i servizi.
- ✅ **Trova professionista: "Vicino a me"** (19 lug, migration 055): bottone che chiede la posizione al telefono e ordina i professionisti dal più vicino; se non ce ne sono nei dintorni allarga da sola mostrando i più vicini (nota "nessuno proprio vicino"). Coordinate calcolate dal comune al salvataggio del profilo (OpenStreetMap gratis). ⚠️ La posizione del cliente arriva solo al nostro server; nessun terzo la riceve.
- ✅ **Swipe tra i mesi sul grafico del Bilancio** (19 lug): trascini col dito sul grafico (sinistra = mese dopo, destra = mese prima) — oltre alle frecce. Non ruba lo scroll verticale né il tap sui bar.
- ✅ **Mini-calendario coi pallini + avviso in fase di CREAZIONE appuntamento** (19 lug): nei form Sopralluogo/Lavoro scegli il giorno da un mini-calendario coi pallini oro sui giorni occupati, imposti l'ora, e un avviso ambra ti dice cosa hai già quel giorno (con gli orari). Così vedi "giorno e a che ora sono impegnato" prima di fissare.
- ✅ **Fattura annullata: riattivabile finché non trasmessa allo SdI** (19 lug, prassi gestionali via ricerca web): tasto "Riattiva fattura" → torna in bozza con lo stesso numero; una volta trasmessa allo SdI si blocca (server 409) e servirà la nota di credito (fase SdI). Tolto il "Invia al cliente" dalle fatture annullate. ⚠️ Punto di non ritorno = trasmissione SdI, non lo stato "Inviata". Domande di conferma nel PDF commercialista 19 lug.

### Collaudo Eli 20 lug – 3 ago 2026 (decisioni e feedback)
- ✅ **Blocca l'app quando esco** (20-21 lug): interruttore master + timeout (Ad ogni apertura / 15 min / 1 h / 1 giorno); sblocco con password O impronta (passkey sul telefono); richiesta post-login una-tantum "Vuoi entrare con l'impronta?". 2FA: NON ora (decisione 14 lug confermata).
- ✅ **"Vicino a me" diretto** (21 lug): al tocco parte SUBITO il prompt di sistema della posizione, senza guide preliminari; (29 lug) pop-up guidato con Riprova SOLO se il permesso è negato/GPS spento, con istruzioni diverse per app installata vs browser.
- ✅ **Lotto F#1-21 del collaudo 22 lug** (tutti chiusi — i principali): orario appuntamento con due tendine ore/minuti (niente orologio nativo); sezioni disattivate (sola lettura) su preventivo accettato / fattura pagata o annullata; "Scarica XML" della fattura (artigiano + area commercialista, nessuna trasmissione); BottomNav nascosta a tastiera aperta; notifica toccata = letta subito; tab Impostazioni con spazi uniformi.
- ✅ **Copy stati SdI** (27 lug): "Consegnata al cassetto fiscale" / "Emessa, da ritirare nel cassetto fiscale" (scelta Eli). Avviso "non sostituisce la fattura elettronica" DENTRO la card SdI.
- ✅ **Badge "SdI ✓ / SdI scartata"** nella lista fatture + ricerca "sdi" (28 lug, ok Eli — raccomandato il badge, non una sezione separata).
- ✅ **Cronologia completa** (27-28 lug): ogni modifica con data e ora reali; azzeramenti d'incasso col MOTIVO (correzione/annullamento/riattivazione); cronologia a tendina chiusa di default (anche sui preventivi mobile).
- ✅ **Acconto sbagliato correggibile** (27 lug): "Azzera e reinserisci" sulla fattura non ancora saldata; residuo sempre in vista ("Ricevuto finora X — mancano Z"); incassi con data futura vietati.
- ✅ **Cliente obbligatorio all'INVIO del preventivo** (27 lug): bozze libere, badge "Senza cliente" in lista.
- ✅ **Ritenuta d'acconto** (27 lug): fase 1 = dicitura comma 67 per i forfettari (PDF + XML); fasi 2-6 in `RITENUTA_DACCONTO_TODO.md`, BLOCCATE fino alla conferma del commercialista (B.0).
- ✅ **Supabase Pro (backup)**: si attiva POCO PRIMA del lancio, non ora (decisione Eli 29 lug — primo passo del giorno del lancio in PRIMA_DEL_LANCIO.md).
- ✅ **Template** (28 lug): i pannelli dell'editor restano aperti (niente chiusura al click fuori); più aria tra le righe; documento reale ricalibrato sulle PROPORZIONI dell'anteprima (l'anteprima è il riferimento); restyle "Aria" (proposta B) + regola ferrea "mai parole spezzate a capo"; documento pubblico come "lettore" (sfondo caldo, foglio con ombra).
- ✅ **Verifica P.IVA anche sul Registro Imprese** (29 lug, "opzione 1"): catena VIES → OpenAPI Company (si paga solo se il VIES non conferma; senza chiave = solo VIES). Azione Eli: attivare l'API e mettere `OPENAPI_COMPANY_API_KEY` su Vercel.
- ✅ **Vetrina** (29 lug): mai vuota (ripiega su tutti i profili con nota); selettore "Ordina"; checksum P.IVA/CF in Impostazioni E rubrica clienti (avviso ambra non bloccante); campo richiesta "Email (consigliata) o telefono"; richieste vetrina in campanella + riepilogo email al cliente; niente impronta al rientro dalla vetrina.
- ✅ **Listino fornitore / costi / margine** (2 ago): progetto approvato e implementato F1+F2 — costo per voce e margine privato GRATIS per tutti; listini fornitori con scadenza + import/rinnovo AI = Pro (migration 062+063); "Catalogo e listini" a 2 linguette; sconto documento MAI spalmato sulle voci; margine a tendina; 🔒 **REGOLA PERMANENTE B.2: costo/ricarico/margine MAI al cliente** (PDF, /p, /r, email, snapshot). Campo Costo SEMPRE visibile e compatto (decisione Eli). Fase 3 (campanella scadenza listino ecc.) su richiesta.
- ✅ **Testata form preventivo/fattura minimal** (2 ago): striscia titolo ("Metti il titolo") + chip numero. **Chip numero**: Georgia, cliccabile, modifica IN-PLACE ("si modifichi dove è e basta"), scatola FISSA 122×30 (non si allarga al tocco), solo tratteggio su bianco/navy ("si deve quasi mischiare col resto"). Creazione fattura: chip informativo (numerazione fiscale non toccabile).
- ✅ **Menu del form → "Note, foto e condizioni"** (2 ago, scelta via domanda): due blocchi «Note (e foto)» / «Condizioni», sottotitoli 13px, divisori tra le voci. Vale anche per FatturaForm ("Note e condizioni" in edit).
- ✅ **Sfondo app mobile più marcato** (2 ago): #f0eee8 dietro le card (desktop invariato).
- ✅ **Rapportino SOLO anteprima** (2 ago): niente "Scarica in PDF" dentro l'HTML né nei bottoni — "Anteprima del rapportino" per artigiano E cliente; la card compare solo a lavoro finito/fatturato (o se il rapportino esiste già).
- ✅ **Pillole "Stato del lavoro" a dimensione stabile** (2 ago): niente allargamenti durante il caricamento (bordo sempre presente + spinner in overlay).
- ✅ **Riepilogo del form con la lista voci LIVE** (2 ago) + quantità SEMPRE mostrata ("· 1 pz" incluso); divisore tra le voci più marcato (#c7c4b9); card Voci richiudibile; esito import listino visibile e persistente (prima "non succede nulla").
- ✅ **Agenda: salto rapido mese/anno** (2 ago): il "mese anno" in testa è un bottone → pannello con anno a frecce + griglia 12 mesi.
- ✅ **Titoletti di sezione FUORI dalle card** (2 ago sera): Altro è il RIFERIMENTO del pattern; Home allineata (stesso stile 11px). 🔁 Supera il giro "dentro le card" dello stesso giorno ("stavano meglio fuori").
- ✅ **Card unica "In scadenza" in Home** (2 ago, mockup approvato): preventivo da sollecitare + fattura da incassare, Sollecita (mail/WhatsApp/chiama) per ENTRAMBI, due tasti compressi "Preventivi (N) → / Fatture (N) →" → la voce "Scadenze" SPARISCE da Altro. Scritte interne in grigio (#6f6d64, schiarito su richiesta), niente bordi oro sulle card della Home.
- ✅ **Logo dalle Impostazioni** (2 ago): "Carica il logo" è un BOTTONE vero e il file scelto non si perde più dopo "Salva" (bug React 19); accept senza svg.
- ✅ **Aria in fondo** (2 ago): "Salva impostazioni fiscali" e TUTTE le tab delle Impostazioni (+ /account) non finiscono più sotto il "+" della bottom-nav.
- ✅ **Contatti in vetrina a scelta dell'artigiano** (2 ago, scelta Eli: "2 interruttori, spenti"): opt-in per mostrare il telefono (bottone "Chiama") e/o un'email PUBBLICA dedicata (separata da quella di login) sul profilo pubblico; il modulo richiesta resta il canale di base. Migration 064.
- ✅ **Rifiniture Altro/Strumenti** (2 ago): "App già installata" non compare più; "Testo grande e leggibile" senza descrizione sotto.
- ✅ **Impronta richiesta più volte: risolto** (2 ago): race della cerimonia WebAuthn col timeout "Ad ogni apertura".
- ✅ **Apertura app senza lampi** (2 ago): una schermata sola (lucchetto), niente login/Home per un attimo; ogni modifica a /avvio richiede bump di CACHE_VERSION in sw.js.
- ✅ **Altro: Bilancio e "Fatti trovare" DENTRO la card Strumenti** (3 ago): via la sezione "Soldi" e la card singola — una card in meno da scorrere.
- ✅ **Dialog "Collega a un preventivo" adattato allo schermo** (3 ago, foto): righe con troncamento vero (lo stato "Scaduto" non è più tagliato) e bottoni su UNA riga ("Collega") — dialog molto più basso.
- ✅ **Banner viola "Fattura modificata" IN ALTO** (3 ago): prima card del dettaglio fattura, non più in fondo sotto riepilogo e bottoni.
- ✅ **Collega preventivo→fattura: la fattura eredita il cliente** (3 ago): così il contatto compare nelle scadenze e nei solleciti.
- ✅ **Matita fattura = form subito in alto** (3 ago): in modifica le card di sola lettura spariscono su mobile ("le schermate di modifica apparivano in basso e non me ne accorgevo").
- ✅ **Stato "Fatturato" del lavoro solo con fattura vera** (3 ago, scelta A di Eli): senza una fattura collegata il tocco è bloccato con la guida ("apri il preventivo e usa Converti in fattura"); il KPI "Fatturato" in Home conta già SOLO le fatture segnate Pagate (verificato).
- ✅ **Profilo pubblico: modulo richiesta PRIMA dei contatti diretti** (3 ago): i tasti Chiama / Scrivi un'email stanno DOPO il form ("voglio puntare al fatto che usino quello"), in una card sobria "Preferisci il contatto diretto?" coi bottoni bianchi (niente navy che competa col modulo).
- ✅ **Richieste in arrivo: bottoni Contatta al posto di "Segna come risposta"** (3 ago): ogni richiesta ha Chiama + WhatsApp (se il recapito è un telefono) o Scrivi un'email (se è un'email); al tocco la richiesta si segna DA SOLA "Risposta" — il bottone manuale è stato tolto. "Crea preventivo" resta il tasto navy a tutta larghezza.
- ✅ **Sfondo dell'app leggermente più chiaro** (3 ago): #f0eee8 → #f3f1ec → **#f6f4ef** (secondo schiarimento chiesto la sera; sempre grigio caldo; desktop invariato).
- ✅ **Dialog: MAI scroll orizzontale** (3 ago sera): il contenitore interno dei dialog ha overflow-x nascosto — un contenuto più largo si tronca, non si scorre.
- ✅ **Dal preventivo E dalla fattura si arriva DENTRO al lavoro collegato** (3 ago sera): tasto "Apri la scheda lavoro" quando il lavoro esiste (sulla fattura via preventivo di origine); il bottone che CREA il lavoro resta solo quando non esiste ancora.
- ✅ **Richieste: da "Risposta" si torna indietro** (3 ago sera): link "Non hai risposto? Segna come non risposta" → stato "Letta".
- ✅ **Form richiesta vetrina con CELLULARE separato** (3 ago sera, migration 065): campi "Email (consigliata)" + "Cellulare" — basta un recapito; se il cliente li lascia entrambi, l'artigiano vede tutti e due coi bottoni Chiama/WhatsApp/Email.
- ✅ **Import listino da PDF FUNZIONANTE** (3 ago sera): il vecchio percorso passava da Chromium che su Vercel non parte → falliva sempre. Ora si estrae il TESTO del PDF (unpdf) e lo struttura il modello testuale; PDF scansionati senza testo → messaggio che invita alla foto. Limite: PDF molto lunghi → si importa la prima parte (~10 pagine).
- ✅ **Apertura app: niente lampo della schermata di accesso** (3 ago sera): se il primo controllo dice "sloggato" si RIPROVA una volta (era la race del rinnovo del token) prima di mostrare /login. Service worker cc-v4.
- ✅ **Ricerca per dicitura di stato nelle liste** (3 ago sera, punto 10): nel cerca di Preventivi e Fatture si può scrivere anche la dicitura composta o una sua parte — "fattura annullata", "bozza fattura", "annullate", "annull" — e filtra per stato; una parola che non è uno stato fa la normale ricerca di testo.
- ✅ **Dialog: nomi lunghi coi tre puntini, mai scritte tagliate** (3 ago sera, foto): causa vera = la griglia interna del dialog si allargava ai nomi senza spazi; ora le colonne non sbordano e i truncate funzionano (verificato sul componente reale a 360px).
- ✅ **Sfondo: terzo schiarimento** → #f8f6f1.
- ✅ **Tasto "Apri la scheda lavoro" nello stesso punto su preventivo e fattura** (zona azioni in fondo).
- ✅ **Richiesta → preventivo: cliente in rubrica automatico e preselezionato** (3 ago sera): via il titolo precompilato che usciva troncato; il cliente della richiesta viene registrato in rubrica (o riusato se già esiste con la stessa email/telefono) e arriva selezionato nel riquadro Cliente.
- ✅ **Import PDF: TUTTE le pagine analizzate (fino a ~50), a pezzi** (3 ago sera): niente più limite alle prime 10 — il documento viene spezzato e analizzato in parallelo; oltre le ~50 pagine (o se un pezzo non si legge) compare un AVVISO onesto all'artigiano. Risolto anche il "AI non disponibile" (output troncato sui prezzari lunghi).
- ✅ **Linguette "Il mio catalogo | Listini fornitori" più alte** (3 ago sera): governano tutta la pagina sotto.
- ✅ **"Sollecita per mail" in Home più morbido** (3 ago sera): bianco bordato come WhatsApp/Chiama, senza perdere importanza (icona + larghezza piena).
- ✅ **Card Voci compatta = VARIANTE B del mockup** (3 ago sera, scelta Eli): su mobile le voci compilate stanno chiuse in una riga (descrizione · dettaglio · totale) e si apre quella che tocchi, col layout compatto (totale in testata, 📐 dentro Q.tà, costo su una riga); la voce nuova nasce aperta. Desktop invariato.
- ✅ **Visualizzazioni dentro la cronologia** (3 ago sera): niente card/sezione dedicata — evento "Aperto dal cliente · N volte" con prima/ultima apertura.
- ✅ **Badge SdI con ESITO in lista fatture + ricerca** (3 ago sera): "SdI consegnata/inviata/emessa/scartata" al posto di "SdI ✓"; nel cerca funzionano "sdi", "sdi consegnata", "sdi scartate" e i prefissi.
- 🔁 **Cronologia: OGNI apertura elencata con data e ora** (3 ago notte — supera il riassunto "N volte" del giro precedente): una voce per ciascuna apertura del cliente, in ordine cronologico.
- ✅ **Cronologia con ogni minima azione, anche indietro-e-avanti** (3 ago notte): le transizioni manuali (Segna accettato/rifiutato/scaduto, Riporta in bozza, Riapri) lasciano una voce con data e ora; cronologia mobile dei preventivi unificata sul componente completo (prima su mobile mancavano modifiche/incassi/reinvii).
- ✅ **"Salva e invia" anche in modifica** (3 ago notte): nel form di modifica accanto ad "Aggiorna" c'è il bottone navy che salva e apre il pop-up d'invio — copre il caso "aggiungo il cliente e poi non trovo Invia".
- ✅ **3 FAQ nuove in /aiuto** (3 ago notte): come si modifica una bozza e dove cliccare · come cercare le fatture SdI · come trovare i preventivi scaduti.
- 🔁 **Esito SdI in lista fatture = dicitura, non badge** (3 ago notte — supera il badge del giro precedente): stessa grafica della "fattura collegata" nella lista preventivi ("SdI · Consegnata" testo colorato con iconcina, in seconda riga a destra).
- ✅ **REGOLA: la cronologia è la STORIA del documento, nulla si cancella** (3 ago notte): le aperture del cliente (e ogni altro evento) restano visibili anche dopo Riporta in bozza / Riattiva — mai filtrare la cronologia per lo stato corrente.
- ✅ **FAQ "Come gestisco i listini dei fornitori?"** in /aiuto (3 ago notte).
- ✅ **Promemoria "preventivo fermo"** (4 ago): notifica interna all'artigiano se un preventivo inviato resta 7 giorni senza risposta (nessuna email al cliente). Toggle in Notifiche.
- ✅ **Preventivo ricorrente dal richiamo** (4 ago): dal Lavoro, quando scatta il richiamo di manutenzione, un tocco prepara il nuovo preventivo con cliente e voci dell'anno prima (da rivedere e inviare).
- ⏳ **Pagamento con carta dalla fattura** (4 ago): deciso "appena possibile" — Stripe Connect Standard, progetto in PROGETTO_PAGAMENTI_CARTA.md; cancelli: Stripe live, attivazione Connect (Eli), riga dossier avvocato.

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
