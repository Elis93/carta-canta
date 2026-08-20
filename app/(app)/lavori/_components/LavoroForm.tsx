'use client'

// ============================================================
// LavoroForm — dettaglio/creazione Lavoro (commessa)
// Stati con stepper a chip; note; indirizzo con navigazione Maps.
// Le foto vivono sul preventivo di origine (WorkPhotosCard nel
// dettaglio server, sotto questo form).
// ============================================================

import { useEffect, useState, useTransition } from 'react'
import { runAction } from '@/lib/run-action'
import { useRouter } from 'next/navigation'
import { ChevronDown, Loader2, Navigation, Save } from 'lucide-react'
import { toast } from 'sonner'
import { ClientAutocomplete } from '@/components/shared/ClientAutocomplete'
import { AddressAutocomplete } from '@/components/shared/AddressAutocomplete'
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

/** "YYYY-MM-DDTHH:MM" (ora italiana) → "GG/MM · HH:MM" per il riepilogo chiuso. */
function fmtAppuntamento(v: string): string {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return v
  const [, , mm, dd, hh, min] = m
  return `${dd}/${mm} · ${hh}:${min}`
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
  // «Prossimo intervento» apribile/chiudibile con la freccia (Eli, 20 ago):
  // chiuso di default, aperto se un appuntamento esiste già. Non si chiude
  // finché manca l'ora — il picker deve restare visibile per correggere.
  const [openAppt, setOpenAppt] = useState(Boolean(defaults?.scheduledAt))
  useEffect(() => { if (apptIncomplete) setOpenAppt(true) }, [apptIncomplete])
  const [client, setClient] = useState<ClientHit | null>(defaults?.client ?? null)
  const [status, setStatus] = useState<LavoroStatus>(defaults?.status ?? 'da_iniziare')
  const [pending, startTransition] = useTransition()
  const [pendingAction, setPendingAction] = useState<'save' | LavoroStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Errore del CAMBIO STATO: mostrato sotto le pillole, dove è avvenuto il
  // tap — in fondo al form non si vedrebbe (es. guardia «Fatturato» 3 ago).
  const [statusError, setStatusError] = useState<string | null>(null)

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
      const result = await runAction(() => saveLavoroAction(fd), 'salvare il lavoro')
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
    setStatusError(null)
    setPendingAction(next)
    const prev = status
    setStatus(next) // ottimistico
    startTransition(async () => {
      const result = await runAction(() => setLavoroStatusAction(lavId, next), 'cambiare lo stato del lavoro')
      if (result?.error) { setStatus(prev); setStatusError(result.error); return }
      toast.success(`Lavoro segnato: ${LAVORO_STATUS_META[next].label}`, { closeButton: true })
      router.refresh()
    })
  }

  return (
    <div style={{ padding: '14px 15px 16px', display: 'flex', flexDirection: 'column', gap: 13 }}>

      {/* TITOLO — card a sé in cima, come Nuovo Preventivo (Eli, 19 ago). */}
      <div style={{ ...cardStyle, padding: '6px 15px' }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Metti il titolo (es. Rifacimento bagno)"
          maxLength={120}
          style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', padding: '9px 0', fontSize: 15, fontWeight: title.trim() ? 600 : 400, color: '#161616', fontFamily: 'inherit' }}
        />
      </div>

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
                // 2 ago sera (Eli: "quando clicco si allarga e poi torna stretto"):
                // dimensione STABILE in ogni stato — il bordo c'è sempre (sulla
                // attiva è del colore dello sfondo, invisibile ma occupa gli
                // stessi 2px) e lo spinner sta in OVERLAY sul testo attenuato,
                // non in linea (prima allargava la pillola di ~19px).
                <button
                  key={s}
                  type="button"
                  onClick={() => handleStatus(s)}
                  disabled={pending}
                  style={{
                    position: 'relative',
                    borderRadius: 999, padding: '9px 14px', fontSize: 13, fontWeight: 600,
                    border: `1px solid ${active ? meta.bg : '#e7e7ea'}`,
                    background: active ? meta.bg : '#fff',
                    color: active ? meta.color : 'var(--cc-muted)',
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center',
                  }}
                >
                  {loading && (
                    <Loader2
                      size={13}
                      className="animate-spin"
                      style={{ position: 'absolute', left: '50%', top: '50%', margin: '-6.5px 0 0 -6.5px' }}
                    />
                  )}
                  <span style={{ opacity: loading ? 0.3 : 1 }}>{meta.label}</span>
                </button>
              )
            })}
          </div>
          {statusError && (
            <p style={{ fontSize: 13, color: '#b05656', fontWeight: 500, marginTop: 9, lineHeight: 1.45 }}>
              {statusError}
            </p>
          )}
        </div>
      )}

      {/* CLIENTE E CANTIERE — card unita: Cliente, poi l'indirizzo del cantiere
          (Eli, 19 ago). L'appuntamento è una card a sé, sotto. */}
      <div style={cardStyle}>
        <div style={secLabel}>Cliente e cantiere</div>
        <ClientAutocomplete value={client} onChange={setClient} placeholder="Cerca cliente…" />
        {/* Suggerimenti INTERNI degli indirizzi già usati (Eli 20 ago). */}
        <div style={{ marginTop: 10 }}>
          <AddressAutocomplete
            value={address}
            onChange={setAddress}
            placeholder="Indirizzo del cantiere"
            maxLength={200}
            style={fieldStyle}
          />
        </div>
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
      </div>

      {/* PROSSIMO INTERVENTO — card a sé, separata dal Cantiere (Eli, 19 ago;
          senza «facoltativo»). Apribile/chiudibile con la freccia (20 ago):
          chiusa mostra la data scelta o «Nessuno». */}
      <div style={cardStyle}>
        <button
          type="button"
          onClick={() => { if (openAppt && apptIncomplete) return; setOpenAppt((v) => !v) }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
          aria-expanded={openAppt}
        >
          <span style={{ ...secLabel, marginBottom: 0, flexShrink: 0 }}>Prossimo intervento</span>
          {!openAppt && (
            <span style={{ flex: 1, minWidth: 0, textAlign: 'right', fontSize: 13, fontWeight: 500, color: 'var(--cc-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {scheduledAt ? fmtAppuntamento(scheduledAt) : 'Nessuno'}
            </span>
          )}
          <ChevronDown
            size={18}
            style={{ marginLeft: 'auto', flexShrink: 0, color: '#8a887f', transform: openAppt ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
          />
        </button>
        {openAppt && (
          <div style={{ marginTop: 12 }}>
            <AppointmentPicker
              value={scheduledAt}
              onChange={setScheduledAt}
              onIncompleteChange={setApptIncomplete}
              excludeKind="lavoro"
              excludeId={lavId}
            />
          </div>
        )}
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
