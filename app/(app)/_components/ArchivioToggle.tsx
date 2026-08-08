import Link from 'next/link'
import { Archive } from 'lucide-react'

// ============================================================
// Tasto «Archivio» delle liste Preventivi e Fatture.
//
// PERCHÉ È FUORI DALLA BARRA DELLE PILLOLE (scelta di Eli, 8 ago, dal mockup —
// opzione C): con sei pillole la riga non ci sta più su nessun telefono. A
// 390px ne servivano 409 di larghezza su 358 disponibili; stringendole si
// pareggiava solo sul suo telefono e solo a testo normale — su uno schermo da
// 360px, o in «Testo grande», sarebbe tornata a scorrere.
//
// Ma il motivo vero non è di spazio: **«Archiviati» non è uno stato del
// documento**. «Rifiutati» e «Accettati» dicono com'è andata col cliente;
// l'archivio dice dove l'hai messo tu. Nella stessa fila sembrava un esito del
// preventivo.
//
// Sta a SINISTRA della riga (richiesta di Eli: *"mettiamolo a sinistra invece
// che a destra, lì c'è già l'ordina"*).
// ============================================================

export function ArchivioToggle({ base, attivo, q, sort, inline = false }: {
  base: '/preventivi' | '/fatture'
  /** true = stai già guardando l'archivio: il tasto riporta alla lista */
  attivo: boolean
  q?: string
  sort?: string
  /** true = vive DENTRO la barra dei comandi: niente bordo e niente ombra
      proprie, così i due comandi sono una superficie sola e non due. */
  inline?: boolean
}) {
  // I parametri che l'utente ha impostato sopravvivono al passaggio (una
  // ricerca in corso non deve azzerarsi entrando o uscendo dall'archivio);
  // `page` no, perché la pagina 3 di una lista non esiste nell'altra.
  const sp = new URLSearchParams()
  if (q) sp.set('q', q)
  if (sort) sp.set('sort', sort)
  if (!attivo) sp.set('status', 'archiviati')
  const qs = sp.toString()

  return (
    <Link
      href={qs ? `${base}?${qs}` : base}
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
      <Archive size={15} aria-hidden />
      Archivio
    </Link>
  )
}
