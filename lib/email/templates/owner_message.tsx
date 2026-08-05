import {
  Body, Container, Head, Heading, Hr, Html,
  Preview, Section, Text, Button,
} from '@react-email/components'

export interface OwnerMessageEmailProps {
  workspaceName: string
  /** 'preventivo' | 'fattura' */
  docLabel: string
  docNumber: string | null
  message: string
  /** Link alla pagina pubblica del documento (dove c'è la conversazione) */
  publicUrl: string
}

/**
 * Avviso al CLIENTE: l'artigiano ha risposto al messaggio che il cliente
 * stesso aveva scritto dalla pagina del documento.
 *
 * È l'UNICO modo che il cliente ha per accorgersene (non ha l'app e non è
 * registrato), quindi il testo della risposta è dentro l'email: chi legge
 * dalla posta ha già l'informazione, il link serve per rispondere ancora.
 * Email transazionale in risposta a un contatto iniziato dal cliente.
 */
export function OwnerMessageEmail({ workspaceName, docLabel, docNumber, message, publicUrl }: OwnerMessageEmailProps) {
  const rif = docNumber ? `${docLabel} ${docNumber}` : docLabel
  return (
    <Html lang="it">
      <Head />
      <Preview>{`${workspaceName} ha risposto al tuo messaggio`}</Preview>
      <Body style={{ backgroundColor: '#f6f6f4', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: '28px 24px', margin: '24px auto', maxWidth: 520 }}>
          <Heading style={{ fontSize: 19, color: '#1a1a2e', margin: '0 0 12px' }}>
            {workspaceName} ti ha risposto
          </Heading>
          <Text style={{ fontSize: 15, color: '#333', lineHeight: 1.6 }}>
            Ecco la risposta al messaggio che hai scritto sul{' '}<strong>{rif}</strong>:
          </Text>
          <Section style={{ background: '#f7f5f0', borderLeft: '3px solid #c9a44c', borderRadius: 8, padding: '14px 16px', margin: '14px 0' }}>
            <Text style={{ fontSize: 15, color: '#161616', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
              {message}
            </Text>
          </Section>
          <Text style={{ fontSize: 14, color: '#55534b', lineHeight: 1.6 }}>
            Se vuoi rispondere, apri la pagina del documento: trovi lì tutta la conversazione.
          </Text>
          <Section style={{ textAlign: 'center', margin: '20px 0 6px' }}>
            <Button
              href={publicUrl}
              style={{ backgroundColor: '#1a1a2e', color: '#ffffff', borderRadius: 10, padding: '12px 22px', fontSize: 14, fontWeight: 600 }}
            >
              Apri e rispondi
            </Button>
          </Section>
          <Hr style={{ borderColor: '#eeeeee', margin: '22px 0 12px' }} />
          <Text style={{ fontSize: 12, color: '#8a887f', lineHeight: 1.5 }}>
            Ricevi questa email perché hai scritto un messaggio dalla pagina del {docLabel} di {workspaceName}.
            Documento generato con Carta Canta.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
