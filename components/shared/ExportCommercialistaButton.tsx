'use client'

// ============================================================
// ExportCommercialistaButton — scarica il "Pacchetto commercialista":
// registro CSV delle fatture emesse nel periodo, con le colonne che
// servono allo studio (imponibile, IVA, bollo, incassato con data).
// Due varianti di innesco: bottone compatto (header Fatture) o card
// (Impostazioni). Disponibile a tutti i piani: sono i dati dell'utente.
// ============================================================

import { useState } from 'react'
import { FileSpreadsheet, Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
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

// Copy per tipo di export: registro fatture (default) o bilancio entrate/uscite.
const COPY = {
  registro: {
    trigger: 'Per il commercialista',
    title: 'Pacchetto per il commercialista',
    description: 'Scarichi il registro CSV delle fatture emesse nel periodo — con imponibile, IVA, bollo e incassato — pronto da mandare al tuo commercialista.',
    cta: 'Scarica registro CSV',
    hint: 'Consiglio: per entrate e uscite complete (criterio di cassa) allega anche l’export del Bilancio.',
  },
  bilancio: {
    trigger: 'Bilancio (entrate/uscite)',
    title: 'Bilancio del periodo',
    description: 'Scarichi entrate e uscite per cassa del periodo in un CSV — la base per il regime forfettario.',
    cta: 'Scarica bilancio CSV',
    hint: 'Le entrate seguono gli incassi registrati (criterio di cassa), le uscite le spese inserite nel Bilancio.',
  },
} as const

export function ExportCommercialistaButton({
  variant = 'button',
  endpoint = '/api/commercialista/export',
  kind = 'registro',
  triggerLabel,
}: {
  variant?: 'button' | 'card'
  endpoint?: string
  kind?: keyof typeof COPY
  /** Override del testo del bottone (in /studio "Per il commercialista" suonerebbe storto) */
  triggerLabel?: string
}) {
  const copy = COPY[kind]
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(firstOfYear())
  const [to, setTo] = useState(today())
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  // Scarica via fetch+blob: se il server risponde con un errore (JSON),
  // lo mostriamo in un toast invece di far ATTERRARE l'utente sul JSON grezzo
  // (che è quello che succedeva con window.location.href).
  async function handleDownload() {
    setError(null)
    if (!from || !to) { setError('Scegli entrambe le date.'); return }
    if (from > to) { setError('La data di inizio è dopo quella di fine.'); return }
    setDownloading(true)
    try {
      const sep = endpoint.includes('?') ? '&' : '?'
      const res = await fetch(`${endpoint}${sep}from=${from}&to=${to}`)
      if (!res.ok) {
        let msg = 'Download non riuscito. Riprova tra qualche istante.'
        try {
          const body = await res.json()
          if (body?.error) msg = body.error
        } catch { /* risposta non JSON */ }
        setError(msg)
        return
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') ?? ''
      const fname = /filename="([^"]+)"/.exec(cd)?.[1]
        ?? `${kind === 'bilancio' ? 'bilancio' : 'registro_fatture'}_${from}_${to}.csv`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fname
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success('File scaricato.')
      setOpen(false)
    } catch {
      setError('Download non riuscito. Controlla la connessione e riprova.')
    } finally {
      setDownloading(false)
    }
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
            <div style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}>{copy.title}</div>
            <div style={{ fontSize: 12, color: '#767676', marginTop: 1 }}>{copy.description}</div>
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
          aria-label={copy.title}
          style={{
            display: 'flex', alignItems: 'center', gap: 6, background: '#fff',
            border: '1px solid #e7e7ea', borderRadius: 10, padding: '7px 12px',
            fontSize: 13, fontWeight: 600, color: '#1a1a2e', cursor: 'pointer',
            fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(20,20,40,.05)',
          }}
        >
          <FileSpreadsheet size={15} /> {triggerLabel ?? copy.trigger}
        </button>
      )}

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontSize: 17, fontWeight: 600 }}>{copy.title}</DialogTitle>
            <DialogDescription style={{ fontSize: 13 }}>{copy.description}</DialogDescription>
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
              disabled={downloading}
              style={{
                width: '100%', height: 48, border: 'none', borderRadius: 12,
                background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', cursor: 'pointer', fontFamily: 'inherit',
                opacity: downloading ? 0.6 : 1,
              }}
            >
              {downloading ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />} {copy.cta}
            </button>

            <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, margin: 0 }}>
              {copy.hint}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
