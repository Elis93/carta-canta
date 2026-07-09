import {
  Body, Container, Head, Heading, Hr, Html,
  Preview, Section, Text, Button,
} from '@react-email/components'

export interface AccountantInviteEmailProps {
  workspaceName: string
  studioUrl: string
}

// Niente emoji (regola deliverability B.6).
export function AccountantInviteEmail({ workspaceName, studioUrl }: AccountantInviteEmailProps) {
  return (
    <Html lang="it">
      <Head />
      <Preview>{workspaceName} ti ha invitato come commercialista su Carta Canta.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>Carta Canta</Text>
          </Section>
          <Section style={content}>
            <Heading style={h1}>Sei stato invitato come commercialista</Heading>
            <Text style={paragraph}>
              <strong>{workspaceName}</strong> ti ha collegato al suo spazio su Carta Canta.
              Da qui puoi consultare le sue fatture, gli incassi e le spese in <strong>sola lettura</strong>,
              e scaricare il registro delle fatture pronto per la contabilità.
            </Text>
            <Text style={paragraph}>
              Accedi con la <strong>stessa email</strong> a cui hai ricevuto questo messaggio.
              Se non hai ancora un account, creane uno con questa email: ritroverai il cliente
              nella tua area studio.
            </Text>
            <Section style={{ textAlign: 'center', padding: '24px 0 8px' }}>
              <Button href={studioUrl} style={button}>Vai all&rsquo;area studio</Button>
            </Section>
            <Hr style={hr} />
            <Text style={footer}>
              Hai accesso solo ai dati che il cliente decide di condividere e puoi essere
              scollegato in qualsiasi momento. Per assistenza: supporto@cartacanta.app
            </Text>
            <Text style={footer}>
              <a href="https://cartacanta.app" style={link}>Carta Canta</a> · Preventivi e fatture per artigiani
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const body: React.CSSProperties = { backgroundColor: '#f4f4f5', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' }
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }
const header: React.CSSProperties = { backgroundColor: '#1a1a2e', padding: '20px 32px' }
const logo: React.CSSProperties = { color: '#ffffff', fontSize: '20px', fontWeight: '700', margin: '0' }
const content: React.CSSProperties = { padding: '28px 32px 32px' }
const h1: React.CSSProperties = { fontSize: '22px', fontWeight: '700', color: '#111827', margin: '0 0 16px' }
const paragraph: React.CSSProperties = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 12px' }
const button: React.CSSProperties = { backgroundColor: '#1a1a2e', color: '#ffffff', padding: '13px 30px', borderRadius: '8px', fontSize: '15px', fontWeight: '600', textDecoration: 'none', display: 'inline-block' }
const hr: React.CSSProperties = { border: 'none', borderTop: '1px solid #e5e7eb', margin: '24px 0' }
const footer: React.CSSProperties = { fontSize: '12px', color: '#9ca3af', margin: '0 0 8px' }
const link: React.CSSProperties = { color: '#6b7280' }
