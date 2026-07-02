import puppeteer from 'puppeteer'

const browser = await puppeteer.launch({ headless: 'new', defaultViewport: { width: 1440, height: 900 } })
const page = await browser.newPage()
await page.goto('http://localhost:3000', { waitUntil: 'load', timeout: 30000 })
await page.waitForSelector('.artist-label-text')

// Sample opacity/transform of .artist-label-text every ~33ms (30fps) for 8.5s to catch a slide transition (fires every 7000ms).
const samples = await page.evaluate(async () => {
  const text = document.querySelector('.artist-label-text')
  const wrap = document.querySelector('.artist-label-wrap')
  const out = []
  const start = performance.now()
  return await new Promise(resolve => {
    function tick() {
      const now = performance.now()
      const cs = getComputedStyle(text)
      const wcs = getComputedStyle(wrap)
      out.push({
        t: Math.round(now - start),
        opacity: cs.opacity,
        transform: cs.transform,
        wrapWidth: wcs.width,
        content: text.textContent,
      })
      if (now - start < 16000) {
        requestAnimationFrame(tick)
      } else {
        resolve(out)
      }
    }
    requestAnimationFrame(tick)
  })
})

console.log(JSON.stringify(samples))
await browser.close()
