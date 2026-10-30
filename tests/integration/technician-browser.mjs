import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import puppeteer from '../../server/node_modules/puppeteer/lib/puppeteer/puppeteer.js'

const base = process.env.VERIFY_URL || 'http://127.0.0.1:8181'
const ui = process.env.UI_URL || base
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):818[123]$/)
assert.match(ui, /^http:\/\/(localhost|127\.0\.0\.1):(818[123]|517[67])$/)
for (const url of new Set([base, ui])) assert.equal((await fetch(`${url}/api/health`).then(r => r.json())).verification, 'service-center-isolated-tests')
const password = 'Technician-flow-2026'
const suffix = Date.now().toString(36)
const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@local.com', password: 'Browser-updated-2026' }) }).then(r => r.json())
assert.ok(login.token)
const api = async (route, method = 'GET', body, token = login.token, status = 200) => {
  const response = await fetch(`${base}/api${route}`, { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const data = await response.json()
  assert.equal(response.status, status, `${route}: ${JSON.stringify(data)}`)
  return data
}
const tech = await api('/users', 'POST', { name: `Técnico flujo ${suffix}`, password, role: 'tecnico' })
assert.equal('password' in tech.user, false)
const techLogin = await api('/auth/login', 'POST', { profileId: tech.id, password })
const reception = await api('/users', 'POST', { name: `Recepción flujo ${suffix}`, password, role: 'recepcion' })
const counterLogin = await api('/auth/login', 'POST', { profileId: reception.id, password })
const customer = await api('/customers', 'POST', { fullName: `Cliente flujo ${suffix}`, phone: '1100000030', dni: Date.now().toString().slice(-8), address: 'Pruebas 123' })
const order = (await api('/orders', 'POST', { customerId: customer.id, brand: 'Samsung', model: `Flujo ${suffix}`, deviceType: 'Celular', conditions: 'Sin observaciones', accessories: 'Sin accesorios', noPin: true, diagnosisType: 'revision', issue: 'No carga' })).order
await api(`/orders/${order.id}/status`, 'POST', { status: 'en_revision', assignedTo: tech.id }, techLogin.token)
for (const endpoint of ['pdf', 'label-pdf', 'pickup-pdf']) await api(`/orders/${order.id}/${endpoint}`, 'GET', null, techLogin.token, 403)
for (const endpoint of ['print', 'label']) await api(`/orders/${order.id}/${endpoint}`, 'POST', {}, techLogin.token, 403)

const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] })
const context = await browser.createBrowserContext()
const techContext = await browser.createBrowserContext()
const adminPage = await context.newPage(), page = await techContext.newPage()
for (const target of [adminPage, page]) { target.setDefaultTimeout(20000); target.setDefaultNavigationTimeout(60000) }
const alerts = [], errors = []
for (const target of [adminPage, page]) {
  target.on('dialog', dialog => { alerts.push(dialog.type()); dialog.dismiss() })
  target.on('pageerror', error => errors.push(error.message))
}
const click = async (target, text, root = 'body') => {
  await target.waitForFunction((text, root) => [...document.querySelectorAll(`${root} button`)].some(el => el.getClientRects().length && !el.disabled && el.textContent.trim() === text), {}, text, root)
  const el = await target.evaluateHandle((text, root) => [...document.querySelectorAll(`${root} button`)].find(el => el.getClientRects().length && !el.disabled && el.textContent.trim() === text), text, root)
  await el.asElement().click(); await el.dispose()
}
const enter = async (target, profileId, value) => {
  await target.goto(`${ui}/login`, { waitUntil: 'domcontentloaded' })
  await target.evaluate((profileId) => localStorage.setItem('service_last_profile_v1', profileId), profileId)
  // Iniciar con el perfil conocido evita depender del orden de los nombres.
  const result = await api('/auth/login', 'POST', { profileId, password: value })
  const sessionKey = (await import('../../src/utils/storage.js')).SESSION_KEY
  await target.evaluate((key, session) => localStorage.setItem(key, JSON.stringify(session)), sessionKey, { token: result.token, user: result.user })
  await target.goto(`${ui}/${result.user.role === 'tecnico' ? 'taller' : 'usuarios'}`, { waitUntil: 'domcontentloaded' })
  await target.waitForSelector('.sc-sidebar')
}
let releaseBootstrap
try {
  await adminPage.setViewport({ width: 1366, height: 768 })
  await page.setViewport({ width: 1366, height: 768 })
  await enter(adminPage, login.user.id, 'Browser-updated-2026')
  await adminPage.click('[aria-label="Cambiar de perfil"]'); await adminPage.waitForSelector('[role=menu][aria-label=Perfiles]'); await adminPage.keyboard.press('Escape')
  const blocked = new Promise(resolve => { releaseBootstrap = resolve })
  let hold = false, creations = 0
  await adminPage.setRequestInterception(true)
  adminPage.on('request', async request => {
    if (request.method() === 'POST' && request.url().endsWith('/api/users')) creations++
    if (hold && request.url().endsWith('/api/bootstrap')) await blocked
    await request.continue()
  })
  await click(adminPage, 'Nuevo usuario'); await adminPage.waitForSelector('[role=dialog] input[type=text]')
  const name = `Perfil inmediato ${suffix}`
  await adminPage.type('[role=dialog] input[type=text]', name); await adminPage.type('[role=dialog] input[type=password]', password); await adminPage.select('[role=dialog] select', 'tecnico')
  hold = true
  const start = performance.now()
  await adminPage.$eval('[role=dialog] form', form => { form.requestSubmit(); form.requestSubmit() })
  await adminPage.waitForSelector('[role=dialog]', { hidden: true, timeout: 5000 })
  const creationMs = Math.round(performance.now() - start)
  assert.equal(creations, 1)
  assert.ok((await adminPage.$eval('table', el => el.textContent)).toLowerCase().includes(name.toLowerCase()))
  await adminPage.click('[aria-label="Cambiar de perfil"]')
  await adminPage.waitForFunction(name => [...document.querySelectorAll('[role=menu][aria-label=Perfiles] button')].some(el => el.textContent.toLowerCase().includes(name.toLowerCase())), {}, name)
  hold = false; releaseBootstrap(); await adminPage.keyboard.press('Escape')
  console.log(`✓ Usuario creado y disponible sin esperar bootstrap (${creationMs} ms; doble envío bloqueado).`)

  await enter(page, tech.id, password); await page.waitForSelector('#queue-mine'); await page.click('#queue-mine'); await page.waitForSelector(`[data-order-id="${order.id}"]`); await page.click(`[data-order-id="${order.id}"]`); await page.waitForSelector('.ws-sheet')
  assert.equal(await page.$('.ws-tools [aria-haspopup=menu]'), null, 'El técnico no tiene menú Acciones')
  assert.equal(await page.$eval('.ws-sheet', el => /Imprimir/.test(el.textContent)), false)
  await click(page, 'Registrar diagnóstico', '.ws-footer'); await page.waitForSelector('.ws-work-editor textarea')
  await page.type('.ws-work-editor textarea', 'Revisar conector y cambiar pin de carga')
  assert.equal(await page.$eval('.ws-footer .primary', el => el.textContent), 'Registrar diagnóstico')
  await page.keyboard.press('Escape'); await click(page, 'Registrar diagnóstico', '.ws-footer')
  assert.equal(await page.$eval('.ws-work-editor textarea', el => el.value), 'Revisar conector y cambiar pin de carga')
  await click(page, 'Guardar', '.ws-work-editor'); await page.waitForSelector('.ws-work-editor', { hidden: true }); await page.waitForFunction(() => document.querySelector('.ws-footer .primary')?.textContent === 'Enviar a recepción')

  await page.$eval('.ws-tools > button', el => el.click()); await page.waitForSelector('[role=dialog] textarea[placeholder]')
  await page.type('[role=dialog] textarea[placeholder]', 'Nota conservada\nSegunda línea')
  await page.keyboard.press('Escape'); await page.$eval('.ws-tools > button', el => el.click())
  assert.equal(await page.$eval('[role=dialog] textarea[placeholder]', el => el.value), 'Nota conservada\nSegunda línea')
  let failNote = true, notePosts = 0
  await page.setRequestInterception(true)
  page.on('request', request => {
    if (request.method() === 'PUT' && request.url().endsWith(`/api/orders/${order.id}`) && Object.hasOwn(JSON.parse(request.postData() || '{}'), 'note')) {
      notePosts++
      if (failNote) return request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Guardado de prueba no disponible' }) })
    }
    return request.continue()
  })
  await click(page, 'Guardar nota', '[role=dialog]'); await page.waitForFunction(() => document.querySelector('[data-notification=error]')?.textContent.includes('Guardado de prueba'))
  assert.equal(await page.$eval('[role=dialog] textarea[placeholder]', el => el.value), 'Nota conservada\nSegunda línea')
  failNote = false
  await page.$eval('.sc-note-compose', form => { form.requestSubmit(); form.requestSubmit() })
  await page.waitForFunction(() => document.querySelector('.sc-note-text')?.textContent.includes('Nota conservada'))
  await page.waitForFunction(() => document.querySelector('.sc-notes')?.getAttribute('aria-busy') === 'false')
  assert.equal(notePosts, 2, 'Un fallo y un reintento, sin duplicar la nota')
  await page.click('[aria-label="Editar nota"]'); await page.focus('.sc-note-history textarea'); await page.keyboard.down('Control'); await page.keyboard.press('End'); await page.keyboard.up('Control'); await page.type('.sc-note-history textarea', ' editada'); await click(page, 'Guardar', '.sc-note-history'); await page.waitForFunction(() => document.querySelector('.sc-note-text')?.textContent.endsWith(' editada'))
  for (const dark of [false, true]) for (const width of [1366, 1024, 390]) {
    await page.setViewport({ width, height: width === 390 ? 844 : 768 }); await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), dark)
    assert.equal(await page.$eval('[role=dialog]', el => el.scrollWidth > el.clientWidth + 2), false)
  }
  fs.mkdirSync('test-results/integracion-ui', { recursive: true }); await page.screenshot({ path: path.resolve('test-results/integracion-ui/notas-tecnico-oscuro-390.png'), fullPage: true })
  await page.setViewport({ width: 1366, height: 768 }); await page.waitForFunction(() => document.querySelector('.sc-notes')?.getAttribute('aria-busy') === 'false')
  await page.type('[role=dialog] textarea[placeholder]', 'Borrador para conservar al volver')
  await page.keyboard.press('Escape'); await page.click('[aria-label="Salir"]')
  await page.waitForFunction(() => document.querySelector('[role=dialog]')?.textContent.includes('Borradores sin guardar'))
  await click(page, 'Volver', '[role=dialog]'); await page.waitForSelector('[role=dialog]', { hidden: true })
  await page.$eval('.ws-tools > button', el => el.click()); await page.waitForSelector('[role=dialog] textarea[placeholder]')
  assert.equal(await page.$eval('[role=dialog] textarea[placeholder]', el => el.value), 'Borrador para conservar al volver')
  await page.focus('[role=dialog] textarea[placeholder]'); await page.keyboard.down('Control'); await page.keyboard.press('A'); await page.keyboard.up('Control'); await page.keyboard.press('Backspace'); await page.keyboard.press('Escape')
  await click(page, 'Enviar a recepción', '.ws-footer'); await click(page, 'Confirmar', '[role=dialog]'); await page.waitForSelector('.ws-sheet', { hidden: true }); await page.waitForSelector(`[data-order-id="${order.id}"]`); await page.click(`[data-order-id="${order.id}"]`)
  await page.waitForFunction(() => document.querySelector('.ws-footer')?.textContent.includes('Pendiente de presupuesto'))
  await api(`/orders/${order.id}`, 'PUT', { price: 45000 }, counterLogin.token)
  await page.waitForFunction(() => document.querySelector('.ws-footer')?.textContent.includes('Presupuesto listo para avisar'))
  await api(`/orders/${order.id}/notified`, 'POST', { notified: true }, counterLogin.token); await page.waitForFunction(() => document.querySelector('.ws-footer')?.textContent.includes('Pendiente de aprobación'))
  await api(`/orders/${order.id}/confirm`, 'POST', { confirmed: true }, counterLogin.token); await page.waitForFunction(() => document.querySelector('.ws-footer .primary')?.textContent === 'Iniciar reparación')
  await click(page, 'Iniciar reparación', '.ws-footer'); await click(page, 'Confirmar', '[role=dialog]')
  await page.waitForFunction(() => document.querySelector('.ws-footer .primary')?.textContent === 'Finalizar reparación' && !document.querySelector('.ws-footer .primary').disabled)
  assert.ok(await page.$('.ws-sheet'), 'El técnico continúa con la ficha abierta')
  await click(page, 'Editar', '.ws-work'); await page.waitForSelector('.ws-work-editor textarea')
  await page.type('.ws-work-editor textarea', ', probar con otra batería')
  await click(page, 'Guardar', '.ws-work-editor'); await click(page, 'Confirmar', '[role=dialog]'); await page.waitForSelector('.ws-sheet', { hidden: true })
  assert.equal((await api(`/orders/${order.id}`)).order.status, 'presupuesto', 'Reabrir presupuesto cierra la ficha aunque vuelva al estado de la selección original')
  assert.deepEqual(alerts, []); assert.deepEqual(errors, [])
  fs.writeFileSync('test-results/technician-flow.json', JSON.stringify({ creationMs, blockedBootstrap: true, duplicateCreationBlocked: true, profileWithoutReload: true, printDenied: true, diagnosisModal: true, stableActionWhileEditing: true, drafts: true, notesEdit: true, failedNotePreserved: true, duplicateNoteBlocked: true, customDiscardConfirmation: true, themesAndWidths: true, realTimeQuote: true, nativeAlerts: alerts }, null, 2))
  console.log('✓ Técnico: impresión prohibida, diagnóstico en ventana, acción estable, notas y borradores, y presupuesto sincronizado entre sesiones. Ambos temas y tres tamaños.')
} catch (error) {
  fs.mkdirSync('test-results/integracion-ui', { recursive: true }); await page.screenshot({ path: path.resolve('test-results/integracion-ui/technician-failure.png'), fullPage: true }).catch(() => {})
  throw error
} finally { releaseBootstrap?.(); await browser.close() }
