'use client'

// ============================================================
// SpiegaCampo — il punto ⓘ accanto all'etichetta di un campo.
//
// PERCHÉ (Eli, 9 ago 2026): *"in impostazioni-generale ci sono alcune voci
// che hanno la spiegazione subito sotto la sezione. Preferisco che queste
// spiegazioni siano inserite in un tasto tondo con punto di domanda … che
// cliccandoci sopra spiega cosa sono"*.
//
// Una spiegazione sempre aperta sotto ogni campo raddoppia l'altezza della
// pagina e si legge ogni volta anche quando non serve più: dopo la prima
// settimana è solo rumore fra un campo e l'altro. Chiusa, la pagina torna
// una lista di campi; chi ha un dubbio tocca il punto e trova la risposta
// esattamente lì, senza cambiare schermata.
//
// ⚠️ Stessa grafica e stesso comportamento del punto ⓘ della card SdI, che
// Eli aveva già approvato il 2 agosto: il tondo è bordato e grigio, la
// spiegazione compare in un riquadro crema sotto il campo.
//
// ⚠️ Il `title` di un elemento NON esiste sul telefono, e l'app si usa da lì:
// la spiegazione deve aprirsi al TOCCO, non al passaggio del mouse.
// ============================================================

import { useId, useState } from 'react'
import { Info } from 'lucide-react'

export function SpiegaCampo({
  etichetta,
  children,
  style,
}: {
  /** Il testo dell'etichetta del campo, mostrato accanto al punto. */
  etichetta: React.ReactNode
  /** La spiegazione: compare solo dopo il tocco. */
  children: React.ReactNode
  /** Stile dell'etichetta (di solito `fieldLabelStyle` della pagina). */
  style?: React.CSSProperties
}) {
  const [aperto, setAperto] = useState(false)
  const id = useId()

  return (
    <>
      <div style={{ ...style, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        <span>{etichetta}</span>
        <button
          type="button"
          onClick={() => setAperto((v) => !v)}
          aria-expanded={aperto}
          aria-controls={id}
          aria-label={aperto ? 'Nascondi la spiegazione' : 'Cosa vuol dire?'}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
            border: '1px solid #d9d7d0', background: aperto ? '#f2f2f4' : '#fff',
            color: '#6f6d64', cursor: 'pointer', padding: 0,
          }}
        >
          <Info size={13} />
        </button>
      </div>
      {aperto && (
        <div
          id={id}
          style={{
            background: '#f7f6f2', border: '1px solid #e8e6e0', borderRadius: 10,
            padding: '10px 12px', margin: '2px 0 8px',
            fontSize: 12.5, color: '#3f3d36', lineHeight: 1.55,
          }}
        >
          {children}
        </div>
      )}
    </>
  )
}
