'use client'

// Form profilo pubblico marketplace (mockup crescita §3, telefoni 1+1b):
// opt-in, verifica automatica alla pubblicazione, esiti dei controlli in pagina.

import { useEffect, useRef, useState, useTransition } from 'react'
import { runAction } from '@/lib/run-action'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Check, X as XIcon } from 'lucide-react'
import { toast } from 'sonner'
import {
  saveMarketplaceProfileAction,
  publishMarketplaceProfileAction,
  unpublishMarketplaceProfileAction,
  type PublishResult,
} from '@/lib/actions/marketplace'
import { SpiegaCampo } from '@/components/shared/SpiegaCampo'
import { Avviso } from '@/components/shared/Avviso'

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '.05em',
  textTransform: 'uppercase', color: 'var(--cc-muted)', marginBottom: 6,
}
const fieldStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #e3e3e6', borderRadius: 10, padding: '11px 12px',
  fontSize: 14, fontFamily: 'inherit', color: '#161616', background: '#fff',
  boxSizing: 'border-box', outline: 'none',
}

export interface MarketplaceProfileDefaults {
  public_name: string
  trade: string
  city: string
  radius_km: number
  phone: string
  bio: string
  /** Contatti in vetrina (064): opt-in, spenti di default (decisione Eli 2 ago) */
  show_phone: boolean
  public_email: string
  published: boolean
}

export function MarketplaceProfileForm({
  defaults,
  isPro,
  workspaceId,
}: {
  defaults: MarketplaceProfileDefaults
  isPro: boolean
  workspaceId: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  // Quale azione è in corso: lo spinner compare SOLO sul bottone premuto
  // (prima girava anche sull'altro tasto — feedback Eli)
  const [pendingAction, setPendingAction] = useState<'publish' | 'draft' | 'unpublish' | null>(null)
  const [checks, setChecks] = useState<NonNullable<PublishResult>['checks']>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [published, setPublished] = useState(defaults.published)
  // Contatti in vetrina: opt-in (il modulo richiesta resta sempre)
  const [showPhone, setShowPhone] = useState(defaults.show_phone)
  const [showEmail, setShowEmail] = useState(!!defaults.public_email)
  // Dopo router.refresh() i props arrivano aggiornati dal server:
  // riallinea lo stato locale (es. profilo spento da un altro dispositivo).
  useEffect(() => { setPublished(defaults.published) }, [defaults.published])
  // Intento esplicito via onClick: il tasto Invio in un campo fa submit col
  // PRIMO bottone come submitter ("Pubblica") — senza click esplicito si
  // salva solo la bozza, mai una pubblicazione involontaria.
  const intentRef = useRef<'publish' | 'draft'>('draft')

  function collect(form: HTMLFormElement): FormData {
    return new FormData(form)
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = collect(e.currentTarget)
    const wantPublish = published || intentRef.current === 'publish'
    intentRef.current = 'draft'
    setPendingAction(wantPublish ? 'publish' : 'draft')

    startTransition(async () => {
      if (wantPublish) {
        const result = await runAction(() => publishMarketplaceProfileAction(fd), 'pubblicare la vetrina')
        if (result?.error) { setError(result.error); return }
        setChecks(result?.checks)
        if (result?.published) {
          setPublished(true)
          toast.success('Profilo pubblicato', {
            description: 'I clienti della tua zona possono trovarti.',
            closeButton: true,
          })
        }
        router.refresh()
      } else {
        const result = await runAction(() => saveMarketplaceProfileAction(fd), 'salvare il profilo')
        if (result?.error) { setError(result.error); return }
        toast.success('Bozza salvata', { closeButton: true })
        router.refresh()
      }
    })
  }

  function handleUnpublish() {
    setPendingAction('unpublish')
    startTransition(async () => {
      const result = await runAction(() => unpublishMarketplaceProfileAction(), 'togliere la vetrina')
      if (result?.error) { setError(result.error); return }
      setPublished(false)
      setChecks(undefined)
      toast.success('Profilo nascosto', { description: 'Non compari più nella ricerca. Puoi ripubblicarlo quando vuoi.', closeButton: true })
      router.refresh()
    })
  }

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
      <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 10 }}>
          Marketplace
        </div>

        {published ? (
          <Avviso gravita="ok" dentro sotto={<Link href={`/professionisti/${workspaceId}`} style={{ textDecoration: 'underline', fontWeight: 600 }}>Vedi come appare →</Link>}>
            <b>Profilo pubblicato</b> — i clienti della tua zona possono trovarti.
          </Avviso>
        ) : (
          <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, margin: 0 }}>
            Il profilo è <b>spento di default</b>: compili i dati e lo pubblichi quando vuoi.
            Alla pubblicazione i tuoi dati vengono verificati automaticamente.
          </p>
        )}

        {isPro ? (
          <p style={{ fontSize: 12, color: '#b0863e', fontWeight: 600, margin: '10px 0 0' }}>
            ★ Col piano Pro il tuo profilo è <u>In evidenza</u> e compare in cima ai risultati consigliati.
          </p>
        ) : (
          <p style={{ fontSize: 12, color: '#767676', margin: '10px 0 0' }}>
            {/* «consigliati» non è un vezzo: il Pro-first vale nell'ordine
                predefinito, non con «Vicino a me» o altri ordinamenti
                (professionisti/page.tsx) — un claim assoluto sarebbe falso. */}
            I profili Pro compaiono in cima ai risultati consigliati.{' '}
            <Link href="/abbonamento" style={{ color: '#1a1a2e', fontWeight: 600, textDecoration: 'none' }}>Passa a Pro →</Link>
          </p>
        )}

        <div style={{ height: 1, background: '#eee', margin: '13px -15px' }} />

        <label style={fieldLabel} htmlFor="mk-name">Nome pubblico</label>
        <input id="mk-name" name="public_name" defaultValue={defaults.public_name} placeholder="esempio: Idraulica Rossi" maxLength={80} style={fieldStyle} />

        {/* Il suggerimento sta nel punto ⓘ (Eli, 11 ago) */}
        <SpiegaCampo etichetta="Mestiere e servizi" style={{ ...fieldLabel, marginTop: 13 }}>
          Elenca anche i servizi che offri: i clienti ti trovano cercando una sola di queste parole (es. &ldquo;serbatoi&rdquo;).
        </SpiegaCampo>
        <input id="mk-trade" name="trade" defaultValue={defaults.trade} placeholder="esempio: idraulico · serbatoi · cisterne" maxLength={80} style={fieldStyle} />
        {/* Mestieri comuni: un tocco li aggiunge al campo (feedback Eli 22 lug #5) */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 7 }}>
          {['Imbianchino', 'Elettricista', 'Idraulico', 'Muratore', 'Falegname', 'Piastrellista', 'Fabbro', 'Giardiniere'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                const el = document.getElementById('mk-trade') as HTMLInputElement | null
                if (!el) return
                const cur = el.value.trim()
                if (cur.toLowerCase().includes(t.toLowerCase())) return
                const next = cur ? `${cur} · ${t}` : t
                // L'assegnazione via JS bypassa maxLength={80}: oltre il limite
                // il server troncherebbe a metà parola in silenzio — meglio non
                // aggiungere il chip (review 22 lug).
                if (next.length > 80) return
                el.value = next
                el.focus()
              }}
              style={{ padding: '5px 11px', borderRadius: 999, border: '1px solid #e3e3e6', background: '#fff', color: '#1a1a2e', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer' }}
            >
              {t}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 9, marginTop: 13 }}>
          <div style={{ flex: 2, minWidth: 0 }}>
            <label style={fieldLabel} htmlFor="mk-city">Comune</label>
            <input id="mk-city" name="city" defaultValue={defaults.city} placeholder="esempio: Verona" maxLength={80} style={fieldStyle} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <label style={fieldLabel} htmlFor="mk-radius">Raggio (km)</label>
            <input id="mk-radius" name="radius_km" type="number" inputMode="numeric" min={1} max={200} defaultValue={String(defaults.radius_km)} style={fieldStyle} />
          </div>
        </div>

        <label style={{ ...fieldLabel, marginTop: 13 }} htmlFor="mk-phone">Telefono</label>
        <input id="mk-phone" name="phone" defaultValue={defaults.phone} placeholder="esempio: 045 812 3456" maxLength={30} style={fieldStyle} />

        {/* ── Contatti mostrati ai clienti (064, decisione Eli: opt-in, spenti
            di default — il modulo richiesta resta sempre il canale di base) ── */}
        <input type="hidden" name="show_phone" value={showPhone ? 'on' : ''} />
        <div style={{ borderTop: '0.5px solid #eee', marginTop: 14, paddingTop: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: '.05em', textTransform: 'uppercase', color: 'var(--cc-muted)', marginBottom: 4 }}>
            Contatti mostrati ai clienti
          </div>
          <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, margin: '0 0 6px' }}>
            I clienti possono sempre scriverti dal modulo sotto al profilo. In più puoi mostrare:
          </p>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', cursor: 'pointer' }}>
            <input type="checkbox" checked={showPhone} onChange={(e) => setShowPhone(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#1a1a2e' }} />
            <span style={{ flex: 1, fontSize: 14, color: '#161616' }}>
              Il telefono <span style={{ color: '#767676', fontSize: 12 }}>(bottone &laquo;Chiama&raquo; sul profilo)</span>
            </span>
          </label>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0', cursor: 'pointer' }}>
            <input type="checkbox" checked={showEmail} onChange={(e) => setShowEmail(e.target.checked)} style={{ width: 18, height: 18, accentColor: '#1a1a2e' }} />
            <span style={{ flex: 1, fontSize: 14, color: '#161616' }}>
              Un&rsquo;email <span style={{ color: '#767676', fontSize: 12 }}>(meglio se dedicata al lavoro, non quella di accesso)</span>
            </span>
          </label>
          {showEmail ? (
            <input
              name="public_email"
              type="email"
              defaultValue={defaults.public_email}
              placeholder="esempio: info@tuaimpresa.it"
              maxLength={120}
              style={{ ...fieldStyle, marginTop: 4 }}
            />
          ) : (
            /* spento → si salva vuoto = non mostrata */
            <input type="hidden" name="public_email" value="" />
          )}
        </div>

        <label style={{ ...fieldLabel, marginTop: 13 }} htmlFor="mk-bio">Presentazione</label>
        <textarea id="mk-bio" name="bio" defaultValue={defaults.bio} placeholder="esempio: impianti e riparazioni da 15 anni. Intervento entro 24 ore in città." rows={3} maxLength={400} style={{ ...fieldStyle, resize: 'none' }} />
      </div>

      {/* Esiti verifica automatica */}
      {checks && (
        <div style={{ background: '#fff', borderRadius: 14, boxShadow: SH, padding: '14px 15px' }}>
          <div style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', color: '#6f6d64', marginBottom: 8 }}>
            Verifica automatica
          </div>
          {checks.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', alignItems: 'flex-start' }}>
              <span style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c.ok ? '#d4efe2' : '#f5dede', color: c.ok ? '#2f8a63' : '#b05656' }}>
                {c.ok ? <Check size={13} /> : <XIcon size={13} />}
              </span>
              <span>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#161616' }}>{c.label}</span>
                <span style={{ display: 'block', fontSize: 12, color: '#767676', lineHeight: 1.45, marginTop: 1 }}>{c.detail}</span>
              </span>
            </div>
          ))}
          {checks.some((c) => !c.ok) && (
            <p style={{ fontSize: 12, color: '#767676', marginTop: 6 }}>
              {published ? 'Il profilo resta pubblicato coi dati precedenti finché i controlli non passano.' : 'Il profilo resta in bozza finché tutti i controlli non passano.'}
            </p>
          )}
        </div>
      )}

      {error && <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 500 }}>{error}</p>}

      {!published ? (
        <>
          <button
            type="submit"
            value="publish"
            onClick={() => { intentRef.current = 'publish' }}
            disabled={pending}
            style={{ width: '100%', height: 48, border: 'none', borderRadius: 12, background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: 'inherit', opacity: pending ? 0.7 : 1 }}
          >
            {pending && pendingAction === 'publish' ? <Loader2 size={17} className="animate-spin" /> : null} Pubblica profilo
          </button>
          <button
            type="submit"
            value="draft"
            onClick={() => { intentRef.current = 'draft' }}
            disabled={pending}
            style={{ width: '100%', height: 46, borderRadius: 12, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {pending && pendingAction === 'draft' ? <Loader2 size={15} className="animate-spin" /> : null} Salva bozza
          </button>
        </>
      ) : (
        <>
          <button
            type="submit"
            value="publish"
            onClick={() => { intentRef.current = 'publish' }}
            disabled={pending}
            style={{ width: '100%', height: 48, border: 'none', borderRadius: 12, background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', cursor: 'pointer', fontFamily: 'inherit', opacity: pending ? 0.7 : 1 }}
          >
            {pending && pendingAction === 'publish' ? <Loader2 size={17} className="animate-spin" style={{ display: 'inline-block', verticalAlign: '-3px', marginRight: 8 }} /> : null}Aggiorna profilo pubblicato
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleUnpublish}
            style={{ width: '100%', height: 46, borderRadius: 12, border: '1px solid #f0dada', background: '#fff', color: '#b05656', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          >
            {pending && pendingAction === 'unpublish' ? <Loader2 size={15} className="animate-spin" /> : null} Nascondi il profilo
          </button>
        </>
      )}
    </form>
  )
}
