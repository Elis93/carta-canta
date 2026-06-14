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
        fatture rivolta ad artigiani, freelance e piccole imprese.</p>

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

      <H2>5. Protezione dei dati — Nomina a Responsabile (art. 28 GDPR)</H2>
      <p>Per i dati personali dei clienti finali inseriti dall'utente nella piattaforma,
        l'utente è <strong>Titolare</strong> del trattamento e nomina il Fornitore quale
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
      <p>L'utente può chiudere il proprio account in qualsiasi momento. Il Fornitore può
        sospendere o chiudere account in caso di violazione dei presenti Termini.</p>

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
