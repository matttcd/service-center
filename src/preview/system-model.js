import { applyDemoAction, createDemoOrders, receptionQueue, TECHNICIAN } from './preview-model.js'

export const NEW_ORDER = { customerId: '', customer: '', phone: '', brand: '', model: '', deviceType: 'Celular', issue: '', access: '', noPin: false, pattern: [], conditions: '', accessories: '', entry: 'review', work: '', price: '', advance: '', confirmed: false, isSimpleService: false, isExternal: false, externalTech: '' }

export const PROFILES = {
  tecnico: { name: 'Juan Pérez', label: 'Técnico', home: '/taller' },
  recepcion: { name: 'Sofía Martín', label: 'Recepción', home: '/recepcion' },
  admin: { name: 'Martín López', label: 'Administrador', home: '/resumen' },
}
export const NAVIGATION = [
  { group: 'Trabajo', items: [['/resumen', 'Resumen', ['admin']], ['/recepcion', 'Recepción', ['recepcion', 'admin']], ['/taller', 'Taller'], ['/terminados', 'Terminados']] },
  { group: 'Consultas', items: [['/ordenes', 'Órdenes'], ['/clientes', 'Clientes', ['recepcion', 'admin']], ['/actividad', 'Actividad']] },
  { group: 'Administración', items: [['/metricas', 'Métricas', ['admin']], ['/usuarios', 'Usuarios', ['admin']], ['/copias', 'Copias de seguridad', ['admin']], ['/papelera', 'Papelera', ['admin']], ['/configuracion', 'Configuración', ['admin']]] },
]
export const canVisit = (path, role) => ['/acceso', '/ajustes'].includes(path) || NAVIGATION.some(({ items }) => items.some(([url, , roles]) => (path === url || path.startsWith(`${url}/`)) && (!roles || roles.includes(role))))
export const initialProfile = (path) => canVisit(path, 'tecnico') ? 'tecnico' : canVisit(path, 'recepcion') ? 'recepcion' : 'admin'
export const money = (n) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(n || 0)
export const date = (n) => new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short' }).format(n)

export function createSystemState(now = Date.now()) {
  const orders = createDemoOrders(now)
  orders.push(
    { ...structuredClone(orders[0]), id: 'demo-OS1033', number: 'OS1033', customer: 'Ana Ruiz', brand: 'Apple', model: 'iPad 9', status: 'en_tercero', externalTech: 'Laboratorio Sur', createdAt: now - 3 * 86400000, statusSince: now - 86400000, work: 'Revisar placa de carga.', history: [{ text: 'Enviado a Laboratorio Sur', by: 'Sofía · Recepción', at: now - 86400000 }] },
    { ...structuredClone(orders[1]), id: 'demo-OS1048', number: 'OS1048', customer: 'Lucía Torres', model: 'iPhone SE', isSimpleService: true, work: 'Limpieza de conector', price: 8000, history: [{ text: 'Servicio simple recibido', by: 'Sofía · Recepción', at: now }] },
    { ...structuredClone(orders[7]), id: 'demo-OS1010', number: 'OS1010', customer: 'Gabriel Paz', status: 'entregado', notified: true, deliveredAt: now - 86400000, history: [{ text: 'Equipo entregado', by: 'Sofía · Recepción', at: now - 86400000 }] },
  )
  const customers = [...new Set(orders.map((o) => o.customer))].map((name, i) => ({ id: `client-${i}`, name, dni: String(30000100 + i), phone: orders.find((o) => o.customer === name).phone, phone2: i === 3 ? '11 5555-0203' : '', phone3: i === 3 ? '11 5555-0303' : '', email: i === 3 ? 'marcos.vega@example.invalid' : '', address: `Calle de Ejemplo ${120 + i}` }))
  for (const o of orders) o.customerId = customers.find((c) => c.name === o.customer).id
  return {
    orders, customers,
    users: [{ id: TECHNICIAN, name: 'Juan Pérez', role: 'tecnico', active: true }, { id: 'demo-diego', name: 'Diego Molina', role: 'tecnico', active: true }, { id: 'demo-sofia', name: 'Sofía Martín', role: 'recepcion', active: true }, { id: 'demo-admin', name: 'Martín López', role: 'admin', active: true }],
    settings: { revisionFee: 3500, business: 'El Gringo', phone: '11 5555-0100', address: 'Av. de ejemplo 123', orderPrinter: 'Impresora de comprobantes (demo)', labelPrinter: 'Etiquetadora (demo)', paper: 'A4', labelWidth: '50', labelHeight: '30', labelFormat: 'PDF', accessories: 'Funda\nCargador\nTarjeta SIM', conditions: 'Marcas de uso\nPantalla rota\nGolpeado', fixes: 'Cambio de módulo\nCambio de batería\nPin de carga', terms: 'Presupuesto sujeto a revisión. Conservar el comprobante para retirar el equipo.', externals: 'Laboratorio Sur\nElectrónica Centro', catalog: ['Samsung Galaxy A54', 'Apple iPhone 13', 'Motorola Moto G84'] },
    backups: [], audit: [],
  }
}

export function activity(state) {
  return [...state.audit, ...state.orders.flatMap((o) => o.history.map((event) => ({ ...event, orderId: o.id, number: o.number })))].sort((a, b) => b.at - a.at)
}
export function overview(state) {
  const orders = state.orders.filter((o) => !o.deletedAt)
  return { active: orders.filter((o) => o.status !== 'entregado').length, delivered: orders.filter((o) => o.status === 'entregado').length, quoted: orders.reduce((sum, o) => sum + (o.rejectedCharge ?? o.price), 0), advances: orders.reduce((sum, o) => sum + o.advance, 0), pending: Object.fromEntries(['presupuestar', 'avisar', 'respuesta', 'repuestos', 'retiros', 'externos', 'simples'].map((key) => [key, orders.filter((o) => receptionQueue(o) === key).length])) }
}

// shortcut: solo estado de demostración; la integración real requiere autorización y transacciones del servidor.
export function applySystemAction(state, action, payload, role, now = Date.now()) {
  const next = structuredClone(state)
  const require = (ok, message) => { if (!ok) throw new Error(message) }
  const counter = ['admin', 'recepcion'].includes(role)
  const admin = role === 'admin'
  const user = PROFILES[role]
  require(user, 'Perfil inválido.')
  const audit = (text) => next.audit.push({ text, by: `${user.name} · ${user.label}`, at: now })
  const requiredText = (value, label) => { require(typeof value === 'string' && value.trim(), `Completá ${label}.`); return value.trim() }
  const amount = (value) => { require(value !== '' && Number.isFinite(Number(value)) && Number(value) >= 0, 'Ingresá un importe válido.'); return Number(value) }
  if (action === 'orderAction') {
    const index = next.orders.findIndex((o) => o.id === payload.id && !o.deletedAt)
    require(index >= 0, 'Orden no encontrada.')
    next.orders[index] = applyDemoAction(next.orders[index], payload.action, payload.data, role, now)
  } else if (action === 'customer') {
    require(counter, 'Solo Recepción o Administración pueden editar clientes.')
    const customer = { ...next.customers.find((c) => c.id === payload.id), id: payload.id || `client-${now}`, name: requiredText(payload.name, 'el nombre'), phone: requiredText(payload.phone, 'el teléfono'), email: String(payload.email || '').trim(), address: String(payload.address || '').trim() }
    if (payload.id) {
      const index = next.customers.findIndex((c) => c.id === payload.id && !c.deletedAt)
      require(index >= 0, 'Cliente no encontrado.')
      next.customers[index] = customer
      next.orders = next.orders.map((o) => o.customerId === customer.id ? { ...o, customer: customer.name, phone: customer.phone } : o)
    } else next.customers.push(customer)
    audit(payload.id ? 'Cliente actualizado' : 'Cliente creado')
  } else if (action === 'createOrder') {
    require(counter, 'Solo Recepción o Administración pueden ingresar equipos.')
    let customer = next.customers.find((c) => c.id === payload.customerId && !c.deletedAt)
    if (!customer) {
      customer = { id: `client-${now}`, name: requiredText(payload.customer, 'el cliente'), phone: requiredText(payload.phone, 'el teléfono'), email: '', address: '' }
      next.customers.push(customer)
    }
    const repair = payload.entry === 'repair' || payload.isSimpleService
    require(!(payload.isExternal && payload.isSimpleService), 'Elegí servicio simple o técnico externo.')
    require(!payload.isExternal || String(payload.externalTech || '').trim(), 'Elegí el técnico externo.')
    const number = `OS${Math.max(...next.orders.map((o) => Number(o.number.slice(2)))) + 1}`
    const price = repair ? amount(payload.price) : 0
    require(!repair || price > 0, 'Ingresá el presupuesto de la reparación.')
    const advance = amount(payload.advance || 0)
    require(!repair || advance <= price, 'La seña supera el presupuesto.')
    const work = repair ? requiredText(payload.work, 'el trabajo') : ''
    const order = {
      id: `demo-${number}`, number, customerId: customer.id, customer: customer.name, phone: customer.phone,
      deviceType: payload.deviceType || 'Celular', brand: requiredText(payload.brand, 'la marca'), model: requiredText(payload.model, 'el modelo'),
      issue: requiredText(payload.issue, 'la falla informada'), access: payload.noPin ? '' : String(payload.access || ''), pattern: payload.noPin ? [] : payload.pattern || [],
      conditions: payload.conditions || 'Sin registrar', accessories: payload.accessories || 'Sin accesorios', assignedTo: null, acceptedAt: null,
      createdAt: now, entry: repair ? 'repair' : 'review', noPin: !!payload.noPin, receivedByName: user.name, externalSentAt: payload.isExternal ? now : null, statusSince: now, status: payload.isExternal ? 'en_tercero' : repair && !payload.isSimpleService ? 'presupuesto' : 'recibido', externalTech: payload.isExternal ? payload.externalTech : null, diagnosis: '', work, workAuthor: work ? { name: user.name.split(' ')[0], role } : null,
      price, advance, confirmed: repair && !!payload.confirmed, notified: repair && !!payload.confirmed, rejectedCharge: null, notes: [], parts: [],
      isSimpleService: !!payload.isSimpleService, warrantyReturn: false,
      history: [{ text: work ? 'Equipo ingresado para reparación' : 'Equipo ingresado para revisión', ...(work ? { work } : {}), by: `${user.name} · ${user.label}`, at: now }],
    }
    next.orders.push(order)
  } else if (action === 'assign') {
    require(counter, 'Acción exclusiva de Recepción o Administración.')
    const order = next.orders.find((o) => o.id === payload.id && !o.deletedAt && o.status !== 'entregado')
    require(order, 'Orden no disponible.')
    const technician = next.users.find((u) => u.id === payload.technician && u.active && u.role === 'tecnico')
    require(technician, 'Elegí un técnico activo.')
    if (order.assignedTo !== technician.id) {
      order.assignedTo = technician.id; order.acceptedAt = null; order.needsAcceptance = true
      order.history.push({ text: `Asignado a ${technician.name}`, by: `${user.name} · ${user.label}`, at: now })
    }
  } else if (action === 'user') {
    require(admin, 'Acción exclusiva de Administración.')
    require(['tecnico', 'recepcion', 'admin'].includes(payload.role), 'Rol inválido.')
    const record = { id: payload.id || `user-${now}`, name: requiredText(payload.name, 'el nombre'), role: payload.role, active: payload.active !== false }
    if (payload.id) { const i = next.users.findIndex((u) => u.id === payload.id); require(i >= 0, 'Usuario no encontrado.'); next.users[i] = record }
    else next.users.push(record)
    require(next.users.some((u) => u.role === 'admin' && u.active), 'Debe quedar un administrador activo.')
    audit('Usuario actualizado')
  } else if (action === 'settings') {
    require(admin, 'Acción exclusiva de Administración.')
    next.settings = { ...next.settings, ...payload }
    amount(next.settings.revisionFee)
    require(next.settings.business.trim(), 'Completá el nombre del local.')
    require(Number(next.settings.labelWidth) > 0 && Number(next.settings.labelHeight) > 0, 'Medidas de etiqueta inválidas.')
    audit('Configuración actualizada')
  } else if (action === 'catalog') {
    require(admin, 'Acción exclusiva de Administración.')
    const rows = requiredText(payload.text, 'el catálogo').split(/\r?\n/).map((s) => s.trim()).filter(Boolean)
    next.settings.catalog = [...new Set([...next.settings.catalog, ...rows])]
    audit(`Catálogo: ${rows.length} modelos importados (simulación)`)
  } else if (action === 'trash' || action === 'restore') {
    require(admin, 'Acción exclusiva de Administración.')
    require(['orders', 'customers'].includes(payload.kind), 'Elemento inválido.')
    const item = next[payload.kind].find((r) => r.id === payload.id)
    require(item, 'Elemento no encontrado.')
    if (action === 'trash') {
      item.deletedAt = now
      if (payload.kind === 'customers') for (const o of next.orders.filter((o) => o.customerId === item.id && !o.deletedAt)) { o.deletedAt = now; o.deletedWithCustomer = item.id }
      audit('Elemento enviado a Papelera')
    } else {
      delete item.deletedAt
      if (payload.kind === 'customers') for (const o of next.orders.filter((o) => o.deletedWithCustomer === item.id)) { delete o.deletedAt; delete o.deletedWithCustomer }
      if (payload.kind === 'orders') { const c = next.customers.find((c) => c.id === item.customerId); if (c) delete c.deletedAt; delete item.deletedWithCustomer }
      audit('Elemento restaurado')
    }
  } else if (action === 'backup') {
    require(admin, 'Acción exclusiva de Administración.')
    const { backups: _backups, ...snapshot } = structuredClone(next)
    next.backups.unshift({ id: `backup-${now}`, at: now, name: `Copia de demostración ${next.backups.length + 1}`, snapshot })
    audit('Copia de demostración creada')
  } else if (action === 'restoreBackup') {
    require(admin, 'Acción exclusiva de Administración.')
    const backup = next.backups.find((b) => b.id === payload.id)
    require(backup, 'Copia no encontrada en esta sesión.')
    Object.assign(next, structuredClone(backup.snapshot))
    audit('Copia de demostración restaurada')
  } else throw new Error('Acción desconocida.')
  return next
}
