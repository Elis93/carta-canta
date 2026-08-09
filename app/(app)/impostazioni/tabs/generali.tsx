'use client'

import { startTransition, useActionState, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Loader2, ImageIcon, X, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { toast } from 'sonner'
import { updateWorkspaceData, uploadLogo, removeLogo } from '@/lib/actions/workspace'
import { TextSizeToggle } from '@/components/shared/TextSizeToggle'
import { useComuneLookup } from '@/hooks/useComuneLookup'
import type { Database } from '@/types/database'
import { SpiegaCampo } from '@/components/shared/SpiegaCampo'
import { AccontoDefaultField } from '../_components/AccontoDefaultField'

type Workspace = Database['public']['Tables']['workspaces']['Row']

// ── Stili condivisi (mockup) ────────────────────────────────────────────────
const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 14,
  boxShadow: '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)',
  padding: '15px 15px',
}
const sectionLabelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  letterSpacing: '.07em',
  textTransform: 'uppercase',
  color: '#6f6d64',
  marginBottom: 12,
}
const fieldLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--cc-muted)',
  marginBottom: 7,
}
const fieldStyle: React.CSSProperties = {
  border: '1px solid #e3e3e6',
  borderRadius: 10,
  padding: '11px 12px',
  fontSize: 14,
  color: '#161616',
  width: '100%',
  background: '#fff',
  outline: 'none',
  boxSizing: 'border-box',
}

// ⚠️ Niente `userEmail`: l'indirizzo di accesso NON è un dato dell'attività —
// vive in Account e sicurezza › Account, insieme al resto dell'account.
export function ImpostazioniGenerali({ workspace }: { workspace: Workspace }) {
  const [dataState, dataAction, dataPending] = useActionState(updateWorkspaceData, null)
  const [logoState, logoAction, logoPending] = useActionState(uploadLogo, null)
  const { cap, citta, provincia, onCapChange, onCittaChange, onProvinciaChange } = useComuneLookup({
    cap:       workspace.cap       ?? '',
    citta:     workspace.citta     ?? '',
    provincia: workspace.provincia ?? '',
  })
  const [preview, setPreview] = useState<string | null>(workspace.logo_url)
  const [logoChanged, setLogoChanged] = useState(false)
  // ⚠️ Il FILE vive nello STATO, non solo nell'input: React 19 azzera la form
  // dopo OGNI submit (anche "Salva" dei dati) → il file nell'input spariva e
  // il successivo "Carica" partiva a vuoto ("Nessun file selezionato" — bug
  // Eli 2 ago sera). Lo stato sopravvive a qualsiasi submit.
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [removing, setRemoving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (logoState?.success) {
      setLogoChanged(false)
      setLogoFile(null)
      if (logoState.logoUrl) setPreview(logoState.logoUrl)
      // Toast in basso: l'Alert inline in cima al tab restava fuori schermo
      // quando si preme Salva in fondo alla pagina (feedback Eli 5 lug)
      toast.success('Logo aggiornato', { description: 'Il logo comparirà sui tuoi documenti.', closeButton: true })
    }
  }, [logoState])

  useEffect(() => {
    if (dataState?.success) {
      if (logoChanged) {
        // "Salva" NON carica il logo (ha il suo bottone "Carica"): senza
        // questo avviso l'utente credeva di aver salvato anche il logo,
        // che invece andava perso al reload.
        toast.warning('Impostazioni salvate — ma il logo scelto non è ancora caricato', {
          description: 'Premi "Carica" accanto all’anteprima del logo per salvarlo.',
          duration: 10_000, closeButton: true,
        })
      } else {
        toast.success('Impostazioni salvate', { description: 'Le modifiche sono attive.', closeButton: true })
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataState])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoChanged(true)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  // Upload dal FILE nello stato (mai dall'input, che React può aver azzerato)
  function handleUploadLogo() {
    if (!logoFile) return
    const fd = new FormData()
    fd.set('logo', logoFile)
    startTransition(() => logoAction(fd))
  }

  async function handleRemoveLogo() {
    setRemoving(true)
    const result = await removeLogo()
    if (result?.success) {
      setPreview(null)
    } else {
      // Prima l'errore era invisibile: spinner fermo e preview ambigua
      toast.error(result?.error ?? 'Rimozione del logo non riuscita. Riprova.')
    }
    setRemoving(false)
  }

  return (
    <div>
      <form action={dataAction}>
        {dataState?.error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{dataState.error}</AlertDescription>
          </Alert>
        )}

        {/* ── Dati attività ── */}
        <div style={cardStyle}>
          <div style={sectionLabelStyle}>Dati attività</div>

          <div style={{ marginBottom: 14 }}>
            <div style={fieldLabelStyle}>Ragione sociale</div>
            <input
              id="ragione_sociale"
              name="ragione_sociale"
              defaultValue={workspace.ragione_sociale ?? ''}
              required
              style={fieldStyle}
            />
          </div>

          <div id="telefono" style={{ marginBottom: 14, scrollMarginTop: 90 }}>
            <div style={fieldLabelStyle}>Telefono</div>
            <input
              id="phone"
              name="phone"
              type="tel"
              defaultValue={workspace.phone ?? ''}
              placeholder="es. +39 333 1234567"
              style={fieldStyle}
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <div style={fieldLabelStyle}>Indirizzo</div>
            <input
              id="indirizzo"
              name="indirizzo"
              defaultValue={workspace.indirizzo ?? ''}
              placeholder="Via Roma 1"
              style={fieldStyle}
            />
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={fieldLabelStyle}>Città</div>
              <input
                id="citta"
                name="citta"
                placeholder="Milano"
                value={citta}
                onChange={(e) => onCittaChange(e.target.value)}
                style={fieldStyle}
              />
            </div>
            <div style={{ width: 64 }}>
              <div style={fieldLabelStyle}>Prov.</div>
              <input
                id="provincia"
                name="provincia"
                placeholder="MI"
                maxLength={2}
                value={provincia}
                onChange={(e) => onProvinciaChange(e.target.value)}
                style={{ ...fieldStyle, textTransform: 'uppercase' }}
              />
            </div>
            <div style={{ width: 84 }}>
              <div style={fieldLabelStyle}>CAP</div>
              <input
                id="cap"
                name="cap"
                placeholder="20100"
                maxLength={5}
                value={cap}
                onChange={(e) => onCapChange(e.target.value)}
                style={fieldStyle}
              />
            </div>
          </div>

          <SpiegaCampo etichetta="Validità preventivi (giorni)" style={fieldLabelStyle}>
            Giorni entro cui il cliente può accettare il preventivo. Modificabile nel
            singolo preventivo.
          </SpiegaCampo>
          <input
            id="validity_days"
            name="validity_days"
            type="number"
            min="1"
            max="365"
            defaultValue={workspace.validity_days ?? 30}
            style={fieldStyle}
          />
          {/* Preavviso della card "In scadenza" in Home (073, richiesta Eli 7 ago:
              "un artigiano può voler avere in home i documenti che scadono 5
              giorni prima"). Sta accanto alla validità perché sono la stessa
              materia: quanto dura un preventivo, e quanto prima me lo ricordi. */}
          <SpiegaCampo etichetta="Avvisami quando manca (giorni)" style={{ ...fieldLabelStyle, marginTop: 14 }}>
            In Home, nella sezione &laquo;In scadenza&raquo;, compaiono solo i documenti che
            scadono entro questi giorni. Gli altri restano nelle liste Preventivi e Fatture.
          </SpiegaCampo>
          <input
            id="scadenza_alert_days"
            name="scadenza_alert_days"
            type="number"
            min="1"
            max="90"
            defaultValue={workspace.scadenza_alert_days ?? 10}
            style={fieldStyle}
          />
          {/* ── Acconto proposto sui NUOVI preventivi (077, richiesta Eli 9 ago:
              "vorrei che la richiesta di acconto e la percentuale siano settate
              anche di default nelle impostazioni") ──
              ⚠️ Vale SOLO per i preventivi che crei da qui in avanti: quelli già
              scritti non si toccano, altrimenti cambiare un'impostazione
              riscriverebbe documenti già mandati ai clienti. */}
          <SpiegaCampo etichetta="Acconto da chiedere" style={{ ...fieldLabelStyle, marginTop: 14 }}>
            Ogni preventivo <b>nuovo</b>{' '}nasce con questo acconto già impostato, e lo puoi
            cambiare (o togliere) sul singolo preventivo. Scegli <b>Nessun acconto</b>{' '}
            se preferisci deciderlo ogni volta.
            <br /><br />
            <b>Percentuale del totale</b>: si ricalcola da sola su ogni preventivo (30% su
            1.000&nbsp;€ = 300&nbsp;€). <b>Cifra fissa</b>: sempre lo stesso importo, utile
            per un anticipo standard — e su un preventivo più piccolo si ferma al totale.
            <br /><br />
            Non tocca i preventivi già scritti.
          </SpiegaCampo>
          <AccontoDefaultField
            tipoIniziale={workspace.deposit_default_type ?? null}
            valoreIniziale={workspace.deposit_default_value ?? null}
            fieldStyle={fieldStyle}
          />
          {/* Hidden fields richiesti dallo schema */}
          <input type="hidden" name="fiscal_regime" value={workspace.fiscal_regime} />
        </div>

        {/* ── Logo ── */}
        <div style={{ ...cardStyle, marginTop: 14 }} data-tour="logo-card">
          <div id="logo" style={{ ...sectionLabelStyle, scrollMarginTop: 90 }}>Logo</div>

          {logoState?.error && (
            <Alert variant="destructive" className="mb-3">
              <AlertDescription>{logoState.error}</AlertDescription>
            </Alert>
          )}

          {preview ? (
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div style={{ width: 80, height: 80, borderRadius: 12, border: '1px solid #e3e3e6', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' }}>
                <Image
                  src={preview}
                  alt="Logo"
                  width={80}
                  height={80}
                  className="object-contain"
                  unoptimized
                  loading="eager"
                  onError={() => setPreview(null)}
                />
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => inputRef.current?.click()}
                  disabled={logoPending}
                  style={{ fontSize: 13, fontWeight: 500, color: '#1a1a2e', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
                >
                  Cambia logo
                </button>
                <button
                  type="button"
                  onClick={handleRemoveLogo}
                  disabled={removing}
                  style={{ fontSize: 13, fontWeight: 500, color: '#b05656', background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
                >
                  {removing ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
                  Rimuovi logo
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={logoPending}
              style={{
                width: '100%',
                border: '1.5px dashed #d7d4cb',
                borderRadius: 12,
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                color: 'var(--cc-muted)',
                background: 'none',
                cursor: 'pointer',
              }}
            >
              {logoPending ? (
                <Loader2 className="size-6 animate-spin" />
              ) : (
                <ImageIcon size={26} strokeWidth={1.75} aria-hidden />
              )}
              <span style={{ fontSize: 13 }}>Carica il logo (PNG/JPG)</span>
            </button>
          )}

          {logoChanged && (
            <div className="mt-3 flex items-center gap-8">
              {/* Bottone VERO (Eli 2 ago sera: "Carica è piccolo e non è un tasto") */}
              <button
                type="button"
                onClick={handleUploadLogo}
                disabled={logoPending || !logoFile}
                style={{ flex: 1, minHeight: 44, background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 11, fontSize: 14, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontFamily: 'inherit', opacity: logoPending ? 0.75 : 1 }}
              >
                {logoPending ? <Loader2 className="size-4 animate-spin" /> : null}
                {logoPending ? 'Caricamento…' : 'Carica il logo'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPreview(workspace.logo_url)
                  setLogoChanged(false)
                  setLogoFile(null)
                  if (inputRef.current) inputRef.current.value = ''
                }}
                disabled={logoPending}
                style={{ fontSize: 13, fontWeight: 500, color: 'var(--cc-muted)', background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'inherit', flexShrink: 0 }}
              >
                <X className="size-4" /> Annulla
              </button>
            </div>
          )}

          {/* Il file input vive nella stessa form del salvataggio dati; l'upload usa
              formAction per puntare all'action dedicata senza rompere il layout. */}
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* ── Salva ── */}
        <div style={{ marginTop: 16 }}>
          <button
            type="submit"
            disabled={dataPending}
            style={{
              width: '100%',
              background: '#1a1a2e',
              color: '#fff',
              borderRadius: 12,
              height: 50,
              boxSizing: 'border-box',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
              boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)',
            }}
          >
            {dataPending ? (
              <><Loader2 className="size-4 animate-spin" /> Salvataggio…</>
            ) : (
              'Salva'
            )}
          </button>
        </div>
      </form>

      {/* "Testo grande e leggibile": su mobile vive in Altro › Strumenti (F14).
          Su DESKTOP resta qui: la sidebar non ha la voce "Altro", quindi da
          computer questa sarebbe l'unica via per trovare l'interruttore. */}
      <div className="hidden lg:block" style={{ ...cardStyle, marginTop: 14 }}>
        <TextSizeToggle />
      </div>

      {/* ⚠️ "Sicurezza e accesso" NON sta più qui (Eli, 7 ago: "non mi piace
          dentro a Generale"): il blocco con l'impronta e l'uscita da tutti i
          dispositivi riguardano l'ACCOUNT, non i dati dell'attività. Vivono
          in /account › Sicurezza, insieme al resto dell'account. */}
    </div>
  )
}
