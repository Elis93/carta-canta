'use client'

// ============================================================
// ExportCommercialistaButton — scarica il "Pacchetto commercialista":
// registro CSV delle fatture emesse nel periodo, con le colonne che
// servono allo studio (imponibile, IVA, bollo, incassato con data).
// Due varianti di innesco: bottone compatto (header Fatture) o card
// (Impostazioni). Disponibile a tutti i piani: sono i dati dell'utente.
// ============================================================

import { useState } from 'react'
import { FileSpreadsheet, Download } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
  textTransform: 'uppercase', color: '#8a887f', marginBottom: 6,
}
const fieldStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e3e3e6', borderRadius: 10, padding: '0 12px',
  height: 44, boxSizing: 'border-box', fontSize: 14, fontFamily: 'inherit',
  color: '#161616', background: '#fff',
}

function firstOfYear(): string {
  return `${new Date().getFullYear()}-01-01`
}
function today(): string {
  return new Date().toLocaleDateString('sv-SE')
}

export function ExportCommercialistaButton({
  variant = 'button',
  endpoint = '/api/commercialista/export',
}: {
  variant?: 'button' | 'card'
  endpoint?: string
}) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(firstOfYear())
  const [to, setTo] = useState(today())
  const [error, setError] = useState<string | null>(null)

  function handleDownload() {
    setError(null)
    if (!from || !to) { setError('Scegli entrambe le date.'); return }
    if (from > to) { setError('La data di inizio è dopo quella di fine.'); return }
    const sep = endpoint.includes('?') ? '&' : '?'
    window.location.href = `${endpoint}${sep}from=${from}&to=${to}`
    setOpen(false)
  }

  return (
    <>
      {variant === 'card' ? (
        <div style={{
          background: '#fff', borderRadius: 14, marginTop: 16,
          boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)',
          padding: '14px 15px', display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <FileSpreadsheet size={20} style={{ color: '#8a887f', flexShrink: 0 }} aria-hidden />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}>Pacchetto per il commercialista</div>
            <div style={{ fontSize: 12, color: '#767676', marginTop: 1 }}>
              Registro delle fatture del periodo (imponibile, IVA, bollo, incassato) in un CSV da girare allo studio.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            style={{ flexShrink: 0, border: '1px solid #e7e7ea', borderRadius: 10, background: '#fff', color: '#1a1a2e', fontSize: 13, fontWeight: 600, padding: '9px 14px', cursor: 'pointer' }}
          >
            Scarica
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Pacchetto commercialista"
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: '#fff',
            border: '1px solid #e7e7ea', borderRadius: 10, padding: '7px 12px',
            fontSize: 13, fontWeight: 600, color: '#1a1a2e', cursor: 'pointer',
            fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(20,20,40,.05)',
          }}
        >
          <FileSpreadsheet size={15} /> Per il commercialista
        </button>
      )}

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontSize: 17, fontWeight: 600 }}>Pacchetto per il commercialista</DialogTitle>
            <DialogDescription style={{ fontSize: 13 }}>
              Scarichi il registro CSV delle fatture emesse nel periodo — con imponibile,
              IVA, bollo e incassato — pronto da mandare al tuo commercialista.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label style={labelStyle} htmlFor="comm-from">Dal</label>
              <input id="comm-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="comm-to">Al</label>
              <input id="comm-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={fieldStyle} />
            </div>

            {error && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{error}</p>}

            <button
              type="button"
              onClick={handleDownload}
              style={{
                width: '100%', height: 48, border: 'none', borderRadius: 12,
                background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <Download size={17} /> Scarica registro CSV
            </button>

            <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, margin: 0 }}>
              Consiglio: per entrate e uscite complete (criterio di cassa) allega anche
              l&rsquo;export del Bilancio.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
