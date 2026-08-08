import { chromium } from 'playwright-core'
import fs from 'fs'
const css = fs.readFileSync('.hx/tabs.css','utf8')
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
for (const [nome, labels] of [['Aiuto', ['Aiuto','Tutorial']], ['Account', ['Account','Sicurezza','Dati']], ['Impostazioni', ['Generale','Fiscale','Notifiche','Team']]]) {
  for (const equal of [false, true]) {
    const p = await b.newPage({ viewport: { width: 390, height: 300 } })
    await p.setContent(`<html><head><style>:root{--cc-text-2:#55534b;--cc-navy:#1a1a2e}body{margin:0;font-family:system-ui,sans-serif}.w{padding:0 15px}${css}</style></head>
      <body><div class="w"><div class="cc-tabs cc-filter-scroll ${equal ? 'cc-tabs-equal' : ''}" id="t">
      ${labels.map((l,i)=>`<a class="${i===0?'cc-tab-active':'cc-tab'}">${l}</a>`).join('')}</div></div></body></html>`)
    const m = await p.evaluate(() => {
      const t = document.getElementById('t')
      const w = [...t.children].filter(c => c.tagName === 'A').map(c => Math.round(c.getBoundingClientRect().width))
      const box = t.getBoundingClientRect()
      const primo = t.children[0].getBoundingClientRect()
      const ultimo = [...t.children].filter(c => c.tagName === 'A').pop().getBoundingClientRect()
      return { w, sx: Math.round(primo.left - box.left), dx: Math.round(box.right - ultimo.right), scroll: t.scrollWidth > t.clientWidth }
    })
    console.log(`${nome.padEnd(13)} ${equal ? 'UGUALI ' : 'oggi   '} larghezze: ${m.w.join(' · ').padEnd(28)} bordo sx ${m.sx}px / dx ${m.dx}px ${m.scroll ? '⚠️ scorre' : ''}`)
    await p.close()
  }
}
await b.close()
