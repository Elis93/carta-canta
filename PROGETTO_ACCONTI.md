# PROGETTO — Fattura di acconto (TD02), saldo a conguaglio e valore dei beni significativi

> **Stato:** piano approvato nelle scelte di fondo, da implementare a fasi.
> **Scritto il 23 settembre 2026**, dopo la lettura integrale di **sette documenti ufficiali**
> (elenco in §8). Ogni regola qui sotto è citata dalla fonte primaria, non da sintesi.
> **Regola di progetto di Eli:** *«ogni scelta come fanno i competitors»* + B.0 (prudenza legale).

---

## 0. Perché questo progetto esiste

L'artigiano incassa un **acconto** prima di finire il lavoro. Oggi Carta Canta registra
quell'incasso (`payment_status = 'partial'` sul preventivo accettato) e fa partire il conto
alla rovescia dei 12 giorni — **ma non emette nessuna fattura**. Per l'Agenzia delle Entrate
quell'operazione è già effettuata e la fattura è dovuta.

Il commercialista l'ha confermato il 18 settembre: **fattura a ogni incasso, anche solo acconto.**

Costruendo la ricerca è emerso un **secondo difetto, già attivo in produzione e indipendente
dagli acconti**: il valore dei beni significativi è calcolato sul **prezzo di vendita** invece
che sul **costo**. Va chiuso per primo, perché è il fondamento su cui poggia il calcolo di ogni
fattura di acconto.

---

## 1. Le regole, con le fonti

### 1.1 Quando nasce l'obbligo
**Art. 6 c. 4 DPR 633/1972**: se il pagamento arriva prima della consegna o della fine del
lavoro, l'operazione si considera effettuata **in quel momento e per quell'importo**.
**Art. 21 c. 4**: da lì corrono **12 giorni** per emettere e trasmettere.

La **Guida AdE 1.10** tratta TD01, TD02, TD03, TD06 e TD07 **nello stesso paragrafo**, con le
stesse istruzioni: *«Il cedente/prestatore, entro dodici giorni dal momento di effettuazione
dell'operazione, emette una fattura»*. Per il tracciato il TD02 **non ha niente di speciale**.

La **circolare 71/E §5** ricorda che *«le prestazioni di servizi si considerano effettuate al
momento del pagamento del corrispettivo e, se antecedente, al momento di emissione della
fattura»*.

⚠️ **La data del documento è la data dell'INCASSO**, non quella in cui si crea la fattura.
Nel nostro «Registra acconto» l'artigiano **inserisce già la data** (`dateYmd` → `paid_at`,
retrodatabile): è esattamente il campo giusto.

### 1.2 Il tipo documento
**TD02 — Acconto/anticipo su fattura.** Il TD03 è il gemello per chi emette *parcella*; la
Guida 1.10 li tratta insieme e l'Agenzia ha chiarito che *«non ci sono differenze sostanziali»*,
essendo entrambi riconducibili alla voce generica «fattura». **Per noi: TD02, sempre.**

### 1.3 Il saldo è un conguaglio, non una fattura sul residuo
Il saldo è un **TD01 sull'importo pieno**, con una **riga negativa** che scomputa gli acconti
già fatturati. Le fonti ammettono entrambe le strade (solo il residuo, oppure il totale con la
riga negativa); **scegliamo la seconda**, perché è quella dei concorrenti e perché il cliente
vede il lavoro intero e capisce cosa sta pagando.

Il **tracciato FatturaPA**, campo **2.2.1.4 `<Descrizione>`**, la prevede espressamente:

> *«Natura e qualità dell'oggetto della cessione/prestazione; può fare anche riferimento a
> cessioni/prestazioni già oggetto di un precedente documento emesso a titolo di
> "anticipo/acconto", nel qual caso il valore dell'elemento informativo 2.2.1.9 PrezzoUnitario
> e 2.2.1.11 PrezzoTotale potranno essere valorizzati **con segno negativo**»*

⚠️ Quindi la descrizione della riga negativa **deve richiamare il documento di acconto**.

**L'aliquota della riga negativa è la stessa** della voce originale, così l'imponibile del
saldo risulta il residuo e vale il controllo: *IVA acconto + IVA saldo = IVA sull'intero
corrispettivo*.

### 1.4 Il collegamento fra saldo e acconti
**Blocco 2.1.6 `<DatiFattureCollegate>`**, dalla rappresentazione tabellare:

> *«Blocco contenente le informazioni relative alle fatture precedentemente trasmesse e alle
> quali si collega il documento presente; riguarda i casi di invio di nota di credito **e/o di
> fatture di conguaglio a fronte di precedenti fatture di acconto**»* — molteplicità **`<0.N>`**

Due cose: è **ripetibile** (N acconti in un saldo) e il nostro caso è **l'uso dichiarato** del
blocco. Figli: `IdDocumento` **`<1.1>`** obbligatorio (max 20 caratteri), `Data` **`<0.1>`**
facoltativa — la mettiamo comunque, è ciò che rende il riferimento leggibile.

La **Guida 1.10** non lo *impone* nel paragrafo del TD02 (lo impone solo per TD04/TD05), ma la
sua prefazione spiega perché metterlo: *«L'osservanza di tali indicazioni permette la corretta
annotazione delle operazioni IVA nelle bozze dei registri precompilati dall'Agenzia»*. Senza,
il commercialista si ritrova bozze da correggere a mano.

### 1.5 Beni significativi: il valore è il COSTO
**Circolare 15/E/2018**, pagina 14:

> *«l'intervento del legislatore è, altresì, diretto ad escludere dal valore del bene
> significativo il **margine aggiunto dal prestatore** al costo di produzione o al costo di
> acquisizione del bene per determinare il prezzo finale di cessione al cliente (il c.d.
> mark-up). Ciò che rileva, dunque, è solo il **costo "originario"** del bene significativo,
> sia esso di produzione ovvero di acquisizione presso terzi»*

E l'esempio ufficiale (pagine 15-16): corrispettivo **1.800** = bene **1.000** + manodopera
**600** + **mark-up 200**, e il mark-up sta **con la manodopera**, dalla parte agevolata.

⚠️ **Cronologia da tenere a mente**: la 71/E §4.2 (2000) diceva *«deve essere assunto quello
risultante dall'accordo contrattuale stipulato dalle parti»* e la 98/E §4.1.2 *«non inferiore al
costo d'acquisto, determinato dal prestatore nell'ambito della sua autonomia contrattuale»* —
cioè **il prezzo**. La norma di interpretazione autentica del 2018 (art. 1 c. 19 L. 205/2017),
**retroattiva**, ha ristretto: vale il costo. **Il nostro motore applica la regola del 2000.**

**Decisione di Eli (23 set):** *«dato che lo chiede l'Agenzia delle Entrate facciamo
esattamente come richiede. La sua indicazione deve essere applicata sempre da noi in modo
corretto e adempiente.»*

### 1.6 La formula dello split (già corretta da noi)
**Circolare 98/E §4.1.4**:

> *«Tale limite di valore deve essere individuato **sottraendo dall'importo complessivo della
> prestazione soltanto il valore dei beni significativi**. Il valore delle materie prime e
> semilavorate nonché degli altri beni necessari per l'esecuzione dei lavori, forniti
> nell'ambito della prestazione agevolata, **non deve essere individuato autonomamente in
> quanto confluisce in quello della manodopera**»*

Con C = corrispettivo, B = valore bene, P = C − B: **10% = P + min(B,P)** · **22% = max(0, B−P)**.
È la nostra formula. ✓

E il trattamento unitario, sempre §4.1.4: *«anche se l'intervento si sostanzia in diverse opere
di manutenzione… deve essere considerato unitariamente **se le diverse opere sono oggetto di
un'unica previsione contrattuale**»*. Un preventivo = un contratto = un intervento. ✓

### 1.7 Beni significativi negli ACCONTI
**Circolare 71/E §5.2** — la regola che regge tutta la fase 2:

> *«se la realizzazione dello intervento di recupero comporta anche la fornitura di beni
> significativi, il limite di valore entro cui applicare l'aliquota del 10 per cento ai suddetti
> beni **dovrà essere calcolato in relazione all'intero corrispettivo dovuto dal committente e
> non ad un singolo acconto o al solo saldo**. Il valore del bene significativo dovrà poi essere
> riportato, **nella quota percentuale corrispondente alla parte di corrispettivo pagata, in
> ogni fattura relativa al singolo pagamento**, indicando sia la parte da assoggettare
> all'aliquota del 10 per cento sia quella da assoggettare all'aliquota ordinaria»*

**Esempio.** Caldaia 3.500 (costo) + posa e materiali 1.500 = 5.000.
Split del documento intero: **3.000 al 10%** · **2.000 al 22%**.
Acconto 30% → **900 al 10% + 600 al 22%**. Saldo 70% → **2.100 al 10% + 1.400 al 22%**.
Quadratura: 900+2.100 = 3.000 ✓ · 600+1.400 = 2.000 ✓

**In una riga:** lo split si calcola **una volta sul documento intero**, poi ogni fattura ne
prende la sua percentuale da **ciascun secchiello**.

⚠️ **E non si aggiusta dopo.** La **risposta 216/2020** riguarda un *acconto generico*, dove la
ripartizione fra aliquote era impossibile: lì l'Agenzia dice che l'aliquota ordinaria fu
**correttamente** applicata e che non c'era nulla da correggere. Aggiunge che un errore vero
*«avrebbe potuto essere corretto al più tardi entro un anno dalla sua commissione»* (art. 26
c. 3). **Il nostro acconto non è mai generico** — si riferisce a un preventivo con voci e
aliquote note — quindi la scorciatoia «tutto al 22% per prudenza» **non ci è disponibile**.

### 1.8 Cosa va scritto in fattura
**Circolare 71/E §5.1**: *«occorre che in fattura sia indicato sia il corrispettivo complessivo
dell'operazione, comprensivo del valore dei suddetti beni, che il valore di questi ultimi»*,
e *«i suddetti dati devono essere evidenziati in fattura **anche nel caso in cui dal calcolo
risulti che l'intero valore del bene significativo deve essere assoggettato all'aliquota
ridotta**»*.

✅ La nostra dicitura (`beniNotice`, `lib/pdf/template.ts:695`) **è già strutturalmente
conforme**, compreso il caso senza eccedenza. Cambia solo il **numero** del valore del bene.

⚠️ **Conseguenza da accettare consapevolmente:** il valore del bene scritto in fattura **è il
costo**, e quindi il cliente lo vede. Va contro la regola §B.2 «costo, ricarico e margine mai al
cliente» — ma è un **obbligo di legge** e Eli ha deciso di rispettarlo. Tre attenuanti: vale
**solo in regime ordinario** (i forfettari non sono toccati, il modulo esce con `null`), solo
su **manutenzione di immobile abitativo** con dentro **uno dei sette beni**, e il cliente scopre
il costo della caldaia, **non** il margine sulla manodopera.

### 1.9 Ritenuta, reverse charge, bollo
- **Ritenuta 4% del condominio** (art. 25-ter DPR 600/1973): si applica **su ogni pagamento,
  acconti compresi**, sull'imponibile al netto dell'IVA. Sul saldo si calcola **sul residuo** e
  torna da sé: 4% acconto + 4% saldo = 4% del totale. **Non si cumula** con l'11% trattenuto
  dalla banca sul bonifico parlante dei bonus edilizi (regola già nel nostro ⓘ).
- **Reverse charge** (art. 17 c. 6 lett. a-ter): l'acconto segue lo stesso regime — TD02 **senza
  IVA**, natura **N6.7**, dicitura «inversione contabile». Solo B2B.
- **Bollo**: la soglia di **77,47 €** si valuta **per singolo documento**. Acconto 900 + saldo
  2.100 → **2 € + 2 € = 4 €**. Acconto 50 + saldo 2.950 → **solo 2 €**. Saldo ridotto sotto
  soglia dalla riga negativa → **niente bollo sul saldo**. ✅ Il nostro motore lega già il bollo
  all'**assenza di IVA** e lo calcola sull'imponibile del documento: **i tre casi escono giusti
  senza toccare niente**. Quello che manca è **dirlo** all'artigiano.

### 1.10 Numerazione
**Risoluzione 1/E del 10 gennaio 2013**: *«è compatibile con l'identificazione univoca prevista
dalla formulazione attuale della norma **qualsiasi tipologia di numerazione progressiva che
garantisca l'identificazione univoca della fattura**, se del caso, anche mediante riferimento
alla data della fattura stessa»*. La numerazione per anno solare resta ammessa.

⚠️ La risoluzione enuncia il **principio** (univocità), non elenca i sezionali: la lettura
«più serie in parallelo, ciascuna progressiva» è pacifica in dottrina e — cosa che conta di più —
**è quella che usiamo già in produzione con «NC» e «ND»**, collaudata in sandbox.

**Decisione di Eli:** sezionale **`ACC`** → `ACC 001/2026`.
Il formato regge: `DOC_NUMBER_RE` ammette fino a 8 lettere + spazio, e il campo `Numero` del
tracciato è alfanumerico max 20 caratteri (controllo **00425**: almeno una cifra — c'è sempre).
⏭️ L'idea del commercialista dei **sezionali per lavorazione** (A, A NC, A ND, A acc, B, …) è
confermata come direzione giusta — Aruba e Fatture in Cloud hanno i sezionali configurabili per
tipologia — ma **rimandata** (decisione di Eli).

---

## 2. FASE 1 — Il valore del bene significativo è il costo — ✅ IMPLEMENTATA (23 set)

> **Difetto già attivo in produzione, indipendente dagli acconti. Si fa per primo** perché ogni
> fattura di acconto ne eredita il calcolo.
>
> **Esito della rivalutazione pre-implementazione** (tre aggiustamenti rispetto al piano):
> ① le **due select esplicite di `/p/[token]`** (principale + TierPicker) non portavano
> `unit_cost` → aggiunto (eccezione §B.2 commentata nel codice; le prop dei componenti restano
> a campi espliciti, il costo entra SOLO nel motore) — tutte le altre superfici erano già
> coperte (`select('*')` o voci del form);
> ② **invariante nuova, il TETTO**: col valore = costo l'eccedenza `B − P` può superare il
> *prezzo* dei beni (sottocosto patologico) — il vecchio codice ne era immune per costruzione.
> `splitDocumento` la cappa al prezzo dei beni, su righe E dicitura insieme;
> ③ la **ripartizione fra più beni** va in proporzione al costo (non al prezzo), residuo
> sull'ultima, cap per-voce al prezzo con riconciliazione (le due righe di una voce sommano
> SEMPRE al suo prezzo: il totale del documento non cambia).
> In corsa sono emersi e chiusi anche: FiscalSummary/anteprima-acconto/`proposte.ts` che
> STRIPPAVANO `unit_cost` nelle mappature verso il motore (stessa classe del flag mancante del
> 12 ago), l'insert della **nota di credito** che lo perdeva (avrebbe fatto scattare la guardia
> 00421 alla trasmissione), e la **NC parziale** che scalava il prezzo ma non il costo.
> Verificata la conversione SQL (082 copia già `unit_cost`) → **nessuna migration**.
> Test 855/855 (+10 sul costo, esempio ufficiale 15/E compreso) · render Chromium dei 4 preset:
> 0 sbordi, dicitura col costo, IVA 204 sull'esempio ufficiale.

### 2.1 Il difetto, misurato
`valoriPerSplit` (`lib/fiscal/beni-significativi.ts`) calcola `valoreBeni` con `importoVoce`,
cioè `quantity × unit_price × (1 − sconto)` — **il prezzo di vendita, ricarico compreso**.

Misurato sul modulo vero, coi numeri dell'esempio della circolare:

```
CIRCOLARE (bene = costo 1.000):   10% su 1.600 | 22% su  200 | IVA 204,00
NOSTRO    (bene = prezzo 1.200):  10% su 1.200 | 22% su  600 | IVA 252,00
DIFFERENZA IVA addebitata al cliente:                            48,00
```

Su un lavoro da 1.800 € il cliente paga **48 € di IVA in più del dovuto**. La direzione è
«prudenziale» (si versa di più, nessun rischio di sanzione per l'artigiano), ma è un errore.

### 2.2 Cosa si cambia
1. **`valoriPerSplit`**: `valoreBeni` viene dal **costo** della voce (`unit_cost × quantity`),
   non dal prezzo. `valorePrestazione` = `C − B` — cioè il ricarico del bene **confluisce nella
   prestazione**, esattamente come il mark-up dell'esempio ufficiale.
2. **Il costo diventa obbligatorio** sulla voce marcata come bene significativo, **solo in
   regime ordinario**. La spunta «È un bene significativo» apre il campo Costo e lo chiede.
3. **La pillola 🔒 «solo tu lo vedi» cambia su quel campo**, e solo lì: diventa un avviso che
   dice che quel valore **comparirà in fattura**, perché la legge lo impone. Altrove il costo
   resta privato: la regola §B.2 non si tocca, si eccettua un caso e lo si spiega.
4. **Ripiego onesto**: costo mancante → si usa il prezzo (comportamento di oggi) **con un
   avviso ambra** che dice che l'IVA potrebbe risultare più alta del dovuto. Mai un calcolo
   silenziosamente sbagliato.
5. **`beniNotice` non si tocca**: stampa già le voci giuste, cambia solo il numero.

### 2.3 Casi da coprire coi test
- Esempio ufficiale 1.800/1.000/600/200 → 10% su 1.600, 22% su 200
- Costo assente → ripiego sul prezzo, nessun crash
- Costo > prezzo (voce venduta in perdita) → il costo resta il valore del bene
- P = 0 (il bene è l'unica voce al 10%) → tutto al 22%, invariante di agosto
- Forfettario → `null`, nessuno split
- Più beni marcati → ripartizione dell'eccedenza proporzionale, residuo sull'ultima

### 2.4 Superfici da verificare
Motore · PDF (4 preset) · pagina cliente `/p/[token]` · fogli interni · `FiscalSummary` ·
`ivaEffettivaVoci` (pillole per voce) · XML `doc-xml.ts` · TierPicker.
⚠️ Verifica **regola F**: render reale dei 4 preset in Chromium.

---

## 3. FASE 2 — La fattura di acconto TD02 — ✅ IMPLEMENTATA (24 set)

> **Esito dell'implementazione** (scostamenti e conferme rispetto al piano):
> - **Nessuna migration** (confermato §3.1): `doc_type` è TEXT senza vincolo, la RPC
>   `next_invoice_number` era già chiavata sul tipo, `origin_document_id` esiste.
>   Nessuna colonna nuova: «acconto scomputato» si ricava da
>   `doc_type='fattura_acconto'` + `origin_document_id`, come previsto.
> - **Modulo puro nuovo `lib/fiscal/acconto.ts`**: `righeAcconto()` — dall'importo
>   incassato (lordo) alle righe della TD02. Secchielli per aliquota da
>   `riepilogoIva` sulle voci ESPANSE dei beni significativi (stessa fonte dei
>   totali → mai divergenti), ripartizione proporzionale (71/E §5.2), scorporo a
>   ritroso con quadratura al centesimo (scarto ≤ 1 cent dichiarato quando il
>   lordo non è raggiungibile — es. 100,01 al 22%), descrizioni specifiche
>   («Acconto su {titolo} — preventivo {N} del {data}», mai il generico che la
>   Guida vieta), `dicituraBeni` col valore del bene in quota (`quotaAccontoBene`
>   finalmente cablata) scritta nelle note del documento. Forfettario/reverse:
>   una riga, importo = imponibile. 21 test nuovi (esempio ufficiale col 30%,
>   quadrature, sconto documento, degeneri) + 4 sull'XML TD02.
> - **`registerDepositReceivedAction` crea la TD02**: ordine TD02-prima-incasso-poi
>   con ROLLBACK (se l'incasso sul preventivo fallisce, la TD02 si elimina —
>   successo = tutti e due, fallimento = nessuno). Nasce `status='accepted'`
>   (pagata), `paid_amount` = importo, `doc_date` = giorno dell'incasso
>   (scrittura tollerante 080), reverse ereditato, multi-proposta → voci della
>   proposta accettata. Guardia nuova: un acconto GIÀ registrato non si
>   sovrascrive (N acconti = Fase 3). Il controllo «fattura collegata» ora
>   filtra `doc_type='fattura'` (le TD02 non bloccano il flusso).
> - **Correzione = eliminazione**: la TD02 non ha transizioni di stato («pagata»
>   per costruzione, l'incasso vive sul preventivo); eliminarla (non trasmessa)
>   AZZERA l'acconto sul preventivo — dialog che lo dice, retry sul reset.
> - **Blocco-ponte**: `converti-fattura` rifiuta (409, fail-closed) i preventivi
>   con TD02 attive — la fattura piena conterebbe due volte l'acconto. Cade
>   con la Fase 3 (saldo a conguaglio).
> - **Bilancio**: TD02 ESCLUSA dalle 3 query di cassa (come la NC — l'incasso
>   resta contato sul preventivo, zero doppi conteggi); INCLUSA nel registro
>   fatture e nell'export CSV col segno + ed etichetta propria.
> - **~90 punti in ~45 file** (censimento: 185 punti, molti [AUTO] via gli
>   helper centrali): docTypeLabel/docTypePath/isFemminile/eventoLabel/
>   badgeLabel/StatusBadge col ramo nuovo; SdI (doc-xml, trasmetti, types,
>   esito/reclaim/forza-esito) → TD02; copia di cortesia (blocco pre-esito,
>   copia automatica all'esito, quota Free consumata come una fattura);
>   PDF «FATTURA DI ACCONTO» senza il riquadro «Come pagare» (è già incassata);
>   liste/Home/da-trasmettere/campanella; ricerca `isAccontoQuery`
>   («acconto», «acc», «td02»); email col tipo vero.
> - **Difetti pre-esistenti della NOTA DI DEBITO chiusi in corsa** (stessa
>   classe, trovati dal censimento): PDF intitolato «PREVENTIVO», nessuna
>   dicitura SdI sulla copia, doc_date mai scritta, niente guardie di
>   trasmissione/eliminazione/purge, **cancellata con l'account** (account.ts
>   usava `.neq('fattura')` — ora `.eq('preventivo')`), «Fatt. ND» in Home.
> - ⚠️ **Residui dichiarati**: con SdI spento la TD02 nasce comunque (giusto:
>   numerazione e registro) ma non è trasmissibile dall'app — la card SdI
>   compare solo col flag; niente NC/ND su una TD02 (il server le ammette solo
>   sulle fatture piene); il form in sola lettura della TD02 parla da
>   «fattura»; il Fatturato della Home non conta gli acconti (decisione da
>   prendere con la Fase 3, quando il saldo esce al netto); il ripristino dal
>   cestino di una TD02 NON ri-registra l'acconto sul preventivo.
> - Collaudi **T22-T25** in TEST_DA_FARE_ELI.
> - ⏳ **DA VALUTARE (Eli, 26 set, dal collaudo T22) — correzione di un acconto
>   e cosa può fare l'artigiano.** Il banner della TD02 diceva «Se l'incasso è
>   sbagliato: «Segna come non pagata»» — comando che sulla TD02 NON esiste
>   (è pagata per costruzione). Il testo è stato corretto subito (TD02 non
>   trasmessa → «usa Elimina fattura di acconto: l'acconto sul preventivo si
>   azzera»; trasmessa → «parlane col commercialista»), ma va progettato il
>   FLUSSO intero, con ogni caso spiegato in parole semplici:
>   ① incasso registrato + TD02 creata, NON trasmessa → oggi: si elimina la
>   TD02 e l'acconto si azzera. Serve anche la strada inversa: dal PREVENTIVO
>   un comando «l'acconto era sbagliato» che chieda «eliminare anche la
>   fattura di acconto ACC …?» (oggi sul preventivo non c'è nessun comando di
>   azzeramento dell'acconto);
>   ② TD02 GIÀ TRASMESSA allo SdI → non si elimina; la correzione fiscale è
>   una nota di credito sulla TD02 (oggi il server le ammette solo sulle
>   fatture piene) o l'assorbimento nel saldo a conguaglio della Fase 3 —
>   decisione da prendere col commercialista;
>   ③ acconto rimborsato perché il lavoro salta → TD04 DOPO la restituzione
>   (§6 casi limite);
>   ④ dove si spiega: banner della TD02, AccontoCard sul preventivo, dialog di
>   eliminazione, FAQ «Cos'è la fattura di acconto… Posso correggerla?».
>   Da decidere con Eli PRIMA della Fase 3 (i casi ② e ③ la toccano).
>   🔎 **Ricerca del 26 set sul caso ② (TD02 già trasmessa con importo sbagliato).**
>   Le due strade NON sono alternative in ogni caso — dipende dal verso dell'errore:
>   · **fatturato PIÙ dell'incassato** → vanno bene entrambe: nota di credito TD04
>     collegata alla TD02 per la differenza, **entro un anno** (art. 26 c.3 — errore; è la
>     regola che la risposta 216/2020 cita per esteso), oppure si lascia la TD02 com'è
>     (art. 6 c.4: la fattura emessa prima dell'incasso vale per l'importo fatturato) e il
>     saldo la scomputa per intero (tabellare 2.1.6: `DatiFattureCollegate` ha proprio il
>     caso d'uso «conguaglio a fronte di precedenti fatture di acconto»; 2.2.1.4 la riga
>     negativa).
>     📄 **Interpello 488/2022 LETTO (PDF caricato da Eli, 26 set)** — cosa dice davvero:
>     ① gli acconti seguono il regime IVA dell'operazione a cui si riferiscono; il criterio
>     di ripartizione fra regimi diversi lo sceglie il contribuente, purché «oggettivo,
>     coerente… e obiettivamente verificabile» (conferma la nostra ripartizione
>     proporzionale 71/E §5.2); ② ⚠️ **distingue due casi che noi avevamo messo insieme**:
>     se l'acconto era GIUSTO quando è stato fatturato e a consuntivo risulta eccedente
>     (il lavoro alla fine vale meno), NON è un errore di fatturazione (art. 21 c.7 +
>     26 c.3, termine di un anno) ma una variazione prevista dall'accordo → **art. 26
>     c.2**, con la nota emessa entro la dichiarazione IVA dell'anno in cui si verifica
>     il presupposto (circ. 20/E/2021); il termine di UN ANNO resta invece per l'errore
>     vero (importo digitato sbagliato). ③ La nota riprende l'aliquota della fattura di
>     acconto che rettifica. ⚠️ È una risposta a UN contribuente (grande impresa,
>     contratto quadro con conguaglio annuale), non una circolare: vale come
>     orientamento, la conferma resta a N22.
>   · **fatturato MENO dell'incassato** → nessuna delle due: la parte incassata non
>     fatturata è un'operazione effettuata (art. 6 c.4, pagamento) e richiede **un'altra
>     TD02** per la differenza, entro 12 giorni. È il caso degli acconti multipli (Fase 3).
>   · **lavoro saltato** → TD04 sull'intera TD02 dopo la restituzione (art. 26 c.2).
>   ⇒ La TD04 su una TD02 serve comunque (caso ③ e caso «in eccesso»): oggi il server la
>   ammette solo sulle fatture piene — da aprire alla TD02 (tetto con `baseStornabile`,
>   `DatiFattureCollegate` con numero e data della ACC, controllo 00418). Domanda di
>   conferma al commercialista: **N22** in COSE_DA_FARE_ELI. Nessun codice toccato.

### 3.1 Migration 090
```
documents.doc_type: nessun vincolo a DB (è TEXT) → nessuna migration sul tipo
```
Serve invece per il collegamento fra acconto e preventivo/saldo:
- `documents.origin_document_id` **esiste già** (lo usa la fattura da preventivo e la NC).
  L'acconto lo valorizza col **preventivo** da cui nasce.
- ⚠️ Da verificare in fase di scrittura se serve una colonna per distinguere «acconto
  scomputato» — probabilmente no: si ricava da `doc_type = 'fattura_acconto'` +
  `origin_document_id`.

**Prossima migration libera: 090.** Da validare su PG16 prima della consegna, come sempre.

### 3.2 Numerazione
`allocateAccontoNumber(workspaceId)` → RPC `next_invoice_number` con
`p_doc_type = 'fattura_acconto'`. **Nessuna migration**: la RPC è già chiavata per `doc_type`.
`formatAccontoNumber(seq, year)` → `ACC 001/2026` in `lib/documents/numero.ts`, accanto ai
gemelli NC e ND.

### 3.3 Come nasce
Dal tasto **«Registra acconto»** sul preventivo accettato (`registerDepositReceivedAction`,
`lib/actions/documents.ts:3072`). Oggi scrive solo `payment_status='partial'` + `paid_amount` +
`paid_at`.

**Decisione di Eli:** la fattura nasce **già pronta da trasmettere**, non come bozza.

Quindi: registra l'incasso → crea il TD02 con `doc_date = paid_at` → lo presenta con la card SdI
e l'invito a trasmettere entro i 12 giorni (il countdown esiste già).

⚠️ **Il blocco esistente resta**: un acconto pari o superiore al totale viene rifiutato con
*«L'importo copre l'intero preventivo: converti in fattura e usa "Segna pagata"»*. È la strada
giusta anche fiscalmente — una TD01 piena invece di TD02 + saldo a zero.

### 3.4 Cosa contiene
- **Una riga sola** quando il lavoro ha **un'aliquota sola**:
  *«Acconto su rifacimento bagno — preventivo 012/2026 del 14/09/2026»*.
  La Guida è esplicita sul fatto che *«da evitare descrizioni troppo generiche come "acconto
  lavori" senza ulteriori specifiche»*.
- **Le righe in proporzione** quando le aliquote sono **più d'una** (beni significativi, o voci
  miste 10/22): è l'obbligo della 71/E §5.2, e dopo non si corregge (§1.7).
- **Ritenuta** ereditata (`DatiRitenuta` + `<Ritenuta>SI</Ritenuta>` sulle righe).
- **Reverse charge** ereditato (N6.7, niente IVA).
- **Bollo** calcolato dal motore sull'imponibile del documento.
- **`origin_document_id`** = il preventivo.

### 3.5 XML
`lib/sdi/doc-xml.ts:311` — `tipoDocumento` passa da `TD01 | TD04 | TD05` a includere **TD02**.
Tutto il resto del percorso di trasmissione non cambia.

---

## 4. FASE 3 — Il saldo a conguaglio

### 4.1 «Converti in fattura» diventa il conguaglio
Oggi porta il preventivo intero in fattura (funzione SQL `convert_preventivo_to_fattura`,
migration 062 + 082). Con acconti già fatturati deve produrre il **saldo**:

1. Voci del preventivo a importo pieno (come oggi).
2. **Una riga negativa per ogni acconto**, con l'aliquota della voce originale e la descrizione
   che richiama numero e data della TD02.
3. **`DatiFattureCollegate` ripetuto**, uno per acconto (`IdDocumento` + `Data`).

⚠️ **Progettare per N dall'inizio**: in edilizia *«la fatturazione di S.A.L. costituisce, nella
quasi totalità dei casi, una fatturazione in acconto con l'utilizzo del codice TD02»*. Costruirlo
per un acconto solo significa rifare il motore dello scomputo.

### 4.2 XML
`lib/sdi/xml.ts:277` — `inv.fatturaCollegata` passa da **oggetto singolo a array**. È l'unica
modifica strutturale: il blocco è già scritto (lo usa la nota di credito).

### 4.3 Il tetto
Invariante nuova, gemella di quella delle note di credito: **Σ acconti fatturati ≤ totale del
preventivo**. Si riusa lo schema di `lib/documents/storno.ts` (residuo, `superaIlTetto`,
`scalaPrezzo`).

### 4.4 Invariante sulle date
⚠️ **Controllo SdI 00418**: *«se `TipoDocumento` vale "TD04", `Data` non deve essere antecedente
a quella in 2.1.6.3 `<Data>`»*. Vale **solo per il TD04**, non per il saldo — ma è la nostra
nota di credito, e oggi siamo al sicuro solo *per costruzione* (la `doc_date` nasce alla
conferma). Va scritta come invariante esplicita con un test: un'invariante non scritta è
un'invariante che prima o poi si rompe.

---

## 5. FASE 4 — Il contorno

- **Cronologia**: voci per «Fattura di acconto emessa» e «Acconto scomputato nel saldo».
- **Campanella**: l'acconto fatturato ma non trasmesso entra in `sdi_da_trasmettere`.
- **Home e liste**: `ACC 001/2026` con la sua dicitura, come si è fatto per le note.
  ⚠️ Benchmark di ampiezza: l'introduzione della **nota di debito** ha toccato **42 punti in 25
  file** che elencano i `doc_type`. Preventivare lo stesso ordine di grandezza.
- **Bilancio**: l'acconto è già un incasso nel mese in cui è stato preso (`incassiFromDoc`) —
  ⚠️ **attenzione al doppio conteggio** quando l'incasso diventa anche una fattura.
- **Ricerca**: `ACC`, «acconto», «anticipo», «td02» (schema di `isNotaCreditoQuery`).
- **FAQ**: ① «Ho incassato un acconto: cosa devo fare?» ② il **bollo doppio** (estendere la FAQ
  «Perché la fattura ha 2 € in più del preventivo?») ③ «Perché in fattura compare il valore
  della caldaia?» — la spiegazione dell'obbligo di §1.8 ④ aggiornare «Posso far comparire
  l'acconto già impostato su ogni preventivo?», che oggi ha **«caparra» fra le parole chiave**
  ed è fiscalmente impreciso (§7).
- **/novita** e **collaudi sandbox** (T22 e seguenti in `TEST_DA_FARE_ELI.md`).

---

## 6. Casi limite — decisi

| Caso | Decisione | Fonte |
|---|---|---|
| Acconto = 100% del totale | Nessun TD02: si converte in fattura piena e si segna pagata (**comportamento già attivo**) | prassi; SdI accetta comunque il totale zero |
| Più acconti / SAL | N TD02, tutti scomputati nel saldo | 71/E §5.2 · tabellare 2.1.6 `<0.N>` |
| Lavoro che salta dopo l'acconto | Nota di credito TD04 **dopo aver restituito i soldi**, non prima | art. 26 c. 2 |
| Aliquote diverse fra acconto e saldo | Nota di variazione entro **un anno**, e solo se c'è un errore vero | risposta 216/2020 · art. 26 c. 3 |
| Forfettario, soglia 85.000 | L'acconto pesa nell'anno di **incasso** — il Bilancio lo fa già giusto | principio di cassa |
| Caparra confirmatoria | **Non si implementa** (§7) | ris. 197/E/2007 |

---

## 7. Deciso di NON fare: la caparra confirmatoria

**Perché.** La caparra confirmatoria (art. 1385 c.c.) è **fuori campo IVA per mancanza del
presupposto oggettivo** — artt. 2 e 3 DPR 633/72, **non** l'art. 15 come spesso si legge — e
**non obbliga a emettere fattura**. Diventa rilevante solo se le parti le attribuiscono
espressamente anche la funzione di anticipo del corrispettivo (**risoluzione 197/E/2007**).

**Il rischio è asimmetrico.** Un tasto «caparra» che non emette fattura sarebbe uno strumento per
**non fatturare un incasso**, appoggiato a una qualificazione giuridica che l'app non può
verificare. Se quella somma era in realtà un acconto — il caso normale del nostro target —
diventa omessa fatturazione. Non farla non costa nulla: la strada dell'acconto c'è ed è quella
giusta quasi sempre. È la regola B.0 e il principio del 9 agosto: *se crea rischio non lo
facciamo, e spieghiamo bene l'alternativa*.

**Cosa facciamo invece, a costo quasi zero:** togliere «caparra» dalle parole chiave della FAQ
dell'acconto (`app/(app)/aiuto/page.tsx:246`), dove oggi è trattata come sinonimo, e aggiungere
una riga che spiega la differenza.

**Nessun concorrente ha un documento «caparra»**, e nel tracciato non esiste un TipoDocumento per
essa. Se un giorno servisse: TD01 con natura **N2.2** e dicitura «operazione fuori campo IVA
art. 2 DPR 633/72» — e il bollo lo farebbe già il nostro motore, perché è legato all'assenza di
IVA.

---

## 8. Le fonti, lette per intero

| Documento | Cosa ci dà |
|---|---|
| **Circolare 71/E** del 7 aprile 2000 | §5.2 gli acconti coi beni significativi · §5.1 cosa scrivere in fattura · ⚠️ §4.1 e §4.2 **superate** dal 2018 |
| **Circolare 98/E** del 17 maggio 2000 | §4.1.4 la formula `P = C − B` e l'intervento unitario · §4.1.2 il valore (posizione 2000) |
| **Circolare 15/E** del 12 luglio 2018 | Valore = **costo**, mark-up escluso · esempio 1.800 · parti staccate e autonomia funzionale · obbligo di indicazione anche senza eccedenza |
| **Risposta 216/2020** del 14 luglio 2020 | L'acconto generico resta ad aliquota ordinaria · errori correggibili entro **un anno** (art. 26 c. 3 citato per esteso) |
| **Risoluzione 1/E** del 10 gennaio 2013 | Numerazione: qualsiasi progressione che garantisca l'univocità |
| **Guida AdE alla compilazione**, v1.10 aprile 2025 | TD02 trattato come TD01 · 12 giorni · `DatiFattureCollegate` imposto solo per TD04/TD05 · registri precompilati |
| **DPR 633/1972 e Testo unico IVA** (D.Lgs. 10/2026), da Normattiva, letti il 26 set 2026 | art. 26 c.3: il limite di **un anno** vale per l'errore di fatturazione **e** per il «sopravvenuto accordo fra le parti»; la riduzione già prevista dal contratto sta nel c.2 · art. 6 c.4: operazione effettuata «limitatamente all'importo fatturato o pagato» · ⚠️ dal **1° gennaio 2027** vale la nuova numerazione: 6→24, 21→72, 26→92, 17 c.6 a-ter→64 c.6 lett. c) (domanda N23) |
| **Risposte 663/2021 e 762/2021** (lette il 26 set 2026) | Citano l'art. 26 c.3 per intero: la nota è lo strumento **generale** per correggere gli errori; oltre l'anno la nota non si fa più, e **non** si recupera l'IVA con la dichiarazione integrativa (663); resta solo il rimborso art. 30-ter, residuale, «entro due anni dal versamento» e se la fattura non è mai stata usata dal cliente (762) |
| **Circolare 20/E** del 29 dicembre 2021 (letta il 26 set 2026) | §3: la nota va **emessa entro la dichiarazione IVA dell'anno in cui si verifica il presupposto** (es. presupposto 2021 → entro il 30 aprile 2022); il resto riguarda le procedure concorsuali |
| **Circolare 14/E** del 17 giugno 2019 (letta il 26 set 2026) | §3.1: il campo **Data** della fattura elettronica è **sempre la data di effettuazione** dell'operazione; i giorni successivi servono solo a trasmetterla → la conferma dell'app ora data la fattura al giorno dell'incasso se viene prima |
| **Risposte 832/2021, 386/2022, 268/2023, 359/2023, 403/2022** (lette il 26 set 2026) | 832: il limite di un anno per errori e accordi si conta dall'**effettuazione** (pagamento o fattura, se viene prima) · 386: risoluzione per **inadempimento** (diffida o clausola risolutiva) = c.2 senza limite di un anno; risoluzione **concordata** = c.3 entro un anno; nota pari alla somma rinunciata, divisa fra imponibile e IVA · 268: corrispettivo incassato e **non restituito** → nessuna nota · 359: mancato pagamento solo con procedure (c.3-bis), nota di debito se poi il cliente paga · 403: registro, fuori tema IVA. Interpelli: orientano, non vincolano (N22 ③ e ⑥) |
| **Specifiche tecniche FatturaPA** v1.4, 31 gennaio 2025 + **Rappresentazione tabellare** | `Numero` alfanumerico max 20 · 2.1.6 `<0.N>` e il suo caso d'uso dichiarato · 2.2.1.4 la **riga negativa** · controlli 00418, 00423, 00425 · `DatiRitenuta` molteplicità N |

---

## 9. Ordine di lavoro

1. **Fase 1** — valore del bene = costo *(difetto in produzione, prerequisito di tutto)*
2. **Fase 2** — TD02, sezionale `ACC`, da «Registra acconto»
3. **Fase 3** — saldo a conguaglio con N righe negative e N collegamenti
4. **Fase 4** — cronologia, campanella, liste, Bilancio, ricerca, FAQ, /novita, collaudi

Ogni fase si chiude con: `npx tsc --noEmit` · `npm run build` · `npm test` · rilettura delle
FAQ (§B.2) · verifica in Chromium dove c'è geometria · migration validata su PG16.
