'use client'

// ============================================================
// CsvDownloadButton — scarica un CSV via fetch+blob.
// Sostituisce gli <a href="/api/... " download> delle liste: con l'anchor
// diretto un errore del server (401/404 JSON) veniva scaricato/mostrato
// come file JSON grezzo. Qui l'errore diventa un toast leggibile.
// ============================================================

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'

export function CsvDownloadButton({ endpoint, filename, label = 'Esporta CSV' }: {
  endpoint: string
  filename: string
  label?: string
}) {
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (downloading) return
    setDownloading(true)
    try {
      const res = await fetch(endpoint)
      if (!res.ok) {
        let msg = 'Export non riuscito. Riprova tra qualche istante.'
        try {
          const body = await res.json()
          if (body?.error) msg = body.error
        } catch { /* risposta non JSON */ }
        toast.error(msg)
        return
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') ?? ''
      const fname = /filename="([^"]+)"/.exec(cd)?.[1] ?? filename
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fname
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('Export non riuscito. Controlla la connessione e riprova.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" className="hidden lg:flex" onClick={handleDownload} disabled={downloading} title={label}>
      {downloading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
      {label}
    </Button>
  )
}
