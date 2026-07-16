'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, ChevronDown, ChevronUp, Plus, Loader2, Crown, Lock, Pencil } from 'lucide-react'
import { TemplatePreview } from './TemplatePreview'
import {
  setDefaultTemplateAction,
  clearDefaultTemplateAction,
  createBlankCustomTemplateAction,
  editDefaultTemplateAction,
} from '@/lib/actions/templates'

const CARD_SHADOW = '0 1px 2px rgba(20,20,40,.05), 0 8px 24px -10px rgba(20,20,40,.15)'

export interface MobileTemplateItem {
  /** id del template ('default' fittizio per la riga Default di sistema) */
  id: string
  name: string
  presetKey: string
  presetLabel: string
  color: string
  font: string
  showLogo: boolean
  showWatermark: boolean
  logoPosition: 'left' | 'right'
  legalNotice: string
  isActive: boolean
  /** href editor per i template custom (il Default usa una server action find-or-create) */
  editHref: string
  kind: 'default' | 'custom'
  /** true = stile Pro (Bold/Tecnico/Elegante) su piano Free */
  locked: boolean
}

/**
 * Lista template (mobile) — accordion secondo il mockup:
 * - tap sulla card → si espande UN'anteprima grande (documento reale) + "Usa questo"/"In uso" + "Modifica";
 * - ri-tap chiude; una sola card aperta alla volta;
 * - riga chiusa: miniatura + nome + "Stile: X" + badge (Predefinito / 🔒Pro) + chevron — niente tasti.
 */
export function MobileTemplateList({
  items,
  isPro,
  workspaceName,
  logoUrl,
}: {
  items: MobileTemplateItem[]
  isPro: boolean
  workspaceName: string
  logoUrl?: string | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [openId, setOpenId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [openingEditor, setOpeningEditor] = useState(false)

  function toggleOpen(id: string) {
    setOpenId((cur) => (cur === id ? null : id))
  }

  function selectActive(item: MobileTemplateItem) {
    if (item.isActive || pending) return
    setBusyId(item.id)
    startTransition(async () => {
      if (item.kind === 'default') await clearDefaultTemplateAction()
      else await setDefaultTemplateAction(item.id)
      setBusyId(null)
      router.refresh()
    })
  }

  function createNew() {
    if (creating || !isPro) return
    setCreating(true)
    startTransition(async () => {
      await createBlankCustomTemplateAction()
      // il redirect all'editor avviene lato server
    })
  }

  function openDefaultEditor() {
    if (openingEditor) return
    setOpeningEditor(true)
    startTransition(async () => {
      await editDefaultTemplateAction()
      // redirect all'editor lato server
    })
  }

  return (
    <div>
      {/* Hint sotto l'header */}
      <div style={{ margin: '13px 15px 2px', fontSize: 12, color: '#767676', lineHeight: 1.45 }}>
        Tocca un template per vederlo in grande e sceglierlo.
      </div>

      {items.map((item) => {
        const open = openId === item.id
        return (
          <div
            key={item.id}
            style={{
              margin: '12px 15px 0',
              background: '#fff',
              borderRadius: 14,
              boxShadow: CARD_SHADOW,
              border: open ? '1.5px solid #1a1a2e' : undefined,
              overflow: 'hidden',
            }}
          >
            {/* Riga (chiusa/aperta) — tutta tappabile */}
            <button
              type="button"
              onClick={() => toggleOpen(item.id)}
              aria-expanded={open}
              style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '13px 15px',
                width: '100%', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
              }}
            >
              {/* miniatura documento (barra intestazione = colore brand) */}
              <div style={{ width: 44, height: 56, borderRadius: 7, border: '1px solid #eee', background: '#fff', flexShrink: 0, overflow: 'hidden', padding: 5, boxSizing: 'border-box' }}>
                <div style={{ height: 8, borderRadius: 2, background: item.color, marginBottom: 5 }} />
                <div style={{ height: 4, borderRadius: 2, background: '#e3e3e6', marginBottom: 3, width: '80%' }} />
                <div style={{ height: 4, borderRadius: 2, background: '#e3e3e6', width: '60%' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, color: '#161616', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.name}
                </div>
                <div style={{ fontSize: 13, color: 'var(--cc-muted)', marginTop: 1 }}>Stile: {item.presetLabel}</div>
              </div>
              {item.isActive ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#2f8a63', background: '#d4efe2', borderRadius: 999, padding: '3px 9px', flexShrink: 0 }}>
                  Predefinito
                </span>
              ) : item.locked ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#b08d3e', flexShrink: 0 }}>
                  <Lock size={12} /> Pro
                </span>
              ) : null}
              {open
                ? <ChevronUp size={19} style={{ color: '#1a1a2e', flexShrink: 0 }} />
                : <ChevronDown size={19} style={{ color: 'var(--cc-muted)', flexShrink: 0 }} />}
            </button>

            {/* Pannello espanso: anteprima documento reale + azioni */}
            {open && (
              <>
                <div style={{ height: 0.5, background: '#eee', margin: '0 15px' }} />
                <div style={{ padding: '14px 15px', background: '#fafafa' }}>
                  <TemplatePreview
                    presetKey={item.presetKey}
                    color={item.color}
                    font={item.font}
                    showLogo={item.showLogo}
                    showWatermark={item.showWatermark}
                    logoPosition={item.logoPosition}
                    legalNotice={item.legalNotice}
                    workspaceName={workspaceName}
                    logoUrl={logoUrl}
                    showExampleBadge={false}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, padding: '0 15px 15px' }}>
                  {item.isActive ? (
                    <div style={{ flex: 1, border: '1px solid #cfe8dc', color: '#2f8a63', background: '#eaf6f0', borderRadius: 11, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 14, fontWeight: 600 }}>
                      <Check size={16} /> In uso
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => selectActive(item)}
                      disabled={pending}
                      style={{ flex: 1, background: '#1a1a2e', color: '#fff', border: 'none', borderRadius: 11, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 14, fontWeight: 600, boxShadow: '0 6px 16px -6px rgba(26,26,46,.5)', cursor: pending ? 'wait' : 'pointer' }}
                    >
                      {busyId === item.id ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Usa questo
                    </button>
                  )}
                  {item.kind === 'default' ? (
                    <button
                      type="button"
                      onClick={openDefaultEditor}
                      disabled={openingEditor}
                      style={{ flex: 1, border: '1px solid #e7e7ea', color: '#1a1a2e', borderRadius: 11, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 14, fontWeight: 500, background: '#fff', cursor: openingEditor ? 'wait' : 'pointer' }}
                    >
                      {openingEditor
                        ? <Loader2 size={16} className="animate-spin" style={{ color: '#55534b' }} />
                        : <Pencil size={16} style={{ color: '#55534b' }} />} Modifica
                    </button>
                  ) : (
                    <Link
                      href={item.editHref}
                      style={{ flex: 1, border: '1px solid #e7e7ea', color: '#1a1a2e', borderRadius: 11, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, fontSize: 14, fontWeight: 500, background: '#fff', textDecoration: 'none' }}
                    >
                      <Pencil size={16} style={{ color: '#55534b' }} /> Modifica
                    </Link>
                  )}
                </div>
              </>
            )}
          </div>
        )
      })}

      {/* Nuovo template — attivo per Pro, lucchetto per Free */}
      {isPro ? (
        <button
          type="button"
          onClick={createNew}
          disabled={creating}
          style={{ margin: '12px 15px 0', width: 'calc(100% - 30px)', border: '1.5px dashed #b9c3d6', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, color: '#1a1a2e', background: 'none', cursor: creating ? 'wait' : 'pointer' }}
        >
          {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
          <span style={{ fontSize: 14, fontWeight: 600 }}>Nuovo template</span>
        </button>
      ) : (
        /* Free: il tap porta all'abbonamento (prima era un box morto senza azione) */
        <Link href="/abbonamento" style={{ margin: '12px 15px 0', border: '1.5px dashed #d7d4cb', borderRadius: 14, padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, color: 'var(--cc-muted)', textDecoration: 'none' }}>
          <Plus size={18} />
          <span style={{ fontSize: 14, fontWeight: 500 }}>Nuovo template</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#b08d3e', marginLeft: 2 }}>
            <Lock size={12} /> Pro
          </span>
        </Link>
      )}

      {/* Upsell Free — card bordo oro */}
      {!isPro && (
        <div style={{ margin: '14px 15px 0', background: '#fff', borderRadius: 14, boxShadow: CARD_SHADOW, borderLeft: '3px solid #c9a44c', padding: '13px 15px', display: 'flex', gap: 11, alignItems: 'flex-start' }}>
          <Crown size={18} style={{ color: '#c9a44c', flexShrink: 0, marginTop: 1 }} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#161616' }}>Template illimitati con Pro</div>
            <div style={{ fontSize: 12, color: '#767676', marginTop: 2, lineHeight: 1.45 }}>
              Con Pro crei template multipli e sblocchi Bold, Tecnico, Elegante, colore, font e filigrana.
            </div>
            <div style={{ marginTop: 10 }}>
              <Link
                href="/abbonamento"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#fff', border: '1px solid #e0c98f', color: '#b0863e', borderRadius: 10, padding: '9px 15px', fontSize: 13, fontWeight: 600, textDecoration: 'none' }}
              >
                <Crown size={14} style={{ color: '#c9a44c' }} /> Passa a Pro
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
