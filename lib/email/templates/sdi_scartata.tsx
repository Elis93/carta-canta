import {
  Body, Container, Head, Heading, Hr, Html,
  Preview, Section, Text, Button,
} from '@react-email/components'

export interface SdiScartataEmailProps {
  docNumber: string
  motivo: string | null
  appUrl: string
  documentId: string
}

/** Fattura scartata dallo SdI → avviso in app + EMAIL (decisione Eli). */
export function SdiScartataEmail({ docNumber, motivo, appUrl, documentId }: SdiScartataEmailProps) {
  return (
    <Html lang="it">
      <Head />
      <Preview>{`La fattura ${docNumber} è stata scartata dallo SdI`}</Preview>
      <Body style={{ backgroundColor: '#f6f6f4', fontFamily: 'Helvetica, Arial, sans-serif' }}>
        <Container style={{ backgroundColor: '#ffffff', borderRadius: 12, padding: '28px 24px', margin: '24px auto', maxWidth: 520 }}>
          <Heading style={{ fontSize: 19, color: '#1a1a2e', margin: '0 0 12px' }}>
            Fattura {docNumber} scartata dallo SdI
          </Heading>
          <Text style={{ fontSize: 15, color: '#333', lineHeight: 1.6 }}>
            Il Sistema di Interscambio ha scartato la fattura.
            {motivo ? <> Motivo: <strong>{motivo}</strong>.</> : null}
            {' '}Correggi i dati e reinviala: bastano pochi minuti.
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
            Uno scarto non è un problema fiscale: la fattura si considera non emessa
            e puoi ritrasmetterla correttamente. Trovi il motivo dello scarto anche
            nell&rsquo;app, sulla fattura.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
