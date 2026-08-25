import { Sparkles } from 'lucide-react'
import { BackButton } from '@/components/shared/BackButton'

export const metadata = { title: 'Novità' }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

const AI_ATTIVA = process.env.NEXT_PUBLIC_AI_IMPORT_ENABLED === 'true'

// Changelog utente: voci in ordine cronologico inverso, linguaggio semplice.
// Aggiungere una voce qui a ogni rilascio rilevante per l'utente.
const NOVITA: Array<{ data: string; titolo: string; punti: string[] }> = [
  {
    data: 'Fine agosto 2026',
    titolo: 'Preventivi e fatture più belli: i template rinnovati',
    punti: [
      'Il template «Classico» (il predefinito) ha una veste nuova, più moderna e ordinata: una fascia con data, scadenza e totale sotto la testata, il cliente in un riquadro dedicato e il Totale in un blocco pieno nel tuo colore. Resta pulito, ma con più carattere.',
      'Il template «Elegante» diventa più sartoriale: un carattere serif raffinato per il nome, il numero e il totale, filetti sottili e molta più aria. Adatto a chi vuole un documento con un tocco di classe.',
      'In entrambi il tuo colore e il tuo logo restano quelli che scegli tu dalle Impostazioni: cambia solo il disegno di base. I documenti già inviati non cambiano — mantengono l’aspetto che avevano quando li hai mandati.',
    ],
  },
  {
    data: 'Fine agosto 2026',
    titolo: 'Notifiche a portata di tocco, sopralluoghi più chiari, voci più comode',
    punti: [
      'La campanella in Home ora apre le notifiche in una tendina, senza cambiare pagina: le leggi, tocchi quella che ti interessa e la Home resta lì sotto. In fondo alla tendina, «Vedi tutte le notifiche» apre la pagina completa.',
      'Nella lista dei sopralluoghi il titolo ha tutta la riga per sé e i dettagli (appuntamento, indirizzo, foto) vanno a capo invece di sparire nei puntini: si legge tutto anche sui titoli lunghi.',
      'Il sopralluogo nuovo si chiama da solo «Lavoro 20.08 Giorgio G.» — data e cliente — così poi lo riconosci al volo fra preventivi e fatture. Se scrivi un titolo tuo, vale il tuo. E per salvarlo serve almeno il cliente o l’indirizzo del cantiere: un sopralluogo senza nulla poi non si ritrova.',
      'Nella voce del preventivo (e della fattura) tocchi la testata — «VOCE 1» o il totale — e la voce si chiude; il cestino sta nella casella accanto all’IVA, con l’«Annulla» se elimini per sbaglio.',
      'Quando apri la modifica di un preventivo o di una fattura, in alto compare la pillola «In modifica»: capisci al volo se stai guardando il riepilogo o stai cambiando il documento. La ✕ riporta al riepilogo.',
    ],
  },
  {
    data: 'Metà agosto 2026',
    titolo: 'Menu più semplice, creazione più veloce, cestino a portata di mano',
    punti: [
      'Il tasto «+» in basso ora chiede cosa vuoi creare: Nuovo preventivo o Nuovo sopralluogo. I due gesti più frequenti in un tocco, senza passare dai menu.',
      '«Altro» riorganizzato: meno voci a vista, raggruppate per quello che servono — «Clienti e appuntamenti», «Catalogo e strumenti», «Abbonamento e inviti», «Aiuto e novità» — con sotto ognuna una riga che dice cosa ci trovi. Tocchi il gruppo e scegli dentro.',
      'Il Cestino è entrato nelle liste: dentro Preventivi e Fatture trovi il tasto «Cestino» accanto all’«Archivio». Ognuno mostra i documenti eliminati del suo tipo, che recuperi con un tocco entro 15 giorni.',
      '«Fatti trovare dai clienti» ora si chiama «Vetrina»: lo stesso posto dove pubblichi il tuo profilo e raccogli richieste e recensioni, con un nome più chiaro.',
      'Le voci nuove si salvano da sole nel Catalogo: quando scrivi in un preventivo una voce che non c’era, l’app la aggiunge al tuo catalogo (senza doppioni). La volta dopo la ritrovi fra i suggerimenti.',
      'La card della voce è più semplice: il campo «Costo» non sta più in mezzo a Prezzo e Sconto. Il costo arriva da solo dal catalogo e dai listini, e lo vedi e lo correggi aprendo il riquadro «Margine · solo tu lo vedi» — una riga per voce, sempre invisibile al cliente.',
      'Gli sconti si leggono in chiaro nel Riepilogo: accanto a ogni voce scontata compare la sua percentuale, e sopra il Subtotale trovi «Totale senza sconti» e «Sconti sulle voci». Lo sconto sul documento si chiama «Sconto sul totale», e quando ci sono entrambi una riga dice lo sconto complessivo, in euro e in percentuale.',
    ],
  },
  {
    data: 'Metà agosto 2026',
    titolo: 'Note di credito, proposte più chiare e conferme di accettazione',
    punti: [
      'IVA al 10% e beni significativi: quando installi una caldaia, degli infissi o dei sanitari, il 10% vale solo fino al valore del lavoro — quello che avanza va al 22%. Spunti «È un bene significativo» sulla voce e l’app fa i conti, divide la riga in due e scrive in fattura il valore del bene, come chiede la legge. Compare solo fuori dal forfettario, sulle voci al 10%.',
      'Fatture al condominio: spunti «Il cliente è un condominio» e la fattura mostra la ritenuta del 4% che l’amministratore trattiene e versa lui, con il totale davvero da bonificare. Se sei in forfettario non ti riguarda: non ti trattengono nulla e la tua fattura lo dice già.',
      'Lavori edili per altre imprese: c’è la spunta per l’inversione contabile (reverse charge) — fattura senza IVA con la dicitura di legge, per pulizia, demolizioni, impianti e completamento su edifici quando il cliente ha la partita IVA. Serve la sua P.IVA in rubrica; con un privato l’IVA si addebita normalmente.',
      'Note di credito: una fattura trasmessa allo SdI non si annulla — si storna. Sulla fattura trovi «Crea nota di credito»: nasce già compilata (cliente, voci, riferimento alla fattura), tu scegli solo il motivo. Attento ai tempi: per un errore o un accordo col cliente va fatta entro un anno. Ha una numerazione tutta sua (NC 001/2026) e la trovi nella lista Fatture, con scritto quale fattura storna. Puoi farne anche più d’una sulla stessa fattura (storni parziali): l’app ti mostra il residuo stornabile e non lascia stornare più del totale.',
      'Le due proposte, più chiare per il cliente: sulla sua pagina quello che è uguale fra Base e Premium è in grigio, quello che cambia resta in evidenza — e sulla più cara c’è scritto quanto costa in più. Così sceglie sapendo cosa sta pagando, non solo quanto.',
      'La proposta scelta si vede (e si può cambiare idea): dopo l’accettazione leggi ovunque quale proposta vale — riga di stato, banner, riepilogo, cronologia. Se serve, «Riporta in bozza» fa tornare disponibili tutte le proposte.',
      'Conferma di accettazione: quando il cliente accetta, vede subito il riepilogo (numero, proposta, totale, data e ora, firma) e gli arriva un’email-ricevuta con le stesse informazioni; se risponde, la risposta arriva a te. Tu trovi le aperture e ogni passaggio nella cronologia del documento.',
      'Acconto preimpostato: in Impostazioni › Generale scegli percentuale o cifra fissa, e ogni preventivo nuovo nasce con l’acconto già scritto (sul singolo documento lo cambi o lo togli).',
      '«Ordina: Scadenza vicina» ora è un ordine di urgenza: prima le scadute, poi quelle in attesa per scadenza, poi bozze, chiuse e annullate — in cima c’è quello di cui occuparti adesso.',
      'Ricerca più furba: nelle liste funzionano anche «nota di credito» (o solo «nc»), «modificati», e nei Preventivi la parola «fattura» trova i preventivi con la fattura collegata («bozza fattura», «fatture pagate»).',
      'Suggerimenti mentre scrivi le voci: se quello che stai scrivendo somiglia a una voce del tuo Catalogo o dei listini fornitori, compare sotto il campo — fino a 10, sempre più mirati a ogni lettera. Un tocco riempie descrizione, prezzo, unità e IVA; se non ti serve, continui a scrivere e non succede niente.',
      'Pagine più ordinate: le spiegazioni sotto campi e funzioni sono entrate nel tondino ⓘ — lo tocchi e leggi cosa fa la funzione accanto, lo ritocchi e si chiude. Restano sempre scritti per esteso solo gli avvisi importanti, quelli fiscali o che evitano un errore.',
      'Marca da bollo al posto giusto: sparisce dai preventivi (non sono documenti fiscali, non era dovuta) e arriva da sola quando il preventivo diventa fattura. E si aggiunge da sola anche sulle note di credito sopra 77,47 € — come chiede l’Agenzia.',
      'Il conto alla rovescia dei 12 giorni: una fattura è «emessa» solo quando viene trasmessa allo SdI, e la legge dà 12 giorni dalla data del documento. La card della fattura elettronica ora mostra quanto tempo resta, la campanella ti avvisa negli ultimi 3 giorni, e il tondino ⓘ spiega tutto in parole semplici.',
      'La fattura parte da sola: quando la confermi, la trasmissione allo SdI viene programmata dopo 24 ore — un avviso te lo dice subito, e sulla fattura vedi quando partirà, col tasto Annulla per fermarla. È accesa di partenza; si spegne in Impostazioni › Fiscale. La data della fattura nasce alla conferma: finché è bozza, nessun conteggio parte.',
      'La fattura elettronica in Home: due riquadri affiancati — «Da trasmettere», con i giorni che restano, e «Scartate», con quelle da correggere. A colpo d’occhio sai se c’è qualcosa da fare, e toccando il titolo si apre l’elenco completo, in ordine di urgenza.',
      'Nota di debito: la gemella della nota di credito, per quando hai fatturato MENO del dovuto (un lavoro in più, un prezzo troppo basso). La trovi sulla fattura trasmessa, nasce vuota col riferimento alla fattura e ci metti solo quello che manca; ha la sua numerazione (ND 001/2026) e si trasmette allo SdI come una fattura. Quando l’importo aumenta questa non è una scelta: la legge la richiede.',
      'Gli scarti spiegati in parole semplici: se lo SdI rifiuta una fattura, sotto l’errore trovi cos’è successo e cosa fare — l’app riconosce i dieci errori più comuni (codice destinatario, P.IVA del cliente, duplicati, conti che non tornano…).',
    ],
  },
  {
    data: '8 agosto 2026',
    titolo: 'Rimanda il sollecito, spegnilo, o metti via il documento',
    punti: [
      'Posticipa il sollecito: nelle pagine «in scadenza», l’orologio sotto ogni documento lo toglie dalla Home per 3 giorni, 1 settimana o 2 settimane. Poi torna da solo. La scadenza vera del documento non cambia.',
      'Non ricordarmelo più: se un preventivo non lo vuoi più sollecitare, lo dici una volta. Resta in tutte le liste, ma smette di comparire fra i promemoria — e puoi riattivarlo quando vuoi.',
      'Archivia: metti via un preventivo o una fattura ed esce dalle liste attive. Lo ritrovi col tasto «Archivio», a sinistra della riga «Ordina» dentro Preventivi e Fatture. Non è una cancellazione: il documento resta intero e continua a contare nel Bilancio e negli export.',
      'Il cerca trova anche gli archiviati: archiviare toglie dalla lista che sfogli, non dalla ricerca. Cerchi il nome del cliente e il documento compare, con l’etichetta «Archiviato».',
    ],
  },
  {
    data: 'Inizio agosto 2026',
    titolo: 'Costi, margine e listini dei fornitori',
    punti: [
      'Costo per voce e margine privato: su ogni voce del preventivo (e nel catalogo) puoi segnare quanto la paghi — l’app ti mostra ricarico e margine, che vedi SOLO tu, mai il cliente.',
      'Listini fornitori (Pro): in «Catalogo e listini» importi il listino del fornitore anche con una foto. In preventivo scegli la voce e l’app propone il prezzo col tuo ricarico.',
      'Scadenza agganciata: se il listino del fornitore scade prima del preventivo, l’app ti avvisa e con un tocco allinei la validità.',
      'Rinnovo listino: reimporti il listino nuovo e l’app abbina le voci, aggiorna i costi e ti dice cosa è rincarato.',
      'Rapportino scaricabile: il rapportino di fine lavoro ora si scarica come documento, sia tu che il cliente.',
      'Preventivo fermo? Te lo ricordiamo noi: se un preventivo inviato resta 7 giorni senza risposta, arriva un promemoria in campanella con l’invito a sollecitare. Si spegne da Impostazioni › Notifiche.',
      'Manutenzione che torna, preventivo pronto: quando scatta un richiamo sul Lavoro (es. caldaia annuale), sulla scheda trovi «Prepara il preventivo per la manutenzione» — nasce già col cliente e le voci dell’anno scorso, tu rivedi prezzi e date e lo invii.',
      'Prenotazione dalla vetrina: chi ti scrive dal tuo profilo pubblico può indicare quando preferirebbe (mattina, pomeriggio, sera o un giorno) — lo vedi nella richiesta, così organizzi il sopralluogo più in fretta.',
      'Messaggi col cliente, botta e risposta: sulla pagina del preventivo o della fattura il cliente trova «Scrivi un messaggio»; tu rispondi dalla card Messaggi del documento e la conversazione compare a lui sullo stesso link (e per email, se ce l’ha in rubrica). Tutto resta attaccato al documento, senza passare dalla posta.',
      'Cerca una funzione: in cima ad «Altro» c’è un campo di ricerca. Scrivi la parola che ti viene in mente — «iban», «cestino», «impronta», «piastrelle» — e l’app ti porta dritto dove serve, senza cercare nei menu. Si cercano le funzioni dell’app; per un cliente o un documento resta la ricerca dentro Preventivi, Fatture e Clienti.',
      'Impostazioni più ordinate: le sezioni (Generale, Fiscale, Pagamenti, Notifiche) ora sono pillole come i filtri dei preventivi. Il blocco dell’app con l’impronta si è spostato in Altro › Account e sicurezza, dove trovi anche «Esci da tutti i dispositivi». La voce «Piano» è sparita dalle impostazioni: c’era già Abbonamento in Altro.',
      'Quanto preavviso vuoi sulle scadenze: in Impostazioni › Generale decidi quanti giorni prima un documento deve comparire nella sezione «In scadenza» della Home. Di serie sono 10 giorni: prima ci finiva anche un preventivo che scadeva fra un mese.',
      'Guide delle sezioni: la prima volta che entri in «Altro» o nel «Bilancio» si apre un breve giro guidato che ti spiega cosa c’è. Dura pochi secondi, si chiude quando vuoi e non ricompare più. Le rivedi tutte da Altro › Aiuto, scheda «Tutorial», insieme al tutorial di primo accesso.',
      'Chiedi una recensione: sulla fattura saldata trovi il bottone «Chiedi una recensione» — il messaggio è già scritto col link dentro, tu scegli se mandarlo su WhatsApp o per email. Prima il riquadro per recensire compariva sul link del cliente solo dopo il saldo, quando lui quel link l’aveva già chiuso: nessuno glielo diceva. Compare se hai pubblicato il tuo profilo nella vetrina.',
      'Foto ingrandibili ovunque: tocca una foto e si apre a schermo pieno, ritoccala e si chiude. Vale dappertutto — foto del lavoro sul preventivo, sulla fattura e sulla scheda del lavoro, foto del sopralluogo, foto che alleghi mentre scrivi il preventivo — e vale anche per il cliente, sia sul link del documento sia sul rapportino che firma.',
      'Avvisi di sicurezza: se cambiano il tuo IBAN o la tua password ti arriva subito un’email. Serve a scoprire in dieci minuti un accesso non tuo, prima che un bonifico finisca nel posto sbagliato.',
      'Esci da tutti i dispositivi: in Altro › Account e sicurezza chiudi l’accesso ovunque con un tocco, se perdi il telefono o hai un sospetto.',
    ],
  },
  {
    data: 'Seconda metà di luglio 2026',
    titolo: 'Calcoli di cantiere, testo grande e menu più chiaro',
    punti: [
      'Calcoli di cantiere: metri quadri, volume, piastrelle e litri di vernice. Dentro il preventivo c’è «Calcola quantità» su ogni voce (il risultato entra da solo nella quantità); da Altro › Strumenti › Calcoli lo usi anche in sopralluogo.',
      'Testo grande: in Altro c’è un interruttore che ingrandisce scritte e pulsanti in tutta l’app e aggiunge una spiegazione sotto le voci dei menu. Se non lo attivi, non cambia nulla.',
      'Menu «Altro» più chiaro: le voci del farsi conoscere (richieste, recensioni, vetrina) ora stanno in un’unica sezione «Fatti trovare dai clienti».',
      'Sulle ore di lavoro ora puoi correggere direttamente il totale (matita sotto il numero), senza fare i conti col meno.',
      'Bottone «Installa l’app sul telefono» sempre disponibile in Altro › Strumenti.',
    ],
  },
  {
    data: 'Metà luglio 2026',
    titolo: AI_ATTIVA ? 'Preventivo dalle foto, richiami e ore di lavoro' : 'Richiami ai clienti e ore di lavoro',
    punti: [
      // Solo se la funzione AI è attiva in produzione (flag)
      ...(AI_ATTIVA ? [
        'Preventivo dalle foto (AI): scatti le foto del lavoro — o riusi quelle del sopralluogo — e l’AI propone le voci. I prezzi vengono SOLO dal tuo catalogo, mai inventati; le pillole sotto ogni voce ti dicono cosa resta da compilare o da prezzare.',
      ] : []),
      'App più veloce: le pagine principali caricano i dati in un colpo solo — meno attesa aprendo Home, preventivi, fatture, lavori e bilancio.',
      'Richiama il cliente: sul Lavoro imposti un promemoria a 3, 6 o 12 mesi (es. manutenzione caldaia annuale) — alla data ti arriva la notifica in campanella. Il lavoro che si ripete da solo.',
      'Ore di lavoro: timer avvia/ferma dal cantiere (o inserimento a mano) sul Lavoro. Col costo orario in Impostazioni › Fiscale, la manodopera entra nel margine: sai quanto guadagni davvero.',
      'Un cliente con fatture a suo nome non si può più eliminare per sbaglio: i dati fiscali restano al sicuro sui documenti.',
      'Niente più zoom automatico su iPhone quando tocchi un campo.',
    ],
  },
  {
    data: 'Luglio 2026',
    titolo: AI_ATTIVA ? 'Agenda, foto scontrino e ufficio in tasca' : 'Agenda, Lavori e ufficio in tasca',
    punti: [
      'Nuova sezione Lavori: dal preventivo accettato segui il cantiere — da fare, in corso, finito, fatturato — con note, foto e margine (preventivato vs speso).',
      'Rapportino di fine lavoro: a lavoro finito scrivi cosa hai fatto e mandi al cliente un link da firmare dal telefono — la prova che il lavoro è stato consegnato.',
      'Pacchetto per il commercialista: da Fatture (o da Altro › Account e sicurezza) scarichi il registro delle fatture del periodo — con imponibile, IVA, bollo e incassato — pronto da girare allo studio.',
      'Invita il tuo commercialista (Altro › Account e sicurezza): con la sua email accede a fatture, incassi e spese in sola lettura e scarica registro e bilancio da solo. Revocabile quando vuoi.',
      'Agenda settimanale in Altro: sopralluoghi e lavori con data e ora, navigazione Google Maps e messaggio "sto arrivando" su WhatsApp.',
      // Solo se la funzione AI è attiva in produzione (flag)
      ...(AI_ATTIVA ? ['Foto allo scontrino nel Bilancio: l\'AI compila importo, data e categoria della spesa.'] : []),
      'Follow-up automatici (da attivare in Impostazioni › Notifiche): un promemoria gentile al cliente che non risponde entro 3 giorni.',
      'Bilancio: mesi scorrevoli col grafico, salto rapido a qualsiasi mese/anno, esporta CSV per il commercialista.',
      '"Scarica i tuoi dati" in Altro › Account e sicurezza: tutti i tuoi dati in un file.',
      'App più veloce e installabile sul telefono, con pagina offline.',
    ],
  },
  {
    data: 'Giugno 2026',
    titolo: 'Sopralluoghi, recensioni e marketplace',
    punti: [
      'Sopralluoghi con foto e dettatura, trasformabili in preventivo con un tocco.',
      'Foto prima/dopo sui lavori, visibili al cliente solo se vuoi tu.',
      'Opzioni a livelli (base/premium) nei preventivi Pro.',
      'Recensioni verificate dei clienti e directory pubblica dei professionisti.',
      'Acconti sui preventivi e pagamenti con IBAN/QR, PayPal o Satispay.',
    ],
  },
]

export default function NovitaPage() {
  return (
    <div className="max-w-3xl mx-auto">
      <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Novità</span>
        <span style={{ width: 24 }} />
      </div>

      {NOVITA.map((rel) => (
        <div key={rel.data} style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: '#b0863e' }}>{rel.data}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 15, fontWeight: 700, color: '#161616', margin: '4px 0 8px' }}>
            <Sparkles size={16} style={{ color: '#c9a44c' }} /> {rel.titolo}
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rel.punti.map((p) => (
              <li key={p} style={{ fontSize: 13, color: '#55534b', lineHeight: 1.55 }}>{p}</li>
            ))}
          </ul>
        </div>
      ))}

      <div style={{ height: 24 }} />
    </div>
  )
}
