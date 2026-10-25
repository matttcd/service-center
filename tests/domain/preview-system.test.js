import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { NEW_ORDER, PROFILES, activity, applySystemAction, canVisit, createSystemState, overview } from '../../src/preview/system-model.js'
import { nextAction, queueOrders, receptionQueue, TECHNICIAN } from '../../src/preview/preview-model.js'

const now = 1800000000000
const create = (state, patch = {}) => applySystemAction(state, 'createOrder', { ...NEW_ORDER, customer: 'Cliente de prueba', phone: '11 5555-9999', brand: 'Samsung', model: 'A35', issue: 'No enciende', ...patch }, 'recepcion', now)
const act = (state, id, action, role, data = {}) => applySystemAction(state, 'orderAction', { id, action, data }, role, now + state.orders.find((o) => o.id === id).history.length * 1000)

describe('Demo completa en memoria', () => {
  it('define inicios y navegación según el perfil', () => {
    for (const [role, profile] of Object.entries(PROFILES)) expect(canVisit(profile.home, role)).toBe(true)
    expect(canVisit('/ordenes/demo-OS1042', 'tecnico')).toBe(true)
    expect(canVisit('/usuarios', 'tecnico')).toBe(false)
    expect(canVisit('/configuracion', 'recepcion')).toBe(false)
    expect(canVisit('/desconocida', 'admin')).toBe(false)
  })
  it('crea una orden y actualiza clientes, colas, resumen y actividad sin mutar el original', () => {
    const initial = createSystemState(now), next = create(initial), order = next.orders.at(-1)
    expect(initial.orders).toHaveLength(14)
    expect(next.customers.at(-1).id).toBe(order.customerId)
    expect(queueOrders(next.orders, 'tecnico', 'available')).toContainEqual(order)
    expect(overview(next).active).toBe(overview(initial).active + 1)
    expect(activity(next).find((e) => e.orderId === order.id)).toMatchObject({ by: 'Sofía Martín · Recepción' })
    const edited = applySystemAction(next, 'customer', { ...next.customers.at(-1), name: 'Cliente corregido', phone: '11 5555-9998' }, 'recepcion', now + 1)
    expect(edited.orders.at(-1)).toMatchObject({ customer: 'Cliente corregido', phone: '11 5555-9998' })
  })
  it('recorre revisión, presupuesto, repuestos, reparación y retiro por terceros sin comprobante', () => {
    let state = create(createSystemState(now)), id = state.orders.at(-1).id
    state = act(state, id, 'claim', 'tecnico')
    const acceptedAt = state.orders.at(-1).acceptedAt
    state = act(state, id, 'sendQuote', 'tecnico', { work: 'Cambiar conector' })
    state = act(state, id, 'price', 'recepcion', { price: '50000' })
    state = act(state, id, 'notify', 'recepcion')
    state = act(state, id, 'approve', 'recepcion')
    state = act(state, id, 'startRepair', 'tecnico')
    state = act(state, id, 'requestPart', 'tecnico', { name: 'Conector', quantity: 1 })
    const part = state.orders.at(-1).parts[0].id
    state = act(state, id, 'partOrdered', 'recepcion', { id: part })
    state = act(state, id, 'partArrived', 'recepcion', { id: part })
    state = act(state, id, 'resume', 'tecnico')
    state = act(state, id, 'finish', 'tecnico')
    state = act(state, id, 'notify', 'recepcion')
    state = act(state, id, 'pickup', 'recepcion', { by: 'third', name: 'Persona de prueba', dni: '12345678', physical: true, withoutReceipt: true })
    expect(state.orders.at(-1)).toMatchObject({ status: 'entregado', acceptedAt, pickup: { withoutReceipt: true, by: 'third' } })
    expect(overview(state).delivered).toBe(2)
  })
  it('permite reparación definida sin obligar a diagnosticar, y rechazo con importe de retiro', () => {
    let state = create(createSystemState(now), { entry: 'repair', work: 'Cambiar módulo', price: 60000, advance: 10000 })
    const id = state.orders.at(-1).id
    expect(state.orders.at(-1)).toMatchObject({ status: 'recibido', notified: false, confirmed: false })
    expect(nextAction(state.orders.at(-1), 'tecnico').id).toBe('claimRepair')
    state = act(state, id, 'claimRepair', 'tecnico')
    expect(state.orders.at(-1)).toMatchObject({ status: 'en_reparacion', assignedTo: TECHNICIAN, workAuthor: { role: 'recepcion' } })
    expect(state.orders.at(-1)).not.toHaveProperty('diagnosis')
    state = act(state, 'demo-OS1035', 'reject', 'recepcion', { charge: 4000 })
    expect(state.orders.find((o) => o.id === 'demo-OS1035')).toMatchObject({ rejectedCharge: 4000, status: 'presupuesto_rechazado' })
  })
  it('conserva servicios simples, externos y garantías', () => {
    let state = createSystemState(now)
    state = act(state, 'demo-OS1048', 'finishSimple', 'recepcion')
    expect(state.orders.find((o) => o.id === 'demo-OS1048').status).toBe('terminado')
    state = act(state, 'demo-OS1033', 'returnExternal', 'recepcion', { repaired: true })
    expect(state.orders.find((o) => o.id === 'demo-OS1033').status).toBe('terminado')
    state = act(state, 'demo-OS1047', 'sendExternal', 'recepcion', { name: 'Laboratorio Sur' })
    expect(receptionQueue(state.orders.find((o) => o.id === 'demo-OS1047'))).toBe('externos')
    state = act(state, 'demo-OS1010', 'warranty', 'recepcion')
    expect(state.orders.find((o) => o.id === 'demo-OS1010')).toMatchObject({ status: 'recibido', warrantyReturn: true, assignedTo: null, acceptedAt: null })
  })
  it('separa asignación de aceptación y permite enviar a externo desde el ingreso', () => {
    let state = createSystemState(now)
    state = applySystemAction(state, 'assign', { id: 'demo-OS1047', technician: TECHNICIAN }, 'admin', now)
    const assigned = state.orders.find((o) => o.id === 'demo-OS1047')
    expect(assigned.acceptedAt).toBeNull()
    expect(nextAction(assigned, 'tecnico').id).toBe('startReview')
    state = act(state, assigned.id, 'startReview', 'tecnico')
    expect(state.orders.find((o) => o.id === assigned.id).status).toBe('en_revision')
    state = create(state, { isExternal: true, externalTech: 'Laboratorio Sur' })
    expect(receptionQueue(state.orders.at(-1))).toBe('externos')
  })
  it('actualiza configuración y catálogo sin duplicados y valida los importes', () => {
    let state = createSystemState(now)
    state = applySystemAction(state, 'settings', { revisionFee: '5000', labelWidth: '60' }, 'admin')
    expect(state.settings).toMatchObject({ revisionFee: '5000', labelWidth: '60' })
    state = applySystemAction(state, 'catalog', { text: 'Samsung Galaxy A35\nSamsung Galaxy A35' }, 'admin')
    expect(state.settings.catalog.filter((s) => s === 'Samsung Galaxy A35')).toHaveLength(1)
    expect(() => applySystemAction(state, 'settings', { labelWidth: 0 }, 'admin')).toThrow('Medidas')
    expect(() => applySystemAction(state, 'settings', { revisionFee: -1 }, 'admin')).toThrow('importe')
  })
  it('rechaza datos inválidos, acciones por otro perfil y desactivar el último administrador', () => {
    const state = createSystemState(now)
    expect(() => create(state, { model: '' })).toThrow('modelo')
    expect(() => create(state, { entry: 'repair', work: 'Cambiar módulo', price: 1000, advance: 1500 })).toThrow('seña')
    expect(() => applySystemAction(state, 'settings', {}, 'tecnico')).toThrow('Administración')
    expect(() => applySystemAction(state, 'user', { ...state.users.at(-1), active: false }, 'admin')).toThrow('administrador activo')
    expect(() => act(state, 'demo-OS1042', 'saveWork', 'recepcion', { work: 'Cambio' })).toThrow()
    expect(state.users.at(-1).active).toBe(true)
  })
  it('restaura clientes con sus órdenes sin revivir órdenes eliminadas antes', () => {
    let state = createSystemState(now), customerId = state.orders[0].customerId
    state = applySystemAction(state, 'trash', { kind: 'orders', id: state.orders[0].id }, 'admin', now)
    state = applySystemAction(state, 'trash', { kind: 'customers', id: customerId }, 'admin', now + 1)
    expect(state.orders.find((o) => o.id === 'demo-OS1033').deletedAt).toBeTruthy()
    state = applySystemAction(state, 'restore', { kind: 'customers', id: customerId }, 'admin')
    expect(state.orders[0].deletedAt).toBeTruthy()
    expect(state.orders.find((o) => o.id === 'demo-OS1033').deletedAt).toBeUndefined()
  })
  it('respalda y restaura en memoria, conserva las copias y registra la restauración', () => {
    let state = applySystemAction(createSystemState(now), 'backup', {}, 'admin', now)
    const count = state.orders.length
    state = create(state)
    state = applySystemAction(state, 'restoreBackup', { id: state.backups[0].id }, 'admin', now + 1)
    expect(state.orders).toHaveLength(count)
    expect(state.backups).toHaveLength(1)
    expect(state.audit.at(-1).text).toContain('restaurada')
  })
  it('mantiene la entrada DEV sin acceso a API, autenticación ni servicios reales', () => {
    const folder = new URL('../../src/preview/', import.meta.url)
    for (const name of readdirSync(folder).filter((n) => /\.(jsx|js)$/.test(n))) {
      const source = readFileSync(new URL(name, folder), 'utf8')
      expect(source).not.toMatch(/\bfetch\s*\(|XMLHttpRequest|localStorage|sessionStorage|window\.print|utils\/api|context\/(Auth|Data)Context/)
    }
    expect(readFileSync(new URL('main.jsx', folder), 'utf8')).toContain('if (import.meta.env.DEV)')
  })
})
