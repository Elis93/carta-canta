'use client'

// Dialog pubblico "Segnala questo profilo" (notice-and-takedown DSA).
// Sostituisce il vecchio mailto (inerte senza client di posta): invia la
// segnalazione a segnalazioni@cartacanta.app via /api/marketplace/segnala.

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'

export function ReportProfileButton({ workspaceId, publicName }: { workspaceId: string; publicName: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [contact, setContact] = useState('')
  const [website, setWebsite] = useState('') // honeypot
  const [sending, setSending] = useState(false)

  async function handleSubmit() {
    if (reason.trim().length < 10) {
      toast.error('Scrivi il motivo della segnalazione (almeno 10 caratteri).', { duration: 8000, closeButton: true })
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/marketplace/segnala', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: workspaceId, reason: reason.trim(), reporter_contact: contact.trim() || undefined, website }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data?.error ?? 'Invio non riuscito. Riprova.', { duration: 10_000, closeButton: true })
        return
      }
      toast.success('Segnalazione inviata. La esaminiamo al più presto.', { closeButton: true })
      setOpen(false)
      setReason(''); setContact('')
    } catch {
      toast.error('Invio non riuscito. Controlla la connessione e riprova.', { duration: 10_000, closeButton: true })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{ display: 'inline-block', marginTop: 8, fontSize: 12, fontWeight: 600, color: '#b05656', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit' }}
      >
        ⚑ Segnala questo profilo
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle style={{ fontSize: 17, fontWeight: 600 }}>Segnala questo profilo</DialogTitle>
            <DialogDescription style={{ fontSize: 13 }}>
              {publicName}. Dicci cosa non va: esaminiamo ogni segnalazione e rimuoviamo i contenuti illeciti.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Motivo della segnalazione…"
              rows={4}
              maxLength={2000}
              style={{ width: '100%', border: '1px solid #e3e3e6', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box' }}
            />
            <input
              type="text"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder="Email (facoltativa — solo per aggiornarti sull’esito)"
              maxLength={120}
              style={{ width: '100%', border: '1px solid #e3e3e6', borderRadius: 10, padding: '10px 12px', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' }}
            />
            {/* Facoltatività esplicita (ok Eli 29 lug): la segnalazione anonima
                è una scelta deliberata (protezione dei segnalanti, DSA) — chi
                non vuole lasciare recapiti deve saperlo prima di scrivere. */}
            <p style={{ fontSize: 12, color: 'var(--cc-muted)', lineHeight: 1.5, margin: 0 }}>
              Puoi segnalare anche senza lasciare contatti: la esaminiamo comunque.
            </p>
            {/* Honeypot: nascosto agli umani */}
            <input
              type="text"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={sending}
              style={{
                width: '100%', height: 46, border: 'none', borderRadius: 12, background: '#1a1a2e', color: '#fff',
                fontSize: 14, fontWeight: 600, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
                cursor: sending ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: sending ? 0.7 : 1,
              }}
            >
              {sending ? 'Invio…' : 'Invia segnalazione'}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
