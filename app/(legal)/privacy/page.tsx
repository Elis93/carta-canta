import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Informativa sulla Privacy — Carta Canta',
  description: 'Come Carta Canta tratta i dati personali degli utenti del servizio.',
}

// I testi tra <Fill> sono PLACEHOLDER da compilare con i dati reali della tua
// azienda PRIMA di pubblicare in produzione. L'evidenziazione gialla serve a
// non dimenticarli: sparisce non appena sostituisci il testo.
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

export default function PrivacyPage() {
  return (
    <article className="space-y-4 text-sm leading-relaxed text-foreground">
      <h1 className="text-2xl font-bold tracking-tight">Informativa sulla Privacy</h1>
      <p className="text-muted-foreground">
        Ultimo aggiornamento: <Fill>[DATA]</Fill>
      </p>
      <p>
        La presente informativa descrive come <strong>Carta Canta</strong> tratta i dati
        personali degli utenti del servizio disponibile su cartacanta.app, ai sensi degli
        articoli 13 e 14 del Regolamento (UE) 2016/679 (GDPR).
      </p>

      <H2>1. Titolare del trattamento</H2>
      <ul className="space-y-1">
        <li><strong>Titolare:</strong> <Fill>[RAGIONE SOCIALE / NOME E COGNOME]</Fill></li>
        <li><strong>Forma giuridica:</strong> <Fill>[es. ditta individuale / S.r.l.]</Fill></li>
        <li><strong>P.IVA / Codice Fiscale:</strong> <Fill>[P.IVA]</Fill></li>
        <li><strong>Sede:</strong> <Fill>[SEDE LEGALE]</Fill></li>
        <li><strong>Email per la privacy:</strong> <Fill>[privacy@cartacanta.app]</Fill></li>
        <li><strong>PEC:</strong> <Fill>[PEC, se disponibile]</Fill></li>
      </ul>

      <H2>2. Doppio ruolo: quando siamo titolari e quando responsabili</H2>
      <p>Per i <strong>dati del tuo account</strong> (email, dati fiscali, abbonamento) e per i
        dati raccolti sulle pagine pubbliche (recensioni, richieste dal marketplace) Carta Canta
        è <strong>titolare del trattamento</strong>.</p>
      <p>Per i <strong>dati dei tuoi clienti</strong> che inserisci nel servizio (rubrica,
        preventivi, fatture, firme, foto) sei <strong>tu il titolare</strong> e Carta Canta agisce
        come <strong>responsabile del trattamento</strong>{' '}per tuo conto, secondo l&rsquo;accordo
        ai sensi dell&rsquo;art. 28 GDPR che accetti al momento della registrazione.</p>

      <H2>2-bis. Quali dati trattiamo</H2>
      <p><strong>Dati dell'account artigiano:</strong> email, password (cifrata), nome,
        ragione sociale, P.IVA, codice fiscale, indirizzo, regime fiscale, codici ATECO, logo.</p>
      <p><strong>Dati che inserisci nel servizio:</strong> anagrafiche dei tuoi clienti
        (nome, indirizzo, email, telefono, P.IVA/CF), voci di preventivi e fatture, importi,
        foto dei lavori.</p>
      <p><strong>Prova di accettazione dei preventivi:</strong>{' '}quando un tuo cliente accetta un
        preventivo dal link pubblico, registriamo nome del firmatario, data e ora, indirizzo IP,
        tipo di dispositivo/browser ed eventuale firma grafica, a fini di prova dell&rsquo;accordo.</p>
      <p><strong>Recensioni:</strong> valutazioni a stelle e nome puntato (es. «Mario R.») del
        cliente che ha completato e pagato un lavoro.</p>
      <p><strong>Richieste dal marketplace:</strong> se un potenziale cliente ti contatta dalla
        directory pubblica, raccogliamo nome, recapito e descrizione della richiesta e li
        trasmettiamo a te.</p>
      <p><strong>Verifica della partita IVA per la vetrina pubblica:</strong>{' '}quando chiedi di
        pubblicare il tuo profilo nella directory dei professionisti, la tua partita IVA viene
        controllata automaticamente sui registri pubblici: prima sul <strong>VIES</strong>{' '}
        (il servizio della Commissione europea per le partite IVA), e se lì non risulta — cosa
        normale per molti artigiani e forfettari, perché il VIES contiene solo chi opera con
        l&rsquo;estero — sul <strong>Registro Imprese</strong>, tramite il fornitore Openapi S.p.A.
        Viene inviata la sola partita IVA; riceviamo in risposta la conferma che l&rsquo;impresa
        esiste. Serve a evitare che nella vetrina compaiano professionisti inesistenti. Il
        controllo avviene solo se chiedi di pubblicarti: se non usi la vetrina, non viene fatto.</p>
      <p><strong>Dati vocali e immagini per l&rsquo;AI:</strong>{' '}le funzioni di dettatura e di
        lettura dei listini inviano rispettivamente l&rsquo;audio e la foto/PDF a fornitori AI
        per la sola elaborazione; i file non vengono conservati dai fornitori né usati per
        addestrare i loro modelli. L&rsquo;esito dell&rsquo;AI va sempre verificato da te.</p>
      <p><strong>Dati di pagamento:</strong> gestiti direttamente da Stripe; non conserviamo
        i numeri di carta.</p>
      <p><strong>Dati tecnici:</strong> indirizzo IP, tipo di dispositivo/browser, log di
        sicurezza, aperture del link pubblico dei preventivi.</p>
      <p>Non trattiamo «categorie particolari» di dati (salute, opinioni politiche, religione,
        ecc.) ai sensi dell'art. 9 GDPR. Le foto dei lavori non dovrebbero ritrarre persone
        identificabili senza il loro consenso: sei tu a decidere quali caricare e quali rendere
        visibili al cliente.</p>

      <H2>3. Finalità e basi giuridiche</H2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-4 font-semibold">Finalità</th>
              <th className="py-2 font-semibold">Base giuridica</th>
            </tr>
          </thead>
          <tbody className="align-top">
            <tr className="border-b"><td className="py-2 pr-4">Creare e gestire l'account ed erogare il servizio</td><td className="py-2">Esecuzione del contratto (art. 6.1.b)</td></tr>
            <tr className="border-b"><td className="py-2 pr-4">Gestire abbonamento e pagamenti</td><td className="py-2">Esecuzione del contratto (art. 6.1.b)</td></tr>
            <tr className="border-b"><td className="py-2 pr-4">Adempiere a obblighi fiscali e contabili</td><td className="py-2">Obbligo legale (art. 6.1.c)</td></tr>
            <tr className="border-b"><td className="py-2 pr-4">Sicurezza, prevenzione abusi e frodi</td><td className="py-2">Legittimo interesse (art. 6.1.f)</td></tr>
            <tr className="border-b"><td className="py-2 pr-4">Verificare la partita IVA di chi si pubblica nella vetrina pubblica</td><td className="py-2">Esecuzione del contratto (art. 6.1.b) e legittimo interesse a una directory affidabile (art. 6.1.f)</td></tr>
            <tr className="border-b"><td className="py-2 pr-4">Email di servizio</td><td className="py-2">Esecuzione del contratto (art. 6.1.b)</td></tr>
            <tr className="border-b"><td className="py-2 pr-4">Statistiche d&rsquo;uso dell&rsquo;app (per capire cosa funziona e cosa no)</td><td className="py-2">Consenso (art. 6.1.a), revocabile in ogni momento</td></tr>
            <tr><td className="py-2 pr-4">Eventuali comunicazioni commerciali</td><td className="py-2">Consenso (art. 6.1.a), revocabile</td></tr>
          </tbody>
        </table>
      </div>

      <H2>4. Per quanto tempo conserviamo i dati</H2>
      <p>Dati dell'account e documenti: per la durata del rapporto e fino a <Fill>[X]</Fill> dopo
        la chiusura dell'account. Documenti fiscali: per il periodo previsto dalla normativa
        (in genere 10 anni). Documenti nel cestino: eliminati dopo 15 giorni.</p>
      <p>Per la sicurezza teniamo due registri, entrambi con cancellazione automatica:
        il registro degli eventi sospetti (accessi riusciti e falliti, cambi di IBAN o password,
        scaricamenti massivi) si cancella da solo dopo <strong>90 giorni</strong>{' '}e non contiene
        indirizzi IP in chiaro, ma solo un&rsquo;impronta non reversibile che serve a capire se
        le richieste arrivano sempre dalla stessa provenienza; le aperture dei preventivi da parte dei tuoi clienti (data, ora e
        indirizzo IP, che servono come prova dell&rsquo;accettazione) si cancellano dopo
        <strong>12 mesi</strong>.</p>

      <H2>5. A chi comunichiamo i dati</H2>
      <p>Ci avvaliamo di fornitori che agiscono come responsabili del trattamento, con cui
        abbiamo un accordo (DPA):</p>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b">
              <th className="py-2 pr-4 font-semibold">Fornitore</th>
              <th className="py-2 pr-4 font-semibold">Servizio</th>
              <th className="py-2 font-semibold">Dove</th>
            </tr>
          </thead>
          <tbody className="align-top">
            <tr className="border-b"><td className="py-2 pr-4">Supabase / AWS</td><td className="py-2 pr-4">Database e archiviazione</td><td className="py-2">UE (Francoforte)</td></tr>
            <tr className="border-b"><td className="py-2 pr-4">Vercel</td><td className="py-2 pr-4">Hosting</td><td className="py-2">UE (Francoforte)</td></tr>
            <tr className="border-b"><td className="py-2 pr-4">Stripe</td><td className="py-2 pr-4">Pagamenti</td><td className="py-2">UE + USA</td></tr>
            <tr className="border-b"><td className="py-2 pr-4">Resend</td><td className="py-2 pr-4">Invio email</td><td className="py-2">USA</td></tr>
            <tr className="border-b"><td className="py-2 pr-4">Upstash</td><td className="py-2 pr-4">Rate limiting</td><td className="py-2">UE</td></tr>
            <tr className="border-b"><td className="py-2 pr-4">AssemblyAI</td><td className="py-2 pr-4">Trascrizione vocale (dettatura)</td><td className="py-2">USA</td></tr>
            <tr className="border-b"><td className="py-2 pr-4">Mistral AI</td><td className="py-2 pr-4">Lettura AI dei listini (primario)</td><td className="py-2">UE</td></tr>
            <tr className="border-b"><td className="py-2 pr-4">OpenAI</td><td className="py-2 pr-4">Lettura AI dei listini (riserva)</td><td className="py-2">USA</td></tr>
            <tr className="border-b"><td className="py-2 pr-4">Openapi S.p.A.</td><td className="py-2 pr-4">Verifica della partita IVA sul Registro Imprese (solo per chi pubblica il profilo nella vetrina)</td><td className="py-2">UE (Italia)</td></tr>
            <tr className="border-b"><td className="py-2 pr-4">PostHog</td><td className="py-2 pr-4">Statistiche d&rsquo;uso dell&rsquo;app — <strong>solo se acconsenti</strong></td><td className="py-2">UE</td></tr>
            <tr className="border-b"><td className="py-2 pr-4">Sentry</td><td className="py-2 pr-4">Segnalazione degli errori tecnici dell&rsquo;app</td><td className="py-2">USA</td></tr>
            <tr><td className="py-2 pr-4">Cloudflare</td><td className="py-2 pr-4">Verifica anti-bot (&ldquo;captcha&rdquo;) in registrazione e accesso</td><td className="py-2">UE + USA</td></tr>
          </tbody>
        </table>
      </div>
      <p>La verifica della partita IVA passa anche dal <strong>VIES</strong>, il servizio pubblico
        della Commissione europea: non è un nostro fornitore, è un registro pubblico che
        interroghiamo con la sola partita IVA.</p>
      <p>Con la futura attivazione della fatturazione elettronica si aggiungerà il provider del
        Sistema di Interscambio e della conservazione a norma (indicato al momento
        dell&rsquo;attivazione). L&rsquo;elenco aggiornato dei responsabili è disponibile su
        richiesta. Non vendiamo né cediamo i tuoi dati a terzi per finalità di marketing.</p>

      <H2>5-bis. Cookie e statistiche d&rsquo;uso</H2>
      <p>Usiamo i <strong>cookie tecnici</strong>{' '}indispensabili a far funzionare il servizio:
        tengono aperta la tua sessione dopo l&rsquo;accesso, ricordano le preferenze
        dell&rsquo;interfaccia (per esempio il testo grande) e fanno funzionare la verifica
        anti-bot. Per questi non serve il tuo consenso e non si possono disattivare senza
        rendere il servizio inutilizzabile.</p>
      <p>Usiamo poi uno strumento di <strong>statistica d&rsquo;uso</strong> (PostHog, server
        nell&rsquo;Unione Europea) per capire quali funzioni vengono usate e dove le persone si
        bloccano. Questo <strong>parte solo se lo accetti</strong>: alla prima visita compare un
        avviso in cui &ldquo;Rifiuta&rdquo; ha lo stesso peso di &ldquo;Accetta&rdquo;, e finché
        non scegli non viene raccolto nulla. Puoi <strong>cambiare idea quando vuoi</strong>{' '}dal
        collegamento &ldquo;Preferenze cookie&rdquo; in fondo alle pagine legali: la revoca è
        semplice quanto il consenso.</p>
      <p>Non usiamo cookie pubblicitari, non facciamo profilazione a fini di marketing e non
        c&rsquo;è alcun pixel di piattaforme pubblicitarie dentro l&rsquo;applicazione.</p>

      <H2>6. Trasferimenti fuori dall'Unione Europea</H2>
      <p>La maggior parte dei fornitori è nell&rsquo;Unione Europea (Vercel, Supabase, Mistral AI,
        Upstash, PostHog). Alcuni (Stripe, Resend, AssemblyAI, OpenAI, Cloudflare, Sentry) hanno sede negli Stati Uniti: il
        trasferimento avviene sulla base di garanzie adeguate — <strong>EU-US Data Privacy
        Framework</strong> e/o <strong>Clausole Contrattuali Standard</strong> — ai sensi degli
        artt. 44 e seguenti GDPR. Con i fornitori AI è previsto l&rsquo;impegno a non utilizzare
        i dati per l&rsquo;addestramento dei loro modelli.</p>

      <H2>7. I tuoi diritti</H2>
      <p>Hai diritto di accedere ai tuoi dati, rettificarli, cancellarli, limitarne o opporti
        al trattamento, riceverli in formato portabile e revocare il consenso (dove
        applicabile). Per esercitarli scrivi a <Fill>[privacy@cartacanta.app]</Fill>. Puoi
        inoltre proporre reclamo al Garante per la protezione dei dati personali
        (www.garanteprivacy.it).</p>

      <H2>8. Sicurezza</H2>
      <p>Adottiamo misure adeguate: cifratura dei dati a riposo e in transito, isolamento dei
        dati tra account (Row Level Security), controllo degli accessi, autenticazione a due
        fattori sugli accessi amministrativi e log di sicurezza.</p>

      <H2>9. Modifiche</H2>
      <p>Eventuali modifiche saranno pubblicate su questa pagina con la data di aggiornamento.</p>
    </article>
  )
}
