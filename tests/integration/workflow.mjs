import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const base = process.env.VERIFY_URL || 'http://localhost:8181'
// Este archivo crea y restaura datos: solo admite el entorno descartable.
assert.match(base, /^http:\/\/(localhost|127\.0\.0\.1):8181$/)
let token
async function request(path, { method = 'GET', body, as = token, status = 200 } = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method, headers: { ...(as ? { Authorization: `Bearer ${as}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await response.json()
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(data)}`)
  return data
}
const post = (path, body, options = {}) => request(path, { method: 'POST', body, ...options })
const put = (path, body, options = {}) => request(path, { method: 'PUT', body, ...options })

test('flujo completo y recuperación en PostgreSQL real', async (t) => {
  const health = await request('/health', { as: null })
  assert.equal(health.verification, 'service-center-isolated-tests', 'Se requiere un servidor marcado como entorno de verificación aislado.')
  await request('/bootstrap', { as: null, status: 401 })
  const login = await post('/auth/login', { email: 'admin@local.com', password: 'admin123' })
  token = login.token
  assert.equal(login.user.mustChangePassword, true)
  assert.equal('password' in login.user, false)
  await request('/bootstrap', { status: 403 })
  const oldToken = token
  token = (await post('/auth/change-password', { currentPassword: 'admin123', newPassword: 'Verification-admin-2026' })).token
  await request('/bootstrap', { as: oldToken, status: 401 })
  await t.test('alta de varios usuarios sin email y permisos', async () => {
    const technician = await post('/users', { name: 'Técnico Pruebas', password: 'Verification-tech-2026', role: 'tecnico' })
    const reception = await post('/users', { name: 'Recepción Pruebas', password: 'Verification-counter-2026', role: 'recepcion' })
    t.technician = technician.id
    t.techToken = (await post('/auth/login', { profileId: technician.id, password: 'Verification-tech-2026' })).token
    t.counterToken = (await post('/auth/login', { profileId: reception.id, password: 'Verification-counter-2026' })).token
    await request('/backups', { as: t.techToken, status: 403 })
    await post('/users', { name: 'Intruso', password: 'Verification-123', role: 'admin' }, { as: t.counterToken, status: 403 })
  })
  const customer = await post('/customers', { fullName: 'Cliente Verificación', dni: '30123456', phone: '3704000000' })
  const create = async (fields = {}) => (await post('/orders', {
    customerId: customer.id, deviceType: 'Celular', brand: 'Samsung', model: 'Galaxy A15',
    issue: 'No enciende', ...fields,
  })).order
  const state = async (order, status, extras = {}, options = {}) => (await post(`/orders/${order.id}/status`, { status, ...extras }, options)).order
  let visible
  await t.test('reintentos concurrentes crean una sola orden', async () => {
    const fields = { requestId: 'verification-retry-0001', price: 1500 }
    const before = (await request('/orders')).total
    const results = await Promise.all([create(fields), create(fields), create(fields)])
    assert.equal(new Set(results.map((order) => order.id)).size, 1)
    assert.equal((await request('/orders')).total, before + 1)
    await post('/orders', { customerId: customer.id, deviceType: 'Celular', brand: 'Samsung', model: 'Galaxy A15', issue: 'No enciende', ...fields, price: 2000 }, { status: 409 })
  })
  await t.test('recepción, reparación, entrega y garantía', async () => {
    visible = await create({ fix: 'Cambio de batería', price: 30000, advance: 5000 })
    await state(visible, 'en_reparacion', {}, { status: 400 })
    visible = await state(visible, 'en_reparacion', { assignedTo: t.technician })
    await put(`/orders/${visible.id}`, { fix: 'Cambio de batería, Limpieza', note: 'Revisado' }, { as: t.techToken })
    visible = await state(visible, 'falta_repuestos', {}, { as: t.techToken })
    await put(`/orders/${visible.id}`, { addSparePart: { name: 'Batería', quantity: 1 } }, { as: t.techToken })
    visible = await state(visible, 'en_reparacion', {}, { as: t.techToken })
    visible = await state(visible, 'terminado', {}, { as: t.techToken })
    await state(visible, 'entregado', {}, { status: 400 })
    await post(`/orders/${visible.id}/notified`, { notified: true }, { as: t.counterToken })
    visible = await state(visible, 'entregado', { pickup: { pickupBy: 'third', pickupName: 'Persona Autorizada', pickupDni: '32123456' } }, { as: t.counterToken })
    assert.equal(visible.pickupName, 'Persona Autorizada')
    assert.ok(visible.deliveredAt)
    const firstDelivery = visible.deliveredAt
    visible = await state(visible, 'recibido', {}, { as: t.counterToken })
    assert.equal(visible.deliveredAt, null)
    assert.equal(visible.pickupBy, '')
    assert.equal(visible.notified, false)
    assert.equal(visible.warrantyReturn, true)
    visible = await state(visible, 'en_reparacion', {}, { as: t.techToken })
    visible = await state(visible, 'terminado', {}, { as: t.techToken })
    visible = await state(visible, 'entregado', { retiro: true, pickup: { pickupBy: 'client' } })
    assert.notEqual(visible.deliveredAt, firstDelivery)
    assert.equal(JSON.stringify(visible).includes('"password"'), false)
  })
  await t.test('revisión, presupuesto y aprobación', async () => {
    let order = await create({ diagnosisType: 'revision' })
    order = await state(order, 'en_revision', { assignedTo: t.technician })
    await put(`/orders/${order.id}`, { fix: 'Pin de carga' }, { as: t.techToken })
    order = await state(order, 'presupuesto', {}, { as: t.techToken })
    await state(order, 'en_reparacion', {}, { status: 400 })
    await put(`/orders/${order.id}`, { price: 20000 }, { as: t.counterToken })
    await post(`/orders/${order.id}/notified`, { notified: true })
    await post(`/orders/${order.id}/confirm`, { confirmed: true })
    await put(`/orders/${order.id}`, { price: 25000 })
    assert.equal((await request(`/orders/${order.id}`)).order.confirmed, false)
    await post(`/orders/${order.id}/notified`, { notified: true })
    await post(`/orders/${order.id}/confirm`, { confirmed: true })
    order = await state(order, 'en_reparacion', {}, { as: t.techToken })
    assert.equal(order.status, 'en_reparacion')
  })
  await t.test('servicio simple y derivación externa', async () => {
    let simple = await create({ isSimpleService: true, fix: 'Limpieza', price: 1000 })
    simple = await state(simple, 'terminado', {}, { as: t.counterToken })
    assert.equal(simple.status, 'terminado')
    let external = await create()
    external = await state(external, 'en_tercero', { externalTech: 'Laboratorio Externo' })
    external = await state(external, 'recibido')
    assert.ok(external.externalReturnAt)
    assert.equal(external.isExternal, false)
    let returned = await create()
    returned = await state(returned, 'en_tercero', { externalTech: 'Laboratorio Externo' }, { as: t.counterToken })
    returned = await state(returned, 'terminado', {}, { as: t.counterToken })
    assert.equal(returned.status, 'terminado')
    assert.equal(returned.isExternal, false)
    assert.equal(returned.repairedBy, null)
    await post(`/orders/${external.id}/pickup`, { pickupBy: 'client' }, { as: t.techToken, status: 403 })
  })
  await t.test('concurrencia, filtros y comprobantes PDF', async () => {
    const orders = await Promise.all(Array.from({ length: 5 }, () => create({ fix: 'Limpieza' })))
    assert.equal(new Set(orders.map((o) => o.orderNumber)).size, 5)
    const filtered = await request('/orders?status=terminado&onlyNotNotified=1')
    assert.ok(filtered.orders.every((o) => o.status === 'terminado'))
    for (const endpoint of ['pdf', 'pickup-pdf']) {
      const response = await fetch(`${base}/api/orders/${visible.id}/${endpoint}`, { headers: { Authorization: `Bearer ${token}` } })
      assert.equal(response.status, 200)
      assert.match(response.headers.get('content-type'), /application\/pdf/)
      const bytes = Buffer.from(await response.arrayBuffer())
      assert.equal(bytes.subarray(0, 4).toString(), '%PDF')
      fs.mkdirSync('test-results', { recursive: true })
      fs.writeFileSync(`test-results/${endpoint}.pdf`, bytes)
    }
  })
  await t.test('historial del cliente incluye entregados y separa clientes', async () => {
    const own = await request(`/orders?customerId=${customer.id}`)
    assert.ok(own.orders.some((order) => order.id === visible.id && order.status === 'entregado'))
    assert.ok(own.orders.every((order) => order.customerId === customer.id))
    const other = await post('/customers', { fullName: 'Otro Cliente', dni: '30123457' })
    assert.equal((await request(`/orders?customerId=${other.id}`)).total, 0)
    for (const endpoint of ['/actividad', '/audit']) {
      const result = await request(endpoint)
      assert.equal(JSON.stringify(result).includes('"password"'), false, `Hash expuesto en ${endpoint}`)
    }
  })
  await t.test('papelera recupera bajas sin reactivar órdenes eliminadas antes', async () => {
    const client = await post('/customers', { fullName: 'Cliente Papelera', dni: '30123458' })
    const older = await create({ customerId: client.id })
    const current = await create({ customerId: client.id })
    await request(`/orders/${older.id}`, { method: 'DELETE' })
    await request(`/customers/${client.id}`, { method: 'DELETE' })
    await request('/trash', { as: t.techToken, status: 403 })
    const trash = await request('/trash')
    assert.ok(trash.customers.some((item) => item.id === client.id))
    assert.ok(trash.orders.some((item) => item.id === current.id))
    await post(`/trash/customers/${client.id}/restore`)
    await request(`/orders/${older.id}`, { status: 404 })
    await request(`/orders/${current.id}`)
    await post(`/trash/orders/${older.id}/restore`)
    assert.equal((await request(`/orders?customerId=${client.id}`)).total, 2)
  })
  await t.test('respaldo cifrado, restauración real y continuidad', async () => {
    const before = (await request('/orders')).total
    const backup = await post('/backups')
    assert.equal(backup.status.exportConfigured, true)
    assert.equal(backup.status.exportError, null)
    assert.ok(backup.status.exportLastSuccessAt)
    const download = await fetch(`${base}/api/backups/${backup.name}/download`, { headers: { Authorization: `Bearer ${token}` } })
    const bytes = Buffer.from(await download.arrayBuffer())
    assert.equal(bytes.subarray(0, 9).toString(), 'SCBACKUP1')
    assert.equal(bytes.includes(Buffer.from('Cliente Verificación')), false)
    await create()
    assert.equal((await request('/orders')).total, before + 1)
    await post(`/backups/${backup.name}/restore`)
    assert.equal((await request('/orders')).total, before)
    await request('/health')
  })
  await t.test('listas editables deduplicadas y cambios inválidos conservan el catálogo', async () => {
    await put('/catalog/lists', { accessories: ['Funda', ' funda ', 'Cargador'] }, { as: t.techToken, status: 403 })
    await put('/catalog/lists', { accessories: ['Funda', ' funda ', 'Cargador'] })
    const saved = await request('/catalog/lists')
    assert.deepEqual([...saved.accessories].sort(), ['Cargador', 'Funda'])
    await put('/catalog/lists', { accessories: ['Otro'], terms: ['x'.repeat(1601)] }, { status: 400 })
    assert.deepEqual((await request('/catalog/lists')).accessories, saved.accessories)
  })
})
