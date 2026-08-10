'use client'

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, Check, X, PenLine, RotateCcw, FileText } from 'lucide-react'
import { formatDocNumber } from '@/lib/utils'

interface Item {
  description: string | null
  total: number | null
}

interface MobilePublicCardProps {
  token: string
  workspaceName: string
  workspacePiva: string | null
  isPreventivo: boolean
  docLabel: string
  docNumber: string | null
  sentAt: string | null
  subtotal: number | null
  taxAmount: number | null
  vatRateDefault: number | null
  /** true = voci con aliquote IVA diverse: "IVA {default}%" mentirebbe
   * (review 25 lug B3) → etichetta "IVA" senza percentuale. */
  multiVat?: boolean
  total: number | null
  status: string
  clientName: string | null
  items: Item[]
  ownerEmail: string | null
  pdfSrc: string
  paymentTerms: string | null
  /** Scadenza: validità del preventivo / scadenza pagamento della fattura */
  expiresAt?: string | null
  /** Note visibili al cliente */
  notes?: string | null
  /** Sconto globale (per la riga Sconto nel riepilogo) */
  discountPct?: number | null
  discountFixed?: number | null
  /** Marca da bollo (per la riga nel riepilogo) */
  bolloAmount?: number | null
  /** Acconto: richiesto (preventivo) o già ricevuto (fattura) — riga ambra sotto il totale */
  deposit?: {
    kind: 'requested' | 'received'
    label: string
    acconto: number
    saldo: number
  } | null
  /** Opzioni a livelli: selettore proposte (TierPicker), reso prima dei bottoni */
  tierPicker?: React.ReactNode
  /** Etichetta della proposta a cui si riferisce il totale del documento
   *  (la Base; per i documenti legacy con la vecchia ★, quella) — solo con più proposte */
  totalTierLabel?: string
}

function getInitials(name: string): string {
  return name.split(/\s+/).slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase().slice(0, 2)
}

function formatEur(n: number): string {
  return '€\u00A0' + n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function MobilePublicCard({
  token,
  workspaceName,
  workspacePiva,
  isPreventivo,
  docLabel,
  docNumber,
  sentAt,
  subtotal,
  taxAmount,
  vatRateDefault,
  multiVat = false,
  total,
  status,
  clientName,
  items,
  ownerEmail,
  pdfSrc,
  paymentTerms,
  expiresAt,
  notes,
  discountPct,
  discountFixed,
  bolloAmount,
  deposit,
  tierPicker,
  totalTierLabel,
}: MobilePublicCardProps) {
  // ── Accept state ──────────────────────────────────────────────
  const [acceptOpen, setAcceptOpen] = useState(false)
  const [signerName, setSignerName] = useState(clientName ?? '')
  const [agreed, setAgreed] = useState(false)
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

  // Blocca lo scroll del body mentre un bottom-sheet è aperto
  useEffect(() => {
    const open = acceptOpen || declineOpen
    if (open) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [acceptOpen, declineOpen])

  // ── Canvas helpers ────────────────────────────────────────────
  function getCtx() {
    const canvas = canvasRef.current
    if (!canvas) return null
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1a1a2e'
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
      ctx.fillStyle = '#1a1a2e'
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
    if (!agreed) {
      setAcceptError('Accetta i termini del preventivo per procedere')
      return
    }
    const signatureImage = canvasRef.current?.toDataURL('image/png') ?? null
    setAcceptError(null)
    setAcceptLoading(true)
    try {
      const res = await fetch(`/api/p/${token}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signer_name: signerName.trim(),
          signature_image: signatureImage,
          // Opzioni a livelli: proposta scelta nel TierPicker (se presente)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- canale col TierPicker
          tier: (window as any).__cc_tier ?? undefined,
        }),
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
  const initials = getInitials(workspaceName)
  const formattedNum = docNumber ? formatDocNumber(docNumber) : null
  const dateStr = sentAt ? formatShortDate(sentAt) : null
  const vatLabel = !multiVat && vatRateDefault != null ? `IVA ${vatRateDefault}%` : 'IVA'

  return (
    // ⚠️ NIENTE minHeight/background qui (Eli 5 ago: "troppo spazio tra una
    // scritta e la successiva"): con `minHeight: 100vh` il blocco si allungava
    // a tutta la finestra anche a contenuto breve e spingeva le foto mezzo
    // schermo più in basso; il fondo #fafafa creava anche un gradino di colore
    // dove finiva. Lo sfondo continuo lo mette la pagina (p/[token]/page.tsx).
    <div>

      {/* ── Header: avatar + workspace name + P.IVA ─────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '0.5px solid #eee', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 11 }}>
        <div style={{ width: 40, height: 40, borderRadius: 9, background: '#1a1a2e', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, flex: '0 0 auto' }}>
          {initials}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#161616' }}>{workspaceName}</div>
          {workspacePiva && (
            <div style={{ fontSize: 12, color: 'var(--cc-muted)' }}>P.IVA {workspacePiva}</div>
          )}
        </div>
      </div>

      {/* ── Document card ──────────────────────────────────────────────────── */}
      <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)', padding: '18px 16px' }}>
        <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--cc-muted)' }}>
          {docLabel}
        </div>
        {formattedNum && (
          <div style={{ fontSize: 22, fontWeight: 700, color: '#161616', marginTop: 2 }}>{formattedNum}</div>
        )}
        {(clientName || dateStr) && (
          <div style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 3 }}>
            {clientName ? `Per ${clientName}` : ''}{clientName && dateStr ? ' · ' : ''}{dateStr ?? ''}
          </div>
        )}

        {/* Con più proposte gli item qui sono vuoti e il filetto lo mette già
            il ramo del tierPicker: senza questa condizione se ne vedevano DUE
            impilati a ~8px, senza niente in mezzo. */}
        {!tierPicker && <div style={{ height: 1, background: '#eee', margin: '14px -16px' }} />}

        {/* Item rows */}
        {items.map((item, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', fontSize: 14 }}>
            <span style={{ color: '#161616' }}>{item.description ?? '—'}</span>
            {item.total != null && (
              <span style={{ color: '#161616', whiteSpace: 'nowrap' }}>{formatEur(item.total)}</span>
            )}
          </div>
        ))}

        {/* ⚠️ CON PIÙ PROPOSTE il riepilogo NUMERICO qui sopra sparisce (scelta
            di Eli, 9 ago — mockup C): mostrava Subtotale, bollo e «Totale
            proposta Base» PRIMA che una scelta esistesse, cioè un terzo prezzo
            che il cliente non ha chiesto e che non può ancora scegliere. I
            conti di ciascuna proposta stanno dentro la sua card, dove servono. */}
        {!tierPicker && (subtotal != null || taxAmount != null || total != null) && (
          <div style={{ height: 0.5, background: '#eee', margin: '8px -16px' }} />
        )}

        {tierPicker && (
          <>
            <div style={{ height: 0.5, background: '#eee', margin: '8px -16px' }} />
            <p style={{ fontSize: 13, color: '#55534b', margin: '8px 0 2px', lineHeight: 1.5 }}>
              Questo preventivo ha <b>più proposte</b>: qui sotto le trovi tutte, con il
              prezzo di ciascuna. Scegli quella che preferisci.
            </p>
          </>
        )}

        {!tierPicker && subtotal != null && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', fontSize: 14 }}>
            <span style={{ color: '#161616', fontWeight: 400 }}>Subtotale</span>
            <span style={{ color: '#161616', fontWeight: 500 }}>{formatEur(subtotal)}</span>
          </div>
        )}
        {/* Sconto globale (importo calcolato: % sul subtotale + eventuale fisso) */}
        {!tierPicker && (() => {
          const pctAmount = discountPct && subtotal != null ? subtotal * (discountPct / 100) : 0
          // Arrotondato e mai oltre il subtotale, come il motore fiscale
          // (review 25 lug B4 — prima uno sconto anomalo superava il subtotale).
          const discountTotal = Math.min(
            Math.round((pctAmount + (discountFixed ?? 0)) * 100) / 100,
            subtotal ?? Number.POSITIVE_INFINITY
          )
          if (discountTotal <= 0) return null
          return (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', fontSize: 14 }}>
              <span style={{ color: '#161616', fontWeight: 400 }}>
                Sconto{discountPct ? ` (${discountPct}%)` : ''}
              </span>
              <span style={{ color: '#2f8a63', fontWeight: 500 }}>−{formatEur(discountTotal)}</span>
            </div>
          )
        })()}
        {!tierPicker && taxAmount != null && taxAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', fontSize: 14 }}>
            <span style={{ color: '#161616', fontWeight: 400 }}>{vatLabel}</span>
            <span style={{ color: '#161616', fontWeight: 500 }}>{formatEur(taxAmount)}</span>
          </div>
        )}
        {!tierPicker && bolloAmount != null && bolloAmount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', fontSize: 14 }}>
            <span style={{ color: '#161616', fontWeight: 400 }}>Marca da bollo</span>
            <span style={{ color: '#161616', fontWeight: 500 }}>{formatEur(bolloAmount)}</span>
          </div>
        )}

        {!tierPicker && total != null && (
          <>
            <div style={{ height: 1, background: '#e3e3e6', margin: '0 -16px' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', fontSize: 16 }}>
              {/* 18 lug: con più proposte il totale "secco" confondeva — è
                  quello della proposta di riferimento (la Base),
                  e la scelta avviene sotto */}
              <span style={{ color: '#161616', fontWeight: 600 }}>Totale</span>
              <span style={{ color: '#161616', fontWeight: 700 }}>{formatEur(total)}</span>
            </div>
          </>
        )}

        {/* ── Acconto (Acconti — riga ambra sotto il totale) ── */}
        {!tierPicker && deposit && (
          <div style={{ background: '#f5e9d0', borderRadius: 10, padding: '10px 12px', marginTop: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13, fontWeight: 600, color: '#2b2b2b' }}>
              <span>{deposit.label}</span>
              <span style={{ whiteSpace: 'nowrap' }}>{deposit.kind === 'received' ? '−' : ''}{formatEur(deposit.acconto)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: '#8a6f35', marginTop: 4 }}>
              <span>{deposit.kind === 'requested' ? 'Saldo a fine lavori' : 'Saldo da pagare'}</span>
              <span style={{ whiteSpace: 'nowrap' }}>{formatEur(deposit.saldo)}</span>
            </div>
          </div>
        )}

        {/* ── Info importanti: validità/scadenza + termini di pagamento ── */}
        {(expiresAt || paymentTerms) && (
          <>
            <div style={{ height: 0.5, background: '#eee', margin: '4px -16px 0' }} />
            {expiresAt && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0 0', fontSize: 13 }}>
                <span style={{ color: 'var(--cc-muted)' }}>
                  {isPreventivo ? 'Valido fino al' : 'Scadenza pagamento'}
                </span>
                <span style={{ color: '#161616', fontWeight: 600, whiteSpace: 'nowrap' }}>{formatShortDate(expiresAt)}</span>
              </div>
            )}
            {paymentTerms && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 0 0', fontSize: 13 }}>
                <span style={{ color: 'var(--cc-muted)', flexShrink: 0 }}>Termini di pagamento</span>
                <span style={{ color: '#161616', fontWeight: 600, textAlign: 'right' }}>{paymentTerms}</span>
              </div>
            )}
          </>
        )}

        {/* ── Note per il cliente ── */}
        {notes && (
          <div style={{ marginTop: 12, background: '#fafafa', borderRadius: 10, padding: '10px 12px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--cc-muted)', marginBottom: 4 }}>Note</div>
            <div style={{ fontSize: 13, color: '#161616', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{notes}</div>
          </div>
        )}
      </div>

      {/* ── "Vedi il documento completo" — bottone pieno, ben visibile
          (19 lug, Eli: il vecchio link testuale "non si nota") ── */}
      <div style={{ margin: '12px 15px 0' }}>
        <a
          href={pdfSrc}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            minHeight: 48, background: '#fff', border: '1px solid #d8d8dd', borderRadius: 12,
            fontSize: 15, color: '#1a1a2e', fontWeight: 600, textDecoration: 'none',
            boxShadow: '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.12)',
          }}
        >
          <FileText size={17} style={{ flexShrink: 0 }} />
          Vedi il documento completo
        </a>
      </div>

      {/* ── ACCEPTED banner ────────────────────────────────────────────────── */}
      {status === 'accepted' && (
        <div style={{ margin: '16px 15px 0', display: 'flex', alignItems: 'center', gap: 8, background: '#d4efe2', borderRadius: 12, padding: '13px 15px' }}>
          <CheckCircle2 size={18} style={{ color: '#2f8a63', flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 500, color: '#2f8a63' }}>
            {isPreventivo ? 'Preventivo già accettato' : 'Fattura contrassegnata come pagata'}
          </span>
        </div>
      )}

      {/* ── REJECTED banner ────────────────────────────────────────────────── */}
      {status === 'rejected' && (
        <div style={{ margin: '16px 15px 0', display: 'flex', alignItems: 'center', gap: 8, background: '#f5dede', borderRadius: 12, padding: '13px 15px' }}>
          <X size={18} style={{ color: '#b05656', flexShrink: 0 }} />
          <span style={{ fontSize: 14, fontWeight: 500, color: '#b05656' }}>
            {isPreventivo ? 'Preventivo rifiutato' : 'Fattura annullata'}
          </span>
        </div>
      )}

      {/* ── PREVENTIVO ACTIVE: Accetta e firma / Rifiuta ───────────────────── */}
      {isActive && isPreventivo && (
        <>
          {tierPicker && (
            <div style={{ padding: '0 15px', marginTop: 16 }}>{tierPicker}</div>
          )}
          <div style={{ padding: '0 15px', marginTop: 16 }}>
            <button
              onClick={() => { setAcceptError(null); setAcceptOpen(true) }}
              style={{ width: '100%', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 12, height: 50, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 600, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', cursor: 'pointer' }}
            >
              <PenLine size={19} />
              Accetta e firma
            </button>
          </div>
          <div style={{ padding: '0 15px', marginTop: 11 }}>
            <button
              onClick={() => { setDeclineError(null); setDeclineOpen(true) }}
              style={{ width: '100%', border: '1px solid #f0dada', color: '#b05656', background: '#fff', borderRadius: 12, height: 48, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}
            >
              <X size={18} />
              Rifiuta
            </button>
          </div>
        </>
      )}

      {/* ⚠️ Footer e blocco contatti NON stanno più qui (Eli 4 ago): vivono in
          fondo alla PAGINA (p/[token]/page.tsx), dopo foto e "Come pagare",
          nell'ordine "Scrivi a … → generata con Carta Canta → apertura
          registrata". Qui restavano prima di quelle sezioni. */}

      {/* ── BOTTOM-SHEET: Accetta il preventivo (Firma) ────────────────────── */}
      {acceptOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div
            onClick={() => { if (!acceptLoading) setAcceptOpen(false) }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(18,18,28,.5)' }}
          />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '20px 20px 0 0', padding: '18px 16px 20px', boxShadow: '0 -10px 34px rgba(0,0,0,.22)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#161616' }}>Accetta il preventivo</span>
              <button
                type="button"
                onClick={() => { if (!acceptLoading) setAcceptOpen(false) }}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
                aria-label="Chiudi"
              >
                <X size={20} style={{ color: 'var(--cc-muted)' }} />
              </button>
            </div>
            <div style={{ fontSize: 13, color: '#767676', marginBottom: 14, lineHeight: 1.45 }}>
              Conferma per accettare il preventivo{formattedNum ? ` ${formattedNum}` : ''}.
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--cc-muted)', marginBottom: 7 }}>
              Nome e cognome
            </div>
            <input
              type="text"
              placeholder="Mario Rossi"
              value={signerName}
              onChange={(e) => { setSignerName(e.target.value); setAcceptError(null) }}
              disabled={acceptLoading}
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px', fontSize: 14, color: '#161616', marginBottom: 14, outline: 'none', background: '#fff' }}
            />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
              <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--cc-muted)' }}>Firma</div>
              {hasSignature && (
                <button
                  type="button"
                  onClick={clearCanvas}
                  style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--cc-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                >
                  <RotateCcw size={12} />
                  Cancella
                </button>
              )}
            </div>
            <div style={{ position: 'relative', border: '1.5px dashed #d7d4cb', borderRadius: 12, height: 96, marginBottom: 14, overflow: 'hidden' }}>
              {!hasSignature && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', userSelect: 'none', color: 'var(--cc-muted)', fontSize: 13, gap: 7 }}>
                  <PenLine size={18} />
                  Firma qui con il dito
                </div>
              )}
              <canvas
                ref={canvasRef}
                width={600}
                height={192}
                style={{ width: '100%', height: '96px', cursor: 'crosshair', display: 'block', touchAction: 'none' }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
              />
            </div>

            <div
              role="checkbox"
              aria-checked={agreed}
              tabIndex={0}
              onClick={() => { setAgreed((v) => !v); setAcceptError(null) }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAgreed((v) => !v); setAcceptError(null) } }}
              style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16, cursor: 'pointer', userSelect: 'none' }}
            >
              <div style={{ width: 20, height: 20, borderRadius: 5, background: agreed ? '#1a1a2e' : '#fff', border: agreed ? 'none' : '1.5px solid #d7d4cb', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto' }}>
                {agreed && <Check size={14} style={{ color: '#fff' }} />}
              </div>
              <span style={{ fontSize: 13, color: '#161616' }}>Accetto i termini del preventivo</span>
            </div>

            {acceptError && (
              <div style={{ fontSize: 13, color: '#b05656', background: '#f5dede', borderRadius: 8, padding: '8px 10px', marginBottom: 12 }}>
                {acceptError}
              </div>
            )}

            <button
              onClick={handleAccept}
              disabled={acceptLoading}
              style={{ width: '100%', background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 12, height: 50, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 600, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', cursor: acceptLoading ? 'wait' : 'pointer', opacity: acceptLoading ? 0.7 : 1 }}
            >
              {acceptLoading
                ? <Loader2 size={19} className="animate-spin" />
                : <Check size={19} />
              }
              Conferma accettazione
            </button>
          </div>
        </div>
      )}

      {/* ── BOTTOM-SHEET: Rifiuta il preventivo ────────────────────────────── */}
      {declineOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50 }}>
          <div
            onClick={() => { if (!declineLoading) setDeclineOpen(false) }}
            style={{ position: 'absolute', inset: 0, background: 'rgba(18,18,28,.5)' }}
          />
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, background: '#fff', borderRadius: '20px 20px 0 0', padding: '18px 16px 20px', boxShadow: '0 -10px 34px rgba(0,0,0,.22)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: '#161616' }}>Rifiuta il preventivo</span>
              <button
                type="button"
                onClick={() => { if (!declineLoading) setDeclineOpen(false) }}
                style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
                aria-label="Chiudi"
              >
                <X size={20} style={{ color: 'var(--cc-muted)' }} />
              </button>
            </div>
            <div style={{ fontSize: 13, color: '#767676', marginBottom: 14, lineHeight: 1.45 }}>
              Puoi indicare il motivo: aiuta l&rsquo;artigiano a capire.
            </div>

            <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--cc-muted)', marginBottom: 7 }}>
              Motivo
            </div>
            <textarea
              placeholder="Es. prezzo troppo alto, ho scelto un altro fornitore…"
              value={reason}
              onChange={(e) => { setReason(e.target.value); setDeclineError(null) }}
              disabled={declineLoading}
              maxLength={500}
              style={{ width: '100%', boxSizing: 'border-box', border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px', fontSize: 14, color: '#161616', minHeight: 74, resize: 'none', marginBottom: 16, outline: 'none', background: '#fff' }}
            />

            {declineError && (
              <div style={{ fontSize: 13, color: '#b05656', background: '#f5dede', borderRadius: 8, padding: '8px 10px', marginBottom: 12 }}>
                {declineError}
              </div>
            )}

            <button
              onClick={handleDecline}
              disabled={declineLoading}
              style={{ width: '100%', background: '#b05656', color: '#fff', border: 'none', borderRadius: 12, height: 50, boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 15, fontWeight: 600, cursor: declineLoading ? 'wait' : 'pointer', opacity: declineLoading ? 0.7 : 1 }}
            >
              {declineLoading
                ? <Loader2 size={19} className="animate-spin" />
                : <X size={19} />
              }
              Conferma rifiuto
            </button>
          </div>
        </div>
      )}

    </div>
  )
}
