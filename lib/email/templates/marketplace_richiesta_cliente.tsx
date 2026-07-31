import {
  Body, Container, Head, Heading, Hr, Html,
  Preview, Text,
} from '@react-email/components'

export interface MarketplaceRichiestaClienteEmailProps {
  /** Nome pubblico del professionista contattato */
  professionalName: string
  customerName: string
  customerCity?: string | null
  /** Testo della richiesta scritto dal cliente */
  message: string
}

/**
 * Riepilogo al CLIENTE che ha inviato una richiesta dalla vetrina
 * (richiesta Eli 29 lug: "deve uscire che la richiesta è andata a buon
 * fine e un riepilogo per mail"). Email transazionale avviata dal
 * cliente stesso; inviata solo se il recapito lasciato è un'email.
 */
export function MarketplaceRichiestaClienteEmail({
  professionalName,
  customerName,
  customerCity,
  message,
}: MarketplaceRichiestaClienteEmailProps) {
  return (
    <Html lang="it">
      <Head />
      <Preview>{`La tua richiesta a ${professionalName} è stata inviata`}</Preview>
      <Body style={{ backgroundColor: '#f6f6f4', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: '28px 24px', margin: '24px auto', maxWidth: 520 }}>
          <Heading style={{ fontSize: 19, color: '#1a1a2e', margin: '0 0 12px' }}>
            Richiesta inviata
          </Heading>
          <Text style={{ fontSize: 15, color: '#333', lineHeight: 1.6 }}>
            Ciao {customerName}, la tua richiesta è arrivata a{' '}
            <strong>{professionalName}</strong>, che ti ricontatterà al recapito
            che hai indicato.
          </Text>
          <Hr style={{ borderColor: '#eeeeee', margin: '16px 0' }} />
          <Text style={{ fontSize: 12, color: '#8a887f', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Il tuo messaggio
          </Text>
          <Text style={{ fontSize: 14, color: '#333', lineHeight: 1.6, whiteSpace: 'pre-wrap' as const, margin: 0 }}>
            {message}
          </Text>
          {customerCity ? (
            <Text style={{ fontSize: 13, color: '#8a887f', lineHeight: 1.5, margin: '8px 0 0' }}>
              Comune indicato: {customerCity}
            </Text>
          ) : null}
          <Hr style={{ borderColor: '#eeeeee', margin: '20px 0 12px' }} />
          <Text style={{ fontSize: 12, color: '#8a887f', lineHeight: 1.5 }}>
            Hai ricevuto questa email perché hai inviato una richiesta dalla
            vetrina dei professionisti di Carta Canta. Carta Canta trasmette la
            richiesta e non è parte del rapporto tra te e il professionista.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
