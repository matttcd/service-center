// ============================================
// Funciones auxiliares: fechas, moneda, estados
// ============================================

// Normalización de texto (fuente única en ../../shared/text.js)
export { titleCase, sentenceCase, normalizeList } from '../../shared/text.js'
// Estados de una orden (fuente única en ../../shared/fsm.js)
export { ORDER_STATUSES, ORDER_STATUS_LABEL } from '../../shared/fsm.js'

// Genera un id único.
export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'id-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9)
}

function pad(n) {
  return String(n).padStart(2, '0')
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

// Convierte un ISO (fecha sola o timestamp completo) a milisegundos.
// Las fechas solas (YYYY-MM-DD) se interpretan en hora local.
export function toTime(iso) {
  if (!iso) return 0
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return parseISO(iso).getTime()
  const t = new Date(iso).getTime()
  return Number.isFinite(t) ? t : 0
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

// Tiempo relativo ("hace 2h", "ayer", "hace 3 días").
export function timeAgo(iso) {
  if (!iso) return ''
  const now = Date.now()
  const diff = now - toTime(iso)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'ahora'
  if (mins < 60) return `hace ${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `hace ${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days === 1) return 'ayer'
  if (days < 30) return `hace ${days}d`
  const months = Math.floor(days / 30)
  return `hace ${months}m`
}

export function timeSinceStatus(order, targetStatus) {
  const entry = [...(order.history || [])].reverse().find((h) => h.status === targetStatus)
  return timeAgo(entry?.at || order.createdAt)
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// Tono del badge según el estado.
export function orderStatusTone(status) {
  const map = {
    recibido: 'slate',
    en_revision: 'primary',
    presupuesto: 'yellow',
    en_reparacion: 'primary',
    falta_repuestos: 'orange',
    terminado: 'green',
    entregado: 'slate',
  }
  return map[status] || 'slate'
}

// Roles de usuario.
export const ROLE_LABEL = {
  admin: 'Administrador',
  tecnico: 'Técnico',
  mostrador: 'Empleado',
}
