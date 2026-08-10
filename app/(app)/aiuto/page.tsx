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

// `parole`: i sinonimi dell'artigiano che NON compaiono nel titolo della
// domanda — il cerca guarda titolo + queste, mai il testo della risposta.
const FAQ: Array<{ q: string; a: React.ReactNode; parole?: string[] }> = [
  {
    q: 'Come creo e invio un preventivo?',
    a: <>Dalla Home tocca <b>Nuovo preventivo</b>, scegli (o crea) il cliente, aggiungi le voci — anche
      dettandole col microfono o prendendole dal Catalogo — e tocca <b>Invia al cliente</b>. Il cliente
      riceve un link dove vede il preventivo e può accettarlo con un tocco.</>,
  },
  // Solo se la funzione AI è attiva in produzione (flag)
  ...(AI_ATTIVA ? [{
    q: 'Posso creare il preventivo dalle foto?',
    a: <>Sì: in un nuovo preventivo apri <b>Opzioni</b> nella card delle voci e tocca <b>Dalle foto</b>: scatti fino a 6 foto
      del lavoro (o riusa quelle del sopralluogo) e l&rsquo;AI propone le voci. I prezzi vengono{' '}
      <b>solo dal tuo catalogo</b>, mai inventati; le pillole sotto ogni voce ti dicono cosa resta
      da inserire. Controlla sempre prima di inviare.</>,
  }] : []),
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
      avvisa se il listino scade prima del preventivo. I costi restano <b>solo per i tuoi occhi</b>:
      il cliente non li vede mai.</>,
  },
  {
    q: 'Come modifico una bozza? Dove devo cliccare?',
    a: <>Apri la bozza dalla lista <b>Preventivi</b>{' '}(o <b>Fatture</b>): la bozza si apre già in
      modifica. Sui documenti già inviati tocca invece la <b>matita in alto a destra</b>{' '}— il form
      appare subito sotto la testata. In fondo trovi <b>Salva bozza</b>{' '}/ <b>Aggiorna</b>{' '}e il tasto
      navy <b>Invia al cliente</b>{' '}(o <b>Salva e invia</b>): salva le modifiche e apre il pop-up
      coi canali d&rsquo;invio.</>,
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
    a: <>Non sparisce subito: finisce nel <VaiA a="cestino" />, dove resta{' '}
      <b>15 giorni</b>{' '}e da cui puoi rimetterlo a posto con un tocco. Passati i 15 giorni viene
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
    a: <>Sì. In <VaiA a="impGenerale" />, sezione <b>Generale</b>, c&rsquo;è{' '}
      <b>Acconto da chiedere</b>: scegli <b>Una percentuale</b>{' '}(del totale, per esempio 30%) oppure{' '}<b>Una cifra fissa</b>{' '}in euro, e da lì in avanti ogni preventivo <b>nuovo</b>{' '}nasce con
      quell&rsquo;acconto già scritto. Su ciascun preventivo puoi comunque cambiarlo o
      toglierlo: l&rsquo;impostazione è un punto di partenza, non un vincolo.
      <br /><br />
      Se preferisci deciderlo ogni volta, lascia <b>Nessun acconto</b>: è come funziona oggi.
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
      <b>motivo</b>{' '}(errore nella fattura · accordo col cliente · altro) e poi la scrive lei:
      cliente, voci, importi e il riferimento alla fattura stornata. Tu controlli i numeri, la
      mandi al cliente e la <b>trasmetti</b>{' '}— è la trasmissione a far avvenire lo storno,
      finché resta qui dentro per l&rsquo;Agenzia la fattura è ancora intera.
      <br /><br />
      <b>Se la fattura NON è passata dallo SdI il tasto non c&rsquo;è, ed è voluto.</b>{' '}Una nota
      di credito non corregge un documento: rettifica un&rsquo;operazione che l&rsquo;Agenzia ha
      già registrato. Su una fattura mai trasmessa non c&rsquo;è nulla da stornare — chiederesti
      indietro un&rsquo;IVA che non hai mai dichiarato. In quel caso:{' '}
      <b>correggi la fattura e rimandala</b>{' '}al cliente, oppure <b>annullala</b>{' '}se il lavoro
      non si fa più.
      <br /><br />
      La nota ha una numerazione tutta sua (<b>NC&nbsp;001/2026</b>) e la trovi nella lista{' '}
      <b>Fatture</b>: sotto la riga c&rsquo;è scritto <b>Nota di credito</b>{' '}e quale
      fattura storna. Per vedere solo le note, scrivi <b>nota di credito</b>{' '}nel campo
      di ricerca — basta anche solo <b>nota</b>{' '}o <b>nc</b>. Sulla nota non c&rsquo;è &laquo;Segna pagata&raquo;:
      è denaro che torna al cliente, non che arriva.</>,
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
      evidenza</b>, e sulla più cara c&rsquo;è di quanto costa in più — così il cliente capisce
      al volo <b>cosa</b>{' '}sta pagando in più, non solo quanto.
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
      Prima guardava solo la data, e così una fattura <b>già pagata</b>{' '}con scadenza vicina
      finiva sopra una ancora <b>da incassare</b>: la lista era ordinata, ma non serviva a
      niente. Chi non ha una data di scadenza sta in fondo alla sua fascia — non in cima:
      «nessuna scadenza» non vuol dire «scade subito».</>,
  },
  {
    q: 'Come trovo i preventivi scaduti?',
    a: <>Nella lista <b>Preventivi</b>{' '}scrivi <b>scaduti</b>{' '}nel campo di ricerca (funzionano anche
      le altre diciture: &laquo;bozze&raquo;, &laquo;rifiutati&raquo;, &laquo;in attesa&raquo;…). Un
      preventivo scaduto si può <b>reinviare</b>{' '}dal suo dettaglio: la validità riparte da oggi.</>,
  },
  {
    q: 'Il cliente può scrivermi dal link del preventivo? E io come gli rispondo?',
    a: <>Sì: in fondo alla pagina che vede il cliente c&rsquo;è <b>Scrivi un messaggio</b>. Il
      messaggio ti arriva nella <b>campanella</b>{' '}e resta nella <b>cronologia</b>{' '}di quel
      documento, così sai sempre a cosa si riferisce; il cliente non deve registrarsi.
      Per rispondere apri il preventivo (o la fattura): sotto compare la card{' '}
      <b>Messaggi</b>: è una tendina, si apre da sola quando c&rsquo;è da rispondere e dentro
      trovi tutta la conversazione e il campo per scrivere. La tua risposta
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
    a: <>Vai in <VaiA a="sicurezza">Account e sicurezza</VaiA>{' '}e tocca <b>Esci da tutti i dispositivi</b>:
      chiude l&rsquo;accesso ovunque (anche dove non hai il telefono in mano), poi rientri con la
      tua password. Subito dopo <b>cambiala</b>{' '}dalla pagina di accesso. Controlla anche le tue{' '}
      <b>coordinate di pagamento</b>{' '}in Impostazioni &rsaquo; Pagamenti: chi entra in un
      gestionale di fatture di solito punta a cambiare l&rsquo;IBAN per dirottare i bonifici dei
      tuoi clienti. Ogni volta che l&rsquo;IBAN o la password cambiano ti arriva comunque{' '}
      <b>un&rsquo;email di avviso</b>: se ne ricevi una che non ti aspetti, scrivici subito da Aiuto.</>,
  },
  {
    q: 'Quanti preventivi posso fare col piano gratuito?',
    parole: ['free', 'gratis', 'limite', 'abbonamento', 'pro', 'prezzo'],
    a: <>Il piano Free include <b>8 preventivi inviati</b> in totale, con tutte le funzioni principali.
      Con <Link href="/abbonamento" style={{ color: '#1a1a2e', fontWeight: 600 }}>Pro</Link> diventano
      illimitati, con template personalizzati e altro.</>,
  },
  {
    q: 'Il preventivo è stato accettato: e ora?',
    a: <>Dal preventivo accettato tocca <b>Apri la scheda lavoro</b>: nella sezione <b>Lavori</b>{' '}(in Altro)
      segui il cantiere per stati — da fare, in corso, finito, fatturato — con note, foto e
      l&rsquo;<b>economia del lavoro</b>{' '}(preventivato, speso e margine).</>,
  },
  {
    q: 'Come conto le ore passate in cantiere?',
    parole: ['timer', 'manodopera', 'ore', 'tempo'],
    a: <>Sul <b>Lavoro</b>{' '}usa il timer <b>Avvia/Ferma</b>{' '}o inserisci le ore a mano. Se imposti
      il <b>costo orario</b>{' '}in <VaiA a="impFiscale">Impostazioni › Fiscale</VaiA>, la manodopera entra nello
      &ldquo;Speso&rdquo; e vedi il margine reale del lavoro.</>,
  },
  {
    q: 'Posso farmi ricordare di richiamare un cliente?',
    a: <>Sì: sul <b>Lavoro</b>{' '}imposta <b>Richiama il cliente</b>{' '}a 3, 6 o 12 mesi (o una data a
      scelta), per esempio per la manutenzione annuale della caldaia. Alla data giusta ti arriva la
      notifica in campanella.</>,
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
    a: <>In un <b>sopralluogo</b> imposta il campo <b>Appuntamento</b> (data e ora): lo ritrovi
      nell&rsquo;<b>Agenda</b> (in Altro) e, il giorno stesso, anche nella Home sotto
      {' '}<b>Oggi in agenda</b>, col bottone per avviare la navigazione verso il cantiere.</>,
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
    q: 'Le scritte sono piccole: posso ingrandirle?',
    parole: ['testo grande', 'leggibile', 'zoom', 'occhiali', 'vedo male'],
    a: <>Sì: in <VaiA a="strumenti" />{' '}attiva <b>Testo grande e leggibile</b> — scritte e
      pulsanti diventano più grandi in tutta l&rsquo;app e sotto le voci dei menu compare una breve
      spiegazione. Si spegne con lo stesso interruttore. Dal computer lo trovi in{' '}
      <VaiA a="impGenerale">Impostazioni › Generale</VaiA>.</>,
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
    a: <>Da <VaiA a="account">Account e sicurezza › Il tuo commercialista</VaiA>{' '}inserisci l&rsquo;email dello studio:
      riceve un invito e, accedendo con quella email, vede fatture, incassi e spese in <b>sola
      lettura</b>{' '}e scarica il registro per la contabilità. Puoi revocare l&rsquo;accesso quando vuoi.
      In alternativa scarichi tu il <b>Pacchetto commercialista</b> (dalle Fatture o da <VaiA a="account" />) e glielo mandi.</>,
  },
  {
    q: 'I miei dati dove sono? Posso portarli via?',
    parole: ['export', 'esportare', 'scaricare', 'backup', 'csv'],
    a: <>I dati sono su server in Europa. Da <VaiA a="account">Account e sicurezza › Scarica i tuoi dati</VaiA>{' '}esporti
      tutto in un file. Per la cancellazione dell&rsquo;account vedi la pagina{' '}
      <Link href="/cancella-account" style={{ color: '#1a1a2e', fontWeight: 600 }}>Cancellazione account</Link>.</>,
  },
  {
    q: 'I miei dati restano miei? Posso esportarli?',
    a: <>Sì, sempre e con qualsiasi piano: preventivi e fatture si esportano in CSV dalle
      rispettive liste, il catalogo da <VaiA a="catalogo">Catalogo → Esporta il catalogo</VaiA>, e da{' '}
      <VaiA a="account" />{' '}scarichi tutti i tuoi dati (clienti, documenti, spese).
      Nessun vincolo: l&rsquo;abbonamento si disdice quando vuoi.</>,
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
