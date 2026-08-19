// ============================================
// Datos de ejemplo precargados (seed inicial del servidor)
// ============================================
import bcrypt from 'bcryptjs'
import { addDays, todayISO, uid } from './helpers.js'

const CATALOG_BRANDS = ['Samsung', 'Apple', 'Xiaomi', 'Motorola', 'LG']

const CATALOG_MODELS = {
  Samsung: ['Galaxy A10', 'Galaxy A12', 'Galaxy A15', 'Galaxy A54', 'Galaxy S21', 'Galaxy S23'],
  Apple: ['iPhone 11', 'iPhone 12', 'iPhone 13', 'iPhone 13 Pro', 'iPhone 14', 'iPhone 15'],
  Xiaomi: ['Redmi 9A', 'Redmi 12', 'Redmi Note 12', 'Redmi Note 13', 'POCO X5', 'Xiaomi 13T'],
  Motorola: ['G22', 'G32', 'G52', 'G54', 'G84', 'Edge 40'],
  LG: ['K40', 'K51', 'K61', 'K62', 'V60', 'Velvet'],
}

export function buildSeed() {
  const today = todayISO()
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
  const tecnico = { id: uid(), name: 'Técnico', email: 'tecnico@local.com', password: hash('tecnico123'), role: 'tecnico', active: true }
  const mostrador = { id: uid(), name: 'Mostrador', email: 'mostrador@local.com', password: hash('mostrador123'), role: 'mostrador', active: true }
  db.users.push(admin, tecnico, mostrador)

  const mkCustomer = (fullName, dni, phone, email, address, createdAt) => ({
    id: uid(), fullName, dni, phone, email, address, createdAt,
  })

  const fernando = mkCustomer('Fernando Fleitas', '30123456', '1155554433', 'fernando@mail.com', 'Av. Tecnológica 100', addDays(today, -12))
  const luciano = mkCustomer('Luciano Grossi', '27987654', '1166667788', 'luciano@mail.com', 'Calle Computación 890', addDays(today, -8))
  const mateo = mkCustomer('Mateo Cuella', '33456789', '1177778899', 'mateo@mail.com', 'Belgrano 456', addDays(today, -20))
  const cristian = mkCustomer('Cristian Ramirez', '36765432', '1188889900', 'cristian@mail.com', 'San Martín 678', addDays(today, -3))
  db.customers.push(fernando, luciano, mateo, cristian)

  // ---------- Catálogo ----------
  const brandId = new Map()
  for (const name of CATALOG_BRANDS) {
    const b = { id: uid(), name, usage: 0 }
    brandId.set(name, b.id)
    db.catalog.brands.push(b)
  }
  for (const [brand, models] of Object.entries(CATALOG_MODELS)) {
    for (const name of models) {
      db.catalog.models.push({ id: uid(), brand, name, usage: 0 })
    }
  }

  const bump = (brand, model) => {
    const b = db.catalog.brands.find((x) => x.name === brand)
    if (b) b.usage += 1
    const m = db.catalog.models.find((x) => x.brand === brand && x.name === model)
    if (m) m.usage += 1
  }

  // ---------- Órdenes (una orden = un dispositivo, sin IMEI) ----------
  const mkOrder = (opts) => {
    const order = {
      id: uid(),
      orderNumber: opts.orderNumber,
      customerId: opts.customerId,
      brand: opts.brand,
      model: opts.model,
      accessories: opts.accessories || '',
      pin: opts.pin || '',
      diagnosisType: opts.diagnosisType || 'visible',
      issue: opts.issue,
      fix: opts.fix || '',
      price: opts.price || 0,
      advance: opts.advance || 0,
      status: opts.status,
      technicianNotes: opts.technicianNotes || '',
      repairedBy: opts.repairedBy || null,
      notified: opts.notified || false,
      notifiedAt: opts.notifiedAt || null,
      notifiedBy: opts.notifiedBy || null,
      history: opts.history || [],
      receivedBy: opts.receivedBy,
      createdAt: opts.createdAt,
      deliveredAt: opts.deliveredAt || null,
      deliveredBy: opts.deliveredBy || null,
    }
    bump(opts.brand, opts.model)
    return order
  }

  db.orders.push(
    mkOrder({
      orderNumber: 'OS-0001',
      customerId: fernando.id,
      receivedBy: mostrador.id,
      createdAt: addDays(today, -2),
      brand: 'Samsung', model: 'Galaxy A15',
      accessories: 'Funda', pin: '1234',
      diagnosisType: 'visible',
      issue: 'No enciende, queda en logo y se apaga.',
      fix: 'Cambio de batería', price: 45000,
      status: 'en_reparacion', repairedBy: tecnico.id,
      history: [
        { status: 'recibido', at: addDays(today, -2), by: mostrador.id },
        { status: 'en_reparacion', at: addDays(today, -1), by: tecnico.id },
      ],
    }),
    mkOrder({
      orderNumber: 'OS-0002',
      customerId: luciano.id,
      receivedBy: mostrador.id,
      createdAt: addDays(today, -5),
      brand: 'Apple', model: 'iPhone 13',
      accessories: 'Cargador', pin: '',
      diagnosisType: 'visible',
      issue: 'Pantalla rota y no responde el táctil.',
      fix: 'Cambio de pantalla', price: 120000, advance: 30000,
      status: 'terminado', repairedBy: tecnico.id,
      technicianNotes: 'Pantalla reemplazada, probada y funcionando. Garantía 30 días.',
      notified: true, notifiedAt: addDays(today, -1), notifiedBy: mostrador.id,
      history: [
        { status: 'recibido', at: addDays(today, -5), by: mostrador.id },
        { status: 'en_reparacion', at: addDays(today, -4), by: tecnico.id },
        { status: 'terminado', at: addDays(today, -1), by: tecnico.id },
      ],
    }),
    mkOrder({
      orderNumber: 'OS-0003',
      customerId: mateo.id,
      receivedBy: mostrador.id,
      createdAt: addDays(today, -3),
      brand: 'Motorola', model: 'G54',
      accessories: '', pin: '4567',
      diagnosisType: 'revision',
      issue: 'No carga con cable, solo inalámbrico.',
      fix: 'Cambio de puerto de carga', price: 38000,
      status: 'presupuesto',
      technicianNotes: 'Puerto de carga flojo. Presupuesto enviado, falta que el cliente confirme.',
      history: [
        { status: 'recibido', at: addDays(today, -3), by: mostrador.id },
        { status: 'en_revision', at: addDays(today, -2), by: tecnico.id },
        { status: 'presupuesto', at: addDays(today, -1), by: tecnico.id },
      ],
    }),
    mkOrder({
      orderNumber: 'OS-0004',
      customerId: cristian.id,
      receivedBy: mostrador.id,
      createdAt: addDays(today, -12),
      brand: 'Xiaomi', model: 'Redmi 12',
      accessories: 'Vidrio templado', pin: '',
      diagnosisType: 'visible',
      issue: 'Micrófono no funciona en llamadas.',
      fix: 'Limpieza de módulo de micrófono', price: 25000, advance: 25000,
      status: 'entregado', repairedBy: tecnico.id,
      technicianNotes: 'Limpieza realizada, micrófono funcionando.',
      notified: true, notifiedAt: addDays(today, -7), notifiedBy: mostrador.id,
      deliveredAt: addDays(today, -6), deliveredBy: mostrador.id,
      history: [
        { status: 'recibido', at: addDays(today, -12), by: mostrador.id },
        { status: 'en_reparacion', at: addDays(today, -11), by: tecnico.id },
        { status: 'terminado', at: addDays(today, -7), by: tecnico.id },
        { status: 'entregado', at: addDays(today, -6), by: mostrador.id },
      ],
    }),
    mkOrder({
      orderNumber: 'OS-0005',
      customerId: fernando.id,
      receivedBy: mostrador.id,
      createdAt: addDays(today, -1),
      brand: 'Samsung', model: 'Galaxy A54',
      accessories: 'SIM y SD', pin: '',
      diagnosisType: 'visible',
      issue: 'La batería se descarga muy rápido.',
      fix: 'Cambio de batería', price: 55000,
      status: 'recibido',
      history: [{ status: 'recibido', at: addDays(today, -1), by: mostrador.id }],
    }),
  )

  db.orderCounter = 5

  db.auditLogs.push(
    { id: uid(), userId: admin.id, action: 'seed', table: 'db', recordId: null, details: 'Inicialización del sistema de servicio técnico', timestamp: new Date().toISOString() },
  )

  return db
}