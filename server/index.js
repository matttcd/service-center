// ============================================
// Servidor Express · El Gringo Celulares API
// Servidor de la API REST del servicio técnico
// Persistencia: PostgreSQL vía Prisma
// ============================================
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import './env.js'

import fs from 'node:fs'

const __file = fileURLToPath(import.meta.url)

import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

import { prisma, onDataChange, notifyChange } from './db.js'

import { todayISO, titleCase, uid, addDays, daysBetween, toISODate, sentenceCase, normalizeList } from './helpers.js'
import { printZplLabel } from './printer.js'
import { printPdfToBridge, listBridgePrinters } from './printer/pdf_bridge_client.js'
import { publicUser, usesDefaultPassword, isValidBackupName, createLoginLimiter, sessionVersion, passwordError } from './security.js'
import { ORDER_STATUSES, allowedTransitions } from '../shared/fsm.js'
import { buildOrderHtml } from './pdf/orderTemplate.js'
import { buildPickupHtml } from './pdf/pickupTemplate.js'
import { htmlToPdf } from './pdf/puppeteerPdf.js'
import { seedIfEmpty, DEFAULT_LISTS } from './seed.js'
import { backupKey } from './backup-crypto.js'
import { BACKUP_DIR, BACKUP_ENCRYPTION_KEY, createBackup, listBackups, restoreBackup, scheduleBackups, getBackupStatus, isRestoring } from './backups.js'
import { money, orderDateRange, unlockPattern } from './validation.js'
import { registerTrashRoutes } from './trash.js'
import { businessDate } from '../shared/dates.js'
import { orderRequest, previousOrderRequest } from './order-request.js'
import { logError } from './logging.js'





const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
export { app }
const PORT = process.env.PORT || 4000

// El secreto JWT no debe quedar hardcodeado en producción: se exige por env.
const NODE_ENV = process.env.NODE_ENV || 'development'
const JWT_SECRET = process.env.JWT_SECRET || (NODE_ENV === 'production' ? null : 'service-local-secret-2026')
if (!JWT_SECRET) {
  console.error('Falta la variable de entorno JWT_SECRET. Definila antes de iniciar el servidor.')
  process.exit(1)
}
if (NODE_ENV === 'production' && JWT_SECRET.length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres.')

const signSession = (user, mustChangePassword = false) => jwt.sign({
  id: user.id, version: sessionVersion(user, JWT_SECRET), mustChangePassword,
}, JWT_SECRET, { expiresIn: '12h', algorithm: 'HS256' })

// Límite de intentos de login por IP+cuenta (anti fuerza bruta).
const loginLimiter = createLoginLimiter({
  maxAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS || 5),
  windowMs: 15 * 60 * 1000,
})
const checkLoginLimit = (key) => loginLimiter.check(key)
const noteLoginFailure = (key) => loginLimiter.note(key)

// Evita que un error de un handler async deje la request colgada (Express 4 no
// captura promesas rechazadas): todo rechazo va al middleware de errores.
// No envuelve los handlers de error (4 argumentos) para no alterar su firma.
const asyncWrap = (fn) => (req, res, next) => {
  try {
    const result = fn(req, res, next)
    if (result && typeof result.then === 'function') result.catch(next)
  } catch (err) {
    next(err)
  }
}
for (const method of ['get', 'post', 'put', 'delete', 'patch', 'use']) {
  const original = app[method].bind(app)
  app[method] = (...args) => original(...args.map((a) => (typeof a === 'function' && a.length <= 3 ? asyncWrap(a) : a)))
}

// Detrás de nginx (contenedor), la IP real llega en X-Forwarded-For.
app.set('trust proxy', 1)

app.disable('x-powered-by')
app.use(cors({ origin: false }))
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Referrer-Policy', 'no-referrer')
  if (NODE_ENV === 'production') {
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'")
  }
  if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store')
  next()
})
app.use(express.json({ limit: '1mb' }))
app.use('/api', (req, res, next) => {
  if (isRestoring() && req.path !== '/health') return res.status(503).json({ error: 'Se está restaurando una copia. Esperá unos segundos y volvé a intentar.', code: 'MAINTENANCE' })
  next()
})

// Inicializa la base: si está vacía, aplica el seed (admin + catálogo).
app.get('/api/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    res.json({ status: 'ok', verification: process.env.VERIFICATION_INSTANCE || undefined })
  } catch {
    res.status(503).json({ status: 'unavailable' })
  }
})

// Helper: aplica una mutación y notifica a los clientes SSE.
// mutateFn recibe el cliente de Prisma/transacción a usar.
async function commit(mutateFn, { useTransaction = false } = {}) {
  const result = useTransaction
    ? await prisma.$transaction((tx) => mutateFn(tx))
    : await mutateFn(prisma)
  notifyChange()
  return result
}

// En transacciones, una auditoría fallida revierte también el cambio de negocio.
// Fuera de ellas, no se informa como fallida una operación ya persistida.
async function audit(action, table, recordId, userId, details, client = prisma) {
  try {
    await client.auditLog.create({
      data: { action, table, recordId, userId, details, timestamp: new Date() },
    })
  } catch (e) {
    if (client !== prisma) throw e
    logError('No se pudo registrar la auditoría:', e)
  }
}

// Campos seguros de un usuario para incrustar en respuestas (nunca el hash).
const userRef = { select: { id: true, name: true, email: true, role: true, active: true } }

// Mapea filas de la relación history/notes a los campos anidados que espera el front con JOINs directos.
const orderInclude = {
  customer: true,
  assigned: userRef,
  received: userRef,
  repaired: userRef,
  delivered: userRef,
  notifiedUser: userRef,
  confirmedUser: userRef,
  history: { orderBy: { at: 'asc' }, include: { user: userRef } },
  notes: { orderBy: { at: 'asc' } },
  spareParts: { orderBy: { at: 'asc' } },
}

// Adjunta a una orden datos legibles: cliente, responsables y estado (optimizado en memoria).
async function decorateOrder(order) {
  if (!order) return null
  let customerName = order.customer?.fullName
  let assignedToName = order.assigned?.name ?? null
  let receivedByName = order.received?.name ?? null
  let repairedByName = order.repaired?.name ?? null
  let deliveredByName = order.delivered?.name ?? null
  let notifiedByName = order.notifiedUser?.name ?? null
  let confirmedByName = order.confirmedUser?.name ?? null

  // Fallback si la orden vino sin includes (ej. en tests)
  if (!customerName && order.customerId) {
    const customer = await prisma.customer.findUnique({ where: { id: order.customerId } })
    customerName = customer ? customer.fullName : '(cliente eliminado)'
  } else if (!customerName) {
    customerName = '(cliente eliminado)'
  }

  const history = (order.history || []).map((h) => ({
    ...h,
    at: h.at instanceof Date ? h.at.toISOString() : h.at,
    byName: h.user?.name || h.byName || '—',
  }))

  return {
    ...order,
    id: order.id,
    customerName,
    assignedToName: order.assignedTo ? (assignedToName || '—') : null,
    receivedByName: receivedByName || '—',
    repairedByName: order.repairedBy ? (repairedByName || '—') : null,
    deliveredByName: order.deliveredBy ? (deliveredByName || '—') : null,
    notifiedByName: order.notifiedBy ? (notifiedByName || '—') : null,
    confirmedByName: order.confirmedBy ? (confirmedByName || '—') : null,
    history,
    notesLog: order.notes || [],
    sparePartsLog: order.spareParts || [],
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
app.get('/api/auth/profiles', async (req, res) => {
  try {
    const users = await prisma.user.findMany({ where: { active: true } })
    const profiles = users
      .map((u) => ({ id: u.id, name: u.name, role: u.role }))
      .sort((a, b) => a.name.localeCompare(b.name))
    res.json({ profiles })
  } catch {
    res.status(500).json({ error: 'Error del servidor.' })
  }
})

app.post('/api/auth/login', async (req, res) => {
  const { email, password, profileId } = req.body || {}
  if ((email !== undefined && (typeof email !== 'string' || email.length > 254)) || (profileId !== undefined && (typeof profileId !== 'string' || profileId.length > 128)) || typeof password !== 'string' || password.length > 1024) {
    return res.status(400).json({ error: 'Credenciales inválidas.' })
  }
  let user = null
  try {
    if (profileId) {
      user = await prisma.user.findUnique({ where: { id: profileId } })
    } else {
      user = await prisma.user.findFirst({
        where: { email: String(email || '').trim().toLowerCase() },
      })
    }
  } catch {
    return res.status(503).json({ error: 'La base de datos no está disponible. Intentá nuevamente en unos segundos.' })
  }
  const rateKey = `${req.ip}:${user?.id || String(profileId || email || '').trim().toLowerCase()}`
  if (checkLoginLimit(rateKey)) {
    return res.status(429).json({ error: 'Demasiados intentos fallidos. Probá de nuevo en unos minutos.' })
  }
  if (!user || !await bcrypt.compare(String(password || ''), user.password)) {
    noteLoginFailure(rateKey)
    return res.status(401).json({ error: 'Credenciales inválidas.' })
  }
  if (!user.active) {
    noteLoginFailure(rateKey)
    return res.status(403).json({ error: 'Usuario desactivado. Contactá al administrador.' })
  }
  loginLimiter.reset(rateKey)
  const mustChangePassword = usesDefaultPassword(user)
  const token = signSession(user, mustChangePassword)
  return res.json({ token, user: { ...publicUser(user), mustChangePassword } })
})

app.post('/api/auth/change-password', auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {}
  const user = await prisma.user.findUnique({ where: { id: req.user.id } })
  if (!user) return res.status(401).json({ error: 'No autorizado.' })
  if (!await bcrypt.compare(String(currentPassword || ''), user.password)) {
    return res.status(400).json({ error: 'La contraseña actual es incorrecta.' })
  }
  const validation = passwordError(newPassword)
  if (validation) return res.status(400).json({ error: validation })
  const hash = await bcrypt.hash(newPassword, 12)
  try {
    await commit(async () => {
      await prisma.user.update({ where: { id: req.user.id }, data: { password: hash } })
      await audit('password_change', 'users', req.user.id, req.user.id, `Cambio de contraseña (${req.user.name})`)
    })
    res.json({ ok: true, token: signSession({ ...user, password: hash }) })
  } catch {
    res.status(500).json({ error: 'Error al cambiar la contraseña.' })
  }
})

async function auth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : null
  if (!token) return res.status(401).json({ error: 'No autorizado.' })
  let payload
  try { payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) }
  catch { return res.status(401).json({ error: 'Sesión expirada.' }) }
  try {
    req.user = await prisma.user.findUnique({ where: { id: payload.id } })
    if (!req.user?.active || payload.version !== sessionVersion(req.user, JWT_SECRET)) {
      return res.status(401).json({ error: 'La sesión ya no es válida. Ingresá nuevamente.' })
    }
    if (payload.mustChangePassword && req.path !== '/api/auth/change-password') {
      return res.status(403).json({ error: 'Cambiá la contraseña inicial para continuar.', code: 'PASSWORD_CHANGE_REQUIRED' })
    }
    next()
  } catch {
    return res.status(503).json({ error: 'La base de datos no está disponible. Intentá nuevamente en unos segundos.' })
  }
}

function adminOnly(req, res, next) {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso restringido al administrador.' })
  }
  next()
}

// ---------- Tiempo real: canal de eventos (SSE) ----------
const eventClients = new Set()

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

onDataChange(() => broadcast('data-changed'))

app.get('/api/events', async (req, res) => {
  const token = req.query.token
  if (!token) return res.status(401).json({ error: 'No autorizado.' })
  let user = null
  try {
    const payload = jwt.verify(String(token), JWT_SECRET, { algorithms: ['HS256'] })
    user = await prisma.user.findUnique({ where: { id: payload.id } })
    if (user && (payload.version !== sessionVersion(user, JWT_SECRET) || payload.mustChangePassword)) user = null
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
app.get('/api/bootstrap', auth, async (req, res) => {
  try {
    const isTech = req.user.role === 'tecnico'
    const activeWhere = {
      deletedAt: null,
      status: { not: 'entregado' },
      ...(isTech
        ? {
            isSimpleService: false,
            NOT: [
              { status: 'en_tercero' },
              { isExternal: true, status: 'recibido' },
            ],
          }
        : {}),
    }

    const [customers, activeOrders, totalCount, deliveredCount, catalog, users, config] = await Promise.all([
      prisma.customer.findMany({ where: { deletedAt: null } }),
      prisma.order.findMany({
        where: activeWhere,
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.order.count({ where: { deletedAt: null } }),
      prisma.order.count({ where: { deletedAt: null, status: 'entregado' } }),
      loadCatalog(),
      prisma.user.findMany(),
      loadConfigValue('main'),
    ])

    const decorated = []
    for (const o of activeOrders) decorated.push(await decorateOrder(o))
    const technicians = users.filter((u) => u.active && u.role === 'tecnico')

    return res.json({
      user: publicUser(req.user),
      customers,
      orders: decorated,
      ordersTotals: {
        total: totalCount,
        active: activeOrders.length,
        delivered: deliveredCount,
      },
      catalog,
      users: req.user.role === 'admin' ? users.map(publicUser) : [],
      technicians: technicians.map(publicUser),
      config: {
        revisionFee: config?.revisionFee ?? 0,
        ...(req.user.role === 'admin' ? { whatsapp: { ...(config?.whatsapp || {}), apiToken: undefined } } : {}),
      },
    })
  } catch (e) {
    logError('Error en bootstrap:', e)
    res.status(500).json({ error: 'Error del servidor.' })
  }
})

// ---------- Catálogo de marcas y modelos ----------
// deviceType opcional: si viene, filtra marcas y modelos a ese tipo de dispositivo.
async function loadCatalog(deviceType) {
  const type = deviceType && deviceType !== 'Otro' ? String(deviceType).trim() : null
  const [brands, models, accessories, conditions, fixes, config] = await Promise.all([
    type ? prisma.catalogModel.findMany({ where: { deviceType: type }, distinct: ['brand'] })
           .then((rows) => prisma.catalogBrand.findMany({ where: { name: { in: rows.map((r) => r.brand) } } }))
         : prisma.catalogBrand.findMany(),
    type ? prisma.catalogModel.findMany({ where: { deviceType: type } })
         : prisma.catalogModel.findMany(),
    prisma.catalogAccessory.findMany(),
    prisma.catalogCondition.findMany(),
    prisma.catalogFix.findMany(),
    loadConfigValue('main'),
  ])
  const terms = config?.terms ? config.terms : DEFAULT_LISTS.terms
  const externalTechnicians = config?.externalTechnicians ?? DEFAULT_LISTS.externalTechnicians
  return {
    brands: [...brands].sort((a, b) => b.usage - a.usage || a.name.localeCompare(b.name)),
    models: [...models].sort((a, b) => b.usage - a.usage || a.name.localeCompare(b.name)),
    accessories: accessories.map((a) => a.name),
    conditions: conditions.map((c) => c.name),
    fixes: [...fixes].sort((a, b) => b.usage - a.usage || a.name.localeCompare(b.name)).map((f) => f.name),
    terms,
    externalTechnicians,
  }
}

app.get('/api/catalog', auth, async (req, res) => {
  try {
    const catalog = await loadCatalog(req.query.deviceType)
    res.json({ brands: catalog.brands, models: catalog.models })
  } catch (e) {
    logError('Error en /api/catalog:', e)
    res.status(500).json({ error: 'Error del servidor.' })
  }
})

app.post('/api/catalog/brands', auth, async (req, res) => {
  const name = titleCase(String(req.body?.name || '').trim())
  if (!name) return res.status(400).json({ error: 'El nombre de la marca es obligatorio.' })
  try {
    const brand = await commit(() => prisma.catalogBrand.upsert({
      where: { name },
      update: {},
      create: { name },
    }))
    res.json({ ok: true, brand })
  } catch {
    res.status(500).json({ error: 'Error al crear la marca.' })
  }
})

app.post('/api/catalog/models', auth, async (req, res) => {
  const brand = titleCase(String(req.body?.brand || '').trim())
  const name = titleCase(String(req.body?.name || '').trim())
  const deviceType = String(req.body?.deviceType || 'Celular').trim()
  if (!brand || !name) return res.status(400).json({ error: 'La marca y el modelo son obligatorios.' })
  try {
    const model = await commit(async () => {
      await prisma.catalogBrand.upsert({ where: { name: brand }, update: {}, create: { name: brand } })
      return prisma.catalogModel.upsert({
        where: { brand_name_deviceType: { brand, name, deviceType } },
        update: { deviceType },
        create: { brand, name, deviceType },
      })
    })
    res.json({ ok: true, model })
  } catch {
    res.status(500).json({ error: 'Error al crear el modelo.' })
  }
})

app.post('/api/catalog/models/bulk', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo los administradores pueden importar modelos.' })
  const items = req.body?.models
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Se esperaba un array "models" con al menos un elemento.' })
  }
  if (items.length > 5000) {
    return res.status(400).json({ error: 'Máximo 5000 modelos por importación.' })
  }
  try {
    const result = await commit(async () => {
      let created = 0
      let skipped = 0
      for (const item of items) {
        const brand = titleCase(String(item?.brand || '').trim())
        const name = titleCase(String(item?.name || '').trim())
        const deviceType = String(item?.deviceType || 'Celular').trim()
        if (!brand || !name) { skipped++; continue }
        await prisma.catalogBrand.upsert({ where: { name: brand }, update: {}, create: { name: brand } })
        const exists = await prisma.catalogModel.findUnique({ where: { brand_name_deviceType: { brand, name, deviceType } } })
        if (exists) { skipped++; continue }
        await prisma.catalogModel.create({ data: { brand, name, deviceType } })
        created++
      }
      const total = await prisma.catalogModel.count()
      return { created, skipped, total }
    })
    res.json({ ok: true, ...result })
  } catch {
    res.status(500).json({ error: 'Error al importar modelos.' })
  }
})

async function loadConfigValue(key, client = prisma) {
  const row = await client.config.findUnique({ where: { key } })
  return row ? row.value : null
}

app.get('/api/catalog/lists', auth, async (req, res) => {
  const catalog = await loadCatalog()
  res.json({
    accessories: catalog.accessories,
    conditions: catalog.conditions,
    fixes: catalog.fixes,
    terms: catalog.terms,
    externalTechnicians: catalog.externalTechnicians,
  })
})

app.put('/api/catalog/lists', auth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Solo los administradores pueden editar las listas.' })
  const body = req.body || {}
  const normalize = (v) =>
    Array.isArray(v)
      ? [...new Set(v.map((s) => titleCase(String(s).trim())).filter(Boolean))]
      : undefined
  const normalizeTerms = (v) =>
    Array.isArray(v)
      ? v.map((s) => String(s).trim()).filter(Boolean)
      : undefined
  const accessories = normalize(body.accessories)
  const conditions = normalize(body.conditions)
  const fixes = normalize(body.fixes)
  const terms = normalizeTerms(body.terms)
  const externalTechnicians = Array.isArray(body.externalTechnicians)
    ? body.externalTechnicians.map((s) => titleCase(String(s).trim())).filter(Boolean)
    : undefined
  if (accessories === undefined && conditions === undefined && fixes === undefined && terms === undefined && externalTechnicians === undefined) {
    return res.status(400).json({ error: 'No se envió ninguna lista para actualizar.' })
  }
  const MAX_TERMS_CHARS = 1600
  if (terms !== undefined && terms.join('').length > MAX_TERMS_CHARS) {
    return res.status(400).json({ error: `Los términos no pueden superar ${MAX_TERMS_CHARS} caracteres en total.` })
  }
  try {
    await commit(async (db) => {
      if (accessories !== undefined) {
        await db.catalogAccessory.deleteMany()
        await db.catalogAccessory.createMany({ data: accessories.map((name) => ({ name })) })
      }
      if (conditions !== undefined) {
        await db.catalogCondition.deleteMany()
        await db.catalogCondition.createMany({ data: conditions.map((name) => ({ name })) })
      }
      if (fixes !== undefined) {
        await db.catalogFix.deleteMany()
        await db.catalogFix.createMany({ data: fixes.map((name) => ({ name })) })
      }
      if (terms !== undefined) {
        const current = (await loadConfigValue('main', db)) || {}
        await upsertConfig('main', { ...current, terms }, db)
      }
      if (externalTechnicians !== undefined) {
        const current = (await loadConfigValue('main', db)) || {}
        await upsertConfig('main', { ...current, externalTechnicians }, db)
      }
    }, { useTransaction: true })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'No se pudo guardar las listas.' })
  }
})

async function upsertConfig(key, value, client = prisma) {
  return client.config.upsert({ where: { key }, update: { value }, create: { key, value } })
}

// Cuenta una marca/modelo en el catálogo (y los crea si faltan).
async function bumpCatalog(db, brand, model, deviceType = 'Celular') {
  await db.catalogBrand.upsert({
    where: { name: brand },
    update: { usage: { increment: 1 } },
    create: { name: brand, usage: 1 },
  })
  const existingModel = await db.catalogModel.findUnique({ where: { brand_name_deviceType: { brand, name: model, deviceType } } })
  if (existingModel) {
    await db.catalogModel.update({ where: { id: existingModel.id }, data: { usage: { increment: 1 } } })
  } else {
    await db.catalogModel.create({ data: { brand, name: model, deviceType, usage: 1 } })
  }
}

// Incrementa usage de cada fix en el catálogo.
async function bumpFixUsage(db, fixString) {
  if (!fixString) return
  const names = String(fixString).split(',').map((s) => s.trim()).filter(Boolean)
  for (const name of names) {
    await db.catalogFix.upsert({
      where: { name },
      update: { usage: { increment: 1 } },
      create: { name, usage: 1 },
    })
  }
}

// ---------- Clientes ----------
app.post('/api/customers', auth, async (req, res) => {
  const { fullName, dni, phone, phone2, phone3, email, address } = req.body || {}
  if (!fullName || !fullName.trim()) {
    return res.status(400).json({ error: 'El nombre completo es obligatorio.' })
  }
  const dniNorm = String(dni || '').trim()
  if (dniNorm && !/^\d{6,8}$/.test(dniNorm)) {
    return res.status(400).json({ error: 'El DNI debe tener entre 6 y 8 dígitos.' })
  }
  if (dniNorm) {
    const dup = await prisma.customer.findFirst({ where: { deletedAt: null, dni: dniNorm } })
    if (dup) {
      return res.status(400).json({ error: `Ya existe un cliente con el DNI ${dniNorm}.` })
    }
  }
  const id = uid()
  try {
    await commit(async () => {
      await prisma.customer.create({
        data: {
          id,
          fullName: titleCase(fullName),
          dni: dniNorm,
          phone: String(phone || ''),
          phone2: String(phone2 || ''),
          phone3: String(phone3 || ''),
          email: String(email || '').trim().toLowerCase(),
          address: titleCase(address),
          createdAt: new Date(),
        },
      })
      await audit('create', 'customers', id, req.user.id, `Alta de cliente ${titleCase(fullName)}${dniNorm ? ` (DNI ${dniNorm})` : ''}`)
    })
    res.json({ ok: true, id })
  } catch {
    res.status(500).json({ error: 'Error al crear el cliente.' })
  }
})

app.put('/api/customers/:id', auth, async (req, res) => {
  const target = await prisma.customer.findUnique({ where: { id: req.params.id } })
  if (!target) return res.status(404).json({ error: 'Cliente no encontrado.' })
  const { fullName, dni, phone, phone2, phone3, email, address } = req.body || {}
  if (!fullName || !fullName.trim()) {
    return res.status(400).json({ error: 'El nombre completo es obligatorio.' })
  }
  const dniNorm = String(dni || '').trim()
  if (dniNorm && !/^\d{6,8}$/.test(dniNorm)) {
    return res.status(400).json({ error: 'El DNI debe tener entre 6 y 8 dígitos.' })
  }
  if (dniNorm) {
    const dup = await prisma.customer.findFirst({ where: { deletedAt: null, dni: dniNorm, id: { not: req.params.id } } })
    if (dup) {
      return res.status(400).json({ error: `Ya existe un cliente con el DNI ${dniNorm}.` })
    }
  }
  try {
    await commit(async () => {
      await prisma.customer.update({
        where: { id: req.params.id },
        data: {
          fullName: titleCase(fullName),
          dni: dniNorm,
          phone: String(phone || ''),
          phone2: String(phone2 || ''),
          phone3: String(phone3 || ''),
          email: String(email || '').trim().toLowerCase(),
          address: titleCase(address),
        },
      })
      await audit('update', 'customers', req.params.id, req.user.id, `Edición de cliente ${titleCase(fullName)}`)
    })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error al actualizar el cliente.' })
  }
})

app.delete('/api/customers/:id', auth, adminOnly, async (req, res) => {
  const target = await prisma.customer.findUnique({ where: { id: req.params.id } })
  if (!target) return res.status(404).json({ error: 'Cliente no encontrado.' })
  if (target.deletedAt) return res.status(400).json({ error: 'El cliente ya está eliminado.' })
  try {
    const now = new Date()
    await commit(async (db) => {
      await db.order.updateMany({ where: { customerId: req.params.id, deletedAt: null }, data: { deletedAt: now } })
      await db.customer.update({ where: { id: req.params.id }, data: { deletedAt: now } })
      await audit('delete', 'customers', req.params.id, req.user.id, `Baja de cliente ${target.fullName}`, db)
    }, { useTransaction: true })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error al eliminar el cliente.' })
  }
})

// ---------- Órdenes ----------
app.post('/api/orders', auth, async (req, res) => {
  if (!['recepcion', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Solo recepción o administradores pueden crear órdenes.' })
  }
  const body = req.body || {}
  const request = orderRequest(body, req.user.id)
  const customer = await prisma.customer.findUnique({ where: { id: body.customerId } })
  if (!customer || customer.deletedAt) {
    return res.status(400).json({ error: 'Cliente inexistente o eliminado.' })
  }
  const brand = titleCase(String(body.brand || '').trim())
  const model = titleCase(String(body.model || '').trim())
  if (!brand) return res.status(400).json({ error: 'Elegí la marca del dispositivo.' })
  if (!model) return res.status(400).json({ error: 'Elegí el modelo del dispositivo.' })
  const deviceType = String(body.deviceType || 'Celular').trim().slice(0, 80)
  const diagnosisType = body.diagnosisType === 'revision' ? 'revision' : 'visible'
  const isSimpleService = !!body.isSimpleService
  const isExternal = !!body.isExternal
  const externalTech = isExternal ? titleCase(String(body.externalTech || '').trim()) : ''
  const price = money(body.price, 'El presupuesto')
  const advance = money(body.advance, 'La seña')
  const storedPattern = body.noPin ? [] : unlockPattern(body.pattern)

  try {
    const order = await commit(async (db) => {
      const existing = await previousOrderRequest(db, request, orderInclude)
      if (existing) return existing
      const counter = await db.orderCounter.upsert({
        where: { key: 'order' },
        update: { value: { increment: 1 } },
        create: { key: 'order', value: 1 },
      })
      const orderNumber = `OS${pad4(counter.value)}`
      const created = await db.order.create({
        data: {
          orderNumber,
          customerId: body.customerId,
          deviceType,
          brand,
          model,
          accessories: normalizeList(String(body.accessories || '')),
          conditions: normalizeList(String(body.conditions || '')),
          pin: body.noPin ? '' : String(body.pin || ''),
          noPin: !!body.noPin,
          pattern: storedPattern,
          diagnosisType,
          isSimpleService,
          isExternal,
          externalTech,
          issue: sentenceCase(String(body.issue || '')),
          fix: normalizeList(String(body.fix || '')),
          price,
          advance,
          status: 'recibido',
          receivedBy: req.user.id,
          createdAt: new Date(),
          history: {
            create: { status: 'recibido', by: req.user.id, at: new Date() },
          },
        },
        include: orderInclude,
      })
      await bumpCatalog(db, brand, model, deviceType)
      await bumpFixUsage(db, body.fix)
      if (request) await db.config.create({ data: { key: request.key, value: { userId: request.userId, hash: request.hash, orderId: created.id } } })
      await audit(
        'create',
        'orders',
        created.id,
        req.user.id,
        `Orden ${orderNumber} · ${brand} ${model} de ${customer.fullName}${diagnosisType === 'revision' ? ' (a revisión)' : ''}`,
        db,
      )
      return created
    }, { useTransaction: true })
    res.json({ ok: true, order: await decorateOrder(order) })
  } catch (e) {
    if (request && e.code === 'P2002') {
      const existing = await previousOrderRequest(prisma, request, orderInclude)
      if (existing) return res.json({ ok: true, order: await decorateOrder(existing) })
    }
    logError('Error creando orden:', e)
    res.status(e.status || 500).json({ error: e.status ? e.message : 'Error al crear la orden.' })
  }
})

app.get('/api/orders', auth, async (req, res) => {
  const { status, q, from, to, brand, deviceType, customerId, onlyNotNotified, onlyNotified, onlyNotConfirmed } = req.query
  const query = String(q || '').trim().toLowerCase()
  const limit = Math.max(1, Math.min(1000, Math.floor(Number(req.query.limit) || 50)))
  const offset = Math.max(0, Math.floor(Number(req.query.offset) || 0))

  const where = { deletedAt: null }
  if (customerId) where.customerId = String(customerId)
  if (status && status !== 'all') where.status = status
  if (brand && brand !== 'all') where.brand = brand
  if (deviceType && deviceType !== 'all') where.deviceType = deviceType
  if (from || to) where.createdAt = orderDateRange(from, to)
  if (onlyNotNotified === '1') {
    where.notified = false
    if (!status || status === 'all') where.status = { in: ['presupuesto', 'terminado'] }
  }
  if (onlyNotified === '1') {
    where.notified = true
    if (!status || status === 'all') where.status = { in: ['presupuesto', 'terminado'] }
  }
  if (onlyNotConfirmed === '1') {
    where.confirmed = false
    where.status = 'presupuesto'
  }

  if (query) {
    where.OR = [
      { orderNumber: { contains: query, mode: 'insensitive' } },
      { brand: { contains: query, mode: 'insensitive' } },
      { model: { contains: query, mode: 'insensitive' } },
      { customer: { fullName: { contains: query, mode: 'insensitive' } } },
    ]
  }

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      include: orderInclude,
      orderBy: { createdAt: 'desc' },
      skip: offset,
      ...(limit ? { take: limit } : {}),
    }),
  ])

  const list = []
  for (const o of orders) list.push(await decorateOrder(o))
  res.json({ orders: list, total })
})

app.get('/api/orders/:id', auth, async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude })
  if (!order || order.deletedAt) return res.status(404).json({ error: 'Orden no encontrada.' })
  res.json({ order: await decorateOrder(order) })
})

async function enrichOrderHtml(orderId) {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: orderInclude })
  if (!order || order.deletedAt) return null
  const [customer, config] = await Promise.all([
    prisma.customer.findUnique({ where: { id: order.customerId } }),
    loadConfigValue('main'),
  ])
  const users = await prisma.user.findMany({ where: { id: { in: [order.receivedBy, order.assignedTo].filter(Boolean) } } })
  const names = new Map(users.map((u) => [u.id, u.name]))
  const enriched = {
    ...order,
    receivedByName: order.receivedBy ? names.get(order.receivedBy) || '—' : '—',
  }
  return { order: enriched, customer, terms: config?.terms }
}

app.get('/api/orders/:id/pdf', auth, async (req, res) => {
  try {
    const data = await enrichOrderHtml(req.params.id)
    if (!data) return res.status(404).json({ error: 'Orden no encontrada.' })
    const html = buildOrderHtml(data.order, data.customer, data.terms)
    const pdfBuffer = await htmlToPdf(html)
    res.type('application/pdf')
    res.set('Content-Disposition', `inline; filename="orden-${data.order.orderNumber}.pdf"`)
    res.send(pdfBuffer)
  } catch (err) {
    logError('Error generando PDF:', err)
    res.status(500).json({ error: 'No se pudo generar el PDF.' })
  }
})

app.get('/api/printers', auth, async (req, res) => {
  try {
    const result = await listBridgePrinters()
    if (!result.ok) return res.status(502).json({ printers: [], error: result.error })
    res.json({ printers: result.printers })
  } catch (err) {
    logError('Error listando impresoras:', err)
    res.status(500).json({ printers: [], error: 'No se pudo obtener la lista de impresoras.' })
  }
})

app.post('/api/orders/:id/print', auth, async (req, res) => {
  try {
    const data = await enrichOrderHtml(req.params.id)
    if (!data) return res.status(404).json({ error: 'Orden no encontrada.' })
    const html = buildOrderHtml(data.order, data.customer, data.terms)
    const pdfBuffer = await htmlToPdf(html)
    const printer = (req.body && req.body.printer) || null
    const result = await printPdfToBridge(pdfBuffer, printer)
    if (!result.ok) return res.status(502).json({ error: result.error || 'Error de impresión.' })
    res.json({ ok: true })
  } catch (err) {
    logError('Error imprimiendo orden:', err)
    res.status(500).json({ error: 'No se pudo imprimir la orden.' })
  }
})

app.post('/api/orders/:id/pickup', auth, async (req, res) => {
  if (!['recepcion', 'admin'].includes(req.user.role)) return res.status(403).json({ error: 'Solo recepción o administradores pueden registrar el retiro.' })
  const order = await prisma.order.findUnique({ where: { id: req.params.id } })
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
  try {
    await commit(() => prisma.order.update({
      where: { id: req.params.id },
      data: {
        pickupBy,
        pickupName: pickupBy === 'third' ? pickupName.trim() : '',
        pickupDni: pickupBy === 'third' ? pickupDni.trim() : '',
      },
    }))
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error al guardar datos de retiro.' })
  }
})

app.get('/api/orders/:id/pickup-pdf', auth, async (req, res) => {
  try {
    const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude })
    if (!order || order.deletedAt) return res.status(404).json({ error: 'Orden no encontrada.' })
    const customer = await prisma.customer.findUnique({ where: { id: order.customerId } })
    const users = await prisma.user.findMany({ where: { id: { in: [order.receivedBy].filter(Boolean) } } })
    const names = new Map(users.map((u) => [u.id, u.name]))
    const orderWithName = { ...order, receivedByName: names.get(order.receivedBy) || '—' }
    const pickup = { pickupBy: order.pickupBy, pickupName: order.pickupName, pickupDni: order.pickupDni }
    const html = buildPickupHtml(orderWithName, customer, pickup)
    const pdfBuffer = await htmlToPdf(html)
    res.type('application/pdf')
    res.set('Content-Disposition', `inline; filename="retiro-${order.orderNumber}.pdf"`)
    res.send(pdfBuffer)
  } catch (err) {
    logError('Error generando PDF de retiro:', err)
    res.status(500).json({ error: 'No se pudo generar el PDF de retiro.' })
  }
})

app.delete('/api/orders/:id', auth, adminOnly, async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } })
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  if (order.deletedAt) return res.status(400).json({ error: 'La orden ya está eliminada.' })
  try {
    await commit(async () => {
      await prisma.order.update({ where: { id: req.params.id }, data: { deletedAt: new Date() } })
      await audit('delete', 'orders', order.id, req.user.id, `Baja de orden ${order.orderNumber}`)
    })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error al eliminar la orden.' })
  }
})

// ---------- Estado de una orden ----------
app.post('/api/orders/:id/status', auth, async (req, res) => {
  const { status, retiro, assignedTo, externalTech, pickup } = req.body || {}
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude })
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  if (order.deletedAt) return res.status(400).json({ error: 'La orden está eliminada.' })
  if (!ORDER_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'Estado inválido.' })
  }

  const from = order.status
  const role = req.user.role
  const isTech = ['tecnico', 'admin'].includes(role)
  const isCounter = ['recepcion', 'admin'].includes(role)
  if (pickup !== undefined) {
    if (status !== 'entregado' || !isCounter) return res.status(403).json({ error: 'Solo recepción puede registrar una entrega.' })
    if (!['client', 'third'].includes(pickup?.pickupBy)) return res.status(400).json({ error: 'Indicá quién retira el equipo.' })
    if (pickup.pickupBy === 'third' && (!String(pickup.pickupName || '').trim() || !/^\d{6,8}$/.test(String(pickup.pickupDni || '').trim()))) {
      return res.status(400).json({ error: 'Ingresá el nombre y un DNI válido de quien retira.' })
    }
  }

  // Se puede asignar el técnico junto con la transición (asignación diferida).
  if (assignedTo !== undefined) {
    const canAssign = ['tecnico', 'admin', 'recepcion'].includes(role)
    if (!canAssign) return res.status(403).json({ error: 'No tenés permiso para asignar un técnico.' })
    if (assignedTo) {
      const tech = await prisma.user.findFirst({ where: { id: assignedTo, active: true, role: 'tecnico' } })
      if (!tech) return res.status(400).json({ error: 'Técnico no encontrado.' })
    }
    order.assignedTo = assignedTo
  }

  const allowed = allowedTransitions(order).includes(status)
  if (!allowed) {
    return res.status(400).json({ error: `No se puede pasar de "${from}" a "${status}".` })
  }
  if (from === 'presupuesto' && status === 'en_reparacion' && !order.confirmed) {
    return res.status(400).json({ error: 'El cliente debe confirmar el arreglo antes de reparar.' })
  }
  if (status === 'en_reparacion' && !order.assignedTo) {
    return res.status(400).json({ error: 'Asigná un técnico antes de iniciar la reparación.' })
  }
  if (status === 'en_revision' && !order.assignedTo) {
    return res.status(400).json({ error: 'Asigná un técnico antes de iniciar la revisión.' })
  }
  if (from === 'en_revision' && status === 'presupuesto' && !(order.fix || '').trim()) {
    return res.status(400).json({ error: 'Registrá al menos una reparación antes de pasar a presupuesto.' })
  }
  if (status === 'entregado' && !order.notified && !retiro) {
    return res.status(400).json({ error: 'Marcá primero al cliente como avisado antes de entregar el equipo.' })
  }
  if (status === 'en_tercero' && !isCounter) {
    return res.status(403).json({ error: 'Solo recepción (o el admin) puede enviar a técnico externo.' })
  }
  if (status === 'en_tercero' && (typeof externalTech !== 'string' || !externalTech.trim())) {
    return res.status(400).json({ error: 'Seleccioná el técnico externo.' })
  }
  if (from === 'en_tercero' && !isCounter) {
    return res.status(403).json({ error: 'Solo recepción (o el admin) puede recibir de técnico externo.' })
  }
  if (from !== 'en_tercero' && ['en_revision', 'en_reparacion', 'terminado', 'falta_repuestos'].includes(status) && !isTech && !(status === 'terminado' && order.isSimpleService)) {
    return res.status(403).json({ error: 'Solo el técnico (o el admin) puede realizar esta acción.' })
  }
  if (status === 'presupuesto' && !['recepcion', 'admin', 'tecnico'].includes(role)) {
    return res.status(403).json({ error: 'Solo recepción o administradores pueden cargar el presupuesto.' })
  }
  if (status === 'entregado' && !isCounter) {
    return res.status(403).json({ error: 'Solo recepción (o el admin) puede entregar un equipo.' })
  }
  if (status === 'recibido' && from === 'entregado' && !isCounter) {
    return res.status(403).json({ error: 'Solo recepción (o el admin) puede recibir un reingreso por garantía.' })
  }

  try {
    const updated = await commit(async (db) => {
      // Reserva la versión leída para evitar dos transiciones simultáneas.
      const locked = await db.order.updateMany({ where: { id: order.id, status: from, deletedAt: null }, data: { status } })
      if (!locked.count) throw Object.assign(new Error('La orden cambió en otro equipo. Actualizá e intentá nuevamente.'), { status: 409 })
      const previous = order.status
      let note
      if (status === 'entregado' && retiro) note = 'Cliente retiró el equipo'
      else if (status === 'entregado' && previous === 'presupuesto' && !retiro) note = 'Cliente rechazó el presupuesto'
      else if (status === 'recibido' && previous === 'entregado') note = 'Reingreso por garantía'
      else if (status === 'falta_repuestos') note = 'Esperando repuestos'
      else if (status === 'en_reparacion' && previous === 'falta_repuestos') note = 'Repuestos recibidos'
      else if (status === 'en_tercero') note = `Enviado a técnico externo: ${externalTech}`
      else if (from === 'en_tercero') note = `Equipo devuelto por ${order.externalTech || 'técnico externo'}`
      else if (assignedTo !== undefined) {
        const t = assignedTo ? await prisma.user.findUnique({ where: { id: assignedTo } }) : null
        note = `Asignado a ${assignedTo ? (t?.name || '—') : 'sin técnico'}`
      }

      const data = {
        status,
        ...(assignedTo !== undefined ? { assignedTo: assignedTo || null } : {}),
        ...(status === 'recibido' && previous === 'entregado' ? {
          warrantyReturn: true, deliveredAt: null, deliveredBy: null,
          pickupBy: '', pickupName: '', pickupDni: '',
          notified: false, notifiedAt: null, notifiedBy: null,
          confirmed: false, confirmedAt: null, confirmedBy: null,
        } : {}),
        ...(status === 'entregado' ? { warrantyReturn: false } : {}),
        ...(status === 'en_tercero' ? { externalTech, externalSentAt: new Date() } : {}),
        ...(from === 'en_tercero' ? { externalReturnAt: new Date(), isExternal: false } : {}),
        ...(from !== 'en_tercero' && ['en_revision', 'en_reparacion', 'terminado', 'falta_repuestos'].includes(status) ? { repairedBy: req.user.id } : {}),
        ...(['presupuesto', 'terminado'].includes(status) ? { notified: false, notifiedAt: null, notifiedBy: null } : {}),
        ...(status === 'presupuesto' ? { confirmed: false, confirmedAt: null, confirmedBy: null } : {}),
        ...(status === 'entregado' ? { deliveredAt: new Date(), deliveredBy: req.user.id } : {}),
        ...(pickup ? {
          pickupBy: pickup.pickupBy,
          pickupName: pickup.pickupBy === 'third' ? String(pickup.pickupName).trim() : '',
          pickupDni: pickup.pickupBy === 'third' ? String(pickup.pickupDni).trim() : '',
        } : {}),
      }
      await db.order.update({
        where: { id: req.params.id },
        data: {
          ...data,
          history: { create: { status, at: new Date(), by: req.user.id, note: note || '' } },
        },
      })
      await audit(
        'status',
        'orders',
        order.id,
        req.user.id,
        `${order.orderNumber} · ${order.brand} ${order.model}: estado "${status}"`,
        db,
      )
      return db.order.findUnique({ where: { id: req.params.id }, include: orderInclude })
    }, { useTransaction: true })
    res.json({ ok: true, order: await decorateOrder(updated) })
  } catch (e) {
    logError('Error en cambio de estado:', e)
    res.status(e.status || 500).json({ error: e.status ? e.message : 'Error al cambiar el estado.' })
  }
})

// ---------- Edición de notas / presupuesto del técnico ----------
app.put('/api/orders/:id', auth, async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude })
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  if (order.deletedAt) return res.status(400).json({ error: 'La orden está eliminada.' })
  const {
    deviceType, brand, model, pin, noPin, pattern, accessories, conditions,
    technicianNotes, fix, price, issue, note, editNote, deleteNote, isSimpleService,
    addSparePart, editSparePart, deleteSparePart,
  } = req.body || {}
  const role = req.user.role
  const isAssignedTech = (role === 'tecnico' && order.assignedTo === req.user.id) || role === 'admin'
  const isEmpOrAdmin = ['recepcion', 'admin'].includes(role)
  if (price !== undefined) money(price, 'El presupuesto')

  if (fix !== undefined && !isAssignedTech) {
    return res.status(403).json({ error: 'Solo el técnico encargado puede modificar el tipo de reparación.' })
  }
  if (price !== undefined && !isEmpOrAdmin) {
    return res.status(403).json({ error: 'Solo recepción o administradores pueden cargar el presupuesto.' })
  }
  if (technicianNotes !== undefined && !isAssignedTech) {
    return res.status(403).json({ error: 'Solo el técnico encargado puede editar las notas.' })
  }
  if (note !== undefined && !isAssignedTech) {
    return res.status(403).json({ error: 'Solo el técnico encargado puede agregar notas.' })
  }
  if (editNote !== undefined) {
    const noteId = editNote?.id
    const entry = (order.notes || []).find((n) => n.id === noteId)
    if (!entry) return res.status(404).json({ error: 'Nota no encontrada.' })
    if (entry.by !== req.user.id && role !== 'admin') {
      return res.status(403).json({ error: 'Solo podés editar tus propias notas.' })
    }
  }
  if (deleteNote !== undefined) {
    const noteId = deleteNote?.id
    const entry = (order.notes || []).find((n) => n.id === noteId)
    if (!entry) return res.status(404).json({ error: 'Nota no encontrada.' })
    if (entry.by !== req.user.id && role !== 'admin') {
      return res.status(403).json({ error: 'Solo podés eliminar tus propias notas.' })
    }
  }
  if (addSparePart !== undefined && !isAssignedTech) {
    return res.status(403).json({ error: 'Solo el técnico encargado puede agregar repuestos.' })
  }
  if (editSparePart !== undefined) {
    const partId = editSparePart?.id
    const entry = (order.spareParts || []).find((p) => p.id === partId)
    if (!entry) return res.status(404).json({ error: 'Repuesto no encontrado.' })
    if (entry.by !== req.user.id && role !== 'admin') {
      return res.status(403).json({ error: 'Solo podés editar tus propios repuestos.' })
    }
  }
  if (deleteSparePart !== undefined) {
    const partId = deleteSparePart?.id
    const entry = (order.spareParts || []).find((p) => p.id === partId)
    if (!entry) return res.status(404).json({ error: 'Repuesto no encontrado.' })
    if (entry.by !== req.user.id && role !== 'admin') {
      return res.status(403).json({ error: 'Solo podés eliminar tus propios repuestos.' })
    }
  }
  const equipFields = [deviceType, brand, model, pin, noPin, pattern, accessories, conditions, issue, isSimpleService]
  const touchesEquip = equipFields.some((v) => v !== undefined)
  if (touchesEquip && !isEmpOrAdmin) {
    return res.status(403).json({ error: 'Solo recepción o administradores pueden editar los detalles del equipo.' })
  }
  if (fix !== undefined && order.diagnosisType === 'revision' && !(order.fix || '').trim() && (!order.assignedTo || order.status !== 'en_revision')) {
    return res.status(400).json({ error: 'Asigná un técnico y pasá la orden a revisión antes de definir el arreglo.' })
  }

  try {
    await commit(async (db) => {
      const budgetChanged =
        (fix !== undefined && normalizeList(String(fix)) !== normalizeList(String(order.fix || ''))) ||
        (price !== undefined && String(Math.max(0, Number(price) || 0)) !== String(order.price || 0))

      const updateData = {}
      const historyCreates = []

      if (deviceType !== undefined) updateData.deviceType = String(deviceType)
      if (brand !== undefined) updateData.brand = String(brand)
      if (model !== undefined) updateData.model = String(model)
      if (pin !== undefined) updateData.pin = String(pin)
      if (noPin !== undefined) updateData.noPin = !!noPin
      if (pattern !== undefined) updateData.pattern = unlockPattern(pattern)
      if (noPin === true) { updateData.pin = ''; updateData.pattern = [] }
      if (accessories !== undefined) updateData.accessories = normalizeList(String(accessories))
      if (conditions !== undefined) updateData.conditions = normalizeList(String(conditions))
      if (technicianNotes !== undefined) updateData.technicianNotes = sentenceCase(String(technicianNotes))
      if (issue !== undefined) updateData.issue = sentenceCase(String(issue))
      if (isSimpleService !== undefined) updateData.isSimpleService = !!isSimpleService

      const prevPrice = order.price
      if (price !== undefined) {
        updateData.price = money(price, 'El presupuesto')
        if (Number(price) !== Number(prevPrice || 0)) {
          historyCreates.push({ status: order.status, at: new Date(), by: req.user.id, note: `Presupuesto: $${Number(price) || 0}` })
        }
      }
      if (fix !== undefined) {
        updateData.fix = normalizeList(String(fix))
        historyCreates.push({ status: order.status, at: new Date(), by: req.user.id, note: `Arreglo: ${normalizeList(String(fix)) || 'sin definir'}` })
        await bumpFixUsage(db, fix)
      }

      // Notas vía note (append a notesLog)
      if (note !== undefined && String(note).trim()) {
        const text = sentenceCase(String(note).trim())
        updateData.technicianNotes = text
      }
      // Editar notas existentes en notesLog
      const notesToEdit = []
      const notesToDelete = []
      const notesToAdd = []
      if (editNote !== undefined && editNote?.id && editNote?.text) {
        notesToEdit.push({ id: editNote.id, text: sentenceCase(String(editNote.text).trim()) })
        if (order.notes.length === 1) updateData.technicianNotes = sentenceCase(String(editNote.text).trim())
      }
      if (deleteNote !== undefined && deleteNote?.id) {
        notesToDelete.push(deleteNote.id)
        const remaining = (order.notes || []).filter((n) => n.id !== deleteNote.id)
        updateData.technicianNotes = remaining.length > 0 ? remaining[remaining.length - 1].text : ''
      }
      if (note !== undefined && String(note).trim()) {
        notesToAdd.push({ by: req.user.id, byName: req.user.name || '—', text: sentenceCase(String(note).trim()) })
      }

      // Repuestos (spare parts)
      const sparePartsToAdd = []
      const sparePartsToEdit = []
      const sparePartsToDelete = []
      if (addSparePart !== undefined && addSparePart?.name) {
        sparePartsToAdd.push({
          name: String(addSparePart.name).trim(),
          quantity: Math.max(1, parseInt(addSparePart.quantity) || 1),
          status: 'necesario',
          by: req.user.id,
          byName: req.user.name || '—',
        })
      }
      if (editSparePart !== undefined && editSparePart?.id) {
        const data = {}
        if (editSparePart.name !== undefined) data.name = String(editSparePart.name).trim()
        if (editSparePart.quantity !== undefined) data.quantity = Math.max(1, parseInt(editSparePart.quantity) || 1)
        if (editSparePart.status !== undefined && ['necesario', 'pedido', 'recibido'].includes(editSparePart.status)) {
          data.status = editSparePart.status
        }
        sparePartsToEdit.push({ id: editSparePart.id, data })
      }
      if (deleteSparePart !== undefined && deleteSparePart?.id) {
        sparePartsToDelete.push(deleteSparePart.id)
      }

      await db.order.update({
        where: { id: order.id },
        data: {
          ...updateData,
          history: historyCreates.length ? { create: historyCreates } : undefined,
          notes: {
            ...(notesToEdit.length ? { update: notesToEdit.map((n) => ({ where: { id: n.id }, data: { text: n.text } })) } : {}),
            ...(notesToDelete.length ? { delete: notesToDelete.map((id) => ({ id })) } : {}),
            ...(notesToAdd.length ? { create: notesToAdd } : {}),
          },
          spareParts: {
            ...(sparePartsToAdd.length ? { create: sparePartsToAdd } : {}),
            ...(sparePartsToEdit.length ? { update: sparePartsToEdit.map((p) => ({ where: { id: p.id }, data: p.data })) } : {}),
            ...(sparePartsToDelete.length ? { delete: sparePartsToDelete.map((id) => ({ id })) } : {}),
          },
        },
      })

      if (budgetChanged && order.status === 'presupuesto') {
        await db.order.update({
          where: { id: order.id },
          data: { confirmed: false, confirmedAt: null, confirmedBy: null, notified: false, notifiedAt: null, notifiedBy: null },
        })
      }
      const touched = touchesEquip || fix !== undefined || price !== undefined || technicianNotes !== undefined || note !== undefined || issue !== undefined
      if (touched) {
        await audit('update', 'orders', order.id, req.user.id, `${order.orderNumber} · ${order.brand} ${order.model}: notas/presupuesto actualizados${budgetChanged && order.status === 'presupuesto' ? ' (requiere nuevo aviso y aprobación)' : ''}`, db)
      }
    }, { useTransaction: true })
    res.json({ ok: true })
  } catch (e) {
    logError('Error actualizando orden:', e)
    res.status(500).json({ error: 'Error al actualizar la orden.' })
  }
})

// ---------- Asignación de técnico encargado ----------
app.post('/api/orders/:id/assign', auth, async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude })
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  if (order.deletedAt) return res.status(400).json({ error: 'La orden está eliminada.' })
  const canAssign = ['tecnico', 'admin', 'recepcion'].includes(req.user.role)
  if (!canAssign) return res.status(403).json({ error: 'No tenés permiso para asignar un técnico.' })
  const userId = req.body?.userId || null
  if (userId) {
    const tech = await prisma.user.findFirst({ where: { id: userId, active: true, role: 'tecnico' } })
    if (!tech) return res.status(400).json({ error: 'Técnico no encontrado.' })
  }
  try {
    const updated = await commit(async () => {
      const techName = userId ? (await prisma.user.findUnique({ where: { id: userId } }))?.name || '—' : 'sin técnico'
      await prisma.order.update({
        where: { id: order.id },
        data: {
          assignedTo: userId,
          history: { create: { status: order.status, at: new Date(), by: req.user.id, note: `Asignado a ${techName}` } },
        },
      })
      await audit('assign', 'orders', order.id, req.user.id, `${order.orderNumber} · asignado a ${userId || 'sin técnico'}`)
      return prisma.order.findUnique({ where: { id: order.id }, include: orderInclude })
    })
    res.json({ ok: true, order: await decorateOrder(updated) })
  } catch {
    res.status(500).json({ error: 'Error al asignar el técnico.' })
  }
})

// ---------- Marcar / desmarcar "cliente avisado" ----------
app.post('/api/orders/:id/notified', auth, async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude })
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  if (order.deletedAt) return res.status(400).json({ error: 'La orden está eliminada.' })
  if (!['recepcion', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Solo recepción puede marcar al cliente como avisado.' })
  }
  const notified = !!req.body?.notified
  try {
    const updated = await commit(async () => {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          notified,
          notifiedAt: notified ? new Date() : null,
          notifiedBy: notified ? req.user.id : null,
          history: { create: { status: order.status, at: new Date(), by: req.user.id, note: notified ? 'Avisado al cliente' : 'Desmarcado aviso al cliente' } },
        },
      })
      await audit('update', 'orders', order.id, req.user.id, `${order.orderNumber} · cliente ${notified ? 'marcado como avisado' : 'desmarcado como avisado'}`)
      return prisma.order.findUnique({ where: { id: order.id }, include: orderInclude })
    })
    res.json({ ok: true, order: await decorateOrder(updated) })
  } catch {
    res.status(500).json({ error: 'Error al actualizar el aviso.' })
  }
})

// ---------- Marcar / desmarcar confirmación del cliente ----------
app.post('/api/orders/:id/confirm', auth, async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id }, include: orderInclude })
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  if (order.deletedAt) return res.status(400).json({ error: 'La orden está eliminada.' })
  if (!['recepcion', 'admin'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Solo recepción puede confirmar el arreglo.' })
  }
  const confirmed = !!req.body?.confirmed
  if (confirmed && (!order.notified || Number(order.price) <= 0)) {
    return res.status(400).json({ error: 'Cargá el presupuesto y avisá al cliente antes de confirmar el arreglo.' })
  }
  try {
    const updated = await commit(async () => {
      await prisma.order.update({
        where: { id: order.id },
        data: {
          confirmed,
          confirmedAt: confirmed ? new Date() : null,
          confirmedBy: confirmed ? req.user.id : null,
          history: { create: { status: order.status, at: new Date(), by: req.user.id, note: confirmed ? 'Confirmado por el cliente' : 'Desconfirmado' } },
        },
      })
      await audit('update', 'orders', order.id, req.user.id, `${order.orderNumber} · arreglo ${confirmed ? 'confirmado por el cliente' : 'desmarcado como confirmado'}`)
      return prisma.order.findUnique({ where: { id: order.id }, include: orderInclude })
    })
    res.json({ ok: true, order: await decorateOrder(updated) })
  } catch {
    res.status(500).json({ error: 'Error al confirmar el arreglo.' })
  }
})

// ---------- Etiqueta ZPL ----------
app.post('/api/orders/:id/label', auth, async (req, res) => {
  const order = await prisma.order.findUnique({ where: { id: req.params.id } })
  if (!order) return res.status(404).json({ error: 'Orden no encontrada.' })
  const customer = await prisma.customer.findUnique({ where: { id: order.customerId } })
  const result = await printZplLabel({
    orderNumber: order.orderNumber,
    model: `${order.brand} ${order.model}`.trim(),
    customerName: customer?.fullName || '',
    date: formatDateLabel(todayISO()),
  })
  res.json({ ok: result.ok, error: result.error })
})

// ---------- Configuración (solo admin) ----------
app.get('/api/config', auth, adminOnly, async (req, res) => {
  res.json({ config: (await loadConfigValue('main')) || {} })
})

app.post('/api/config', auth, adminOnly, async (req, res) => {
  const { revisionFee } = req.body || {}
  try {
    await commit(async () => {
      const current = (await loadConfigValue('main')) || {}
      if (revisionFee !== undefined) current.revisionFee = Math.max(0, Number(revisionFee) || 0)
      await upsertConfig('main', current)
      await audit('update', 'config', null, req.user.id, 'Configuración actualizada')
    })
    res.json({ ok: true })
  } catch {
    res.status(500).json({ error: 'Error al guardar la configuración.' })
  }
})

// ---------- Usuarios (solo admin) ----------
app.post('/api/users', auth, adminOnly, async (req, res) => {
  const { name, email, password, role } = req.body || {}
  if (!name || !name.trim()) return res.status(400).json({ error: 'El nombre es obligatorio.' })
  const validation = passwordError(password)
  if (validation) return res.status(400).json({ error: validation })
  if (!['admin', 'tecnico', 'recepcion'].includes(role)) {
    return res.status(400).json({ error: 'Rol inválido.' })
  }
  const id = uid()
  try {
    await commit(async () => {
      await prisma.user.create({
        data: {
          id,
          name: titleCase(name),
          email: String(email || '').trim().toLowerCase() || null,
          password: bcrypt.hashSync(password, 10),
          role,
          active: true,
        },
      })
      await audit('create', 'users', id, req.user.id, `Alta de usuario ${titleCase(name)} (${role})`)
    })
    res.json({ ok: true, id })
  } catch {
    res.status(500).json({ error: 'Error al crear el usuario.' })
  }
})

app.post('/api/users/:id/toggle', auth, adminOnly, async (req, res) => {
  const target = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!target) return res.status(404).json({ error: 'Usuario no encontrado.' })
  if (target.id === req.user.id) {
    return res.status(400).json({ error: 'No podés desactivar tu propio usuario.' })
  }
  try {
    const active = await commit(async () => {
      await prisma.user.update({ where: { id: req.params.id }, data: { active: !target.active } })
      await audit('toggle', 'users', target.id, req.user.id, `Usuario ${target.name} ${!target.active ? 'activado' : 'desactivado'}`)
      return !target.active
    })
    res.json({ ok: true, active })
  } catch {
    res.status(500).json({ error: 'Error al cambiar el estado del usuario.' })
  }
})

// ---------- Auditoría (solo admin) ----------
app.get('/api/audit', auth, adminOnly, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50))
  const total = await prisma.auditLog.count()
  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
    include: { user: userRef },
  })
  const mapped = logs.map((l) => ({ ...l, userName: l.user?.name || '—' }))
  return res.json({ logs: mapped, total, page, pages: Math.max(1, Math.ceil(total / limit)) })
})

// ---------- Actividad (línea de tiempo, para todos) ----------
app.get('/api/actividad', auth, async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50))
  const total = await prisma.auditLog.count()
  const logs = await prisma.auditLog.findMany({
    orderBy: { timestamp: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
    include: { user: userRef },
  })
  const mapped = logs.map((l) => ({ ...l, userName: l.user?.name || '—' }))
  return res.json({ logs: mapped, total, page, pages: Math.max(1, Math.ceil(total / limit)) })
})

// ---------- Métricas para el admin ----------
app.get('/api/metrics', auth, adminOnly, async (req, res) => {
  const orders = await prisma.order.findMany({ where: { deletedAt: null } })
  const today = todayISO()

  const startOfWeek = toISODate(new Date(now().getFullYear(), now().getMonth(), now().getDate() - ((now().getDay() + 6) % 7)))
  const startOfMonth = toISODate(new Date(now().getFullYear(), now().getMonth(), 1))
  const sumPrice = (list) => list.reduce((acc, o) => acc + (Number(o.price) || 0), 0)
  const dateOf = businessDate
  const createdAtDate = (o) => businessDate(o.createdAt)

  const income = {
    today: sumPrice(orders.filter((o) => dateOf(o.deliveredAt) === today)),
    week: sumPrice(orders.filter((o) => dateOf(o.deliveredAt) >= startOfWeek && dateOf(o.deliveredAt) <= today)),
    month: sumPrice(orders.filter((o) => dateOf(o.deliveredAt) >= startOfMonth && dateOf(o.deliveredAt) <= today)),
  }

  const users = await prisma.user.findMany()
  const techNames = new Map(users.map((u) => [u.id, u.name]))
  const byTech = new Map()
  for (const o of orders) {
    if (!o.deliveredAt || !o.repairedBy) continue
    const entry = byTech.get(o.repairedBy) || { totalDays: 0, count: 0 }
    entry.totalDays += Math.max(0, daysBetween(createdAtDate(o), dateOf(o.deliveredAt)))
    entry.count += 1
    byTech.set(o.repairedBy, entry)
  }
  const avgRepairDaysByTech = [...byTech.entries()]
    .map(([id, e]) => ({ technicianId: id, name: techNames.get(id) || '—', count: e.count, avgDays: e.count ? +(e.totalDays / e.count).toFixed(1) : 0 }))
    .sort((a, b) => b.count - a.count)

  const deliveredByDay = []
  for (let i = 6; i >= 0; i -= 1) {
    const date = addDays(today, -i)
    deliveredByDay.push({ date, count: orders.filter((o) => dateOf(o.deliveredAt) === date).length })
  }

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

  const devicesByPeriod = (() => {
    const weeks = []
    for (let i = 7; i >= 0; i -= 1) {
      const from = addDays(startOfWeek, -7 * i)
      const to = addDays(from, 6)
      weeks.push({ label: `${formatDateLabel(from)} - ${formatDateLabel(to)}`, count: orders.filter((o) => createdAtDate(o) >= from && createdAtDate(o) <= to).length })
    }
    const months = []
    for (let i = 5; i >= 0; i -= 1) {
      const first = new Date(now().getFullYear(), now().getMonth() - i, 1)
      const from = toISODate(first)
      const to = toISODate(new Date(first.getFullYear(), first.getMonth() + 1, 0))
      months.push({ label: from.slice(0, 7), count: orders.filter((o) => createdAtDate(o) >= from && createdAtDate(o) <= to).length })
    }
    return { weeks, months }
  })()

  function now() { return new Date() }

  return res.json({
    income,
    avgRepairDaysByTech,
    deliveredByDay,
    devicesByPeriod,
    topBrands: top('brand'),
    topModels: top('model'),
    totals: {
      deliveredMonth: orders.filter((o) => dateOf(o.deliveredAt) >= startOfMonth && dateOf(o.deliveredAt) <= today).length,
      activeOrders: orders.filter((o) => o.status !== 'entregado').length,
    },
  })
})

app.get('/api/backups', auth, adminOnly, (req, res) => {
  res.json({ backups: listBackups(), status: getBackupStatus() })
})

app.get('/api/backups/:name/download', auth, adminOnly, (req, res) => {
  const name = decodeURIComponent(req.params.name)
  if (!isValidBackupName(name)) return res.status(400).json({ error: 'Nombre de copia inválido.' })
  const full = path.join(BACKUP_DIR, name)
  if (!fs.existsSync(full)) return res.status(404).json({ error: 'Copia no encontrada.' })
  res.download(full, name)
})

app.post('/api/backups', auth, adminOnly, async (req, res) => {
  try {
    const name = await createBackup()
    if (!name) return res.status(400).json({ error: 'No se pudo crear la copia de seguridad.' })
    res.json({ ok: true, name, status: getBackupStatus() })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

app.post('/api/backups/:name/restore', auth, adminOnly, async (req, res) => {
  try {
    const name = decodeURIComponent(req.params.name)
    const found = listBackups().find((b) => b.name === name)
    if (!found) return res.status(404).json({ error: 'Copia no encontrada.' })
    const safetyBackup = await createBackup({ preserve: name })
    if (!safetyBackup) return res.status(503).json({ error: 'No se pudo respaldar el estado actual. Se canceló la restauración.' })
    await restoreBackup(name)
    res.json({ ok: true })
  } catch (e) {
    res.status(400).json({ error: e.message })
  }
})

registerTrashRoutes(app, { prisma, auth, adminOnly, commit, audit })

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
app.use((err, req, res, next) => {
  logError('Error en la API:', err)
  if (res.headersSent) return next(err)
  const status = [400, 409, 413].includes(err.status) ? err.status : 500
  res.status(status).json({ error: status === 400 ? 'Solicitud inválida.' : status === 409 ? err.message : status === 413 ? 'La solicitud es demasiado grande.' : 'Error interno del servidor.' })
})

// Arranca backups automáticos en background.
export async function startServer() {
  if (NODE_ENV === 'production') backupKey(BACKUP_ENCRYPTION_KEY)
  await seedIfEmpty()
  scheduleBackups()
  const host = process.env.HOST || '0.0.0.0'
  const server = app.listen(PORT, host, () => {
    console.log(`Servidor de servicio técnico corriendo en http://${host}:${PORT}`)
  })
  const shutdown = async () => {
    server.close()
    for (const client of eventClients) client.end()
    const { closeBrowser } = await import('./pdf/puppeteerPdf.js')
    await closeBrowser()
    await prisma.$disconnect()
    process.exit(0)
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
  if (process.env.VERIFICATION_INSTANCE && process.send) {
    process.on('message', (message) => { if (message === 'verification-shutdown') shutdown() })
  }
  return server
}

if (process.argv[1] && path.resolve(process.argv[1]) === __file) await startServer()
