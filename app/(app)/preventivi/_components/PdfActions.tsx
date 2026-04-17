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

import { useCallback, useEffect, useRef, useState } from 'react'
import { Eye, FileDown, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { PdfData } from '@/components/pdf/PreventivoPDF'

// Re-export del tipo per comodità del chiamante
export type { PdfData }

// ── Tipi ──────────────────────────────────────────────────────────────────

interface PdfActionsProps extends PdfData {
  /** Usato come nome del file nel download: preventivo-{docNumberSlug}.pdf */
  docNumberSlug: string
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

export function PdfActions({ docNumberSlug, doc, workspace, client, template }: PdfActionsProps) {
  const [loading, setLoading] = useState<'preview' | 'download' | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Ref per tenere traccia dell'URL da revocare
  const urlRef = useRef<string | null>(null)

  // Revoca il blob URL quando il dialog si chiude o il componente viene smontato
  function revokeUrl() {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
  }

  useEffect(() => {
    return revokeUrl // cleanup al unmount
  }, [])

  const pdfData: PdfData = { doc, workspace, client, template }

  // ── Anteprima ────────────────────────────────────────────────────────────

  const handlePreview = useCallback(async () => {
    setLoading('preview')
    try {
      // Revoca eventuali URL precedenti prima di crearne uno nuovo
      revokeUrl()

      const blob = await generatePdfBlob(pdfData)
      const url = URL.createObjectURL(blob)
      urlRef.current = url
      setPreviewUrl(url)
      setPreviewOpen(true)
    } catch (err) {
      console.error('[PdfActions] Errore generazione anteprima:', err)
      alert('Impossibile generare l\'anteprima PDF. Riprova.')
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
      a.download = `preventivo-${docNumberSlug}.pdf`
      a.click()
      // Breve attesa prima di revocare (il browser deve avviare il download)
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (err) {
      console.error('[PdfActions] Errore download PDF:', err)
      alert('Impossibile scaricare il PDF. Riprova.')
    } finally {
      setLoading(null)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docNumberSlug, doc, workspace, client, template])

  // ── Chiusura dialog ───────────────────────────────────────────────────────

  function handleDialogClose(open: boolean) {
    if (!open) {
      setPreviewOpen(false)
      // Revoca l'URL dopo l'animazione di chiusura del dialog
      setTimeout(() => {
        revokeUrl()
        setPreviewUrl(null)
      }, 300)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Pulsante anteprima */}
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

      {/* Dialog anteprima */}
      <Dialog open={previewOpen} onOpenChange={handleDialogClose}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col p-0 gap-0">
          <DialogHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0 shrink-0">
            <DialogTitle className="text-sm font-medium">
              Anteprima — Preventivo {doc.doc_number ?? ''}
            </DialogTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={loading === 'download'}
              >
                {loading === 'download'
                  ? <Loader2 className="size-3.5 animate-spin" />
                  : <FileDown className="size-3.5" />}
                Scarica
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={() => setPreviewOpen(false)}
              >
                <X className="size-4" />
                <span className="sr-only">Chiudi</span>
              </Button>
            </div>
          </DialogHeader>

          {previewUrl && (
            <iframe
              src={previewUrl}
              className="flex-1 w-full rounded-b-lg"
              title={`Preventivo ${doc.doc_number ?? ''}`}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
