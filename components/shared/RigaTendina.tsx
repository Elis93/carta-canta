'use client'

import { ChevronDown } from 'lucide-react'

// ============================================================
// RigaTendina — UNA riga a tendina dentro una card del form
// (riordino 7 set 2026, mockup approvato da Eli): etichetta 12
// maiuscola a sinistra, riepilogo 13 grigio a destra, chevron.
// Al tocco si apre SOLO questa riga. È la stessa regola visiva di
// CardTendina, ma per righe impilate nella stessa card (Condizioni e
// allegati del preventivo/fattura).
// ⚠️ I figli restano SEMPRE nel DOM (hidden via className, mai
// smontati): dentro ci sono campi del form — anche non controllati —
// che devono viaggiare nella submit anche a riga chiusa.
// ============================================================
export function RigaTendina({
  id,
  label,
  summary,
  open,
  onToggle,
  last = false,
  lettura = false,
  children,
}: {
  id: string
  label: string
  /** Il valore già leggibile da chiusa («30 giorni», «nessuna»). */
  summary: string
  open: boolean
  onToggle: () => void
  /** Ultima riga della card: niente filetto sotto. */
  last?: boolean
  /**
   * SOLA LETTURA (Eli, 11 set: «deve essere possibile espandersi per
   * visualizzare tutti i dettagli»): la riga si apre e si chiude, ma i campi
   * dentro sono `inert` — si leggono, non si toccano. ⚠️ L'inert sta sul
   * CONTENUTO, mai sull'intero componente: sul form intero bloccava anche
   * questo toggle e i dettagli restavano invisibili.
   */
  lettura?: boolean
  children: React.ReactNode
}) {
  return (
    <div style={{ borderBottom: last ? 'none' : '1px solid #ededea' }}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`riga-${id}`}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '11px 0', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
      >
        {/* Il riepilogo ha la precedenza: prende lo spazio che resta e tiene
            almeno 96px (⚠️ senza il minimo prendeva SOLO l'avanzo — a 320px in
            «Testo grande» restavano 16px e «non indicati» diventava «n…»); se
            la riga è stretta a troncarsi è l'etichetta, non il valore —
            «TEMPI DI ESEC…  non indicati» si capisce. Da aperta il riepilogo
            sparisce, come in CardTendina. */}
        <span className="cc-section-label" style={{ marginBottom: 0, flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {open
          ? <span style={{ flex: 1 }} />
          : (
            <span className="cc-t-sub" style={{ flex: '1 1 0', minWidth: 96, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {summary}
            </span>
          )}
        <ChevronDown size={18} style={{ color: '#1a1a2e', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .18s' }} />
      </button>
      <div id={`riga-${id}`} className={open ? undefined : 'hidden'} style={{ paddingBottom: 14 }} inert={lettura || undefined}>
        {children}
      </div>
    </div>
  )
}
