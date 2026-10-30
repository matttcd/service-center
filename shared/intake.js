import { normalizeDni } from './identifiers.js'

const filled = (value) => typeof value === 'string' && value.trim()

export function intakeError(order, customer) {
  if (!filled(customer?.fullName)) return 'Ingresá el nombre del cliente.'
  if (!/^\d{6,8}$/.test(normalizeDni(customer.dni))) return 'Ingresá un DNI de entre 6 y 8 dígitos.'
  if (!filled(customer.address)) return 'Ingresá el domicilio del cliente.'
  if (!filled(order.deviceType)) return 'Elegí el tipo de dispositivo.'
  if (!filled(order.brand)) return 'Elegí la marca del dispositivo.'
  if (!filled(order.model)) return 'Elegí el modelo del dispositivo.'
  if (!filled(order.conditions)) return 'Indicá el estado del equipo o Sin observaciones.'
  if (!filled(order.accessories)) return 'Indicá los accesorios o Sin accesorios.'
  if (!order.noPin && !filled(order.pin) && !(order.pattern?.length >= 3)) return 'Ingresá la contraseña, el patrón o indicá que el cliente no dejó contraseña.'
  if (!filled(order.issue)) return 'Completá las notas generales.'
  if (order.diagnosisType !== 'revision') {
    if (!filled(order.fix)) return 'Indicá el trabajo a realizar.'
    if (!(Number(order.price) > 0)) return 'Ingresá el presupuesto del arreglo.'
  }
  return null
}

export function customerMatchesQuery(customer, query) {
  const q = query.trim().toLocaleLowerCase('es')
  if (!q) return false
  const digits = q.replace(/\D/g, '')
  return customer.fullName.toLocaleLowerCase('es').includes(q) ||
    !!digits && [customer.dni, customer.phone, customer.phone2, customer.phone3].some((value) => String(value || '').replace(/\D/g, '').includes(digits))
}

export function deviceModels(models, brand, deviceType) {
  return models.filter((model) => model.brand === brand && model.deviceType === deviceType)
}
