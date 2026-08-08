import { chromium } from 'playwright-core'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const w of [390, 360, 320]) {
  for (const zoom of [1, 1.15]) {
    for (const attivo of [false, true]) {
      const p = await b.newPage({ viewport: { width: w, height: 400 } })
      await p.setContent(`<html><body style="margin:0;zoom:${zoom};font-family:system-ui,sans-serif;background:#f8f6f1">
        <div style="padding:0 16px">
          <div id="barra" style="display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:14px 0;background:#fff;border:1px solid #e7e7ea;border-radius:12px;padding:5px 6px;box-shadow:0 1px 2px rgba(20,20,40,.05)">
            <a style="display:inline-flex;align-items:center;gap:6px;background:${attivo ? '#1a1a2e' : 'transparent'};border:none;border-radius:9px;padding:6px 10px;font-size:13px;font-weight:${attivo ? 600 : 400};color:${attivo ? '#fff' : '#55534b'};white-space:nowrap;flex-shrink:0">🗄 Archivio</a>
            <div style="display:flex;align-items:center;gap:6px;margin-left:auto;padding:2px 5px">
              <span style="color:#55534b">⇅</span><span style="font-size:13px;color:#55534b">Ordina:</span>
              <span style="font-size:13px;font-weight:600;color:#161616">Scadenza vicina ⌄</span>
            </div>
          </div>
        </div></body></html>`)
      const m = await p.evaluate(() => {
        const bar = document.getElementById('barra')
        return { righe: Math.round(bar.getBoundingClientRect().height / 26), sbordoBarra: bar.scrollWidth > bar.clientWidth, sbordoPagina: document.documentElement.scrollWidth > document.documentElement.clientWidth }
      })
      console.log(`${w}px ${zoom===1?'normale     ':'Testo grande'} archivio ${attivo?'ACCESO':'spento'}  barra: ${m.sbordoBarra ? '⚠️ sborda' : '✅'}  pagina: ${m.sbordoPagina ? '⚠️ sborda' : '✅'}`)
      await p.close()
    }
  }
}
await b.close()
