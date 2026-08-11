import {
  Body, Container, Head, Heading, Hr, Html,
  Preview, Section, Text, Button,
} from '@react-email/components'

export interface SdiAutoFallitaEmailProps {
  docNumber: string
  motivo: string | null
  appUrl: string
  documentId: string
}

/** Il pilota automatico SdI ha mollato la presa su una fattura (review
 *  11 ago): il fallimento NON deve essere silenzioso — è la lamentela n.1
 *  sui competitor. L'email dice cosa fare: trasmetterla a mano. */
export function SdiAutoFallitaEmail({ docNumber, motivo, appUrl, documentId }: SdiAutoFallitaEmailProps) {
  return (
    <Html lang="it">
      <Head />
      <Preview>{`La trasmissione automatica della fattura ${docNumber} non è riuscita`}</Preview>
      <Body style={{ backgroundColor: '#f6f6f4', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: '28px 24px', margin: '24px auto', maxWidth: 520 }}>
          <Heading style={{ fontSize: 19, color: '#1a1a2e', margin: '0 0 12px' }}>
            Fattura {docNumber}: la trasmissione automatica non è riuscita
          </Heading>
          <Text style={{ fontSize: 15, color: '#333', lineHeight: 1.6 }}>
            La fattura era programmata per partire da sola verso il Sistema di
            Interscambio, ma l&rsquo;invio non è andato a buon fine.
            {motivo ? <> Motivo: <strong>{motivo}</strong>.</> : null}
            {' '}Per prudenza non riproviamo da soli: <strong>trasmettila tu</strong>,
            con un tocco, dalla pagina della fattura.
          </Text>
          <Section style={{ textAlign: 'center', margin: '22px 0 6px' }}>
            <Button
              href={`${appUrl}/fatture/${documentId}`}
              style={{ backgroundColor: '#1a1a2e', color: '#ffffff', borderRadius: 10, padding: '12px 22px', fontSize: 14, fontWeight: 600 }}
            >
              Apri la fattura
            </Button>
          </Section>
          <Hr style={{ borderColor: '#eeeeee', margin: '20px 0 12px' }} />
          <Text style={{ fontSize: 12, color: '#8a887f', lineHeight: 1.5 }}>
            Nessun invio è partito: la fattura non risulta trasmessa. Sulla sua
            pagina trovi il conto alla rovescia dei 12 giorni e, se serve, la
            spiegazione dell&rsquo;errore.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
