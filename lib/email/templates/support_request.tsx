import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'

export interface SupportRequestEmailProps {
  message: string
  userEmail: string
  userName: string | null
  workspaceName: string | null
  plan: string | null
}

// Email interna verso supporto@ — niente emoji (regola B.6).
export function SupportRequestEmail({ message, userEmail, userName, workspaceName, plan }: SupportRequestEmailProps) {
  return (
    <Html lang="it">
      <Head />
      <Preview>Nuova richiesta di aiuto da {userEmail}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={content}>
            <Heading style={h1}>Richiesta di aiuto</Heading>
            <Text style={meta}>
              Da: <strong>{userName || userEmail}</strong> ({userEmail})
              {workspaceName ? <> · Attività: <strong>{workspaceName}</strong></> : null}
              {plan ? <> · Piano: {plan}</> : null}
            </Text>
            <Hr style={hr} />
            <Text style={paragraph}>{message}</Text>
            <Hr style={hr} />
            <Text style={footer}>
              Rispondi direttamente a questa email: il reply-to è impostato
              sull&rsquo;indirizzo dell&rsquo;utente.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

const body: React.CSSProperties = { backgroundColor: '#f4f4f5', fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif' }
const container: React.CSSProperties = { maxWidth: '560px', margin: '0 auto', backgroundColor: '#ffffff', borderRadius: '8px', overflow: 'hidden' }
const content: React.CSSProperties = { padding: '24px 28px' }
const h1: React.CSSProperties = { fontSize: '20px', fontWeight: '700', color: '#111827', margin: '0 0 10px' }
const meta: React.CSSProperties = { fontSize: '13px', color: '#6b7280', margin: '0 0 8px' }
const paragraph: React.CSSProperties = { fontSize: '15px', color: '#111827', lineHeight: '1.6', whiteSpace: 'pre-wrap', margin: '0' }
const hr: React.CSSProperties = { border: 'none', borderTop: '1px solid #e5e7eb', margin: '14px 0' }
const footer: React.CSSProperties = { fontSize: '12px', color: '#9ca3af', margin: '0' }
