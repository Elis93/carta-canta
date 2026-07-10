import {
  Body, Container, Head, Heading, Hr, Html,
  Preview, Section, Text, Button,
} from '@react-email/components'

export interface StudioClientInviteEmailProps {
  studioEmail: string
  signupUrl: string
}

// Invito inverso: lo studio invita un suo cliente artigiano.
// Niente emoji (regola deliverability B.6). Claim conformi: beta gratuita,
// MAI "gratis per sempre".
export function StudioClientInviteEmail({ studioEmail, signupUrl }: StudioClientInviteEmailProps) {
  return (
    <Html lang="it">
      <Head />
      <Preview>Il tuo commercialista ti consiglia Carta Canta per preventivi e fatture.</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>Carta Canta</Text>
          </Section>
          <Section style={content}>
            <Heading style={h1}>Il tuo commercialista ti consiglia Carta Canta</Heading>
            <Text style={paragraph}>
              Il tuo studio (<strong>{studioEmail}</strong>) usa Carta Canta con i suoi clienti
              e ti invita a provarla: preventivi professionali dal telefono in un minuto,
              fatture, incassi e spese sempre in ordine.
            </Text>
            <Text style={paragraph}>
              Per il tuo studio è un vantaggio anche pratico: se decidi di collegarlo
              (si fa in un tocco, dalle Impostazioni), vede i tuoi documenti in sola lettura
              e scarica da solo quello che gli serve per la contabilità — senza scambi di
              scatole di scontrini a fine anno.
            </Text>
            <Section style={{ textAlign: 'center', padding: '24px 0 8px' }}>
              <Button href={signupUrl} style={button}>Prova Carta Canta</Button>
            </Section>
            <Hr style={hr} />
            <Text style={footer}>
              La registrazione è gratuita. Sarai sempre tu a decidere se e cosa condividere
              con il tuo commercialista, e puoi scollegarlo in qualsiasi momento.
              Per assistenza: supporto@cartacanta.app
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
