export const TECHNICIAN = 'demo-juan'
export const ROLE_NAMES = { tecnico: 'Juan · Técnico', recepcion: 'Sofía · Recepción' }
export const REVIEW_FEE = 3500
export const STATUS_LABELS = {
  recibido: 'Sin iniciar', en_revision: 'En revisión', presupuesto: 'Presupuesto',
  en_reparacion: 'En reparación', falta_repuestos: 'Espera repuestos',
  terminado: 'Listo para retirar', presupuesto_rechazado: 'Sin reparar', entregado: 'Entregado',
}
export const RECEPTION_VIEWS = [
  ['presupuestar', 'Presupuestar'], ['avisar', 'Avisar'], ['respuesta', 'Respuesta'],
  ['repuestos', 'Repuestos'], ['retiros', 'Retiros'],
]
export const TECH_VIEWS = [['mine', 'Mis trabajos'], ['available', 'Sin asignar'], ['all', 'Todo el taller']]

export function createDemoOrders(now = Date.now()) {
  const day = 86400000
  const seeds = [
    { number: 'OS1042', brand: 'Samsung', model: 'Galaxy A54', customer: 'Ana Ruiz', issue: 'No carga. El cable queda flojo.', status: 'en_revision', days: 2, diagnosis: 'El conector USB-C tiene desgaste y contactos dañados.', work: 'Reemplazar conector de carga y comprobar carga rápida.' },
    { number: 'OS1047', brand: 'Apple', model: 'iPhone 13', customer: 'Lucía Torres', issue: 'Se apaga aunque indique batería disponible.', status: 'recibido', assignedTo: null, days: 1, diagnosis: '', work: '' },
    { number: 'OS1044', brand: 'Motorola', model: 'Moto G84', customer: 'Tomás Ríos', issue: 'Pantalla rota. El táctil no responde.', status: 'en_reparacion', days: 2, diagnosis: 'Módulo de pantalla dañado por golpe.', work: 'Cambiar módulo y probar imagen y táctil.', price: 65000, advance: 20000 },
    { number: 'OS1038', brand: 'HP', model: 'Notebook 14', customer: 'Marcos Vega', issue: 'Enciende pero no inicia Windows.', status: 'presupuesto', deviceType: 'Notebook', days: 3, diagnosis: 'El SSD presenta errores de lectura.', work: 'Reemplazar SSD de 500 GB e instalar el sistema.' },
    { number: 'OS1035', brand: 'Apple', model: 'iPhone 11', customer: 'Paula Díaz', issue: 'La batería dura menos de dos horas.', status: 'presupuesto', days: 4, diagnosis: 'Batería con capacidad degradada.', work: 'Cambiar batería y comprobar autonomía.', price: 45000, notified: true },
    { number: 'OS1031', brand: 'Sony', model: 'PlayStation 5', customer: 'Nicolás Costa', deviceType: 'Consola', issue: 'Se apaga al abrir un juego.', status: 'presupuesto', days: 5, diagnosis: 'Sobretemperatura por obstrucción de la ventilación.', work: 'Limpiar refrigeración y realizar prueba bajo carga.', price: 38000, notified: true, confirmed: true },
    { number: 'OS1029', brand: 'Lenovo', model: 'IdeaPad 3', customer: 'Carla Luna', deviceType: 'Notebook', issue: 'Muy lenta al iniciar y abrir programas.', status: 'falta_repuestos', days: 5, diagnosis: 'Disco mecánico con sectores defectuosos.', work: 'Reemplazar disco por SSD.', price: 58000, advance: 15000, parts: [{ id: 'part-1029', name: 'SSD SATA 500 GB', quantity: 1, status: 'pedido' }] },
    { number: 'OS1024', brand: 'Samsung', model: 'Galaxy A32', customer: 'Gabriel Paz', issue: 'No se escucha durante las llamadas.', status: 'terminado', days: 6, assignedTo: 'demo-diego', diagnosis: 'Auricular interno dañado.', work: 'Reemplazar auricular y comprobar llamadas.', price: 42000, advance: 10000 },
    { number: 'OS1020', brand: 'LG', model: 'Monitor 24MP', customer: 'Valeria Sol', deviceType: 'Monitor', issue: 'Imagen intermitente.', status: 'presupuesto_rechazado', days: 7, assignedTo: 'demo-diego', diagnosis: 'Falla de alimentación del panel.', work: 'Reemplazar placa de alimentación.', price: 30000, advance: 5000, rejectedCharge: 3500, notified: true },
    { number: 'OS1040', brand: 'Xiaomi', model: 'Redmi Note 13', customer: 'Mateo Gil', issue: 'La cámara no enfoca.', status: 'en_reparacion', days: 3, assignedTo: 'demo-diego', diagnosis: 'Módulo de cámara defectuoso.', work: 'Cambiar cámara y probar enfoque.', price: 49000 },
  ]
  return seeds.map((seed, i) => {
    const createdAt = now - seed.days * day
    return {
      deviceType: 'Celular', assignedTo: TECHNICIAN, price: 0, advance: 0,
      notified: false, confirmed: false, rejectedCharge: null, parts: [], notes: [],
      ...seed, id: `demo-${seed.number}`, createdAt, statusSince: createdAt + 3600000,
      phone: `11 5555-${String(100 + i).padStart(4, '0')}`, access: '2580 (ejemplo)',
      accessories: 'Sin accesorios', conditions: 'Marcas de uso en carcasa',
      history: [{ text: 'Equipo recibido por Sofía', by: 'Recepción', at: createdAt }],
    }
  })
}

export function receptionQueue(order) {
  if (order.status === 'presupuesto') {
    if (order.price <= 0) return 'presupuestar'
    if (!order.notified) return 'avisar'
    if (!order.confirmed) return 'respuesta'
  }
  if (order.status === 'falta_repuestos' && order.parts.some((part) => part.status !== 'recibido')) return 'repuestos'
  if (order.status === 'terminado' && !order.notified) return 'avisar'
  if (order.status === 'presupuesto_rechazado' || (order.status === 'terminado' && order.notified)) return 'retiros'
  return null
}

export function nextAction(order, role) {
  if (order.status === 'entregado') return null
  if (role === 'tecnico') {
    if (order.status === 'recibido' && !order.assignedTo) return { id: 'claim', label: 'Tomar e iniciar revisión' }
    if (order.assignedTo !== TECHNICIAN) return null
    if (order.status === 'recibido') return { id: 'startReview', label: 'Iniciar revisión' }
    if (order.status === 'en_revision') return { id: 'sendQuote', label: 'Enviar a recepción' }
    if (order.status === 'presupuesto' && order.confirmed) return { id: 'startRepair', label: 'Iniciar reparación' }
    if (order.status === 'en_reparacion') return { id: 'finish', label: 'Finalizar reparación' }
    if (order.status === 'falta_repuestos' && order.parts.length && order.parts.every((part) => part.status === 'recibido')) return { id: 'resume', label: 'Retomar reparación' }
  } else {
    const queue = receptionQueue(order)
    if (queue === 'presupuestar') return { id: 'price', label: 'Guardar presupuesto' }
    if (queue === 'avisar') return { id: 'notify', label: 'Registrar aviso al cliente' }
    if (queue === 'respuesta') return { id: 'response', label: 'Registrar respuesta' }
    if (queue === 'repuestos') {
      const part = order.parts.find((item) => item.status !== 'recibido')
      return { id: part.status === 'necesario' ? 'partOrdered' : 'partArrived', label: part.status === 'necesario' ? 'Registrar pedido' : 'Registrar llegada', partId: part.id, partName: part.name }
    }
    if (queue === 'retiros') return { id: 'pickup', label: 'Registrar entrega' }
  }
  return null
}

export function waitingFor(order) {
  if (order.status === 'presupuesto') {
    if (!order.price) return { text: 'Recepción debe cargar el precio del presupuesto.', owner: 'Recepción' }
    if (!order.notified) return { text: 'Recepción debe comunicar el presupuesto al cliente.', owner: 'Recepción' }
    if (!order.confirmed) return { text: 'El cliente debe responder al presupuesto.', owner: 'Cliente' }
    return { text: 'Presupuesto aprobado. El técnico puede iniciar la reparación.', owner: 'Taller', ready: true }
  }
  if (order.status === 'falta_repuestos') {
    const ready = order.parts.length > 0 && order.parts.every((part) => part.status === 'recibido')
    return { text: ready ? 'Todos los repuestos llegaron. El técnico puede retomar.' : 'Recepción está gestionando los repuestos solicitados.', owner: ready ? 'Taller' : 'Recepción', ready }
  }
  if (order.status === 'terminado') return { text: order.notified ? 'El cliente ya fue avisado. Falta el retiro físico.' : 'Reparación finalizada. Recepción debe avisar al cliente.', owner: order.notified ? 'Cliente' : 'Recepción' }
  if (order.status === 'presupuesto_rechazado') return { text: 'Presupuesto rechazado. El equipo sigue en el local, pendiente de retiro.', owner: 'Cliente' }
  return null
}

export function queueOrders(orders, role, view, search = '') {
  const q = search.trim().toLocaleLowerCase('es')
  return orders.filter((order) => {
    if (order.status === 'entregado') return false
    if (q && !`${order.number} ${order.brand} ${order.model} ${order.customer}`.toLocaleLowerCase('es').includes(q)) return false
    if (role === 'recepcion') return receptionQueue(order) === view
    if (view === 'available') return !order.assignedTo && order.status === 'recibido'
    if (view === 'mine') return order.assignedTo === TECHNICIAN && !['terminado', 'presupuesto_rechazado'].includes(order.status)
    return true
  }).sort((a, b) => {
    const actionable = (order) => !!nextAction(order, role)
    return Number(actionable(b)) - Number(actionable(a)) || a.statusSince - b.statusSince
  })
}

export function charges(order) {
  const total = order.rejectedCharge ?? order.price
  return { total, balance: Math.round((total - order.advance) * 100) / 100 }
}

// shortcut: simulación en memoria; al integrar se reemplaza por operaciones transaccionales del servidor.
export function applyDemoAction(order, action, payload = {}, role = 'tecnico', now = Date.now()) {
  const next = structuredClone(order)
  const own = role === 'tecnico' && order.assignedTo === TECHNICIAN
  const counter = role === 'recepcion'
  let text
  const require = (condition, message) => { if (!condition) throw new Error(message) }
  const setStatus = (status) => { next.status = status; next.statusSince = now }
  if (action === 'saveWork') {
    require(own && ['en_revision', 'en_reparacion'].includes(order.status), 'Este trabajo corresponde a otro técnico o está en espera.')
    next.diagnosis = String(payload.diagnosis || '').trim()
    next.work = String(payload.work || '').trim()
    text = 'Diagnóstico y trabajo guardados'
  } else if (['claim', 'startReview', 'sendQuote', 'startRepair', 'finish', 'resume'].includes(action)) {
    require(nextAction(order, role)?.id === action, 'Esta acción ya no está disponible para este equipo.')
    if (action === 'claim') { next.assignedTo = TECHNICIAN; setStatus('en_revision'); text = 'Juan tomó el equipo e inició la revisión' }
    if (action === 'startReview') { setStatus('en_revision'); text = 'Revisión iniciada' }
    if (action === 'sendQuote') {
      next.diagnosis = String(payload.diagnosis ?? next.diagnosis).trim()
      next.work = String(payload.work ?? next.work).trim()
      require(next.diagnosis && next.work, 'Completá el diagnóstico y el trabajo propuesto.')
      setStatus('presupuesto'); next.price = 0; next.notified = false; next.confirmed = false
      text = 'Diagnóstico enviado a recepción para presupuestar'
    }
    if (action === 'startRepair' || action === 'resume') { setStatus('en_reparacion'); text = action === 'resume' ? 'Reparación retomada' : 'Reparación iniciada' }
    if (action === 'finish') {
      next.diagnosis = String(payload.diagnosis ?? next.diagnosis).trim()
      next.work = String(payload.work ?? next.work).trim()
      setStatus('terminado'); next.notified = false; text = 'Reparación finalizada. Recepción debe avisar al cliente'
    }
  } else if (action === 'price') {
    require(counter && order.status === 'presupuesto' && !order.confirmed, 'Recepción debe gestionar el presupuesto pendiente.')
    require(payload.price !== '' && Number.isFinite(Number(payload.price)) && Number(payload.price) > 0, 'Ingresá un presupuesto mayor a cero.')
    next.price = Number(payload.price); next.notified = false; text = 'Presupuesto guardado'
  } else if (action === 'notify') {
    require(counter && receptionQueue(order) === 'avisar', 'No hay un aviso pendiente para esta orden.')
    next.notified = true; text = 'Recepción registró que avisó al cliente'
  } else if (action === 'approve' || action === 'reject') {
    require(counter && receptionQueue(order) === 'respuesta', 'Primero cargá el presupuesto y registrá el aviso.')
    if (action === 'approve') { next.confirmed = true; text = 'El cliente aprobó el presupuesto. Taller puede continuar' }
    else {
      require(payload.charge !== '' && payload.charge !== undefined && Number.isFinite(Number(payload.charge)) && Number(payload.charge) >= 0, 'Ingresá el importe de revisión, incluso si es cero.')
      next.rejectedCharge = Number(payload.charge); next.confirmed = false; setStatus('presupuesto_rechazado')
      text = 'Presupuesto rechazado. Equipo pendiente de retiro sin reparar'
    }
  } else if (action === 'requestPart') {
    require(own && ['en_reparacion', 'falta_repuestos'].includes(order.status), 'Solo el técnico encargado puede solicitar un repuesto durante la reparación.')
    require(String(payload.name || '').trim(), 'Escribí qué repuesto necesitás.')
    require(Number.isInteger(Number(payload.quantity)) && Number(payload.quantity) >= 1 && Number(payload.quantity) <= 99, 'Ingresá una cantidad entre 1 y 99.')
    next.parts.push({ id: `part-${now}-${next.parts.length}`, name: payload.name.trim(), quantity: Number(payload.quantity), status: 'necesario' })
    setStatus('falta_repuestos'); text = `Repuesto solicitado: ${payload.name.trim()}`
  } else if (action === 'partOrdered' || action === 'partArrived') {
    require(counter && order.status === 'falta_repuestos', 'Recepción gestiona el pedido y la llegada de repuestos.')
    const part = next.parts.find((item) => item.id === payload.id)
    require(part && part.status === (action === 'partOrdered' ? 'necesario' : 'pedido'), 'El repuesto cambió de estado.')
    part.status = action === 'partOrdered' ? 'pedido' : 'recibido'
    text = `${action === 'partOrdered' ? 'Pedido registrado' : 'Llegada registrada'}: ${part.name}`
  } else if (action === 'note') {
    require(order.status !== 'entregado' && (own || counter), 'No podés agregar una nota a este equipo.')
    require(String(payload.text || '').trim(), 'Escribí la nota antes de guardarla.')
    next.notes.push({ id: `note-${now}-${next.notes.length}`, text: payload.text.trim(), by: ROLE_NAMES[role], at: now })
    text = 'Nota agregada'
  } else if (action === 'pickup') {
    require(counter && receptionQueue(order) === 'retiros' && payload.physical === true, 'Confirmá el retiro físico del equipo.')
    require(['client', 'third'].includes(payload.by), 'Indicá quién retira.')
    if (payload.by === 'third') require(String(payload.name || '').trim() && /^\d{6,8}$/.test(String(payload.dni || '')), 'Ingresá nombre y DNI válido de quien retira.')
    next.pickup = payload; setStatus('entregado'); text = 'Entrega física registrada'
  } else throw new Error('Acción desconocida.')
  next.history.push({ text, by: ROLE_NAMES[role], at: now })
  return next
}
