import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: 'new', defaultViewport: { width: 1440, height: 900 } })
const page = await browser.newPage()
await page.goto('http://localhost:3000', { waitUntil: 'networkidle0', timeout: 30000 })

await page.waitForSelector('.start-btn')
await page.screenshot({ path: 'C:/Users/water/AppData/Local/Temp/claude/d--Code-streamrace/213f00cf-659f-4959-a83a-6871a649cf14/scratchpad/before.png' })

await page.click('.start-btn')
await new Promise(r => setTimeout(r, 800)) // let transitions settle

await page.screenshot({ path: 'C:/Users/water/AppData/Local/Temp/claude/d--Code-streamrace/213f00cf-659f-4959-a83a-6871a649cf14/scratchpad/after.png' })

const info = await page.evaluate(() => {
  const overlay = document.querySelector('.expand-overlay')
  const nameWrap = document.querySelector('.artist-label-wrap')
  const outer = document.querySelector('[data-panel-open]')
  const overlayStyle = overlay ? getComputedStyle(overlay) : null
  const nameStyle = nameWrap ? getComputedStyle(nameWrap) : null
  return {
    hasDataPanelOpen: !!outer,
    overlay: overlayStyle ? { display: overlayStyle.display, opacity: overlayStyle.opacity } : null,
    nameWrap: nameStyle ? { opacity: nameStyle.opacity, visibility: nameStyle.visibility, pointerEvents: nameStyle.pointerEvents } : null,
  }
})
console.log(JSON.stringify(info, null, 2))

await browser.close()
