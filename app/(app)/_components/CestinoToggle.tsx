import Link from 'next/link'
import { Trash2 } from 'lucide-react'

// ============================================================
// Tasto «Cestino» delle liste Preventivi e Fatture.
//
// PERCHÉ QUI (richiesta Eli, feedback #11 del 14 ago): *"cestino dentro
// Preventivi e Fatture, uno per ognuno come archivio"*. Il cestino vive
// accanto all'Archivio — sono i due posti dove un documento può stare senza
// essere nella lista attiva: l'archivio (senza scadenza) e il cestino (15
// giorni, poi sparisce). Ognuno mostra SOLO i documenti del suo tipo.
//
// Gemello di ArchivioToggle. La differenza: il cestino NON dipende dalla
// migration 075 (usa `deleted_at`, che c'è da sempre) → non è gated su
// `archivioDisponibile`. E non conserva `q`/`sort`: il cestino è una vista a
// sé, con la sua ricerca (nessuna) — tornando alla lista si riparte puliti.
// ============================================================

export function CestinoToggle({ base, attivo, inline = false }: {
  base: '/preventivi' | '/fatture'
  /** true = stai già guardando il cestino: il tasto riporta alla lista */
  attivo: boolean
  /** true = vive DENTRO la barra dei comandi (niente bordo/ombra propri) */
  inline?: boolean
}) {
  return (
    <Link
      href={attivo ? base : `${base}?status=cestino`}
      aria-pressed={attivo}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        background: attivo ? 'var(--cc-navy, #1a1a2e)' : (inline ? 'transparent' : '#fff'),
        border: inline ? 'none' : `1px solid ${attivo ? 'transparent' : '#e7e7ea'}`,
        borderRadius: inline ? 9 : 11,
        padding: inline ? '6px 10px' : '7px 11px',
        boxShadow: inline ? 'none' : (attivo ? '0 2px 6px -2px rgba(26,26,46,.45)' : '0 1px 2px rgba(20,20,40,.05)'),
        fontSize: 13, fontWeight: attivo ? 600 : 400,
        color: attivo ? '#fff' : 'var(--cc-text-2)',
        textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      <Trash2 size={15} aria-hidden />
      Cestino
    </Link>
  )
}
