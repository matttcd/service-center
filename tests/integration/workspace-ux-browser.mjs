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
const api = async (route, method = 'GET', body, token = login.token) => {
  const response = await fetch(`${base}/api${route}`, { method, signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const data = await response.json(); assert.ok(response.ok, `${route}: ${JSON.stringify(data)}`); return data
}
const data = await api('/bootstrap')
const tech = data.users.find(u => u.active && u.name === 'Técnico Pruebas') || data.users.find(u => u.active && /^Técnico Flujo /i.test(u.name))
assert.ok(tech && data.customers[0])
const techLogin = await api('/auth/login', 'POST', { profileId: tech.id, password: tech.name === 'Técnico Pruebas' ? 'Verification-tech-2026' : 'Technician-flow-2026' })
const profilesBefore = (await api('/auth/profiles')).profiles.length
const order = (await api('/orders', 'POST', { customerId: data.customers[0].id, brand: 'Samsung', model: `UX ${Date.now()}`, deviceType: 'Celular', conditions: 'Sin observaciones', accessories: 'Sin accesorios', noPin: true, diagnosisType: 'revision', issue: 'Verificar continuidad de la vista y confirmaciones' })).order
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] })
const adminContext = await browser.createBrowserContext(), techContext = await browser.createBrowserContext()
const admin = await adminContext.newPage(), page = await techContext.newPage()
const errors = [], output = path.resolve('test-results/integracion-ui')
fs.mkdirSync(output, { recursive: true })
for (const target of [admin, page]) {
  target.setDefaultTimeout(20000)
  target.on('pageerror', error => errors.push(error.message))
  target.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : (errors.push(dialog.type()), dialog.dismiss()))
}
const enter = async (target, session, route) => {
  await target.goto(`${ui}/login`, { waitUntil: 'domcontentloaded' })
  await target.evaluate(session => localStorage.setItem('service_session_v1', JSON.stringify(session)), { token: session.token, user: session.user })
  await target.goto(`${ui}/${route}`, { waitUntil: 'domcontentloaded' }); await target.waitForSelector('.sc-page-heading')
}
const click = async (target, text, root = 'body') => {
  await target.waitForFunction((text, root) => [...document.querySelectorAll(`${root} button`)].some(n => n.getClientRects().length && !n.disabled && n.textContent.trim() === text), {}, text, root)
  const node = await target.evaluateHandle((text, root) => [...document.querySelectorAll(`${root} button`)].find(n => n.getClientRects().length && !n.disabled && n.textContent.trim() === text), text, root)
  await node.asElement().focus(); await target.keyboard.press('Enter'); await node.dispose()
}
const open = async () => { await page.waitForSelector(`[data-order-id="${order.id}"]`); await page.focus(`[data-order-id="${order.id}"]`); await page.keyboard.press('Enter'); await page.waitForSelector('.ws-sheet') }
const footer = async text => page.waitForFunction(text => document.querySelector('.ws-footer .primary')?.textContent === text && !document.querySelector('.ws-footer .primary').disabled, {}, text)
let listGate, releaseList, observedList, holdLists = false, failLists = false, statusPosts = 0, failStatus = false
let stage = 'Carga inicial'
const waitList = () => new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error(`No comenzó la consulta: ${stage}`)), 20000)
  timeout.unref()
  observedList = () => { clearTimeout(timeout); resolve() }
})
try {
  await admin.setViewport({ width: 1366, height: 768 }); await page.setViewport({ width: 390, height: 844 })
  await enter(admin, login, 'ordenes'); await admin.waitForSelector('[aria-busy=false] table')
  await admin.setRequestInterception(true)
  admin.on('request', async request => {
    if (request.url().includes('/api/orders?')) {
      if (holdLists) { observedList?.(); await listGate }
      if (failLists) return request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Consulta de prueba fallida' }) })
    }
    await request.continue().catch(() => {})
  })
  stage = 'Navegación a clientes'
  await admin.focus('a[href="/clientes"]'); await admin.keyboard.press('Enter'); await admin.waitForFunction(() => document.querySelector('h1')?.textContent === 'Clientes')
  stage = 'Sincronización externa de caché'
  const updated = admin.waitForResponse(response => response.url().endsWith('/api/bootstrap'))
  await api(`/orders/${order.id}`, 'PUT', { issue: 'Actualización externa de prueba' }); await updated
  await admin.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  listGate = new Promise(resolve => { releaseList = resolve }); holdLists = true
  const listed = waitList()
  stage = 'Volver a órdenes con caché'
  await admin.focus('a[href="/ordenes"]'); await admin.keyboard.press('Enter'); await admin.waitForFunction(() => document.querySelector('h1')?.textContent === 'Órdenes de servicio'); await listed
  assert.ok(await admin.$('table'), 'Volver conserva la tabla después de cambios externos')
  assert.ok((await admin.$eval('table', node => node.textContent)).includes(order.orderNumber))
  assert.equal(await admin.$eval('.sc-content', node => node.textContent.includes('Actualizando')), false)
  const top = await admin.$eval('table', node => node.getBoundingClientRect().top)
  holdLists = false; releaseList(); await admin.waitForSelector('[aria-busy=false] table')
  assert.equal(await admin.$eval('table', node => node.getBoundingClientRect().top), top)
  listGate = new Promise(resolve => { releaseList = resolve }); holdLists = true
  await admin.evaluate(() => { window.previousTable = document.querySelector('table') })
  stage = 'Revalidación de tabla'
  const revalidation = waitList()
  await api(`/orders/${order.id}`, 'PUT', { issue: 'Otra actualización externa' }); await revalidation
  assert.ok(await admin.evaluate(() => document.querySelector('table') === window.previousTable), 'La revalidación no desmonta la tabla')
  assert.equal(await admin.$eval('table', node => node.getBoundingClientRect().top), top)
  holdLists = false; releaseList(); await admin.waitForSelector('[aria-busy=false] table')
  failLists = true
  stage = 'Consulta fallida'
  await admin.type('input[placeholder^="Buscar por"]', 'consulta fallida')
  await admin.waitForFunction(() => document.querySelector('[role=alert]')?.textContent.includes('Consulta de prueba fallida'))
  assert.ok(await admin.$('table'), 'Un error conserva los resultados anteriores')
  failLists = false
  console.log('✓ Tabla y caché estables durante recargas lentas, errores y cambios externos; sin fila Actualizando.')

  stage = 'Tomar trabajo en móvil'
  await enter(page, techLogin, 'taller'); await page.focus('#queue-available'); await page.keyboard.press('Enter'); await open()
  await page.setRequestInterception(true)
  page.on('request', async request => {
    if (request.method() === 'POST' && request.url().endsWith(`/orders/${order.id}/status`)) {
      statusPosts++
      if (failStatus) return request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'No se guardó el estado de prueba' }) })
    }
    await request.continue().catch(() => {})
  })
  const transition = async (label, root = '.ws-footer') => {
    const previous = (await api(`/orders/${order.id}`)).order.status, before = statusPosts
    await click(page, label, root); await page.waitForSelector('[role=dialog]')
    assert.equal((await api(`/orders/${order.id}`)).order.status, previous)
    assert.equal(statusPosts, before, 'No guardar antes de confirmar')
    await click(page, 'Cancelar', '[role=dialog]'); await page.waitForSelector('[role=dialog]', { hidden: true })
    assert.equal((await api(`/orders/${order.id}`)).order.status, previous)
    await click(page, label, root); await click(page, 'Confirmar', '[role=dialog]'); await page.waitForSelector('[role=dialog]', { hidden: true })
    assert.equal(statusPosts - before, 1)
  }
  await page.$eval('.ws-sheet', node => { node.scrollTop = node.scrollHeight }); await page.evaluate(() => window.scrollTo(0, 100))
  await transition('Iniciar revisión'); await page.waitForSelector('#queue-mine[aria-selected=true]'); await footer('Registrar diagnóstico')
  await page.waitForFunction(() => window.scrollY === 0 && document.querySelector('.ws-sheet').scrollTop === 0)
  await click(page, 'Registrar diagnóstico', '.ws-footer'); await page.waitForSelector('.ws-work-editor textarea'); await page.type('.ws-work-editor textarea', 'Cambiar conector'); await click(page, 'Guardar', '.ws-work-editor'); await footer('Enviar a recepción')

  await page.$eval('.ws-tools > button', node => node.click()); await page.waitForSelector('.sc-notes-modal')
  stage = 'Notas de altura estable'
  const height = await page.$eval('.sc-notes-modal', node => node.getBoundingClientRect().height)
  for (const text of ['Primer mensaje', 'Segundo mensaje\nCon otra línea']) {
    await page.type('.sc-note-compose textarea', text); await click(page, 'Guardar nota', '.sc-note-compose')
    await page.waitForFunction(() => document.querySelector('.sc-notes')?.getAttribute('aria-busy') === 'false' && document.querySelector('.sc-note-compose textarea')?.value === '')
    assert.equal(await page.$eval('.sc-notes-modal', node => node.getBoundingClientRect().height), height)
  }
  for (let i = 0; i < 10; i++) await api(`/orders/${order.id}`, 'PUT', { note: `Mensaje adicional ${i}` }, techLogin.token)
  await page.waitForFunction(() => document.querySelectorAll('[data-note-id]').length === 12)
  assert.ok(await page.$eval('.sc-note-history', node => node.scrollHeight > node.clientHeight))
  assert.ok((await page.$$('.sc-note-author')).length < 12, 'Autor y hora compartidos por grupo')
  assert.equal(await page.$eval('.sc-notes-modal', node => node.getBoundingClientRect().height), height)
  await page.$eval('.sc-note-history', node => { node.scrollTop = 0; node.dispatchEvent(new Event('scroll', { bubbles: true })) })
  await api(`/orders/${order.id}`, 'PUT', { note: 'Mensaje recibido mientras leo el historial' }, techLogin.token)
  await page.waitForFunction(() => document.querySelectorAll('[data-note-id]').length === 13)
  assert.equal(await page.$eval('.sc-note-history', node => node.scrollTop), 0)
  for (const dark of [false, true]) {
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark)
    await page.screenshot({ path: path.join(output, `notas-mensajes-${dark ? 'oscuro' : 'claro'}-390.png`) })
  }
  await page.keyboard.press('Escape'); await transition('Enviar a recepción'); await page.waitForSelector('.ws-sheet', { hidden: true })
  await api(`/orders/${order.id}`, 'PUT', { price: 45000 }); await api(`/orders/${order.id}/notified`, 'POST', { notified: true }); await api(`/orders/${order.id}/confirm`, 'POST', { confirmed: true })
  await open(); await footer('Iniciar reparación'); await transition('Iniciar reparación'); await footer('Finalizar reparación')
  await transition('Esperar repuestos', '.ws-work'); await page.waitForSelector('.ws-sheet', { hidden: true }); await open(); await footer('Retomar reparación'); await transition('Retomar reparación'); await footer('Finalizar reparación')
  await click(page, 'Finalizar reparación', '.ws-footer'); await click(page, 'Cancelar', '[role=dialog]'); await page.waitForSelector('[role=dialog]', { hidden: true })
  assert.equal((await api(`/orders/${order.id}`)).order.status, 'en_reparacion')
  failStatus = true
  await click(page, 'Finalizar reparación', '.ws-footer'); await click(page, 'Confirmar', '[role=dialog]'); await page.waitForFunction(() => document.querySelector('[data-notification=error]')?.textContent.includes('No se guardó el estado'))
  assert.ok(await page.$('[role=dialog]')); assert.equal((await api(`/orders/${order.id}`)).order.status, 'en_reparacion')
  failStatus = false
  const before = statusPosts
  await page.$$eval('[role=dialog] button', nodes => { const button = nodes.find(node => node.textContent === 'Confirmar'); button.click(); button.click() })
  await page.waitForSelector('[role=dialog]', { hidden: true }); await page.waitForSelector('.ws-sheet', { hidden: true })
  assert.equal((await api(`/orders/${order.id}`)).order.status, 'terminado'); assert.equal(statusPosts - before, 1)
  assert.deepEqual(errors, []); assert.equal((await api('/auth/profiles')).profiles.length, profilesBefore)
  console.log('✓ Confirmación/cancelación de estados, fallo y reintento sin duplicados, scroll móvil al iniciar y notas agrupadas con altura estable.')
} catch (error) {
  console.error(`Etapa: ${stage}; admin=${admin.url()}; técnico=${page.url()}`)
  await admin.screenshot({ path: path.join(output, 'workspace-ux-admin-fallo.png'), fullPage: true }).catch(() => {})
  await page.screenshot({ path: path.join(output, 'workspace-ux-fallo.png'), fullPage: true }).catch(() => {})
  throw error
} finally { holdLists = false; failLists = false; failStatus = false; observedList?.(); releaseList?.(); await browser.close(); await api(`/orders/${order.id}`, 'DELETE') }
