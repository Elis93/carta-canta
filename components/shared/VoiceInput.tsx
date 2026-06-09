'use client'

// ============================================================
// VoiceInput — pulsante microfono con toggle on/off
//
// Flusso:
//   idle → recording (click) → processing (click o auto-stop 60s)
//         → success (testo inserito) → idle
//         → error (messaggio brevemente) → idle
//
// Il componente usa MediaRecorder API (nativo del browser, nessuna lib).
// L'audio viene inviato a /api/voice/transcribe che chiama AssemblyAI.
// Il testo trascritto viene passato al parent via onTranscript().
// ============================================================

import { useState, useRef, useEffect, useCallback } from 'react'
import { Mic, MicOff, Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const MAX_RECORDING_SECONDS = 60

type VoiceState = 'idle' | 'recording' | 'processing' | 'success' | 'error'

interface VoiceInputProps {
  /** Chiamato con il testo trascritto quando la registrazione è completata */
  onTranscript: (text: string) => void
  disabled?: boolean
  className?: string
}

export function VoiceInput({ onTranscript, disabled, className }: VoiceInputProps) {
  const [voiceState, setVoiceState] = useState<VoiceState>('idle')
  const [elapsed,    setElapsed]    = useState(0)
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null)

  const recorderRef  = useRef<MediaRecorder | null>(null)
  const chunksRef    = useRef<Blob[]>([])
  const streamRef    = useRef<MediaStream | null>(null)
  const tickRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const autoStopRef  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Pulizia risorse all'unmount
  useEffect(() => {
    return () => {
      clearTimers()
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  function clearTimers() {
    if (tickRef.current)     clearInterval(tickRef.current)
    if (autoStopRef.current) clearTimeout(autoStopRef.current)
    tickRef.current     = null
    autoStopRef.current = null
  }

  function showError(msg: string, duration = 3500) {
    setErrorMsg(msg)
    setVoiceState('error')
    setTimeout(() => {
      setVoiceState('idle')
      setErrorMsg(null)
    }, duration)
  }

  const sendForTranscription = useCallback(async (blob: Blob, mimeType: string) => {
    setVoiceState('processing')
    try {
      const ext = mimeType.includes('mp4') ? 'mp4' : 'webm'
      const fd  = new FormData()
      fd.append('audio', blob, `rec.${ext}`)

      const res  = await fetch('/api/voice/transcribe', { method: 'POST', body: fd })
      const data = await res.json() as {
        text?: string
        error?: string
        code?: string
        isPaid?: boolean
        remainingSeconds?: number
      }

      if (!res.ok) {
        const duration = data.code === 'QUOTA_EXCEEDED' ? 6000 : 4000
        showError(data.error ?? `Errore ${res.status}. Riprova.`, duration)
        return
      }

      if (data.text?.trim()) {
        onTranscript(data.text.trim())
        setVoiceState('success')
        setTimeout(() => setVoiceState('idle'), 1800)
      } else {
        showError('Nessun testo rilevato — parla più vicino al microfono.')
      }
    } catch {
      showError('Errore di rete. Controlla la connessione e riprova.')
    }
  }, [onTranscript])

  const stopRecording = useCallback(() => {
    clearTimers()
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop() // triggers onstop → sendForTranscription
    }
  }, [])

  async function startRecording() {
    // Verifica supporto API (richiede HTTPS in prod)
    if (!navigator.mediaDevices?.getUserMedia) {
      showError('Il tuo browser non supporta la registrazione audio.')
      return
    }

    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (err) {
      const e = err as DOMException
      if (e.name === 'NotAllowedError') {
        showError('Permesso microfono negato. Abilitalo nelle impostazioni del browser.')
      } else if (e.name === 'NotFoundError') {
        showError('Nessun microfono trovato.')
      } else {
        showError('Impossibile accedere al microfono.')
      }
      return
    }

    streamRef.current = stream

    // Scegli il MIME type supportato
    const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']
      .find((t) => MediaRecorder.isTypeSupported(t)) ?? ''

    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
    recorderRef.current = recorder
    chunksRef.current   = []

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data)
    }

    recorder.onstop = () => {
      clearTimers()
      stream.getTracks().forEach((t) => t.stop())
      const blob = new Blob(chunksRef.current, { type: mimeType || 'audio/webm' })
      void sendForTranscription(blob, mimeType || 'audio/webm')
    }

    recorder.start(250) // chunk ogni 250ms per raccogliere dati fluidi
    setVoiceState('recording')
    setElapsed(0)

    // Ticker 1 Hz per il countdown
    tickRef.current = setInterval(() => setElapsed((s) => s + 1), 1000)

    // Stop automatico a MAX_RECORDING_SECONDS
    autoStopRef.current = setTimeout(stopRecording, MAX_RECORDING_SECONDS * 1000)
  }

  function handleClick() {
    if (disabled) return
    if (voiceState === 'idle' || voiceState === 'error') void startRecording()
    else if (voiceState === 'recording') stopRecording()
  }

  const remaining = MAX_RECORDING_SECONDS - elapsed
  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  return (
    <div className={cn('inline-flex items-center gap-1.5', className)}>
      <Button
        type="button"
        variant={voiceState === 'recording' ? 'destructive' : 'ghost'}
        size="sm"
        className={cn(
          'size-10 p-0 shrink-0',
          voiceState === 'recording' && 'animate-pulse',
        )}
        onClick={handleClick}
        disabled={disabled || voiceState === 'processing'}
        aria-label={
          voiceState === 'idle'       ? 'Avvia dettatura vocale'
          : voiceState === 'recording' ? 'Ferma registrazione'
          : 'Trascrizione in corso…'
        }
        title={
          voiceState === 'idle'       ? 'Dettatura vocale'
          : voiceState === 'recording' ? `Ferma (${mm}:${ss} rimanenti)`
          : voiceState === 'processing' ? 'Trascrizione in corso…'
          : undefined
        }
      >
        {voiceState === 'processing' ? (
          <Loader2 className="size-3 animate-spin" />
        ) : voiceState === 'success' ? (
          <Check className="size-3 text-green-600" />
        ) : voiceState === 'recording' ? (
          <MicOff className="size-3" />
        ) : (
          <Mic className="size-3 text-muted-foreground" />
        )}
      </Button>

      {/* Feedback inline */}
      {voiceState === 'recording' && (
        <span className="text-xs tabular-nums font-medium text-destructive select-none">
          {mm}:{ss}
        </span>
      )}
      {voiceState === 'processing' && (
        <span className="text-xs text-muted-foreground select-none">Trascrizione…</span>
      )}
      {voiceState === 'error' && errorMsg && (
        <span className="text-xs text-destructive leading-tight max-w-[220px]">
          {errorMsg}
        </span>
      )}
    </div>
  )
}
