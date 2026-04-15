'use client'

import { useState } from 'react'
import { Loader2, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { duplicateDocumentAction } from '@/lib/actions/documents'

export function DuplicateDocumentButton({ documentId }: { documentId: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    const result = await duplicateDocumentAction(documentId)
    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
    // On success, redirect happens server-side
    setLoading(false)
  }

  return (
    <div>
      <Button variant="outline" size="sm" onClick={handleClick} disabled={loading}>
        {loading ? <Loader2 className="size-4 animate-spin" /> : <Copy className="size-4" />}
        Duplica
      </Button>
      {error && <p className="text-xs text-destructive mt-1">{error}</p>}
    </div>
  )
}
