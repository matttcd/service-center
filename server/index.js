// ============================================
// Servidor de la API REST del servicio técnico
// ============================================
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { initDB, getDB, mutate, persist, createBackup, listBackups, restoreBackup, purgeTrash } from './store.js'
import { buildSeed } from './seed.js'
import { todayISO, titleCase, uid } from './helpers.js'
import { renderTemplate, normalizePhone, sendWhatsApp } from './whatsapp.js'
import { printZplLabel } from './printer.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 8080
const JWT_SECRET = process.env.JWT_SECRET || 'service-local-secret-2026'

app.use(cors())
app.use(express.json())

// Inicializa la base de datos (seed la primera vez).
await initDB(buildSeed)

// ============================================
// Copias de seguridad automáticas
// ============================================
const BACKUP_HOUR = Number(process.env.BACKUP_HOUR ?? 3)
const PAPELERA_RETENTION_DAYS = Number(process.env.PAPELERA_RETENTION_DAYS ?? 30)

function scheduleBackups() {
  const run = () => {
    try {
      const name = createBackup()
      if (name) console.log(`Copia de seguridad creada: ${name}`)
    } catch (e) {
      console.error('No se pudo crear la copia de seguridad:', e)
    }
    try {
      const purged = purgeTrash(PAPELERA_RETENTION_DAYS)
      if (purged.customers || purged.orders) {
        persist().then(() =>
          console.log(`Papelera: purgados ${purged.customers} cliente(s) y ${purged.orders} orden(es).`),
        )
      }
    } catch (e) {
      console.error('No se pudo purgar la papelera:', e)
    }
  }
  const arm = () => {
    const now = new Date()
    const next = new Date(now)
    next.setHours(BACKUP_HOUR, 0, 0, 0)
    if (next <= now) next.setDate(next.getDate() + 1)
    setTimeout(() => {
      run()
      arm()
    }, next - now)
  }
  run()
  arm()
}
scheduleBackups()

// Devuelve un usuario sin datos sensibles.
const publicUser = (u) => ({
  id: u.id,
  name: u.name,
  email: u.email,
  role: u.role,
  active: u.active,
})

// Registra una entrada de auditoría.
const audit = (d, action, table, recordId, userId, details) => {
  d.auditLogs.unshift({
    id: uid(),
    userId,
    action,
    table,
    recordId,
    details,
    timestamp: new Date().toISOString(),
  })
}

// ---------- Estados de los equipos ----------
const ITEM_STATUSES = ['recibido', 'en_reparacion', 'terminado', 'entregado']

// Estado de la orden derivado del estado de sus ítems.
function orderStatus(order) {
  const items = order.items || []
  if (items.length && items.every((i) => i.status === 'entregado')) return 'entregada'
  if (items.some((i) => i.status === 'terminado')) return 'lista'
  if (items.some((i) => i.status === 'en_reparacion')) return 'en_reparacion'
  return 'recibida'
}

// Adjunta a una orden datos legibles: cliente, quién la recibió y estado.
function decorateOrder(d, order) {
  const customer = d.customers.find((c) => c.id === order.customerId)
  const names = new Map(d.users.map((u) => [u.id, u.name]))
  return {
    ...order,
    customerName: customer?.fullName || '(cliente eliminado)',
    receivedByName: names.get(order.receivedBy) || '—',
    status: orderStatus(order),
    items: (order.items || []).map((i) => ({
      ...i,
      repairedByName: i.repairedBy ? names.get(i.repairedBy) || '—' : null,
      history: (i.history || []).map((h) => ({ ...h, byName: names.get(h.by) || '—' })),
    })),
  }
}

// Busca una orden y un ítem dentro de ella.
function findItem(orderId, itemId) {
  const db = getDB()
  const order = db.orders.find((o) => o.id === orderId)
  if (!order) return { error: 'Orden no encontrada.' }
  const item = (order.items || []).find((i) => i.id === itemId)
  if (!item) return { error: 'Equipo no encontrado.' }
  const customer = db.customers.find((c) => c.id === order.customerId)
  return { order, item, customer }
}

function pad4(n) {
  return String(n).padStart(4, '0')
}

function formatDateLabel(iso) {
  const [y, m, d] = String(iso).split('-')
  return `${d}/${m}/${y}`
}

// ---------- Autenticación ----------
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {}
  const user = getDB().users.find(
    (u) => u.email.toLowerCase() === String(email || '').trim().toLowerCase(),
  )
  if (!user || !bcrypt.compareSync(String(password || ''), user.password)) {
    return res.status(401).json({ error: 'Credenciales inválidas.' })
  }
  if (!user.active) {
    return res.status(403).json({ error: 'Usuario desactivado. Contactá al administrador.' })
  }
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '12h' })
  return res.json({ token, user: publicUser(user) })
})

function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autorizado.' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = getDB().users.find((u) => u.id === payload.id) || null
    if (!req.user) return res.status(401).json({ error: 'No autorizado.' })
    next()
  } catch {
    return res.status(401).json({ error: 'Sesión expirada.' })
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido al administrador.' })
  }
  next()
}

// ---------- Bootstrap ----------
app.get('/api/bootstrap', auth, (req, res) => {
  const db = getDB()
  const live = (r) => !r.deletedAt
  const orders = db.orders
    .filter(live)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((o) => decorateOrder(db, o))
  return res.json({
    user: publicUser(req.user),
    customers: db.customers.filter(live),
    orders,
    users: req.user.role === 'admin' ? db.users.map(publicUser) : [],
    config: req.user.role === 'admin' ? db.config : undefined,
  })
})

// ---------- Clientes ----------
app.post('/api/customers', auth, (req, res) => {
  const { fullName, dni, phone, phone2, email, address } = req.body || {}
  if (!fullName || !fullName.trim()) {
    return res.status(400).json({ error: 'El nombre completo es obligatorio.' })
  }
  const dniNorm = String(dni || '').trim()
  const dupDni = getDB().customers.some(
    (c) => !c.deletedAt && dniNorm && String(c.dni).trim() === dniNorm,
  )
  if (dupDni) {
    return res.status(400).json({ error: `Ya existe un cliente con el DNI ${dniNorm}.` })
  }
  const id = uid()
  mutate((d) => {
    d.customers.push({
      id,
      fullName: titleCase(fullName),
      dni: dniNorm,
      phone: String(phone || ''),
      phone2: String(phone2 || ''),
      email: String(email || '').trim().toLowerCase(),
      address: titleCase(address),
      createdAt: todayISO(),
    })
    audit(d, 'create', 'customers', id, req.user.id, `Alta de cliente ${titleCase(fullName)}${dniNorm ? ` (DNI ${dniNorm})` : ''}`)
  }).then(() => res.json({ ok: true, id }))
})

app.put('/api/customers/:id', auth, (req, res) => {
  const db = getDB()
  const target = db.customers.find((c) => c.id === req.params.id)
  if (!target) return res.status(404).json({ error: 'Cliente no encontrado.' })
  const { fullName, dni, phone, phone2, email, address } = req.body || {}
  if (!fullName || !fullName.trim()) {
    return res.status(400).json({ error: 'El nombre completo es obligatorio.' })
  }
  const dniNorm = String(dni || '').trim()
  const dupDni = db.customers.some(
    (c) => c.id !== req.params.id && !c.deletedAt && dniNorm && String(c.dni).trim() === dniNorm,
  )
  if (dupDni) {
    return res.status(400).json({ error: `Ya existe un cliente con el DNI ${dniNorm}.` })
  }
  mutate((d) => {
    const c = d.customers.find((x) => x.id === req.params.id)
    Object.assign(c, {
      fullName: titleCase(fullName),
      dni: dniNorm,
      phone: String(phone || ''),
      phone2: String(phone2 || ''),
      email: String(email || '').trim().toLowerCase(),
      address: titleCase(address),
    })
    audit(d, 'update', 'customers', c.id, req.user.id, `Edición de cliente ${c.fullName}`)
  }).then(() => res.json({ ok: true }))
})

app.delete('/api/customers/:id', auth, (req, res) => {
  const db = getDB()
  const target = db.customers.find((c) => c.id === req.params.id)
  if (!target) return res.status(404).json({ error: 'Cliente no encontrado.' })
  if (target.deletedAt) return res.status(400).json({ error: 'El cliente ya está eliminado.' })
  const activeOrders = db.orders.filter((o) => !o.deletedAt && o.customerId === req.params.id)
  if (activeOrders.length) {
    return res.status(400).json({ error: 'El cliente tiene órdenes activas. No se puede eliminar.' })
  }
  mutate((d) => {
    const now = new Date().toISOString()
    d.orders.filter((o) => o.customerId === req.params.id).forEach((o) => (o.deletedAt = now))
    d.customers.find((c) => c.id === req.params.id).deletedAt = now
    audit(d, 'delete', 'customers', req.params.id, req.user.id, `Baja de cliente ${target.fullName}`)
  }).then(() => res.json({ ok: true }))
})

// ---------- Órdenes ----------
app.post('/api/orders', auth, (req, res) => {
  const { customerId, items } = req.body || {}
  const db = getDB()
  const customer = db.customers.find((c) => c.id === customerId)
  if (!customer || customer.deletedAt) {
    return res.status(400).json({ error: 'Cliente inexistente o eliminado.' })
  }
  if (!Array.isArray(items) || !items.length) {
    return res.status(400).json({ error: 'Agregá al menos un dispositivo a la orden.' })
  }
  const cleanItems = []
  for (const raw of items) {
    const brand = String(raw?.brand || '').trim()
    const model = String(raw?.model || '').trim()
    if (!brand && !model) {
      return res.status(400).json({ error: 'Cada dispositivo necesita marca o modelo.' })
    }
    cleanItems.push({
      id: uid(),
      brand: titleCase(brand),
      model: titleCase(model),
      imei: String(raw?.imei || '').trim(),
      password: String(raw?.password || ''),
      issueDescription: String(raw?.issueDescription || '').trim(),
      accessories: String(raw?.accessories || '').trim(),
      priceEstimate: Math.max(0, Number(raw?.priceEstimate) || 0),
      advance: Math.max(0, Number(raw?.advance) || 0),
      status: 'recibido',
      technicianNotes: '',
      repairedBy: null,
      history: [{ status: 'recibido', at: todayISO(), by: req.user.id }],
      createdAt: todayISO(),
      deliveredAt: null,
    })
  }
  let order = null
  mutate((d) => {
    const orderNumber = `OS-${pad4((d.orderCounter || 0) + 1)}`
    d.orderCounter = (d.orderCounter || 0) + 1
    order = {
      id: uid(),
      orderNumber,
      customerId,
      items: cleanItems,
      receivedBy: req.user.id,
      createdAt: todayISO(),
    }
    d.orders.push(order)
    audit(
      d,
      'create',
      'orders',
      order.id,
      req.user.id,
      `Orden ${orderNumber} · ${cleanItems.length} dispositivo(s) de ${customer.fullName}`,
    )
  }).then(() => {
    res.json({ ok: true, order: decorateOrder(getDB(), order) })
  })
})

app.get('/api/orders', auth, (req, res) => {
  const db = getDB()
  const { status, q } = req.query
  const query = String(q || '').trim().toLowerCase()
  let list = db.orders
    .filter((o) => !o.deletedAt)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((o) => decorateOrder(db, o))

  if (status && status !== 'all') list = list.filter((o) => o.status === status)
  if (query) {
    list = list.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(query) ||
        (o.customerName || '').toLowerCase().includes(query) ||
        (o.items || []).some(
          (i) =>
            (i.brand + ' ' + i.model).toLowerCase().includes(query) ||
            i.imei.toLowerCase().includes(query),
        ),
    )
  }
  res.json({ orders: list })
})

app.get('/api/orders/:id', auth, (req, res) => {
  const db = getDB()
  const order = db.orders.find((o) => o.id === req.params.id)
  if (!order || order.deletedAt) return res.status(404).json({ error: 'Orden no encontrada.' })
  res.json({ order: decorateOrder(db, order) })
})

app.delete('/api/orders/:id', auth, (req, res) => {
  const db = getDB()
  const order = db.orders.find((o) => o.id === req.params.id)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  if (order.deletedAt) return res.status(400).json({ error: 'La orden ya está eliminada.' })
  const anyActive = (order.items || []).some((i) => i.status !== 'entregado')
  if (anyActive && req.user.role !== 'admin') {
    return res.status(400).json({ error: 'La orden tiene equipos sin entregar. Solo el admin puede eliminarla.' })
  }
  mutate((d) => {
    const o = d.orders.find((x) => x.id === req.params.id)
    o.deletedAt = new Date().toISOString()
    audit(d, 'delete', 'orders', o.id, req.user.id, `Baja de orden ${o.orderNumber}`)
  }).then(() => res.json({ ok: true }))
})

// ---------- Estado de un equipo ----------
app.post('/api/orders/:id/items/:itemId/status', auth, async (req, res) => {
  const { status } = req.body || {}
  const { order, item, customer, error } = findItem(req.params.id, req.params.itemId)
  if (error) return res.status(404).json({ error })
  if (order.deletedAt) return res.status(400).json({ error: 'La orden está eliminada.' })
  if (!ITEM_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido.' })
  }

  const from = item.status
  const role = req.user.role

  // Transiciones permitidas según el estado actual y el rol.
  const transitions = {
    recibido: ['en_reparacion'],
    en_reparacion: ['terminado'],
    terminado: ['entregado', 'en_reparacion'],
    entregado: [],
  }
  if (!transitions[from]?.includes(status)) {
    return res.status(400).json({
      error: `No se puede pasar de "${from}" a "${status}".`,
    })
  }
  if (status === 'en_reparacion' && !['tecnico', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Solo el técnico puede iniciar reparaciones.' })
  }
  if (status === 'terminado' && !['tecnico', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Solo el técnico puede marcar un equipo como terminado.' })
  }
  if (status === 'entregado' && !['mostrador', 'admin'].includes(role)) {
    return res.status(403).json({ error: 'Solo el mostrador (o el admin) puede entregar un equipo.' })
  }

  let whatsapp = null
  mutate((d) => {
    const target = d.orders.find((o) => o.id === req.params.id).items.find((i) => i.id === req.params.itemId)
    target.status = status
    target.history = target.history || []
    target.history.push({ status, at: new Date().toISOString(), by: req.user.id })
    if (status === 'en_reparacion' || status === 'terminado') target.repairedBy = req.user.id
    if (status === 'entregado') {
      target.deliveredAt = todayISO()
      target.deliveredBy = req.user.id
    }
    const deviceLabel = `${target.brand} ${target.model}`.trim()
    audit(
      d,
      'status',
      'orderItems',
      target.id,
      req.user.id,
      `${order.orderNumber} · ${deviceLabel}: estado "${status}"`,
    )

    // Al marcar "terminado" se avisa al cliente por WhatsApp.
    if (status === 'terminado') {
      const cfg = d.config?.whatsapp || {}
      const phone = normalizePhone(customer?.phone)
      const message = renderTemplate(cfg.messageTemplate, {
        cliente: customer?.fullName || '',
        dispositivo: deviceLabel,
        orden: order.orderNumber,
        local: cfg.local || '',
      })
      // El envío se hace después del commit (no dentro de mutate).
      whatsapp = { cfg, phone, message, deviceLabel }
    }
  }).then(async () => {
    if (whatsapp) {
      const result = await sendWhatsApp({
        instanceId: whatsapp.cfg.instanceId,
        apiToken: whatsapp.cfg.apiToken,
        chatId: whatsapp.phone,
        message: whatsapp.message,
      })
      mutate((d) => {
        const item2 = d.orders.find((o) => o.id === req.params.id).items.find((i) => i.id === req.params.itemId)
        item2.history = item2.history || []
        item2.history.push({
          status: 'whatsapp',
          at: new Date().toISOString(),
          by: req.user.id,
          note: result.ok ? 'WhatsApp enviado al cliente' : `WhatsApp: ${result.error}`,
        })
        audit(
          d,
          result.ok ? 'whatsapp' : 'whatsapp_error',
          'orderItems',
          req.params.itemId,
          req.user.id,
          `${order.orderNumber} · ${whatsapp.deviceLabel}: ${result.ok ? 'aviso enviado' : `falló (${result.error})`}`,
        )
      })
    }
    res.json({
      ok: true,
      order: decorateOrder(getDB(), order),
      whatsapp: whatsapp ? { attempted: true, sent: !!(whatsapp && whatsapp.phone && whatsapp.cfg.instanceId && whatsapp.cfg.apiToken) } : undefined,
    })
  })
})

// ---------- Edición de notas / precio de un equipo ----------
app.put('/api/orders/:id/items/:itemId', auth, (req, res) => {
  if (!['tecnico', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Solo el técnico puede editar las notas del equipo.' })
  }
  const { order, error } = findItem(req.params.id, req.params.itemId)
  if (error) return res.status(404).json({ error })
  if (order.deletedAt) return res.status(400).json({ error: 'La orden está eliminada.' })
  const { technicianNotes, priceEstimate } = req.body || {}
  mutate((d) => {
    const target = d.orders.find((o) => o.id === req.params.id).items.find((i) => i.id === req.params.itemId)
    if (technicianNotes !== undefined) target.technicianNotes = String(technicianNotes)
    if (priceEstimate !== undefined) target.priceEstimate = Math.max(0, Number(priceEstimate) || 0)
    audit(
      d,
      'update',
      'orderItems',
      target.id,
      req.user.id,
      `${order.orderNumber} · ${target.brand} ${target.model}: notas/precio actualizados`,
    )
  }).then(() => res.json({ ok: true }))
})

// ---------- Etiqueta ZPL ----------
app.post('/api/orders/:id/items/:itemId/label', auth, async (req, res) => {
  const { order, item, customer, error } = findItem(req.params.id, req.params.itemId)
  if (error) return res.status(404).json({ error })
  const result = await printZplLabel({
    orderNumber: order.orderNumber,
    itemLabel: `${order.orderNumber} · ${(order.items || []).findIndex((i) => i.id === item.id) + 1}`,
    model: `${item.brand} ${item.model}`.trim(),
    customerName: customer?.fullName || '',
    imei: item.imei,
    date: formatDateLabel(todayISO()),
  })
  res.json({ ok: result.ok, error: result.error })
})

// ---------- Reenviar aviso por WhatsApp ----------
app.post('/api/orders/:id/items/:itemId/notify', auth, async (req, res) => {
  const db = getDB()
  const { order, item, customer, error } = findItem(req.params.id, req.params.itemId)
  if (error) return res.status(404).json({ error })
  const cfg = db.config?.whatsapp || {}
  const phone = normalizePhone(customer?.phone)
  const deviceLabel = `${item.brand} ${item.model}`.trim()
  const message = renderTemplate(cfg.messageTemplate, {
    cliente: customer?.fullName || '',
    dispositivo: deviceLabel,
    orden: order.orderNumber,
    local: cfg.local || '',
  })
  const result = await sendWhatsApp({
    instanceId: cfg.instanceId,
    apiToken: cfg.apiToken,
    chatId: phone,
    message,
  })
  mutate((d) => {
    audit(
      d,
      result.ok ? 'whatsapp' : 'whatsapp_error',
      'orderItems',
      item.id,
      req.user.id,
      `${order.orderNumber} · ${deviceLabel}: ${result.ok ? 'aviso enviado' : `falló (${result.error})`}`,
    )
  })
  res.json({ ok: result.ok, error: result.error })
})

// ---------- Configuración de WhatsApp (solo admin) ----------
app.get('/api/config/whatsapp', auth, adminOnly, (req, res) => {
  res.json({ config: getDB().config || {} })
})

app.post('/api/config/whatsapp', auth, adminOnly, (req, res) => {
  const { instanceId, apiToken, local, messageTemplate } = req.body || {}
  mutate((d) => {
    d.config = d.config || {}
    d.config.whatsapp = {
      instanceId: String(instanceId || '').trim(),
      apiToken: String(apiToken || '').trim(),
      local: String(local || '').trim(),
      messageTemplate: String(messageTemplate || '').trim(),
    }
    audit(d, 'update', 'config', null, req.user.id, 'Configuración de WhatsApp actualizada')
  }).then(() => res.json({ ok: true }))
})

// ---------- Usuarios (solo admin) ----------
app.post('/api/users', auth, adminOnly, (req, res) => {
  const { name, email, password, role } = req.body || {}
  const db = getDB()
  if (db.users.some((u) => u.email.toLowerCase() === String(email || '').trim().toLowerCase())) {
    return res.status(400).json({ error: 'Ya existe un usuario con ese email.' })
  }
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' })
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 4 caracteres.' })
  }
  if (!['admin', 'tecnico', 'mostrador'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido.' })
  }
  const id = uid()
  mutate((d) => {
    d.users.push({
      id,
      name: titleCase(name),
      email: String(email || '').trim().toLowerCase(),
      password: bcrypt.hashSync(password, 10),
      role,
      active: true,
    })
    audit(d, 'create', 'users', id, req.user.id, `Alta de usuario ${titleCase(name)} (${role})`)
  }).then(() => res.json({ ok: true, id }))
})

app.post('/api/users/:id/toggle', auth, adminOnly, (req, res) => {
  const db = getDB()
  const target = db.users.find((u) => u.id === req.params.id)
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' })
  if (target.id === req.user.id) {
    return res.status(400).json({ error: 'No podés desactivar tu propio usuario.' })
  }
  mutate((d) => {
    const u = d.users.find((x) => x.id === req.params.id)
    u.active = !u.active
    audit(d, 'toggle', 'users', u.id, req.user.id, `Usuario ${u.name} ${u.active ? 'activado' : 'desactivado'}`)
  }).then(() => res.json({ ok: true, active: getDB().users.find((u) => u.id === req.params.id).active }))
})

// ---------- Auditoría (solo admin) ----------
app.get('/api/audit', auth, adminOnly, (req, res) => {
  const db = getDB()
  const names = new Map(db.users.map((u) => [u.id, u.name]))
  const total = db.auditLogs.length
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50))
  const start = (page - 1) * limit
  const logs = db.auditLogs
    .slice(start, start + limit)
    .map((l) => ({ ...l, userName: names.get(l.userId) || '—' }))
  return res.json({ logs, total, page, pages: Math.max(1, Math.ceil(total / limit)) })
})

// ---------- Actividad (línea de tiempo, para todos) ----------
app.get('/api/actividad', auth, (req, res) => {
  const db = getDB()
  const names = new Map(db.users.map((u) => [u.id, u.name]))
  const total = db.auditLogs.length
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50))
  const start = (page - 1) * limit
  const logs = db.auditLogs
    .slice(start, start + limit)
    .map((l) => ({ ...l, userName: names.get(l.userId) || '—' }))
  return res.json({ logs, total, page, pages: Math.max(1, Math.ceil(total / limit)) })
})

// ---------- Copias de seguridad (solo admin) ----------
app.get('/api/backups', auth, adminOnly, (req, res) => {
  res.json({ backups: listBackups() })
})

app.post('/api/backups', auth, adminOnly, (req, res) => {
  try {
    const name = createBackup()
    if (!name) return res.status(400).json({ error: 'Todavía no hay datos para respaldar.' })
    res.json({ ok: true, name })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/backups/:name/restore', auth, adminOnly, async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name)
    const found = listBackups().find((b) => b.name === name)
    if (!found) return res.status(404).json({ error: 'Copia no encontrada.' })
    createBackup()
    await restoreBackup(name)
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

// ---------- 404 para la API ----------
app.use('/api', (req, res) => res.status(404).json({ error: 'Ruta no encontrada.' }))

// ---------- Sirve el frontend compilado (si existe dist/) ----------
const dist = path.join(__dirname, '..', 'dist')
if (fs.existsSync(dist)) {
  app.use(express.static(dist))
  app.use((req, res, next) => {
    if (req.path.startsWith('/api')) return next()
    res.sendFile(path.join(dist, 'index.html'))
  })
}

// ---------- Manejador de errores ----------
app.use((err, req, res, _next) => {
  console.error(err)
  res.status(500).json({ error: 'Error interno del servidor.' })
})

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor de servicio técnico corriendo en http://0.0.0.0:${PORT}`)
})