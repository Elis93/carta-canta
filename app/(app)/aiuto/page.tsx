import Link from 'next/link'
import { Mail, MessageCircleQuestion } from 'lucide-react'
import { BackButton } from '@/components/shared/BackButton'
import { SupportForm } from '@/components/shared/SupportForm'

export const metadata = { title: 'Aiuto e contatti' }

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

const AI_ATTIVA = process.env.NEXT_PUBLIC_AI_IMPORT_ENABLED === 'true'

const FAQ: Array<{ q: string; a: React.ReactNode }> = [
  {
    q: 'Come creo e invio un preventivo?',
    a: <>Dalla Home tocca <b>Nuovo preventivo</b>, scegli (o crea) il cliente, aggiungi le voci — anche
      dettandole col microfono o prendendole dal Catalogo — e tocca <b>Invia al cliente</b>. Il cliente
      riceve un link dove vede il preventivo e può accettarlo con un tocco.</>,
  },
  // Solo se la funzione AI è attiva in produzione (flag)
  ...(AI_ATTIVA ? [{
    q: 'Posso creare il preventivo dalle foto?',
    a: <>Sì: in un nuovo preventivo tocca <b>Proponi le voci dalle foto (AI)</b>, scatta fino a 6 foto
      del lavoro (o riusa quelle del sopralluogo) e l&rsquo;AI propone le voci. I prezzi vengono{' '}
      <b>solo dal tuo catalogo</b>, mai inventati; le pillole sotto ogni voce ti dicono cosa resta
      da inserire. Controlla sempre prima di inviare.</>,
  }] : []),
  {
    q: 'Il cliente come accetta? La firma vale?',
    a: <>Dal link che gli invii, il cliente tocca <b>Accetta e firma</b>{' '}e scrive il suo nome. Vengono registrati
      data, ora e dispositivo: è una firma elettronica semplice, utile come prova dell&rsquo;accordo.
      Tu ricevi subito la notifica.</>,
  },
  {
    q: 'Come segno una fattura come pagata?',
    a: <>Apri la fattura e tocca <b>Segna pagata</b>: puoi indicare l&rsquo;importo ricevuto (anche
      parziale, per gli acconti) e la data. L&rsquo;incasso finisce automaticamente nel Bilancio.</>,
  },
  {
    q: 'Quanti preventivi posso fare col piano gratuito?',
    a: <>Il piano Free include <b>8 preventivi inviati</b> in totale, con tutte le funzioni principali.
      Con <Link href="/abbonamento" style={{ color: '#1a1a2e', fontWeight: 600 }}>Pro</Link> diventano
      illimitati, con template personalizzati e altro.</>,
  },
  {
    q: 'Il preventivo è stato accettato: e ora?',
    a: <>Dal preventivo accettato tocca <b>Apri lavoro</b>: nella sezione <b>Lavori</b>{' '}(in Altro)
      segui il cantiere per stati — da fare, in corso, finito, fatturato — con note, foto e
      l&rsquo;<b>economia del lavoro</b>{' '}(preventivato, speso e margine).</>,
  },
  {
    q: 'Come conto le ore passate in cantiere?',
    a: <>Sul <b>Lavoro</b>{' '}usa il timer <b>Avvia/Ferma</b>{' '}o inserisci le ore a mano. Se imposti
      il <b>costo orario</b>{' '}in Impostazioni › Fiscale, la manodopera entra nello
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
    a: <>A lavoro finito, dal <b>Lavoro</b>{' '}scrivi cosa hai fatto e mandi al cliente un link: lui
      firma dal telefono e tu conservi la <b>prova della consegna</b>{' '}(con data, ora e nome).
      Dopo la firma il testo non si può più modificare.</>,
  },
  {
    q: 'Come funzionano appuntamenti e calendario?',
    a: <>In un <b>sopralluogo</b> imposta il campo <b>Appuntamento</b> (data e ora): lo ritrovi nel
      <b> Calendario</b> (in Altro) con il bottone per avviare la navigazione verso il cantiere.</>,
  },
  {
    q: 'Come calcolo metri quadri, piastrelle o vernice?',
    a: <>Dentro il preventivo, su ogni voce c&rsquo;è <b>Calcola quantità</b>: scrivi le misure e il
      risultato entra da solo nella quantità (con l&rsquo;unità giusta). Lo stesso strumento è in{' '}
      <b>Altro › Strumenti › Calcoli</b>, comodo anche durante il sopralluogo. Per piastrelle e
      vernice controlla sempre le indicazioni della scatola o della latta.</>,
  },
  {
    q: 'Le scritte sono piccole: posso ingrandirle?',
    a: <>Sì: in <b>Altro › Strumenti</b>{' '}attiva <b>Testo grande e leggibile</b> — scritte e
      pulsanti diventano più grandi in tutta l&rsquo;app e sotto le voci dei menu compare una breve
      spiegazione. Si spegne con lo stesso interruttore. Dal computer lo trovi in{' '}
      <b>Impostazioni › Generale</b>.</>,
  },
  {
    q: 'Come mi faccio trovare dai nuovi clienti?',
    a: <>In <b>Altro › Fatti trovare dai clienti</b>{' '}trovi tutto: il tuo <b>profilo pubblico</b>{' '}
      (mestiere, zona, presentazione), le <b>richieste</b>{' '}di chi ti contatta dalla vetrina e le{' '}
      <b>recensioni</b>{' '}dei tuoi clienti.</>,
  },
  {
    q: 'Come collego il mio commercialista?',
    a: <>Da <b>Altro › Account e dati › Il tuo commercialista</b>{' '}inserisci l&rsquo;email dello studio:
      riceve un invito e, accedendo con quella email, vede fatture, incassi e spese in <b>sola
      lettura</b>{' '}e scarica il registro per la contabilità. Puoi revocare l&rsquo;accesso quando vuoi.
      In alternativa scarichi tu il <b>Pacchetto commercialista</b> (da Fatture o da Altro › Account e dati) e glielo mandi.</>,
  },
  {
    q: 'I miei dati dove sono? Posso portarli via?',
    a: <>I dati sono su server in Europa. Da <b>Altro › Account e dati › Scarica i tuoi dati</b>{' '}esporti
      tutto in un file. Per la cancellazione dell&rsquo;account vedi la pagina{' '}
      <Link href="/cancella-account" style={{ color: '#1a1a2e', fontWeight: 600 }}>Cancellazione account</Link>.</>,
  },
]

export default function AiutoPage() {
  return (
    <div className="max-w-3xl mx-auto">
      {/* Header — fascia bianca */}
      <div style={{ background: '#fff', borderBottom: '2px solid #c9a44c', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 15px' }}>
        <BackButton fallback="/altro" />
        <span style={{ flex: 1, fontSize: 18, fontWeight: 600, fontFamily: "Georgia, 'Times New Roman', serif", color: '#1a1a2e' }}>Aiuto e contatti</span>
        <span style={{ width: 24 }} />
      </div>

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
        {FAQ.map((item, i) => (
          <details key={item.q} style={{ borderBottom: i < FAQ.length - 1 ? '0.5px solid #eee' : 'none' }}>
            <summary style={{ padding: '11px 0', fontSize: 14, fontWeight: 600, color: '#161616', cursor: 'pointer', listStyle: 'none', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              {item.q}
              <span aria-hidden style={{ color: '#c2c1bd', flexShrink: 0 }}>▾</span>
            </summary>
            <p style={{ fontSize: 13, color: '#55534b', lineHeight: 1.6, margin: '0 0 12px' }}>{item.a}</p>
          </details>
        ))}
      </div>

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
