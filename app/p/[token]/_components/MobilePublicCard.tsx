'use client'

import { useRef, useState } from 'react'
import { CheckCircle2, Loader2, Mail, MessageCircle, RotateCcw, Eye, PenLine } from 'lucide-react'
import { formatDocNumber } from '@/lib/utils'

interface Item {
  description: string | null
  total: number | null
}

interface MobilePublicCardProps {
  token: string
  workspaceName: string
  isPreventivo: boolean
  docLabel: string
  docNumber: string | null
  expiresAt: string | null
  total: number | null
  status: string
  clientName: string | null
  items: Item[]
  ownerEmail: string | null
  contactPhone: string | null
  pdfSrc: string
  paymentTerms: string | null
}

function getInitials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2)
}

function formatEur(n: number): string {
  return '€ ' + n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

function normalizePhone(phone: string): string {
  const s = phone.replace(/[^\d+]/g, '')
  if (s.startsWith('+')) return s.slice(1)
  if (s.startsWith('00')) return s.slice(2)
  if (/^3\d{9}$/.test(s)) return `39${s}`
  return s
}

export function MobilePublicCard({
  token,
  workspaceName,
  isPreventivo,
  docLabel,
  docNumber,
  expiresAt,
  total,
  status,
  clientName,
  items,
  ownerEmail,
  contactPhone,
  pdfSrc,
  paymentTerms,
}: MobilePublicCardProps) {
  // ── Accept state ──────────────────────────────────────────────
  const [signerName, setSignerName] = useState('')
  const [hasSignature, setHasSignature] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const isDrawingRef = useRef(false)
  const lastPosRef = useRef<{ x: number; y: number } | null>(null)
  const [acceptLoading, setAcceptLoading] = useState(false)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  // ── Decline state ─────────────────────────────────────────────
  const [declineOpen, setDeclineOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [declineLoading, setDeclineLoading] = useState(false)
  const [declineError, setDeclineError] = useState<string | null>(null)

  // ── Canvas helpers ────────────────────────────────────────────
  function getCtx() {
    const canvas = canvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111827'
    return ctx
  }

  function getPos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) * (canvas.width / rect.width),
      y: (e.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    isDrawingRef.current = true
    const pos = getPos(e)
    lastPosRef.current = pos
    const ctx = getCtx()
    if (ctx) {
      ctx.beginPath()
      ctx.arc(pos.x, pos.y, 1.5, 0, Math.PI * 2)
      ctx.fillStyle = '#111827'
      ctx.fill()
    }
    if (!hasSignature) setHasSignature(true)
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return
    const pos = getPos(e)
    const ctx = getCtx()
    if (!ctx || !lastPosRef.current) return
    ctx.beginPath()
    ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    lastPosRef.current = pos
  }

  function handlePointerUp() {
    isDrawingRef.current = false
    lastPosRef.current = null
  }

  function clearCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  // ── Accept submit ─────────────────────────────────────────────
  async function handleAccept() {
    if (!signerName.trim() || signerName.trim().length < 2) {
      setAcceptError('Inserisci il tuo nome completo (min. 2 caratteri)')
      return
    }
    if (!hasSignature) {
      setAcceptError('Disegna la tua firma nel riquadro')
      return
    }
    const signatureImage = canvasRef.current?.toDataURL('image/png') ?? null
    setAcceptError(null)
    setAcceptLoading(true)
    try {
      const res = await fetch(`/api/p/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signer_name: signerName.trim(), signature_image: signatureImage }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Errore durante la conferma')
      }
      window.location.href = `/p/${token}/grazie`
    } catch (err) {
      setAcceptError(err instanceof Error ? err.message : 'Errore imprevisto')
      setAcceptLoading(false)
    }
  }

  // ── Decline submit ────────────────────────────────────────────
  async function handleDecline() {
    setDeclineError(null)
    setDeclineLoading(true)
    try {
      const res = await fetch(`/api/p/${token}/decline`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? 'Errore durante il rifiuto')
      }
      window.location.href = `/p/${token}/rifiutato`
    } catch (err) {
      setDeclineError(err instanceof Error ? err.message : 'Errore imprevisto')
      setDeclineLoading(false)
    }
  }

  const isActive = status === 'sent' || status === 'viewed'
  const canAccept = signerName.trim().length >= 2 && hasSignature && !acceptLoading
  const initials = getInitials(workspaceName)
  const formattedNum = docNumber ? formatDocNumber(docNumber) : null

  const expiresStr = expiresAt
    ? new Date(expiresAt).toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  return (
    <div style={{ padding: 14 }}>
      <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 3px rgba(20,20,40,.05), 0 16px 38px -16px rgba(20,20,40,.20)' }}>

        {/* Header: avatar + workspace name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '14px 16px', borderBottom: '0.5px solid #e8e6df' }}>
          <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 9, background: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#1d1c19', lineHeight: 1.3 }}>{workspaceName}</div>
            <div style={{ fontSize: 13, color: '#827f74', marginTop: 1 }}>
              ti ha inviato {isPreventivo ? 'un preventivo' : 'una fattura'}
            </div>
          </div>
        </div>

        {/* Doc title + total */}
        <div style={{ padding: '14px 16px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#1d1c19' }}>
              {docLabel}{formattedNum ? ` ${formattedNum}` : ''}
            </div>
            {expiresStr && isPreventivo && (
              <div style={{ fontSize: 13, color: '#827f74', marginTop: 2 }}>Valido fino al {expiresStr}</div>
            )}
          </div>
          {total != null && (
            <span style={{ fontSize: 18, fontWeight: 600, color: '#1d1c19', flexShrink: 0 }}>
              {formatEur(total)}
            </span>
          )}
        </div>

        {/* Items mini-list */}
        {items.length > 0 && (
          <div style={{ margin: '12px 16px 0', borderRadius: 13, boxShadow: '0 1px 2px rgba(20,20,40,.04), 0 6px 16px -8px rgba(20,20,40,.13)', overflow: 'hidden' }}>
            {clientName && (
              <div style={{ background: '#f7f6f2', padding: '11px 13px', borderBottom: '0.5px solid #e8e6df' }}>
                <div style={{ fontSize: 12, color: '#827f74' }}>Per</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1d1c19' }}>{clientName}</div>
              </div>
            )}
            <div style={{ padding: '4px 13px 10px', background: '#fff' }}>
              {items.slice(0, 5).map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'baseline',
                    padding: '8px 0',
                    borderBottom: i < Math.min(items.length, 5) - 1 ? '0.5px solid #e8e6df' : 'none',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 13, color: '#1d1c19', flex: 1 }}>{item.description ?? '—'}</span>
                  {item.total != null && (
                    <span style={{ fontSize: 13, color: '#55534b', flexShrink: 0 }}>{formatEur(item.total)}</span>
                  )}
                </div>
              ))}
              {items.length > 5 && (
                <div style={{ fontSize: 12, color: '#827f74', paddingTop: 6, textAlign: 'center' }}>
                  e altre {items.length - 5} voci
                </div>
              )}
            </div>
          </div>
        )}

        {/* "Vedi documento completo" */}
        <div style={{ margin: '8px 16px 0', textAlign: 'center' }}>
          <a
            href={pdfSrc}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#1a1a2e', fontWeight: 500, textDecoration: 'none' }}
          >
            <Eye size={16} />
            Vedi documento completo
          </a>
        </div>

        {/* ── ACCEPTED ─────────────────────────────────────────────────────── */}
        {status === 'accepted' && (
          <div style={{ margin: '14px 16px 16px', display: 'flex', alignItems: 'center', gap: 8, background: '#f0fdf4', borderRadius: 12, padding: '13px 15px' }}>
            <CheckCircle2 size={18} style={{ color: '#16a34a', flexShrink: 0 }} />
            <span style={{ fontSize: 14, fontWeight: 500, color: '#15803d' }}>
              {isPreventivo ? 'Preventivo già accettato' : 'Fattura contrassegnata come pagata'}
            </span>
          </div>
        )}

        {/* ── REJECTED ─────────────────────────────────────────────────────── */}
        {status === 'rejected' && (
          <div style={{ margin: '14px 16px 16px', display: 'flex', alignItems: 'center', gap: 8, background: '#fef2f2', borderRadius: 12, padding: '13px 15px' }}>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#dc2626' }}>
              {isPreventivo ? 'Preventivo rifiutato' : 'Fattura annullata'}
            </span>
          </div>
        )}

        {/* ── PREVENTIVO ACTIVE: accept + decline ──────────────────────────── */}
        {isActive && isPreventivo && (
          <>
            {/* Accept form card */}
            <div style={{ margin: '14px 16px 0', background: '#fff', borderRadius: 13, boxShadow: '0 1px 2px rgba(20,20,40,.04), 0 6px 16px -8px rgba(20,20,40,.13)', padding: '14px 15px' }}>
              <div style={{ fontSize: 12, letterSpacing: '.07em', textTransform: 'uppercase', color: '#827f74', fontWeight: 500, marginBottom: 10 }}>
                Accetta il preventivo
              </div>

              <label style={{ fontSize: 13, color: '#55534b' }}>Il tuo nome</label>
              <input
                type="text"
                placeholder="Mario Rossi"
                value={signerName}
                onChange={(e) => { setSignerName(e.target.value); setAcceptError(null) }}
                disabled={acceptLoading}
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: 5,
                  marginBottom: 11,
                  border: '0.5px solid #e8e6df',
                  borderRadius: 9,
                  padding: '10px 11px',
                  fontSize: 14,
                  color: '#1d1c19',
                  background: '#fff',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                <label style={{ fontSize: 13, color: '#55534b' }}>Firma</label>
                {hasSignature && (
                  <button
                    type="button"
                    onClick={clearCanvas}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: '#827f74', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    <RotateCcw size={12} />
                    Cancella
                  </button>
                )}
              </div>

              <div style={{ position: 'relative', marginBottom: 13 }}>
                <div style={{ border: '1px dashed #e8e6df', borderRadius: 9, height: 88, overflow: 'hidden', position: 'relative' }}>
                  {!hasSignature && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', userSelect: 'none', color: '#827f74', fontSize: 13, gap: 7 }}>
                      <PenLine size={18} />
                      Firma qui con il dito
                    </div>
                  )}
                  <canvas
                    ref={canvasRef}
                    width={600}
                    height={176}
                    style={{ width: '100%', height: '88px', cursor: 'crosshair', display: 'block', touchAction: 'none' }}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    onPointerLeave={handlePointerUp}
                  />
                </div>
              </div>

              {acceptError && (
                <div style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', borderRadius: 8, padding: '8px 10px', marginBottom: 10 }}>
                  {acceptError}
                </div>
              )}

              <button
                onClick={handleAccept}
                disabled={!canAccept}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 7,
                  background: '#16a34a',
                  borderRadius: 9,
                  padding: 13,
                  border: 'none',
                  cursor: canAccept ? 'pointer' : 'default',
                  opacity: canAccept ? 1 : 0.55,
                }}
              >
                {acceptLoading
                  ? <Loader2 size={18} className="animate-spin" style={{ color: '#fff' }} />
                  : <CheckCircle2 size={18} style={{ color: '#fff' }} />
                }
                <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>Accetto e firmo</span>
              </button>
            </div>

            {/* Decline: button → expand form */}
            {!declineOpen ? (
              <div
                role="button"
                tabIndex={0}
                onClick={() => setDeclineOpen(true)}
                onKeyDown={(e) => e.key === 'Enter' && setDeclineOpen(true)}
                style={{ margin: '10px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: '0.5px solid #e8e6df', borderRadius: 9, padding: 12, cursor: 'pointer', background: '#fff', userSelect: 'none' }}
              >
                <span style={{ fontSize: 14, fontWeight: 500, color: '#55534b' }}>Rifiuta (indica un motivo)</span>
              </div>
            ) : (
              <div style={{ margin: '10px 16px 0', border: '0.5px solid #e8e6df', borderRadius: 9, padding: '13px 14px', background: '#fff' }}>
                <div style={{ fontSize: 13, color: '#55534b', fontWeight: 500, marginBottom: 8 }}>Motivo del rifiuto (facoltativo)</div>
                <textarea
                  placeholder="Es. il prezzo è fuori budget, abbiamo scelto un altro fornitore…"
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); setDeclineError(null) }}
                  disabled={declineLoading}
                  rows={3}
                  maxLength={500}
                  style={{ width: '100%', border: '0.5px solid #e8e6df', borderRadius: 8, padding: '9px 10px', fontSize: 13, resize: 'none', boxSizing: 'border-box', color: '#1d1c19', outline: 'none', marginBottom: 10 }}
                />
                {declineError && (
                  <div style={{ fontSize: 13, color: '#dc2626', background: '#fef2f2', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
                    {declineError}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => { setDeclineOpen(false); setDeclineError(null) }}
                    disabled={declineLoading}
                    style={{ flex: 1, padding: '10px 0', border: '0.5px solid #e8e6df', borderRadius: 8, background: '#fff', fontSize: 13, color: '#55534b', cursor: 'pointer' }}
                  >
                    Annulla
                  </button>
                  <button
                    onClick={handleDecline}
                    disabled={declineLoading}
                    style={{ flex: 1, padding: '10px 0', border: 'none', borderRadius: 8, background: '#fef2f2', fontSize: 13, color: '#dc2626', fontWeight: 600, cursor: declineLoading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  >
                    {declineLoading && <Loader2 size={13} className="animate-spin" />}
                    Conferma rifiuto
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── FATTURA ACTIVE: payment terms ────────────────────────────────── */}
        {isActive && !isPreventivo && paymentTerms && (
          <div style={{ margin: '14px 16px 0', background: '#fffbeb', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: '#92400e' }}>
            Termini di pagamento: <strong>{paymentTerms}</strong>
          </div>
        )}

        {/* Contact button */}
        {(contactPhone || ownerEmail) && (
          <div style={{ margin: '14px 16px 16px' }}>
            {contactPhone ? (
              <a
                href={`https://wa.me/${normalizePhone(contactPhone)}?text=${encodeURIComponent(`Salve, le scrivo riguardo ${isPreventivo ? 'al preventivo' : 'alla fattura'} ricevut${isPreventivo ? 'o' : 'a'} da ${workspaceName}.`)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#f0fdf4', borderRadius: 9, padding: 11, textDecoration: 'none' }}
              >
                <MessageCircle size={17} style={{ color: '#16a34a' }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: '#16a34a' }}>Scrivi su WhatsApp a {workspaceName}</span>
              </a>
            ) : ownerEmail ? (
              <a
                href={`mailto:${ownerEmail}`}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, background: '#f0fdf4', borderRadius: 9, padding: 11, textDecoration: 'none' }}
              >
                <Mail size={17} style={{ color: '#16a34a' }} />
                <span style={{ fontSize: 13, fontWeight: 500, color: '#16a34a' }}>Scrivi a {workspaceName}</span>
              </a>
            ) : null}
          </div>
        )}

      </div>
    </div>
  )
}
