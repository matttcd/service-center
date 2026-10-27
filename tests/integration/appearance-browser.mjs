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
const routes = ['recepcion', 'taller', 'terminados', 'ordenes', 'clientes', 'actividad', 'resumen', 'metricas', 'usuarios', 'backups', 'papelera', 'configuracion', 'ajustes']
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
    for (const dark of [false, true]) {
      await page.setViewport({ width: 1366, height: 768 })
      await page.waitForFunction(() => document.querySelector('.sc-sidebar').getBoundingClientRect().left >= -1)
      if (route === 'taller') await page.click('#queue-all')
      if (await page.evaluate(() => document.documentElement.classList.contains('dark')) !== dark) {
        await page.click(`button[title="Cambiar a modo ${dark ? 'oscuro' : 'claro'}"]`)
      }
      for (const [width, height] of [[1366, 768], [1024, 768], [390, 844]]) {
        await page.setViewport({ width, height })
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, `${route}: desbordamiento a ${width}`)
        if (width === 1366) {
          const sidebar = await page.evaluate(() => {
            const footer = document.querySelector('.sc-profile-footer').getBoundingClientRect()
            const theme = document.querySelector('button[title^="Cambiar a modo"]').getBoundingClientRect()
            return { bottom: footer.bottom, theme: theme.bottom, profile: footer.top }
          })
          assert.ok(Math.abs(sidebar.bottom - height) <= 1, `${route}: perfil al fondo`)
          assert.ok(sidebar.theme < sidebar.profile, `${route}: tema fuera del perfil`)
          if (route === 'recepcion' || route === 'taller') {
            await page.waitForSelector('.ws-sheet')
            const aligned = await page.evaluate(() => {
              const header = document.querySelector('.ws-order-header').getBoundingClientRect()
              const search = document.querySelector('.ws-search input').getBoundingClientRect()
              const list = document.querySelector('.ws-queue-list').getBoundingClientRect()
              const tabs = document.querySelector('.sc-tabs').getBoundingClientRect()
              const last = document.querySelector('.sc-tabs > button:last-child').getBoundingClientRect()
              const count = document.querySelector('.sc-tab-count')
              return { center: Math.abs((search.top + search.bottom - header.top - header.bottom) / 2), edge: Math.abs(list.top - header.bottom), end: Math.abs(tabs.right - last.right), radius: parseFloat(getComputedStyle(count).borderRadius), countHeight: count.offsetHeight }
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
          }
        }
        if (['recepcion', 'terminados', 'clientes', 'actividad', 'configuracion', 'resumen', 'ajustes'].includes(route) && width !== 1024) {
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
