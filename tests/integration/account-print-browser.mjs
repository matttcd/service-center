import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(new URL('../../server/index.js', import.meta.url))
const { default: puppeteer } = await import(pathToFileURL(require.resolve('puppeteer')).href)
const base = process.env.VERIFY_URL || 'http://127.0.0.1:8181'
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):8181$/)
assert.equal((await fetch(`${base}/api/health`).then((response) => response.json())).verification, 'service-center-isolated-tests')
const output = path.resolve('test-results/integracion-ui')
fs.mkdirSync(output, { recursive: true })
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
page.setDefaultTimeout(30000)
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
await page.evaluateOnNewDocument(() => {
  const revoke = URL.revokeObjectURL
  window.revokedPreviewUrls = []
  URL.revokeObjectURL = (url) => { window.revokedPreviewUrls.push(url); revoke.call(URL, url) }
})
const click = async (text, root = '[role=dialog]') => {
  await page.waitForFunction((text, root) => [...document.querySelectorAll(`${root} button`)].some((node) => node.textContent.trim() === text && !node.disabled), {}, text, root)
  const handle = await page.evaluateHandle((text, root) => [...document.querySelectorAll(`${root} button`)].find((node) => node.textContent.trim() === text && !node.disabled), text, root)
  await handle.asElement().click(); await handle.dispose()
}
const visuals = async (name) => {
  for (const dark of [false, true]) {
    // Revisa ambos temas sin cerrar la ventana ni perder el estado bajo prueba.
    await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), dark)
    for (const [width, height] of [[1366, 768], [1024, 768], [390, 844]]) {
      await page.setViewport({ width, height })
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false)
      assert.ok(await page.$eval('[role=dialog]', (node) => node.scrollWidth <= node.clientWidth + 2))
      await page.screenshot({ path: path.join(output, `${name}-${dark ? 'oscuro' : 'claro'}-${width}.png`) })
    }
  }
  await page.setViewport({ width: 1366, height: 768 })
}
let pdfAttempts = 0, printerAttempts = 0, failPrint = true, multiPage = null
const jobs = []
const externalRequests = []
try {
  await page.setViewport({ width: 1366, height: 768 })
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[type=password]')
  await page.type('input[type=password]', 'Browser-updated-2026')
  await page.click('button[type=submit]')
  await page.waitForSelector('.sc-sidebar')
  await page.goto(`${base}/ajustes`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.sc-account')
  await click('Cambiar contraseña', '.sc-account')
  for (const field of await page.$$('input[type=password]')) assert.ok(await field.evaluate((node) => !!node.labels?.length))
  await page.type('input[autocomplete=current-password]', 'Ejemplo de validación')
  for (const field of await page.$$('input[autocomplete=new-password]')) await field.type('corta')
  await click('Cambiar contraseña')
  await page.waitForSelector('[aria-label=Notificaciones] [role=alert]')
  assert.equal(await page.$eval('input[autocomplete=current-password]', (node) => node.value), 'Ejemplo de validación')
  await page.click('[aria-label="Cerrar notificación"]')
  await visuals('ajustes-contrasena')
  await page.keyboard.press('Escape')
  await page.waitForSelector('[role=dialog]', { hidden: true })
  assert.equal(await page.evaluate(() => document.activeElement.textContent.trim()), 'Cambiar contraseña')

  // Las impresoras y los envíos se simulan; el comprobante inicial usa el PDF real.
  await page.setRequestInterception(true)
  page.on('request', async (request) => {
    const url = new URL(request.url())
    if (/^https?:$/.test(url.protocol) && url.origin !== new URL(base).origin) {
      externalRequests.push(request.url())
      return request.abort()
    }
    const route = url.pathname
    if (request.url().startsWith(base) && route === '/api/printers') {
      printerAttempts++
      return request.respond({ status: printerAttempts === 1 ? 503 : 200, contentType: 'application/json', body: JSON.stringify(printerAttempts === 1 ? { error: 'Impresora de prueba desconectada' } : { printers: ['A4 de prueba', 'Segunda cola de prueba'] }) })
    }
    if (request.url().startsWith(base) && /\/api\/orders\/[^/]+\/pdf$/.test(route)) {
      pdfAttempts++
      if (multiPage) return request.respond({ status: 200, contentType: 'application/pdf', body: Buffer.from(multiPage) })
      if (pdfAttempts === 1) return request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Fallo de PDF de prueba' }) })
    }
    if (request.url().startsWith(base) && request.method() === 'POST' && route.includes('/print')) {
      jobs.push(JSON.parse(request.postData()))
      await new Promise((resolve) => setTimeout(resolve, 200))
      return request.respond({ status: failPrint ? 503 : 200, contentType: 'application/json', body: JSON.stringify(failPrint ? { error: 'Fallo de cola de prueba' } : { ok: true }) })
    }
    return request.continue()
  })
  await page.goto(`${base}/recepcion`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('.ws-sheet')
  await page.click('[aria-haspopup=menu]')
  await click('Imprimir orden', '[role=menu]')
  await page.waitForSelector('.sc-print-state[role=alert]')
  assert.equal(pdfAttempts, 1)
  assert.equal(jobs.length, 0)
  await page.click('.sc-print-warning button')
  await page.waitForFunction(() => document.querySelector('.sc-print-controls select').options.length === 3)
  await page.select('.sc-print-controls select', 'A4 de prueba')
  const pdfResponse = page.waitForResponse((response) => /\/api\/orders\/[^/]+\/pdf$/.test(new URL(response.url()).pathname) && response.ok())
  await page.click('.sc-print-state button')
  const response = await pdfResponse
  assert.match(response.headers()['content-type'], /application\/pdf/)
  const bytes = await fetch(response.url(), { headers: { Authorization: response.request().headers().authorization } }).then((result) => result.arrayBuffer())
  assert.equal(Buffer.from(bytes).subarray(0, 4).toString(), '%PDF')
  await page.waitForSelector('.sc-pdf-pages[aria-busy=false] canvas')
  assert.ok(await page.$eval('.sc-pdf-pages canvas', (canvas) => {
    const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
    let ink = 0
    for (let index = 0; index < pixels.length; index += 4) if (pixels[index] < 160 && pixels[index + 3] > 0) ink++
    return ink > 1000
  }), 'La vista previa debe dibujar el comprobante, no un área vacía')
  assert.equal(await page.$eval('.sc-print-controls select', (node) => node.value), 'A4 de prueba')
  await visuals('impresion-previa')
  for (let step = 0; step < 10; step++) {
    await page.keyboard.press('Tab')
    assert.ok(await page.evaluate(() => !!document.activeElement.closest('[role=dialog]')))
  }
  await click('Imprimir')
  await page.waitForSelector('[aria-label=Notificaciones] [role=alert]')
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], { printer: 'A4 de prueba' })
  assert.equal(await page.$eval('.sc-print-controls select', (node) => node.value), 'A4 de prueba')
  await page.click('[aria-label="Cerrar notificación"]')
  failPrint = false
  await page.$eval('.sc-print-actions .primary', (node) => { node.click(); node.click() })
  await page.waitForSelector('[aria-label=Notificaciones] [role=status]')
  assert.equal(jobs.length, 2, 'Un doble clic no debe duplicar el trabajo')
  const popupPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('El navegador cliente no abrió la pestaña PDF.')), 30000)
    page.once('popup', (popup) => { clearTimeout(timer); resolve(popup) })
  })
  await click('Abrir PDF para imprimir')
  const popup = await popupPromise
  await popup.waitForFunction(() => location.href.startsWith('blob:'))
  const blob = await popup.evaluate(() => location.href.split('#')[0])
  await popup.close()
  await click('Cerrar')
  await page.waitForSelector('[role=dialog]', { hidden: true })
  assert.ok(await page.evaluate((url) => window.revokedPreviewUrls.includes(url), blob), 'La vista previa se libera al cerrar')
  const fixture = await browser.newPage()
  await fixture.setContent('<h1>Primera página de prueba</h1><h1 style="break-before:page">Segunda página de prueba</h1>')
  multiPage = await fixture.pdf({ format: 'A4' })
  await fixture.close()
  await page.click('[aria-haspopup=menu]'); await click('Imprimir orden', '[role=menu]')
  await page.waitForSelector('.sc-pdf-pages[aria-busy=false] canvas')
  assert.equal((await page.$$('.sc-pdf-pages canvas')).length, 2, 'Se deben mostrar todas las páginas')
  assert.equal(jobs.length, 2, 'Abrir una vista previa no debe enviar un trabajo')
  await page.keyboard.press('Escape')
  await page.waitForSelector('[role=dialog]', { hidden: true })
  assert.deepEqual(errors, [])
  assert.deepEqual(externalRequests, [], 'El visor PDF debe funcionar usando solo los recursos locales.')
  console.log('✓ Ajustes y cambio de contraseña: diseño, etiquetas, validación, teclado y foco.')
  console.log('✓ Impresión: PDF real, varias páginas, errores y reintentos, selección conservada, envío simulado y doble clic sin duplicados. Ambos temas y tres tamaños; ninguna impresión física.')
} catch (error) {
  await page.screenshot({ path: path.join(output, 'ajustes-impresion-fallo.png') }).catch(() => {})
  throw error
} finally { await browser.close() }
