import {
  Body, Container, Head, Heading, Hr, Html,
  Preview, Section, Text, Button,
} from '@react-email/components'

export interface ClientMessageEmailProps {
  /** 'preventivo' | 'fattura' */
  docLabel: string
  docNumber: string | null
  message: string
  /** Link al documento in app */
  docUrl: string
}

/**
 * Avviso all'ARTIGIANO: il cliente ha scritto un messaggio dalla pagina
 * pubblica del documento. Il testo è incluso (il destinatario è la persona
 * a cui il messaggio è indirizzato) e il bottone porta al documento, dove
 * il messaggio compare anche in cronologia.
 */
export function ClientMessageEmail({ docLabel, docNumber, message, docUrl }: ClientMessageEmailProps) {
  const rif = docNumber ? `${docLabel} ${docNumber}` : docLabel
  // Articolo dalla PAROLA (fattura/nota = femminili): «della fattura», non
  // «del fattura» (errore visto da Eli, 25 ago).
  const della = /^(fattur|nota)/i.test(docLabel) ? 'della' : 'del'
  return (
    <Html lang="it">
      <Head />
      <Preview>{`Il cliente ti ha scritto un messaggio sul ${rif}`}</Preview>
      <Body style={{ backgroundColor: '#f6f6f4', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: '28px 24px', margin: '24px auto', maxWidth: 520 }}>
          <Heading style={{ fontSize: 19, color: '#1a1a2e', margin: '0 0 12px' }}>
            Messaggio dal cliente
          </Heading>
          <Text style={{ fontSize: 15, color: '#333', lineHeight: 1.6 }}>
            Il cliente ti ha scritto dalla pagina {della}{' '}<strong>{rif}</strong>:
          </Text>
          <Section style={{ background: '#f7f5f0', borderLeft: '3px solid #c9a44c', borderRadius: 8, padding: '14px 16px', margin: '14px 0' }}>
            <Text style={{ fontSize: 15, color: '#161616', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>
              {message}
            </Text>
          </Section>
          <Section style={{ textAlign: 'center', margin: '22px 0 6px' }}>
            <Button
              href={docUrl}
              style={{ backgroundColor: '#1a1a2e', color: '#ffffff', borderRadius: 10, padding: '12px 22px', fontSize: 14, fontWeight: 600 }}
            >
              Apri il documento
            </Button>
          </Section>
          <Hr style={{ borderColor: '#eeeeee', margin: '20px 0 12px' }} />
          {/* Copy rivista (Eli 25 ago: «rispondi ai recapiti in rubrica»
              creava confusione — la risposta si scrive DALL'APP, nella card
              Messaggi, così il cliente la vede sulla pagina del suo link). */}
          <Text style={{ fontSize: 12, color: '#8a887f', lineHeight: 1.5 }}>
            Per rispondere tocca «Apri il documento»: trovi la conversazione nella
            card Messaggi. La risposta compare al cliente sulla pagina del suo link.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
