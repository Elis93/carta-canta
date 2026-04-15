'use client'

import { useState, useRef, useCallback } from 'react'
import {
  Loader2, Upload, Camera, FileImage, AlertCircle,
  CheckCircle2, Trash2, Plus, Wand2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import {
  confidenceLabel,
  confidenceColor,
  ACCEPTED_MIME_TYPES,
  MAX_FILE_SIZE_MB,
} from '@/lib/ai/types'
import type { ExtractedItem, ExtractResult } from '@/lib/ai/types'

interface AiImportModalProps {
  open: boolean
  onClose: () => void
  /** Chiamata quando l'utente conferma le voci estratte */
  onConfirm: (items: ExtractedItem[], suggestedTitle?: string, suggestedNotes?: string) => void
}

type Phase = 'upload' | 'loading' | 'results' | 'error'

export function AiImportModal({ open, onClose, onConfirm }: AiImportModalProps) {
  const [phase, setPhase] = useState<Phase>('upload')
  const [error, setError] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [result, setResult] = useState<ExtractResult | null>(null)
  const [editedItems, setEditedItems] = useState<ExtractedItem[]>([])
  const [usedFallback, setUsedFallback] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── Reset quando il modale si apre ────────────────────────
  const handleOpenChange = (o: boolean) => {
    if (!o) {
      onClose()
      // Reset state con piccolo delay per evitare flash visivo
      setTimeout(() => {
        setPhase('upload')
        setError(null)
        setResult(null)
        setEditedItems([])
        setUsedFallback(false)
      }, 200)
    }
  }

  // ── Processa file ──────────────────────────────────────────
  const processFile = useCallback(async (file: File) => {
    // Validazione client-side
    if (!ACCEPTED_MIME_TYPES.includes(file.type as typeof ACCEPTED_MIME_TYPES[number])) {
      setError('Formato non supportato. Usa JPG, PNG, WEBP o PDF.')
      setPhase('error')
      return
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`Il file supera i ${MAX_FILE_SIZE_MB} MB consentiti.`)
      setPhase('error')
      return
    }

    setPhase('loading')
    setError(null)

    const fd = new FormData()
    fd.append('file', file)

    try {
      const res = await fetch('/api/ai/extract', { method: 'POST', body: fd })
      const data = await res.json() as ExtractResult & {
        error?: string
        paywall?: boolean
        ai_unavailable?: boolean
        _fallback?: boolean
      }

      if (!res.ok) {
        if (data.paywall) {
          setError('AI Import richiede il piano Pro. Aggiorna il tuo piano per usare questa funzione.')
        } else if (data.ai_unavailable) {
          setError('AI non disponibile al momento. Compila il preventivo manualmente.')
        } else {
          setError(data.error ?? 'Errore durante l\'analisi del documento.')
        }
        setPhase('error')
        return
      }

      setResult(data)
      setEditedItems(data.items)
      setUsedFallback(!!data._fallback)
      setPhase('results')
    } catch {
      setError('Errore di connessione. Controlla la rete e riprova.')
      setPhase('error')
    }
  }, [])

  // ── Drag & Drop ────────────────────────────────────────────
  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  // ── Editing voci ───────────────────────────────────────────
  function updateItem(index: number, updates: Partial<ExtractedItem>) {
    setEditedItems((prev) => prev.map((item, i) =>
      i === index ? { ...item, ...updates } : item
    ))
  }

  function removeItem(index: number) {
    setEditedItems((prev) => prev.filter((_, i) => i !== index))
  }

  function addItem() {
    setEditedItems((prev) => [
      ...prev,
      { description: '', unit: 'pz', quantity: 1, unit_price: 0,
        discount_pct: null, vat_rate: null, confidence: 1.0 },
    ])
  }

  function handleConfirm() {
    const validItems = editedItems.filter((i) => i.description.trim().length > 0)
    if (validItems.length === 0) return
    onConfirm(validItems, result?.suggested_title, result?.suggested_notes)
    handleOpenChange(false)
  }

  // ── Rendering ──────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="size-5 text-primary" />
            Importa con AI
          </DialogTitle>
          <DialogDescription>
            Carica una foto o PDF del documento — l&apos;AI estrae automaticamente le voci.
          </DialogDescription>
        </DialogHeader>

        {/* ── FASE: UPLOAD ─────────────────────────────────── */}
        {phase === 'upload' && (
          <div className="space-y-4">
            {/* Drag & drop area */}
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={`
                border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
                transition-colors
                ${isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-primary/50 hover:bg-muted/30'
                }
              `}
              onClick={() => fileInputRef.current?.click()}
            >
              <FileImage className="size-10 text-muted-foreground/50 mx-auto mb-3" />
              <p className="font-medium">Trascina qui un&apos;immagine o PDF</p>
              <p className="text-sm text-muted-foreground mt-1">
                JPG, PNG, WEBP, PDF · max {MAX_FILE_SIZE_MB} MB
              </p>
            </div>

            {/* Input file nascosto — desktop */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={handleFileInput}
            />

            <div className="flex gap-2">
              {/* Fotocamera — mobile */}
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => {
                  const inp = document.createElement('input')
                  inp.type = 'file'
                  inp.accept = 'image/*'
                  inp.capture = 'environment'  // fotocamera posteriore
                  inp.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0]
                    if (file) processFile(file)
                  }
                  inp.click()
                }}
              >
                <Camera className="size-4" /> Scatta foto
              </Button>
              {/* File picker — desktop */}
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload className="size-4" /> Carica file
              </Button>
            </div>
          </div>
        )}

        {/* ── FASE: LOADING ────────────────────────────────── */}
        {phase === 'loading' && (
          <div className="py-12 flex flex-col items-center gap-4">
            <div className="relative">
              <div className="size-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Wand2 className="size-8 text-primary" />
              </div>
              <Loader2 className="size-6 animate-spin text-primary absolute -top-1 -right-1" />
            </div>
            <div className="text-center">
              <p className="font-medium">Sto analizzando il documento…</p>
              <p className="text-sm text-muted-foreground mt-1">
                GPT-4o-mini sta estraendo le voci
              </p>
            </div>
            {/* Skeleton voci */}
            <div className="w-full space-y-2 mt-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-8 bg-muted rounded animate-pulse" style={{ opacity: 1 - i * 0.2 }} />
              ))}
            </div>
          </div>
        )}

        {/* ── FASE: ERRORE ─────────────────────────────────── */}
        {phase === 'error' && (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
              <AlertCircle className="size-5 text-destructive shrink-0 mt-0.5" />
              <p className="text-sm text-destructive">{error}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => { setPhase('upload'); setError(null) }}
            >
              Riprova
            </Button>
          </div>
        )}

        {/* ── FASE: RISULTATI ──────────────────────────────── */}
        {phase === 'results' && result && (
          <div className="space-y-4">
            {/* Badge provider */}
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="text-xs gap-1">
                <CheckCircle2 className="size-3 text-green-600" />
                {editedItems.length} {editedItems.length === 1 ? 'voce estratta' : 'voci estratte'}
                {usedFallback && ' · via Mistral'}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Verifica e correggi prima di confermare
              </span>
            </div>

            {/* Tabella voci editabile */}
            <div className="rounded-lg border overflow-hidden">
              <div className="grid grid-cols-[2fr_55px_75px_85px_30px] gap-px bg-muted px-3 py-2 text-xs font-medium text-muted-foreground">
                <span>Descrizione</span>
                <span>Qtà</span>
                <span>Prezzo €</span>
                <span>Confidenza</span>
                <span />
              </div>

              <div className="divide-y">
                {editedItems.map((item, i) => {
                  const conf = confidenceLabel(item.confidence)
                  const confClass = confidenceColor(item.confidence)
                  return (
                    <div
                      key={i}
                      className={`grid grid-cols-[2fr_55px_75px_85px_30px] gap-2 items-center px-3 py-2 ${
                        conf === 'low' ? 'bg-destructive/5' : ''
                      }`}
                    >
                      <Input
                        value={item.description}
                        onChange={(e) => updateItem(i, { description: e.target.value })}
                        className="h-7 text-xs"
                      />
                      <Input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => updateItem(i, { quantity: parseFloat(e.target.value) || 1 })}
                        className="h-7 text-xs text-right"
                        min="0"
                        step="0.001"
                      />
                      <Input
                        type="number"
                        value={item.unit_price}
                        onChange={(e) => updateItem(i, { unit_price: parseFloat(e.target.value) || 0 })}
                        className="h-7 text-xs text-right"
                        min="0"
                        step="0.01"
                      />
                      <div className={`text-xs font-medium ${confClass} text-center`}>
                        {conf === 'high' ? 'Alta' : conf === 'medium' ? 'Media' : 'Bassa'}
                        <span className="text-muted-foreground ml-1">
                          {Math.round(item.confidence * 100)}%
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(i)}
                        className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="Rimuovi voce"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Aggiungi voce manuale */}
              <div className="px-3 py-2 border-t">
                <button
                  type="button"
                  onClick={addItem}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Plus className="size-3.5" /> Aggiungi voce
                </button>
              </div>
            </div>

            {/* Info title/notes suggeriti */}
            {(result.suggested_title || result.suggested_notes) && (
              <div className="rounded-lg bg-muted/50 px-3 py-2.5 text-xs space-y-1">
                {result.suggested_title && (
                  <p><span className="font-medium">Titolo suggerito:</span> {result.suggested_title}</p>
                )}
                {result.suggested_notes && (
                  <p><span className="font-medium">Note:</span> {result.suggested_notes}</p>
                )}
              </div>
            )}

            {/* Avviso voci a bassa confidenza */}
            {editedItems.some((i) => i.confidence < 0.5) && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                Alcune voci hanno bassa confidenza (evidenziate in rosso). Verificale prima di confermare.
              </div>
            )}

            {/* CTA */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
                Annulla
              </Button>
              <Button
                type="button"
                onClick={handleConfirm}
                disabled={editedItems.filter((i) => i.description.trim()).length === 0}
              >
                <CheckCircle2 className="size-4" />
                Usa queste {editedItems.filter((i) => i.description.trim()).length} voci
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
