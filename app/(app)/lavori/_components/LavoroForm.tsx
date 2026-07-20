'use client'

// ============================================================
// LavoroForm — dettaglio/creazione Lavoro (commessa)
// Stati con stepper a chip; note; indirizzo con navigazione Maps.
// Le foto vivono sul preventivo di origine (WorkPhotosCard nel
// dettaglio server, sotto questo form).
// ============================================================

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Navigation, Save } from 'lucide-react'
import { toast } from 'sonner'
import { ClientAutocomplete } from '@/components/shared/ClientAutocomplete'
import type { ClientHit } from '@/components/shared/QuickCreateClientDialog'
import { VoiceInput } from '@/components/shared/VoiceInput'
import { saveLavoroAction, setLavoroStatusAction } from '@/lib/actions/lavori'
import { AppointmentPicker } from '@/app/(app)/_components/AppointmentPicker'
import { LAVORO_STATUS_META, LAVORO_STATUS_ORDER, type LavoroStatus } from './lavoro-status'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'
const cardStyle: React.CSSProperties = { background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }
const secLabel: React.CSSProperties = { fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 10 }
const fieldStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px',
  fontSize: 14, fontFamily: 'inherit', color: '#161616', background: '#fff', boxSizing: 'border-box', outline: 'none',
}

export interface LavoroDefaults {
  id: string
  title: string
  address: string | null
  notes: string | null
  status: LavoroStatus
  /** Appuntamento in formato datetime-local ("YYYY-MM-DDTHH:MM", ora italiana) */
  scheduledAt: string | null
  client: ClientHit | null
}

export function LavoroForm({ defaults }: { defaults: LavoroDefaults | null }) {
  const router = useRouter()
  const [lavId, setLavId] = useState<string | null>(defaults?.id ?? null)
  const [title, setTitle] = useState(defaults?.title ?? '')
  const [address, setAddress] = useState(defaults?.address ?? '')
  const [notes, setNotes] = useState(defaults?.notes ?? '')
  const [scheduledAt, setScheduledAt] = useState(defaults?.scheduledAt ?? '')
  // Giorno scelto senza ora nel picker: blocca il salvataggio (finding M4)
  const [apptIncomplete, setApptIncomplete] = useState(false)
  const [client, setClient] = useState<ClientHit | null>(defaults?.client ?? null)
  const [status, setStatus] = useState<LavoroStatus>(defaults?.status ?? 'da_iniziare')
  const [pending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<'save' | LavoroStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  function handleSave() {
    if (apptIncomplete) {
      setError('Hai scelto il giorno dell’appuntamento ma non l’ora. Scegli l’ora, oppure tocca di nuovo il giorno per togliere l’appuntamento.')
      return
    }
    setError(null)
    setPendingAction('save')
    startTransition(async () => {
      const fd = new FormData()
      if (lavId) fd.set('id', lavId)
      fd.set('title', title)
      fd.set('address', address)
      fd.set('notes', notes)
      fd.set('client_id', client?.id ?? '')
      fd.set('scheduled_at', scheduledAt)
      const result = await saveLavoroAction(fd)
      if (result?.error) { setError(result.error); return }
      toast.success(result?.success ?? 'Lavoro salvato', { closeButton: true })
      if (!lavId && result?.id) {
        setLavId(result.id)
        router.replace(`/lavori/${result.id}`)
      }
      router.refresh()
    })
  }

  function handleStatus(next: LavoroStatus) {
    if (!lavId || next === status) return
    setError(null)
    setPendingAction(next)
    const prev = status
    setStatus(next) // ottimistico
    startTransition(async () => {
      const result = await setLavoroStatusAction(lavId, next)
      if (result?.error) { setStatus(prev); setError(result.error); return }
      toast.success(`Lavoro segnato: ${LAVORO_STATUS_META[next].label}`, { closeButton: true })
      router.refresh()
    })
  }

  return (
    <div style={{ padding: '14px 15px 16px', display: 'flex', flexDirection: 'column', gap: 13 }}>

      {/* Stato — stepper a chip (solo su lavoro esistente) */}
      {lavId && (
        <div style={cardStyle}>
          <div style={secLabel}>Stato del lavoro</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {LAVORO_STATUS_ORDER.map((s) => {
              const meta = LAVORO_STATUS_META[s]
              const active = status === s
              const loading = pending && pendingAction === s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStatus(s)}
                  disabled={pending}
                  style={{
                    borderRadius: 999, padding: '9px 14px', fontSize: 13, fontWeight: 600,
                    border: active ? 'none' : '1px solid #e7e7ea',
                    background: active ? meta.bg : '#fff',
                    color: active ? meta.color : 'var(--cc-muted)',
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {loading ? <Loader2 size={13} className="animate-spin" /> : null}
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Cliente / Cantiere */}
      <div style={cardStyle}>
        <div style={secLabel}>Cliente / Cantiere</div>
        <ClientAutocomplete value={client} onChange={setClient} placeholder="Cerca cliente…" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Titolo lavoro (es. Rifacimento bagno)"
          maxLength={120}
          style={{ ...fieldStyle, marginTop: 10 }}
        />
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="Indirizzo cantiere (facoltativo)"
          maxLength={200}
          style={{ ...fieldStyle, marginTop: 10 }}
        />
        {address.trim() && (
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address.trim())}`}
            target="_blank"
            rel="noopener noreferrer"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 13, fontWeight: 600, color: '#1a1a2e', textDecoration: 'none' }}
          >
            <Navigation size={14} /> Naviga con Google Maps
          </a>
        )}
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--cc-muted)', marginBottom: 6 }}>
            Prossimo intervento <span style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 400 }}>(facoltativo)</span>
          </div>
          <AppointmentPicker
            value={scheduledAt}
            onChange={setScheduledAt}
            onIncompleteChange={setApptIncomplete}
            excludeKind="lavoro"
            excludeId={lavId}
          />
        </div>
      </div>

      {/* Note di cantiere */}
      <div style={cardStyle}>
        <div style={secLabel}>Note di cantiere</div>
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value)
            e.currentTarget.style.height = 'auto'
            e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'
          }}
          ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = Math.max(96, el.scrollHeight) + 'px' } }}
          placeholder={'Materiali usati, ore, cose da ricordare…\n(private: il cliente non le vede)'}
          style={{ ...fieldStyle, minHeight: 96, resize: 'none', overflow: 'hidden', lineHeight: 1.6, fontSize: 13 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <VoiceInput
            compact
            className="flex-none text-[#55534b]"
            onTranscript={(text) => setNotes((prev) => (prev ? `${prev}\n${text}` : text))}
          />
          <span style={{ fontSize: 12, color: '#767676' }}>Detta col microfono o scrivi liberamente</span>
        </div>
      </div>

      {error && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{error}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={pending}
        style={{
          width: '100%', height: 48, border: 'none', borderRadius: 12, background: '#1a1a2e', color: '#fff',
          fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', cursor: 'pointer', fontFamily: 'inherit',
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending && pendingAction === 'save' ? <Loader2 size={18} className="animate-spin" /> : <Save size={17} />}
        {lavId ? 'Salva modifiche' : 'Crea lavoro'}
      </button>
    </div>
  )
}
