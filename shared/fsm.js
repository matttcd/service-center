// ============================================
// Máquina de estados de una orden (fuente única de verdad, compartida
// por el backend y el frontend). JS puro, sin APIs de plataforma.
// ============================================

// Estados posibles de una orden.
export const ORDER_STATUSES = [
  'recibido',
  'en_revision',
  'presupuesto',
  'en_reparacion',
  'falta_repuestos',
  'terminado',
  'entregado',
  'en_tercero',
]

// Etiqueta legible de cada estado.
export const ORDER_STATUS_LABEL = {
  recibido: 'Recibido',
  en_revision: 'En revision',
  presupuesto: 'Presupuesto',
  en_reparacion: 'En reparacion',
  falta_repuestos: 'Falta de repuestos',
  terminado: 'Listo para retirar',
  entregado: 'Entregado',
  en_tercero: 'En tercero',
}

// Transiciones permitidas desde cada estado, respetando el tipo de diagnóstico
// (una orden a revisión no pasa directo a reparación). Espejo de la lógica que
// antes vivía inline en el backend.
export function allowedTransitions(order) {
  switch (order?.status) {
    case 'recibido':
      if (order.isSimpleService) return ['terminado', 'en_reparacion', 'entregado', 'en_tercero']
      return order.diagnosisType === 'revision'
        ? ['en_revision', 'entregado', 'en_tercero']
        : ['en_reparacion', 'entregado', 'en_tercero']
    case 'en_revision':
      return ['presupuesto', 'entregado', 'en_tercero']
    case 'presupuesto':
      return ['en_reparacion', 'entregado', 'en_tercero']
    case 'en_reparacion':
      return ['terminado', 'presupuesto', 'entregado', 'falta_repuestos', 'en_tercero']
    case 'falta_repuestos':
      return ['en_reparacion', 'entregado', 'en_tercero']
    case 'terminado':
      return ['entregado', 'en_reparacion', 'en_tercero']
    case 'en_tercero':
      return ['recibido', 'en_revision', 'presupuesto', 'en_reparacion', 'falta_repuestos', 'terminado']
    case 'entregado':
      return ['recibido']
    default:
      return []
  }
}

// Siguiente estado sugerido para la UI (primer destino válido).
export function nextStatus(order) {
  const list = allowedTransitions(order)
  return list.length ? list[0] : null
}

// Etiqueta del botón de avance para la UI.
export function nextStatusLabel(order) {
  const target = nextStatus(order)
  const labels = {
    en_revision: 'Revisar',
    en_reparacion: 'Reparar',
    presupuesto: 'Presupuesto',
    terminado: 'Listo',
    en_tercero: 'Enviar a tercero',
  }
  return target ? labels[target] || '' : ''
}

// Tipos de dispositivo.
export const DEVICE_TYPES = [
  'Celular',
  'Tablet',
  'Notebook / PC',
  'Smart TV',
  'Consola',
  'Impresora',
  'Otro',
]



// Roles que pueden realizar cada tipo de transición (espejo de las reglas del backend).
const TECH_ROLES = ['tecnico', 'admin']
const COUNTER_ROLES = ['recepcion', 'admin']

// Indica si un rol puede disparar la transición hacia `to`.
export function canTransitionForRole(to, role, order) {
  if (to === 'terminado' && COUNTER_ROLES.includes(role) && order?.isSimpleService) {
    return true
  }
  if (to === 'en_tercero' && !COUNTER_ROLES.includes(role)) {
    return false
  }
  if (order?.status === 'en_tercero' && !COUNTER_ROLES.includes(role)) {
    return false
  }
  if (['en_revision', 'en_reparacion', 'terminado', 'falta_repuestos'].includes(to) && !TECH_ROLES.includes(role)) {
    return false
  }
  if (['presupuesto', 'entregado'].includes(to) && !COUNTER_ROLES.includes(role)) {
    return false
  }
  return true
}
