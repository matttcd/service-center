import { describe, expect, it } from 'vitest'
import { normalizeDni, formatDni } from '../../shared/identifiers.js'
import { pdfSignature } from '../../src/utils/pdfPreview.js'
import { buildOrderHtml } from '../../server/pdf/orderTemplate.js'
import { buildPickupHtml } from '../../server/pdf/pickupTemplate.js'

describe('DNI de lectura y datos canónicos', () => {
  it.each([['1234567', '1.234.567'], ['33444555', '33.444.555'], ['00123456', '00.123.456'], ['', ''], [null, '']])('formatea %s sin perder dígitos', (input, expected) => {
    expect(formatDni(input)).toBe(expected)
    expect(normalizeDni(expected)).toBe(String(input ?? ''))
  })
  it('admite puntos y espacios sin ocultar caracteres inválidos', () => {
    expect(normalizeDni(' 33.444.555 ')).toBe('33444555')
    expect(normalizeDni('33x444555')).toBe('33x444555')
  })
  it('usa el mismo formato en ambos comprobantes', () => {
    const customer = { fullName: 'Cliente de prueba', dni: '33444555' }
    expect(buildOrderHtml({}, customer)).toContain('33.444.555')
    expect(buildPickupHtml({}, customer, { pickupBy: 'third', pickupDni: '22111333' })).toContain('22.111.333')
  })
})

describe('Identidad del comprobante en memoria', () => {
  const order = { id: 'one', price: 45000, pin: '1234', pattern: [0, 1, 2], fix: 'Módulo' }
  const customer = { fullName: 'Cliente', dni: '33444555' }
  const signature = pdfSignature(order, customer, ['Garantía'])
  it('ignora refresh y movimientos que no cambian el comprobante', () => {
    expect(pdfSignature({ ...order, notified: true, history: [{ note: 'Avisado' }] }, customer, ['Garantía'])).toBe(signature)
  })
  it.each([{ price: 50000 }, { pin: '4321' }, { pattern: [0, 3, 6] }, { rejectedCharge: 0 }, { fix: 'Batería' }])('invalida cambios impresos %j', (fields) => {
    expect(pdfSignature({ ...order, ...fields }, customer, ['Garantía'])).not.toBe(signature)
  })
  it('invalida cliente y términos', () => {
    expect(pdfSignature(order, { ...customer, fullName: 'Otro' }, ['Garantía'])).not.toBe(signature)
    expect(pdfSignature(order, customer, ['Nuevos términos'])).not.toBe(signature)
  })
})
