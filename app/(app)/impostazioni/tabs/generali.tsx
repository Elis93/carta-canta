'use client'

import { useActionState, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Loader2, Upload, X, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { updateWorkspaceData, uploadLogo, removeLogo } from '@/lib/actions/workspace'
import { useComuneLookup } from '@/hooks/useComuneLookup'
import type { Database } from '@/types/database'

type Workspace = Database['public']['Tables']['workspaces']['Row']

export function ImpostazioniGenerali({
  workspace,
  userEmail,
}: {
  workspace: Workspace
  userEmail: string
}) {
  const [dataState, dataAction, dataPending] = useActionState(updateWorkspaceData, null)
  const [logoState, logoAction, logoPending] = useActionState(uploadLogo, null)
  const { cap, citta, provincia, onCapChange, onCittaChange, onProvinciaChange } = useComuneLookup({
    cap:       workspace.cap       ?? '',
    citta:     workspace.citta     ?? '',
    provincia: workspace.provincia ?? '',
  })
  const [preview, setPreview] = useState<string | null>(workspace.logo_url)
  const [logoChanged, setLogoChanged] = useState(false)
  const [removing, setRemoving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (logoState?.success) setLogoChanged(false)
  }, [logoState])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoChanged(true)
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  async function handleRemoveLogo() {
    setRemoving(true)
    const result = await removeLogo()
    if (result?.success) setPreview(null)
    setRemoving(false)
  }

  return (
    <div className="space-y-6">
      {/* Dati azienda */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dati attività</CardTitle>
          <CardDescription>
            Le informazioni che appaiono sui tuoi preventivi.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form action={dataAction} className="space-y-4">
            {dataState?.error && (
              <Alert variant="destructive">
                <AlertDescription>{dataState.error}</AlertDescription>
              </Alert>
            )}
            {dataState?.success && (
              <Alert>
                <AlertDescription>{dataState.success}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="ragione_sociale">
                Ragione sociale <span className="text-destructive">*</span>
              </Label>
              <Input
                id="ragione_sociale"
                name="ragione_sociale"
                defaultValue={workspace.ragione_sociale ?? ''}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="piva">Partita IVA</Label>
                <Input
                  id="piva"
                  name="piva"
                  defaultValue={workspace.piva ?? ''}
                  placeholder="12345678901"
                  maxLength={11}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Email account</Label>
                <Input value={userEmail} disabled className="text-muted-foreground" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="indirizzo">Indirizzo</Label>
              <Input
                id="indirizzo"
                name="indirizzo"
                defaultValue={workspace.indirizzo ?? ''}
                placeholder="Via Roma 1"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cap">CAP</Label>
                <Input
                  id="cap"
                  name="cap"
                  placeholder="20100"
                  maxLength={5}
                  value={cap}
                  onChange={(e) => onCapChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="citta">Città</Label>
                <Input
                  id="citta"
                  name="citta"
                  placeholder="Milano"
                  value={citta}
                  onChange={(e) => onCittaChange(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="provincia">Prov.</Label>
                <Input
                  id="provincia"
                  name="provincia"
                  placeholder="MI"
                  maxLength={2}
                  className="uppercase"
                  value={provincia}
                  onChange={(e) => onProvinciaChange(e.target.value)}
                />
              </div>
            </div>

            {/* Hidden fields richiesti dallo schema */}
            <input type="hidden" name="fiscal_regime" value={workspace.fiscal_regime} />
            <input type="hidden" name="ateco_code" value={workspace.ateco_code ?? ''} />

            <Button type="submit" disabled={dataPending}>
              {dataPending ? (
                <><Loader2 className="size-4 animate-spin" /> Salvataggio…</>
              ) : (
                'Salva modifiche'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Separator />

      {/* Logo */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Logo</CardTitle>
          <CardDescription>
            Il logo appare nell&apos;intestazione dei preventivi. PNG, JPG o SVG — max 2MB.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {logoState?.error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{logoState.error}</AlertDescription>
            </Alert>
          )}
          {logoState?.success && (
            <Alert className="mb-4">
              <AlertDescription>{logoState.success}</AlertDescription>
            </Alert>
          )}

          <div className="flex items-start gap-4">
            {/* Preview */}
            <div className="size-20 rounded-xl border bg-muted/50 flex items-center justify-center shrink-0 overflow-hidden">
              {preview ? (
                <Image
                  src={preview}
                  alt="Logo"
                  width={80}
                  height={80}
                  className="object-contain"
                  unoptimized
                />
              ) : (
                <span className="text-2xl font-bold text-muted-foreground/30">CC</span>
              )}
            </div>

            {/* Azioni */}
            <div className="flex flex-col gap-2">
              <form action={logoAction}>
                <input
                  ref={inputRef}
                  type="file"
                  name="logo"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <Button
                  type={logoChanged ? 'submit' : 'button'}
                  variant="outline"
                  size="sm"
                  disabled={logoPending}
                  onClick={() => {
                    if (!logoChanged) inputRef.current?.click()
                  }}
                >
                  {logoPending ? (
                    <><Loader2 className="size-4 animate-spin" /> Caricamento…</>
                  ) : logoChanged ? (
                    <><Upload className="size-4" /> Carica</>
                  ) : (
                    <><Upload className="size-4" /> Cambia logo</>
                  )}
                </Button>
                {logoChanged && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setPreview(workspace.logo_url)
                      setLogoChanged(false)
                      if (inputRef.current) inputRef.current.value = ''
                    }}
                  >
                    <X className="size-4" /> Annulla
                  </Button>
                )}
              </form>

              {preview && !logoChanged && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  disabled={removing}
                  onClick={handleRemoveLogo}
                >
                  {removing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Rimuovi logo
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
