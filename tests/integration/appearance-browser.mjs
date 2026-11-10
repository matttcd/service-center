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
page.setDefaultTimeout(20000)
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
const routes = ['recepcion', 'taller', 'terminados', 'ordenes', 'clientes', 'actividad', 'metricas', 'usuarios', 'backups', 'papelera', 'configuracion', 'ajustes']
const headings = new Map()
try {
  await page.setViewport({ width: 1366, height: 768 })
  await page.goto(`${base}/login`, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('input[type=password]')
  await page.type('input[type=password]', 'Browser-updated-2026')
  await page.click('button[type=submit]')
  await page.waitForSelector('.sc-sidebar')
  for (const route of routes) {
    await page.goto(`${base}/${route}`, { waitUntil: 'domcontentloaded' })
    await page.waitForSelector('.sc-content h1')
    if (route === 'metricas') await page.waitForSelector('.sc-metrics')
    for (const dark of [false, true]) {
      await page.setViewport({ width: 1366, height: 768 })
      await page.waitForFunction(() => document.querySelector('.sc-sidebar').getBoundingClientRect().left >= -1)
      if (route === 'taller') await page.click('#queue-all')
      await page.evaluate((dark) => document.documentElement.classList.toggle('dark', dark), dark)
      for (const [width, height] of [[1366, 768], [1024, 768], [390, 844]]) {
        await page.setViewport({ width, height })
        await page.waitForFunction(() => { const rect = document.querySelector('.sc-sidebar').getBoundingClientRect(); return matchMedia('(max-width:1023px)').matches ? rect.right <= 1 : rect.left >= -1 })
        assert.equal(await page.$eval('.sc-content h1', node => getComputedStyle(node).fontSize), '18px', `${route}: tamaño uniforme del título a ${width}`)
        const heading = await page.$eval('.sc-page-heading', node => {
          const box = node.getBoundingClientRect()
          return { top: box.top, height: box.height, titleTop: node.querySelector('h1').getBoundingClientRect().top, gap: node.nextElementSibling.getBoundingClientRect().top - box.bottom }
        })
        const key = `${dark}:${width}`
        if (!headings.has(key)) headings.set(key, heading)
        const reference = headings.get(key)
        assert.ok(Math.abs(heading.top - reference.top) <= 1, `${route}: encabezado alineado con Recepción a ${width}`)
        if (width >= 1024) {
          assert.ok(Math.abs(heading.titleTop - reference.titleTop) <= 1, `${route}: título alineado con Recepción a ${width}`)
          assert.ok(Math.abs(heading.height - reference.height) <= 1, `${route}: mismo espacio del encabezado a ${width}: ${JSON.stringify(heading)}`)
          assert.ok(Math.abs(heading.gap - reference.gap) <= 1, `${route}: misma separación del contenido a ${width}: ${JSON.stringify(heading)}`)
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, `${route}: desbordamiento a ${width}`)
        if (route === 'metricas') {
          const charts = await page.$$eval('.sc-metric-bars', (nodes) => nodes.map((node) => node.getBoundingClientRect().top))
          assert.equal(charts.length, 2)
          assert.equal(Math.abs(charts[0] - charts[1]) < 12, width >= 1024, `Gráficos de métricas a ${width}`)
          assert.ok(await page.$$eval('.sc-metric-income dd:not(.sc-secondary)', (values) => values.every((value) => {
            const range = document.createRange()
            range.selectNodeContents(value)
            return range.getClientRects().length === 1
          })), `Importes completos en una línea a ${width}`)
        }
        if (width === 1366) {
          const sidebar = await page.evaluate(() => {
            const footer = document.querySelector('.sc-profile-footer').getBoundingClientRect()
            return { bottom: footer.bottom, theme: !!document.querySelector('.sc-sidebar button[title^="Cambiar a modo"]') }
          })
          assert.ok(Math.abs(sidebar.bottom - height) <= 1, `${route}: perfil al fondo`)
          assert.equal(sidebar.theme, false, `${route}: tema fuera del sidebar`)
          if (route === 'recepcion' || route === 'taller') {
            await page.waitForSelector('[data-order-id]')
            await page.click('[data-order-id]')
            await page.waitForSelector('.ws-sheet')
            const aligned = await page.evaluate(() => {
              const panel = document.querySelector('.ws-layout').getBoundingClientRect()
              const search = document.querySelector('.ws-search input').getBoundingClientRect()
              const list = document.querySelector('.ws-queue-list').getBoundingClientRect()
              const tabs = document.querySelector('.sc-tabs').getBoundingClientRect()
              const last = document.querySelector('.sc-tabs > button:last-child').getBoundingClientRect()
              const count = document.querySelector('.sc-tab-count')
              return { center: Math.abs((search.top + search.bottom) / 2 - panel.top - 42), edge: Math.abs(list.top - panel.top - 84), end: Math.abs(tabs.right - last.right), radius: parseFloat(getComputedStyle(count).borderRadius), countHeight: count.offsetHeight }
            })
            assert.ok(aligned.center <= 1 && aligned.edge <= 1, `${route}: buscador y encabezado alineados ${JSON.stringify(aligned)}`)
            assert.ok(aligned.end <= 1, `${route}: pestañas terminan en la última`)
            assert.ok(aligned.radius >= aligned.countHeight / 2, `${route}: contador redondeado`)
          }
          const tabs = await page.$$('[role=tab]')
          if (tabs.length) {
            await tabs[0].focus(); await page.keyboard.press('End')
            await page.waitForFunction(() => document.querySelector('[role=tab]:last-child').getAttribute('aria-selected') === 'true')
            assert.ok(await page.evaluate(() => document.activeElement === document.querySelector('[role=tab]:last-child')))
            await page.keyboard.press('ArrowRight')
            await page.waitForFunction(() => document.querySelector('[role=tab]:first-child').getAttribute('aria-selected') === 'true')
            await page.keyboard.press('ArrowLeft')
            await page.waitForFunction(() => document.querySelector('[role=tab]:last-child').getAttribute('aria-selected') === 'true')
            await page.keyboard.press('Home')
            await page.waitForFunction(() => document.querySelector('[role=tab]:first-child').getAttribute('aria-selected') === 'true')
            if (route === 'taller') await page.click('#queue-all')
            if (route === 'taller' || route === 'recepcion') { await page.waitForSelector('[data-order-id]'); await page.click('[data-order-id]'); await page.waitForSelector('.ws-sheet') }
          }
        }
        if (['recepcion', 'terminados', 'clientes', 'actividad', 'metricas', 'configuracion', 'resumen', 'ajustes'].includes(route) && width !== 1024) {
          await page.screenshot({ path: path.join(output, `app-${route}-${dark ? 'oscuro' : 'claro'}-${width}.png`), fullPage: true })
        }
      }
    }
    console.log(`✓ Presentación: ${route}, ambos temas y tres tamaños.`)
  }
  assert.deepEqual(errors, [])
} catch (error) {
  await page.screenshot({ path: path.join(output, 'apariencia-fallo.png'), fullPage: true }).catch(() => {})
  throw error
} finally { await browser.close() }
