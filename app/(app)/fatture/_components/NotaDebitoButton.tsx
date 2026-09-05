'use client'

// ============================================================
// «Crea nota di debito» — la gemella della nota di credito, per il caso
// opposto: la fattura è già passata dallo SdI e hai fatturato TROPPO POCO.
//
// Art. 26 comma 1: quando imponibile o imposta AUMENTANO (lavoro extra
// concordato, aliquota applicata per difetto, quantità sbagliata) la nota di
// debito NON è una facoltà come quella di credito — è OBBLIGATORIA.
//
// ⚠️ Senza questo documento l'artigiano finisce per emettere una SECONDA
// FATTURA scollegata dalla prima: formalmente sbagliata e impossibile da
// riconciliare per il commercialista.
//
// ⚠️ La nota nasce VUOTA di voci, a differenza di quella di credito: lì si
// storna ciò che c'è già (copiare ha senso), qui si aggiunge ciò che nella
// fattura NON c'era — copiarne le voci creerebbe un documento da svuotare a
// mano, col rischio di lasciarci dentro righe che raddoppiano il dovuto.
// ============================================================

import { useState } from 'react'
import { FilePlus2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { runAction } from '@/lib/run-action'
import { createNotaDebitoAction } from '@/lib/actions/documents'

const MOTIVI = [
  { v: 'extra',    label: 'Lavoro in più concordato', hint: 'Durante il lavoro è stato aggiunto qualcosa che nella fattura non c’era. Aggiungi solo le voci NUOVE.' },
  { v: 'importo',  label: 'Importo o quantità sbagliati', hint: 'Avevi fatturato meno del dovuto (prezzo o quantità troppo bassi). Metti solo la differenza.' },
  { v: 'iva',      label: 'IVA applicata per difetto', hint: 'Aliquota sbagliata in fattura: qui integri l’imposta mancante. Se non sei sicuro, sentì prima il commercialista.' },
  { v: 'altro',    label: 'Altro', hint: 'Scrivi tu la causale nel documento prima di inviarlo.' },
] as const

export function NotaDebitoButton({ documentId, triggerStyle }: { documentId: string; triggerStyle?: React.CSSProperties }) {
  const [aperto, setAperto] = useState(false)
  const [inCorso, setInCorso] = useState<string | null>(null)

  async function crea(motivo: string, testo: string) {
    if (inCorso) return
    setInCorso(motivo)
    const res = await runAction(() => createNotaDebitoAction(documentId, testo), 'creare la nota di debito')
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
          ...triggerStyle,
        }}
      >
        <FilePlus2 size={17} aria-hidden />
        Crea nota di debito
      </button>
    )
  }

  return (
    <div style={{ border: '1px solid #e6e6e6', background: '#f7f7f8', borderRadius: 12, padding: '13px 14px' }}>
      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#161616' }}>Cosa manca in fattura?</div>
      <p style={{ fontSize: 12.5, color: 'var(--cc-muted)', margin: '3px 0 10px', lineHeight: 1.45 }}>
        La nota di debito <b>aggiunge</b>{' '}a una fattura già trasmessa: nasce col cliente e
        il riferimento alla fattura, e tu ci metti <b>solo quello che manca</b>{' '}— non
        rifare tutto il lavoro, altrimenti il cliente pagherebbe due volte.
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
      {/* Nota fiscale SEMPRE visibile (regola di Eli sui ⓘ). */}
      <p style={{ fontSize: 11.5, color: 'var(--cc-muted)', margin: '8px 0 0', lineHeight: 1.45 }}>
        A differenza della nota di credito, <b>questa è obbligatoria</b>{' '}quando hai
        fatturato meno del dovuto (art. 26 c.1). Ha una numerazione tutta sua
        (<b>ND&nbsp;001/2026</b>) e va trasmessa allo SdI come una fattura.
      </p>
    </div>
  )
}
