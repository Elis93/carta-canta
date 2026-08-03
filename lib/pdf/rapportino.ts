// ============================================================
// buildRapportinoHtml — vista di stampa del RAPPORTINO di fine
// lavoro (2 ago 2026, richiesta Eli: visualizzabile/scaricabile
// come documento sia dal cliente sia dall'artigiano).
// Stesso meccanismo dei documenti (B.8): HTML → stampa browser
// via preparePrintHtml. Stile coerente col brand (Georgia navy,
// occhiello oro), A4, foto che non si spezzano tra le pagine.
// 🔒 B.2: qui non entrano MAI costi/margini — solo ciò che il
// cliente già vede su /r/[token].
// ============================================================

export interface RapportinoPdfData {
  wsName: string
  logoUrl: string | null
  title: string | null
  address: string | null
  clientName: string | null
  /** ISO — concluso il / del */
  finishedAt: string | null
  sentAt: string | null
  reportText: string
  /** es. "2 h 30 min" — null se non tracciate */
  oreLabel: string | null
  photos: Array<{ url: string; label: string | null }>
  signedAt: string | null
  signerName: string | null
  /** data URI PNG della firma disegnata (053) */
  signatureImage: string | null
}

function esc(v: string | null | undefined): string {
  if (!v) return ''
  return v
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const dateLong = (iso: string) =>
  new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Europe/Rome' })
const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' })

export function buildRapportinoHtml(d: RapportinoPdfData): string {
  const meta = [
    d.clientName ? `Cliente: ${esc(d.clientName)}` : null,
    d.address ? esc(d.address) : null,
    d.finishedAt ? `concluso il ${dateLong(d.finishedAt)}` : d.sentAt ? `del ${dateLong(d.sentAt)}` : null,
  ].filter(Boolean).map((part) => `<span style="white-space:nowrap">${part}</span>`).join(' · ')

  const fotoHtml = d.photos.length > 0
    ? `<div style="margin-top:26px">
        <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6f6d64;margin-bottom:10px">Il lavoro in foto</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${d.photos.map((p) => `
            <div style="page-break-inside:avoid;break-inside:avoid;border:0.5px solid #e5e4df;border-radius:10px;overflow:hidden;position:relative">
              <img src="${esc(p.url)}" alt="Foto del lavoro" style="width:100%;height:200px;object-fit:cover;display:block"/>
              ${p.label ? `<span style="position:absolute;top:6px;left:6px;background:rgba(22,22,22,.6);color:#fff;border-radius:999px;padding:2px 9px;font-size:10px;font-weight:700;letter-spacing:.06em">${esc(p.label.toUpperCase())}</span>` : ''}
            </div>`).join('')}
        </div>
      </div>`
    : ''

  const firmaHtml = d.signedAt
    ? `<div style="margin-top:26px;page-break-inside:avoid;break-inside:avoid;border:1px solid #b7dcc8;background:#eef8f2;border-radius:12px;padding:14px 16px">
        <div style="font-size:13px;color:#1d5c41;line-height:1.5">
          Firmato da <b>${esc(d.signerName ?? 'cliente')}</b>${d.signedAt ? ` il ${dateTime(d.signedAt)}` : ''} (firma elettronica semplice: registrate data, ora e indirizzo IP).
        </div>
        ${d.signatureImage ? `<img src="${esc(d.signatureImage)}" alt="Firma del cliente" style="margin-top:10px;background:#fff;border:0.5px solid #b7dcc8;border-radius:9px;max-width:300px;width:100%;display:block"/>` : ''}
      </div>`
    : `<div style="margin-top:26px;border:1px solid #e8d6ad;background:#fdf9ef;border-radius:12px;padding:12px 16px;font-size:13px;color:#8a6a2f">
        Rapportino non ancora firmato dal cliente.
      </div>`

  return `<!DOCTYPE html>
<html lang="it">
<head>
<meta charset="utf-8"/>
<title>Rapportino — ${esc(d.title ?? 'lavoro')}</title>
<style>
  @page { size: A4; margin: 16mm 14mm; }
  * { box-sizing: border-box; }
  body { margin: 0; font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #161616; }
  .sheet { max-width: 794px; margin: 0 auto; padding: 28px 30px 34px; background: #fff; }
  /* Bottone SOLO a schermo (2 ago sera, Eli: prima si guarda il documento,
     poi — se si vuole — lo si scarica): apre il dialogo di stampa del
     browser, da cui "Salva come PDF". In stampa sparisce. */
  .dl-btn { position: fixed; right: 14px; bottom: 14px; display: inline-flex; align-items: center; gap: 7px;
    background: #1a1a2e; color: #fff; border: none; border-radius: 999px; padding: 12px 18px;
    font-size: 14px; font-weight: 600; font-family: inherit; cursor: pointer;
    box-shadow: 0 6px 16px -4px rgba(26,26,46,.45); }
  @media print { .dl-btn { display: none; } }
</style>
</head>
<body>
<div class="sheet">
  <div style="display:flex;align-items:center;gap:12px;border-bottom:2px solid #c9a44c;padding-bottom:14px">
    ${d.logoUrl ? `<img src="${esc(d.logoUrl)}" alt="" style="width:44px;height:44px;border-radius:10px;object-fit:contain"/>` : ''}
    <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;font-weight:600;color:#1a1a2e">${esc(d.wsName)}</div>
  </div>

  <div style="margin-top:24px;font-size:12px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:#b0863e">Rapportino di fine lavoro</div>
  <div style="font-family:Georgia,'Times New Roman',serif;font-size:26px;font-weight:600;color:#161616;margin-top:6px;line-height:1.25">${esc(d.title ?? 'Lavoro concluso')}</div>
  ${meta ? `<div style="font-size:13px;color:#6f6d64;margin-top:7px;line-height:1.6">${meta}</div>` : ''}

  <div style="margin-top:24px">
    <div style="font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#6f6d64;margin-bottom:9px">Lavori eseguiti</div>
    <div style="font-size:14px;line-height:1.7;white-space:pre-wrap">${esc(d.reportText)}</div>
    ${d.oreLabel ? `
    <div style="display:flex;justify-content:space-between;gap:14px;border-top:0.5px solid #e5e4df;margin-top:14px;padding-top:11px;font-size:14px">
      <span style="color:#6f6d64">Ore di lavoro in cantiere</span>
      <b style="white-space:nowrap">${esc(d.oreLabel)}</b>
    </div>` : ''}
  </div>

  ${fotoHtml}
  ${firmaHtml}

  <div style="margin-top:30px;padding-top:12px;border-top:0.5px solid #e5e4df;font-size:10px;color:#b3b1ab;text-align:center">
    Documento generato con Carta Canta · cartacanta.app
  </div>
</div>
<button type="button" class="dl-btn" onclick="window.print()">Scarica in PDF</button>
</body>
</html>`
}

/** "150 min" → "2 h 30 min" (stessa resa della pagina /r) */
export function oreLabelFromMinutes(laborMinutes: number): string | null {
  if (!Number.isFinite(laborMinutes) || laborMinutes <= 0) return null
  const m = Math.round(laborMinutes)
  return `${Math.floor(m / 60) > 0 ? `${Math.floor(m / 60)} h ` : ''}${m % 60 > 0 || m < 60 ? `${m % 60} min` : ''}`.trim()
}
