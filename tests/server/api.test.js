import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import bcrypt from '../../server/node_modules/bcryptjs/index.js'

const { db } = vi.hoisted(() => ({ db: {
  user: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
  customer: { findUnique: vi.fn() },
  order: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  catalogFix: { upsert: vi.fn() }, auditLog: { create: vi.fn() },
  $transaction: vi.fn(), $queryRaw: vi.fn(),
} }))
vi.mock('../../server/db.js', () => ({ prisma: db, onDataChange: vi.fn(), notifyChange: vi.fn() }))

let server, base, token, user
const password = 'Test-password-2026'
const hash = bcrypt.hashSync(password, 4)
async function request(path, { method = 'GET', body, auth = token } = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method, headers: { ...(auth ? { Authorization: `Bearer ${auth}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  return { status: response.status, body: await response.json(), headers: response.headers }
}
const post = (path, body) => request(path, { method: 'POST', body })
const put = (path, body) => request(path, { method: 'PUT', body })
const order = (fields = {}) => ({
  id: 'order-1', orderNumber: 'OS0001', status: 'recibido', customer: { fullName: 'Cliente' },
  customerId: 'customer-1', history: [], notes: [], spareParts: [], deletedAt: null,
  diagnosisType: 'visible', assignedTo: null, fix: 'Limpieza', ...fields,
})

beforeAll(async () => {
  const { app } = await import('../../server/index.js')
  server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}`
}, 30000)
afterAll(async () => { if (server) await new Promise((resolve) => server.close(resolve)) })
beforeEach(async () => {
  vi.resetAllMocks()
  user = { id: 'admin', name: 'Admin', email: 'admin@test.local', role: 'admin', active: true, password: hash }
  db.user.findUnique.mockImplementation(async () => user)
  db.user.findFirst.mockImplementation(async () => user)
  db.user.update.mockImplementation(async ({ data }) => { Object.assign(user, data); return user })
  db.$transaction.mockImplementation((fn) => fn(db))
  db.order.updateMany.mockResolvedValue({ count: 1 })
  db.order.update.mockResolvedValue(order())
  db.order.findUnique.mockResolvedValue(order())
  token = (await post('/auth/login', { email: user.email, password })).body.token
})

describe('API HTTP: contratos y seguridad (persistencia simulada)', () => {
  it('bloquea el acceso sin sesión y no filtra hashes', async () => {
    const result = await request('/orders/order-1', { auth: null })
    expect(result.status).toBe(401)
    const login = await post('/auth/login', { email: user.email, password })
    expect(login.body.user).not.toHaveProperty('password')
  })
  it('exige cambiar la contraseña inicial también desde la API', async () => {
    user.password = bcrypt.hashSync('admin123', 4)
    token = (await post('/auth/login', { email: user.email, password: 'admin123' })).body.token
    expect((await request('/orders/order-1')).status).toBe(403)
    const changed = await post('/auth/change-password', { currentPassword: 'admin123', newPassword: password })
    expect(changed.status).toBe(200)
    expect(changed.body.token).toBeTypeOf('string')
    expect((await request('/orders/order-1')).status).toBe(401)
    token = changed.body.token
    expect((await request('/orders/order-1')).status).toBe(200)
  })
  it('permite crear varios usuarios sin email', async () => {
    const fields = { name: 'Recepción', password, role: 'recepcion' }
    expect((await post('/users', fields)).status).toBe(200)
    expect((await post('/users', fields)).status).toBe(200)
    expect(db.user.create.mock.calls.map(([args]) => args.data.email)).toEqual([null, null])
  })
  it('los técnicos no pueden administrar usuarios o registrar retiros', async () => {
    user.role = 'tecnico'
    expect((await post('/users', { name: 'Otro', password, role: 'admin' })).status).toBe(403)
    expect((await post('/orders/order-1/pickup', { pickupBy: 'client' })).status).toBe(403)
  })
  it('editar un arreglo utiliza el cliente de catálogo correcto', async () => {
    const result = await put('/orders/order-1', { fix: 'Cambio de batería' })
    expect(result.status).toBe(200)
    expect(db.catalogFix.upsert).toHaveBeenCalledWith(expect.objectContaining({ where: { name: 'Cambio de batería' } }))
  })
  it('cambiar un presupuesto exige volver a avisar y aprobar', async () => {
    db.order.findUnique.mockResolvedValue(order({ status: 'presupuesto', price: 1000, confirmed: true, notified: true }))
    expect((await put('/orders/order-1', { price: 2000 })).status).toBe(200)
    expect(db.order.update).toHaveBeenLastCalledWith(expect.objectContaining({ data: expect.objectContaining({ confirmed: false, notified: false }) }))
  })
  it('guarda juntas altas y ediciones de notas y repuestos', async () => {
    db.order.findUnique.mockResolvedValue(order({
      notes: [{ id: 'note-1', by: 'admin', text: 'Anterior' }], spareParts: [{ id: 'part-1', by: 'admin', name: 'Batería' }],
    }))
    const result = await put('/orders/order-1', {
      note: 'Nueva nota', editNote: { id: 'note-1', text: 'Corregida' },
      addSparePart: { name: 'Pantalla', quantity: 1 }, editSparePart: { id: 'part-1', status: 'pedido' },
    })
    expect(result.status).toBe(200)
    expect(db.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      notes: expect.objectContaining({ create: expect.any(Array), update: expect.any(Array) }),
      spareParts: expect.objectContaining({ create: expect.any(Array), update: expect.any(Array) }),
    }) }))
  })
  it('entrega y datos de retiro se guardan en la misma transacción', async () => {
    db.order.findUnique.mockResolvedValue(order({ status: 'terminado', notified: true }))
    const pickup = { pickupBy: 'third', pickupName: 'Persona Autorizada', pickupDni: '30123456' }
    expect((await post('/orders/order-1/status', { status: 'entregado', pickup })).status).toBe(200)
    expect(db.$transaction).toHaveBeenCalled()
    expect(db.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      status: 'entregado', ...pickup, deliveredAt: expect.any(Date),
    }) }))
  })
  it('un retiro inválido no modifica la orden', async () => {
    db.order.findUnique.mockResolvedValue(order({ status: 'terminado', notified: true }))
    const result = await post('/orders/order-1/status', { status: 'entregado', pickup: { pickupBy: 'third', pickupName: 'Persona', pickupDni: 'abc' } })
    expect(result.status).toBe(400)
    expect(db.order.update).not.toHaveBeenCalled()
  })
  it('reingresar por garantía limpia la entrega y aprobación anteriores', async () => {
    db.order.findUnique.mockResolvedValue(order({ status: 'entregado' }))
    expect((await post('/orders/order-1/status', { status: 'recibido' })).status).toBe(200)
    expect(db.order.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({
      warrantyReturn: true, deliveredAt: null, deliveredBy: null, pickupBy: '', notified: false, confirmed: false,
    }) }))
  })
  it('detecta transiciones concurrentes y devuelve un conflicto', async () => {
    db.order.updateMany.mockResolvedValue({ count: 0 })
    const result = await post('/orders/order-1/status', { status: 'entregado', retiro: true })
    expect(result.status).toBe(409)
    expect(db.order.update).not.toHaveBeenCalled()
  })
  it('filtrar terminados sin avisar no incluye presupuestos', async () => {
    db.order.count.mockResolvedValue(0)
    db.order.findMany.mockResolvedValue([])
    expect((await request('/orders?status=terminado&onlyNotNotified=1')).status).toBe(200)
    expect(db.order.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'terminado', notified: false }), take: 50 }))
  })
  it('valida fechas e importes antes de escribir', async () => {
    expect((await request('/orders?to=no-es-fecha')).status).toBe(400)
    expect((await put('/orders/order-1', { price: -100 })).status).toBe(400)
    expect(db.order.update).not.toHaveBeenCalled()
  })
  it('rechazos async producen JSON y no dejan peticiones colgadas', async () => {
    db.order.findUnique.mockRejectedValue(new Error('database offline'))
    const result = await request('/orders/order-1')
    expect(result.status).toBe(500)
    expect(result.body).toEqual({ error: 'Error interno del servidor.' })
  })
})
