import {
  Body, Container, Head, Heading, Hr, Html,
  Preview, Section, Text, Button,
} from '@react-email/components'

export interface SecurityAlertEmailProps {
  /** Titolo breve: "Coordinate di pagamento modificate" */
  title: string
  /** Frase che descrive il cambiamento, in parole semplici */
  what: string
  /** Data e ora leggibili (Europe/Rome) */
  when: string
  /** Link alla pagina dove si controlla/annulla */
  actionUrl: string
  actionLabel: string
}

/**
 * Avviso di SICUREZZA all'artigiano quando cambia qualcosa che tocca i soldi
 * o l'accesso (IBAN, coordinate di pagamento, password).
 *
 * PERCHÉ ESISTE: per un gestionale di fatture la truffa più redditizia non è
 * rubare i dati, è cambiare l'IBAN su una fattura vera e aspettare il bonifico
 * (frode BEC: 3,05 miliardi di dollari di perdite dichiarate all'FBI nel 2025,
 * ~123.000 $ a caso). Se un account viene compromesso, questa email è ciò che
 * fa scoprire la cosa in dieci minuti invece che dopo il primo pagamento
 * finito altrove. Va inviata ANCHE quando il cambiamento è legittimo: è il
 * fatto di arrivare sempre che la rende utile.
 */
export function SecurityAlertEmail({ title, what, when, actionUrl, actionLabel }: SecurityAlertEmailProps) {
  return (
    <Html lang="it">
      <Head />
      <Preview>{title}</Preview>
      <Body style={{ backgroundColor: '#f6f6f4', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: '28px 24px', margin: '24px auto', maxWidth: 520 }}>
          <Heading style={{ fontSize: 19, color: '#1a1a2e', margin: '0 0 12px' }}>
            {title}
          </Heading>
          <Text style={{ fontSize: 15, color: '#333', lineHeight: 1.6 }}>
            {what}
          </Text>
          <Section style={{ background: '#f7f5f0', borderLeft: '3px solid #c9a44c', borderRadius: 8, padding: '12px 16px', margin: '14px 0' }}>
            <Text style={{ fontSize: 14, color: '#55534b', lineHeight: 1.6, margin: 0 }}>
              Quando: <strong>{when}</strong>
            </Text>
          </Section>
          <Text style={{ fontSize: 15, color: '#333', lineHeight: 1.6 }}>
            <strong>Sei stato tu?</strong> Allora è tutto a posto e puoi ignorare questo messaggio.
          </Text>
          <Text style={{ fontSize: 15, color: '#b05656', lineHeight: 1.6 }}>
            <strong>Non sei stato tu?</strong> Cambia subito la password del tuo account,
            controlla le coordinate di pagamento e scrivici da Aiuto: qualcuno potrebbe essere
            entrato nel tuo account per dirottare i bonifici dei tuoi clienti.
          </Text>
          <Section style={{ textAlign: 'center', margin: '20px 0 6px' }}>
            <Button
              href={actionUrl}
              style={{ backgroundColor: '#1a1a2e', color: '#ffffff', borderRadius: 10, padding: '12px 22px', fontSize: 14, fontWeight: 600 }}
            >
              {actionLabel}
            </Button>
          </Section>
          <Hr style={{ borderColor: '#eeeeee', margin: '22px 0 12px' }} />
          <Text style={{ fontSize: 12, color: '#8a887f', lineHeight: 1.5 }}>
            Ricevi questa email perché è cambiato qualcosa di importante nel tuo account Carta Canta.
            Gli avvisi di sicurezza non si possono disattivare: servono a proteggere i tuoi incassi.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
