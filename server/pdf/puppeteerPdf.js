// ============================================
// puppeteerPdf.js: singleton Chromium browser + html-to-PDF rendering
// ============================================
import puppeteer from 'puppeteer'
import { existsSync } from 'node:fs'

let browserPromise = null

function resolveExecutablePath() {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) return process.env.PUPPETEER_EXECUTABLE_PATH
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
  ]
  for (const p of candidates) {
    if (existsSync(p)) return p
  }
  return undefined
}

async function getBrowser() {
  if (!browserPromise) {
    const executablePath = resolveExecutablePath()
    browserPromise = puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    }).then((browser) => {
      browser.once('disconnected', () => { browserPromise = null })
      return browser
    }).catch((err) => {
      browserPromise = null
      throw err
    })
  }
  return browserPromise
}

export async function htmlToPdf(html) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    // Los comprobantes son autocontenidos. Bloquea JS y accesos a red/archivos
    // desde términos editables antes de renderizar el HTML.
    await page.setJavaScriptEnabled(false)
    await page.setRequestInterception(true)
    page.on('request', (request) => {
      if (request.url().startsWith('data:') || request.url() === 'about:blank') request.continue()
      else request.abort()
    })
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 15000 })
    const raw = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
    })
    return Buffer.from(raw)
  } finally {
    await page.close()
  }
}

export async function closeBrowser() {
  if (browserPromise) {
    const browser = await browserPromise.catch(() => null)
    if (browser) await browser.close().catch(() => {})
    browserPromise = null
  }
}
