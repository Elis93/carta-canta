import {
  Body, Container, Head, Heading, Hr, Html,
  Preview, Section, Text, Button,
} from '@react-email/components'

export interface WelcomeEmailProps {
  userName: string
  workspaceName: string
  /** Destinazione del bottone principale — il primo preventivo (attivazione) */
  ctaUrl: string
}

// NB: niente emoji nel subject/body (regola deliverability B.6 — alzano lo spam score).
export function WelcomeEmail({
  userName,
  workspaceName,
  ctaUrl,
}: WelcomeEmailProps) {
  return (
    <Html lang="it">
      <Head />
      <Preview>Il tuo spazio {workspaceName} è pronto: crea il primo preventivo in 60 secondi.</Preview>
      <Body style={body}>
        <Container style={container}>

          <Section style={header}>
            <Text style={logo}>Carta Canta</Text>
          </Section>

          <Section style={content}>
            <Heading style={h1}>Benvenuto, {userName}</Heading>
            <Text style={paragraph}>
              Il tuo spazio <strong>{workspaceName}</strong> è pronto. Da qui gestisci
              preventivi, fatture, clienti e lavori — tutto dal telefono, anche in cantiere.
            </Text>

            <Text style={paragraph}>
              Il modo più veloce per iniziare è creare subito il primo preventivo:
              detti le voci col microfono, invii il link al cliente e lui firma con un tocco.
            </Text>

            <Section style={{ textAlign: 'center', padding: '24px 0 8px' }}>
              <Button href={ctaUrl} style={button}>
                Crea il primo preventivo
              </Button>
            </Section>

            <Text style={smallCenter}>
              Durante la beta è tutto gratuito, senza carta di credito.
            </Text>

            <Hr style={hr} />

            <Text style={h2}>Con il piano gratuito hai:</Text>
            <Text style={list}>— 8 preventivi</Text>
            <Text style={list}>— PDF professionale con il tuo logo</Text>
            <Text style={list}>— Link di accettazione con firma del cliente</Text>
            <Text style={list}>— Clienti, catalogo e bilancio di base</Text>

            <Hr style={hr} />

            <Text style={paragraph}>
              Se hai bisogno di aiuto, scrivici a{' '}
              <a href="mailto:supporto@cartacanta.app" style={link}>supporto@cartacanta.app</a>:
              rispondiamo noi.
            </Text>

            <Text style={footer}>
              <a href="https://cartacanta.app" style={footerLink}>Carta Canta</a>{' '}
              · Preventivi e fatture per artigiani italiani
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

const content: React.CSSProperties = {
  padding: '28px 32px 32px',
}

const h1: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: '700',
  color: '#111827',
  margin: '0 0 16px',
}

const h2: React.CSSProperties = {
  fontSize: '15px',
  fontWeight: '700',
  color: '#111827',
  margin: '0 0 8px',
}

const paragraph: React.CSSProperties = {
  fontSize: '15px',
  color: '#374151',
  lineHeight: '1.6',
  margin: '0 0 12px',
}

const smallCenter: React.CSSProperties = {
  fontSize: '13px',
  color: '#6b7280',
  textAlign: 'center',
  margin: '0',
}

const list: React.CSSProperties = {
  fontSize: '14px',
  color: '#374151',
  lineHeight: '1.7',
  margin: '0',
}

const button: React.CSSProperties = {
  backgroundColor: '#1a1a2e',
  color: '#ffffff',
  padding: '13px 30px',
  borderRadius: '8px',
  fontSize: '15px',
  fontWeight: '600',
  textDecoration: 'none',
  display: 'inline-block',
}

const hr: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid #e5e7eb',
  margin: '24px 0',
}

const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#9ca3af',
  margin: '16px 0 0',
}

const link: React.CSSProperties = {
  color: '#1a1a2e',
  fontWeight: 600,
}

const footerLink: React.CSSProperties = {
  color: '#6b7280',
}
