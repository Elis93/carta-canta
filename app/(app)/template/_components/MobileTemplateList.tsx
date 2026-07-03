'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Check, Plus, Loader2, Crown } from 'lucide-react'
import {
  setDefaultTemplateAction,
  clearDefaultTemplateAction,
  createBlankCustomTemplateAction,
  editDefaultTemplateAction,
} from '@/lib/actions/templates'

export interface MobileTemplateItem {
  /** id del template ('default' fittizio per la riga Default di sistema) */
  id: string
  name: string
  presetLabel: string
  color: string
  isActive: boolean
  /** href editor per i template custom (il Default usa una server action find-or-create) */
  editHref: string
  kind: 'default' | 'custom'
}

/**
 * Lista template (mobile) secondo il modello: "Default" + "Template personalizzato N".
 * - Tap sulla riga → editor del template.
 * - "Usa" → imposta quel template come attivo per i documenti (is_default).
 * - "Nuovo template" (solo Pro) → crea un personalizzato auto-nominato e apre l'editor.
 */
export function MobileTemplateList({
  items,
  isPro,
}: {
  items: MobileTemplateItem[]
  isPro: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

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
    if (creating) return
    setCreating(true)
    startTransition(async () => {
      await createBlankCustomTemplateAction()
      // il redirect all'editor avviene lato server
    })
  }

  const [openingDefault, setOpeningDefault] = useState(false)
  function openDefaultEditor() {
    if (openingDefault) return
    setOpeningDefault(true)
    startTransition(async () => {
      await editDefaultTemplateAction()
      // redirect all'editor lato server
    })
  }

  // Contenuto della riga (miniatura + nome + stile) — condiviso da Default e custom
  const rowInner = (item: MobileTemplateItem) => (
    <>
      {/* miniatura documento (barra intestazione = colore brand) */}
      <div style={{ width: 44, height: 56, borderRadius: 7, border: '1px solid #eee', background: '#fff', flexShrink: 0, overflow: 'hidden', padding: 5, boxSizing: 'border-box' }}>
        <div style={{ height: 8, borderRadius: 2, background: item.color, marginBottom: 5 }} />
        <div style={{ height: 4, borderRadius: 2, background: '#e3e3e6', marginBottom: 3, width: '80%' }} />
        <div style={{ height: 4, borderRadius: 2, background: '#e3e3e6', width: '60%' }} />
      </div>
      <div style={{ minWidth: 0, textAlign: 'left' }}>
        <div style={{ fontSize: 15, fontWeight: 600, color: '#161616', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {item.name}
        </div>
        <div style={{ fontSize: 12.5, color: '#8a887f', marginTop: 2 }}>Stile: {item.presetLabel}</div>
      </div>
    </>
  )

  return (
    <div style={{ margin: '14px 15px 0' }}>
      <div className="cc-card-md" style={{ padding: 0, overflow: 'hidden' }}>
        {items.map((item, i) => (
          <div
            key={item.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '12px 15px',
              borderTop: i ? '0.5px solid #eee' : undefined,
            }}
          >
            {item.kind === 'default' ? (
              <button
                type="button"
                onClick={openDefaultEditor}
                disabled={openingDefault}
                style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, cursor: openingDefault ? 'wait' : 'pointer' }}
              >
                {rowInner(item)}
              </button>
            ) : (
              <Link
                href={item.editHref}
                style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0, textDecoration: 'none' }}
              >
                {rowInner(item)}
              </Link>
            )}

            {item.isActive ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600, color: '#2f8a63', background: '#d4efe2', borderRadius: 999, padding: '3px 9px', flexShrink: 0 }}>
                <Check size={13} /> In uso
              </span>
            ) : (
              <button
                type="button"
                onClick={() => selectActive(item)}
                disabled={pending}
                style={{ flexShrink: 0, fontSize: 13, fontWeight: 600, color: '#1a1a2e', background: '#fff', border: '1px solid #e7e7ea', borderRadius: 10, padding: '7px 12px', cursor: pending ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}
              >
                {busyId === item.id && <Loader2 size={14} className="animate-spin" />} Usa
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Nuovo template — solo Pro */}
      {isPro ? (
        <button
          type="button"
          onClick={createNew}
          disabled={creating}
          style={{ marginTop: 14, width: '100%', height: 50, borderRadius: 12, border: '1px dashed #c9c7bf', background: '#fff', color: '#1a1a2e', fontSize: 14, fontWeight: 600, cursor: creating ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          {creating ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />} Nuovo template
        </button>
      ) : (
        <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 8, background: '#fff', border: '1px solid #ecd9ad', borderRadius: 12, padding: '12px 13px' }}>
          <Crown size={17} style={{ color: '#c9a44c', flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 12.5, color: '#767676', lineHeight: 1.45 }}>
            I template multipli sono una funzione Pro. Col piano Free usi il <b>Default</b>.{' '}
            <Link href="/abbonamento" style={{ color: '#1a1a2e', fontWeight: 600, whiteSpace: 'nowrap' }}>Passa a Pro &rarr;</Link>
          </div>
        </div>
      )}
    </div>
  )
}
