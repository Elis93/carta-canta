// ============================================================
// Guide di sezione — il giro guidato di UNA pagina.
//
// PERCHÉ (richiesta Eli, 7 ago 2026): *"mini tutorial per ogni parte più
// importante, tipo per Altro: quando l'artigiano ci clicca vede che ci sono
// diverse funzioni e vengono spiegate; e questo tutorial poi lo può rivedere
// insieme all'altro che abbiamo già"*.
//
// Il tour di primo accesso insegna UNA cosa (fare e mandare un preventivo) e
// si ferma lì. Ma metà dell'app vive dietro «Altro», e chi apre quella pagina
// trova diciotto voci senza sapere quali gli servono davvero. Queste guide
// riempiono quel buco: si aprono DA SOLE la prima volta che entri in una
// sezione, una volta sola per dispositivo, e restano disponibili in
// Account e dati accanto a «Rivedi il tutorial».
//
// ⚠️ DUE REGOLE, perché una guida che appare quando non serve è peggio del
// nulla:
//  1. MAI sopra il tour principale né sopra un'altra guida (lo controlla
//     SectionTourController leggendo `driver-active` sul body).
//  2. Una volta sola per dispositivo, poi solo su richiesta esplicita. Il
//     segno resta in localStorage, quindi sopravvive alla chiusura dell'app.
//
// Per aggiungerne una: una voce qui dentro e un `data-tour="..."` sugli
// elementi da evidenziare. Nient'altro.
// ============================================================

export interface SectionStep {
  /** Selettore dell'elemento da evidenziare. Se non è in pagina, il passo si salta. */
  selector: string
  title: string
  /** Ammette <b> per le parole chiave. */
  desc: string
}

export interface SectionTour {
  /** Titolo mostrato nell'elenco delle guide in Account e dati */
  label: string
  /** A cosa serve, una riga */
  sub: string
  /** Dove vive la guida */
  path: string
  steps: SectionStep[]
}

export const SECTION_TOURS: Record<string, SectionTour> = {
  altro: {
    label: 'Cosa c’è in «Altro»',
    sub: 'Il giro delle funzioni oltre preventivi e fatture.',
    path: '/altro',
    steps: [
      {
        selector: '[data-tour="altro-cerca"]',
        title: 'Non ricordi dov’è una cosa? Cercala',
        desc: 'Scrivi qui la parola che ti viene in mente — <b>iban</b>, <b>cestino</b>, <b>impronta</b>, <b>listino</b> — e l’app ti porta dritto alla funzione. Si cercano le <b>funzioni dell’app</b>: per trovare un cliente o un documento usa la ricerca dentro Preventivi, Fatture o Clienti.',
      },
      {
        selector: '[data-tour="altro-lavoro"]',
        title: 'Qui c’è il lavoro di tutti i giorni',
        desc: 'Il <b>cantiere</b> (da fare, in corso, finito), l’<b>agenda</b> degli appuntamenti, i <b>sopralluoghi</b> con foto e appunti, e la <b>rubrica</b> dei clienti.',
      },
      {
        selector: '[data-tour="altro-strumenti"]',
        title: 'Gli strumenti che ti fanno guadagnare',
        desc: 'Il <b>Bilancio</b> ti dice quanto entra e quanto esce. Il <b>catalogo</b> riempie i preventivi in un tocco. La <b>vetrina</b> ti fa trovare da clienti nuovi.',
      },
      {
        selector: '[data-tour="altro-account"]',
        title: 'Impostazioni e dati',
        desc: 'Da qui cambi i tuoi dati fiscali; nella voce <b>Account e commercialista</b> colleghi il tuo commercialista e scarichi il pacchetto delle fatture per lui; e trovi <b>Aiuto</b> con le domande frequenti. E quando accanto a un campo vedi il tondino <b>ⓘ</b>, toccalo: spiega a cosa serve quella funzione.',
      },
    ],
  },
  bilancio: {
    label: 'Come leggere il Bilancio',
    sub: 'Entrate, uscite e quanto resta davvero.',
    path: '/bilancio',
    steps: [
      {
        selector: '[data-tour="bilancio-kpi"]',
        title: 'Soldi entrati e soldi usciti',
        desc: 'Sono <b>movimenti veri</b>: le entrate contano quando incassi, non quando emetti la fattura. Un preventivo accettato non compare finché non ti pagano.',
      },
      {
        selector: '[data-tour="bilancio-periodo"]',
        title: 'Un mese o tutto l’anno',
        desc: 'Passa da <b>Mese</b> a <b>Anno</b> con un tocco. In modalità anno vedi anche il confronto con l’anno prima, a parità di periodo.',
      },
    ],
  },
}

export type SectionTourKey = keyof typeof SECTION_TOURS

/** Chiave in localStorage: segna che la guida è già stata mostrata da sola. */
export function seenKey(key: string): string {
  return `cc_guida_${key}`
}

/** Chiave in sessionStorage per il rilancio volontario da Account e dati. */
export const SECTION_TOUR_REQUEST = 'cc_guida_richiesta'
