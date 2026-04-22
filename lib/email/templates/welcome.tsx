import {
  Body, Container, Head, Heading, Hr, Html,
  Preview, Section, Text, Button,
} from '@react-email/components'

export interface WelcomeEmailProps {
  userName: string
  workspaceName: string
  dashboardUrl: string
}

export function WelcomeEmail({
  userName,
  workspaceName,
  dashboardUrl,
}: WelcomeEmailProps) {
  return (
    <Html lang="it">
      <Head />
      <Preview>Benvenuto in Carta Canta, {userName}! Il tuo workspace è pronto.</Preview>
      <Body style={body}>
        <Container style={container}>

          <Section style={header}>
            <Text style={logo}>Carta Canta</Text>
          </Section>

          <Section style={{ textAlign: 'center', padding: '32px 0 16px' }}>
            <Text style={bigEmoji}>🎉</Text>
          </Section>

          <Section style={content}>
            <Heading style={h1}>Benvenuto, {userName}!</Heading>
            <Text style={paragraph}>
              Il tuo workspace <strong>{workspaceName}</strong> è pronto.
              Puoi iniziare a creare preventivi professionali in pochi secondi.
            </Text>
            <Text style={paragraph}>
              Con il piano Free hai a disposizione:
            </Text>
            <Text style={list}>✅ Fino a 10 preventivi</Text>
            <Text style={list}>✅ 1 template personalizzabile</Text>
            <Text style={list}>✅ PDF professionale</Text>
            <Text style={list}>✅ Link di accettazione digitale per il cliente</Text>

            <Section style={{ textAlign: 'center', padding: '24px 0' }}>
              <Button href={dashboardUrl} style={button}>
                Vai al tuo workspace
              </Button>
            </Section>

            <Hr style={hr} />

            <Text style={footer}>
              Questa email è stata inviata da{' '}
              <a href="https://cartacanta.it" style={link}>Carta Canta</a>{' '}
              · Preventivi professionali per artigiani italiani
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}

// ── Stili inline (React Email richiede stili oggetto) ─────────────────────

const body: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
}

const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  overflow: 'hidden',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
}

const header: React.CSSProperties = {
  backgroundColor: '#1a1a2e',
  padding: '20px 32px',
}

const logo: React.CSSProperties = {
  color: '#ffffff',
  fontSize: '20px',
  fontWeight: '700',
  margin: '0',
}

const bigEmoji: React.CSSProperties = {
  fontSize: '48px',
  lineHeight: '1',
  margin: '0',
}

const content: React.CSSProperties = {
  padding: '0 32px 32px',
}

const h1: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#111827',
  margin: '0 0 16px',
}

const paragraph: React.CSSProperties = {
  fontSize: '15px',
  color: '#374151',
  lineHeight: '1.6',
  margin: '0 0 8px',
}

const list: React.CSSProperties = {
  fontSize: '14px',
  color: '#374151',
  lineHeight: '1.6',
  margin: '0 0 4px',
  paddingLeft: '4px',
}

const button: React.CSSProperties = {
  backgroundColor: '#1a1a2e',
  color: '#ffffff',
  padding: '12px 28px',
  borderRadius: '6px',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'none',
  display: 'inline-block',
}

const hr: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid #e5e7eb',
  margin: '24px 0 16px',
}

const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#9ca3af',
  margin: '0',
}

const link: React.CSSProperties = {
  color: '#6b7280',
}
