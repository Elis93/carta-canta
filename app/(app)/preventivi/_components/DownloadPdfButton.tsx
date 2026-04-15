'use client'

import { useState } from 'react'
import { FileDown, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface DownloadPdfButtonProps {
  documentId: string
  hasCachedPdf: boolean
}

export function DownloadPdfButton({ documentId, hasCachedPdf }: DownloadPdfButtonProps) {
  const [loading, setLoading] = useState(false)

  async function openPdf(force = false) {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (force) params.set('force', '1')
      // Apre in nuova tab — il browser gestisce download o visualizzazione
      window.open(`/api/documents/${documentId}/pdf?${params}`, '_blank')
    } finally {
      // Breve delay per feedback visivo
      setTimeout(() => setLoading(false), 1500)
    }
  }

  if (!hasCachedPdf) {
    // Prima generazione — singolo pulsante
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() => openPdf(false)}
        disabled={loading}
      >
        {loading
          ? <Loader2 className="size-4 animate-spin" />
          : <FileDown className="size-4" />}
        {loading ? 'Generazione…' : 'Scarica PDF'}
      </Button>
    )
  }

  // PDF già cachato — mostra dropdown con opzione rigenera
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={loading}>
          {loading
            ? <Loader2 className="size-4 animate-spin" />
            : <FileDown className="size-4" />}
          {loading ? 'Generazione…' : 'PDF'}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => openPdf(false)}>
          <FileDown className="size-4 mr-2" />
          Scarica PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => openPdf(true)}>
          <RefreshCw className="size-4 mr-2" />
          Rigenera PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
