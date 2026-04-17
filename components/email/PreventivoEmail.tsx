// ============================================================
// CARTA CANTA — PreventivoEmail
// Componente React per il corpo dell'email inviata al cliente.
// Resend renderizza questo componente in HTML prima dell'invio.
// Usa solo JSX con inline styles: nessuna dipendenza da
// @react-email/components (compatibile con qualsiasi Resend SDK).
// ============================================================

interface PreventivoEmailProps {
  /** Ragione sociale / nome workspace mittente */
  senderName: string
  /** Nome del cliente destinatario */
  recipientName: string | null
  /** Numero preventivo es. "001/2026" */
  docNumber: string | null
  /** Totale formattato es. "€ 1.250,00" */
  totalFormatted: string
  /** Messaggio personalizzato dall'utente */
  message: string
  /** URL pubblico del preventivo (se disponibile) */
  publicUrl?: string | null
}

export function PreventivoEmail({
  senderName,
  recipientName,
  docNumber,
  totalFormatted,
  message,
  publicUrl,
}: PreventivoEmailProps) {
  const greeting = recipientName ? `Gentile ${recipientName},` : 'Gentile Cliente,'
  const title = docNumber ? `Preventivo n. ${docNumber}` : 'Preventivo'

  return (
    <div style={{ fontFamily: "'Segoe UI', Arial, sans-serif", background: '#f5f5f5', padding: '32px 0' }}>
      <div style={{
        maxWidth: 600,
        margin: '0 auto',
        background: '#ffffff',
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
      }}>

        {/* Header */}
        <div style={{
          background: '#1a1a2e',
          color: '#ffffff',
          padding: '24px 32px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{senderName}</div>
            <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>{title}</div>
          </div>
          <div style={{
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 6,
            padding: '6px 14px',
            fontSize: 13,
            fontWeight: 600,
          }}>
            {totalFormatted}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '32px' }}>
          <p style={{ fontSize: 15, color: '#111', marginBottom: 16 }}>{greeting}</p>

          {/* Messaggio personalizzato — renderizzato preservando le newline */}
          {message.split('\n').map((line, i) => (
            <p key={i} style={{ fontSize: 14, color: '#333', lineHeight: 1.7, margin: '0 0 8px' }}>
              {line || <span>&nbsp;</span>}
            </p>
          ))}

          {/* Allegato */}
          <div style={{
            margin: '24px 0',
            padding: '16px',
            background: '#f9f9f9',
            borderRadius: 6,
            border: '1px solid #e5e5e5',
            fontSize: 13,
            color: '#555',
          }}>
            📎 Il preventivo in formato PDF è allegato a questa email.
            {publicUrl && (
              <span> Puoi anche visualizzarlo online tramite il link qui sotto.</span>
            )}
          </div>

          {/* CTA link preventivo online */}
          {publicUrl && (
            <div style={{ textAlign: 'center', margin: '24px 0' }}>
              <a
                href={publicUrl}
                style={{
                  display: 'inline-block',
                  background: '#1a1a2e',
                  color: '#ffffff',
                  textDecoration: 'none',
                  padding: '12px 28px',
                  borderRadius: 6,
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                Visualizza preventivo online →
              </a>
            </div>
          )}

          <p style={{ fontSize: 13, color: '#888', marginTop: 24 }}>
            Per qualsiasi domanda, rispondi direttamente a questa email.
          </p>

          <p style={{ fontSize: 14, color: '#333', marginTop: 16 }}>
            Cordiali saluti,<br />
            <strong>{senderName}</strong>
          </p>
        </div>

        {/* Footer */}
        <div style={{
          background: '#f5f5f5',
          borderTop: '1px solid #e5e5e5',
          padding: '16px 32px',
          fontSize: 11,
          color: '#999',
          textAlign: 'center',
        }}>
          Email generata con <a href="https://cartacanta.it" style={{ color: '#666', textDecoration: 'none' }}>Carta Canta</a>
        </div>

      </div>
    </div>
  )
}
