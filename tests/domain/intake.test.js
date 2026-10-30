import { describe, expect, it } from 'vitest'
import { customerMatchesQuery, deviceModels, intakeError } from '../../shared/intake.js'
import { receptionQueue } from '../../shared/order-workspace.js'

const customer = { fullName: 'Ana Pérez', dni: '12.345.678', address: 'San Martín 123', phone: '', phone2: '11-5555-1234', phone3: '11 5555 9999' }
const order = { deviceType: 'Celular', brand: 'Samsung', model: 'A15', conditions: 'Sin observaciones', accessories: 'Sin accesorios', issue: 'No carga', noPin: true, diagnosisType: 'revision' }

describe('Ingreso real', () => {
  it('exige los datos del cliente, salvo los teléfonos', () => {
    expect(intakeError(order, customer)).toBeNull()
    for (const key of ['fullName', 'dni', 'address']) expect(intakeError(order, { ...customer, [key]: '' })).toBeTruthy()
    expect(intakeError(order, { ...customer, dni: 'abc' })).toMatch(/DNI/)
  })
  it('exige los datos del equipo y permite las alternativas de acceso', () => {
    for (const key of ['deviceType', 'brand', 'model', 'conditions', 'accessories', 'issue']) {
      expect(intakeError({ ...order, [key]: '' }, customer)).toBeTruthy()
      expect(intakeError({ ...order, [key]: [] }, customer)).toBeTruthy()
    }
    expect(intakeError({ ...order, noPin: false }, customer)).toMatch(/contraseña/)
    expect(intakeError({ ...order, noPin: false, pin: '1234' }, customer)).toBeNull()
    expect(intakeError({ ...order, noPin: false, pattern: [0, 1, 2] }, customer)).toBeNull()
  })
  it('solo una reparación definida requiere trabajo y precio al ingresar', () => {
    expect(intakeError({ ...order, diagnosisType: 'visible' }, customer)).toMatch(/trabajo/)
    expect(intakeError({ ...order, diagnosisType: 'visible', fix: 'Cambio de módulo' }, customer)).toMatch(/presupuesto/)
    expect(intakeError({ ...order, diagnosisType: 'visible', fix: 'Cambio de módulo', price: 45000 }, customer)).toBeNull()
  })
  it('busca nombres, DNI con puntos y todos los teléfonos sin devolver coincidencias vacías', () => {
    for (const query of ['ana', '12.345.678', '12345678', '1155551234', '55559999']) expect(customerMatchesQuery(customer, query)).toBe(true)
    for (const query of ['', ' ', 'inexistente', '8888']) expect(customerMatchesQuery(customer, query)).toBe(false)
  })
  it('separa modelos de la misma marca por dispositivo, incluso con el mismo nombre', () => {
    const models = [{ name: 'A15', brand: 'Samsung', deviceType: 'Celular' }, { name: 'A15', brand: 'Samsung', deviceType: 'Tablet' }, { name: 'A15', brand: 'Otra', deviceType: 'Celular' }]
    expect(deviceModels(models, 'Samsung', 'Celular')).toEqual([models[0]])
    expect(deviceModels(models, 'Samsung', 'Consola')).toEqual([])
  })
  it('espera la respuesta presencial sin inventar un aviso telefónico', () => {
    expect(receptionQueue({ status: 'presupuesto', noContact: true, price: 45000 })).toBe('respuesta')
    expect(receptionQueue({ status: 'presupuesto', noContact: true, price: 0 })).toBe('presupuestar')
    expect(receptionQueue({ status: 'presupuesto', noContact: true, price: 45000, confirmed: true })).toBeNull()
    expect(receptionQueue({ status: 'terminado', noContact: true })).toBe('retiros')
    expect(receptionQueue({ status: 'terminado', noContact: false })).toBe('avisar')
  })
})
