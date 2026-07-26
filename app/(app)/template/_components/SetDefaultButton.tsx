'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { runActionVoid } from '@/lib/run-action'
import { Star, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { setDefaultTemplateAction } from '@/lib/actions/templates'

export function SetDefaultButton({ templateId }: { templateId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    setLoading(true)
    const err = await runActionVoid(() => setDefaultTemplateAction(templateId), 'impostare il template predefinito')
    if (err) toast.error(err)
    setLoading(false)
  }

  return (
    <Button variant="ghost" size="sm" onClick={handleClick} disabled={loading} aria-label="Imposta come predefinito">
      {loading ? (
        <Loader2 className="size-4 animate-spin" />
      ) : (
        <Star className="size-4" />
      )}
    </Button>
  )
}
