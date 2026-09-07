// ============================================================
// SezioneForm — l'etichetta di sezione FUORI dalla card, come in Home
// (riordino 7 set 2026: «tutto in una sola card, difficile capire dove
// inizia uno e finisce l'altro»). Titolo a sinistra, eventuale nota a
// destra (es. il numero di voci), poi la card come figlio.
// ============================================================
export function SezioneForm({
  label,
  right,
  children,
  tourId,
}: {
  label: string
  right?: string | null
  children: React.ReactNode
  tourId?: string
}) {
  return (
    <div data-tour={tourId}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, margin: '0 2px 8px' }}>
        <span className="cc-section-label" style={{ marginBottom: 0 }}>{label}</span>
        {right ? <span className="cc-t-sub" style={{ whiteSpace: 'nowrap' }}>{right}</span> : null}
      </div>
      {children}
    </div>
  )
}
