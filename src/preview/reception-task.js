import { nextAction, receptionQueue } from './preview-model.js'

export const RECEPTION_DRAFT = { response: '', pickupBy: 'client', pickupName: '', pickupDni: '', physical: false, withoutReceipt: false, repaired: true }

export function receptionTask(order, draft) {
  const queue = receptionQueue(order)
  const action = nextAction(order, 'recepcion')
  if (!queue || !action) return { queue: null, id: null, label: null, data: {}, blocked: '' }
  const result = { queue, id: action.id, label: action.label, data: {}, blocked: '' }
  if (action.id === 'price') {
    result.data = { price: draft.price }
    if (draft.price === '' || !Number.isFinite(Number(draft.price)) || Number(draft.price) <= 0) result.blocked = 'Ingresá un presupuesto mayor a cero.'
  } else if (action.id === 'response') {
    result.label = 'Confirmar respuesta'
    if (!['approve', 'reject'].includes(draft.response)) result.blocked = 'Elegí una respuesta.'
    else {
      result.id = draft.response
      result.label = draft.response === 'reject' ? 'Confirmar rechazo' : 'Confirmar aprobación'
      if (draft.response === 'reject') {
        result.data = { charge: draft.charge }
        if (draft.charge === '' || !Number.isFinite(Number(draft.charge)) || Number(draft.charge) < 0) result.blocked = 'Ingresá un importe de revisión válido.'
      }
    }
  } else if (action.id === 'pickup') {
    result.label = 'Confirmar entrega'
    result.data = { by: draft.pickupBy, ...(draft.pickupBy === 'third' ? { name: draft.pickupName, dni: draft.pickupDni } : {}), physical: draft.physical, withoutReceipt: draft.withoutReceipt }
    if (!draft.physical) result.blocked = 'Confirmá el retiro físico.'
    if (draft.pickupBy === 'third' && (!draft.pickupName.trim() || !/^\d{6,8}$/.test(draft.pickupDni))) result.blocked = 'Completá nombre y DNI de quien retira.'
  } else if (['partOrdered', 'partArrived'].includes(action.id)) result.data = { id: action.partId }
  else if (action.id === 'returnExternal') result.data = { repaired: draft.repaired }
  if (draft.note?.trim() || draft.partName?.trim()) result.blocked = 'Hay notas o repuestos sin guardar.'
  return result
}
