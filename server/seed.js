// ============================================
// Datos de ejemplo precargados (seed inicial del servidor)
// ============================================
import bcrypt from 'bcryptjs'
import { addDays, todayISO, uid } from './helpers.js'

// Crea un item de una orden con su historial de estados.
function makeItem(opts) {
  const history = opts.history || []
  const item = {
    id: uid(),
    brand: opts.brand,
    model: opts.model,
    imei: opts.imei || '',
    password: opts.password || '',
    issueDescription: opts.issueDescription,
    accessories: opts.accessories || '',
    priceEstimate: opts.priceEstimate || 0,
    advance: opts.advance || 0,
    status: opts.status || 'recibido',
    technicianNotes: opts.technicianNotes || '',
    repairedBy: opts.repairedBy || null,
    history,
    createdAt: opts.createdAt,
    deliveredAt: opts.deliveredAt || null,
  }
  return item
}

// Construye la base de datos inicial con datos de ejemplo.
export function buildSeed() {
  const today = todayISO()
  const hash = (p) => bcrypt.hashSync(p, 10)

  const db = {
    users: [],
    customers: [],
    orders: [],
    auditLogs: [],
    orderCounter: 0,
    config: {
      whatsapp: {
        instanceId: '',
        apiToken: '',
        local: 'El Gringo Celulares',
        messageTemplate:
          'Hola {cliente}, te avisamos que tu {dispositivo} (Orden {orden}) quedó listo para retirar en {local}. ¡Te esperamos!',
      },
    },
  }

  // ---------- Usuarios ----------
  const admin = { id: uid(), name: 'Administrador', email: 'admin@local.com', password: hash('admin123'), role: 'admin', active: true }
  const tecnico = { id: uid(), name: 'Técnico', email: 'tecnico@local.com', password: hash('tecnico123'), role: 'tecnico', active: true }
  const mostrador = { id: uid(), name: 'Mostrador', email: 'mostrador@local.com', password: hash('mostrador123'), role: 'mostrador', active: true }
  db.users.push(admin, tecnico, mostrador)

  // ---------- Clientes ----------
  const mkCustomer = (fullName, dni, phone, email, address, createdAt) => ({
    id: uid(), fullName, dni, phone, email, address, createdAt,
  })

  const fernando = mkCustomer('Fernando Fleitas', '30123456', '1155554433', 'fernando@mail.com', 'Av. Tecnológica 100', addDays(today, -12))
  const luciano = mkCustomer('Luciano Grossi', '27987654', '1166667788', 'luciano@mail.com', 'Calle Computación 890', addDays(today, -8))
  const mateo = mkCustomer('Mateo Cuella', '33456789', '1177778899', 'mateo@mail.com', 'Belgrano 456', addDays(today, -20))
  const cristian = mkCustomer('Cristian Ramirez', '36765432', '1188889900', 'cristian@mail.com', 'San Martín 678', addDays(today, -3))
  db.customers.push(fernando, luciano, mateo, cristian)

  // ---------- Órdenes ----------
  // OS-0001: recién recibida (pendiente de reparación).
  db.orders.push({
    id: uid(),
    orderNumber: 'OS-0001',
    customerId: fernando.id,
    receivedBy: mostrador.id,
    createdAt: addDays(today, -2),
    items: [
      makeItem({
        brand: 'Samsung', model: 'Galaxy A15', imei: '351234567890123',
        issueDescription: 'No enciende, queda en logo y se apaga.',
        accessories: 'Funda y cargador', priceEstimate: 45000, advance: 0,
        status: 'recibido', createdAt: addDays(today, -2),
        history: [{ status: 'recibido', at: addDays(today, -2), by: mostrador.id }],
      }),
    ],
  })

  // OS-0002: en reparación (un equipo) + otro recién recibido.
  db.orders.push({
    id: uid(),
    orderNumber: 'OS-0002',
    customerId: luciano.id,
    receivedBy: mostrador.id,
    createdAt: addDays(today, -5),
    items: [
      makeItem({
        brand: 'Apple', model: 'iPhone 13', imei: '352222333444555',
        issueDescription: 'Pantalla rota y no responde el táctil.',
        accessories: 'Sin accesorios', priceEstimate: 120000, advance: 30000,
        status: 'en_reparacion', repairedBy: tecnico.id, createdAt: addDays(today, -5),
        history: [
          { status: 'recibido', at: addDays(today, -5), by: mostrador.id },
          { status: 'en_reparacion', at: addDays(today, -4), by: tecnico.id },
        ],
      }),
      makeItem({
        brand: 'Samsung', model: 'Galaxy A54', imei: '353333444555666',
        issueDescription: 'Batería se descarga muy rápido.',
        accessories: '', priceEstimate: 55000, advance: 0,
        status: 'recibido', createdAt: addDays(today, -5),
        history: [{ status: 'recibido', at: addDays(today, -5), by: mostrador.id }],
      }),
    ],
  })

  // OS-0003: listo para retirar (terminado, sin entregar).
  db.orders.push({
    id: uid(),
    orderNumber: 'OS-0003',
    customerId: mateo.id,
    receivedBy: mostrador.id,
    createdAt: addDays(today, -8),
    items: [
      makeItem({
        brand: 'Motorola', model: 'G54', imei: '354444555666777',
        issueDescription: 'No carga con cable, solo inalámbrico.',
        accessories: 'Funda', priceEstimate: 38000, advance: 38000,
        status: 'terminado', repairedBy: tecnico.id, technicianNotes: 'Se cambió el puerto de carga.',
        createdAt: addDays(today, -8),
        history: [
          { status: 'recibido', at: addDays(today, -8), by: mostrador.id },
          { status: 'en_reparacion', at: addDays(today, -7), by: tecnico.id },
          { status: 'terminado', at: addDays(today, -1), by: tecnico.id },
        ],
      }),
    ],
  })

  // OS-0004: entregado (cerrado).
  db.orders.push({
    id: uid(),
    orderNumber: 'OS-0004',
    customerId: cristian.id,
    receivedBy: mostrador.id,
    createdAt: addDays(today, -12),
    items: [
      makeItem({
        brand: 'Xiaomi', model: 'Redmi 12', imei: '355555666777888',
        issueDescription: 'Micrófono no funciona en llamadas.',
        accessories: '', priceEstimate: 25000, advance: 25000,
        status: 'entregado', repairedBy: tecnico.id, technicianNotes: 'Limpieza de módulo de micrófono.',
        createdAt: addDays(today, -12), deliveredAt: addDays(today, -6),
        history: [
          { status: 'recibido', at: addDays(today, -12), by: mostrador.id },
          { status: 'en_reparacion', at: addDays(today, -11), by: tecnico.id },
          { status: 'terminado', at: addDays(today, -7), by: tecnico.id },
          { status: 'entregado', at: addDays(today, -6), by: mostrador.id },
        ],
      }),
    ],
  })

  db.orderCounter = 4

  // ---------- Auditoría inicial ----------
  db.auditLogs.push(
    { id: uid(), userId: admin.id, action: 'seed', table: 'db', recordId: null, details: 'Inicialización del sistema de servicio técnico', timestamp: new Date().toISOString() },
    { id: uid(), userId: tecnico.id, action: 'status', table: 'orderItems', recordId: null, details: 'OS-0002 · iPhone 13: marcado en reparación', timestamp: new Date().toISOString() },
  )

  return db
}