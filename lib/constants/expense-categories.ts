// Categorie spese preimpostate per il Bilancio (decisione Eli 5 lug 2026:
// preset + possibilità di categorie personalizzate — testo libero).
export const EXPENSE_CATEGORIES = [
  'Materiali',
  'Carburante',
  'Attrezzatura',
  'Tasse e contributi',
  'Altro',
] as const

const CATEGORY_EMOJI: Record<string, string> = {
  'Materiali': '🧱',
  'Carburante': '⛽',
  'Attrezzatura': '🔧',
  'Tasse e contributi': '🧾',
  'Altro': '💶',
}

export function expenseCategoryEmoji(category: string | null): string {
  if (!category) return '💶'
  return CATEGORY_EMOJI[category] ?? '🏷️'
}
