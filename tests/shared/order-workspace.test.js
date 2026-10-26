import { describe, expect, it } from 'vitest'
import { orderAmounts, acceptanceDate, receptionQueue } from '../../shared/order-workspace.js'
import { allowedTransitions, canTransitionForRole } from '../../shared/fsm.js'
import { buildPickupHtml } from '../../server/pdf/pickupTemplate.js'

describe('Ficha real y colas', () => {
  it('separa el rechazo del retiro físico', () => {
    const order = { status: 'presupuesto_rechazado', price: 45000, advance: 5000, rejectedCharge: 0 }
    expect(receptionQueue(order)).toBe('retiros')
    expect(orderAmounts(order)).toEqual({ total: 0, balance: -5000, due: 0, credit: 5000 })
    expect(allowedTransitions(order)).toEqual(['entregado'])
    expect(canTransitionForRole('presupuesto_rechazado', 'tecnico', order)).toBe(false)
  })
  it('mantiene presupuesto original, importe de retiro y crédito en PDF', () => {
    const html = buildPickupHtml({ price: 45000, advance: 5000, rejectedCharge: 3500 }, { fullName: 'Cliente' }, { pickupBy: 'client' })
    expect(html).toContain('45.000')
    expect(html).toContain('3.500')
    expect(html).toContain('1.500')
    expect(html).toContain('Saldo a favor')
  })
  it('conserva los importes de órdenes anteriores', () => {
    expect(orderAmounts({ price: 45000, advance: 5000 })).toEqual({ total: 45000, balance: 40000, due: 40000, credit: 0 })
  })
  it('clasifica los siete pendientes usando los datos reales', () => {
    expect([
      { status: 'presupuesto', price: 0 }, { status: 'presupuesto', price: 1 },
      { status: 'presupuesto', price: 1, notified: true }, { status: 'falta_repuestos', sparePartsLog: [] },
      { status: 'terminado', notified: true }, { status: 'en_tercero' }, { status: 'recibido', isSimpleService: true },
    ].map(receptionQueue)).toEqual(['presupuestar', 'avisar', 'respuesta', 'repuestos', 'retiros', 'externos', 'simples'])
    expect(receptionQueue({ status: 'presupuesto', price: 1, notified: true, confirmed: true })).toBeNull()
    expect(receptionQueue({ status: 'entregado' })).toBeNull()
  })
  it('no inventa fechas antiguas a partir del ingreso o de una asignación ajena', () => {
    expect(acceptanceDate({ assignedTo: 'tech', createdAt: '2026-01-01', history: [] })).toBeNull()
    expect(acceptanceDate({ assignedTo: 'tech', history: [{ status: 'recibido' }, { status: 'en_revision', note: 'Asignado a Técnico', by: 'admin', at: '2026-01-02' }] })).toBeNull()
    expect(acceptanceDate({ acceptedAt: '2026-01-03', assignedTo: 'tech' })).toBe('2026-01-03')
  })
  it('recupera una aceptación propia explícita sin mezclar reasignaciones', () => {
    const history = [{ status: 'recibido' }, { status: 'en_revision', note: 'Asignado a Técnico', by: 'tech', at: '2026-01-02' }]
    expect(acceptanceDate({ assignedTo: 'tech', history })).toBe('2026-01-02')
    expect(acceptanceDate({ assignedTo: 'tech', history: [...history, { status: 'en_revision', note: 'Asignado a Técnico', by: 'admin' }] })).toBeNull()
  })
})
