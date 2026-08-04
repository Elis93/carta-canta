// Categorie spese preimpostate per il Bilancio (decisione Eli 5 lug 2026:
// preset + possibilità di categorie personalizzate — testo libero).
export const EXPENSE_CATEGORIES = [
  'Materiali',
  // Chi paga un aiutante/collaboratore ha una spesa VERA: senza questa voce
  // finiva in "Altro" (Eli 4 ago). NB: le ore del titolare non sono una
  // spesa di cassa e restano fuori dal Bilancio (vivono sul Lavoro).
  'Collaboratori e manodopera',
  'Carburante',
  'Attrezzatura',
  'Tasse e contributi',
  'Altro',
] as const

const CATEGORY_EMOJI: Record<string, string> = {
  'Materiali': '🧱',
  'Collaboratori e manodopera': '👷',
  'Carburante': '⛽',
  'Attrezzatura': '🔧',
  'Tasse e contributi': '🧾',
  'Altro': '💶',
}

export function expenseCategoryEmoji(category: string | null): string {
  if (!category) return '💶'
  return CATEGORY_EMOJI[category] ?? '🏷️'
}
