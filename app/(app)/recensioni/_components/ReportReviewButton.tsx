'use client'

// Dialog "Segnala recensione" (mockup crescita §2, terzo telefono):
// motivo a scelta chiusa + spiegazione facoltativa. Verifica entro 48 ore.

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { reportReviewAction } from '@/lib/actions/reviews'

const REASONS = [
  { value: 'non_mio_lavoro', label: 'Non riguarda un mio lavoro' },
  { value: 'anomala', label: 'Valutazione anomala o in malafede' },
  { value: 'altro', label: 'Altro motivo' },
] as const

export function ReportReviewButton({ reviewId, reviewerName }: { reviewId: string; reviewerName: string | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<string>('non_mio_lavoro')
  const [note, setNote] = useState('')
  const [pending, startTransition] = useTransition()

  function handleSubmit() {
    startTransition(async () => {
      const result = await reportReviewAction(reviewId, reason, note)
      if (result?.error) {
        toast.error(result.error, { duration: 10_000, closeButton: true })
        return
      }
      toast.success('Segnalazione inviata', {
        description: 'Esaminiamo ogni segnalazione entro 48 ore. La recensione resta "in verifica" fino alla decisione.',
        duration: 10_000,
        closeButton: true,
      })
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ background: 'none', border: 'none', padding: 4, fontSize: 12, fontWeight: 600, color: '#b05656', cursor: 'pointer', fontFamily: 'inherit' }}
      >
        Segnala
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontSize: 17, fontWeight: 600 }}>Segnala recensione</DialogTitle>
            <DialogDescription style={{ fontSize: 13 }}>
              {reviewerName ? `Recensione di ${reviewerName}. ` : ''}Perché la segnali?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {REASONS.map((r) => (
              <label key={r.value} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, color: '#161616', cursor: 'pointer' }}>
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  style={{ accentColor: '#1a1a2e', width: 16, height: 16 }}
                />
                {r.label}
              </label>
            ))}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Aggiungi una spiegazione… (facoltativa)"
              rows={3}
              maxLength={500}
              style={{ width: '100%', border: '1px solid #e3e3e6', borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={pending}
              style={{
                width: '100%', height: 46, border: 'none', borderRadius: 12, background: '#1a1a2e', color: '#fff',
                fontSize: 14, fontWeight: 600, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
                cursor: pending ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: pending ? 0.7 : 1,
              }}
            >
              {pending ? 'Invio…' : 'Invia segnalazione'}
            </button>
            <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5 }}>
              Esaminiamo ogni segnalazione entro 48 ore. La recensione resta visibile con l&rsquo;etichetta &ldquo;in verifica&rdquo; finché non decidiamo.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
