// Stati del Lavoro: etichette e colori condivisi tra lista e dettaglio.
export type LavoroStatus = 'da_iniziare' | 'in_corso' | 'finito' | 'fatturato'

export const LAVORO_STATUS_META: Record<LavoroStatus, { label: string; bg: string; color: string }> = {
  da_iniziare: { label: 'Da iniziare', bg: '#f0f0f2', color: '#55534b' },
  in_corso:    { label: 'In corso',    bg: '#d8e8fb', color: '#3f6fb0' },
  finito:      { label: 'Finito',      bg: '#d4efe2', color: '#2f8a63' },
  fatturato:   { label: 'Fatturato',   bg: '#f5f0e2', color: '#b0863e' },
}

export const LAVORO_STATUS_ORDER: LavoroStatus[] = ['da_iniziare', 'in_corso', 'finito', 'fatturato']
