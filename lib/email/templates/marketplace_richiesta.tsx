import {
  Body, Container, Head, Heading, Hr, Html,
  Preview, Section, Text, Button,
} from '@react-email/components'

export interface MarketplaceRichiestaEmailProps {
  /** Nome puntato del cliente, es. "Mario R." */
  customerName: string
  customerCity?: string | null
  appUrl: string
}

/**
 * Email di avviso "Nuova richiesta dal marketplace" — per riservatezza
 * NON contiene i dettagli della richiesta (decisione Eli): dice solo CHI
 * ha contattato, col bottone "Apri la richiesta nell'app".
 */
export function MarketplaceRichiestaEmail({
  customerName,
  customerCity,
  appUrl,
}: MarketplaceRichiestaEmailProps) {
  const who = customerCity ? `${customerName} di ${customerCity}` : customerName
  return (
    <Html lang="it">
      <Head />
      <Preview>{`${who} ti ha contattato su Carta Canta`}</Preview>
      <Body style={{ backgroundColor: '#f6f6f4', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: '28px 24px', margin: '24px auto', maxWidth: 520 }}>
          <Heading style={{ fontSize: 19, color: '#1a1a2e', margin: '0 0 12px' }}>
            Nuova richiesta dal marketplace
          </Heading>
          <Text style={{ fontSize: 15, color: '#333', lineHeight: 1.6 }}>
            Ciao, <strong>{who}</strong> ti ha contattato su Carta Canta.
          </Text>
          <Section style={{ textAlign: 'center', margin: '22px 0 6px' }}>
            <Button
              href={`${appUrl}/richieste`}
              style={{ backgroundColor: '#1a1a2e', color: '#ffffff', borderRadius: 10, padding: '12px 22px', fontSize: 14, fontWeight: 600 }}
            >
              Apri la richiesta nell&rsquo;app
            </Button>
          </Section>
          <Hr style={{ borderColor: '#eeeeee', margin: '20px 0 12px' }} />
          <Text style={{ fontSize: 12, color: '#8a887f', lineHeight: 1.5 }}>
            Per riservatezza questa email non contiene i dettagli della richiesta:
            li trovi nell&rsquo;app, in Altro &rsaquo; Vetrina &rsaquo; Richieste.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
