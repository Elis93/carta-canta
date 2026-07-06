'use client'

// Form profilo pubblico marketplace (mockup crescita §3, telefoni 1+1b):
// opt-in, verifica automatica alla pubblicazione, esiti dei controlli in pagina.

import { useState, useTransition } from 'react'
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

const SH = '0 1px 2px rgba(20,20,40,.05),0 8px 24px -10px rgba(20,20,40,.15)'

const fieldLabel: React.CSSProperties = {
  display: 'block', fontSize: 12, fontWeight: 600, letterSpacing: '.05em',
  textTransform: 'uppercase', color: '#8a887f', marginBottom: 6,
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
  published: boolean
}

export function MarketplaceProfileForm({
  defaults,
  isPro,
}: {
  defaults: MarketplaceProfileDefaults
  isPro: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [checks, setChecks] = useState<NonNullable<PublishResult>['checks']>(undefined)
  const [error, setError] = useState<string | null>(null)
  const [published, setPublished] = useState(defaults.published)

  function collect(form: HTMLFormElement): FormData {
    return new FormData(form)
  }

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = collect(e.currentTarget)
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null
    const wantPublish = submitter?.value === 'publish'

    startTransition(async () => {
      if (wantPublish) {
        const result = await publishMarketplaceProfileAction(fd)
        if (result?.error) { setError(result.error); return }
        setChecks(result?.checks)
        if (result?.published) {
          setPublished(true)
          toast.success('Profilo pubblicato', {
            description: 'I clienti della tua zona possono trovarti.',
            duration: 10_000, closeButton: true,
          })
        }
        router.refresh()
      } else {
        const result = await saveMarketplaceProfileAction(fd)
        if (result?.error) { setError(result.error); return }
        toast.success('Bozza salvata', { duration: 10_000, closeButton: true })
        router.refresh()
      }
    })
  }

  function handleUnpublish() {
    startTransition(async () => {
      const result = await unpublishMarketplaceProfileAction()
      if (result?.error) { setError(result.error); return }
      setPublished(false)
      setChecks(undefined)
      toast.success('Profilo nascosto', { description: 'Non compari più nella ricerca. Puoi ripubblicarlo quando vuoi.', duration: 10_000, closeButton: true })
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
          <div style={{ background: '#d4efe2', border: '1px solid #bce3d2', borderRadius: 10, padding: '10px 12px', fontSize: 13, color: '#2f8a63', fontWeight: 600 }}>
            ✓ Profilo pubblicato — i clienti della tua zona possono trovarti.
          </div>
        ) : (
          <p style={{ fontSize: 12, color: '#767676', lineHeight: 1.5, margin: 0 }}>
            Il profilo è <b>spento di default</b>: compili i dati e lo pubblichi quando vuoi.
            Alla pubblicazione i tuoi dati vengono verificati automaticamente.
          </p>
        )}

        {isPro ? (
          <p style={{ fontSize: 12, color: '#b0863e', fontWeight: 600, margin: '10px 0 0' }}>
            ★ Col piano Pro il tuo profilo compare <u>in cima ai risultati</u> ("In evidenza").
          </p>
        ) : (
          <p style={{ fontSize: 12, color: '#767676', margin: '10px 0 0' }}>
            I profili Pro compaiono in cima ai risultati; il tuo è comunque presente.{' '}
            <Link href="/abbonamento" style={{ color: '#1a1a2e', fontWeight: 600, textDecoration: 'none' }}>Passa a Pro →</Link>
          </p>
        )}

        <div style={{ height: 1, background: '#eee', margin: '13px -15px' }} />

        <label style={fieldLabel} htmlFor="mk-name">Nome pubblico</label>
        <input id="mk-name" name="public_name" defaultValue={defaults.public_name} placeholder="Es. Idraulica Rossi" maxLength={80} style={fieldStyle} />

        <label style={{ ...fieldLabel, marginTop: 13 }} htmlFor="mk-trade">Mestiere</label>
        <input id="mk-trade" name="trade" defaultValue={defaults.trade} placeholder="Es. Idraulico · Termoidraulico" maxLength={80} style={fieldStyle} />

        <div style={{ display: 'flex', gap: 9, marginTop: 13 }}>
          <div style={{ flex: 2 }}>
            <label style={fieldLabel} htmlFor="mk-city">Comune</label>
            <input id="mk-city" name="city" defaultValue={defaults.city} placeholder="Es. Verona" maxLength={80} style={fieldStyle} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={fieldLabel} htmlFor="mk-radius">Raggio (km)</label>
            <input id="mk-radius" name="radius_km" inputMode="numeric" defaultValue={String(defaults.radius_km)} style={fieldStyle} />
          </div>
        </div>

        <label style={{ ...fieldLabel, marginTop: 13 }} htmlFor="mk-phone">Telefono</label>
        <input id="mk-phone" name="phone" defaultValue={defaults.phone} placeholder="Es. 045 812 3456" maxLength={30} style={fieldStyle} />

        <label style={{ ...fieldLabel, marginTop: 13 }} htmlFor="mk-bio">Presentazione</label>
        <textarea id="mk-bio" name="bio" defaultValue={defaults.bio} placeholder="Es. Impianti e riparazioni da 15 anni. Intervento entro 24 ore in città." rows={3} maxLength={400} style={{ ...fieldStyle, resize: 'none' }} />
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
              Il profilo resta in bozza finché tutti i controlli non passano.
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
            disabled={pending}
            style={{ width: '100%', height: 48, border: 'none', borderRadius: 12, background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer', fontFamily: 'inherit', opacity: pending ? 0.7 : 1 }}
          >
            {pending ? <Loader2 size={17} className="animate-spin" /> : null} Pubblica profilo
          </button>
          <button
            type="submit"
            value="draft"
            disabled={pending}
            style={{ width: '100%', height: 46, borderRadius: 12, border: '1px solid #e7e7ea', background: '#fff', color: '#1a1a2e', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Salva bozza
          </button>
        </>
      ) : (
        <>
          <button
            type="submit"
            value="publish"
            disabled={pending}
            style={{ width: '100%', height: 48, border: 'none', borderRadius: 12, background: '#1a1a2e', color: '#fff', fontSize: 14, fontWeight: 600, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', cursor: 'pointer', fontFamily: 'inherit', opacity: pending ? 0.7 : 1 }}
          >
            Aggiorna profilo pubblicato
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleUnpublish}
            style={{ width: '100%', height: 46, borderRadius: 12, border: '1px solid #f0dada', background: '#fff', color: '#b05656', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit' }}
          >
            Nascondi il profilo
          </button>
        </>
      )}
    </form>
  )
}
