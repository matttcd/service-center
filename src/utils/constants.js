// ============================================
// Listas editables para badges del formulario de órdenes
// (accesorios y arreglos comunes; marcas/modelos vienen del catálogo en BD)
// ============================================

// Accesorios que el cliente puede dejar con el equipo.
export const COMMON_ACCESSORIES = [
  'Funda',
  'Cargador',
  'Vidrio templado',
  'SIM',
  'SD',
  'Auriculares',
]

// Arreglos más comunes (cuando el problema se ve a simple vista).
export const COMMON_FIXES = [
  'Cambio de pantalla',
  'Cambio de módulo',
  'Cambio de batería',
  'Pin de carga',
  'Micrófono',
  'Parlante',
  'Botón de encendido',
  'Flex',
  'Software',
  'Limpieza',
]

// Cuántos badges se muestran por defecto (el resto queda en "otro").
export const BRAND_BADGE_COUNT = 5
export const MODEL_BADGE_COUNT = 10

// Días de garantía que se imprimen en la orden.
export const WARRANTY_DAYS = 30