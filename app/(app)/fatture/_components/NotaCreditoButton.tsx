'use client'

// ============================================================
// «Crea nota di credito» — prende il posto di «Annulla» sulle fatture
// trasmesse allo SdI (Eli, 8 ago: *"annulla è sostituito da Crea nota di
// credito e la nota si compila da sola per i campi che può"*).
//
// Una fattura emessa non si annulla e non si elimina: si storna con una nota
// di credito (TD04). Qui si chiede solo la cosa che l'app non può sapere — il
// MOTIVO — perché da quello dipendono i termini (art. 26 DPR 633/1972):
//  · ERRORE nella fattura (importi indicati in misura superiore al reale,
//    art. 21 c.7) → la variazione va fatta ENTRO UN ANNO dall'operazione
//    (comma 3; AdE risposte 663/2021 e 762/2021);
//  · SOPRAVVENUTO ACCORDO fra le parti (sconto concordato dopo, reso) →
//    anche qui UN ANNO (comma 3);
//  · SENZA il limite dell'anno (comma 2): contratto che viene meno
//    (nullità, annullamento, risoluzione, rescissione), sconti già previsti
//    DAL CONTRATTO, mancato pagamento per procedure rimaste infruttuose.
// ⚠️ La prima versione diceva l'OPPOSTO («errore → nessun termine»):
// corretto il 10 ago rileggendo le fonti, non la memoria.
// ============================================================

import { useState } from 'react'
import { FileMinus2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { runAction } from '@/lib/run-action'
import { createNotaCreditoAction } from '@/lib/actions/documents'

const MOTIVI = [
  { v: 'errore',  label: 'Errore nella fattura', hint: 'Importi, voci o dati sbagliati fin dall’inizio. Per recuperare l’IVA hai un anno dalla fattura: prima la fai, meglio è.' },
  { v: 'accordo', label: 'Accordo col cliente',   hint: 'Sconto concordato dopo, lavoro ridotto, reso. Anche qui: un anno dall’operazione.' },
  { v: 'altro',   label: 'Altro',                 hint: 'Lavoro annullato o contratto saltato, sconto già previsto nel contratto: qui il limite dell’anno non c’è. Scrivi tu la causale prima di inviarla.' },
] as const

export function NotaCreditoButton({ documentId }: { documentId: string }) {
  const [aperto, setAperto] = useState(false)
  const [inCorso, setInCorso] = useState<string | null>(null)

  async function crea(motivo: string, testo: string) {
    if (inCorso) return
    setInCorso(motivo)
    const res = await runAction(() => createNotaCreditoAction(documentId, testo), 'creare la nota di credito')
    // In caso di successo l'action reindirizza da sé alla nota appena creata.
    if (res?.error) {
      toast.error(res.error)
      setInCorso(null)
    }
  }

  if (!aperto) {
    return (
      <button
        type="button"
        onClick={() => setAperto(true)}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          width: '100%', height: 44, borderRadius: 12, border: '1px solid #e3e3e6',
          background: '#fff', color: '#1a1a2e', fontSize: 14, fontWeight: 600,
          cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        <FileMinus2 size={17} aria-hidden />
        Crea nota di credito
      </button>
    )
  }

  return (
    <div style={{ border: '1px solid #e6e6e6', background: '#f7f7f8', borderRadius: 12, padding: '13px 14px' }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#161616' }}>Perché la storni?</div>
      <p style={{ fontSize: 12.5, color: 'var(--cc-muted)', margin: '3px 0 10px', lineHeight: 1.45 }}>
        Il motivo cambia i tempi, quindi conviene sceglierlo bene. La nota nasce già
        compilata con cliente, voci e importi della fattura: tu controlli e, se serve,
        riduci gli importi per uno storno parziale.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {MOTIVI.map((m) => (
          <button
            key={m.v}
            type="button"
            onClick={() => crea(m.v, m.label)}
            disabled={inCorso !== null}
            style={{
              textAlign: 'left', border: '1px solid #e3e3e6', borderRadius: 10,
              background: '#fff', padding: '10px 12px', cursor: inCorso ? 'default' : 'pointer',
              fontFamily: 'inherit', opacity: inCorso && inCorso !== m.v ? 0.5 : 1,
            }}
          >
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13.5, fontWeight: 600, color: '#161616' }}>
              {inCorso === m.v ? <Loader2 size={13} className="animate-spin" /> : null}
              {m.label}
            </span>
            <span style={{ display: 'block', fontSize: 12, color: 'var(--cc-muted)', marginTop: 2, lineHeight: 1.4 }}>
              {m.hint}
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setAperto(false)}
        disabled={inCorso !== null}
        style={{ border: 'none', background: 'none', color: 'var(--cc-muted)', fontSize: 13, fontWeight: 600, padding: '9px 2px 0', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        Annulla
      </button>
      {/* Nota fiscale SEMPRE visibile (regola di Eli sui ⓘ): N4 chiusa
          sulle fonti l'11 ago — il bollo sulla nota è dovuto sopra 77,47 €
          (art. 13 tariffa DPR 642/1972) e l'app lo mette da sola. */}
      <p style={{ fontSize: 11.5, color: 'var(--cc-muted)', margin: '8px 0 0', lineHeight: 1.45 }}>
        Se la nota supera 77,47&nbsp;€, la <b>marca da bollo</b>{' '}da 2&nbsp;€ viene aggiunta
        da sola, come sulle fatture. Il bollo della fattura stornata invece non si recupera.
      </p>
    </div>
  )
}
