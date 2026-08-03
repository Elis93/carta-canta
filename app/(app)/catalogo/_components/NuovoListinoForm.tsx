'use client'

// ============================================================
// NuovoListinoForm — crea un listino fornitore (Fase 2, Pro).
// Chiuso di default: bottone → form inline (nome, ricarico %,
// valido fino al). Al salvataggio si apre il dettaglio del listino.
// ============================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Plus } from 'lucide-react'
import { runAction } from '@/lib/run-action'
import { createSupplierListAction } from '@/lib/actions/fornitori'
import { parseImportoIt } from '@/lib/utils'

const FIELD: React.CSSProperties = {
  width: '100%', border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px',
  fontSize: 15, fontFamily: 'inherit', color: '#161616', background: '#fff', boxSizing: 'border-box',
}
const LABEL: React.CSSProperties = {
  fontSize: 12, fontWeight: 600, color: 'var(--cc-muted)', letterSpacing: '.05em',
  textTransform: 'uppercase', display: 'block', marginBottom: 6,
}

export function NuovoListinoForm() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [markup, setMarkup] = useState('25')
  const [validUntil, setValidUntil] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function handleCreate() {
    if (!name.trim()) { setError('Metti il nome del fornitore.'); return }
    const m = markup.trim() === '' ? null : parseImportoIt(markup)
    if (m != null && (!Number.isFinite(m) || m < 0 || m > 500)) {
      setError('Il ricarico deve essere tra 0 e 500%.')
      return
    }
    setError(null)
    startTransition(async () => {
      const fd = new FormData()
      fd.set('name', name.trim())
      if (m != null) fd.set('markup_pct', String(m))
      if (validUntil) fd.set('valid_until', validUntil)
      const result = await runAction(() => createSupplierListAction(fd), 'creare il listino')
      if (result?.error) { setError(result.error); return }
      if (result?.id) router.push(`/catalogo/fornitori/${result.id}`)
    })
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center justify-center text-white w-full"
        style={{ gap: 8, background: '#1a1a2e', borderRadius: 11, padding: 13, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', fontSize: 14, fontWeight: 600, border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        <Plus size={18} /> Nuovo listino fornitore
      </button>
    )
  }

  return (
    <div className="cc-card-md" style={{ padding: '15px 15px' }}>
      <div className="cc-section-label" style={{ marginBottom: 12 }}>Nuovo listino fornitore</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label htmlFor="nl-name" style={LABEL}>Fornitore</label>
          <input id="nl-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Idrotermica Rossi" style={FIELD} autoFocus />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div>
            <label htmlFor="nl-markup" style={LABEL}>Il tuo ricarico %</label>
            <input id="nl-markup" inputMode="decimal" value={markup} onChange={(e) => setMarkup(e.target.value.replace(/[^\d.,]/g, ''))} placeholder="25" style={FIELD} />
          </div>
          <div>
            <label htmlFor="nl-valid" style={LABEL}>Valido fino al</label>
            <input id="nl-valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} style={FIELD} />
          </div>
        </div>
        <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, margin: 0 }}>
          Col ricarico l&rsquo;app ti <b>propone</b>{' '}il prezzo di vendita (costo + ricarico), sempre modificabile.
          La scadenza è quella del listino del fornitore: l&rsquo;app ti avvisa quando un preventivo dura di più.
        </p>
        {error && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500, margin: 0 }}>{error}</p>}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={handleCreate}
            disabled={pending}
            style={{ flex: 1, minHeight: 46, border: 'none', borderRadius: 11, background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, opacity: pending ? 0.7 : 1 }}
          >
            {pending && <Loader2 size={16} className="animate-spin" />} Crea il listino
          </button>
          <button
            type="button"
            onClick={() => { setOpen(false); setError(null) }}
            disabled={pending}
            style={{ minHeight: 46, padding: '0 16px', borderRadius: 11, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Annulla
          </button>
        </div>
      </div>
    </div>
  )
}
