import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from '../../server/node_modules/puppeteer/lib/puppeteer/puppeteer.js'

const base = process.env.VERIFY_URL || 'http://127.0.0.1:8181', ui = process.env.UI_URL || base
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):818[123]$/)
assert.match(ui, /^http:\/\/(localhost|127\.0\.0\.1):(818[123]|517[67])$/)
for (const url of new Set([base, ui])) assert.equal((await fetch(`${url}/api/health`).then(r => r.json())).verification, 'service-center-isolated-tests')
const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@local.com', password: 'Browser-updated-2026' }) }).then(r => r.json())
assert.ok(login.token)
const api = async (route, method = 'GET', body) => {
  const response = await fetch(`${base}/api${route}`, { method, headers: { Authorization: `Bearer ${login.token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const data = await response.json(); assert.ok(response.ok, `${route}: ${JSON.stringify(data)}`); return data
}
const data = await api('/bootstrap'), tech = data.technicians[0], customer = data.customers[0]
assert.ok(tech && customer)
const profilesBefore = (await api('/auth/profiles')).profiles.length
const order = (await api('/orders', 'POST', { customerId: customer.id, brand: 'Samsung', model: 'Prueba móvil', conditions: 'Sin observaciones', accessories: 'Sin accesorios', noPin: true, diagnosisType: 'revision', issue: 'Verificar formularios en pantalla pequeña', deviceType: 'Celular' })).order
const output = path.resolve('test-results/integracion-ui')
fs.mkdirSync(output, { recursive: true })
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage(); page.setDefaultTimeout(20000)
const errors = []; page.on('pageerror', error => errors.push(error.message))
page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : (errors.push(`Diálogo nativo: ${dialog.type()}`), dialog.dismiss()))
const click = async (text, root = 'body') => {
  await page.waitForFunction((text, root) => [...document.querySelectorAll(`${root} button`)].some(n => n.getClientRects().length && !n.disabled && n.textContent.trim() === text), {}, text, root)
  const element = await page.evaluateHandle((text, root) => [...document.querySelectorAll(`${root} button`)].find(n => n.getClientRects().length && !n.disabled && n.textContent.trim() === text), text, root)
  await element.asElement().focus(); await page.keyboard.press('Enter'); await element.dispose()
}
const go = async route => { await page.goto(`${ui}/${route}`, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('.sc-sidebar') }
const close = async () => { await page.keyboard.press('Escape'); await page.waitForSelector('[role=dialog]', { hidden: true }) }
const modal = async (name, compact = false) => {
  await page.waitForSelector('[role=dialog]')
  for (const dark of [false, true]) {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark)
    for (const [width, height] of [[390, 844], [360, 640], [320, 640], [844, 390], [1024, 768], [1366, 768]]) {
      await page.setViewport({ width, height })
      await page.waitForFunction(() => Math.abs(document.querySelector('.sc-modal').getBoundingClientRect().height - visualViewport.height) < 2)
      const layout = await page.$eval('[role=dialog]', panel => {
        const rect = panel.getBoundingClientRect(), body = panel.querySelector('.sc-modal-body'), close = panel.querySelector('[aria-label=Cerrar]')?.getBoundingClientRect()
        return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, height: rect.height, overflow: body.scrollWidth - body.clientWidth, close: close ? { right: close.right, bottom: close.bottom, width: close.width, height: close.height } : null }
      })
      assert.ok(layout.x >= 10 && layout.y >= 10 && layout.right <= width - 10 && layout.bottom <= height - 10, `${name}: fuera de pantalla ${width}: ${JSON.stringify(layout)}`)
      assert.ok(layout.overflow <= 2, `${name}: desbordamiento interno ${width}`)
      assert.ok(layout.close && layout.close.width >= 44 && layout.close.height >= 44 && layout.close.right <= layout.right && layout.close.bottom <= layout.bottom)
      if (compact && height === 844) assert.ok(layout.height < height * .8, `${name}: ventana corta no debe ocupar toda la pantalla`)
      if (width === 390) await page.screenshot({ path: path.join(output, `movil-${name}-${dark ? 'oscuro' : 'claro'}.png`) })
    }
  }
  await page.setViewport({ width: 390, height: 440 })
  const input = await page.$('[role=dialog] input:not([type=checkbox],[type=radio]),[role=dialog] textarea')
  if (input) {
    await input.focus()
    assert.ok(await input.evaluate(node => parseFloat(getComputedStyle(node).fontSize) >= 16))
  }
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => !!document.activeElement.closest('[role=dialog]')), `${name}: foco fuera de ventana`) }
  await page.$eval('.sc-modal-body', body => { body.scrollTop = body.scrollHeight })
  assert.ok(await page.$eval('[role=dialog] [aria-label=Cerrar]', node => node.getBoundingClientRect().bottom <= innerHeight))
  await page.setViewport({ width: 390, height: 844 })
  console.log(`✓ Móvil: ${name}, temas, retrato/paisaje, scroll y foco.`)
}
try {
  await page.setViewport({ width: 390, height: 844 })
  await page.goto(`${ui}/login`, { waitUntil: 'domcontentloaded' }); await page.evaluate(session => localStorage.setItem('service_session_v1', JSON.stringify(session)), { token: login.token, user: login.user })
  await go('recepcion'); await page.waitForSelector('.sc-page-heading')
  for (const route of ['recepcion', 'taller', 'ordenes', 'terminados', 'clientes', 'actividad', 'usuarios', 'backups', 'papelera', 'ajustes']) {
    await go(route); await page.waitForSelector('.sc-page-heading')
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2), false, `${route}: desbordamiento de página`)
    const heading = await page.$eval('.sc-page-heading', node => {
      const title = node.querySelector('h1').getBoundingClientRect(), action = node.querySelector('.sc-page-actions')?.getBoundingClientRect()
      return { title: { left: title.left, right: title.right, top: title.top, bottom: title.bottom }, action: action ? { left: action.left, right: action.right, top: action.top, bottom: action.bottom } : null }
    })
    if (heading.action) assert.ok(heading.action.right <= 390 && (heading.action.left >= heading.title.right || heading.action.top >= heading.title.bottom), `${route}: título y acciones superpuestos`)
    const tabs = await page.$$('[role=tab]')
    if (tabs.length) {
      await tabs[0].focus(); await page.keyboard.press('End')
      await page.waitForFunction(() => document.querySelector('[role=tab]:last-child')?.getAttribute('aria-selected') === 'true')
      assert.ok(await page.$eval('[role=tab]:last-child', node => { const r = node.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth }))
      await page.keyboard.press('Home')
    }
    if (['recepcion', 'ordenes', 'ajustes'].includes(route)) for (const dark of [false, true]) {
      await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark)
      await page.screenshot({ path: path.join(output, `movil-pagina-${route}-${dark ? 'oscuro' : 'claro'}.png`) })
    }
  }
  await go('recepcion'); await page.click('[aria-label="Abrir menú"]')
  await page.waitForFunction(() => document.querySelector('.sc-sidebar').getBoundingClientRect().left >= -1)
  await page.click('[aria-label="Cambiar de perfil"]'); await page.waitForSelector('[role=menuitem]:not(:disabled)'); await page.$eval('[role=menuitem]:not(:disabled)', node => node.click())
  await modal('perfil', true); await close(); await page.click('[aria-label="Cerrar menú"]')
  await go('ajustes'); await click('Cambiar contraseña'); await modal('contrasena', true); await close()
  await go('usuarios'); await click('Nuevo usuario'); await modal('usuario', true); await close()
  await go('clientes'); await click('Nuevo cliente'); await modal('cliente'); await close()
  await go('recepcion'); await click('Nueva orden'); await modal('nueva-orden')
  await page.$eval('[role=dialog] button[title=Celular]', node => node.click()); await click('Otra', '[role=dialog]')
  await page.waitForFunction(() => document.querySelectorAll('[role=dialog]').length === 2)
  for (let i = 0; i < 12; i++) { await page.keyboard.press('Tab'); assert.ok(await page.evaluate(() => document.activeElement.closest('[role=dialog]') === [...document.querySelectorAll('[role=dialog]')].at(-1)), 'El foco debe permanecer en el selector anidado') }
  await page.keyboard.press('Escape'); await page.waitForFunction(() => document.querySelectorAll('[role=dialog]').length === 1)
  assert.ok(await page.evaluate(() => document.activeElement.textContent.trim() === 'Otra'), 'Devolver el foco al botón de marca')
  await close()
  await click('Nueva orden'); await page.waitForSelector('[role=dialog] button[title=Celular]'); assert.ok(await page.$eval('[role=dialog] button[title=Celular]', node => node.className.includes('border-primary')), 'Conservar el borrador de orden al cerrar'); await close()
  await api(`/orders/${order.id}/status`, 'POST', { status: 'en_revision', assignedTo: tech.id })
  await api(`/orders/${order.id}`, 'PUT', { fix: 'Cambiar conector' })
  await api(`/orders/${order.id}/status`, 'POST', { status: 'presupuesto' })
  // Navegar dentro de la app conserva el borrador; no simular una recarga con beforeunload.
  await page.$eval('a[href="/ordenes"]', link => link.click())
  await page.waitForFunction(number => [...document.querySelectorAll('tbody tr')].some(row => row.textContent.includes(number)), {}, order.orderNumber)
  await page.evaluate(number => [...document.querySelectorAll('tbody tr')].find(row => row.textContent.includes(number)).click(), order.orderNumber)
  await page.waitForSelector('.ws-sheet')
  for (const [label, name] of [['Notas', 'notas'], ['Repuestos', 'repuestos'], ['Historial', 'historial']]) { await page.$eval('.ws-tools', (tools, label) => [...tools.querySelectorAll('button')].find(n => n.textContent.startsWith(label)).click(), label); await modal(name); await close() }
  for (const [label, name] of [['Editar datos del equipo', 'equipo'], ['Asignar técnico', 'tecnico'], ['Editar presupuesto', 'presupuesto'], ['Retirar equipo', 'retiro'], ['Eliminar', 'confirmacion']]) {
    await click('Acciones'); await click(label, '[role=menu]'); await modal(name, ['tecnico', 'presupuesto', 'confirmacion'].includes(name)); await close()
  }
  await click('Acciones'); await click('Retirar equipo', '[role=menu]'); await click('Sin orden', '[role=dialog]'); await click('Otra persona', '[role=dialog]'); await modal('retiro-tercero'); await close()
  await click('Acciones'); await click('Imprimir orden', '[role=menu]'); await modal('impresion'); await close()
  await click('Editar', '.ws-work'); await modal('trabajo'); await close()
  assert.deepEqual(errors, [])
  assert.equal((await api('/auth/profiles')).profiles.length, profilesBefore)
} catch (error) {
  await page.screenshot({ path: path.join(output, 'movil-fallo.png'), fullPage: true }).catch(() => {})
  throw error
} finally { await browser.close(); await api(`/orders/${order.id}`, 'DELETE') }
