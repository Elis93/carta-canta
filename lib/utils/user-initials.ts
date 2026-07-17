// ============================================================
// userInitials — le iniziali della PERSONA mostrate nel tondo
// della Home: Nome+Cognome; fallback full_name (prima+ultima
// parola); fallback ragione sociale. Estratta dalla dashboard
// (17 lug) perché ora le usa anche la scheda profilo di Altro —
// Eli vuole le STESSE identiche iniziali nei due tondi.
// ============================================================

export function userInitials(
  meta: Record<string, unknown> | undefined | null,
  workspaceName?: string | null,
): string {
  const nome = typeof meta?.nome === 'string' ? meta.nome : undefined
  const cognome = typeof meta?.cognome === 'string' ? meta.cognome : undefined
  if (nome && cognome) return (nome[0] + cognome[0]).toUpperCase()
  if (nome) return nome.slice(0, 2).toUpperCase()
  const fullName = typeof meta?.full_name === 'string' ? meta.full_name : undefined
  if (fullName) {
    const parts = fullName.trim().split(/\s+/).filter(Boolean)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return fullName.slice(0, 2).toUpperCase()
  }
  const nameWords = (workspaceName ?? '').trim().split(/\s+/).filter(Boolean)
  return nameWords.length >= 2
    ? (nameWords[0][0] + nameWords[nameWords.length - 1][0]).toUpperCase()
    : (workspaceName ?? '').slice(0, 2).toUpperCase()
}
