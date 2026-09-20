# PROGETTO — Copia di cortesia: prima la trasmissione, poi la copia

> Nato il 20 settembre 2026 dalla prescrizione del commercialista (incontro 18 set) e
> dalla conferma di Eli: «appena una fattura viene creata, significa che viene anche
> trasmessa, e solo in seguito si può mandare la copia di cortesia al cliente — un po'
> come fanno i nostri concorrenti». Ricerca web fatta il 20 set (fonti in §2-§3).
>
> ⚠️ Riguarda SOLO le FATTURE (e le note di credito). I PREVENTIVI restano client-first:
> il loro senso è proprio arrivare al cliente prima di ogni atto fiscale.
>
> 🎯 **REGOLA DI PROGETTO (Eli, 20 set)**: «ogni scelta deve essere fatta come fanno i
> competitors». Sul flusso fiscale il riferimento è FiC/Aruba, verificato con ricerca.
> Registrata anche in `DECISIONI_E_FEEDBACK.md §A`.

---

## 1. La prescrizione

Dal riassunto vocale di Eli (18 set): **la copia di cortesia presuppone una fattura GIÀ
trasmessa allo SdI**. Se non è ancora trasmessa, ciò che il cliente vede deve essere
dichiaratamente una **bozza, con un avviso «molto chiaro»**.

Conferma di Eli (20 set): il flusso va invertito come fanno i concorrenti —
creazione → trasmissione → poi la copia di cortesia.

## 2. Cosa dicono norma e prassi (ricerca 20 set)

- **La fattura elettronica esiste solo se trasmessa allo SdI** (art. 1 D.Lgs 127/2015;
  art. 21 DPR 633/1972). Tutto ciò che il cliente riceve fuori dallo SdI è una **copia
  priva di valenza fiscale**.
- **Verso i CONSUMATORI FINALI (B2C) consegnare la copia è un OBBLIGO**, non una
  cortesia facoltativa (art. 1 c.3 D.Lgs 127/2015): copia analogica o PDF, salvo
  **rinuncia espressa** del cliente. → Per il nostro target (clienti privati) la copia
  va mandata comunque — il punto è QUANDO, non SE.
- **Dicitura di prassi sulla copia**: «copia priva di valenza fiscale» (o equivalente)
  + l'informazione che l'originale è disponibile nel **cassetto fiscale** del cliente
  (area riservata AdE).
- **Fattura SCARTATA = mai emessa**: si corregge e si ritrasmette entro 5 giorni con
  stesso numero e stessa data. Se la copia fosse già in mano al cliente, avrebbe un
  documento che fiscalmente non esiste → è il motivo per cui la copia parte DOPO
  l'esito, non solo dopo l'invio.

## 3. Come fanno i concorrenti (ricerca 20 set)

**Fatture in Cloud** e **Aruba** sono invoice-first, con lo stesso schema:

1. Si crea la fattura → **controlli pre-invio** (anomalie che causerebbero uno scarto).
2. Si trasmette allo SdI (per FiC in automatico alla creazione).
3. La **copia di cortesia parte DOPO**: in automatico se il cliente ha il flag
   «invia sempre la copia di cortesia» in anagrafica (email con modello predefinito),
   oppure a mano in un secondo momento dalla lista delle fatture inviate.
4. Best practice dichiarata (WindDoc e altri): la copia automatica parte **solo dopo
   che lo SdI ha accettato la fattura**, «così da essere certi che al cliente arrivi
   la fattura approvata».

Nessuno dei due permette di mandare la copia di una fattura non ancora trasmessa come
se fosse la fattura: prima dell'invio esiste solo la **bozza**, chiaramente marcata.

**Il MOMENTO della trasmissione (ricerca 20 set, sulla domanda di Eli «ha senso tenere
le 24h?»): NESSUN concorrente ha una finestra di ripensamento automatica.**
- **Aruba**: due tasti — «**Salva in bozze**» (si modifica quando si vuole, niente di
  fiscale è successo) e «**Invia allo SdI**» (parte SUBITO: XML, firma, trasmissione).
- **Fatture in Cloud**: la fattura si crea e si invia con un gesto esplicito («Invia
  ora»); si può anche salvare senza inviare e trasmettere più avanti, dentro i 12
  giorni di legge — ma la scelta è sempre dell'utente, mai un timer.
- In entrambi il «ripensamento» è la **BOZZA**: finché non premi il tasto non è
  successo niente. Dopo il tasto, gli errori si gestiscono con gli strumenti fiscali
  (scarto → correggi e ritrasmetti · nota di credito) — che abbiamo già.
- I **controlli pre-invio** (FiC li dichiara esplicitamente) sostituiscono la rete del
  tempo: si blocca PRIMA ciò che causerebbe uno scarto. Anche questi li abbiamo già
  (guardie art. 21, coerenza 00421, dati cliente).

## 4. Il nostro flusso oggi, e dove diverge

Oggi (client-first, costruito quando lo SdI era lontano):

```
bozza → «Invia al cliente» (email/WhatsApp/link)  ← il cliente VEDE la fattura qui
      → conferma fiscale (nasce doc_date)
      → pilota +24h → trasmissione SdI → esito
```

Divergenze dalla prescrizione:
- Il cliente riceve la "fattura" PRIMA che esista fiscalmente. Con lo SdI **spento in
  produzione** (stato attuale), OGNI copia in circolazione precede la trasmissione.
- La pagina `/p/[token]` e il PDF non dicono in nessun modo se la fattura è stata
  trasmessa o no: una bozza e una fattura emessa si presentano identiche.
- Punti del codice coinvolti: `registraConfermaFiscale` (lib/documents/conferma-fiscale.ts)
  — la conferma scatta all'invio al cliente; `ShareButton`/`SendEmailDialog` (i canali);
  pilota `sdi_auto_at` + cron `sdi-auto`; `SdiCard`; PDF `lib/pdf/template.ts`;
  pagina cliente `/p/[token]` + `MobilePublicCard`.

## 5. ROADMAP in tre fasi

### Fase 0 — Onestà della copia (fattibile SUBITO, anche con SdI spento) — ✅ diciture chiuse «come i competitors» (Eli, 20 set)
La regola del commercialista applicata a ciò che circola oggi. Tre stati, tre verità
(le parole sono gli STANDARD dei concorrenti, non inventate — vedi §6 D2):
- **Fattura NON ancora trasmessa** (sdi_status assente, o scartata = mai emessa) →
  su PDF e pagina `/p/[token]` la dicitura della famiglia proforma (lo standard con
  cui i concorrenti marcano ogni documento-fattura non fiscale): «**Il presente
  documento non costituisce fattura valida ai fini del DPR 633/1972 e successive
  modifiche.** La fattura definitiva viene emessa con la trasmissione al Sistema di
  Interscambio.» È l'«avviso molto chiaro» chiesto dal commercialista.
- **Fattura trasmessa, in attesa di esito** (sdi_status inviata) → «Fattura trasmessa
  al Sistema di Interscambio, in attesa di esito. Copia priva di valenza fiscale.»
- **Fattura trasmessa con esito positivo** (sdi_status consegnata/mancata_consegna) →
  lo standard Fatture in Cloud, quasi verbatim: «**Copia di cortesia non valida ai
  fini fiscali.** L'originale della fattura è stato inviato al Sistema di
  Interscambio ed è consultabile nell'area riservata del sito dell'Agenzia delle
  Entrate.»
- Nessun cambio di flusso: cambia solo la VERITÀ scritta sulla copia. Zero migration
  (si legge `sdi_status`, già presente; sulla pagina cliente con query a sé
  tollerante — la select principale è esplicita e tipizzata).
- Nota storica: il banner «non sostituisce la fattura elettronica» era stato tolto il
  26 ago perché ridondante NELLA CARD; qui la dicitura va SUL DOCUMENTO che il cliente
  vede, che è un'altra cosa.

### Fase 1 — Inversione del flusso fatture (il cuore del progetto) — modello Aruba
Su una fattura, il primo passo dopo la compilazione diventa la **trasmissione**, non
l'invio al cliente. Come i concorrenti (decisione Eli, 20 set):
- **Due gesti, come Aruba**: «**Salva in bozze**» (nessun effetto fiscale, si modifica
  liberamente) e «**Invia allo SdI**» (gesto ESPLICITO: nasce doc_date e la
  trasmissione parte SUBITO, dopo i controlli pre-invio e un dialog di conferma che
  dice cosa sta per succedere). **Niente più pilota +24h**: nessun concorrente ha un
  timer di ripensamento — il ripensamento è la bozza, prima del tasto. Il pilota
  attuale (`sdi_auto_at` + cron `sdi-auto`) nasceva per il flusso client-first (la
  trasmissione era un EFFETTO dell'invio al cliente, senza gesto esplicito: le 24h
  erano la rete); col gesto esplicito la rete non serve e va **ritirato** — cron
  spento, colonna dormiente, interruttore «trasmissione automatica» delle Impostazioni
  rimosso o riconvertito.
- La **copia di cortesia si sblocca all'esito positivo**: quando lo SdI risponde
  consegnata/emessa, la copia parte in automatico (se il cliente ha l'email in
  rubrica, standard FiC/Aruba) o compare l'invito «Manda la copia di cortesia al
  cliente» (WhatsApp/link).
- **Prima dell'esito, l'invio al cliente di una fattura è BLOCCATO** (come i
  concorrenti: la bozza vive solo nell'app; per «far vedere la cifra prima» c'è il
  PREVENTIVO). Restano l'anteprima interna e la Fase 0 come rete per i casi legacy.
- Coerenza con **N11**: «Segna pagata» / incasso di un acconto = fatto fiscale che
  chiede la fattura → nel flusso nuovo l'incasso spinge verso la trasmissione, non
  verso l'invio della copia.
- ⚠️ Con lo SdI SPENTO la Fase 1 non è attivabile per intero (non c'è nulla da
  trasmettere): si progetta e si costruisce dietro il flag `NEXT_PUBLIC_SDI_ENABLED`,
  e diventa il comportamento di serie al passaggio live. Nel frattempo vale la Fase 0.

### Fase 2 — Parità coi concorrenti e rifiniture
- Flag in rubrica cliente: «**Invia sempre la copia di cortesia** a questo cliente»
  (con la rinuncia espressa del B2C coperta: flag spento = niente copia automatica).
- Riga sul PDF di cortesia B2C: l'originale è nel cassetto fiscale (obbligo informativo
  di prassi).
- **Gestione scarto post-copia** (caso residuo): se una fattura viene scartata dopo che
  una copia è circolata, avviso all'artigiano di rimandare la copia corretta.
- Registrare la copia inviata in cronologia («Copia di cortesia inviata il …»).
- FAQ + /novita + collaudo sandbox (T-nuovi in TEST_DA_FARE_ELI.md).

## 6. Decisioni — ✅ TUTTE CHIUSE dalla regola «come i competitors» (Eli, 20 set: «Facciamo uguale»)
- **D3 — Invio al cliente prima dell'esito SdI: BLOCCATO.** I concorrenti non lo
  offrono proprio (la bozza vive nell'app); il caso «far vedere la cifra prima» è il
  PREVENTIVO. Coerente con «se non si dovrebbe fare, non lo permettiamo» (5 set).
- **D4 — Copia di cortesia AUTOMATICA all'esito positivo** (email in rubrica), con
  flag per cliente in Fase 2; manuale come ripiego. È lo standard FiC/Aruba.
- **D5 — Il pilota +24h NON resta.** Nessun concorrente ha un timer di ripensamento:
  gesto esplicito «Invia allo SdI» + bozza come spazio del ripensamento + controlli
  pre-invio. Il pilota (cron `sdi-auto`, `sdi_auto_at`, interruttore in Impostazioni)
  si ritira con la Fase 1.

- **D1 — Fase 0: SUBITO** («Facciamo uguale», Eli 20 set). I concorrenti non fanno
  MAI circolare una fattura non trasmessa presentata come fattura: prima dell'invio
  esiste solo la bozza, e il loro documento non-fiscale che circola (la **proforma**)
  porta SEMPRE la dicitura che dice cosa non è. Finché il nostro flusso resta
  client-first (e con lo SdI spento lo è per costruzione), la marcatura onesta è il
  minimo per essere «uguali».
- **D2 — Le parole: gli STANDARD dei concorrenti, non inventate** («Facciamo uguale»).
  · Copia dopo l'esito positivo = la dicitura di **Fatture in Cloud** (la più diffusa,
  ricalcata quasi verbatim): «Copia di cortesia non valida ai fini fiscali.
  L'originale della fattura è stato inviato al Sistema di Interscambio ed è
  consultabile nell'area riservata del sito dell'Agenzia delle Entrate.»
  · Fattura non ancora trasmessa = la famiglia della dicitura **proforma** (Danea,
  FiC, prassi comune): «Il presente documento non costituisce fattura valida ai fini
  del DPR 633/1972 e successive modifiche», con la coda adattata al nostro caso («la
  fattura definitiva viene emessa con la trasmissione al Sistema di Interscambio» —
  l'originale dice «all'atto del pagamento», che è il caso proforma, non il nostro).
  · **Forma**: come i concorrenti la dicitura è una RIGA IN EVIDENZA sul documento
  (riquadro sotto i totali), NON una filigrana diagonale — la filigrana resta quella
  già esistente delle bozze/annullate, che è un'altra cosa (stato del documento).
  ⚠️ Nota di trasparenza (dalla ricerca): la copia B2C ha valore per il consumatore
  ai fini di garanzia/detrazioni, e in caso di discrepanza PREVALE l'elettronica —
  la dicitura «non valida ai fini fiscali» è comunque lo standard di mercato e la
  forma più prudente (B.0).

## 7. Cosa NON cambia

- **Preventivi**: client-first intatto (link, accettazione, firma).
- **Motore fiscale** (`lib/fiscal/calcoli.ts`) e **XML** (`lib/sdi/xml.ts`): intoccati.
- Le tre prescrizioni del 18 set già implementate (RF19, bollo virtuale, riga Bollo).
- La conferma fiscale via «Segna pagata» (incasso di persona) resta un percorso valido:
  nel flusso nuovo porta alla trasmissione come gli altri.

---

*Fonti della ricerca (20 set 2026): FAQ AdE «Fatture elettroniche verso i consumatori
finali»; art. 1 c.3 D.Lgs 127/2015 (obbligo copia B2C salvo rinuncia); glossario e
guida «Fattura di cortesia» di Fatture in Cloud; FiC «Invio e termini di emissione
fattura elettronica»; guide Aruba «Invio fatture elettroniche a SdI e invio copia
.pdf al cliente», «Invio copia cortesia» e «Creazione fattura guidata: invio a SdI o
salvataggio in Bozze» (i due tasti, trasmissione immediata); WindDoc
(copia automatica solo dopo l'accettazione SdI); FiscoeTasse (scartata = correggere e
ritrasmettere con stesso numero e data). Sulle DICITURE (terza ricerca, 20 set):
glossario «Fattura di cortesia» di Fatture in Cloud + Danea, StartyERP, Studio
Capriotti, Alias Digital (la dicitura FiC «Copia di cortesia non valida ai fini
fiscali…» è lo standard citato da tutti); Danea «Fattura proforma» + Fiscomania,
SumUp, Fattura24, TeamSystem (dicitura proforma «Il presente documento non
costituisce fattura valida ai fini del DPR 633/1972…»); iContenzioso (in caso di
discrepanza prevale l'elettronica).*
