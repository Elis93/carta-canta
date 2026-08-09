// ============================================================
// Conferma di accettazione AL CLIENTE (richiesta Eli, 9 ago 2026:
// *"contemporaneamente deve partire un mail con le stesse informazioni
// al cliente"*).
//
// ⚠️ È la RICEVUTA di un gesto che il cliente ha appena fatto — non una
// comunicazione commerciale: gli conferma cosa ha accettato, per quanto e
// quando, e gli lascia il link per rileggerlo. Per questo dà del **Lei**
// come le altre email dirette al cliente finale (bonifica 7 ago), e non
// contiene inviti, offerte o richiami.
//
// 🔒 Nessun costo, ricarico o margine: è una superficie vista dal cliente
// (regola B.2).
// ============================================================

import {
  Body, Container, Head, Heading, Hr, Html,
  Preview, Section, Text, Button, Row, Column,
} from '@react-email/components'

export interface PreventivoAccettatoClienteEmailProps {
  workspaceName: string
  signerName: string
  documentTitle: string
  documentNumber?: string
  /** Proposta scelta ("Base"/"Premium") — solo con più proposte */
  tierLabel?: string | null
  /** Totale già formattato in euro */
  totale?: string | null
  acceptedAt: string
  documentUrl: string
}

export function PreventivoAccettatoClienteEmail({
  workspaceName,
  signerName,
  documentTitle,
  documentNumber,
  tierLabel,
  totale,
  acceptedAt,
  documentUrl,
}: PreventivoAccettatoClienteEmailProps) {
  const docRef = documentNumber ? `${documentNumber} — ${documentTitle}` : documentTitle

  return (
    <Html lang="it">
      <Head />
      <Preview>Conferma: ha accettato il preventivo di {workspaceName}</Preview>
      <Body style={body}>
        <Container style={container}>
          <Section style={header}>
            <Text style={logo}>Carta Canta</Text>
          </Section>

          <Section style={content}>
            <Heading style={h1}>Preventivo accettato</Heading>
            <Text style={paragraph}>
              Gentile <strong>{signerName}</strong>,
            </Text>
            <Text style={paragraph}>
              le confermiamo che ha accettato il preventivo <strong>{docRef}</strong> di{' '}
              <strong>{workspaceName}</strong>. Qui sotto trova il riepilogo; questa email
              le serve da ricevuta.
            </Text>

            <Section style={infoBox}>
              {documentNumber && (
                <Row>
                  <Column style={infoLabel}>Preventivo</Column>
                  <Column style={infoValue}>{documentNumber}</Column>
                </Row>
              )}
              {tierLabel && (
                <Row>
                  <Column style={infoLabel}>Proposta scelta</Column>
                  <Column style={infoValue}>{tierLabel}</Column>
                </Row>
              )}
              {totale && (
                <Row>
                  <Column style={infoLabel}>Totale</Column>
                  <Column style={infoValue}>{totale}</Column>
                </Row>
              )}
              <Row>
                <Column style={infoLabel}>Accettato il</Column>
                <Column style={infoValue}>{acceptedAt}</Column>
              </Row>
              <Row>
                <Column style={infoLabel}>Firmato da</Column>
                <Column style={infoValue}>{signerName}</Column>
              </Row>
            </Section>

            <Text style={paragraph}>
              Il preventivo resta consultabile da questo collegamento, con la data di
              accettazione:
            </Text>

            <Section style={{ textAlign: 'center', padding: '8px 0 24px' }}>
              <Button href={documentUrl} style={button}>
                Rivedi il preventivo
              </Button>
            </Section>

            <Text style={paragraph}>
              <strong>{workspaceName}</strong> la contatterà a breve per i passi successivi.
              Per qualsiasi domanda può rispondere a questa email.
            </Text>

            <Hr style={hr} />

            <Text style={footer}>
              Preventivo gestito con{' '}
              <a href="https://cartacanta.app" style={link}>Carta Canta</a>
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

const header: React.CSSProperties = { backgroundColor: '#1a1a2e', padding: '20px 32px' }
const logo: React.CSSProperties = { color: '#ffffff', fontSize: '20px', fontWeight: '700', margin: '0' }
const content: React.CSSProperties = { padding: '0 32px 32px' }
const h1: React.CSSProperties = { fontSize: '24px', fontWeight: '700', color: '#111827', margin: '0 0 16px' }
const paragraph: React.CSSProperties = { fontSize: '15px', color: '#374151', lineHeight: '1.6', margin: '0 0 12px' }

const infoBox: React.CSSProperties = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '6px',
  padding: '14px 16px',
  margin: '4px 0 20px',
}

const infoLabel: React.CSSProperties = { fontSize: '13px', color: '#6b7280', padding: '4px 0', width: '42%' }
const infoValue: React.CSSProperties = { fontSize: '14px', color: '#111827', fontWeight: '600', padding: '4px 0', textAlign: 'right' }

const button: React.CSSProperties = {
  backgroundColor: '#1a1a2e',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600',
  padding: '13px 26px',
  borderRadius: '8px',
  textDecoration: 'none',
  display: 'inline-block',
}

const hr: React.CSSProperties = { borderColor: '#e5e7eb', margin: '20px 0 14px' }
const footer: React.CSSProperties = { fontSize: '12px', color: '#9ca3af', lineHeight: '1.5', margin: '0' }
const link: React.CSSProperties = { color: '#6b7280', textDecoration: 'underline' }
