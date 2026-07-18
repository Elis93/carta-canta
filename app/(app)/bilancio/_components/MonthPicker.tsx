'use client'

// Selettore rapido mese+anno del Bilancio: il titolo "luglio 2026" è
// coperto da un <input type="month"> trasparente → il tocco apre il
// picker nativo del telefono (si salta anche di anni in un gesto).
// router.replace: la cronologia non si accumula, la freccia indietro
// esce dalla pagina invece di ripercorrere i mesi.
// 18 lug (feedback Eli "ci mette molto"): il cambio è in useTransition —
// mentre i dati del nuovo mese arrivano, il titolo mostra una rotellina
// (prima la pagina restava immobile senza alcun segnale).

import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { Loader2 } from 'lucide-react'

export function MonthPicker({ value, max, label }: { value: string; max: string; label: string }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  return (
    <span style={{ position: 'relative', minWidth: 130, textAlign: 'center', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
      <span style={{ opacity: isPending ? 0.45 : 1 }}>{label}</span>
      {isPending && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--cc-muted)', flexShrink: 0 }} />}
      <input
        type="month"
        value={value}
        max={max}
        aria-label="Scegli mese e anno"
        onChange={(e) => {
          const v = e.target.value
          if (/^\d{4}-\d{2}$/.test(v)) startTransition(() => router.replace(`/bilancio?m=${v}`))
        }}
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none', padding: 0 }}
      />
    </span>
  )
}
