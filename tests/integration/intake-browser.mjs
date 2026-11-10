import assert from 'node:assert/strict'
import fs from 'node:fs'
import puppeteer from '../../server/node_modules/puppeteer/lib/puppeteer/puppeteer.js'

const base = process.env.VERIFY_URL || 'http://127.0.0.1:8181', ui = process.env.UI_URL || base
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):818[123]$/)
assert.match(ui, /^http:\/\/(localhost|127\.0\.0\.1):(818[123]|517[67])$/)
for (const url of new Set([base, ui])) assert.equal((await fetch(`${url}/api/health`).then(r => r.json())).verification, 'service-center-isolated-tests')
const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@local.com', password: 'Browser-updated-2026' }) }).then(r => r.json())
assert.ok(login.token)
async function api(route, method = 'GET', body) {
  const response = await fetch(`${base}/api${route}`, { method, headers: { Authorization: `Bearer ${login.token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const result = await response.json(); assert.ok(response.ok, `${route}: ${JSON.stringify(result)}`); return result
}
const dni = Date.now().toString().slice(-8)
const customer = await api('/customers', 'POST', { fullName: 'Cliente búsqueda ingreso', dni, address: 'Calle Prueba 123', phone: '1100000101', phone2: '1100000102', phone3: '1100000103' })
const initial = await api('/bootstrap')
const profilesBefore = (await api('/auth/profiles')).profiles.length
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage(); page.setDefaultTimeout(25000)
const errors = []; page.on('pageerror', error => errors.push(error.message))
let order, releaseCatalog
async function click(label) {
  await page.waitForFunction(text => [...document.querySelectorAll('[role=dialog]')].at(-1)?.querySelectorAll('button') && [...[...document.querySelectorAll('[role=dialog]')].at(-1).querySelectorAll('button')].some(button => button.textContent.trim() === text && !button.disabled), {}, label)
  const button = await page.evaluateHandle(text => [...[...document.querySelectorAll('[role=dialog]')].at(-1).querySelectorAll('button')].find(button => button.textContent.trim() === text), label)
  await button.asElement().focus(); await page.keyboard.press('Enter'); await button.dispose()
}
async function fill(selector, text) { await page.focus(selector); await page.keyboard.down('Control'); await page.keyboard.press('a'); await page.keyboard.up('Control'); await page.type(selector, text) }
try {
  await page.evaluateOnNewDocument(session => localStorage.setItem('service_session_v1', JSON.stringify(session)), login)
  await page.setViewport({ width: 1366, height: 768 })
  await page.goto(`${ui}/recepcion`)
  await page.waitForSelector('button.ws-button.primary')
  await page.$eval('button.ws-button.primary', button => button.click())
  await page.waitForSelector('input[placeholder="DNI"]')
  assert.equal(await page.$('input[placeholder^="Buscar cliente existente"]'), null)
  await click('Guardar')
  await page.waitForFunction(() => document.querySelector('[data-notification=error]')?.textContent.includes('nombre'))
  await click('Buscar cliente')
  await page.waitForFunction(() => document.querySelectorAll('[role=dialog]').length === 2)
  await fill('input[placeholder="Buscar cliente"]', 'inexistentezzzz')
  assert.equal(await page.$eval('[role=dialog]:last-of-type', dialog => [...dialog.querySelectorAll('button')].filter(button => button.textContent.includes('DNI')).length), 0)
  await fill('input[placeholder="Buscar cliente"]', '1100000103')
  await page.waitForFunction(() => [...document.querySelectorAll('[role=dialog]')].at(-1).textContent.includes('Cliente Búsqueda Ingreso'))
  await page.evaluate(() => [...[...document.querySelectorAll('[role=dialog]')].at(-1).querySelectorAll('button')].find(button => button.textContent.includes('Cliente Búsqueda Ingreso')).click())
  await page.waitForFunction(() => document.querySelectorAll('[role=dialog]').length === 1)
  assert.equal(await page.$eval('input[placeholder="Teléfono 3"]', input => input.value), '1100000103')
  await click('Nuevo cliente')
  await click('Agregar teléfono'); await fill('input[placeholder="Teléfono 2"]', '1100000002')
  await click('Agregar teléfono'); await fill('input[placeholder="Teléfono 3"]', '1100000003')
  assert.equal(await page.$$eval('button', buttons => buttons.filter(button => button.textContent.trim() === 'Agregar teléfono').length), 0)
  await fill('input[placeholder="DNI"]', dni)
  await page.keyboard.press('Tab')
  await page.waitForFunction(() => document.querySelector('input[placeholder="Nombre completo *"]').value === 'Cliente Búsqueda Ingreso')
  assert.equal(await page.$eval('input[placeholder="Domicilio"]', input => input.value), 'Calle Prueba 123')
  assert.equal(await page.$eval('input[placeholder="Teléfono 2"]', input => input.value), '1100000102')
  console.log('✓ Botón de búsqueda, teléfonos adicionales y cliente recuperado por DNI sin duplicarlo.')
  // Hold the type-specific response: fallback and stale responses must never expose another device's models.
  const catalogGate = new Promise(resolve => { releaseCatalog = resolve })
  await page.setRequestInterception(true)
  page.on('request', async request => {
    if (request.url().includes('/api/catalog?deviceType=Tablet')) await catalogGate
    if (!request.isInterceptResolutionHandled()) await request.continue().catch(() => {})
  })
  await page.$eval('button[title=Celular]', button => button.click()); await click('Samsung')
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(button => button.textContent.trim() === 'Galaxy A15'))
  await page.$eval('button[title=Tablet]', button => button.click()); await click('Samsung')
  const choices = await page.evaluate(() => [...document.querySelectorAll('label')].find(label => label.textContent === 'Modelo *').parentElement.textContent)
  assert.ok(!choices.includes('Galaxy A15') && !choices.includes('Galaxy Book'))
  assert.ok(choices.includes('Galaxy Tab'), choices)
  const tabletResponse = page.waitForResponse(response => response.url().includes('/api/catalog?deviceType=Tablet'))
  releaseCatalog()
  await tabletResponse
  await click('Otro')
  const models = await page.evaluate(() => [...[...document.querySelectorAll('[role=dialog]')].at(-1).querySelectorAll('button')].map(button => button.textContent.trim()))
  assert.ok(models.some(model => model.startsWith('Galaxy Tab')))
  assert.ok(!models.some(model => model.startsWith('Galaxy A') || model.startsWith('Galaxy Book')))
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelectorAll('[role=dialog]').length === 1)
  await page.$eval('button[title=Celular]', button => button.click()); await click('Samsung'); await click('Galaxy A15')
  await click('Revisión'); await click('Sin observaciones'); await click('Sin accesorios')
  await fill('textarea[placeholder="Chequeos y notas generales..."]', 'No carga. Revisar el conector.')
  await click('Guardar')
  await page.waitForFunction(() => [...document.querySelectorAll('[data-notification=error]')].some(node => node.textContent.includes('contraseña')))
  await page.evaluate(() => [...document.querySelectorAll('label')].find(label => label.textContent.includes('El cliente no dejó contraseña')).querySelector('input').click())
  await page.evaluate(() => [...document.querySelectorAll('label')].find(label => label.textContent.includes('Sin medio de comunicación')).querySelector('input').click())
  await fill('input[placeholder="Teléfono"]', '')
  // Explicitly editing the existing client must preserve the second and third phones.
  for (const theme of ['light', 'dark']) for (const width of [1366, 1024, 390]) {
    await page.setViewport({ width, height: width === 390 ? 844 : 768 })
    await page.evaluate(dark => document.documentElement.classList.toggle('dark', dark), theme === 'dark')
    assert.ok(await page.evaluate(() => [...document.querySelectorAll('[role=dialog]')].every(dialog => { const rect = dialog.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth + 1 && rect.height <= innerHeight + 1 && dialog.scrollWidth <= dialog.clientWidth + 1 })), `Formulario sin desbordes ${width} ${theme}`)
    fs.mkdirSync('test-results/integracion-ui', { recursive: true })
    if (width === 390) await page.screenshot({ path: `test-results/integracion-ui/ingreso-${theme}-390.png` })
  }
  await page.setViewport({ width: 1366, height: 768 })
  let submissions = 0; page.on('request', request => { if (request.method() === 'POST' && request.url().endsWith('/api/orders')) submissions++ })
  const saved = page.waitForResponse(response => response.url().endsWith('/api/orders') && response.request().method() === 'POST')
  await click('Guardar')
  const result = await (await saved).json(); assert.ok(result.order, JSON.stringify(result)); order = result.order
  assert.equal(order.customerId, customer.id)
  assert.equal(order.noContact, true); assert.equal(order.noPin, true); assert.equal(order.fix, ''); assert.equal(order.price, 0)
  const after = await api('/bootstrap')
  assert.equal(after.customers.length, initial.customers.length)
  assert.equal(after.customers.find(client => client.id === customer.id).phone2, '1100000102')
  assert.equal(after.customers.find(client => client.id === customer.id).phone3, '1100000103')
  assert.equal(submissions, 1)
  console.log('✓ Ingreso obligatorio con alternativas explícitas, sin teléfono, sin diagnóstico inventado; modelo y datos guardados.')
  const counter = initial.users.find(user => user.active && user.role === 'recepcion' && /^Recepción (pruebas$|flujo )/i.test(user.name))
  assert.ok(counter, 'Falta el perfil de recepción de pruebas')
  const password = /^Recepción flujo /i.test(counter.name) ? 'Technician-flow-2026' : 'Verification-counter-2026'
  const counterSession = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profileId: counter.id, password }) }).then(r => r.json())
  assert.ok(counterSession.token)
  const counterPage = await browser.newPage()
  await counterPage.evaluateOnNewDocument(session => localStorage.setItem('service_session_v1', JSON.stringify(session)), counterSession)
  await counterPage.goto(`${ui}/taller`)
  await counterPage.waitForSelector('[role=tablist]')
  const tabs = await counterPage.$$eval('[role=tab]', nodes => nodes.map(node => node.textContent))
  assert.ok(!tabs.some(text => text.includes('Mis equipos')))
  assert.ok(tabs.some(text => text.includes('Todos')))
  assert.equal(profilesBefore, (await api('/auth/profiles')).profiles.length)
  assert.deepEqual(errors, [])
  console.log('✓ Recepción consulta Todos y Sin asignar; ambos temas y tres anchos sin desbordes ni nuevos perfiles.')
} catch (error) {
  await page.screenshot({ path: 'test-results/integracion-ui/ingreso-fallo.png', fullPage: true }); throw error
} finally {
  releaseCatalog?.()
  await browser.close()
  if (order) await api(`/orders/${order.id}`, 'DELETE')
  await api(`/customers/${customer.id}`, 'DELETE')
}
