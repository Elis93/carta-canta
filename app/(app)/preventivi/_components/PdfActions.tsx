'use client'

// ============================================================
// CARTA CANTA — PdfActions
// Pulsanti "Anteprima PDF" e "Scarica PDF" interamente
// client-side, senza round-trip al server.
//
// @react-pdf/renderer e PreventivoPDF sono importati in modo
// lazy (dynamic import) all'interno dei click handler, così
// non pesano sul bundle iniziale della pagina.
// ============================================================

import { useCallback, useState } from 'react'
import { Eye, FileDown, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import type { PdfData } from '@/components/pdf/PreventivoPDF'

// Re-export del tipo per comodità del chiamante
export type { PdfData }

// ── Tipi ──────────────────────────────────────────────────────────────────

interface PdfActionsProps extends PdfData {
  /** Usato come nome del file nel download: {docType}-{docNumberSlug}.pdf */
  docNumberSlug: string
  docType?: 'preventivo' | 'fattura'
}

// ── Helper: genera il blob PDF ─────────────────────────────────────────────

async function generatePdfBlob(data: PdfData): Promise<Blob> {
  // Import lazy: mantiene il bundle iniziale leggero.
  // react-pdf usa canvas/worker internamente — non compatibile con SSR.
  const [{ pdf }, { PreventivoPDF }] = await Promise.all([
    import('@react-pdf/renderer'),
    import('@/components/pdf/PreventivoPDF'),
  ])

  const element = PreventivoPDF(data)
  const blob = await pdf(element).toBlob()
  return blob
}

// ── Componente ─────────────────────────────────────────────────────────────

export function PdfActions({ docNumberSlug, doc, workspace, client, template, docType = 'preventivo' }: PdfActionsProps) {
  const [loading, setLoading] = useState<'preview' | 'download' | null>(null)

  const pdfData: PdfData = { doc, workspace, client, template }

  // ── Anteprima ────────────────────────────────────────────────────────────
  // Apriamo la finestra PRIMA della generazione asincrona per evitare che
  // il popup blocker la blocchi (deve essere chiamata nello stack sincrono
  // del click handler). Poi navighiamo la finestra al blob URL una volta pronto.

  const handlePreview = useCallback(async () => {
    setLoading('preview')
    // Finestra aperta subito nel click handler (stack sincrono)
    const win = window.open('', '_blank')
    try {
      const blob = await generatePdfBlob(pdfData)
      const url = URL.createObjectURL(blob)
      if (win) {
        // Navigare direttamente un blob: URL in una finestra about:blank può
        // produrre una pagina bianca in Chrome (PDF viewer sandbox restriction).
        // Soluzione robusta: scrivere un wrapper HTML con un iframe che carica il blob.
        win.document.write(
          `<!DOCTYPE html><html><head><title>Anteprima PDF</title>` +
          `<style>*{margin:0;padding:0}iframe{position:fixed;inset:0;width:100%;height:100%;border:0}</style>` +
          `</head><body><iframe src="${url}"></iframe></body></html>`
        )
        win.document.close()
        setTimeout(() => URL.revokeObjectURL(url), 30_000)
      } else {
        // Popup bloccato: fallback con link <a>
        const a = document.createElement('a')
        a.href = url
        a.target = '_blank'
        a.rel = 'noopener'
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        setTimeout(() => URL.revokeObjectURL(url), 30_000)
      }
    } catch (err) {
      win?.close()
      console.error('[PdfActions] Errore generazione anteprima:', err)
      toast.error('Impossibile generare l\'anteprima PDF. Riprova.')
    } finally {
      setLoading(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doc, workspace, client, template])

  // ── Download ─────────────────────────────────────────────────────────────

  const handleDownload = useCallback(async () => {
    setLoading('download')
    try {
      const blob = await generatePdfBlob(pdfData)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${docType}-${docNumberSlug}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // Breve attesa prima di revocare (il browser deve avviare il download)
      setTimeout(() => URL.revokeObjectURL(url), 5_000)
    } catch (err) {
      console.error('[PdfActions] Errore download PDF:', err)
      toast.error('Impossibile scaricare il PDF. Riprova.')
    } finally {
      setLoading(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docNumberSlug, doc, workspace, client, template])

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Pulsante anteprima — apre il PDF in una nuova scheda */}
      <Button
        variant="outline"
        size="sm"
        onClick={handlePreview}
        disabled={loading !== null}
      >
        {loading === 'preview'
          ? <Loader2 className="size-4 animate-spin" />
          : <Eye className="size-4" />}
        {loading === 'preview' ? 'Generazione…' : 'Anteprima PDF'}
      </Button>

      {/* Pulsante download */}
      <Button
        variant="outline"
        size="sm"
        onClick={handleDownload}
        disabled={loading !== null}
      >
        {loading === 'download'
          ? <Loader2 className="size-4 animate-spin" />
          : <FileDown className="size-4" />}
        {loading === 'download' ? 'Download…' : 'Scarica PDF'}
      </Button>
    </>
  )
}
