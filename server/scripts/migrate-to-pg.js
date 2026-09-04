import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { prisma } from '../db.js'

const __file = fileURLToPath(import.meta.url)
const __serverDir = path.dirname(path.dirname(__file))
const __rootDir = path.resolve(__serverDir, '..')

const DB_JSON = process.env.DB_JSON || path.join(__serverDir, 'data', 'db.json')

const toDate = (v) => {
  if (!v) return null
  const d = v instanceof Date ? v : new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

async function main() {
  const url = new URL(`file://${DB_JSON.replace(/\\/g, '/')}`).href
  const { default: db } = await import(url, { with: { type: 'json' } })
  console.log(`\nMigrando ${DB_JSON}\n  users=${db.users?.length || 0} customers=${db.customers?.length || 0} orders=${db.orders?.length || 0} audit=${db.auditLogs?.length || 0}`)

  // ---------- Usuarios (IDs exactos; email vacío → null para respetar @unique) ----------
  const seenEmails = new Set()
  for (const u of db.users || []) {
    const email = String(u.email || '').trim().toLowerCase() || null
    if (email && seenEmails.has(email)) continue
    if (email) seenEmails.add(email)
    await prisma.user.create({
      data: {
        id: u.id,
        name: u.name,
        email,
        password: u.password,
        role: u.role,
        active: u.active !== false,
      },
    })
  }

  // ---------- Clientes (merge por id) ----------
  for (const c of db.customers || []) {
    await prisma.customer.upsert({
      where: { id: c.id },
      update: {
        fullName: c.fullName,
        dni: c.dni || '',
        phone: c.phone || '',
        phone2: c.phone2 || '',
        phone3: c.phone3 || '',
        email: c.email || '',
        address: c.address || '',
        createdAt: toDate(c.createdAt) || new Date(),
        deletedAt: toDate(c.deletedAt),
      },
      create: {
        id: c.id,
        fullName: c.fullName,
        dni: c.dni || '',
        phone: c.phone || '',
        phone2: c.phone2 || '',
        phone3: c.phone3 || '',
        email: c.email || '',
        address: c.address || '',
        createdAt: toDate(c.createdAt) || new Date(),
        deletedAt: toDate(c.deletedAt),
      },
    })
  }

  // ---------- Catálogo de marcas y modelos (merge / dedup) ----------
  const brandsSeen = new Set()
  for (const b of db.catalog?.brands || []) {
    const key = b.name.toLowerCase()
    if (brandsSeen.has(key)) continue
    brandsSeen.add(key)
    await prisma.catalogBrand.upsert({
      where: { name: b.name },
      update: { usage: { set: b.usage || 0 } },
      create: { name: b.name, usage: b.usage || 0 },
    })
  }

  const modelsSeen = new Set()
  for (const m of db.catalog?.models || []) {
    const key = `${m.brand.toLowerCase()}::${m.name.toLowerCase()}`
    if (modelsSeen.has(key)) continue
    modelsSeen.add(key)
    try {
      await prisma.catalogModel.upsert({
        where: { brand_name_deviceType: { brand: m.brand, name: m.name, deviceType: m.deviceType || 'Sin categorizar' } },
        update: { deviceType: m.deviceType || 'Sin categorizar' },
        create: { brand: m.brand, name: m.name, deviceType: m.deviceType || 'Sin categorizar', usage: m.usage || 0 },
      })
    } catch (e) {
      // una marca puede no existir aún en la BD; la creamos
      await prisma.catalogBrand.upsert({ where: { name: m.brand }, update: {}, create: { name: m.brand } })
      await prisma.catalogModel.upsert({
        where: { brand_name_deviceType: { brand: m.brand, name: m.name, deviceType: m.deviceType || 'Sin categorizar' } },
        update: { deviceType: m.deviceType || 'Sin categorizar' },
        create: { brand: m.brand, name: m.name, deviceType: m.deviceType || 'Sin categorizar', usage: m.usage || 0 },
      })
    }
  }

  // ---------- Listas editables ----------
  if (Array.isArray(db.catalog?.accessories)) {
    await prisma.catalogAccessory.createMany({ data: db.catalog.accessories.map((name) => ({ name })), skipDuplicates: true })
  }
  if (Array.isArray(db.catalog?.conditions)) {
    await prisma.catalogCondition.createMany({ data: db.catalog.conditions.map((name) => ({ name })), skipDuplicates: true })
  }
  if (Array.isArray(db.catalog?.fixes)) {
    await prisma.catalogFix.createMany({ data: db.catalog.fixes.map((name) => ({ name })), skipDuplicates: true })
  }

  // ---------- Configuración (merge) ----------
  if (db.config) {
    const value = JSON.parse(JSON.stringify(db.config))
    if (Array.isArray(db.catalog?.terms)) value.terms = db.catalog.terms
    await prisma.config.upsert({
      where: { key: 'main' },
      update: { value },
      create: { key: 'main', value },
    })
  }

  // ---------- Contador de órdenes (tomamos el máximo) ----------
  const migratedCounter = Number(db.orderCounter) || 0
  const existingCounter = (await prisma.orderCounter.findUnique({ where: { key: 'order' } }))?.value || 0
  if (migratedCounter > existingCounter || existingCounter === 0) {
    await prisma.orderCounter.upsert({
      where: { key: 'order' },
      update: { value: migratedCounter },
      create: { key: 'order', value: migratedCounter },
    })
  }

  // ---------- Órdenes (con historial y notas) ----------
  for (const o of db.orders || []) {
    const exists = await prisma.order.findUnique({ where: { id: o.id } })
    if (exists) continue

    const data = {
      id: o.id,
      orderNumber: o.orderNumber,
      customerId: o.customerId,
      deviceType: o.deviceType || 'Celular',
      brand: o.brand || '',
      model: o.model || '',
      accessories: o.accessories || '',
      conditions: o.conditions || '',
      pin: o.pin || '',
      noPin: !!o.noPin,
      pattern: Array.isArray(o.pattern) ? o.pattern : [],
      diagnosisType: o.diagnosisType || 'visible',
      issue: o.issue || '',
      fix: o.fix || '',
      price: Number(o.price) || 0,
      advance: Number(o.advance) || 0,
      status: o.status || 'recibido',
      technicianNotes: o.technicianNotes || '',
      assignedTo: o.assignedTo || null,
      repairedBy: o.repairedBy || null,
      receivedBy: o.receivedBy || null,
      createdAt: toDate(o.createdAt) || new Date(),
      deliveredAt: toDate(o.deliveredAt),
      deliveredBy: o.deliveredBy || null,
      notified: !!o.notified,
      notifiedAt: toDate(o.notifiedAt),
      notifiedBy: o.notifiedBy || null,
      confirmed: !!o.confirmed,
      confirmedAt: toDate(o.confirmedAt),
      confirmedBy: o.confirmedBy || null,
      pickupBy: o.pickupBy || '',
      pickupName: o.pickupName || '',
      pickupDni: o.pickupDni || '',
      warrantyReturn: !!o.warrantyReturn,
      deletedAt: toDate(o.deletedAt),
    }

    const history = (o.history || []).map((h) => ({
      status: h.status,
      at: toDate(h.at) || new Date(),
      by: h.by || null,
      note: h.note || '',
    }))

    const notes = (o.notesLog || []).map((n) => ({
      id: n.id,
      at: toDate(n.at) || new Date(),
      by: n.by || null,
      byName: n.byName || '',
      text: n.text || '',
    }))

    await prisma.order.create({
      data: {
        ...data,
        ...(history.length ? { history: { create: history } } : {}),
        ...(notes.length ? { notes: { create: notes } } : {}),
      },
    })
  }

  // ---------- Auditoría ----------
  class UserRefs {
    constructor(users) {
      this.ids = new Set((users || []).map((u) => u.id))
    }
    safe(userId) {
      return userId && this.ids.has(userId) ? userId : null
    }
  }
  const userRefs = new UserRefs(db.users || [])
  for (const a of db.auditLogs || []) {
    const exists = await prisma.auditLog.findUnique({ where: { id: a.id } })
    if (exists) continue
    await prisma.auditLog.create({
      data: {
        id: a.id,
        userId: userRefs.safe(a.userId),
        action: a.action,
        table: a.table,
        recordId: a.recordId || null,
        details: a.details || '',
        timestamp: toDate(a.timestamp) || new Date(),
      },
    })
  }

  const counts = {
    users: await prisma.user.count(),
    customers: await prisma.customer.count(),
    orders: await prisma.order.count(),
    orderHistory: await prisma.orderHistory.count(),
    orderNotes: await prisma.orderNote.count(),
    catalogBrands: await prisma.catalogBrand.count(),
    catalogModels: await prisma.catalogModel.count(),
    auditLogs: await prisma.auditLog.count(),
  }
  console.log('\n✅ Migración completada:')
  console.log(counts)

  await prisma.$disconnect()
}

main().catch((e) => {
  console.error('Error durante la migración:', e)
  process.exit(1)
})
