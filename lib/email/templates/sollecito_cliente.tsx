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
  /** 'fattura' → copy al femminile e "in attesa di pagamento" */
  docType?: 'preventivo' | 'fattura'
}

export function SollecitoClienteEmail({
  clientName,
  documentTitle,
  documentNumber,
  workspaceName,
  publicUrl,
  docType = 'preventivo',
}: SollecitoClienteEmailProps) {
  const isFattura = docType === 'fattura'
  const docLabel = isFattura ? 'la fattura' : 'il preventivo'
  const docRef = documentNumber
    ? (documentTitle ? `#${documentNumber} — ${documentTitle}` : `#${documentNumber}`)
    : (documentTitle || (isFattura ? 'questa fattura' : 'questo preventivo'))

  return (
    <Html lang="it">
      <Head />
      <Preview>{isFattura
        ? `Promemoria: la fattura di ${workspaceName} è in attesa di pagamento`
        : `Promemoria: il preventivo di ${workspaceName} è ancora in attesa di risposta`}</Preview>
      <Body style={body}>
        <Container style={container}>

          <Section style={header}>
            <Text style={logo}>Carta Canta</Text>
          </Section>


          <Section style={content}>
            <Heading style={h1}>{isFattura ? 'Promemoria fattura' : 'Promemoria preventivo'}</Heading>
            <Text style={paragraph}>
              Gentile <strong>{clientName}</strong>,
            </Text>
            <Text style={paragraph}>
              Le ricordiamo che {docLabel}{' '}
              <strong>{docRef}</strong> {isFattura ? 'inviata' : 'inviato'} da{' '}
              <strong>{workspaceName}</strong> è ancora in attesa
              {isFattura ? ' di pagamento' : ' di una Sua risposta'}.
            </Text>
            <Text style={paragraph}>
              {isFattura
                ? 'Può consultarla dal pulsante qui sotto e procedere al pagamento come concordato. Restiamo a disposizione per qualsiasi chiarimento.'
                : 'Può accettarlo o rifiutarlo direttamente dal pulsante qui sotto. Restiamo a disposizione per qualsiasi chiarimento.'}
            </Text>

            <Section style={{ textAlign: 'center', padding: '8px 0 24px' }}>
              <Button href={publicUrl} style={button}>
                {isFattura ? 'Visualizza la fattura' : 'Visualizza il preventivo'}
              </Button>
            </Section>

            <Hr style={hr} />

            <Text style={footer}>
              Ha ricevuto questo messaggio perché le è {isFattura ? 'stata inviata una fattura' : 'stato inviato un preventivo'} tramite{' '}
              <a href="https://cartacanta.app" style={link}>Carta Canta</a>.
              Se non {isFattura ? 'attendeva alcuna fattura' : 'ha richiesto alcun preventivo'}, può ignorare questo messaggio.
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
