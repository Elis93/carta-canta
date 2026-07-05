'use client'

import { useState } from 'react'
import { Loader2, CopyPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { duplicateDocumentAction } from '@/lib/actions/documents'

const ROW_STYLE: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 11, padding: '12px 0',
  fontSize: 14, width: '100%', background: 'none', border: 'none',
  cursor: 'pointer', textAlign: 'left',
}

export function DuplicateDocumentButton({ documentId, asRow }: { documentId: string; asRow?: boolean }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    // keepTitle: stesso effetto della voce "Usa come modello" del menu ⋮ in
    // lista — stesso nome = stesso comportamento (prima qui aggiungeva "(copia)")
    const result = await duplicateDocumentAction(documentId, { keepTitle: true })
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
    // On success, redirect happens server-side
    setLoading(false)
  }

  if (asRow) {
    return (
      <button type="button" onClick={handleClick} disabled={loading} style={{ ...ROW_STYLE, color: '#161616' }}>
        {loading ? <Loader2 size={18} className="animate-spin" style={{ color: '#55534b' }} /> : <CopyPlus size={18} style={{ color: '#55534b' }} />}
        Duplica (usa come modello)
      </button>
    )
  }

  return (
    <div>
      <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <CopyPlus className="size-4" />}
        <span className="hidden sm:inline">Usa come modello</span>
      </Button>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  )
}
