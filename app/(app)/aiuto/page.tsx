import Link from 'next/link'
import { VaiA } from '@/components/shared/VaiA'
import { Mail, MessageCircleQuestion } from 'lucide-react'
import { BackButton } from '@/components/shared/BackButton'
import { ReviewTutorialCard } from '@/app/(app)/account/_components/ReviewTutorialCard'
import { CercaFaq } from './_components/CercaFaq'
import { SupportForm } from '@/components/shared/SupportForm'

export const metadata = { title: 'Aiuto e contatti' }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

const AI_ATTIVA = process.env.NEXT_PUBLIC_AI_IMPORT_ENABLED === 'true'
const SDI_ATTIVO = process.env.NEXT_PUBLIC_SDI_ENABLED === 'true'

// `parole`: i sinonimi dell'artigiano che NON compaiono nel titolo della
// domanda — il cerca guarda titolo + queste, mai il testo della risposta.
const FAQ: Array<{ q: string; a: React.ReactNode; parole?: string[] }> = [
  {
    q: 'Come creo e invio un preventivo?',
    a: <>Tocca il <b>+</b>{' '}in basso e scegli <b>Nuovo preventivo</b>, poi scegli (o crea) il cliente,
      aggiungi le voci — anche dettandole col microfono o prendendole dal Catalogo — e tocca{' '}
      <b>Invia al cliente</b>. Il cliente
      riceve un link dove vede il preventivo e può accettarlo con un tocco.</>,
  },
  // Solo se la funzione AI è attiva in produzione (flag)
  ...(AI_ATTIVA ? [{
    q: 'Posso creare il preventivo dalle foto?',
    a: <>Sì: in un nuovo preventivo apri <b>Opzioni</b> nella card delle voci e tocca <b>Dalle foto</b>: scatti fino a 6 foto
      del lavoro e l&rsquo;AI propone le voci. I prezzi vengono{' '}
      <b>solo dal tuo catalogo</b>, mai inventati; le pillole sotto ogni voce ti dicono cosa resta
      da inserire. Controlla sempre prima di inviare.</>,
  }] : []),
  {
    q: 'Mentre scrivo una voce compaiono dei suggerimenti: cosa sono?',
    parole: ['suggerimenti', 'autocompletamento', 'tendina', 'voci suggerite', 'compilazione automatica'],
    a: <>Sono le voci del tuo <b>Catalogo</b>{' '}(e dei <b>listini fornitori</b>, se hai Pro) che
      somigliano a quello che stai scrivendo: già alla prima lettera ne compaiono fino a{' '}
      <b>10</b>, e ogni lettera in più restringe la lista. Toccandone una si riempiono da soli{' '}
      <b>descrizione, prezzo, unità e IVA</b>{' '}— dal listino entra anche il costo, per il tuo
      margine privato. Sono solo una scorciatoia: puoi <b>ignorarli</b>{' '}e continuare a scrivere,
      non cambiano niente da soli. Se il catalogo è vuoto non compare nulla: si riempie da{' '}
      <VaiA a="catalogo" />{' '}o col tasto <b>Da catalogo</b>{' '}sotto le voci.</>,
  },
  {
    q: 'Le voci che scrivo finiscono nel catalogo?',
    parole: ['catalogo', 'salvare voce', 'voce nel catalogo', 'si aggiunge', 'riempire catalogo'],
    a: <>Sì: quando salvi un documento, ogni voce con una <b>descrizione</b>{' '}e un <b>prezzo</b>{' '}
      che non è già nel catalogo ci viene <b>aggiunta da sola</b>, così la ritrovi come suggerimento
      la prossima volta senza riscriverla. Le voci uguali non si duplicano, e quelle ancora da
      completare (senza prezzo) non entrano. Le puoi rivedere, correggere o togliere da{' '}
      <VaiA a="catalogo" />.</>,
  },
  {
    q: 'Posso segnare quanto pago io e vedere il margine?',
    parole: ['costo', 'ricarico', 'guadagno', 'quanto ci guadagno'],
    a: <>Sì: su ogni voce del preventivo (e nel Catalogo) c&rsquo;è il campo <b>Costo (solo per te)</b>.
      Compilandolo vedi ricarico e margine della voce e, sopra il riepilogo, il riquadro{' '}
      <b>Margine</b>{' '}con la composizione. Li vedi <b>solo tu</b>: non compaiono mai su documenti,
      pagine o email viste dal cliente. Con <b>Pro</b>, in{' '}
      <VaiA a="catalogo" />{' '}importi anche i <b>listini dei fornitori</b>{' '}(pure con una
      foto): scegli la voce in preventivo e l&rsquo;app propone il prezzo col tuo ricarico, e ti
      avvisa se il listino scade prima del preventivo.</>,
  },
  {
    q: 'Come gestisco i listini dei fornitori?',
    a: <>Con <b>Pro</b>, in <VaiA a="listini" />{' '}crei un listino
      col nome del fornitore e il tuo <b>ricarico</b>{' '}(es. 25%). Le voci le importi con una{' '}
      <b>foto o il PDF del listino</b>{' '}(l&rsquo;analisi legge fino a ~50 pagine) oppure a mano, e
      imposti fino a quando è valido. Quando il fornitore manda il listino nuovo, tocca{' '}
      <b>Rinnova</b>{' '}e ricarica il file: le voci si abbinano da sole (per codice o descrizione),
      i costi si aggiornano e vedi il riepilogo dei rincari. In preventivo, scegliendo una voce dal
      listino, entra col costo e il <b>prezzo proposto</b>{' '}(costo + ricarico) — e l&rsquo;app ti
      avvisa se il listino scade prima del preventivo. Se un listino <b>scade</b>{' '}mentre un
      preventivo ancora aperto ne usa i prezzi, ricevi un avviso nella <b>campanella</b>: rinnovalo
      per non promettere un prezzo che il fornitore potrebbe non fare più (l&rsquo;avviso si
      disattiva da <VaiA a="impNotifiche" />). I costi restano <b>solo per i tuoi occhi</b>:
      il cliente non li vede mai.</>,
  },
  {
    q: 'Come modifico una bozza? Dove devo cliccare?',
    a: <>Apri la bozza dalla lista <b>Preventivi</b>{' '}(o <b>Fatture</b>): la bozza si apre già in
      modifica. Sui documenti già inviati tocca invece la <b>matita in alto a destra</b>{' '}— il form
      appare subito sotto la testata. In fondo trovi <b>Salva bozza</b>{' '}/ <b>Aggiorna</b>{' '}e il tasto
      navy <b>Invia al cliente</b>{' '}(o <b>Salva e invia</b>): salva le modifiche e apre il pop-up
      coi canali d&rsquo;invio.
      <br /><br />
      ⚠️ Su una fattura <b>trasmessa allo SdI</b>{' '}la matita non c&rsquo;è: per l&rsquo;Agenzia
      è emessa e non si modifica più — si corregge con la <b>nota di credito</b>.</>,
  },
  {
    q: 'Come trovo le fatture passate dallo SdI?',
    a: <>Nella lista <b>Fatture</b>{' '}scrivi <b>sdi</b>{' '}nel campo di ricerca: compaiono tutte le
      fatture trasmesse (hanno la dicitura SdI con l&rsquo;esito). Puoi filtrare anche per esito:{' '}
      <b>sdi consegnata</b>, <b>sdi inviata</b>, <b>sdi emessa</b>{' '}o <b>sdi scartata</b>.</>,
  },
  {
    q: 'Non voglio più sollecitare un preventivo: cosa faccio?',
    a: <>Nelle pagine <b>Preventivi in scadenza</b>{' '}e <b>Fatture in scadenza</b>, sotto ogni
      documento c&rsquo;è l&rsquo;orologio <b>Posticipa il sollecito</b>. Da lì puoi rimandarlo di{' '}
      <b>3 giorni</b>, <b>1 settimana</b>{' '}o <b>2 settimane</b>{' '}— e torna da solo quando il
      tempo è scaduto — oppure scegliere <b>Non ricordarmelo più</b>: il documento resta in tutte
      le liste dov&rsquo;è sempre stato, ma smette di comparire fra i promemoria. Ci ripensi? Nella
      stessa pagina trovi <b>Riattiva i promemoria</b>.</>,
  },
  {
    q: 'Cosa vuol dire archiviare un preventivo o una fattura?',
    parole: ['archivio', 'archiviati', 'mettere via', 'nascondere'],
    a: <>Archiviare vuol dire <b>metterlo via</b>: esce dalle liste attive e dai promemoria, e lo
      ritrovi col tasto <b>Archivio</b>{' '}— dentro Preventivi o Fatture, a sinistra della riga
      &laquo;Ordina&raquo;. Da lì lo tiri fuori quando vuoi con <b>Togli dall&rsquo;archivio</b>.{' '}
      <b>Non è una cancellazione</b>: il documento resta intero, col suo numero, e continua a
      contare nel <VaiA a="bilancio" />, negli export e nel registro delle fatture. Il posto dove
      un documento sparisce davvero è il <VaiA a="cestino" />, che ha il conto alla rovescia di 15
      giorni: l&rsquo;archivio no. Per archiviare: il menu <b>⋯</b>{' '}sulla riga della lista, oppure
      l&rsquo;orologio nelle pagine delle scadenze.{' '}
      <b>Il cerca li trova lo stesso</b>: archiviare toglie un documento dalla lista che sfogli,
      non dalla ricerca — se cerchi il nome del cliente compare, con l&rsquo;etichetta
      &laquo;Archiviato&raquo;. E cercando la parola <b>archiviati</b>{' '}li vedi tutti.</>,
  },
  {
    q: 'Cosa posso eliminare e cosa devo tenere?',
    parole: ['eliminare', 'cancellare', 'tenere', 'conservare', 'buttare', 'sdi', 'fisco', 'controllo'],
    a: <><b>Puoi eliminare senza pensieri</b>{' '}i preventivi in <b>bozza</b>, i preventivi
      <b>rifiutati</b>{' '}o <b>scaduti</b>, le fatture in <b>bozza</b>{' '}mai partite, e le
      fatture <b>scartate dallo SdI</b>{' '}— per l&rsquo;Agenzia una fattura scartata non è mai
      stata emessa (la correggi e la ritrasmetti entro 5 giorni, stesso numero e stessa data).
      <br /><br />
      <b>Non eliminare</b>{' '}una fattura già <b>trasmessa allo SdI</b>: è emessa, va conservata
      dieci anni e per annullarla serve una <b>nota di credito</b>. Non devi ricordartelo tu:
      su quelle fatture il tasto Elimina è <b>spento</b>.
      <br /><br />
      <b>Tieni</b>{' '}anche i preventivi <b>accettati e firmati</b>: non è una questione fiscale,
      è la tua prova dell&rsquo;accordo se un domani nasce una discussione sul prezzo o su cosa
      era compreso. Se ti danno fastidio nelle liste, <b>archiviali</b>{' '}invece di eliminarli:
      spariscono dalla vista e restano nei conti.</>,
  },
  {
    q: 'Cosa succede se elimino un preventivo o una fattura?',
    parole: ['cestino', 'cancellare', 'buttato', 'per sbaglio', 'recuperare'],
    a: <>Non sparisce subito: finisce nel <b>Cestino</b>, dove resta{' '}
      <b>15 giorni</b>{' '}e da cui puoi rimetterlo a posto con un tocco. Trovi il cestino col
      tasto <b>Cestino</b>{' '}dentro Preventivi, Fatture e Sopralluoghi, accanto
      all&rsquo;<b>Archivio</b>{' '}— ognuno mostra gli elementi del suo tipo. Passati i 15 giorni viene
      cancellato per davvero, e da lì non si recupera più. Nel cestino puoi anche eliminarlo
      subito e per sempre, ma è una scelta senza ritorno. Il <b>numero</b>{' '}del documento
      eliminato <b>non viene riusato</b>: nella numerazione resta un buco, ed è normale — è
      un&rsquo;irregolarità solo formale, non sanzionabile.</>,
  },
  {
    q: 'Posso eliminare una fattura che ho già mandato al cliente?',
    parole: ['eliminare fattura', 'cancellare fattura', 'sdi', 'nota di credito'],
    a: <>Dipende da una cosa sola: <b>se è passata dallo SdI</b>.
      <br /><br />
      <b>Trasmessa allo SdI</b>{' '}(l&rsquo;hai inviata da qui e ha un esito): per l&rsquo;Agenzia
      è emessa. Non si elimina e non si annulla — si storna con una <b>nota di credito</b>, e
      l&rsquo;app non te la fa nemmeno provare: il tasto Elimina è spento, e al posto di
      &laquo;Annulla&raquo; trovi <b>&laquo;Crea nota di credito&raquo;</b>. Va conservata{' '}
      <b>dieci anni</b>.
      <br /><br />
      <b>Mandata al cliente ma mai trasmessa</b>{' '}(gliel&rsquo;hai girata via email o WhatsApp
      come copia): fiscalmente <b>non è ancora emessa</b>, quindi puoi eliminarla. Finisce nel{' '}
      <VaiA a="cestino" />, dove resta 15 giorni.
      <br /><br />
      <b>Scartata dallo SdI</b>: è come se non fosse mai partita. La correggi e la ritrasmetti
      entro 5 giorni con lo stesso numero, oppure la elimini.
      <br /><br />
      In tutti i casi il <b>numero</b>{' '}non viene riusato: nella sequenza resta un buco, ed è
      normale — è un&rsquo;irregolarità solo formale, non sanzionabile.</>,
  },
  {
    q: 'Posso far comparire l’acconto già impostato su ogni preventivo?',
    parole: ['acconto', 'anticipo', 'caparra', '30%', 'default', 'sempre uguale', 'impostazioni'],
    a: <>Sì. In <VaiA a="impGenerale" />, sezione <b>Dati dell&rsquo;attività</b>, c&rsquo;è{' '}
      <b>Acconto da chiedere</b>: scegli <b>Percentuale</b>{' '}(del totale, per esempio 30%) oppure{' '}<b>Cifra fissa</b>{' '}in euro, e da lì in avanti ogni preventivo <b>nuovo</b>{' '}nasce con
      quell&rsquo;acconto già scritto. Su ciascun preventivo puoi comunque cambiarlo o
      toglierlo: l&rsquo;impostazione è un punto di partenza, non un vincolo.
      <br /><br />
      Se preferisci deciderlo ogni volta, lascia <b>Nessun acconto</b>{' '}(è l&rsquo;impostazione
      di partenza).
      <br /><br />
      Con la <b>cifra fissa</b>, su un preventivo più piccolo l&rsquo;acconto{' '}
      <b>si ferma al totale</b>: 500&nbsp;€ di acconto su un preventivo da 300&nbsp;€
      diventano 300&nbsp;€ e saldo zero — al cliente non viene mai chiesto più del dovuto.
      <br /><br />
      ⚠️ Vale solo per i preventivi che crei <b>da qui in avanti</b>: quelli già scritti non
      cambiano. Sarebbe sbagliato il contrario — un preventivo già mandato al cliente non
      deve cambiare importo perché hai toccato un&rsquo;impostazione.</>,
  },
  {
    q: 'Come faccio una nota di credito?',
    parole: ['nota di credito', 'storno', 'stornare', 'td04', 'rimborso', 'ho sbagliato la fattura'],
    a: <>Apri la fattura da stornare: se è stata <b>trasmessa allo SdI</b>, al posto di
      &laquo;Annulla&raquo; trovi <b>&laquo;Crea nota di credito&raquo;</b>. Ti chiede solo il{' '}
      <b>motivo</b>{' '}(errore nella fattura · accordo col cliente · altro); al resto pensa lei:
      cliente, voci, importi e il riferimento alla fattura stornata. Il motivo conta anche per i{' '}
      <b>tempi</b>: per un errore o un accordo col cliente la nota va fatta{' '}
      <b>entro un anno</b>{' '}dalla fattura — non rimandare. Tu controlli i numeri, la
      mandi al cliente e la <b>trasmetti</b>: è la trasmissione a far avvenire lo storno.
      Finché la nota resta qui dentro, per l&rsquo;Agenzia la fattura è ancora intera.
      <br /><br />
      <b>Se la fattura NON è passata dallo SdI il tasto non c&rsquo;è, ed è voluto.</b>{' '}Una nota
      di credito non corregge un documento: rettifica un&rsquo;operazione che l&rsquo;Agenzia ha
      già registrato. Su una fattura mai trasmessa non c&rsquo;è nulla da stornare — chiederesti
      indietro un&rsquo;IVA che non hai mai dichiarato. In quel caso:{' '}
      <b>correggi la fattura e rimandala</b>{' '}al cliente, oppure <b>annullala</b>{' '}se il lavoro
      non si fa più.
      <br /><br />
      Sulla stessa fattura puoi fare <b>più note parziali</b>: sulla pagina della fattura vedi
      l&rsquo;elenco delle sue note e il <b>residuo stornabile</b> — le note successive nascono
      già con gli importi ridotti al residuo, e l&rsquo;app <b>non lascia stornare più del
      totale</b>{' '}della fattura. A residuo zero il tasto si spegne e ti spiega perché.
      <br /><br />
      Se la nota supera 77,47&nbsp;€, la <b>marca da bollo</b>{' '}da 2&nbsp;€ si aggiunge da
      sola, come sulle fatture (il bollo della fattura stornata invece non si recupera).
      <br /><br />
      La nota ha una numerazione tutta sua (<b>NC&nbsp;001/2026</b>) e la trovi nella lista{' '}
      <b>Fatture</b>: sotto la riga c&rsquo;è scritto <b>Nota di credito</b>{' '}e quale
      fattura storna. Per vedere solo le note, scrivi <b>nota di credito</b>{' '}nel campo
      di ricerca — basta anche solo <b>nota</b>{' '}o <b>nc</b>. Sulla nota non c&rsquo;è &laquo;Segna pagata&raquo;:
      è denaro che torna al cliente, non che arriva.</>,
  },
  // Le tre FAQ della fattura elettronica compaiono solo con lo SdI acceso
  // (decisione 10 ago: niente FAQ su UI che l'utente non vede — citano la
  // card SdI, la Home e l'interruttore, che senza flag non esistono).
  ...(SDI_ATTIVO ? [
  {
    q: 'Quando una fattura è davvero «emessa»? Cosa sono i 12 giorni?',
    parole: ['emessa', 'emissione', '12 giorni', 'termine', 'tardiva', 'trasmissione', 'bozza', 'copia di cortesia', 'data fattura'],
    a: <>Una <b>bozza non è emessa</b>. E non lo è nemmeno quando la mandi al cliente: quel
      documento è una <b>copia di cortesia</b>. Per la legge la fattura è emessa{' '}
      <b>solo quando viene trasmessa allo SdI</b>.
      <br /><br />
      La <b>data della fattura</b>{' '}nasce quando la bozza viene <b>confermata</b>{' '}
      (il primo invio al cliente o «Segna pagata»): finché resta bozza puoi lavorarci con
      calma, senza che nessun conteggio parta. Da quella data (o dal primo incasso, se
      arriva prima) corrono i <b>12 giorni</b>{' '}per la trasmissione. Per non fartelo
      tenere a mente, sulla fattura la card <b>Fattura elettronica (SdI)</b>{' '}mostra il{' '}
      <b>conto alla rovescia</b>{' '}— «Da trasmettere entro il … · mancano N giorni» — e
      negli ultimi 3 giorni ti arriva anche la notifica in campanella. Il tondino ⓘ accanto
      al conto spiega tutto. E con la <b>trasmissione automatica</b>{' '}attiva non devi
      nemmeno pensarci: la fattura parte da sola.
      <br /><br />
      L&rsquo;elenco completo di quelle ancora da trasmettere, in ordine di urgenza, è in{' '}
      <VaiA a="daTrasmettere" />{' '}— ci arrivi anche dal riquadro <b>Da trasmettere</b>{' '}
      della Home.
      <br /><br />
      ⚠️ Se il termine è passato la fattura <b>resta valida</b>: trasmettila comunque.
      Si tratta di un&rsquo;emissione tardiva, quindi sanzionabile: segnala il ritardo al
      commercialista, perché con il <b>ravvedimento operoso</b>{' '}la sanzione si riduce
      in misura sensibile.</>,
  },
  {
    q: 'La fattura parte da sola allo SdI? Come funziona la trasmissione automatica?',
    parole: ['automatica', 'automatico', 'pilota', 'parte da sola', 'trasmissione automatica', '24 ore', 'annulla trasmissione'],
    a: <>Sì, ed è <b>accesa di partenza</b>: quando confermi una fattura (il primo invio al
      cliente o «Segna pagata»), la trasmissione allo SdI viene <b>programmata dopo 24 ore</b>.
      Un avviso te lo dice nel momento stesso, e sulla fattura la card SdI mostra{' '}
      <b>quando partirà</b>, col tasto <b>Annulla</b>{' '}se vuoi fermarla — le 24 ore servono
      proprio ad avere il tempo di un ripensamento.
      <br /><br />
      Se l&rsquo;invio automatico non riesce, <b>non insiste da solo</b>: la fattura torna
      alla trasmissione manuale e <b>ti arriva un&rsquo;email</b>{' '}che te lo dice, col
      conto alla rovescia dei 12 giorni a fare da rete — niente parte due volte e niente
      fallisce in silenzio.
      <br /><br />
      Preferisci trasmettere sempre tu? Spegni l&rsquo;interruttore in{' '}
      <b>Impostazioni › Dati fiscali › Trasmissione automatica allo SdI</b>: resterà tutto
      manuale, guidato dal conto alla rovescia. Le <b>note di credito</b>{' '}non partono
      mai da sole: quelle le trasmetti sempre tu.</>,
  },
  {
    q: 'La fattura è stata scartata dallo SdI: cosa faccio?',
    parole: ['scartata', 'scarto', 'rifiutata', 'errore sdi', 'codice destinatario', 'duplicata', 'reinvia'],
    a: <>Uno scarto non è un guaio: significa solo che <b>c&rsquo;è un dato da correggere</b>.
      Per l&rsquo;Agenzia una fattura scartata è come se non
      fosse mai partita. Sulla fattura trovi il motivo <b>spiegato in parole semplici</b>,
      con scritto <b>cosa fare</b>: l&rsquo;app riconosce gli errori più comuni (codice
      destinatario sbagliato, P.IVA del cliente non valida, fattura duplicata, conti che
      non tornano…) e ti dice dove mettere mano.
      <br /><br />
      Correggi il dato segnalato e premi <b>Reinvia allo SdI</b>: va fatto{' '}
      <b>entro 5 giorni</b>{' '}dallo scarto, tenendo lo <b>stesso numero e la stessa data</b>.
      Le scartate le vedi anche in <b>Home</b>, nel riquadro «Scartate» accanto a quelle
      da trasmettere, e in cima all&rsquo;elenco di <VaiA a="daTrasmettere" />.</>,
  },
  ] : []),
  {
    q: 'Perché la fattura ha 2 € in più del preventivo?',
    parole: ['marca da bollo', 'bollo', '77', 'due euro', 'totale diverso'],
    a: <>È la <b>marca da bollo</b>: sulle fatture (e sulle note di credito) senza IVA sopra{' '}
      77,47&nbsp;€ la legge chiede 2&nbsp;€ di imposta, e l&rsquo;app li aggiunge da sola.
      Il <b>preventivo</b>{' '}invece non è un documento fiscale: il bollo non è dovuto e non
      compare — arriva quando il preventivo diventa fattura. Il costo è a tuo carico
      (l&rsquo;Agenzia lo conteggia ogni trimestre nel cassetto fiscale): addebitarlo al
      cliente è una scelta tua, da concordare.</>,
  },
  {
    q: 'Ho installato una caldaia: perché una parte è al 22% invece che al 10%?',
    parole: ['beni significativi', 'caldaia', 'infissi', 'sanitari', 'iva 10', 'iva 22', 'aliquota', 'condizionatore', 'videocitofono'],
    a: <>Perché la caldaia è un <b>bene significativo</b>. Sui lavori in casa con IVA
      agevolata al 10% ci sono sette beni — ascensori e montacarichi, infissi, caldaie,
      videocitofoni, condizionatori, sanitari e rubinetteria da bagno, impianti di
      sicurezza — per cui il 10% vale <b>solo fino al valore del lavoro</b>. Quello che
      avanza va al 22%.
      <br /><br />
      Un esempio: caldaia 2.000&nbsp;€ e posa 800&nbsp;€. Il lavoro vale 800, quindi al
      10% vanno 800 di posa più 800 di caldaia (1.600 in tutto) e i restanti
      1.200&nbsp;€ di caldaia vanno al 22%. Se invece la caldaia costasse meno del
      lavoro, sarebbe tutto al 10%.
      <br /><br />
      Nel «valore del lavoro» ci sta tutto ciò che non è quel bene: manodopera,
      materiali, e anche tapparelle, zanzariere e grate, che si contano a parte
      rispetto all&rsquo;infisso. Tu spunti <b>«È un bene significativo»</b>{' '}sulla voce,
      il resto lo fa l&rsquo;app: divide la riga in due e scrive in fattura il valore del
      bene, come chiede la legge. La spunta compare solo se non sei in forfettario e la
      voce è al 10%.</>,
  },
  {
    q: 'Fatturo a un condominio: mi trattengono qualcosa?',
    parole: ['condominio', 'ritenuta', '4%', 'amministratore', 'trattenuta', 'sostituto d’imposta', 'bonifico parlante', '11%'],
    a: <>Sì. Il condominio è <b>sostituto d&rsquo;imposta</b>: trattiene il <b>4%</b>{' '}
      dell&rsquo;imponibile e lo versa lui all&rsquo;Agenzia per conto tuo. Non è un costo
      — te lo ritrovi come credito nella dichiarazione — ma è denaro che sul conto non
      arriva subito.
      <br /><br />
      Nella fattura in modifica spunta <b>«Il cliente è un condominio»</b>: la fattura
      mostra la trattenuta e il totale da bonificare, così tu e l&rsquo;amministratore
      vedete la stessa cifra.
      <br /><br />
      <b>Se sei in forfettario non ti trattengono niente</b>{' '}(art. 1, comma 67,
      L. 190/2014) e la tua fattura lo dice già da sola: serve proprio a impedire
      all&rsquo;amministratore di trattenere per sbaglio.
      <br /><br />
      <b>Attenzione al doppio conto:</b>{' '}se il condominio paga con <b>bonifico
      parlante</b>{' '}per un lavoro agevolato, la banca trattiene già l&rsquo;11% e il 4%
      non si applica. Le due ritenute non si sommano mai.</>,
  },
  {
    q: 'Lavoro per un’altra impresa: devo fare la fattura senza IVA?',
    parole: ['reverse charge', 'inversione contabile', 'senza iva', 'impresa', 'n6.7', 'subappalto', 'edile'],
    a: <>Spesso sì. Per pulizia, demolizione, installazione di impianti e completamento{' '}
      <b>su edifici</b>, quando il cliente è a sua volta <b>titolare di partita
      IVA</b>, la fattura si emette <b>senza IVA</b>: l&rsquo;imposta la versa lui. Si
      chiama <b>inversione contabile</b>{' '}(reverse charge) e non serve essere in
      subappalto — basta che il committente sia un soggetto IVA.
      <br /><br />
      Nella fattura in modifica trovi la spunta <b>«Lavoro edile per un&rsquo;altra
      impresa o professionista»</b>. Serve la partita IVA del cliente in rubrica: senza,
      l&rsquo;app non ti lascia trasmettere, perché fra un&rsquo;impresa e un privato
      l&rsquo;inversione contabile non esiste. Se il cliente è un privato — anche per lo
      stesso identico lavoro — l&rsquo;IVA va addebitata normalmente.
      <br /><br />
      La fattura porta la dicitura di legge e, sopra 77,47&nbsp;€, la <b>marca da bollo
      di 2&nbsp;€</b>: vale per ogni fattura senza imposta.
      <br /><br />
      <b>La spunta la metti tu, non la indovina l&rsquo;app.</b>{' '}La regola dipende da
      cosa hai fatto e per chi, e l&rsquo;elenco ufficiale dei lavori è legato a una
      classificazione delle attività che nel 2025 è cambiata senza che quella tabella
      venisse aggiornata. Nel dubbio su un lavoro, chiedi al tuo commercialista: qui
      l&rsquo;app fa quello che le dici.
      <br /><br />
      <b>Se sei in forfettario non ti riguarda:</b>{' '}le tue fatture restano fuori campo
      IVA come sempre, e la spunta non compare.</>,
  },
  {
    q: 'Il cliente riceve una conferma quando accetta?',
    parole: ['accettazione', 'conferma', 'ricevuta', 'email al cliente', 'ha accettato'],
    a: <>Sì. Appena accetta, al cliente arriva un&rsquo;<b>email di conferma</b>{' '}col
      riepilogo: numero del preventivo, proposta scelta, totale, <b>data e ora</b>{' '}
      dell&rsquo;accettazione e chi ha firmato, più il collegamento per rileggerlo. Se
      risponde a quell&rsquo;email, la risposta arriva <b>a te</b>.
      <br /><br />
      Sullo schermo il cliente vede lo stesso riepilogo, con il tasto{' '}
      <b>Rivedi il preventivo</b>{' '}per tornare al documento — che da lì in avanti mostra
      &laquo;Preventivo accettato il …&raquo;.
      <br /><br />
      Nello stesso momento <b>arriva anche a te</b>{' '}la notifica di accettazione (la
      puoi spegnere in <VaiA a="impNotifiche" />). L&rsquo;email al cliente parte una
      volta sola: un preventivo si accetta una volta.
      <br /><br />
      ⚠️ Se il cliente non ha un&rsquo;email in rubrica, l&rsquo;avviso non può partire:
      la conferma la vede solo sullo schermo.</>,
  },
  {
    q: 'Come vede il cliente le due proposte (Base e Premium)?',
    parole: ['proposte', 'opzioni', 'base', 'premium', 'due prezzi', 'alternative'],
    a: <>Sul link che gli mandi trova le proposte una sotto l&rsquo;altra, ciascuna col suo
      prezzo. <b>Quello che è uguale fra le proposte è in grigio; quello che cambia resta in
      evidenza</b>, e sulla più cara c&rsquo;è scritto quanto costa in più — così il cliente
      capisce al volo <b>cosa</b>{' '}sta pagando, non solo quanto.
      <br /><br />
      Sceglie toccando una proposta e conferma con <b>Accetta e firma</b>. Da quel momento il
      preventivo <b>vale quella proposta</b>: è la cifra che vedi in Home, nelle liste e nella
      fattura.
      <br /><br />
      Se il cliente ti risponde a voce, puoi segnarlo tu: apri il preventivo, tocca{' '}
      <b>Segna accettato</b>{' '}e scegli quale proposta ha accettato. Se sbagli,{' '}
      <b>Riporta in bozza</b>{' '}e tornano disponibili tutte.</>,
  },
  {
    q: 'Cosa fa «Ordina: Scadenza vicina»?',
    parole: ['ordina', 'ordinamento', 'scadenza', 'urgenti', 'in ritardo', 'da incassare prima'],
    a: <>Mette in cima quello di cui <b>ti devi occupare adesso</b>, non semplicemente la data
      più vicina. L&rsquo;ordine è: <b>scadute</b>{' '}(le più in ritardo per prime) → <b>in
      attesa</b>{' '}di risposta, per scadenza più vicina → <b>bozze</b>{' '}→ <b>pagate</b>{' '}
      (o accettate) → <b>annullate</b>.
      <br /><br />
      Così una fattura <b>già pagata</b>{' '}non finisce mai sopra una ancora{' '}
      <b>da incassare</b>{' '}solo perché ha la scadenza più vicina. Chi non ha una data di
      scadenza sta in fondo alla sua fascia, non in cima: «nessuna scadenza» non vuol dire
      «scade subito».</>,
  },
  {
    q: 'Come trovo i preventivi scaduti?',
    parole: ['scaduti', 'ricerca', 'cercare', 'filtrare', 'modificati', 'fattura collegata'],
    a: <>Nella lista <b>Preventivi</b>{' '}scrivi <b>scaduti</b>{' '}nel campo di ricerca (funzionano anche
      le altre diciture: &laquo;bozze&raquo;, &laquo;rifiutati&raquo;, &laquo;in attesa&raquo;…). Un
      preventivo scaduto si può <b>reinviare</b>{' '}dal suo dettaglio: la validità riparte da oggi.
      <br /><br />
      La stessa ricerca vale per <b>modificati</b>{' '}(i documenti ritoccati dopo
      l&rsquo;invio, quelli col badge viola) e, nei Preventivi, per la parola <b>fattura</b>{' '}—
      da sola trova i preventivi che una fattura ce l&rsquo;hanno già, con uno stato
      (&laquo;bozza fattura&raquo;, &laquo;fatture pagate&raquo;) trova quelli con la fattura
      collegata in quello stato.</>,
  },
  {
    q: 'Come vedo se il cliente ha aperto il preventivo?',
    parole: ['visto', 'aperto', 'visualizzato', 'letto', 'quando ha aperto', 'cronologia'],
    a: <>Quando il cliente apre il link, lo stato passa a <b>Visto</b>{' '}(lo leggi in lista e sul
      documento). Per sapere <b>quando e quante volte</b>, apri il documento e guarda la{' '}
      <b>Cronologia</b>: ogni apertura è una riga a sé, con data e ora — &laquo;Aperto dal
      cliente&raquo;, &laquo;2ª volta&raquo;… Lì trovi anche tutto il resto della storia: invii,
      modifiche, incassi, messaggi, e ogni passaggio di stato, <b>anche se poi sei tornato
      indietro</b>{' '}(riportare in bozza non cancella niente: la cronologia è la storia del
      documento).</>,
  },
  {
    q: 'Il cliente può scrivermi dal link del preventivo? E io come gli rispondo?',
    a: <>Sì: in fondo alla pagina che vede il cliente c&rsquo;è <b>Scrivi un messaggio</b>. Il
      messaggio ti arriva nella <b>campanella</b>{' '}e resta nella <b>cronologia</b>{' '}di quel
      documento, così sai sempre a cosa si riferisce; il cliente non deve registrarsi.
      Per rispondere apri il preventivo (o la fattura) e trovi la card{' '}
      <b>Messaggi</b>{' '}— una tendina che si apre da sola quando c&rsquo;è da rispondere, con
      dentro tutta la conversazione e il campo per scrivere. La tua risposta
      appare al cliente sulla <b>stessa pagina del link</b>{' '}e, se il cliente ha un&rsquo;email in
      rubrica, gli arriva anche <b>per email</b>{' '}con dentro il testo. Se l&rsquo;email non ce
      l&rsquo;ha, l&rsquo;app te lo dice: in quel caso la vedrà solo riaprendo il link, quindi
      conviene avvisarlo tu.</>,
  },
  {
    q: 'Il cliente come accetta? La firma vale?',
    a: <>Dal link che gli invii, il cliente tocca <b>Accetta e firma</b>{' '}e scrive il suo nome. Vengono registrati
      data, ora e dispositivo: è una firma elettronica semplice, utile come prova dell&rsquo;accordo.
      Tu ricevi subito la notifica.</>,
  },
  {
    q: 'Come segno una fattura come pagata?',
    parole: ['incasso', 'incassata', 'saldo', 'acconto', 'bonifico', 'soldi arrivati'],
    a: <>Apri la fattura e tocca <b>Segna pagata</b>: puoi indicare l&rsquo;importo ricevuto (anche
      parziale, per gli acconti) e la data. L&rsquo;incasso finisce automaticamente nel Bilancio.</>,
  },
  {
    q: 'Ho registrato un incasso sbagliato: come lo correggo? E il Bilancio?',
    a: <>Sulla fattura con l&rsquo;acconto, sotto &laquo;Resta da incassare&raquo;, tocca{' '}
      <b>Azzera e reinserisci</b>{' '}e registra l&rsquo;importo giusto (su una fattura già saldata
      usa prima <b>Segna come non pagata</b>). Nel <b>Bilancio</b>{' '}l&rsquo;incasso sbagliato{' '}
      <b>sparisce dal mese in cui l&rsquo;avevi registrato</b>, come se non fosse mai esistito —
      niente importi negativi nel mese della correzione. Ogni incasso conta nel mese in cui i
      soldi sono arrivati davvero (acconto e saldo restano nei loro mesi), e la cronologia
      della fattura conserva tutti i passaggi.</>,
  },
  {
    q: 'Ho fatturato meno del dovuto: come lo correggo? (nota di debito)',
    parole: ['nota di debito', 'nd', 'td05', 'integrare', 'lavoro in piu', 'ho fatturato poco', 'aggiungere a una fattura'],
    a: <>Con la <b>nota di debito</b>. È la gemella della nota di credito, per il caso
      opposto: quella di credito toglie, questa <b>aggiunge</b>{' '}a una fattura già
      trasmessa — un lavoro in più concordato, un prezzo o una quantità troppo bassi,
      un&rsquo;IVA applicata per difetto.
      <br /><br />
      La trovi sulla fattura trasmessa, sotto «Crea nota di credito»: scegli cosa manca e
      la nota nasce col cliente e il riferimento alla fattura. ⚠️ <b>Nasce vuota di voci</b>,
      e ci metti <b>solo quello che manca</b>: se ricopiassi tutto il lavoro, il cliente
      pagherebbe due volte.
      <br /><br />
      Ha una numerazione tutta sua (<b>ND&nbsp;001/2026</b>), va mandata al cliente e{' '}
      <b>trasmessa allo SdI</b>{' '}come una fattura, e si incassa come una fattura. A
      differenza della nota di credito, che è una tua facoltà, <b>questa è obbligatoria</b>{' '}
      quando l&rsquo;importo è aumentato: senza, l&rsquo;alternativa sarebbe una seconda
      fattura scollegata dalla prima, che è sbagliata.</>,
  },
  {
    q: 'Una fattura è «scaduta»: posso dare al cliente più tempo per pagare?',
    parole: ['scaduta', 'termine di pagamento', 'proroga', 'ritardo', 'rinvia', 'nuova scadenza'],
    a: <>Sì. Su una fattura la scadenza è il <b>termine di pagamento</b>: quando è passato
      la fattura risulta <b>Scaduta</b>, e dal pop-up <b>Invia al cliente</b>{' '}puoi
      concederne uno nuovo (7, 15, 30 giorni…). Lo stato torna a <b>Inviata</b>.
      <br /><br />
      <b>Attenzione a non confondere due termini distinti.</b>
      <br /><br />
      <b>1. Il termine di pagamento</b>{' '}è un accordo <b>commerciale</b>{' '}fra te e il
      cliente: stabilisce entro quando deve pagarti. Puoi prorogarlo liberamente, in
      qualsiasi momento, senza conseguenze fiscali.
      <br /><br />
      <b>2. Il termine di trasmissione allo SdI è un obbligo di legge.</b>{' '}L&rsquo;articolo
      21, comma 4 del DPR 633/1972 stabilisce che la fattura elettronica dev&rsquo;essere
      trasmessa al Sistema di Interscambio <b>entro 12 giorni dalla data di effettuazione
      dell&rsquo;operazione</b>{' '}— cioè dalla data della fattura, o dal primo incasso se
      avviene prima. Questo termine <b>non è prorogabile</b>{' '}e <b>non dipende in alcun
      modo dagli accordi di pagamento</b>{' '}presi col cliente.
      <br /><br />
      In pratica: concedere al cliente due settimane in più per pagare <b>non ti concede un
      giorno in più per trasmettere</b>, e <b>non modifica la data riportata sulla
      fattura</b>. La proroga riguarda soltanto l&rsquo;incasso.
      <br /><br />
      ⚠️ Trasmettere oltre i 12 giorni non invalida la fattura, ma configura{' '}
      <b>emissione tardiva</b>, che è sanzionabile. La sanzione si riduce sensibilmente col{' '}
      <b>ravvedimento operoso</b>: se ti accorgi di essere in ritardo, trasmetti comunque e
      parlane col commercialista.</>,
  },
  {
    q: 'Ho incassato un acconto: devo fare qualcosa entro una data?',
    parole: ['acconto', 'anticipo', 'caparra', 'fattura di acconto', '12 giorni', 'incasso'],
    a: <>Sì. <b>Chiedere</b>{' '}un acconto non fa scattare
      nulla: è solo una richiesta. <b>Incassarlo</b>{' '}sì — per la legge l&rsquo;operazione
      si considera effettuata al pagamento, quindi da quel giorno hai <b>12 giorni</b>{' '}per
      emettere (e trasmettere) la <b>fattura per la parte incassata</b>.
      <br /><br />
      Per questo, quando registri l&rsquo;acconto sul preventivo, l&rsquo;app te lo dice e
      lascia il promemoria con la data entro cui farlo. Da lì converti il preventivo in
      fattura, oppure ne parli col commercialista se preferisci gestirla diversamente.
      <br /><br />
      ⚠️ Quando poi incassi il <b>saldo</b>, la fattura finale deve tenere conto
      dell&rsquo;acconto già fatturato: altrimenti lo stesso importo risulterebbe fatturato
      due volte.</>,
  },
  {
    q: 'Cosa entra nelle Entrate e nelle Uscite del Bilancio?',
    parole: ['bilancio', 'entrate', 'uscite', 'cassa', 'guadagno', 'conti', 'utile', 'cosa conta'],
    a: <>Il Bilancio è il quadro della tua <b>cassa</b>: conta i <b>soldi che si muovono</b>, non
      i documenti che emetti.
      <br /><br />
      <b>Entrate</b> = gli <b>incassi</b>{' '}che hai registrato (con «Segna pagata» o
      registrando un acconto), nel mese in cui li hai incassati. Una fattura inviata ma non
      ancora pagata <b>non</b>{' '}è un&rsquo;entrata; un preventivo accettato nemmeno. Le{' '}
      <b>note di credito</b>{' '}restano fuori dalle entrate.
      <br /><br />
      <b>Uscite</b> = le <b>spese che registri tu</b>{' '}(Bilancio › Aggiungi spesa), divise in{' '}
      <b>Costi dei lavori</b>{' '}(quelle che colleghi a un lavoro) e <b>Spese generali</b>.
      <br /><br />
      <b>Cosa NON entra, e perché:</b>{' '}il <b>costo</b>{' '}che segni sulle voci del preventivo
      (serve al tuo margine, non è un soldo uscito: la spesa vera la registri quando compri) ·
      le <b>ore</b>{' '}del timer (il tuo tempo non esce dal conto corrente — le trovi nella
      scheda del lavoro) · i <b>listini fornitori</b>, che sono cataloghi di prezzi.
      <br /><br />
      ⚠️ Non è un bilancio contabile e non sostituisce il commercialista. E se sei in{' '}
      <b>forfettario</b>, le spese registrate qui <b>non abbassano le tasse</b>: si paga sul
      fatturato per coefficiente ATECO.</>,
  },
  {
    q: 'Nel Bilancio posso vedere quanto ho guadagnato su un singolo lavoro? E l’anno intero?',
    a: <>Sì. In <b>Altro &rsaquo; Bilancio</b>{' '}trovi la card <b>&laquo;Lavori di&hellip;&raquo;</b>: per
      ogni lavoro vedi quanto hai <b>incassato</b>, quanto hai <b>speso</b>{' '}e quanto ti resta;
      toccando la riga apri la scheda del lavoro. La riga <b>&laquo;Non collegato a un lavoro&raquo;</b>{' '}
      raccoglie il resto, così i conti tornano sempre con i totali in alto. In cima puoi passare da{' '}
      <b>Mese</b>{' '}ad <b>Anno</b>: in modalità anno vedi i 12 mesi e il confronto con l&rsquo;anno
      prima (sull&rsquo;anno in corso il paragone è a parità di periodo). Le <b>ore</b>{' '}segnate col
      timer non sono contate qui, perché non sono soldi usciti dal conto: le trovi nella scheda del lavoro.</>,
  },
  {
    q: 'Ho perso il telefono o temo che qualcuno sia entrato nel mio account: cosa faccio?',
    parole: ['impronta', 'password', 'sicurezza', 'rubato', 'accesso', 'blocco'],
    a: <>Vai in <VaiA a="sicurezza" />{' '}e tocca <b>Esci da tutti i dispositivi</b>:
      chiude l&rsquo;accesso ovunque (anche dove non hai il telefono in mano), poi rientri con la
      tua password. Subito dopo <b>cambiala</b>{' '}dalla pagina di accesso. Controlla anche le tue{' '}
      <b>coordinate di pagamento</b>{' '}in <VaiA a="impPagamenti">Coordinate di pagamento</VaiA>: chi entra in un
      gestionale di fatture di solito punta a cambiare l&rsquo;IBAN per dirottare i bonifici dei
      tuoi clienti. Ogni volta che l&rsquo;IBAN o la password cambiano ti arriva comunque{' '}
      <b>un&rsquo;email di avviso</b>: se ne ricevi una che non ti aspetti, scrivici subito da Aiuto.</>,
  },
  {
    q: 'Quanti preventivi e fatture posso fare col piano gratuito?',
    parole: ['free', 'gratis', 'limite', 'abbonamento', 'pro', 'prezzo', 'fatture'],
    a: <>Il piano Free include <b>8 preventivi</b> e <b>8 fatture</b> inviati, con due contatori separati e
      tutte le funzioni principali. Conta il primo invio al cliente (email, WhatsApp o link copiato): salvare
      una bozza non consuma nulla, e la trasmissione della fattura allo SdI resta sempre possibile.
      Con <Link href="/abbonamento" style={{ color: '#1a1a2e', fontWeight: 600 }}>Pro</Link> diventano
      illimitati, con template personalizzati e altro.</>,
  },
  {
    q: 'Sono tornato da Pro a Free: cosa succede ai documenti in più?',
    parole: ['downgrade', 'torno a free', 'bloccato', 'bloccati', 'sola lettura', 'oltre gli 8', 'disdetta'],
    a: <>Nulla viene cancellato. I primi <b>8 preventivi</b> e le prime <b>8 fatture</b> inviati
      restano usabili come sul piano Free; quelli in più diventano di <b>sola lettura</b> — li apri
      e li consulti, ma non puoi modificarli, inviarli, scaricarli in PDF o duplicarli (li riconosci
      dal badge <b>🔒 Bloccato</b>{' '}nella lista). Anche i template personalizzati e i listini fornitori
      restano visibili ma bloccati. Tutto torna com&rsquo;era{' '}
      <Link href="/abbonamento" style={{ color: '#1a1a2e', fontWeight: 600 }}>tornando a Pro</Link>:
      i tuoi dati non si perdono mai.</>,
  },
  {
    q: 'Il preventivo è stato accettato: e ora?',
    a: <>Dal preventivo accettato tocca <b>Apri la scheda lavoro</b>: nella sezione <b>Lavori</b>{' '}(in Altro)
      segui il lavoro passo passo — da fare, in corso, finito, fatturato — con note, foto e
      l&rsquo;<b>economia del lavoro</b>{' '}(preventivato, speso e margine).</>,
  },
  {
    q: 'Come conto le ore passate in cantiere?',
    parole: ['timer', 'manodopera', 'ore', 'tempo'],
    a: <>Sul <b>Lavoro</b>{' '}usa il timer <b>Avvia/Ferma</b>{' '}o inserisci le ore a mano. Se imposti
      il <b>costo orario</b>{' '}in <VaiA a="impFiscale">Impostazioni › Dati fiscali</VaiA>, la manodopera entra nello
      &ldquo;Speso&rdquo; e vedi il margine reale del lavoro.</>,
  },
  {
    q: 'Posso farmi ricordare di richiamare un cliente?',
    parole: ['richiamo', 'manutenzione', 'caldaia', 'ricorrente', 'ogni anno'],
    a: <>Sì: sul <b>Lavoro</b>{' '}imposta <b>Richiama il cliente</b>{' '}a 3, 6 o 12 mesi (o una data a
      scelta), per esempio per la manutenzione annuale della caldaia. Alla data giusta ti arriva la
      notifica in campanella. E quando è il momento, sulla scheda del lavoro trovi{' '}
      <b>Prepara il preventivo per la manutenzione</b>: nasce una bozza già compilata col cliente
      e le voci dell&rsquo;anno scorso — tu aggiorni prezzi e date e la invii.</>,
  },
  {
    q: 'Cos’è il rapportino di fine lavoro?',
    parole: ['firma', 'fine lavori', 'prova', 'consegna'],
    a: <>A lavoro finito, dal <b>Lavoro</b>{' '}scrivi cosa hai fatto e mandi al cliente un link: lui
      firma dal telefono e tu conservi la <b>prova della consegna</b>{' '}(con data, ora e nome).
      Dopo la firma il testo non si può più modificare.</>,
  },
  {
    q: 'Come funzionano appuntamenti e agenda?',
    parole: ['calendario', 'sopralluogo', 'appuntamento'],
    a: <>In un <b>sopralluogo</b>, nella sezione <b>Cliente e cantiere</b>, apri
      {' '}<b>Appuntamento</b> e imposta data e ora: lo ritrovi nell&rsquo;<b>Agenda</b> (in Altro)
      e, il giorno stesso, anche nella Home sotto <b>Oggi in agenda</b>, col bottone per avviare
      la navigazione verso il cantiere.</>,
  },
  {
    q: 'Come calcolo metri quadri, piastrelle o vernice?',
    parole: ['mq', 'metri', 'righello', 'quantita', 'calcolo', 'pittura'],
    a: <>Dentro il preventivo, su ogni voce c&rsquo;è <b>Calcola quantità</b>: scrivi le misure e il
      risultato entra da solo nella quantità (con l&rsquo;unità giusta). Nel <b>sopralluogo</b>,
      negli Appunti, c&rsquo;è <b>Calcola una misura</b>: il calcolo resta salvato col risultato,
      lo tocchi per rimodificarlo e passa nelle Note interne del preventivo. Lo stesso strumento
      è anche in <VaiA a="calcoli">Strumenti › Calcoli</VaiA>. Per piastrelle e vernice controlla sempre
      le indicazioni della scatola o della latta.</>,
  },
  {
    q: 'Cosa sono i tondini con la «i» accanto ai campi?',
    parole: ['info', 'informazioni', 'spiegazione', 'aiutino', 'punto i', 'tasto tondo'],
    a: <>Sono le <b>spiegazioni delle funzioni</b>: tocchi il tondino ⓘ e sotto compare cosa fa
      il campo o la funzione che gli sta accanto; lo ritocchi e la spiegazione si chiude. Così le
      pagine restano pulite e la spiegazione c&rsquo;è solo quando la cerchi. Gli avvisi{' '}
      <b>importanti</b>{' '}— quelli fiscali o che evitano un errore — restano invece sempre
      scritti per esteso, senza bisogno di toccare niente.</>,
  },
  {
    q: 'Le scritte sono piccole: posso ingrandirle?',
    parole: ['testo grande', 'leggibile', 'zoom', 'occhiali', 'vedo male'],
    a: <>Sì: in <VaiA a="strumenti" />{' '}attiva <b>Testo grande</b> — scritte e
      pulsanti diventano più grandi in tutta l&rsquo;app e sotto le voci dei menu compare una breve
      spiegazione. Si spegne con lo stesso interruttore. Dal computer lo trovi in{' '}
      <VaiA a="impGenerale">Impostazioni › Dati dell&rsquo;attività</VaiA>.</>,
  },
  {
    q: 'Come chiedo una recensione a un cliente?',
    parole: ['recensione', 'stelle', 'giudizio', 'passaparola'],
    a: <>Sulla fattura <b>saldata</b>{' '}compare la card <b>Chiedi una recensione</b>: il messaggio
      è già scritto, col link dentro — tu scegli se mandarlo su <b>WhatsApp</b>, per <b>email</b>{' '}
      o copiare il testo. Il momento migliore è subito dopo il lavoro, quando il cliente è
      contento. La card compare solo se hai <b>pubblicato la vetrina</b>: senza, la recensione
      non la vedrebbe nessuno. Le recensioni ricevute le trovi in <VaiA a="vetrina" />.</>,
  },
  {
    q: 'Come mi faccio trovare dai nuovi clienti?',
    parole: ['vetrina', 'marketplace', 'profilo pubblico', 'recensioni', 'pubblicita'],
    a: <>In <VaiA a="vetrina" />{' '}trovi tutto: il tuo <b>profilo pubblico</b>{' '}
      (mestiere, zona, presentazione), le <b>richieste</b>{' '}di chi ti contatta dalla vetrina e le{' '}
      <b>recensioni</b>{' '}dei tuoi clienti.</>,
  },
  {
    q: 'Come collego il mio commercialista?',
    parole: ['studio', 'contabile', 'fisco', 'invito'],
    a: <>Da <VaiA a="account">Account e abbonamento › I tuoi dati e commercialista</VaiA>{' '}inserisci l&rsquo;email dello studio:
      riceve un invito e, accedendo con quella email, vede fatture, incassi e spese in <b>sola
      lettura</b>{' '}e scarica il registro per la contabilità. Puoi revocare l&rsquo;accesso quando vuoi.
      In alternativa scarichi tu il <b>Pacchetto commercialista</b> (dalle Fatture o da <VaiA a="account" />) e glielo mandi.</>,
  },
  {
    q: 'I miei dati restano miei? Posso esportarli o portarli via?',
    parole: ['export', 'esportare', 'scaricare', 'backup', 'csv', 'dove sono', 'server'],
    a: <>Sì, sempre e con qualsiasi piano. I dati stanno su <b>server in Europa</b>{' '}e restano
      tuoi: preventivi e fatture si esportano in CSV dalle rispettive liste, il catalogo da{' '}
      <VaiA a="catalogo">Catalogo → Esporta il catalogo</VaiA>, e da{' '}
      <VaiA a="account">Account e abbonamento › I tuoi dati e commercialista</VaiA>{' '}scarichi tutto in un
      file (clienti, documenti, spese). Nessun vincolo: l&rsquo;abbonamento si disdice quando
      vuoi, e per chiudere del tutto c&rsquo;è la pagina{' '}
      <Link href="/cancella-account" style={{ color: '#1a1a2e', fontWeight: 600 }}>Cancellazione account</Link>.</>,
  },
  {
    q: 'L\u2019assistenza è solo per chi paga?',
    a: <>No: l&rsquo;assistenza è per tutti, anche col piano Free, e ti risponde{' '}
      <b>una persona</b>, non un risponditore automatico. Scrivici dal modulo qui sotto o a
      supporto@cartacanta.app.</>,
  },
]

// Due schede separate (Eli, 7 ago): il tutorial da una parte, contatti e
// domande dall'altra — stesse pillole di Impostazioni e Account, e con
// `replace` così Indietro torna in Altro invece di ripercorrere le schede.
const SEZIONI = [
  { value: 'aiuto',    label: 'Aiuto'    },
  { value: 'tutorial', label: 'Tutorial' },
] as const

type SezioneAiuto = (typeof SEZIONI)[number]['value']

export default async function AiutoPage({
  searchParams,
}: {
  searchParams: Promise<{ sez?: string }>
}) {
  const { sez } = await searchParams
  const attiva: SezioneAiuto = SEZIONI.find((x) => x.value === sez)?.value ?? 'aiuto'
  return (
    <div className="max-w-3xl mx-auto">
      {/* Header — fascia bianca */}
      <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Aiuto e contatti</span>
        <span style={{ width: 24 }} />
      </div>

      <div style={{ padding: '0 15px' }}>
        <div className="cc-tabs cc-filter-scroll cc-tabs-equal" style={{ marginTop: 14 }}>
          {SEZIONI.map(({ value, label }) => (
            <Link
              key={value}
              replace
              href={value === 'aiuto' ? '/aiuto' : `/aiuto?sez=${value}`}
              className={attiva === value ? 'cc-tab-active' : 'cc-tab'}
              style={{ textDecoration: 'none', display: 'block' }}
            >
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* ── TUTORIAL: il giro guidato del primo accesso e le guide di sezione.
          Sono arrivati qui da "Account e sicurezza" (7 ago): chi cerca un
          tutorial cerca aiuto, non le impostazioni del proprio account. */}
      {attiva === 'tutorial' && (
        <div style={{ margin: '2px 15px 0' }}>
          <ReviewTutorialCard />
        </div>
      )}

      {attiva === 'aiuto' && (
      <>
      {/* Contatto diretto */}
      <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <span style={{ width: 38, height: 38, borderRadius: 11, background: '#f5f0e2', color: '#b0863e', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Mail size={18} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}>Ti serve una mano?</div>
            <div style={{ fontSize: 12, color: '#767676', marginTop: 1 }}>Scrivici da qui, rispondiamo entro 1 giorno lavorativo.</div>
          </div>
        </div>
        <SupportForm />
        <p style={{ fontSize: 12, color: 'var(--cc-muted)', margin: '10px 0 0', lineHeight: 1.5 }}>
          Preferisci la posta? Scrivi a supporto@cartacanta.app dalla tua email.
        </p>
      </div>

      {/* FAQ */}
      <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: SH, padding: '13px 15px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 4 }}>
          <MessageCircleQuestion size={15} /> Domande frequenti
        </div>
        {/* Con più di trenta domande, scorrerle tutte è il motivo per cui uno
            rinuncia: il cerca filtra mentre scrivi (Eli, 8 ago). */}
        <CercaFaq voci={FAQ} />
      </div>
      </>
      )}

      {/* Link legali */}
      <div style={{ margin: '12px 15px 0', display: 'flex', gap: 14, justifyContent: 'center', fontSize: 12 }}>
        <Link href="/privacy" style={{ color: 'var(--cc-muted)' }}>Privacy</Link>
        <Link href="/termini" style={{ color: 'var(--cc-muted)' }}>Termini</Link>
        <Link href="/cancella-account" style={{ color: 'var(--cc-muted)' }}>Cancella account</Link>
      </div>

      <div style={{ height: 24 }} />
    </div>
  )
}
