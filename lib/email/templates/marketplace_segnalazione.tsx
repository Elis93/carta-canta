import {
  Body, Container, Head, Heading, Hr, Html, Preview, Section, Text,
} from '@react-email/components'

export interface MarketplaceSegnalazioneEmailProps {
  profileName: string
  workspaceId: string
  reason: string
  reporterContact: string | null
  profileUrl: string
}

// Email interna verso segnalazioni@ — notice-and-takedown DSA.
// Niente emoji (regola B.6). Contiene i dati minimi per valutare la rimozione.
export function MarketplaceSegnalazioneEmail({
  profileName, workspaceId, reason, reporterContact, profileUrl,
}: MarketplaceSegnalazioneEmailProps) {
  return (
    <Html lang="it">
      <Head />
      <Preview>Segnalazione profilo: {profileName}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={content}>
            <Heading style={h1}>Segnalazione profilo marketplace</Heading>
            <Text style={meta}>
              Profilo: <strong>{profileName}</strong><br />
              ID workspace: {workspaceId}<br />
              Pagina: {profileUrl}<br />
              Contatto di chi segnala: {reporterContact || 'non fornito'}
            </Text>
            <Hr style={hr} />
            <Text style={paragraph}>{reason}</Text>
            <Hr style={hr} />
            <Text style={footer}>
              Valutare la segnalazione e, se il contenuto è manifestamente
              illecito, rimuovere/oscurare il profilo (procedura notice-and-takedown).
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
const meta: React.CSSProperties = { fontSize: '13px', color: '#6b7280', margin: '0 0 8px', lineHeight: '1.6' }
const paragraph: React.CSSProperties = { fontSize: '15px', color: '#111827', lineHeight: '1.6', whiteSpace: 'pre-wrap', margin: '0' }
const hr: React.CSSProperties = { border: 'none', borderTop: '1px solid #e5e7eb', margin: '14px 0' }
const footer: React.CSSProperties = { fontSize: '12px', color: '#9ca3af', margin: '0' }
