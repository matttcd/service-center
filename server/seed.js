// ============================================
// Seed inicial del servidor (service-center)
// Solo crea el usuario admin y el catálogo base.
// Los perfiles, clientes y órdenes se crean desde la app.
// ============================================
import bcrypt from 'bcryptjs'
import { uid } from './helpers.js'

const CATALOG_BRANDS = ['Samsung', 'Apple', 'Xiaomi', 'Motorola', 'LG']

const CATALOG_MODELS = {
  Samsung: ['Galaxy A10', 'Galaxy A12', 'Galaxy A15', 'Galaxy A54', 'Galaxy S21', 'Galaxy S23'],
  Apple: ['iPhone 11', 'iPhone 12', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 14', 'iPhone 15'],
  Xiaomi: ['Redmi 9A', 'Redmi 12', 'Redmi Note 12', 'Redmi Note 13', 'POCO X5', 'Xiaomi 13T'],
  Motorola: ['G22', 'G32', 'G52', 'G54', 'G84', 'Edge 40'],
  LG: ['K40', 'K51', 'K61', 'K62', 'V60', 'Velvet'],
}

export function buildSeed() {
  const hash = (p) => bcrypt.hashSync(p, 10)

  const db = {
    users: [],
    customers: [],
    orders: [],
    auditLogs: [],
    catalog: { brands: [], models: [] },
    orderCounter: 0,
    config: {
      revisionFee: 5000,
      whatsapp: {
        instanceId: '',
        apiToken: '',
        local: 'El Gringo Celulares',
        messageTemplate: 'Hola {cliente}, tu {dispositivo} (Orden {orden}) quedó listo para retirar en {local}.',
      },
    },
  }

  const admin = { id: uid(), name: 'Administrador', email: 'admin@local.com', password: hash('admin123'), role: 'admin', active: true }
  db.users.push(admin)

  for (const name of CATALOG_BRANDS) {
    db.catalog.brands.push({ id: uid(), name, usage: 0 })
  }
  for (const [brand, models] of Object.entries(CATALOG_MODELS)) {
    for (const name of models) {
      db.catalog.models.push({ id: uid(), brand, name, usage: 0 })
    }
  }

  db.auditLogs.push(
    { id: uid(), userId: admin.id, action: 'seed', table: 'db', recordId: null, details: 'Inicialización del sistema de servicio técnico', timestamp: new Date().toISOString() },
  )

  return db
}
