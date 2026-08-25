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
import { initDB, getDB, mutate, persist, createBackup, listBackups, restoreBackup, purgeTrash, onDataChange } from './store.js'
import { buildSeed } from './seed.js'
import { todayISO, titleCase, uid, addDays, daysBetween, toISODate, sentenceCase, normalizeList } from './helpers.js'
import { printZplLabel } from './printer.js'
import { ORDER_STATUSES, allowedTransitions } from '../shared/fsm.js'
import { buildOrderHtml } from './pdf/orderTemplate.js'
import { buildPickupHtml } from './pdf/pickupTemplate.js'
import { htmlToPdf } from './pdf/puppeteerPdf.js'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = process.env.PORT || 8080

// El secreto JWT no debe quedar hardcodeado en producción: se exige por env.
const NODE_ENV = process.env.NODE_ENV || 'development'
const JWT_SECRET = process.env.JWT_SECRET || (NODE_ENV === 'production' ? null : 'service-local-secret-2026')
if (!JWT_SECRET) {
  console.error('Falta la variable de entorno JWT_SECRET. Definila antes de iniciar el servidor.')
  process.exit(1)
}
if (NODE_ENV !== 'production' && !process.env.JWT_SECRET) {
  console.warn('[WARN] Usando JWT_SECRET por defecto (solo desarrollo). Definí JWT_SECRET para entornos productivos.')
}

// Límite de intentos de login por IP+cuenta (anti fuerza bruta).
const MAX_LOGIN_ATTEMPTS = Number(process.env.MAX_LOGIN_ATTEMPTS || 5)
const LOGIN_WINDOW_MS = 15 * 60 * 1000
const loginAttempts = new Map()
// Contraseñas del seed: si un usuario aún usa una, se le exige cambiarla.
const DEFAULT_PASSWORDS = ['admin123']
function checkLoginLimit(key) {
  const now = Date.now()
  if (loginAttempts.size > 10000) {
    for (const [k, r] of loginAttempts) {
      if (now >= r.resetAt) loginAttempts.delete(k)
    }
  }
  const rec = loginAttempts.get(key)
  if (rec && rec.count >= MAX_LOGIN_ATTEMPTS && now < rec.resetAt) return true
  return false
}
function noteLoginFailure(key) {
  const now = Date.now()
  const rec = loginAttempts.get(key)
  if (rec && now < rec.resetAt) rec.count += 1
  else loginAttempts.set(key, { count: 1, resetAt: now + LOGIN_WINDOW_MS })
}

app.use(cors())
app.use(express.json())

await initDB(buildSeed)

// ============================================
// Migración: normaliza el texto ya guardado (Title/Sentence Case).
// Se ejecuta una sola vez y se marca para no repetirla en cada arranque.
// ============================================
function migrateNormalizedText() {
  const db = getDB()
  if (!db || db.meta?.normalizedText) return

  let changed = 0
  const touch = (before, after) => {
    if (before !== after) changed += 1
    return after
  }

  for (const c of db.customers || []) {
    c.fullName = touch(c.fullName, titleCase(c.fullName))
    c.address = touch(c.address, titleCase(c.address))
  }
  for (const o of db.orders || []) {
    o.brand = touch(o.brand, titleCase(o.brand))
    o.model = touch(o.model, titleCase(o.model))
    o.accessories = touch(o.accessories, normalizeList(o.accessories))
    o.conditions = touch(o.conditions, normalizeList(o.conditions))
    o.issue = touch(o.issue, sentenceCase(o.issue))
    o.fix = touch(o.fix, normalizeList(o.fix))
    o.technicianNotes = touch(o.technicianNotes, sentenceCase(o.technicianNotes))
    if (!Array.isArray(o.notesLog)) o.notesLog = []
  }
  for (const b of db.catalog?.brands || []) {
    b.name = touch(b.name, titleCase(b.name))
  }
  for (const m of db.catalog?.models || []) {
    m.brand = touch(m.brand, titleCase(m.brand))
    m.name = touch(m.name, titleCase(m.name))
  }
  for (const u of db.users || []) {
    u.name = touch(u.name, titleCase(u.name))
  }

  if (changed > 0) {
    mutate((d) => {
      d.meta = { ...(d.meta || {}), normalizedText: true }
    }).then(() => console.log(`Migración de texto: ${changed} campo(s) normalizado(s).`))
  } else {
    mutate((d) => {
      d.meta = { ...(d.meta || {}), normalizedText: true }
    }).then(() => console.log('Migración de texto: sin cambios.'))
  }
}
migrateNormalizedText()

// ============================================
// Tiempo real (Server-Sent Events)
// ============================================
const eventClients = new Set()

// Envía un evento a todos los clientes conectados.
function broadcast(type, data = {}) {
  const payload = `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of eventClients) {
    try {
      res.write(payload)
    } catch {
      eventClients.delete(res)
    }
  }
}

// Cuando la base cambia, avisamos a todos los clientes conectados.
onDataChange(() => broadcast('data-changed'))

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

// Adjunta a una orden datos legibles: cliente, responsables y estado.
function decorateOrder(d, order) {
  const customer = d.customers.find((c) => c.id === order.customerId)
  const names = new Map(d.users.map((u) => [u.id, u.name]))
  return {
    ...order,
    customerName: customer?.fullName || '(cliente eliminado)',
    assignedToName: order.assignedTo ? names.get(order.assignedTo) || '—' : null,
    receivedByName: names.get(order.receivedBy) || '—',
    repairedByName: order.repairedBy ? names.get(order.repairedBy) || '—' : null,
    deliveredByName: order.deliveredBy ? names.get(order.deliveredBy) || '—' : null,
    notifiedByName: order.notifiedBy ? names.get(order.notifiedBy) || '—' : null,
    confirmedByName: order.confirmedBy ? names.get(order.confirmedBy) || '—' : null,
    history: (order.history || []).map((h) => ({ ...h, byName: names.get(h.by) || '—' })),
  }
}

function pad4(n) {
  return String(n).padStart(4, '0')
}

function formatDateLabel(iso) {
  const [y, m, d] = String(iso).split('-')
  return `${d}/${m}/${y}`
}

// ---------- Autenticación ----------
// Lista pública de perfiles (usuarios activos) para el login: solo nombre y rol.
app.get('/api/auth/profiles', (req, res) => {
  const profiles = getDB()
    .users.filter((u) => u.active)
    .map((u) => ({ id: u.id, name: u.name, role: u.role }))
    .sort((a, b) => a.name.localeCompare(b.name))
  res.json({ profiles })
})

app.post('/api/auth/login', (req, res) => {
  const { email, password, profileId } = req.body || {}
  const user = profileId
    ? getDB().users.find((u) => u.id === profileId)
    : getDB().users.find(
        (u) => u.email.toLowerCase() === String(email || '').trim().toLowerCase(),
      )
  const rateKey = `${req.ip}:${String(profileId || email || '').toLowerCase()}`
  if (checkLoginLimit(rateKey)) {
    return res
      .status(429)
      .json({ error: 'Demasiados intentos fallidos. Probá de nuevo en unos minutos.' })
  }
  if (!user || !bcrypt.compareSync(String(password || ''), user.password)) {
    noteLoginFailure(rateKey)
    return res.status(401).json({ error: 'Credenciales inválidas.' })
  }
  if (!user.active) {
    noteLoginFailure(rateKey)
    return res.status(403).json({ error: 'Usuario desactivado. Contactá al administrador.' })
  }
  loginAttempts.delete(rateKey)
  const token = jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '12h' })
  return res.json({ token, user: { ...publicUser(user), mustChangePassword: usesDefaultPassword(user) } })
})

function usesDefaultPassword(user) {
  if (!user?.password) return false
  return DEFAULT_PASSWORDS.some((p) => bcrypt.compareSync(p, user.password))
}

app.post('/api/auth/change-password', auth, (req, res) => {
  const { currentPassword, newPassword } = req.body || {}
  const user = getDB().users.find((u) => u.id === req.user.id)
  if (!user) return res.status(401).json({ error: 'No autorizado.' })
  if (!bcrypt.compareSync(String(currentPassword || ''), user.password)) {
    return res.status(400).json({ error: 'La contraseña actual es incorrecta.' })
  }
  const pw = String(newPassword || '')
  if (pw.length < 4) {
    return res.status(400).json({ error: 'La contraseña nueva debe tener al menos 4 caracteres.' })
  }
  const hash = bcrypt.hashSync(pw, 10)
  mutate((d) => {
    const target = d.users.find((u) => u.id === req.user.id)
    if (target) target.password = hash
    audit(d, 'password_change', 'users', req.user.id, req.user.id, `Cambio de contraseña (${req.user.name})`)
  }).then(() => res.json({ ok: true }))
})

function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autorizado.' })
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = getDB().users.find((u) => u.id === payload.id) || null
    if (!req.user || !req.user.active) return res.status(401).json({ error: 'No autorizado.' })
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

// ---------- Tiempo real: canal de eventos (SSE) ----------
app.get('/api/events', (req, res) => {
  // EventSource no puede enviar headers, así que el token viaja como query.
  const token = req.query.token
  if (!token) return res.status(401).json({ error: 'No autorizado.' })
  let user
  try {
    const payload = jwt.verify(String(token), JWT_SECRET)
    user = getDB().users.find((u) => u.id === payload.id) || null
  } catch {
    user = null
  }
  if (!user || !user.active) return res.status(401).json({ error: 'No autorizado.' })

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  res.write('event: connected\ndata: {"ok":true}\n\n')

  eventClients.add(res)

  // Heartbeat: evita que proxies/gateways corten la conexión inactiva.
  const heartbeat = setInterval(() => {
    try {
      res.write(': ping\n\n')
    } catch {
      clearInterval(heartbeat)
    }
  }, 25000)

  req.on('close', () => {
    clearInterval(heartbeat)
    eventClients.delete(res)
  })
})

// ---------- Bootstrap ----------
app.get('/api/bootstrap', auth, (req, res) => {
  const db = getDB()
  const live = (r) => !r.deletedAt
  const allLive = db.orders.filter(live)
  // El bootstrap solo envía las órdenes activas (no entregadas). El histórico
  // se consulta paginado vía /api/orders para no saturar la red.
  const orders = allLive
    .filter((o) => o.status !== 'entregado')
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((o) => decorateOrder(db, o))
  return res.json({
    user: publicUser(req.user),
    customers: db.customers.filter(live),
    orders,
    ordersTotals: {
      total: allLive.length,
      active: orders.length,
      delivered: allLive.filter((o) => o.status === 'entregado').length,
    },
    catalog: db.catalog || { brands: [], models: [] },
    users: req.user.role === 'admin' ? db.users.map(publicUser) : [],
    technicians: db.users
      .filter((u) => u.active && u.role === 'tecnico')
      .map(publicUser),
    config: {
      revisionFee: db.config?.revisionFee ?? 0,
      ...(req.user.role === 'admin' ? { whatsapp: { ...(db.config?.whatsapp || {}), apiToken: undefined } } : {}),
    },
  })
})

// ---------- Catálogo de marcas y modelos ----------
app.get('/api/catalog', auth, (req, res) => {
  const db = getDB()
  const brands = [...(db.catalog?.brands || [])].sort((a, b) => b.usage - a.usage || a.name.localeCompare(b.name))
  const models = [...(db.catalog?.models || [])].sort((a, b) => b.usage - a.usage || a.name.localeCompare(b.name))
  res.json({ brands, models })
})

app.post('/api/catalog/brands', auth, (req, res) => {
  const name = titleCase(String(req.body?.name || '').trim())
  if (!name) return res.status(400).json({ error: 'El nombre de la marca es obligatorio.' })
  mutate((d) => {
    d.catalog = d.catalog || { brands: [], models: [] }
    let b = d.catalog.brands.find((x) => x.name.toLowerCase() === name.toLowerCase())
    if (!b) {
      b = { id: uid(), name, usage: 0 }
      d.catalog.brands.push(b)
      audit(d, 'create', 'catalog', b.id, req.user.id, `Nueva marca en catálogo: ${name}`)
    }
  }).then(() => {
    const b = getDB().catalog.brands.find((x) => x.name.toLowerCase() === name.toLowerCase())
    res.json({ ok: true, brand: b })
  })
})

app.post('/api/catalog/models', auth, (req, res) => {
  const brand = titleCase(String(req.body?.brand || '').trim())
  const name = titleCase(String(req.body?.name || '').trim())
  if (!brand || !name) return res.status(400).json({ error: 'La marca y el modelo son obligatorios.' })
  mutate((d) => {
    d.catalog = d.catalog || { brands: [], models: [] }
    if (!d.catalog.brands.find((x) => x.name.toLowerCase() === brand.toLowerCase())) {
      d.catalog.brands.push({ id: uid(), name: brand, usage: 0 })
    }
    let m = d.catalog.models.find((x) => x.brand.toLowerCase() === brand.toLowerCase() && x.name.toLowerCase() === name.toLowerCase())
    if (!m) {
      m = { id: uid(), brand, name, usage: 0 }
      d.catalog.models.push(m)
      audit(d, 'create', 'catalog', m.id, req.user.id, `Nuevo modelo en catálogo: ${brand} ${name}`)
    }
  }).then(() => {
    const m = getDB().catalog.models.find(
      (x) => x.brand.toLowerCase() === brand.toLowerCase() && x.name.toLowerCase() === name.toLowerCase(),
    )
    res.json({ ok: true, model: m })
  })
})

// Cuenta una marca/modelo en el catálogo (y los crea si faltan).
function bumpCatalog(d, brand, model) {
  d.catalog = d.catalog || { brands: [], models: [] }
  let b = d.catalog.brands.find((x) => x.name.toLowerCase() === brand.toLowerCase())
  if (!b) {
    b = { id: uid(), name: brand, usage: 0 }
    d.catalog.brands.push(b)
  }
  b.usage += 1
  let m = d.catalog.models.find((x) => x.brand.toLowerCase() === brand.toLowerCase() && x.name.toLowerCase() === model.toLowerCase())
  if (!m) {
    m = { id: uid(), brand, name: model, usage: 0 }
    d.catalog.models.push(m)
  }
  m.usage += 1
}

// ---------- Clientes ----------
app.post('/api/customers', auth, (req, res) => {
  const { fullName, dni, phone, phone2, phone3, email, address } = req.body || {}
  if (!fullName || !fullName.trim()) {
    return res.status(400).json({ error: 'El nombre completo es obligatorio.' })
  }
  const dniNorm = String(dni || '').trim()
  if (dniNorm && !/^\d{6,8}$/.test(dniNorm)) {
    return res.status(400).json({ error: 'El DNI debe tener entre 6 y 8 dígitos.' })
  }
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
      phone3: String(phone3 || ''),
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
  const { fullName, dni, phone, phone2, phone3, email, address } = req.body || {}
  if (!fullName || !fullName.trim()) {
    return res.status(400).json({ error: 'El nombre completo es obligatorio.' })
  }
  const dniNorm = String(dni || '').trim()
  if (dniNorm && !/^\d{6,8}$/.test(dniNorm)) {
    return res.status(400).json({ error: 'El DNI debe tener entre 6 y 8 dígitos.' })
  }
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
      phone3: String(phone3 || ''),
      email: String(email || '').trim().toLowerCase(),
      address: titleCase(address),
    })
    audit(d, 'update', 'customers', c.id, req.user.id, `Edición de cliente ${c.fullName}`)
  }).then(() => res.json({ ok: true }))
})

app.delete('/api/customers/:id', auth, adminOnly, (req, res) => {
  const db = getDB()
  const target = db.customers.find((c) => c.id === req.params.id)
  if (!target) return res.status(404).json({ error: 'Cliente no encontrado.' })
  if (target.deletedAt) return res.status(400).json({ error: 'El cliente ya está eliminado.' })
  mutate((d) => {
    const now = new Date().toISOString()
    d.orders.filter((o) => o.customerId === req.params.id).forEach((o) => (o.deletedAt = now))
    d.customers.find((c) => c.id === req.params.id).deletedAt = now
    audit(d, 'delete', 'customers', req.params.id, req.user.id, `Baja de cliente ${target.fullName}`)
  }).then(() => res.json({ ok: true }))
})

// ---------- Órdenes ----------
app.post('/api/orders', auth, (req, res) => {
  if (!['mostrador', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Solo empleados o administradores pueden crear órdenes.' })
  }
  const body = req.body || {}
  const db = getDB()
  const customer = db.customers.find((c) => c.id === body.customerId)
  if (!customer || customer.deletedAt) {
    return res.status(400).json({ error: 'Cliente inexistente o eliminado.' })
  }
  const brand = titleCase(String(body.brand || '').trim())
  const model = titleCase(String(body.model || '').trim())
  if (!brand) return res.status(400).json({ error: 'Elegí la marca del dispositivo.' })
  if (!model) return res.status(400).json({ error: 'Elegí el modelo del dispositivo.' })
  const diagnosisType = body.diagnosisType === 'revision' ? 'revision' : 'visible'
  const price = Math.max(0, Number(body.price) || 0)
  const advance = Math.max(0, Number(body.advance) || 0)
  const pattern = Array.isArray(body.pattern)
    ? body.pattern.filter((n) => Number.isInteger(n) && n >= 0 && n <= 8).slice(0, 9)
    : []
  const storedPattern = pattern.length >= 3 ? pattern : null

  let order = null
  mutate((d) => {
    const orderNumber = `OS-${pad4((d.orderCounter || 0) + 1)}`
    d.orderCounter = (d.orderCounter || 0) + 1
    order = {
      id: uid(),
      orderNumber,
      customerId: body.customerId,
      brand,
      model,
      accessories: normalizeList(String(body.accessories || '')),
      conditions: normalizeList(String(body.conditions || '')),
      pin: String(body.pin || ''),
      pattern: storedPattern,
      diagnosisType,
      issue: sentenceCase(String(body.issue || '')),
      fix: normalizeList(String(body.fix || '')),
      price,
      advance,
      status: 'recibido',
      technicianNotes: '',
      notesLog: [],
      assignedTo: null,
      repairedBy: null,
      notified: false,
      notifiedAt: null,
      notifiedBy: null,
      confirmed: false,
      confirmedAt: null,
      confirmedBy: null,
      history: [{ status: 'recibido', at: new Date().toISOString(), by: req.user.id }],
      receivedBy: req.user.id,
      createdAt: todayISO(),
      deliveredAt: null,
      deliveredBy: null,
    }
    d.orders.push(order)
    bumpCatalog(d, brand, model)
    audit(
      d,
      'create',
      'orders',
      order.id,
      req.user.id,
      `Orden ${orderNumber} · ${brand} ${model} de ${customer.fullName}${diagnosisType === 'revision' ? ' (a revisión)' : ''}`,
    )
  }).then(() => {
    res.json({ ok: true, order: decorateOrder(getDB(), order) })
  })
})

app.get('/api/orders', auth, (req, res) => {
  const db = getDB()
  const { status, q, from, to, brand, onlyNotNotified, onlyNotConfirmed } = req.query
  const query = String(q || '').trim().toLowerCase()
  const limit = Math.max(1, Math.min(1000, Number(req.query.limit) || 0))
  const offset = Math.max(0, Number(req.query.offset) || 0)

  let list = db.orders
    .filter((o) => !o.deletedAt)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .map((o) => decorateOrder(db, o))

  if (status && status !== 'all') list = list.filter((o) => o.status === status)
  if (brand && brand !== 'all') list = list.filter((o) => o.brand === brand)
  if (from) list = list.filter((o) => o.createdAt >= from)
  if (to) list = list.filter((o) => o.createdAt <= to)
  if (onlyNotNotified === '1') {
    list = list.filter((o) => !o.notified && ['presupuesto', 'terminado'].includes(o.status))
  }
  if (onlyNotConfirmed === '1') {
    list = list.filter((o) => !o.confirmed && o.status === 'presupuesto')
  }
  if (query) {
    list = list.filter(
      (o) =>
        o.orderNumber.toLowerCase().includes(query) ||
        (o.customerName || '').toLowerCase().includes(query) ||
        (o.brand + ' ' + o.model).toLowerCase().includes(query),
    )
  }

  const total = list.length
  if (limit) list = list.slice(offset, offset + limit)
  res.json({ orders: list, total })
})

app.get('/api/orders/:id', auth, (req, res) => {
  const db = getDB()
  const order = db.orders.find((o) => o.id === req.params.id)
  if (!order || order.deletedAt) return res.status(404).json({ error: 'Orden no encontrada.' })
  res.json({ order: decorateOrder(db, order) })
})

app.get('/api/orders/:id/pdf', auth, async (req, res) => {
  try {
    const db = getDB()
    const order = db.orders.find((o) => o.id === req.params.id)
    if (!order || order.deletedAt) return res.status(404).json({ error: 'Orden no encontrada.' })
    const customer = db.customers.find((c) => c.id === order.customerId)
    const html = buildOrderHtml(order, customer)
    const pdfBuffer = await htmlToPdf(html)
    res.type('application/pdf')
    res.set('Content-Disposition', `inline; filename="orden-${order.orderNumber}.pdf"`)
    res.send(pdfBuffer)
  } catch (err) {
    console.error('Error generando PDF:', err)
    res.status(500).json({ error: 'No se pudo generar el PDF.' })
  }
})

app.post('/api/orders/:id/pickup', auth, (req, res) => {
  const db = getDB()
  const order = db.orders.find((o) => o.id === req.params.id)
  if (!order || order.deletedAt) return res.status(404).json({ error: 'Orden no encontrada.' })
  const { pickupBy, pickupName, pickupDni } = req.body || {}
  if (!['client', 'third'].includes(pickupBy)) {
    return res.status(400).json({ error: 'pickupBy inválido.' })
  }
  if (pickupBy === 'third') {
    if (!pickupName || !pickupName.trim()) {
      return res.status(400).json({ error: 'El nombre de quien retira es obligatorio.' })
    }
    if (!pickupDni || !pickupDni.trim()) {
      return res.status(400).json({ error: 'El DNI de quien retira es obligatorio.' })
    }
  }
  mutate((d) => {
    const o = d.orders.find((x) => x.id === req.params.id)
    o.pickupBy = pickupBy
    o.pickupName = pickupBy === 'third' ? pickupName.trim() : ''
    o.pickupDni = pickupBy === 'third' ? pickupDni.trim() : ''
  }).then(() => {
    res.json({ ok: true })
  })
})

app.get('/api/orders/:id/pickup-pdf', auth, async (req, res) => {
  try {
    const db = getDB()
    const order = db.orders.find((o) => o.id === req.params.id)
    if (!order || order.deletedAt) return res.status(404).json({ error: 'Orden no encontrada.' })
    const customer = db.customers.find((c) => c.id === order.customerId)
    const pickup = { pickupBy: order.pickupBy, pickupName: order.pickupName, pickupDni: order.pickupDni }
    const html = buildPickupHtml(order, customer, pickup)
    const pdfBuffer = await htmlToPdf(html)
    res.type('application/pdf')
    res.set('Content-Disposition', `inline; filename="retiro-${order.orderNumber}.pdf"`)
    res.send(pdfBuffer)
  } catch (err) {
    console.error('Error generando PDF de retiro:', err)
    res.status(500).json({ error: 'No se pudo generar el PDF de retiro.' })
  }
})

app.delete('/api/orders/:id', auth, adminOnly, (req, res) => {
  const db = getDB()
  const order = db.orders.find((o) => o.id === req.params.id)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  if (order.deletedAt) return res.status(400).json({ error: 'La orden ya está eliminada.' })
  mutate((d) => {
    const o = d.orders.find((x) => x.id === req.params.id)
    o.deletedAt = new Date().toISOString()
    audit(d, 'delete', 'orders', o.id, req.user.id, `Baja de orden ${o.orderNumber}`)
  }).then(() => res.json({ ok: true }))
})

// ---------- Estado de una orden ----------
app.post('/api/orders/:id/status', auth, (req, res) => {
  const { status, retiro } = req.body || {}
  const db = getDB()
  const order = db.orders.find((o) => o.id === req.params.id)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  if (order.deletedAt) return res.status(400).json({ error: 'La orden está eliminada.' })
  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido.' })
  }

  const from = order.status
  const role = req.user.role
  const isTech = ['tecnico', 'admin'].includes(role)
  const isCounter = ['mostrador', 'admin'].includes(role)

  // Transiciones permitidas (respetan el flujo real del taller).
  const allowed = allowedTransitions(order).includes(status)
  if (!allowed) {
    return res.status(400).json({
      error: `No se puede pasar de "${from}" a "${status}".`,
    })
  }

  // Sin confirmación del cliente no se puede comenzar la reparación de un presupuesto.
  if (from === 'presupuesto' && status === 'en_reparacion' && !order.confirmed) {
    return res.status(400).json({ error: 'El cliente debe confirmar el arreglo antes de reparar.' })
  }
  // Sin técnico asignado no se puede reparar.
  if (status === 'en_reparacion' && !order.assignedTo) {
    return res.status(400).json({ error: 'Asigná un técnico antes de iniciar la reparación.' })
  }
  // Sin técnico asignado no se puede revisar.
  if (status === 'en_revision' && !order.assignedTo) {
    return res.status(400).json({ error: 'Asigná un técnico antes de iniciar la revisión.' })
  }
  // No se puede pasar de revisión a presupuesto sin registrar al menos una reparación.
  if (from === 'en_revision' && status === 'presupuesto' && !(order.fix || '').trim()) {
    return res.status(400).json({ error: 'Registrá al menos una reparación antes de pasar a presupuesto.' })
  }
  // No se puede entregar un equipo sin haber avisado al cliente.
  if (status === 'entregado' && !order.notified && !retiro) {
    return res.status(400).json({ error: 'Marcá primero al cliente como avisado antes de entregar el equipo.' })
  }
  if (['en_revision', 'en_reparacion', 'terminado', 'falta_repuestos'].includes(status) && !isTech) {
    return res.status(403).json({ error: 'Solo el técnico (o el admin) puede realizar esta acción.' })
  }
  if (status === 'presupuesto' && !['mostrador', 'admin', 'tecnico'].includes(role)) {
    return res.status(403).json({ error: 'Solo empleados o administradores pueden cargar el presupuesto.' })
  }
  if (status === 'entregado' && !isCounter) {
    return res.status(403).json({ error: 'Solo el mostrador (o el admin) puede entregar un equipo.' })
  }

  mutate((d) => {
    const o = d.orders.find((x) => x.id === req.params.id)
    const previous = o.status
    o.status = status
    o.history = o.history || []
    o.history.push({
      status,
      at: new Date().toISOString(),
      by: req.user.id,
      note:
        status === 'entregado' && retiro
          ? 'Cliente retiró el equipo'
          : status === 'entregado' && previous === 'presupuesto' && !retiro
            ? 'Cliente rechazó el presupuesto'
            : status === 'en_reparacion' && previous === 'entregado'
              ? 'Reingreso por garantía'
              : status === 'falta_repuestos'
                ? 'Esperando repuestos'
                : status === 'en_reparacion' && previous === 'falta_repuestos'
                  ? 'Repuestos recibidos'
                  : undefined,
    })
    if (['en_revision', 'en_reparacion', 'terminado', 'falta_repuestos'].includes(status)) o.repairedBy = req.user.id
    if (['presupuesto', 'terminado'].includes(status)) {
      o.notified = false
      o.notifiedAt = null
      o.notifiedBy = null
    }
    if (status === 'presupuesto') {
      o.confirmed = false
      o.confirmedAt = null
      o.confirmedBy = null
    }
    if (status === 'entregado' && !o.deliveredAt) {
      o.deliveredAt = todayISO()
      o.deliveredBy = req.user.id
    }
    audit(
      d,
      'status',
      'orders',
      o.id,
      req.user.id,
      `${o.orderNumber} · ${o.brand} ${o.model}: estado "${status}"`,
    )
  }).then(() => {
    res.json({ ok: true, order: decorateOrder(getDB(), order) })
  })
})

// ---------- Edición de notas / presupuesto del técnico ----------
app.put('/api/orders/:id', auth, (req, res) => {
  const db = getDB()
  const order = db.orders.find((o) => o.id === req.params.id)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  if (order.deletedAt) return res.status(400).json({ error: 'La orden está eliminada.' })
  const {
    brand, model, pin, pattern, accessories, conditions,
    technicianNotes, fix, price, issue, note,
  } = req.body || {}
  const role = req.user.role
  const isAssignedTech = role === 'tecnico' && order.assignedTo === req.user.id
  const isEmpOrAdmin = ['mostrador', 'admin'].includes(role)

  // Permisos por campo
  if (fix !== undefined && !isAssignedTech) {
    return res.status(403).json({ error: 'Solo el técnico encargado puede modificar el tipo de arreglo.' })
  }
  if (price !== undefined && !isEmpOrAdmin) {
    return res.status(403).json({ error: 'Solo empleados o administradores pueden cargar el presupuesto.' })
  }
  if (technicianNotes !== undefined && !isAssignedTech) {
    return res.status(403).json({ error: 'Solo el técnico encargado puede editar las notas.' })
  }
  if (note !== undefined && !isAssignedTech) {
    return res.status(403).json({ error: 'Solo el técnico encargado puede agregar notas.' })
  }
  const equipFields = [brand, model, pin, pattern, accessories, conditions]
  const touchesEquip = equipFields.some((v) => v !== undefined)
  if (touchesEquip && !isEmpOrAdmin) {
    return res.status(403).json({ error: 'Solo empleados o administradores pueden editar los detalles del equipo.' })
  }

  // Para órdenes a revisión, el tipo de arreglo no se puede definir hasta que
  // haya un técnico asignado y la orden esté en "en_revision".
  if (fix !== undefined && order.diagnosisType === 'revision' && !(order.fix || '').trim() && (!order.assignedTo || order.status !== 'en_revision')) {
    return res.status(400).json({ error: 'Asigná un técnico y pasá la orden a revisión antes de definir el arreglo.' })
  }

  const touched = touchesEquip || fix !== undefined || price !== undefined || technicianNotes !== undefined || note !== undefined || issue !== undefined
  mutate((d) => {
    const o = d.orders.find((x) => x.id === req.params.id)
    const budgetChanged =
      (fix !== undefined && normalizeList(String(fix)) !== normalizeList(String(o.fix || ''))) ||
      (price !== undefined && String(Math.max(0, Number(price) || 0)) !== String(o.price || 0))
    // Equipo
    if (brand !== undefined) o.brand = String(brand)
    if (model !== undefined) o.model = String(model)
    if (pin !== undefined) o.pin = String(pin)
    if (pattern !== undefined) o.pattern = Array.isArray(pattern) ? pattern : []
    if (accessories !== undefined) o.accessories = normalizeList(String(accessories))
    if (conditions !== undefined) o.conditions = normalizeList(String(conditions))
    // Reparación
    if (fix !== undefined) o.fix = normalizeList(String(fix))
    const prevPrice = o.price
    if (price !== undefined) o.price = Math.max(0, Number(price) || 0)
    if (issue !== undefined) o.issue = sentenceCase(String(issue))
    // Historial para cambios relevantes
    o.history = o.history || []
    if (price !== undefined && Number(o.price) !== Number(prevPrice || 0)) {
      o.history.push({ status: o.status, at: new Date().toISOString(), by: req.user.id, note: `Presupuesto: $${Number(price) || 0}` })
    }
    if (fix !== undefined) {
      o.history.push({ status: o.status, at: new Date().toISOString(), by: req.user.id, note: `Arreglo: ${normalizeList(String(fix)) || 'sin definir'}` })
    }
    // Notas del técnico (legacy)
    if (technicianNotes !== undefined) o.technicianNotes = sentenceCase(String(technicianNotes))
    // Notas vía note (append a notesLog)
    if (note !== undefined && String(note).trim()) {
      const entry = { id: uid(), at: new Date().toISOString(), by: req.user.id, byName: req.user.name || '—', text: sentenceCase(String(note).trim()) }
      o.notesLog = o.notesLog || []
      o.notesLog.push(entry)
      o.technicianNotes = entry.text
    }
    if (budgetChanged && o.status === 'presupuesto' && o.confirmed) {
      o.confirmed = false
      o.confirmedAt = null
      o.confirmedBy = null
    }
    if (touched) {
      audit(d, 'update', 'orders', o.id, req.user.id, `${o.orderNumber} · ${o.brand} ${o.model}: notas/presupuesto actualizados${budgetChanged && o.status === 'presupuesto' ? ' (confirmación desmarcada)' : ''}`)
    }
  }).then(() => res.json({ ok: true }))
})

// ---------- Asignación de técnico encargado ----------
app.post('/api/orders/:id/assign', auth, (req, res) => {
  const db = getDB()
  const order = db.orders.find((o) => o.id === req.params.id)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  if (order.deletedAt) return res.status(400).json({ error: 'La orden está eliminada.' })
  const canAssign = ['tecnico', 'admin', 'mostrador'].includes(req.user.role)
  if (!canAssign) {
    return res.status(403).json({ error: 'No tenés permiso para asignar un técnico.' })
  }
  const userId = req.body?.userId || null
  if (userId) {
    const tech = db.users.find(
      (u) => u.id === userId && u.active && u.role === 'tecnico',
    )
    if (!tech) return res.status(400).json({ error: 'Técnico no encontrado.' })
  }
  mutate((d) => {
    const o = d.orders.find((x) => x.id === req.params.id)
    o.assignedTo = userId
    const techName = userId ? (db.users.find((u) => u.id === userId)?.name || '—') : 'sin técnico'
    o.history = o.history || []
    o.history.push({ status: o.status, at: new Date().toISOString(), by: req.user.id, note: `Asignado a ${techName}` })
    audit(d, 'assign', 'orders', o.id, req.user.id, `${o.orderNumber} · asignado a ${userId || 'sin técnico'}`)
  }).then(() => res.json({ ok: true, order: decorateOrder(getDB(), order) }))
})

// ---------- Marcar / desmarcar "cliente avisado" ----------
app.post('/api/orders/:id/notified', auth, (req, res) => {
  const db = getDB()
  const order = db.orders.find((o) => o.id === req.params.id)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  if (order.deletedAt) return res.status(400).json({ error: 'La orden está eliminada.' })
  if (!['mostrador', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Solo los empleados pueden marcar al cliente como avisado.' })
  }
  const notified = !!req.body?.notified
  mutate((d) => {
    const o = d.orders.find((x) => x.id === req.params.id)
    o.notified = notified
    o.notifiedAt = notified ? new Date().toISOString() : null
    o.notifiedBy = notified ? req.user.id : null
    o.history = o.history || []
    o.history.push({ status: o.status, at: new Date().toISOString(), by: req.user.id, note: notified ? 'Avisado al cliente' : 'Desmarcado aviso al cliente' })
    audit(d, 'update', 'orders', o.id, req.user.id, `${o.orderNumber} · cliente ${notified ? 'marcado como avisado' : 'desmarcado como avisado'}`)
  }).then(() => res.json({ ok: true, order: decorateOrder(getDB(), order) }))
})

// ---------- Marcar / desmarcar confirmación del cliente ----------
app.post('/api/orders/:id/confirm', auth, (req, res) => {
  const db = getDB()
  const order = db.orders.find((o) => o.id === req.params.id)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  if (order.deletedAt) return res.status(400).json({ error: 'La orden está eliminada.' })
  if (!['mostrador', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Solo los empleados pueden confirmar el arreglo.' })
  }
  const confirmed = !!req.body?.confirmed
  if (confirmed && (!order.notified || Number(order.price) <= 0)) {
    return res.status(400).json({ error: 'Cargá el presupuesto y avisá al cliente antes de confirmar el arreglo.' })
  }
  mutate((d) => {
    const o = d.orders.find((x) => x.id === req.params.id)
    o.confirmed = confirmed
    o.confirmedAt = confirmed ? new Date().toISOString() : null
    o.confirmedBy = confirmed ? req.user.id : null
    o.history = o.history || []
    o.history.push({ status: o.status, at: new Date().toISOString(), by: req.user.id, note: confirmed ? 'Confirmado por el cliente' : 'Desconfirmado' })
    audit(d, 'update', 'orders', o.id, req.user.id, `${o.orderNumber} · arreglo ${confirmed ? 'confirmado por el cliente' : 'desmarcado como confirmado'}`)
  }).then(() => res.json({ ok: true, order: decorateOrder(getDB(), order) }))
})

// ---------- Etiqueta ZPL ----------
app.post('/api/orders/:id/label', auth, async (req, res) => {
  const db = getDB()
  const order = db.orders.find((o) => o.id === req.params.id)
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  const customer = db.customers.find((c) => c.id === order.customerId)
  const result = await printZplLabel({
    orderNumber: order.orderNumber,
    model: `${order.brand} ${order.model}`.trim(),
    customerName: customer?.fullName || '',
    date: formatDateLabel(todayISO()),
  })
  res.json({ ok: result.ok, error: result.error })
})

// ---------- Configuración (solo admin) ----------
app.get('/api/config', auth, adminOnly, (req, res) => {
  res.json({ config: getDB().config || {} })
})

app.post('/api/config', auth, adminOnly, (req, res) => {
  const { revisionFee } = req.body || {}
  mutate((d) => {
    d.config = d.config || {}
    if (revisionFee !== undefined) d.config.revisionFee = Math.max(0, Number(revisionFee) || 0)
    audit(d, 'update', 'config', null, req.user.id, 'Configuración actualizada')
  }).then(() => res.json({ ok: true }))
})

// ---------- Usuarios (solo admin) ----------
app.post('/api/users', auth, adminOnly, (req, res) => {
  const { name, email, password, role } = req.body || {}
  const db = getDB()
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

// ---------- Métricas para el admin ----------
app.get('/api/metrics', auth, adminOnly, (req, res) => {
  const db = getDB()
  const live = (o) => !o.deletedAt
  const orders = db.orders.filter(live)
  const today = todayISO()

  // Ingresos por período (suma del precio de entregadas).
  const inRange = (deliveredAt, fromISO, toISO) =>
    deliveredAt && deliveredAt >= fromISO && deliveredAt <= toISO
  const now = new Date()
  const startOfWeek = toISODate(new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7)))
  const startOfMonth = toISODate(new Date(now.getFullYear(), now.getMonth(), 1))
  const sumPrice = (list) => list.reduce((acc, o) => acc + (Number(o.price) || 0), 0)

  const income = {
    today: sumPrice(orders.filter((o) => o.deliveredAt === today)),
    week: sumPrice(orders.filter((o) => inRange(o.deliveredAt, startOfWeek, today))),
    month: sumPrice(orders.filter((o) => inRange(o.deliveredAt, startOfMonth, today))),
  }

  // Tiempo promedio de reparación (creación → entrega) por técnico.
  const techNames = new Map(db.users.map((u) => [u.id, u.name]))
  const byTech = new Map()
  for (const o of orders) {
    if (!o.deliveredAt || !o.repairedBy) continue
    const entry = byTech.get(o.repairedBy) || { totalDays: 0, count: 0 }
    entry.totalDays += Math.max(0, daysBetween(o.createdAt, o.deliveredAt))
    entry.count += 1
    byTech.set(o.repairedBy, entry)
  }
  const avgRepairDaysByTech = [...byTech.entries()]
    .map(([id, e]) => ({ technicianId: id, name: techNames.get(id) || '—', count: e.count, avgDays: e.count ? +(e.totalDays / e.count).toFixed(1) : 0 }))
    .sort((a, b) => b.count - a.count)

  // Entregadas por día (últimos 7 días).
  const deliveredByDay = []
  for (let i = 6; i >= 0; i -= 1) {
    const date = addDays(today, -i)
    deliveredByDay.push({ date, count: orders.filter((o) => o.deliveredAt === date).length })
  }

  // Marcas y modelos más reparados (top 5 por cantidad de órdenes vivas).
  const top = (key) => {
    const counts = new Map()
    for (const o of orders) {
      const v = o[key]
      if (!v) continue
      counts.set(v, (counts.get(v) || 0) + 1)
    }
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
      .slice(0, 5)
  }

  // Dispositivos recibidos por semana y por mes (cantidad de órdenes creadas).
  const devicesByPeriod = (() => {
    const receivedAt = (o) => o.createdAt
    const inPeriod = (list, fromISO, toISO) => list.filter((o) => receivedAt(o) >= fromISO && receivedAt(o) <= toISO)

    // Últimas 8 semanas (lunes a domingo).
    const weeks = []
    for (let i = 7; i >= 0; i -= 1) {
      const from = addDays(startOfWeek, -7 * i)
      const to = addDays(from, 6)
      weeks.push({ label: `${formatDateLabel(from)} - ${formatDateLabel(to)}`, count: inPeriod(orders, from, to).length })
    }

    // Últimos 6 meses (desde el 1° de cada mes).
    const months = []
    for (let i = 5; i >= 0; i -= 1) {
      const first = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const from = toISODate(first)
      const to = toISODate(new Date(first.getFullYear(), first.getMonth() + 1, 0))
      months.push({ label: from.slice(0, 7), count: inPeriod(orders, from, to).length })
    }

    return { weeks, months }
  })()

  return res.json({
    income,
    avgRepairDaysByTech,
    deliveredByDay,
    devicesByPeriod,
    topBrands: top('brand'),
    topModels: top('model'),
    totals: {
      deliveredMonth: orders.filter((o) => inRange(o.deliveredAt, startOfMonth, today)).length,
      activeOrders: orders.filter((o) => o.status !== 'entregado').length,
    },
  })
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

process.on('SIGINT', async () => {
  const { closeBrowser } = await import('./pdf/puppeteerPdf.js')
  await closeBrowser()
  process.exit(0)
})