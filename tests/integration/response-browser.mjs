import assert from 'node:assert/strict'
import puppeteer from '../../server/node_modules/puppeteer/lib/puppeteer/puppeteer.js'
const base = process.env.VERIFY_URL || 'http://127.0.0.1:8181', ui = process.env.UI_URL || base
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):818[123]$/)
assert.match(ui, /^http:\/\/(localhost|127\.0\.0\.1):(818[123]|517[67])$/)
for (const url of new Set([base, ui])) assert.equal((await fetch(`${url}/api/health`).then(r => r.json())).verification, 'service-center-isolated-tests')
const login = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'admin@local.com', password: 'Browser-updated-2026' }) }).then(r => r.json())
assert.ok(login.token)
const api = async (route, method = 'GET', body) => {
  const response = await fetch(`${base}/api${route}`, { method, headers: { Authorization: `Bearer ${login.token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined })
  const data = await response.json(); assert.ok(response.ok, JSON.stringify(data)); return data
}
const data = await api('/bootstrap'), tech = data.technicians.find(u => u.active !== false), customer = data.customers[0]
assert.ok(tech && customer)
const created = []
const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage(); page.setDefaultTimeout(20000)
let hold = false, blocked = 0, fail = false, submissions = 0
const errors = []; page.on('pageerror', error => errors.push(error.message))
try {
  await page.goto(`${ui}/login`, { waitUntil: 'domcontentloaded' })
  await page.evaluate(session => localStorage.setItem('service_session_v1', JSON.stringify(session)), { token: login.token, user: login.user })
  await page.goto(`${ui}/recepcion`, { waitUntil: 'domcontentloaded' }); await page.waitForSelector('#queue-respuesta')
  await page.setRequestInterception(true)
  page.on('request', async request => {
    if (request.method() === 'POST' && /\/api\/orders\/[^/]+\/(confirm|status)$/.test(request.url())) {
      submissions++
      if (fail) return request.respond({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'No se guardó la respuesta de prueba' }) })
    }
    if (hold && /\/api\/(bootstrap|actividad)(?:\?|$)/.test(request.url())) { blocked++; await new Promise(resolve => setTimeout(resolve, 3000)) }
    await request.continue().catch(() => {})
  })
  const click = async (text, root = 'body') => {
    await page.waitForFunction((text, root) => [...document.querySelectorAll(`${root} button`)].some(n => n.getClientRects().length && !n.disabled && n.textContent.trim() === text), {}, text, root)
    const element = await page.evaluateHandle((text, root) => [...document.querySelectorAll(`${root} button`)].find(n => n.getClientRects().length && !n.disabled && n.textContent.trim() === text), text, root)
    await element.asElement().click(); await element.dispose()
  }
  for (const response of ['approve', 'reject']) {
    const order = (await api('/orders', 'POST', { customerId: customer.id, brand: 'Samsung', model: `Respuesta ${response}`, conditions: 'Sin observaciones', accessories: 'Sin accesorios', noPin: true, diagnosisType: 'revision', issue: 'Prueba de respuesta', deviceType: 'Celular' })).order
    created.push(order.id)
    await api(`/orders/${order.id}/status`, 'POST', { status: 'en_revision', assignedTo: tech.id })
    await api(`/orders/${order.id}`, 'PUT', { fix: 'Cambio de módulo' })
    await api(`/orders/${order.id}/status`, 'POST', { status: 'presupuesto' })
    await api(`/orders/${order.id}`, 'PUT', { price: 45000 })
    await api(`/orders/${order.id}/notified`, 'POST', { notified: true })
    await page.click('#queue-respuesta'); await page.waitForSelector(`[data-order-id="${order.id}"]`); await page.click(`[data-order-id="${order.id}"]`)
    await click('Registrar respuesta', '.ws-footer'); await page.waitForSelector('[role=dialog] select'); await page.select('[role=dialog] select', response)
    if (response === 'reject') {
      fail = true
      await page.$eval('[role=dialog] input[type=number]', input => { const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; setter.call(input, '3500'); input.dispatchEvent(new Event('input', { bubbles: true })) })
      await click('Guardar respuesta', '[role=dialog]')
      await page.waitForFunction(() => document.querySelector('[data-notification=error]')?.textContent.includes('No se guardó'))
      assert.equal(await page.$eval('[role=dialog] select', node => node.value), 'reject')
      assert.equal(await page.$eval('[role=dialog] input[type=number]', node => node.value), '3500')
      assert.equal((await api(`/orders/${order.id}`)).order.status, 'presupuesto')
      fail = false
    }
    const beforeSubmissions = submissions
    const beforeBlocked = blocked
    const synchronized = page.waitForResponse(result => result.url().endsWith('/api/bootstrap'), { timeout: 15000 })
    hold = true
    const start = performance.now()
    await page.$eval('[role=dialog] form', form => { form.requestSubmit(); form.requestSubmit() })
    await page.waitForSelector('[role=dialog]', { hidden: true }); await page.waitForSelector(`[data-order-id="${order.id}"]`, { hidden: true })
    const elapsed = Math.round(performance.now() - start)
    assert.ok(elapsed < 1500, `${response}: la UI esperó la recarga global (${elapsed}ms)`)
    assert.equal(submissions - beforeSubmissions, 1, 'Evitar doble guardado')
    await synchronized
    assert.ok(blocked > beforeBlocked)
    const saved = (await api(`/orders/${order.id}`)).order
    if (response === 'reject') assert.equal(saved.rejectedCharge, 3500)
    assert.ok(response === 'approve' ? saved.confirmed : saved.status === 'presupuesto_rechazado')
    console.log(`${response}: interfaz liberada en ${elapsed}ms; recarga artificial de 3000ms.`)
    hold = false
  }
  assert.ok(blocked >= 2)
  assert.deepEqual(errors, [])
  console.log('✓ Aprobación y rechazo sin esperar sincronización; error conserva valores y evita duplicados. Sin perfiles nuevos.')
} finally {
  hold = false; await browser.close()
  for (const id of created) await api(`/orders/${id}`, 'DELETE')
}
