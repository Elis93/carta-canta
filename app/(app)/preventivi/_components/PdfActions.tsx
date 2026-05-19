'use client'

// ============================================================
// CARTA CANTA — PdfActions
// Pulsanti "Anteprima PDF" e "Scarica PDF" che puntano alla
// route server-side /api/documents/[id]/pdf.
//
// Approccio server-side (vs client-side @react-pdf/renderer):
// - Non richiede caricamento bundle aggiuntivo nel client
// - Non viene bloccato dai popup blocker del browser
// - Funziona anche su Safari/iOS
// - ?inline=1  → Content-Disposition: inline (anteprima nel browser)
// - senza flag  → Content-Disposition: attachment (download)
// ============================================================

import { Eye, FileDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PdfActionsProps {
  /** ID del documento — usato per costruire l'URL dell'API route */
  documentId: string
  /** Usato come nome del file nel download: {docType}-{docNumberSlug}.pdf */
  docNumberSlug?: string
  docType?: 'preventivo' | 'fattura'
}

export function PdfActions({ documentId, docType = 'preventivo' }: PdfActionsProps) {
  const base = `/api/documents/${documentId}/pdf`

  return (
    <>
      {/* Pulsante anteprima — apre il PDF inline in una nuova scheda */}
      <Button variant="outline" size="sm" asChild>
        <a href={`${base}?inline=1`} target="_blank" rel="noopener noreferrer">
          <Eye className="size-4" />
          Anteprima PDF
        </a>
      </Button>

      {/* Pulsante download */}
      <Button variant="outline" size="sm" asChild>
        <a href={base} target="_blank" rel="noopener noreferrer">
          <FileDown className="size-4" />
          Scarica PDF
        </a>
      </Button>
    </>
  )
}
