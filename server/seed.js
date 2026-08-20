// ============================================
// Datos de ejemplo precargados (seed inicial del servidor)
// Respeta las reglas vigentes del flujo:
//  - confirmar exige haber avisado (notified)
//  - entregar exige haber avisado (notified)
//  - en presupuesto/terminado: cada etapa vuelve a exigir aviso
//  - fix admite varios arreglos separados por coma
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
  const tecnico = { id: uid(), name: 'Mateo', email: 'tecnico@local.com', password: hash('tecnico123'), role: 'tecnico', active: true }
  const tecnico2 = { id: uid(), name: 'Lucas', email: 'lucas@local.com', password: hash('lucas123'), role: 'tecnico', active: true }
  const mostrador = { id: uid(), name: 'Mostrador', email: 'mostrador@local.com', password: hash('mostrador123'), role: 'mostrador', active: true }
  db.users.push(admin, tecnico, tecnico2, mostrador)

  const mkCustomer = (fullName, dni, phone, email, address, createdAt, phone2 = '', phone3 = '') => ({
    id: uid(), fullName, dni, phone, phone2, phone3, email, address, createdAt,
  })

  const fernando = mkCustomer('Fernando Fleitas', '30123456', '1155554433', 'fernando@mail.com', 'Av. Tecnológica 100', addDays(today, -12))
  const luciano = mkCustomer('Luciano Grossi', '27987654', '1166667788', 'luciano@mail.com', 'Calle Computación 890', addDays(today, -8))
  const mateo = mkCustomer('Mateo Cuella', '33456789', '1177778899', 'mateo@mail.com', 'Belgrano 456', addDays(today, -20), '1512345678', '1523456789')
  const cristian = mkCustomer('Cristian Ramirez', '36765432', '1188889900', 'cristian@mail.com', 'San Martín 678', addDays(today, -3), '', '1511199887')
  const sofia = mkCustomer('Sofía Aguirre', '40111222', '1167890001', 'sofia@mail.com', 'Sarmiento 120', addDays(today, -15), '1511223344')
  const jorge = mkCustomer('Jorge Benítez', '35444555', '1178899000', 'jorge@mail.com', 'Rivadavia 3300', addDays(today, -6), '', '1544556677')
  const rocio = mkCustomer('Rocío Paredes', '42333444', '1189900011', 'rocio@mail.com', 'Mitre 890', addDays(today, -2), '1533445566')
  db.customers.push(fernando, luciano, mateo, cristian, sofia, jorge, rocio)

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
      conditions: opts.conditions || '',
      pin: opts.pin || '',
      pattern: opts.pattern || null,
      diagnosisType: opts.diagnosisType || 'visible',
      issue: opts.issue,
      fix: opts.fix || '',
      price: opts.price || 0,
      advance: opts.advance || 0,
      status: opts.status,
      technicianNotes: opts.technicianNotes || '',
      assignedTo: opts.assignedTo || null,
      repairedBy: opts.repairedBy || null,
      notified: opts.notified || false,
      notifiedAt: opts.notifiedAt || null,
      notifiedBy: opts.notifiedBy || null,
      confirmed: opts.confirmed || false,
      confirmedAt: opts.confirmedAt || null,
      confirmedBy: opts.confirmedBy || null,
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
    // OS-0001: recibido, problema visible (falta cargar presupuesto en el taller).
    mkOrder({
      orderNumber: 'OS-0001',
      customerId: fernando.id,
      receivedBy: mostrador.id,
      createdAt: addDays(today, -1),
      brand: 'Samsung', model: 'Galaxy A54',
      accessories: 'Funda, SIM', pin: '1234', pattern: [0, 1, 2, 5],
      conditions: 'Golpeado',
      diagnosisType: 'visible',
      issue: 'No enciende, queda en logo y se apaga.',
      fix: '', price: 0,
      status: 'recibido',
      history: [{ status: 'recibido', at: addDays(today, -1), by: mostrador.id }],
    }),
    // OS-0002: recibido, ingresa a revisión (aún no se revisó).
    mkOrder({
      orderNumber: 'OS-0002',
      customerId: sofia.id,
      receivedBy: mostrador.id,
      createdAt: addDays(today, 0),
      brand: 'Xiaomi', model: 'Redmi Note 12',
      accessories: 'Cargador', pin: '',
      conditions: 'Mojado',
      diagnosisType: 'revision',
      issue: 'Se mojó, no enciende. Requiere diagnóstico.',
      fix: '', price: 0,
      status: 'recibido',
      history: [{ status: 'recibido', at: addDays(today, 0), by: mostrador.id }],
    }),
    // OS-0003: en revisión (el técnico está diagnosticando).
    mkOrder({
      orderNumber: 'OS-0003',
      customerId: jorge.id,
      receivedBy: mostrador.id,
      createdAt: addDays(today, -3),
      brand: 'Apple', model: 'iPhone 12',
      accessories: '', pin: '', pattern: [0, 3, 4, 7],
      conditions: 'Apagado',
      diagnosisType: 'revision',
      issue: 'No carga con cable, solo inalámbrico.',
      fix: '', price: 0,
      status: 'en_revision', assignedTo: tecnico.id,
      technicianNotes: 'Revisando la placa de carga.',
      history: [
        { status: 'recibido', at: addDays(today, -3), by: mostrador.id },
        { status: 'en_revision', at: addDays(today, -2), by: tecnico.id },
      ],
    }),
    // OS-0004: presupuesto SIN avisar → no se puede confirmar ni reparar (prueba la regla).
    mkOrder({
      orderNumber: 'OS-0004',
      customerId: mateo.id,
      receivedBy: mostrador.id,
      createdAt: addDays(today, -2),
      brand: 'Motorola', model: 'G54',
      accessories: '', pin: '4567',
      conditions: 'Apagado',
      diagnosisType: 'revision',
      issue: 'No carga con cable, solo inalámbrico.',
      fix: 'Cambio de puerto de carga', price: 38000,
      status: 'presupuesto', assignedTo: tecnico.id,
      notified: false, confirmed: false,
      technicianNotes: 'Puerto de carga flojo. Falta avisar el presupuesto al cliente.',
      history: [
        { status: 'recibido', at: addDays(today, -2), by: mostrador.id },
        { status: 'en_revision', at: addDays(today, -1), by: tecnico.id },
        { status: 'presupuesto', at: addDays(today, 0), by: tecnico.id },
      ],
    }),
    // OS-0005: presupuesto AVISADO sin confirmar → confirmación habilitada.
    mkOrder({
      orderNumber: 'OS-0005',
      customerId: cristian.id,
      receivedBy: mostrador.id,
      createdAt: addDays(today, -4),
      brand: 'Xiaomi', model: 'Redmi 12',
      accessories: 'Vidrio templado', pin: '',
      conditions: '',
      diagnosisType: 'revision',
      issue: 'Micrófono no funciona en llamadas.',
      fix: 'Limpieza de módulo de micrófono, Cambio de parlante', price: 25000,
      status: 'presupuesto', assignedTo: tecnico2.id,
      notified: true, notifiedAt: addDays(today, -1), notifiedBy: mostrador.id,
      confirmed: false,
      technicianNotes: 'Presupuesto enviado, esperando confirmación del cliente. Arreglos: limpieza de micrófono y parlante.',
      history: [
        { status: 'recibido', at: addDays(today, -4), by: mostrador.id },
        { status: 'en_revision', at: addDays(today, -3), by: tecnico2.id },
        { status: 'presupuesto', at: addDays(today, -2), by: tecnico2.id },
      ],
    }),
    // OS-0006: presupuesto AVISADO + CONFIRMADO → listo para reparar.
    mkOrder({
      orderNumber: 'OS-0006',
      customerId: luciano.id,
      receivedBy: mostrador.id,
      createdAt: addDays(today, -5),
      brand: 'Apple', model: 'iPhone 13',
      accessories: 'Cargador', pin: '',
      diagnosisType: 'visible',
      issue: 'Pantalla rota y no responde el táctil.',
      fix: 'Cambio de pantalla', price: 120000, advance: 30000,
      status: 'presupuesto', assignedTo: tecnico.id,
      notified: true, notifiedAt: addDays(today, -2), notifiedBy: mostrador.id,
      confirmed: true, confirmedAt: addDays(today, -1), confirmedBy: mostrador.id,
      technicianNotes: 'Cliente ya confirmó el presupuesto, esperando inicio de reparación.',
      history: [
        { status: 'recibido', at: addDays(today, -5), by: mostrador.id },
        { status: 'en_reparacion', at: addDays(today, -4), by: tecnico.id },
        { status: 'presupuesto', at: addDays(today, -3), by: tecnico.id },
      ],
    }),
    // OS-0007: en reparación (viene de presupuesto confirmado).
    mkOrder({
      orderNumber: 'OS-0007',
      customerId: fernando.id,
      receivedBy: mostrador.id,
      createdAt: addDays(today, -2),
      brand: 'Samsung', model: 'Galaxy A15',
      accessories: 'Funda', pin: '1234', pattern: [0, 1, 2, 5],
      conditions: 'Golpeado, Display Roto',
      diagnosisType: 'visible',
      issue: 'No enciende, queda en logo y se apaga.',
      fix: 'Cambio de batería', price: 45000,
      status: 'en_reparacion', assignedTo: tecnico.id, repairedBy: tecnico.id,
      notified: true, notifiedAt: addDays(today, -1), notifiedBy: mostrador.id,
      confirmed: true, confirmedAt: addDays(today, -1), confirmedBy: mostrador.id,
      technicianNotes: 'Reemplazando la batería.',
      history: [
        { status: 'recibido', at: addDays(today, -2), by: mostrador.id },
        { status: 'presupuesto', at: addDays(today, -1), by: tecnico.id },
        { status: 'en_reparacion', at: addDays(today, 0), by: tecnico.id },
      ],
    }),
    // OS-0008: terminado SIN avisar → no se puede entregar (prueba la regla).
    mkOrder({
      orderNumber: 'OS-0008',
      customerId: rocio.id,
      receivedBy: mostrador.id,
      createdAt: addDays(today, -2),
      brand: 'Motorola', model: 'G52',
      accessories: '', pin: '2580',
      conditions: 'Apagado',
      diagnosisType: 'visible',
      issue: 'No carga, batería hinchada.',
      fix: 'Cambio de batería', price: 48000, advance: 20000,
      status: 'terminado', assignedTo: tecnico2.id, repairedBy: tecnico2.id,
      notified: false,
      confirmed: true, confirmedAt: addDays(today, -1), confirmedBy: mostrador.id,
      technicianNotes: 'Batería reemplazada y probada. Falta avisarle al cliente que está listo.',
      history: [
        { status: 'recibido', at: addDays(today, -2), by: mostrador.id },
        { status: 'presupuesto', at: addDays(today, -1), by: tecnico2.id },
        { status: 'en_reparacion', at: addDays(today, -1), by: tecnico2.id },
        { status: 'terminado', at: addDays(today, 0), by: tecnico2.id },
      ],
    }),
    // OS-0009: terminado AVISADO → se puede entregar.
    mkOrder({
      orderNumber: 'OS-0009',
      customerId: mateo.id,
      receivedBy: mostrador.id,
      createdAt: addDays(today, -6),
      brand: 'Samsung', model: 'Galaxy A12',
      accessories: 'Funda, Cargador', pin: '',
      conditions: '',
      diagnosisType: 'visible',
      issue: 'Parlante distorsionado.',
      fix: 'Cambio de parlante, Limpieza', price: 32000, advance: 16000,
      status: 'terminado', assignedTo: tecnico.id, repairedBy: tecnico.id,
      notified: true, notifiedAt: addDays(today, -1), notifiedBy: mostrador.id,
      confirmed: true, confirmedAt: addDays(today, -3), confirmedBy: mostrador.id,
      technicianNotes: 'Parlante reemplazado y limpieza general. Esperando retiro del cliente.',
      history: [
        { status: 'recibido', at: addDays(today, -6), by: mostrador.id },
        { status: 'presupuesto', at: addDays(today, -4), by: tecnico.id },
        { status: 'en_reparacion', at: addDays(today, -3), by: tecnico.id },
        { status: 'terminado', at: addDays(today, -1), by: tecnico.id },
      ],
    }),
    // OS-0010: entregado (SIEMPRE con notified = true).
    mkOrder({
      orderNumber: 'OS-0010',
      customerId: jorge.id,
      receivedBy: mostrador.id,
      createdAt: addDays(today, -12),
      brand: 'Xiaomi', model: 'Redmi 9A',
      accessories: 'Vidrio templado', pin: '1122',
      conditions: 'Display Roto',
      diagnosisType: 'visible',
      issue: 'Display roto.',
      fix: 'Cambio de módulo', price: 65000, advance: 30000,
      status: 'entregado', assignedTo: tecnico.id, repairedBy: tecnico.id,
      notified: true, notifiedAt: addDays(today, -6), notifiedBy: mostrador.id,
      confirmed: true, confirmedAt: addDays(today, -8), confirmedBy: mostrador.id,
      technicianNotes: 'Módulo reemplazado, entregado al cliente.',
      deliveredAt: addDays(today, -5), deliveredBy: mostrador.id,
      history: [
        { status: 'recibido', at: addDays(today, -12), by: mostrador.id },
        { status: 'presupuesto', at: addDays(today, -9), by: tecnico.id },
        { status: 'en_reparacion', at: addDays(today, -8), by: tecnico.id },
        { status: 'terminado', at: addDays(today, -6), by: tecnico.id },
        { status: 'entregado', at: addDays(today, -5), by: mostrador.id },
      ],
    }),
  )

  db.orderCounter = 10

  db.auditLogs.push(
    { id: uid(), userId: admin.id, action: 'seed', table: 'db', recordId: null, details: 'Inicialización del sistema de servicio técnico', timestamp: new Date().toISOString() },
  )

  return db
}