import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Cancellazione account — Carta Canta',
  description: 'Come richiedere la cancellazione del tuo account e dei tuoi dati su Carta Canta.',
}

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mt-8 mb-3 text-lg font-semibold tracking-tight">{children}</h2>
}

export default function CancellaAccountPage() {
  return (
    <article className="space-y-4 text-sm leading-relaxed text-foreground">
      <h1 className="text-2xl font-bold tracking-tight">Cancellazione dell&rsquo;account e dei dati</h1>
      <p className="text-muted-foreground">
        Questa pagina spiega come chiedere la cancellazione del tuo account <strong>Carta Canta</strong>{' '}
        e dei dati collegati, in conformità al GDPR.
      </p>

      <H2>Come richiederla</H2>
      <p>
        Il modo più rapido è direttamente dall&rsquo;app: <em>Impostazioni › Generale › Elimina account</em>.
        Prima di procedere puoi scaricare una copia dei tuoi dati. La cancellazione è immediata.
      </p>
      <p>
        In alternativa puoi scrivere dall&rsquo;indirizzo email del tuo account a{' '}
        <a href="mailto:privacy@cartacanta.app" className="font-medium underline">privacy@cartacanta.app</a>{' '}
        con oggetto <em>&laquo;Cancellazione account&raquo;</em>: verificheremo la tua identità e
        procederemo entro <strong>30 giorni</strong>.
      </p>

      <H2>Quali dati vengono cancellati</H2>
      <p>Alla chiusura dell&rsquo;account cancelliamo i dati non soggetti a obblighi di legge, tra cui:</p>
      <ul className="ml-5 list-disc space-y-1">
        <li>il profilo e le credenziali di accesso;</li>
        <li>l&rsquo;anagrafica dei tuoi clienti, il catalogo, i sopralluoghi e le foto;</li>
        <li>le bozze e i preventivi non convertiti in documento fiscale;</li>
        <li>le preferenze, le notifiche e i dati di utilizzo.</li>
      </ul>

      <H2>Quali dati siamo tenuti a conservare (e per quanto)</H2>
      <p>
        Alcuni dati non possono essere cancellati subito perché la legge ci obbliga a conservarli:
        in particolare i <strong>documenti fiscali</strong> (fatture e relative registrazioni) vanno
        conservati per <strong>10 anni</strong> (art. 2220 del Codice civile e normativa tributaria).
        Questi dati vengono conservati in modo protetto e cancellati allo scadere del termine di legge.
      </p>

      <H2>Tempi</H2>
      <p>
        La richiesta viene evasa entro <strong>30 giorni</strong>. Riceverai una conferma via email al
        completamento. Fino ad allora puoi revocare la richiesta scrivendo allo stesso indirizzo.
      </p>

      <H2>Contatti</H2>
      <p>
        Per qualsiasi domanda sui tuoi dati:{' '}
        <a href="mailto:privacy@cartacanta.app" className="font-medium underline">privacy@cartacanta.app</a>.
        Hai inoltre diritto di proporre reclamo al Garante per la protezione dei dati personali.
      </p>
    </article>
  )
}
