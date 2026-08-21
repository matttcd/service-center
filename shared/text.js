// ============================================
// Normalización de texto (fuente única de verdad, compartida por
// el backend y el frontend). JS puro, sin APIs de plataforma.
// ============================================

// Palabras que se mantienen en MAYÚSCULAS aunque el resto se normalice.
export const KEEP_UPPER = new Set([
  'TV', 'HD', 'HDMI', 'LED', 'LCD', 'OLED', 'QLED', '4K', '8K', '2K',
  'USB', 'LG', 'HP', 'PS5', 'PS4', 'PS3', 'XBOX', 'LTE', '4G', '5G',
  'GPS', 'DVR', 'AV', 'JVC', 'UPS', 'SSD', 'RAM', 'CPU', 'GPU', '3000F',
  'SIM', 'SD',
])

// Casos especiales que quieren capitalización exacta.
export const SPECIAL = {
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
// Respeta marcas (SPECIAL), acrónimos (KEEP_UPPER) y deja en minúscula
// artículos/preposiciones cortas (LOWERCASE_WORDS).
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

// Normaliza texto libre largo: primera letra de cada oración en mayúscula,
// el resto en minúscula (respeta marcas/acrónimos dentro de la oración).
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
