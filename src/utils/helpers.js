// ============================================
// Funciones auxiliares: fechas, moneda, estados
// ============================================

// Genera un id único.
export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9)
}

function pad(n) {
  return String(n).padStart(2, '0')
}

// Palabras que se mantienen en MAYÚSCULAS aunque el resto se normalice.
const KEEP_UPPER = new Set([
  'TV', 'HD', 'HDMI', 'LED', 'LCD', 'OLED', 'QLED', '4K', '8K', '2K',
  'USB', 'LG', 'HP', 'PS5', 'PS4', 'PS3', 'XBOX', 'LTE', '4G', '5G',
  'GPS', 'DVR', 'AV', 'JVC', 'UPS', 'SSD', 'RAM', 'CPU', 'GPU', '3000F',
  'SAMSUNG', 'XIAOMI', 'MOTOROLA', 'APPLE', 'HUAWEI', 'LENOVO', 'NOKIA',
  'REALME', 'REDMI', 'GALAXY',
])

// Marcas/casos especiales que quieren capitalización exacta.
const SPECIAL = { IPHONE: 'iPhone', IOS: 'iOS' }

// Pone la primera letra de cada palabra en mayúscula y el resto en minúscula.
export function titleCase(s) {
  return String(s || '')
    .trim()
    .split(/\s+/)
    .map((w) => {
      if (!w) return w
      const up = w.toUpperCase()
      if (SPECIAL[up]) return SPECIAL[up]
      if (KEEP_UPPER.has(up)) return up
      return w[0].toUpperCase() + w.slice(1).toLowerCase()
    })
    .join(' ')
}

// Convierte una Date a formato ISO local (YYYY-MM-DD).
export function toISODate(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Fecha de hoy en formato ISO.
export function todayISO() {
  return toISODate(new Date())
}

// Parsea una fecha ISO a Date local (sin zona horaria).
export function parseISO(iso) {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// Suma días a una fecha ISO y devuelve otra fecha ISO.
export function addDays(iso, days) {
  const d = parseISO(iso)
  d.setDate(d.getDate() + days)
  return toISODate(d)
}

// Formatea un monto en pesos argentinos.
export function formatMoney(n) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    maximumFractionDigits: 2,
  }).format(n || 0)
}

// Formatea una fecha ISO (YYYY-MM-DD) a DD/MM/YYYY.
export function formatDate(iso) {
  if (!iso) return '—'
  const d = parseISO(iso)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

// Formatea un timestamp ISO completo a fecha y hora local.
export function formatDateTime(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ---------- Estados de los equipos ----------
export const ITEM_STATUSES = ['recibido', 'en_reparacion', 'terminado', 'entregado']

export const ITEM_STATUS_LABEL = {
  recibido: 'Recibido',
  en_reparacion: 'En reparación',
  terminado: 'Listo para retirar',
  entregado: 'Entregado',
}

// Tono del badge según el estado del equipo.
export function itemStatusTone(status) {
  const map = {
    recibido: 'slate',
    en_reparacion: 'primary',
    terminado: 'green',
    entregado: 'slate',
  }
  return map[status] || 'slate'
}

// Estado de la orden derivado de sus equipos.
export function orderStatus(order) {
  const items = order.items || []
  if (items.length && items.every((i) => i.status === 'entregado')) return 'entregada'
  if (items.some((i) => i.status === 'terminado')) return 'lista'
  if (items.some((i) => i.status === 'en_reparacion')) return 'en_reparacion'
  return 'recibida'
}

export const ORDER_STATUS_LABEL = {
  recibida: 'Recibida',
  en_reparacion: 'En reparación',
  lista: 'Lista para retirar',
  entregada: 'Entregada',
}

export function orderStatusTone(status) {
  const map = {
    recibida: 'slate',
    en_reparacion: 'primary',
    lista: 'green',
    entregada: 'slate',
  }
  return map[status] || 'slate'
}

// Roles de usuario.
export const ROLE_LABEL = {
  admin: 'Administrador',
  tecnico: 'Técnico',
  mostrador: 'Mostrador',
}