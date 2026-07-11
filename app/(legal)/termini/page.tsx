import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Termini di Servizio — Carta Canta',
  description: 'Condizioni d\'uso del servizio Carta Canta.',
}

// I testi tra <Fill> sono PLACEHOLDER da compilare prima di pubblicare.
function Fill({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-amber-100 px-1 font-medium text-amber-900">
      {children}
    </span>
  )
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 mb-3 text-lg font-semibold tracking-tight">{children}</h2>
}

export default function TerminiPage() {
  return (
    <article className="space-y-4 text-sm leading-relaxed text-foreground">
      <h1 className="text-2xl font-bold tracking-tight">Termini di Servizio</h1>
      <p className="text-muted-foreground">
        Ultimo aggiornamento: <Fill>[DATA]</Fill>
      </p>
      <p>
        I presenti Termini regolano l'utilizzo del servizio <strong>Carta Canta</strong>
        («Servizio»), fornito da <Fill>[RAGIONE SOCIALE]</Fill>, P.IVA <Fill>[P.IVA]</Fill>
        («Fornitore»). Utilizzando il Servizio l'utente accetta i presenti Termini.
      </p>

      <H2>1. Descrizione del Servizio</H2>
      <p>Carta Canta è una piattaforma per la creazione, l'invio e la gestione di preventivi e
        fatture rivolta ad artigiani, freelance e piccole imprese. Include funzioni accessorie:
        catalogo voci con lettura assistita da intelligenza artificiale, dettatura vocale,
        sopralluoghi con foto, bilancio, richiesta di acconti, pagamenti «porta il tuo canale»,
        recensioni dei clienti, directory pubblica dei professionisti e — quando attiva —
        trasmissione della fattura elettronica al Sistema di Interscambio tramite un provider terzo.</p>

      <H2>1-bis. Natura del Servizio — nessuna consulenza fiscale</H2>
      <p>Carta Canta è uno <strong>strumento</strong> di supporto operativo e <strong>non</strong>{' '}
        costituisce consulenza fiscale, contabile o legale. I calcoli, le aliquote, il regime,
        la marca da bollo e ogni altro dato dei documenti restano sotto la responsabilità
        dell'utente, che è tenuto a verificarne la correttezza e a rispettare i propri obblighi
        verso l'Agenzia delle Entrate. Il Fornitore non garantisce l'idoneità dei documenti a
        specifici fini fiscali.</p>

      <H2>2. Account</H2>
      <p>L'utente è responsabile della riservatezza delle proprie credenziali e di ogni
        attività svolta tramite il proprio account. È necessario fornire dati veritieri e
        mantenerli aggiornati.</p>

      <H2>3. Piani e pagamenti</H2>
      <p>Il Servizio è disponibile in un piano gratuito con limitazioni e in piani a pagamento.
        I pagamenti sono gestiti tramite Stripe. I rinnovi, i prezzi e le condizioni di recesso
        sono indicati nella pagina degli abbonamenti.</p>

      <H2>4. Obblighi dell'utente</H2>
      <p>L'utente si impegna a usare il Servizio nel rispetto della legge, a non caricare
        contenuti illeciti e a non comprometterne la sicurezza. È responsabile della
        correttezza fiscale dei documenti emessi e degli adempimenti di legge (inclusa, ove
        prevista, la trasmissione della fattura elettronica tramite SdI).</p>

      <H2>4-bis. Contenuti dell'utente (foto, listini, testi)</H2>
      <p>L'utente resta titolare dei contenuti che carica (foto dei lavori, listini, note) e
        concede al Fornitore una licenza limitata a trattarli per erogare il Servizio (es.
        mostrarli al cliente sul link pubblico se scelti come visibili). L'utente garantisce di
        avere i diritti sui contenuti e di aver raccolto gli eventuali consensi delle persone
        ritratte; tiene indenne il Fornitore da pretese di terzi al riguardo. Le foto sono
        visibili al cliente <strong>solo</strong> se l'utente le contrassegna come tali.</p>

      <H2>4-ter. Funzioni di intelligenza artificiale</H2>
      <p>La lettura dei listini e la dettatura vocale usano fornitori di AI terzi (indicati
        nell'Informativa Privacy). L'esito dell'AI è un <strong>suggerimento</strong> e va
        sempre verificato dall'utente prima dell'uso; il Fornitore non risponde di eventuali
        imprecisioni dell'elaborazione automatica.</p>

      <H2>4-quater. Recensioni e directory pubblica</H2>
      <p>Le recensioni sono ammesse solo per clienti con un lavoro fatturato e pagato tramite la
        piattaforma, a sole domande chiuse. Il Fornitore agisce come hosting provider: rimuove i
        contenuti manifestamente illeciti su segnalazione (segnalazioni@cartacanta.app). Nella
        directory pubblica il Fornitore <strong>non è parte</strong> del rapporto tra
        professionista e potenziale cliente e non garantisce qualifiche, qualità o esito dei
        lavori; la verifica della P.IVA sul registro VIES ha valore meramente indicativo.</p>

      <H2>5. Protezione dei dati — Nomina a Responsabile (art. 28 GDPR)</H2>
      <p>Per i dati personali dei clienti finali inseriti dall'utente nella piattaforma,
        l'utente è <strong>Titolare</strong> del trattamento e nomina il Fornitore quale{' '}
        <strong>Responsabile</strong>. Il Fornitore tratta tali dati solo su istruzione del
        Titolare e per erogare il Servizio, adotta misure di sicurezza adeguate (art. 32 GDPR),
        si avvale dei sub-responsabili indicati nell'Informativa Privacy, avvisa il Titolare
        senza ingiustificato ritardo in caso di violazione dei dati, e al termine del rapporto
        cancella o restituisce i dati salvo obblighi di legge. Il testo completo dell'atto di
        nomina è disponibile su richiesta a <Fill>[privacy@cartacanta.app]</Fill>.</p>

      <H2>6. Limitazione di responsabilità</H2>
      <p>Il Servizio è fornito «così com'è». Nei limiti consentiti dalla legge, il Fornitore non
        risponde di danni indiretti o di perdite derivanti da errori nei dati inseriti
        dall'utente. <Fill>[Da definire con il consulente legale.]</Fill></p>

      <H2>7. Recesso e chiusura account</H2>
      <p>L'utente può chiudere il proprio account in qualsiasi momento scrivendo a
        <Fill>[privacy@cartacanta.app]</Fill>; prima della chiusura può esportare i propri dati
        (CSV di preventivi, fatture e bilancio). Alla chiusura, i dati non soggetti a obblighi di
        legge vengono cancellati, mentre i documenti fiscali sono conservati per il periodo
        previsto dalla normativa (in genere 10 anni): l'obbligo di conservazione a norma della
        fattura elettronica resta comunque in capo all'utente. Il Fornitore può sospendere o
        chiudere account in caso di violazione dei presenti Termini.</p>

      <H2>8. Modifiche</H2>
      <p>Il Fornitore può modificare i presenti Termini dandone comunicazione. L'uso continuato
        del Servizio dopo le modifiche ne comporta l'accettazione.</p>

      <H2>9. Legge applicabile e foro</H2>
      <p>I presenti Termini sono regolati dalla legge italiana. Foro competente:
        <Fill>[città]</Fill>, salvo il foro del consumatore ove applicabile.</p>

      <p className="mt-6 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
        ⚠️ Bozza da far validare da un consulente legale prima della pubblicazione definitiva.
      </p>
    </article>
  )
}
