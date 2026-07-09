'use client'

// ============================================================
// Card "Elimina account" + pop-up di conferma (Impostazioni › Generale).
// Spiega cosa viene cancellato e cosa resta (fatture 10 anni), offre il
// download dei dati, e richiede di digitare ELIMINA. Irreversibile.
// ============================================================

import { useState, useTransition } from 'react'
import { AlertTriangle, Download, Loader2, X } from 'lucide-react'
import { deleteAccountAction } from '@/lib/actions/account'

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 14,
  boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)',
  padding: '14px 15px',
}

export function DeleteAccountCard() {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [pending, startTransition] = useTransition()

  function handleDelete() {
    setError(null)
    startTransition(async () => {
      const res = await deleteAccountAction(confirm)
      if (res?.error) { setError(res.error); return }
      // Successo: account eliminato, sessione chiusa. Mostra il congedo e
      // rimanda alla home (che rimanderà al login, sessione ormai invalida).
      setDone(true)
      setTimeout(() => { window.location.href = '/' }, 2500)
    })
  }

  return (
    <>
      <div style={{ ...cardStyle, marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
        <AlertTriangle size={20} style={{ color: '#b05656', flexShrink: 0 }} aria-hidden />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#161616' }}>Elimina account</div>
          <div style={{ fontSize: 12, color: '#767676', marginTop: 1 }}>
            Cancella l&rsquo;account e i dati personali. Le fatture restano conservate per legge (10 anni).
          </div>
        </div>
        <button
          type="button"
          onClick={() => { setOpen(true); setConfirm(''); setError(null) }}
          style={{ flexShrink: 0, border: '1px solid #e6b3b3', borderRadius: 10, background: '#fff', color: '#b05656', fontSize: 13, fontWeight: 600, padding: '9px 14px', cursor: 'pointer' }}
        >
          Elimina
        </button>
      </div>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={(e) => { if (e.target === e.currentTarget && !pending && !done) setOpen(false) }}
        >
          <div style={{ background: '#fff', borderRadius: 16, maxWidth: 440, width: '100%', padding: '20px 20px 18px', boxShadow: '0 20px 60px -15px rgba(0,0,0,.4)' }}>
            {done ? (
              <div style={{ textAlign: 'center', padding: '18px 0' }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: '#161616' }}>Account eliminato</div>
                <div style={{ fontSize: 14, color: '#55534b', marginTop: 8, lineHeight: 1.5 }}>
                  I tuoi dati personali sono stati cancellati. Grazie di aver provato Carta Canta.
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
                  <span style={{ flex: 1, fontSize: 17, fontWeight: 700, color: '#161616' }}>Vuoi eliminare l&rsquo;account?</span>
                  <button type="button" aria-label="Chiudi" onClick={() => !pending && setOpen(false)} style={{ border: 'none', background: 'none', padding: 4, cursor: 'pointer', color: '#8a887f' }}>
                    <X size={18} />
                  </button>
                </div>

                <p style={{ fontSize: 13.5, color: '#55534b', lineHeight: 1.6, margin: '0 0 10px' }}>
                  Verranno <strong>eliminati subito</strong>: account e accesso, clienti, catalogo,
                  sopralluoghi, lavori, foto, preventivi, spese e preferenze.
                </p>
                <p style={{ fontSize: 13.5, color: '#55534b', lineHeight: 1.6, margin: '0 0 12px' }}>
                  Le <strong>fatture</strong>, per obbligo di legge, restano conservate <strong>10 anni</strong> e
                  non saranno più usate per altro. Ti consigliamo di <strong>scaricare i tuoi dati</strong> ora.
                </p>

                <a
                  href="/api/account/export"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: '1px solid #e7e7ea', borderRadius: 10, background: '#fff', color: '#1a1a2e', fontSize: 13, fontWeight: 600, padding: '9px 13px', textDecoration: 'none', marginBottom: 14 }}
                >
                  <Download size={15} /> Scarica i tuoi dati
                </a>

                <div style={{ fontSize: 12, fontWeight: 600, color: '#8a887f', letterSpacing: '.03em', marginBottom: 6 }}>
                  Scrivi <span style={{ color: '#b05656' }}>ELIMINA</span> per confermare
                </div>
                <input
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="ELIMINA"
                  autoComplete="off"
                  disabled={pending}
                  style={{ width: '100%', border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px', fontSize: 14, color: '#161616', background: '#fff', boxSizing: 'border-box', outline: 'none' }}
                />

                {error && <p style={{ fontSize: 13, color: '#b05656', fontWeight: 500, marginTop: 8 }}>{error}</p>}

                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    disabled={pending}
                    style={{ flex: 1, border: '1px solid #e7e7ea', borderRadius: 12, background: '#fff', color: '#161616', fontSize: 14, fontWeight: 600, padding: '12px', cursor: 'pointer' }}
                  >
                    Annulla
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={pending || confirm.trim().toUpperCase() !== 'ELIMINA'}
                    style={{ flex: 1, border: 'none', borderRadius: 12, background: '#b05656', color: '#fff', fontSize: 14, fontWeight: 600, padding: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: (pending || confirm.trim().toUpperCase() !== 'ELIMINA') ? 0.6 : 1 }}
                  >
                    {pending && <Loader2 size={16} className="animate-spin" />}
                    Elimina definitivamente
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
