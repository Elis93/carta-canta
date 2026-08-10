'use client'

// ============================================================
// CARTA CANTA — PdfActions
// Pulsanti "Anteprima" e "Salva come PDF" per il documento.
//
// Entrambi aprono la vista di stampa HTML (buildPdfHtml):
// - Anteprima (?preview=1): apre il documento senza dialogo stampa
// - Salva come PDF: apre il documento + apre automaticamente il
//   dialogo di stampa del browser → "Salva come PDF"
// ============================================================

import { Eye } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface PdfActionsProps {
  documentId: string
  docNumberSlug?: string
  docType?: string
}

export function PdfActions({ documentId }: PdfActionsProps) {
  const base = `/api/documents/${documentId}/pdf`

  return (
    <Button variant="outline" size="sm" asChild>
      <a href={`${base}?preview=1`} target="_blank" rel="noopener noreferrer">
        <Eye className="size-4" />
        Anteprima
      </a>
    </Button>
  )
}
