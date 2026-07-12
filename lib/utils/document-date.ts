// timeZone: le liste sono renderizzate sul SERVER (UTC) — senza, dopo le
// 22/23 italiane le date slitterebbero al giorno prima.
const FMT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', timeZone: 'Europe/Rome' }

function fmt(d: string | null | undefined): string {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('it-IT', FMT)
}

interface DocForDate {
  status: string
  sent_at?: string | null
  expires_at?: string | null
  accepted_at?: string | null
  updated_at?: string | null
}

/**
 * Restituisce data e testo contestuale allo stato del documento.
 * urgent=true quando la scadenza è ≤7 giorni (colore urgenza nel JSX).
 */
export function getContextualDate(
  doc: DocForDate,
  docType: 'preventivo' | 'fattura',
): { text: string; urgent: boolean } {
  // Confronti per GIORNO in ora italiana (il setHours sul server UTC
  // sposterebbe il confine di 1-2 ore: "Scade oggi" un giorno in anticipo)
  const dayKey = (d: Date) => d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Rome' })
  const todayKey = dayKey(new Date())
  const expiresKey = doc.expires_at ? dayKey(new Date(doc.expires_at)) : null

  // La scadenza è rilevante SOLO per i documenti ancora in attesa (sent/viewed/expired):
  // un accettato/rifiutato ha già avuto risposta — mostrare "Scaduto il" sarebbe fuorviante.
  const isPending = doc.status === 'sent' || doc.status === 'viewed' || doc.status === 'expired'
  const isPastExpiry = isPending && expiresKey !== null && expiresKey < todayKey

  // Scaduto (per stato o per data passata)
  if (doc.status === 'expired' || isPastExpiry) {
    return {
      text: docType === 'fattura'
        ? `Scaduta il ${fmt(doc.expires_at)}`
        : `Scaduto il ${fmt(doc.expires_at)}`,
      urgent: false,
    }
  }

  // Accettato / Pagato
  if (doc.status === 'accepted') {
    return {
      text: docType === 'fattura'
        ? `Pagata il ${fmt(doc.accepted_at ?? doc.updated_at)}`
        : `Accettato il ${fmt(doc.accepted_at ?? doc.updated_at)}`,
      urgent: false,
    }
  }

  // Rifiutato / Annullato
  if (doc.status === 'rejected') {
    return {
      text: docType === 'fattura'
        ? `Annullata il ${fmt(doc.updated_at)}`
        : `Rifiutato il ${fmt(doc.sent_at ?? doc.updated_at)}`,
      urgent: false,
    }
  }

  // Inviato / Visto — mostra scadenza se presente
  if (doc.status === 'sent' || doc.status === 'viewed') {
    if (expiresKey !== null) {
      const diffDays = Math.round(
        (new Date(expiresKey).getTime() - new Date(todayKey).getTime()) / (1000 * 60 * 60 * 24),
      )
      if (diffDays <= 7) {
        const text = diffDays === 0 ? 'Scade oggi' : `Scade tra ${diffDays} g`
        return { text, urgent: true }
      }
      return { text: `Scade il ${fmt(doc.expires_at)}`, urgent: false }
    }
    return {
      text: docType === 'fattura'
        ? `Inviata il ${fmt(doc.sent_at)}`
        : `Inviato il ${fmt(doc.sent_at)}`,
      urgent: false,
    }
  }

  // Bozza (o stato non previsto)
  return {
    text: docType === 'fattura'
      ? `Modificata il ${fmt(doc.updated_at)}`
      : `Modificato il ${fmt(doc.updated_at)}`,
    urgent: false,
  }
}
