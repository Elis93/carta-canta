import {
  Body, Container, Head, Heading, Hr, Html,
  Preview, Section, Text, Button,
} from '@react-email/components'

export interface SollecitoClienteEmailProps {
  clientName: string
  documentTitle: string
  documentNumber?: string
  workspaceName: string
  publicUrl: string
}

export function SollecitoClienteEmail({
  clientName,
  documentTitle,
  documentNumber,
  workspaceName,
  publicUrl,
}: SollecitoClienteEmailProps) {
  const docRef = documentNumber
    ? `#${documentNumber} — ${documentTitle}`
    : documentTitle

  return (
    <Html lang="it">
      <Head />
      <Preview>{`Promemoria: il preventivo di ${workspaceName} è ancora in attesa di risposta`}</Preview>
      <Body style={body}>
        <Container style={container}>

          <Section style={header}>
            <Text style={logo}>Carta Canta</Text>
          </Section>

          <Section style={{ textAlign: 'center', padding: '32px 0 16px' }}>
            <Text style={bigEmoji}>📋</Text>
          </Section>

          <Section style={content}>
            <Heading style={h1}>Promemoria preventivo</Heading>
            <Text style={paragraph}>
              Gentile <strong>{clientName}</strong>,
            </Text>
            <Text style={paragraph}>
              ti scriviamo per ricordarti che il preventivo{' '}
              <strong>{docRef}</strong> inviato da{' '}
              <strong>{workspaceName}</strong> è ancora in attesa
              di una tua risposta.
            </Text>
            <Text style={paragraph}>
              Puoi accettarlo o rifiutarlo direttamente cliccando
              sul pulsante qui sotto. Per qualsiasi domanda siamo
              a tua disposizione.
            </Text>

            <Section style={{ textAlign: 'center', padding: '8px 0 24px' }}>
              <Button href={publicUrl} style={button}>
                Visualizza il preventivo
              </Button>
            </Section>

            <Hr style={hr} />

            <Text style={footer}>
              Hai ricevuto questa email perché ti è stato inviato un preventivo tramite{' '}
              <a href="https://cartacanta.app" style={link}>Carta Canta</a>.
              Se non hai richiesto nessun preventivo, ignora questa email.
            </Text>
          </Section>

        </Container>
      </Body>
    </Html>
  )
}

const body: React.CSSProperties = {
  backgroundColor: '#f4f4f5',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
}
const container: React.CSSProperties = {
  maxWidth: '560px', margin: '0 auto', backgroundColor: '#ffffff',
  borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
}
const header: React.CSSProperties = { backgroundColor: '#1a1a2e', padding: '20px 32px' }
const logo: React.CSSProperties = { color: '#ffffff', fontSize: '20px', fontWeight: '700', margin: '0' }
const bigEmoji: React.CSSProperties = { fontSize: '48px', lineHeight: '1', margin: '0' }
const content: React.CSSProperties = { padding: '0 32px 32px' }
const h1: React.CSSProperties = { fontSize: '24px', fontWeight: '700', color: '#111827', margin: '0 0 16px' }
const paragraph: React.CSSProperties = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 12px' }
const button: React.CSSProperties = {
  backgroundColor: '#4f46e5', color: '#ffffff', padding: '12px 28px',
  borderRadius: '6px', fontSize: '15px', fontWeight: '600',
  textDecoration: 'none', display: 'inline-block',
}
const hr: React.CSSProperties = { border: 'none', borderTop: '1px solid #e5e7eb', margin: '24px 0 16px' }
const footer: React.CSSProperties = { fontSize: '12px', color: '#9ca3af', margin: '0' }
const link: React.CSSProperties = { color: '#6b7280' }
