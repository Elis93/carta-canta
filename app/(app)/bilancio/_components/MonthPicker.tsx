'use client'

// Selettore rapido mese+anno del Bilancio: il titolo "luglio 2026" è
// coperto da un <input type="month"> trasparente → il tocco apre il
// picker nativo del telefono (si salta anche di anni in un gesto).
// router.replace: la cronologia non si accumula, la freccia indietro
// esce dalla pagina invece di ripercorrere i mesi.

import { useRouter } from 'next/navigation'

export function MonthPicker({ value, max, label }: { value: string; max: string; label: string }) {
  const router = useRouter()
  return (
    <span style={{ position: 'relative', minWidth: 130, textAlign: 'center', display: 'inline-block' }}>
      {label}
      <input
        type="month"
        value={value}
        max={max}
        aria-label="Scegli mese e anno"
        onChange={(e) => {
          const v = e.target.value
          if (/^\d{4}-\d{2}$/.test(v)) router.replace(`/bilancio?m=${v}`)
        }}
        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none', padding: 0 }}
      />
    </span>
  )
}
