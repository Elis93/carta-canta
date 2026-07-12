'use client'

// ============================================================
// ExportBilancioButton — scarica il bilancio in CSV per il periodo
// scelto (da data a data). Il file si apre in Excel ed è pensato
// per essere girato al commercialista. (Richiesta Eli 6 lug)
// ============================================================

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
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
  const now = new Date()
  return `${now.getFullYear()}-01-01`
}
function today(): string {
  return new Date().toLocaleDateString('sv-SE')
}

export function ExportBilancioButton() {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(firstOfYear())
  const [to, setTo] = useState(today())
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  // Scarica via fetch+blob: un errore del server (JSON) diventa un messaggio
  // nel dialog, non una pagina bianca col JSON grezzo.
  async function handleDownload() {
    setError(null)
    if (!from || !to) { setError('Scegli entrambe le date.'); return }
    if (from > to) { setError('La data di inizio è dopo quella di fine.'); return }
    setDownloading(true)
    try {
      const res = await fetch(`/api/bilancio/export?from=${from}&to=${to}`)
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
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `bilancio_${from}_${to}.csv`
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
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Esporta bilancio"
        style={{
          display: 'flex', alignItems: 'center', gap: 6, background: '#fff',
          border: '1px solid #e7e7ea', borderRadius: 10, padding: '7px 12px',
          fontSize: 13, fontWeight: 600, color: '#1a1a2e', cursor: 'pointer',
          fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(20,20,40,.05)',
        }}
      >
        <Download size={15} /> Esporta
      </button>

      <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null) }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontSize: 17, fontWeight: 600 }}>Esporta il bilancio</DialogTitle>
            <DialogDescription style={{ fontSize: 13 }}>
              Scarichi un file CSV (si apre in Excel) con entrate, uscite e totali
              del periodo — pronto da girare al commercialista.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label style={labelStyle} htmlFor="exp-from">Dal</label>
              <input id="exp-from" type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} style={fieldStyle} />
            </div>
            <div>
              <label style={labelStyle} htmlFor="exp-to">Al</label>
              <input id="exp-to" type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} style={fieldStyle} />
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
              {downloading ? <Loader2 size={17} className="animate-spin" /> : <Download size={17} />} Scarica CSV
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
