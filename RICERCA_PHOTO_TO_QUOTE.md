# Ricerca approfondita: "photo-to-quote" — 13 luglio 2026

> Fase 1 del piano di Eli (ricerca → proposta → miglioramento/integrazione).
> Metodo: deep-research (5 angoli di ricerca paralleli, 15 fonti lette, 20
> affermazioni estratte) + verifica manuale diretta delle affermazioni portanti
> (la verifica automatica a 3 voti è saltata per limite di sessione; le claim
> chiave sono state ri-verificate una a una con ricerche mirate).

## 1. Cosa esiste oggi (verificato)

### Handoff (USA) — il riferimento della categoria
- Input: foto, planimetrie, o una breve descrizione testuale ("quick scope") — la
  foto è UNO dei canali, sempre affiancabile dal testo.
- **Gerarchia prezzi (CONFERMATA, è il pattern che ci interessa): prima i
  cataloghi/price book DELL'UTENTE, poi i cataloghi fornitori, e solo in assenza
  il prezzo AI da database di mercato USA** (localizzato per città — non
  replicabile in Italia). Import del price book da Excel/CSV/PDF/foto.
- Prezzi 2026: Flex $119-149/mese (50 crediti AI), Pro $239-299 (AI illimitata),
  Scale $479-599; gli "AI Takeoffs" (computi da planimetria) solo sul piano top.
- **Recensioni contractor (G2/Capterra): il risparmio di tempo è amato, il
  PREZZO AI di mercato è il punto debole** — "accurate tranne la manodopera",
  "i numeri non sono competitivi", caso citato: "$7.500 per installare e
  verniciare 8 porte, i clienti riderebbero". Allucinazioni occasionali →
  serve rilettura. Lamentela pratica: non accetta HEIC (il formato foto iPhone!).

### ServiceM8 Auto-Quote (guida ufficiale, CONFERMATA)
- NON parte dalle foto: analizza la job card (note/dettagli) + lo storico
  fatture di lavori simili DELL'ACCOUNT. Serve uno storico di **~100 lavori
  completati** prima che dia risultati ragionevoli → inutilizzabile per account
  nuovi (vincolo chiave: noi useremo il catalogo, non lo storico).
- Output esplicitamente BOZZA da rivedere, con la motivazione ("rationale")
  mostrata in fondo → l'utente vede PERCHÉ l'AI ha proposto quelle voci.

### Jobber (set 2025), Hover, Buzzard AI (Germania)
- Jobber: bozze di preventivo AI dalla richiesta del cliente (testo), review umana.
- Hover: le MISURE vere da foto le ottiene con fotogrammetria guidata multi-foto
  (modello 3D della casa) — tecnologia proprietaria, fuori dalla nostra portata
  e non necessaria per il nostro caso d'uso.
- **Buzzard AI (l'unico "photo-to-quote" europeo trovato)**: le quantità vengono
  dalle MISURE dell'artigiano (Aufmaß), i prezzi dai SUOI listini/calcolazione,
  le foto sono contesto; review-and-approve rigoroso; dati su server tedeschi con
  pseudonimizzazione. MA: modello consulenziale enterprise — €2.500 una tantum +
  €250-700/mese, integrazione sopra i gestionali tedeschi (Lexware, DATEV).
  **In Italia/EU non esiste NULLA di self-serve per microimprese.**

## 2. Cosa sa fare davvero la tecnologia (verificato)

- **Benchmark VSI-Bench (NYU, CVPR 2025)**: sui compiti visuo-spaziali da video
  di interni reali, gli umani fanno ~79% e il miglior modello è ~33 punti sotto;
  sui compiti di stima della DISTANZA ASSOLUTA i modelli faticano a superare il
  livello del caso. Il chain-of-thought NON risolve (nel paper peggiora perfino
  alcuni task di stima dimensioni).
- **Conclusione tecnica netta: foto → AMBITO dei lavori (cosa c'è da fare,
  checklist voci) = affidabile; foto → QUANTITÀ/superfici in metri = NO.**
  Le quantità devono venire dall'artigiano (o dalle sue note dettate), mai
  "misurate" dall'AI. È esattamente come lavorano ServiceM8 e Buzzard.
- Costi vision: con modelli piccoli (pixtral / gpt-4o-mini classe) una richiesta
  con 4-6 foto + note + estratto catalogo costa nell'ordine di POCHI CENTESIMI —
  compatibile coi tetti $10-15/mese (stima da listini correnti, da ricontrollare
  al momento dell'implementazione).

## 3. Cosa la rende utile e non un giocattolo (dalle recensioni reali)

USATA quando: fa risparmiare la BATTITURA e la completezza dello scope (voci
dimenticate trovate — "scope da $2.500 trovato dalla foto"); bozza in minuti
invece di ore la sera.
ABBANDONATA quando: i prezzi AI sono fuori mercato (il difetto n.1 di Handoff);
le allucinazioni non vengono segnalate; formati foto non supportati (HEIC).

Best practice consolidate dai 3 player seri:
1. Prezzi SOLO dal price book dell'utente (Handoff hierarchy, Buzzard).
2. Quantità dall'utente, non dalla vision (ServiceM8, Buzzard).
3. Output = bozza con "rationale" visibile + approvazione umana obbligatoria.
4. Se una voce non matcha il catalogo → segnalarla come "da prezzare", MAI
   inventare il prezzo.

## 4. Implicazioni per Carta Canta (per la fase 2 — proposta)

- L'opportunità è CONFERMATA: nessuna offerta self-serve in EU/Italia per micro;
  i player USA costano $119-599/mese; noi abbiamo già foto sopralluogo, dettatura,
  pipeline vision (scontrini), extract-voci, catalogo per utente, quote/kill-switch.
- La ricetta vincente (e prudente, in linea con B.0): foto+note → l'AI propone la
  CHECKLIST delle voci col testo professionale; quantità precompilate SOLO se
  presenti nelle note dell'artigiano (dettatura), altrimenti campo evidenziato
  "da compilare"; prezzo SOLO dal catalogo utente (match), altrimenti voce
  contrassegnata "da prezzare"; bozza sempre, con motivo per voce; disclaimer.
- Dettagli pratici emersi: supportare HEIC (foto iPhone); mostrare il rationale;
  contare la quota al successo come per l'AI import.

## Fonti principali
- handoff.ai (pricing, instant-ai-estimates, blog price books, help center
  "Pricing Explained" e "How Do I Get Local Pricing") · g2.com/products/handoff ·
  capterra.com/p/10026318/Handoff
- support.servicem8.com "How to use Auto-Quote and Auto-Invoice" ·
  servicem8.com/ai-job-management-software-for-trade-contractors
- arxiv.org/abs/2412.14171 "Thinking in Space" (VSI-Bench, CVPR 2025) ·
  vision-x-nyu.github.io/thinking-in-space.github.io
- buzzard-ai.de (angebotserstellung-automatisieren-handwerk e pagine integrazioni)
- getjobber.com + PR set 2025 (bozze preventivo AI)
