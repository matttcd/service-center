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
  'SIM', 'SD',
])

// Casos especiales que quieren capitalización exacta.
const SPECIAL = {
  IPHONE: 'iPhone',
  IOS: 'iOS',
  GALAXY: 'Galaxy',
  SAMSUNG: 'Samsung',
  XIAOMI: 'Xiaomi',
  MOTOROLA: 'Motorola',
  APPLE: 'Apple',
  HUAWEI: 'Huawei',
  LENOVO: 'Lenovo',
  NOKIA: 'Nokia',
  REALME: 'Realme',
  REDMI: 'Redmi',
  POCO: 'POCO',
}

// Palabras cortas (artículos/preposiciones) que van en minúscula en Title Case.
const LOWERCASE_WORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'y', 'o', 'u', 'e', 'con', 'en',
  'a', 'al', 'por', 'para', 'un', 'una', 'se', 'su', 'sus', 'mi', 'tu',
])

function capitalizeWord(w) {
  if (!w) return w
  const up = w.toUpperCase()
  if (SPECIAL[up]) return SPECIAL[up]
  if (KEEP_UPPER.has(up)) return up
  return w[0].toUpperCase() + w.slice(1).toLowerCase()
}

// Pone la primera letra de cada palabra en mayúscula y el resto en minúscula.
export function titleCase(s) {
  return String(s || '')
    .trim()
    .split(/\s+/)
    .map((w, i) => {
      if (!w) return w
      const up = w.toUpperCase()
      if (SPECIAL[up]) return SPECIAL[up]
      if (KEEP_UPPER.has(up)) return up
      if (i > 0 && LOWERCASE_WORDS.has(w.toLowerCase())) return w.toLowerCase()
      return capitalizeWord(w)
    })
    .join(' ')
}

// Normaliza texto libre largo: primera letra de cada oración en mayúscula.
export function sentenceCase(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/(^|[.!?;]\s+)(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase())
    .split(/(\s+)/)
    .map((w) => {
      if (!w.trim()) return w
      const up = w.toUpperCase()
      if (SPECIAL[up]) return SPECIAL[up]
      if (KEEP_UPPER.has(up)) return up
      return w
    })
    .join('')
}

// Normaliza una lista separada por comas (titleCase por ítem) y la rearma.
export function normalizeList(s, mode = 'title') {
  const fn = mode === 'sentence' ? sentenceCase : titleCase
  return String(s || '')
    .split(',')
    .map((item) => fn(item))
    .filter(Boolean)
    .join(', ')
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

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

// ---------- Estados de una orden ----------
export const ORDER_STATUSES = ['recibido', 'en_revision', 'presupuesto', 'en_reparacion', 'terminado', 'entregado']

export const ORDER_STATUS_LABEL = {
  recibido: 'Recibido',
  en_revision: 'En revisión',
  presupuesto: 'Presupuesto',
  en_reparacion: 'En reparación',
  terminado: 'Listo para retirar',
  entregado: 'Entregado',
}

// Tono del badge según el estado.
export function orderStatusTone(status) {
  const map = {
    recibido: 'slate',
    en_revision: 'primary',
    presupuesto: 'yellow',
    en_reparacion: 'primary',
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