// ============================================
// Funciones auxiliares del servidor (fechas e ids).
// La normalización de texto vive en ../shared/text.js
// ============================================
export { titleCase, sentenceCase, normalizeList } from '../shared/text.js'

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

// Parsea una fecha ISO a Date local.
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

// Días entre dos fechas ISO (to - from).
export function daysBetween(fromISO, toISO) {
  const a = parseISO(fromISO).getTime()
  const b = parseISO(toISO).getTime()
  return Math.round((b - a) / 86400000)
}