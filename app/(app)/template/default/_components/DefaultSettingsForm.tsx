'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import { saveDefaultSettingsAction } from '@/lib/actions/templates'
import { LegalNoticeField } from '../../_components/LegalNoticeField'

interface DefaultSettingsFormProps {
  defaultShowWatermark: boolean
  defaultShowLogo: boolean
  defaultLegalNotice: string
  logoUrl: string | null
}

export function DefaultSettingsForm({
  defaultShowWatermark,
  defaultShowLogo,
  defaultLegalNotice,
  logoUrl,
}: DefaultSettingsFormProps) {
  const [showWatermark, setShowWatermark] = useState(defaultShowWatermark)
  const [showLogo,      setShowLogo]      = useState(defaultShowLogo)
  const [legalNotice,   setLegalNotice]   = useState(defaultLegalNotice)

  return (
    <form action={saveDefaultSettingsAction} className="space-y-5">
      <input type="hidden" name="show_watermark" value={String(showWatermark)} />
      <input type="hidden" name="show_logo"      value={String(showLogo)} />

      {/* ── Logo ──────────────────────────────────────────────── */}
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-start gap-3 min-w-0">
            {/* Anteprima logo */}
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt="Logo"
                width={36}
                height={36}
                className="rounded border bg-white object-contain p-0.5 shrink-0"
                unoptimized
              />
            ) : (
              <div className="size-9 rounded border bg-muted/50 flex items-center justify-center shrink-0">
                <ImageIcon className="size-4 text-muted-foreground/60" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium leading-snug">Mostra logo</p>
              <p className="text-xs text-muted-foreground mt-1">
                {logoUrl ? (
                  <>
                    Il logo appare nell&apos;intestazione del documento.{' '}
                    <Link href="/impostazioni" className="underline underline-offset-2 hover:text-foreground">
                      Cambia logo
                    </Link>
                  </>
                ) : (
                  <>
                    Nessun logo caricato.{' '}
                    <Link href="/impostazioni" className="underline underline-offset-2 hover:text-foreground">
                      Carica logo
                    </Link>
                  </>
                )}
              </p>
            </div>
          </div>
          <Switch
            checked={showLogo}
            onCheckedChange={setShowLogo}
            className="mt-0.5 shrink-0"
          />
        </div>
      </div>

      {/* ── Branding watermark ─────────────────────────────────── */}
      <div className="rounded-xl border p-4 space-y-3">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium leading-snug">
              Branding &quot;Generato con Carta Canta&quot;
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Filigrana diagonale e riga nel piè di pagina del documento
            </p>
          </div>
          <Switch
            id="show_watermark_switch"
            checked={showWatermark}
            onCheckedChange={setShowWatermark}
            className="mt-0.5 shrink-0"
          />
        </div>
      </div>

      <Separator />

      {/* ── Nota legale ────────────────────────────────────────── */}
      <LegalNoticeField
        value={legalNotice}
        onChange={setLegalNotice}
        hint="Per i forfettari viene aggiunta automaticamente la stringa obbligatoria se questo campo è vuoto."
      />

      <div className="flex gap-3 pt-1">
        <Button type="submit">Salva</Button>
        <Button variant="outline" asChild>
          <Link href="/template">Annulla</Link>
        </Button>
      </div>
    </form>
  )
}
