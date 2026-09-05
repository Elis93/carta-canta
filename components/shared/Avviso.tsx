import type { CSSProperties, ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Clock, Info } from 'lucide-react'

/**
 * Avviso «Filetto» — L'UNICO modo di dare un avviso in-page nell'app
 * (decisione Eli, 5 set 2026: proposta 1 del mockup «Avvisi senza giallino»).
 *
 * Card bianca + filetto colorato 3px a sinistra + icona nel colore della
 * gravità; il TESTO resta scuro (#161616) e leggibile, il colore dice solo
 * QUANTO è grave. Quattro gravità, quattro colori — gli stessi delle pillole
 * di stato, così l'occhio impara UNA mappa:
 *   info       navy chiaro #3f6fb0   (una cosa da sapere)
 *   attenzione ambra       #b0863e   (scadenze, cose da fare)
 *   errore     rosso       #b05656   (blocchi, cose che non si possono fare)
 *   ok         verde       #2f8a63   (buone notizie: pagata, accettata)
 *
 * Regole d'uso:
 *  - `children` = il fatto, in una riga (con <b> sulla parte che conta);
 *  - `sotto`    = cosa fare (facoltativa, grigia, più piccola);
 *  - `dentro`   = quando l'avviso vive DENTRO un'altra card bianca (SdiCard,
 *    dialog, form): niente ombra e fondo appena caldo, così non sembra una
 *    card nella card.
 * Niente più sfondi gialli/rossi/verdi pieni (`#f5e9d0`, `#f5dede`, `#d4efe2`):
 * quelli restano SOLO alle pillole di stato, che sono un'altra famiglia.
 */
export type AvvisoGravita = 'info' | 'attenzione' | 'errore' | 'ok'

const COLORE: Record<AvvisoGravita, string> = {
  info: '#3f6fb0',
  attenzione: '#b0863e',
  errore: '#b05656',
  ok: '#2f8a63',
}

const ICONA: Record<AvvisoGravita, ReactNode> = {
  info: <Info size={16} />,
  attenzione: <Clock size={16} />,
  errore: <AlertTriangle size={16} />,
  ok: <CheckCircle2 size={16} />,
}

export const AVVISO_SHADOW = '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)'

interface AvvisoProps {
  gravita?: AvvisoGravita
  /** Icona alternativa (16px) — di default quella della gravità. */
  icon?: ReactNode
  /** Il fatto: una riga, con <b> sulla parte che conta. */
  children: ReactNode
  /** Cosa fare: seconda riga grigia (link o testo). */
  sotto?: ReactNode
  /** Dentro un'altra card bianca: niente ombra, fondo appena caldo. */
  dentro?: boolean
  /** Solo su desktop (`hidden lg:flex`): il display lo governa la classe,
   *  non lo stile inline — altrimenti `hidden` non vincerebbe mai. */
  desktopOnly?: boolean
  className?: string
  style?: CSSProperties
  id?: string
  role?: 'alert' | 'status'
}

export function Avviso({ gravita = 'info', icon, children, sotto, dentro, desktopOnly, className, style, id, role }: AvvisoProps) {
  const c = COLORE[gravita]
  const cls = ['cc-avviso', desktopOnly ? 'hidden lg:flex' : null, className].filter(Boolean).join(' ')
  return (
    <div
      id={id}
      role={role}
      className={cls}
      style={{
        background: dentro ? '#faf9f6' : '#fff',
        borderRadius: dentro ? 10 : 14,
        boxShadow: dentro ? 'none' : AVVISO_SHADOW,
        padding: dentro ? '9px 12px 9px 11px' : '11px 14px 11px 13px',
        borderLeft: `3px solid ${c}`,
        display: desktopOnly ? undefined : 'flex',
        gap: 10,
        alignItems: 'flex-start',
        ...style,
      }}
    >
      <span style={{ flex: 'none', color: c, marginTop: 2, display: 'inline-flex' }}>{icon ?? ICONA[gravita]}</span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontSize: 13.5, lineHeight: 1.45, color: '#161616' }}>{children}</div>
        {sotto ? <div style={{ fontSize: 12.5, color: '#55534b', marginTop: 2, lineHeight: 1.45 }}>{sotto}</div> : null}
      </div>
    </div>
  )
}
