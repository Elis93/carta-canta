'use client'

// ============================================================
// SopralluogoForm — editor appunti di cantiere (mockup cantiere §1.2)
// Foglio libero + dettatura + foto + chip rapidi. "Trasforma in
// preventivo" crea la bozza con appunti nelle Note interne.
// ============================================================

import { useEffect, useRef, useState, useTransition } from 'react'
import { runAction } from '@/lib/run-action'
import { useRouter } from 'next/navigation'
import { Camera, Images, Loader2, X, FileText, Navigation, Ruler, Pencil, ChevronDown, CalendarClock } from 'lucide-react'
import { toast } from 'sonner'
import { usePhotoLightbox, ZoomHotspot } from '@/components/shared/PhotoLightbox'
import { ClientAutocomplete } from '@/components/shared/ClientAutocomplete'
import { AddressAutocomplete } from '@/components/shared/AddressAutocomplete'
import type { ClientHit } from '@/components/shared/QuickCreateClientDialog'
import { VoiceInput } from '@/components/shared/VoiceInput'
import { Calcolatrice, type CalcSnapshot } from '@/components/calc/Calcolatrice'
import { AppointmentPicker } from '@/app/(app)/_components/AppointmentPicker'
import { fmtMisura, type Misura } from '@/lib/calc/misure'
import {
  saveSopralluogoAction,
  addWorkPhotoAction,
  deleteWorkPhotoAction,
  createPreventivoFromSopralluogoAction,
} from '@/lib/actions/sopralluoghi'
import { getClientAddressAction } from '@/lib/actions/clients'
import { uploadWorkPhoto } from '@/lib/photos/upload-client'
import { useSignedPhotos } from '@/lib/photos/use-signed-photos'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

const cardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px',
}
const secLabel: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 10,
}
const fieldStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px',
  fontSize: 14, fontFamily: 'inherit', color: '#161616', background: '#fff', boxSizing: 'border-box', outline: 'none',
}

export interface SopralluogoPhoto {
  id: string
  storage_path: string
}

export interface SopralluogoDefaults {
  id: string
  title: string
  address: string | null
  notes: string | null
  /** Appuntamento in formato datetime-local ("YYYY-MM-DDTHH:MM", ora italiana) */
  scheduledAt: string | null
  client: ClientHit | null
  documentId: string | null
  photos: SopralluogoPhoto[]
  /** URL firmate dal server per le foto già presenti (collaboratori in team) */
  photoSignedUrls?: Record<string, string>
  /** Misure calcolate salvate (migration 054) — rimodificabili con un tocco */
  measurements: Misura[]
}

/** Descrizione leggibile degli input di un calcolo ("4 × 3,5 m +10% scarto"). */
function describeCalc(s: CalcSnapshot): string {
  const f = s.fields
  const pct = (v?: string) => (v && v.trim() && v.trim() !== '0' ? ` +${v.trim()}% scarto` : '')
  switch (s.tab) {
    case 'superficie': return `${f.lungh} × ${f.largh} m${pct(f.scarto)}`
    case 'volume':     return `${f.lungh} × ${f.largh} × ${f.alt} m${pct(f.scarto)}`
    case 'piastrelle': return `${f.area} m², piastrella ${f.lato1 || '?'} × ${f.lato2 || '?'} cm${pct(f.scarto)}`
    case 'vernice':    return `${f.area} m², ${f.mani} mani, resa ${f.resa} m²/l`
  }
}

const CHIPS: Array<{ label: string; text: string }> = [
  { label: '➕ Misure', text: 'Misure: ' },
  { label: '➕ Materiali', text: 'Materiali: ' },
  { label: '➕ Manodopera', text: 'Manodopera: ore previste ' },
]

// ── Sezione collassabile — le tre parti del sopralluogo si aprono e si
//    chiudono come le voci del preventivo (Eli, 15 ago 2026: «l3 sezioni non
//    sono divise e chiare e Agenda prende molto spazio»). Chiusa mostra un
//    riepilogo; aperta mostra i campi. Componente a livello di modulo, senza
//    stato proprio (FIX-31): lo stato «aperto» vive nel form.
const secHeaderBtn: React.CSSProperties = {
  width: '100%', display: 'flex', alignItems: 'center', gap: 8,
  border: 'none', background: 'none', padding: 0, cursor: 'pointer',
  fontFamily: 'inherit', textAlign: 'left',
}
const secSummary: React.CSSProperties = {
  flex: 1, minWidth: 0, textAlign: 'right', fontSize: 13, fontWeight: 500,
  color: 'var(--cc-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}

function Sezione({
  icon: Icon, title, summary, open, onToggle, children,
}: {
  icon: React.ComponentType<{ size?: number; style?: React.CSSProperties }>
  title: string
  summary?: string
  open: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div style={cardStyle}>
      <button type="button" onClick={onToggle} style={secHeaderBtn} aria-expanded={open}>
        <Icon size={16} style={{ color: '#8a887f', flexShrink: 0 }} />
        <span style={{ ...secLabel, marginBottom: 0, flexShrink: 0 }}>{title}</span>
        {!open && summary && <span style={secSummary}>{summary}</span>}
        <ChevronDown
          size={18}
          style={{ marginLeft: 'auto', flexShrink: 0, color: '#8a887f', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
        />
      </button>
      {open && <div style={{ marginTop: 12 }}>{children}</div>}
    </div>
  )
}

/** "YYYY-MM-DDTHH:MM" (ora italiana) → "GG/MM · HH:MM" per il riepilogo chiuso. */
function fmtAppuntamento(v: string): string {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!m) return v
  const [, , mm, dd, hh, min] = m
  return `${dd}/${mm} · ${hh}:${min}`
}

export function SopralluogoForm({ defaults }: { defaults: SopralluogoDefaults | null }) {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [sopId, setSopId] = useState<string | null>(defaults?.id ?? null)
  const [title, setTitle] = useState(defaults?.title ?? '')
  const [address, setAddress] = useState(defaults?.address ?? '')
  const [scheduledAt, setScheduledAt] = useState(defaults?.scheduledAt ?? '')
  // Giorno scelto senza ora nel picker: il salvataggio va bloccato con un
  // messaggio, altrimenti l'appuntamento sparirebbe in silenzio (finding M4).
  const [apptIncomplete, setApptIncomplete] = useState(false)
  const [notes, setNotes] = useState(defaults?.notes ?? '')
  const [client, setClient] = useState<ClientHit | null>(defaults?.client ?? null)
  // Indirizzo del cliente (residenza/sede) per offrire il tocco «usa questo»:
  // NON è l'indirizzo del cantiere, è solo un punto di partenza (vedi sotto).
  const [clienteAddress, setClienteAddress] = useState<string | null>(null)
  const [photos, setPhotos] = useState<SopralluogoPhoto[]>(defaults?.photos ?? [])
  // Archivio privato: gli indirizzi delle miniature si chiedono e scadono.
  const photoUrls = useSignedPhotos(photos.map((p) => p.storage_path), defaults?.photoSignedUrls)
  // Foto del sopralluogo: si toccano e si aprono grandi (6 ago). Sono gli
  // appunti presi in cantiere — una miniatura da 76px non basta a rileggerli.
  const { openPhoto, lightbox } = usePhotoLightbox(
    photos.map((p) => ({ src: photoUrls.get(p.storage_path), alt: 'Foto del sopralluogo' })),
  )
  // Misure calcolate (054): restano salvate con i loro input; un tocco le riapre
  const [misure, setMisure] = useState<Misura[]>(defaults?.measurements ?? [])
  const [calcOpen, setCalcOpen] = useState(false)
  const [editingMisura, setEditingMisura] = useState<Misura | null>(null)
  // Sorgente dell'upload in corso: spinner SOLO sul bottone premuto
  const [uploading, setUploading] = useState<'camera' | 'gallery' | null>(null)
  const [pending, startTransition] = useTransition()
  // Spinner solo sul bottone premuto (non su entrambi)
  const [pendingAction, setPendingAction] = useState<'transform' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Titolo e Cliente ora sono card sempre visibili «come Nuovo Preventivo»
  // (Eli, 19 ago). Restano collassabili solo i blocchi che «prendono molto
  // spazio»: Appunti (aperto, è il cuore), Foto (chiuso), Appuntamento (chiuso,
  // ma aperto se ne esiste già uno).
  // Chiusa di default come Foto (Eli 26 ago: «quando apro un nuovo sopralluogo,
  // Appunti e Misure deve essere chiuso»); il riepilogo da chiusa dice se c'è testo.
  const [openAppunti, setOpenAppunti] = useState(false)
  const [openFoto, setOpenFoto] = useState(false)
  const [openAppt, setOpenAppt] = useState(Boolean(defaults?.scheduledAt))
  // Giorno scelto senza ora: il picker deve restare visibile per correggere
  // (finding M4) → si riapre il blocco Appuntamento. Il toggle è anche guardato
  // sotto (non si chiude finché manca l'ora).
  useEffect(() => { if (apptIncomplete) setOpenAppt(true) }, [apptIncomplete])

  // Indirizzo del cliente selezionato: si chiede quando cambia il cliente,
  // per poterlo offrire con un tocco nel campo «Indirizzo del cantiere».
  // Mai riempimento automatico: solo il suggerimento (vedi il chip sotto).
  useEffect(() => {
    let annullato = false
    if (!client?.id) { setClienteAddress(null); return }
    getClientAddressAction(client.id)
      .then((r) => { if (!annullato) setClienteAddress(r.address) })
      .catch(() => { if (!annullato) setClienteAddress(null) })
    return () => { annullato = true }
  }, [client?.id])

  // Titolo di default «Lavoro 20.08 Giorgio G.» (Eli 20 ago): data + nome
  // cliente, così il sopralluogo — e il preventivo/fattura che ne nasce — si
  // riconoscono al volo nelle liste e nella ricerca. Vale SOLO finché il
  // titolo non viene scritto a mano: un titolo digitato vince sempre.
  const autoTitle = (() => {
    const oggi = new Date()
    const dd = String(oggi.getDate()).padStart(2, '0')
    const mm = String(oggi.getMonth() + 1).padStart(2, '0')
    const nome = client
      ? ` ${[client.name, client.surname ? `${client.surname[0].toUpperCase()}.` : null].filter(Boolean).join(' ')}`
      : ''
    return `Lavoro ${dd}.${mm}${nome}`.slice(0, 120)
  })()

  function buildFormData(): FormData {
    const fd = new FormData()
    if (sopId) fd.set('id', sopId)
    fd.set('title', title.trim() || autoTitle)
    fd.set('address', address)
    fd.set('notes', notes)
    fd.set('client_id', client?.id ?? '')
    fd.set('scheduled_at', scheduledAt)
    fd.set('measurements', JSON.stringify(misure))
    return fd
  }

  // Blocca lo scroll di fondo quando la calcolatrice è aperta (stesso
  // pattern di CalcQuantitaButton)
  useEffect(() => {
    if (!calcOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [calcOpen])

  function handleCalcSnapshot(snap: CalcSnapshot) {
    const nuova: Misura = {
      id: editingMisura?.id ?? `m-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      tab: snap.tab,
      fields: snap.fields,
      label: snap.label,
      detail: describeCalc(snap),
      value: snap.value,
      unit: snap.unit,
      decimals: snap.decimals,
    }
    setMisure((prev) => {
      // Re-edit: sostituisce la misura toccata; altrimenti si aggiunge in coda
      const idx = editingMisura ? prev.findIndex((m) => m.id === editingMisura.id) : -1
      if (idx >= 0) return prev.map((m, i) => (i === idx ? nuova : m))
      return [...prev, nuova]
    })
    setCalcOpen(false)
    setEditingMisura(null)
  }

  /** Salva (creandolo se serve) e restituisce l'id — usato anche per le foto. */
  async function ensureSaved(): Promise<string | null> {
    const result = await runAction(() => saveSopralluogoAction(buildFormData()), 'salvare il sopralluogo')
    if (result?.error) {
      setError(result.error)
      return null
    }
    const id = result?.id ?? sopId
    if (id && !sopId) setSopId(id)
    return id ?? null
  }

  const APPT_INCOMPLETE_MSG = 'Hai scelto il giorno dell’appuntamento ma non l’ora. Scegli l’ora, oppure tocca di nuovo il giorno per togliere l’appuntamento.'

  function handleSaveDraft() {
    if (apptIncomplete) { setError(APPT_INCOMPLETE_MSG); return }
    // Un sopralluogo senza NIENTE che lo identifichi non si salva (Eli 20
    // ago): senza cliente né indirizzo poi non si ritrova e non si collega a
    // nulla. La guardia vale solo sul tasto Salva: il salvataggio implicito
    // che precede l'upload delle FOTO resta libero (in cantiere si parte
    // spesso dalle foto, e una foto È già un'informazione).
    if (!client && !address.trim()) {
      setError('Metti almeno il cliente o l\u2019indirizzo del cantiere: senza, il sopralluogo poi non si ritrova.')
      return
    }
    setError(null)
    setPendingAction('save')
    startTransition(async () => {
      const id = await ensureSaved()
      if (!id) return
      toast.success('Sopralluogo salvato', { description: 'Lo ritrovi nella lista Sopralluoghi.', closeButton: true })
      router.push('/sopralluoghi')
      router.refresh()
    })
  }

  function handleTransform() {
    if (apptIncomplete) { setError(APPT_INCOMPLETE_MSG); return }
    setError(null)
    setPendingAction('transform')
    startTransition(async () => {
      const id = await ensureSaved()
      if (!id) return
      // Il redirect avviene nel server action (throw NEXT_REDIRECT)
      const result = await runAction(() => createPreventivoFromSopralluogoAction(id), 'creare il preventivo')
      if (result?.error) setError(result.error)
    })
  }

  async function handleFiles(files: FileList | null, source: 'camera' | 'gallery') {
    if (!files || files.length === 0) return
    // Come Salva/Trasforma (review 25 lug B3): scattare una foto salva il
    // sopralluogo — con un appuntamento a metà (giorno senza ora) lo
    // salverebbe SENZA l'appuntamento, in silenzio.
    if (apptIncomplete) {
      setError('Manca l’ora dell’appuntamento: scegli l’ora (o togli il giorno) prima di aggiungere le foto.')
      return
    }
    setError(null)
    setUploading(source)
    try {
      const id = sopId ?? (await ensureSaved())
      if (!id) return
      if (files.length > 6) {
      toast.info('Puoi caricare al massimo 6 foto per volta: uso le prime 6.', { closeButton: true })
    }
    for (const file of Array.from(files).slice(0, 6)) {
        const uploaded = await uploadWorkPhoto(file)
        if ('error' in uploaded) { setError(uploaded.error); continue }
        const rec = await runAction(() => addWorkPhotoAction({ storagePath: uploaded.path, sopralluogoId: id }), 'allegare la foto')
        if (rec?.error) { setError(rec.error); continue }
        setPhotos((prev) => [...prev, { id: rec?.id ?? uploaded.path, storage_path: uploaded.path }])
      }
    } finally {
      setUploading(null)
    }
  }

  function handleDeletePhoto(photo: SopralluogoPhoto) {
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id))
    // Non fire-and-forget: se l'eliminazione fallisce la foto esiste ancora →
    // rimettila in lista e avvisa (stesso pattern del toggle in WorkPhotosCard).
    deleteWorkPhotoAction(photo.id).then((res) => {
      if (res?.error) {
        setPhotos((prev) => [...prev, photo])
        toast.error('Eliminazione foto non riuscita. Riprova.')
      }
    }).catch(() => {
      setPhotos((prev) => [...prev, photo])
      toast.error('Eliminazione foto non riuscita. Riprova.')
    })
  }

  // Riepiloghi mostrati quando la sezione è chiusa
  const appuntiSummary = (() => {
    const line = notes.split('\n').map((s) => s.trim()).find(Boolean)
    if (line) return line.length > 42 ? line.slice(0, 42) + '…' : line
    if (misure.length) return `${misure.length} ${misure.length === 1 ? 'misura' : 'misure'}`
    return 'Vuoto'
  })()
  const fotoSummary = photos.length ? `${photos.length} foto` : 'Nessuna foto'

  return (
    <div style={{ padding: '14px 15px 16px', display: 'flex', flexDirection: 'column', gap: 13 }}>

      {/* TITOLO — come Nuovo Preventivo: campo leggero, sempre visibile,
          niente etichetta sopra (Eli, 19 ago). */}
      <div style={{ ...cardStyle, padding: '6px 15px' }}>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={autoTitle}
          maxLength={120}
          style={{ width: '100%', border: 'none', outline: 'none', background: 'transparent', padding: '9px 0', fontSize: 15, fontWeight: title.trim() ? 600 : 400, color: '#161616', fontFamily: 'inherit' }}
        />
      </div>

      {/* CLIENTE E CANTIERE — card unita: Cliente, poi l'indirizzo del cantiere
          (Eli, 19 ago — stessa struttura di Nuovo Lavoro). L'appuntamento è una
          card a sé, sotto.
          ⚠️ L'indirizzo del cantiere NON è quello del cliente: il lavoro può
          essere altrove. Se il cliente ha un indirizzo in rubrica, lo si copia
          con un tocco. */}
      <div style={cardStyle}>
        <div style={{ ...secLabel, marginBottom: 12 }}>Cliente e cantiere</div>
        <ClientAutocomplete value={client} onChange={setClient} placeholder="Cerca cliente…" />
        {/* Suggerimenti INTERNI degli indirizzi già usati (Eli 20 ago) — vedi
            AddressAutocomplete. Il wrapper porta il marginTop; il campo tiene
            fieldStyle. */}
        <div style={{ marginTop: 10 }}>
          <AddressAutocomplete
            value={address}
            onChange={setAddress}
            placeholder="Indirizzo del cantiere"
            maxLength={200}
            style={fieldStyle}
          />
        </div>
        {/* Tocco per PARTIRE dall'indirizzo del cliente — solo quando il campo
            è vuoto e il cliente ne ha uno in rubrica. Mai automatico: così il
            campo mostra sempre esattamente ciò che verrà usato, e non nascono
            due indirizzi diversi senza che l'artigiano se ne accorga. */}
        {clienteAddress && !address.trim() && (
          <button
            type="button"
            onClick={() => setAddress(clienteAddress)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, border: '1px solid #e0c98f', borderRadius: 999, background: '#fff', padding: '6px 12px', fontSize: 12.5, fontWeight: 600, color: '#b0863e', cursor: 'pointer', fontFamily: 'inherit', maxWidth: '100%' }}
          >
            <Navigation size={13} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              Usa l’indirizzo di {client?.name?.trim() || 'del cliente'}: {clienteAddress}
            </span>
          </button>
        )}
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

      {/* APPUNTAMENTO — card a sé (Eli, 19 ago: separato dal Cantiere). Chiuso
          di default (blocco che «prende spazio»); resta aperto se ne esiste già
          uno, e non si chiude finché manca l'ora (il picker deve restare visibile). */}
      <div style={cardStyle}>
        <button
          type="button"
          onClick={() => { if (openAppt && apptIncomplete) return; setOpenAppt((v) => !v) }}
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, border: 'none', background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
          aria-expanded={openAppt}
        >
          <CalendarClock size={16} style={{ color: '#8a887f', flexShrink: 0 }} />
          <span style={{ ...secLabel, marginBottom: 0, flexShrink: 0 }}>Appuntamento</span>
          {!openAppt && (
            <span style={secSummary}>
              {scheduledAt ? fmtAppuntamento(scheduledAt) : 'Nessuno'}
            </span>
          )}
          <ChevronDown size={18} style={{ marginLeft: 'auto', flexShrink: 0, color: '#8a887f', transform: openAppt ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
        </button>
        {openAppt && (
          <div style={{ marginTop: 12 }}>
            <AppointmentPicker
              value={scheduledAt}
              onChange={setScheduledAt}
              onIncompleteChange={setApptIncomplete}
              excludeKind="sopralluogo"
              excludeId={sopId}
            />
          </div>
        )}
      </div>

      {/* SEZIONE 2 — Appunti e misure */}
      <Sezione icon={FileText} title="Appunti e misure" summary={appuntiSummary} open={openAppunti} onToggle={() => setOpenAppunti((v) => !v)}>
        <textarea
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value)
            e.currentTarget.style.height = 'auto'
            e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px'
          }}
          ref={(el) => { if (el) { el.style.height = 'auto'; el.style.height = Math.max(128, el.scrollHeight) + 'px' } }}
          placeholder={'Misure… (es. parete 3,20 × 2,60 m)\nMateriali… (es. 2 rubinetti € 45 cad.)\nOre previste… (es. 6 h a € 30/h)'}
          style={{ ...fieldStyle, minHeight: 128, resize: 'none', overflow: 'hidden', lineHeight: 1.6, fontSize: 13 }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
          <VoiceInput
            compact
            className="flex-none text-[#55534b]"
            onTranscript={(text) => setNotes((prev) => (prev ? `${prev}\n${text}` : text))}
          />
          <span style={{ fontSize: 12, color: '#767676' }}>Detta col microfono o scrivi liberamente</span>
        </div>
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 10 }}>
          {CHIPS.map((chip) => (
            <button
              key={chip.label}
              type="button"
              onClick={() => setNotes((prev) => (prev ? `${prev}\n${chip.text}` : chip.text))}
              style={{ border: '1px solid #e3e3e6', borderRadius: 999, background: '#fff', padding: '5px 11px', fontSize: 12, fontWeight: 500, color: '#55534b', cursor: 'pointer', fontFamily: 'inherit' }}
            >
              {chip.label}
            </button>
          ))}
        </div>

        {/* Misure calcolate (richiesta Eli 18 lug): la calcolatrice di
            cantiere direttamente negli appunti. Ogni misura salvata mostra
            IL CALCOLO e il risultato; un tocco la riapre per rimodificarla. */}
        <div style={{ borderTop: '0.5px solid #eee', marginTop: 13, paddingTop: 12 }}>
          {misure.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 10 }}>
              {misure.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#f6f0e2', border: '1px solid #e6dcc2', borderRadius: 11, padding: '8px 10px' }}>
                  <button
                    type="button"
                    onClick={() => { setEditingMisura(m); setCalcOpen(true) }}
                    aria-label={`Rimodifica misura: ${m.label}`}
                    style={{ flex: 1, minWidth: 0, border: 'none', background: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit' }}
                  >
                    <span style={{ display: 'block', fontSize: 14, fontWeight: 600, color: '#1a1a2e' }}>
                      {m.label}: {fmtMisura(m.value, m.decimals)} {m.unit}
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#8a7a52', marginTop: 1 }}>
                      <Pencil size={11} style={{ flexShrink: 0 }} aria-hidden />
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.detail}</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Elimina misura: ${m.label}`}
                    onClick={() => setMisure((prev) => prev.filter((x) => x.id !== m.id))}
                    style={{ flexShrink: 0, width: 26, height: 26, borderRadius: '50%', border: 'none', background: 'rgba(26,26,46,.08)', color: '#55534b', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                  >
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button
            type="button"
            onClick={() => { setEditingMisura(null); setCalcOpen(true) }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid #e0c98f', borderRadius: 999, background: '#fff', padding: '7px 13px', fontSize: 13, fontWeight: 600, color: '#b0863e', cursor: 'pointer', fontFamily: 'inherit' }}
          >
            <Ruler size={14} /> Calcola una misura
          </button>
          {/* Niente riga esplicativa sotto (Eli, 17 ago: eliminata). Il
              comportamento resta: le misure passano nelle Note interne. */}
        </div>
      </Sezione>

      {/* Calcolatrice (stesso overlay centrato di "Calcola quantità", F13) */}
      {calcOpen && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => { setCalcOpen(false); setEditingMisura(null) }}
          style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(20,20,40,.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 12px' }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 440, maxHeight: 'calc(82dvh / var(--cc-zoom, 1))', overflowY: 'auto', background: '#fff', borderRadius: 18, padding: '16px 16px 18px', boxShadow: '0 18px 50px rgba(20,20,40,.35)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{ flex: 1, fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 18, fontWeight: 600, color: '#1a1a2e' }}>
                {editingMisura ? 'Rimodifica la misura' : 'Calcola una misura'}
              </span>
              <button type="button" onClick={() => { setCalcOpen(false); setEditingMisura(null) }} aria-label="Chiudi" style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 4 }}>
                <X size={20} style={{ color: 'var(--cc-muted)' }} />
              </button>
            </div>
            <Calcolatrice
              key={editingMisura?.id ?? 'nuova'}
              initial={editingMisura ? { tab: editingMisura.tab, fields: editingMisura.fields } : undefined}
              onSnapshot={handleCalcSnapshot}
            />
          </div>
        </div>
      )}

      {/* SEZIONE 3 — Foto (chiusa di default: la griglia prende spazio) */}
      <Sezione icon={Camera} title="Foto" summary={fotoSummary} open={openFoto} onToggle={() => setOpenFoto((v) => !v)}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          {photos.map((p, i) => (
            <div key={p.id} style={{ position: 'relative', height: 76, borderRadius: 10, overflow: 'hidden', background: '#f2f2f5' }}>
              {/* Niente src vuoto in attesa dell'indirizzo firmato: resta il riquadro grigio. */}
              {photoUrls.has(p.storage_path) && (
                /* eslint-disable-next-line @next/next/no-img-element -- URL firmata dello storage, niente next/image per le anteprime */
                <img src={photoUrls.get(p.storage_path)} alt="Foto sopralluogo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              )}
              {/* Tocco sulla foto = ingrandimento; il cestino resta sopra e cliccabile. */}
              {photoUrls.has(p.storage_path) && <ZoomHotspot onClick={() => openPhoto(i)} />}
              <button
                type="button"
                aria-label="Elimina foto"
                onClick={() => handleDeletePhoto(p)}
                style={{ position: 'absolute', zIndex: 2, top: 4, right: 4, width: 22, height: 22, borderRadius: '50%', background: 'rgba(22,22,22,.65)', color: '#fff', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
              >
                <X size={13} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            disabled={uploading !== null}
            style={{ height: 76, borderRadius: 10, border: '1.5px dashed #d8d8dc', background: '#fff', color: '#55534b', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer' }}
            aria-label="Scatta una foto adesso"
          >
            {uploading === 'camera' ? <Loader2 size={18} className="animate-spin" /> : <Camera size={19} />}
            <span style={{ fontSize: 11, fontWeight: 600 }}>Scatta</span>
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading !== null}
            style={{ height: 76, borderRadius: 10, border: '1.5px dashed #d8d8dc', background: '#fff', color: 'var(--cc-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, cursor: 'pointer' }}
            aria-label="Scegli foto dalla galleria"
          >
            {uploading === 'gallery' ? <Loader2 size={18} className="animate-spin" /> : <Images size={19} />}
            <span style={{ fontSize: 11, fontWeight: 600 }}>Galleria</span>
          </button>
        </div>
        {/* Galleria (selezione multipla) */}
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => { void handleFiles(e.target.files, 'gallery'); e.target.value = '' }}
        />
        {/* Fotocamera: capture apre direttamente la camera posteriore sul telefono */}
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: 'none' }}
          onChange={(e) => { void handleFiles(e.target.files, 'camera'); e.target.value = '' }}
        />
        {photos.length > 0 && (
          <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, marginTop: 9 }}>
            Tocca una foto per ingrandirla.
          </p>
        )}
        {lightbox}
      </Sezione>

      {error && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{error}</p>}

      {/* Azioni */}
      <button
        type="button"
        onClick={handleTransform}
        disabled={pending}
        style={{
          width: '100%', height: 48, border: 'none', borderRadius: 12, background: '#1a1a2e', color: '#fff',
          fontSize: 14, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', cursor: 'pointer', fontFamily: 'inherit',
          opacity: pending ? 0.7 : 1,
        }}
      >
        {pending && pendingAction === 'transform' ? <Loader2 size={18} className="animate-spin" /> : <FileText size={17} />}
        {defaults?.documentId ? 'Apri il preventivo creato' : 'Trasforma in preventivo'}
      </button>
      <button
        type="button"
        onClick={handleSaveDraft}
        disabled={pending}
        style={{
          width: '100%', height: 48, borderRadius: 12, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e',
          fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 1px 2px rgba(20,20,40,.05)',
        }}
      >
        {pending && pendingAction === 'save' ? <Loader2 size={16} className="animate-spin" style={{ display: 'inline-block', verticalAlign: '-3px', marginRight: 8 }} /> : null}Salva bozza
      </button>

      {/* Niente riga sotto i tasti (Eli, 17 ago: eliminata). Il comportamento
          resta: appunti e misure vanno nelle Note interne del preventivo. */}
    </div>
  )
}
