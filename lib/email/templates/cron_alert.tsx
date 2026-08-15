import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'

export interface CronAlertEmailProps {
  /** I cron risultati fermi: nome tecnico, etichetta leggibile, ultimo successo, ore di ritardo */
  stale: { name: string; label: string; lastOk: string | null; ageHours: number | null }[]
}

// Email INTERNA verso supporto@ — avvisa che un lavoro automatico (cron) non
// gira più. Niente emoji (regola B.6). Il destinatario è l'operatore, non un
// utente: qui il tono è tecnico e diretto.
export function CronAlertEmail({ stale }: CronAlertEmailProps) {
  return (
    <Html lang="it">
      <Head />
      <Preview>Un lavoro automatico di Carta Canta non gira</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={content}>
            <Heading style={h1}>Cron fermo</Heading>
            <Text style={paragraph}>
              Il controllo di stato ha trovato {stale.length}{' '}
              {stale.length === 1 ? 'lavoro automatico che non risulta' : 'lavori automatici che non risultano'}{' '}
              completato di recente. Vanno verificati su Vercel (Logs) e, se serve, riavviati.
            </Text>
            <Hr style={hr} />
            {stale.map((s) => (
              <Text key={s.name} style={item}>
                <strong>{s.label}</strong><br />
                {s.lastOk
                  ? <>Ultimo giro riuscito: {new Date(s.lastOk).toLocaleString('it-IT')} ({Math.round(s.ageHours ?? 0)} ore fa)</>
                  : <>Nessun giro riuscito registrato.</>}
              </Text>
            ))}
            <Hr style={hr} />
            <Text style={footer}>
              Controllo automatico (heartbeat) di Carta Canta. Se il problema è
              gia risolto, il prossimo controllo non inviera nulla.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const body: React.CSSProperties = { backgroundColor: '#f5f4ef', fontFamily: 'Arial, Helvetica, sans-serif', margin: 0, padding: '24px 0' }
const container: React.CSSProperties = { maxWidth: 560, margin: '0 auto' }
const content: React.CSSProperties = { backgroundColor: '#ffffff', borderRadius: 12, padding: '28px 28px 20px' }
const h1: React.CSSProperties = { fontSize: 20, fontWeight: 700, color: '#1a1a2e', margin: '0 0 12px' }
const paragraph: React.CSSProperties = { fontSize: 15, lineHeight: 1.6, color: '#33322e', margin: '0 0 6px' }
const item: React.CSSProperties = { fontSize: 14, lineHeight: 1.6, color: '#33322e', margin: '0 0 12px' }
const hr: React.CSSProperties = { borderColor: '#e6e4dd', margin: '18px 0' }
const footer: React.CSSProperties = { fontSize: 12, lineHeight: 1.5, color: '#8a887f', margin: 0 }
