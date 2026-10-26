// Datos compartidos por la ficha, las colas y los documentos reales.
export function orderAmounts(order) {
  const total = order.rejectedCharge ?? order.price ?? 0
  const balance = Math.round((total - (order.advance || 0)) * 100) / 100
  return { total, balance, due: Math.max(0, balance), credit: Math.max(0, -balance) }
}

export function receptionQueue(order) {
  if (order.status === 'en_tercero' || (order.isExternal && order.status === 'recibido')) return 'externos'
  if (order.isSimpleService && order.status === 'recibido') return 'simples'
  if (order.status === 'presupuesto') {
    if (!order.price) return 'presupuestar'
    if (!order.notified) return 'avisar'
    if (!order.confirmed) return 'respuesta'
  }
  if (order.status === 'falta_repuestos') return 'repuestos'
  if (order.status === 'terminado' && !order.notified) return 'avisar'
  if (order.status === 'presupuesto_rechazado' || (order.status === 'terminado' && order.notified)) return 'retiros'
  return null
}

export function acceptanceDate(order) {
  if (order.acceptedAt) return order.acceptedAt
  if (!order.assignedTo) return null
  const history = order.history || []
  // Los registros viejos no guardan el ID del destinatario de una reasignación.
  // Solo inferimos una toma propia y explícita, sin una asignación posterior.
  for (let i = history.length - 1; i >= 0; i--) {
    const entry = history[i]
    if (entry.note === 'Reingreso por garantía') return null
    if (entry.note?.startsWith('Asignado a ')) {
      return entry.by === order.assignedTo && ['en_revision', 'en_reparacion'].includes(entry.status) && history[i - 1]?.status === 'recibido' ? entry.at : null
    }
  }
  return null
}
