'use client'

// ============================================================
// RichiamoCard — promemoria manutenzione sul Lavoro (migration 052).
// "Richiama il cliente tra 3/6/12 mesi" (es. manutenzione caldaia):
// alla data scelta compare la notifica in campanella. Un richiamo per
// lavoro; il fatturato ricorrente è il motivo per cui esiste la card.
// ============================================================

import { useRef, useState, useTransition } from 'react'
import { runAction } from '@/lib/run-action'
import { BellRing, Loader2, X, FilePlus2 } from 'lucide-react'
import { toast } from 'sonner'
import { setRecallAction } from '@/lib/actions/lavori'
import { duplicateDocumentAction } from '@/lib/actions/documents'
import { SpiegaCampo } from '@/components/shared/SpiegaCampo'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

function plusMonths(months: number): string {
  const d = new Date()
  const day = d.getDate()
  d.setDate(1) // evita l'overflow di calendario (31 gen + 1 mese ≠ 2/3 marzo)
  d.setMonth(d.getMonth() + months)
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
  return d.toLocaleDateString('sv-SE') // YYYY-MM-DD, fuso del telefono
}

export function RichiamoCard({ lavoroId, recallAt, recallNote, documentId }: {
  lavoroId: string
  recallAt: string | null
  recallNote: string | null
  // Preventivo di origine del lavoro: quando il richiamo scade, da qui si
  // prepara il preventivo della nuova manutenzione (cliente + voci copiati).
  documentId?: string | null
}) {
  const [date, setDate] = useState('')
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()
  const [creating, startCreate] = useTransition()
  // Spinner solo sull'azione premuta
  const [action, setAction] = useState<string | null>(null)

  // "Prepara il preventivo per la nuova manutenzione": duplica il preventivo
  // di origine (stesso cliente e stesse voci dell'anno scorso) in una nuova
  // BOZZA — l'artigiano rivede prezzi/date e la invia. duplicateDocumentAction
  // reindirizza da sé sul successo; sugli errori RITORNA { error } (Free alla
  // quota, origine nel cestino…) → serve runAction + lettura di .error, non
  // runActionVoid che li inghiottiva (review 4 ago: bottone muto).
  const creatingRef = useRef(false)
  function creaRicorrente() {
    // Guardia SINCRONA anti doppio tap (il flag della transition aggiorna
    // solo al re-render: due tap ravvicinati creerebbero DUE bozze e
    // consumerebbero due numeri).
    if (!documentId || creatingRef.current) return
    creatingRef.current = true
    startCreate(async () => {
      try {
        const res = await runAction(
          () => duplicateDocumentAction(documentId, { keepTitle: true }),
          'preparare il preventivo della manutenzione',
        )
        if (res?.error) toast.error(res.error)
      } finally {
        creatingRef.current = false
      }
    })
  }

  function save(dateStr: string | null, noteStr?: string, actionKey?: string) {
    setAction(actionKey ?? 'save')
    startTransition(async () => {
      try {
        const res = await runAction(() => setRecallAction(lavoroId, dateStr, noteStr), 'salvare il promemoria')
        if (res?.error) { toast.error(res.error); return }
        toast.success(res?.success ?? 'Fatto')
        setDate(''); setNote('')
      } finally {
        setAction(null)
      }
    })
  }

  const active = recallAt ? new Date(recallAt) : null
  const due = active !== null && active.getTime() <= Date.now()

  const pillStyle: React.CSSProperties = {
    border: '1px solid #e7e7ea', borderRadius: 999, background: '#fff', color: '#1a1a2e',
    fontSize: 13, fontWeight: 600, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit',
    display: 'inline-flex', alignItems: 'center', gap: 5, opacity: pending ? 0.6 : 1,
  }

  return (
    <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
      {/* La spiegazione sta nel punto ⓘ (Eli, 11 ago) */}
      <SpiegaCampo
        etichetta="Richiama il cliente"
        style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 12 }}
      >
        Per manutenzioni e controlli periodici (caldaia, condizionatori…): alla data scelta ti
        arriva un promemoria nella campanella della Home.
      </SpiegaCampo>

      {active ? (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: due ? '#fdf9ef' : '#fafafa', border: due ? '1px solid #ecdfc0' : '1px solid #f0f0f2', borderRadius: 10, padding: '10px 12px' }}>
            <BellRing size={16} style={{ color: due ? '#b0863e' : 'var(--cc-muted)', flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, color: '#161616' }}>
              {due ? 'Da richiamare dal ' : 'Richiamo il '}
              <strong>{active.toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' })}</strong>
              {recallNote && <span style={{ display: 'block', fontSize: 12, color: 'var(--cc-muted)', marginTop: 1 }}>{recallNote}</span>}
            </span>
            <button
              type="button"
              onClick={() => save(null, undefined, 'remove')}
              disabled={pending}
              aria-label="Rimuovi promemoria"
              style={{ flexShrink: 0, border: 'none', background: 'none', color: '#b05656', cursor: 'pointer', padding: 4, display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600 }}
            >
              {action === 'remove' ? <Loader2 size={14} className="animate-spin" /> : <X size={15} />} Rimuovi
            </button>
          </div>
          {/* Preventivo ricorrente: pronto quando è il momento di richiamare —
              stesso cliente e stesse voci dell'anno scorso, da rivedere e inviare */}
          {documentId && (
            <button
              type="button"
              onClick={creaRicorrente}
              disabled={creating}
              style={{
                marginTop: 10, width: '100%', boxSizing: 'border-box', height: 44,
                border: due ? 'none' : '1px solid #d7d4cb',
                borderRadius: 10, background: due ? '#1a1a2e' : '#fff',
                color: due ? '#fff' : '#1a1a2e', fontSize: 14, fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                boxShadow: due ? '0 6px 16px -6px rgba(26,26,46,.5)' : 'none',
                opacity: creating ? 0.6 : 1,
              }}
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : <FilePlus2 size={16} />}
              Prepara il preventivo per la manutenzione
            </button>
          )}
        </>
      ) : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[3, 6, 12].map((m) => (
              <button key={m} type="button" style={pillStyle} disabled={pending} onClick={() => save(plusMonths(m), note, `m${m}`)}>
                {action === `m${m}` ? <Loader2 size={13} className="animate-spin" /> : null} Tra {m} mesi
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
            <input
              type="date"
              value={date}
              min={new Date().toLocaleDateString('sv-SE')}
              onChange={(e) => setDate(e.target.value)}
              disabled={pending}
              aria-label="Data del richiamo"
              style={{ flex: 1, minWidth: 0, border: '1px solid #e3e3e6', borderRadius: 10, padding: '0 12px', height: 42, boxSizing: 'border-box', fontSize: 14, fontFamily: 'inherit', color: '#161616', background: '#fff' }}
            />
            <button
              type="button"
              onClick={() => { if (date) save(date, note, 'save') }}
              disabled={pending || !date}
              style={{ flexShrink: 0, border: 'none', borderRadius: 10, background: '#1a1a2e', color: '#fff', fontSize: 13, fontWeight: 600, padding: '0 16px', height: 42, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6, opacity: (pending || !date) ? 0.6 : 1 }}
            >
              {action === 'save' ? <Loader2 size={14} className="animate-spin" /> : null} Imposta
            </button>
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Nota (es. manutenzione caldaia annuale)"
            maxLength={300}
            disabled={pending}
            style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px', fontSize: 14, fontFamily: 'inherit', color: '#161616', background: '#fff', marginTop: 8 }}
          />
        </>
      )}
    </div>
  )
}
