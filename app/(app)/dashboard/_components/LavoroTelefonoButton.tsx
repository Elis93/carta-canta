'use client'

// ── Cornetta della card «Lavoro in corso» (Eli, 12 set) ─────────────────────
// Al posto della matita (che era ridondante: il corpo della card apre già la
// scheda). Due comportamenti:
//   · il cliente HA il telefono → tocco = chiamata diretta (tel:).
//   · il cliente NON ha il telefono → tocco = pop-up per aggiungerlo; il numero
//     si salva nella SCHEDA del cliente (vale ovunque, non solo per la chiamata
//     di adesso), e volendo parte subito la chiamata.
// Se il lavoro non ha un cliente collegato, questo bottone non compare: la card
// mostra la matita di ripiego (deciso nel componente padre).

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Phone } from 'lucide-react'
import { toast } from 'sonner'
import { runAction } from '@/lib/run-action'
import { setClientPhoneAction } from '@/lib/actions/clients'

const sqStyle: React.CSSProperties = {
  width: 40, height: 40, flexShrink: 0, borderRadius: 10,
  border: '1px solid #d9d7d0', background: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#1a1a2e', textDecoration: 'none', cursor: 'pointer',
}

const telHref = (phone: string) => `tel:${phone.replace(/\s+/g, '')}`

export function LavoroTelefonoButton({
  clientId,
  clientName,
  phone,
}: {
  clientId: string | null
  clientName: string | null
  phone: string | null
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  // Telefono presente → chiamata diretta, nessun pop-up.
  if (phone?.trim()) {
    return (
      <a
        href={telHref(phone.trim())}
        aria-label={clientName ? `Chiama ${clientName}` : 'Chiama il cliente'}
        style={sqStyle}
      >
        <Phone size={17} aria-hidden />
      </a>
    )
  }

  const nome = clientName?.trim() || 'il cliente'

  async function salva(poiChiama: boolean) {
    if (busy) return
    const numero = value.trim()
    setBusy(true)
    const res = await runAction(
      () => setClientPhoneAction(clientId ?? '', numero),
      'salvare il numero',
    )
    setBusy(false)
    if (res?.error) {
      toast.error(res.error)
      return
    }
    toast.success('Numero salvato nella scheda del cliente')
    setOpen(false)
    router.refresh()
    if (poiChiama) {
      // Piccolo respiro: la chiamata parte dopo che il pop-up si è chiuso.
      window.location.href = telHref(numero)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => { setValue(''); setOpen(true) }}
        aria-label={clientName ? `Aggiungi il numero di ${clientName}` : 'Aggiungi il numero del cliente'}
        style={sqStyle}
      >
        <Phone size={17} aria-hidden />
      </button>

      {open && mounted && createPortal(
        <PhoneSheet
          nome={nome}
          value={value}
          onChange={setValue}
          busy={busy}
          inputRef={inputRef}
          onClose={() => !busy && setOpen(false)}
          onSalva={() => salva(false)}
          onSalvaEChiama={() => salva(true)}
        />,
        document.body,
      )}
    </>
  )
}

function PhoneSheet({
  nome, value, onChange, busy, inputRef, onClose, onSalva, onSalvaEChiama,
}: {
  nome: string
  value: string
  onChange: (v: string) => void
  busy: boolean
  inputRef: React.RefObject<HTMLInputElement | null>
  onClose: () => void
  onSalva: () => void
  onSalvaEChiama: () => void
}) {
  // Esc chiude, fuoco automatico sul campo, scroll di fondo bloccato.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t = setTimeout(() => inputRef.current?.focus(), 60)
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; clearTimeout(t) }
  }, [onClose, inputRef])

  const canSave = value.trim().replace(/\D/g, '').length >= 4 && !busy

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 90, background: 'rgba(20,20,40,.45)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: 12,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Aggiungi il numero di telefono"
        style={{
          width: '100%', maxWidth: 420, background: '#fff', borderRadius: 16,
          boxShadow: '0 20px 60px -20px rgba(20,20,40,.5)', padding: '18px 16px 16px',
          marginBottom: 'env(safe-area-inset-bottom, 0px)',
        }}
      >
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1a1a2e' }}>
          Aggiungi il numero di {nome}
        </div>
        <div style={{ fontSize: 12.5, color: 'var(--cc-muted)', marginTop: 3, lineHeight: 1.4 }}>
          Lo salvo nella scheda del cliente, così lo ritrovi sempre.
        </div>

        <input
          ref={inputRef}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && canSave) onSalvaEChiama() }}
          placeholder="esempio: 333 1234567"
          disabled={busy}
          style={{
            width: '100%', marginTop: 14, height: 46, borderRadius: 12,
            border: '1px solid #d9d7d0', padding: '0 12px', fontSize: 16, color: '#1a1a2e',
            background: busy ? '#f6f5f2' : '#fff',
          }}
        />

        <div style={{ display: 'flex', gap: 9, marginTop: 14 }}>
          <button
            type="button"
            onClick={onSalva}
            disabled={!canSave}
            style={{
              flex: 1, height: 46, borderRadius: 12, border: '1px solid #d4d2ca',
              background: '#fff', color: '#1a1a2e', fontSize: 14.5, fontWeight: 600,
              cursor: canSave ? 'pointer' : 'default', opacity: canSave ? 1 : 0.5,
            }}
          >
            {busy ? 'Salvo…' : 'Salva'}
          </button>
          <button
            type="button"
            onClick={onSalvaEChiama}
            disabled={!canSave}
            style={{
              flex: 1.3, height: 46, borderRadius: 12, border: 'none',
              background: '#1a1a2e', color: '#fff', fontSize: 14.5, fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              cursor: canSave ? 'pointer' : 'default', opacity: canSave ? 1 : 0.5,
            }}
          >
            <Phone size={16} aria-hidden /> Salva e chiama
          </button>
        </div>
      </div>
    </div>
  )
}
