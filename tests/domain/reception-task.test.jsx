import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ReceptionWorkspace from '../../src/preview/ReceptionWorkspace.jsx'
import { RECEPTION_DRAFT, receptionTask } from '../../src/preview/reception-task.js'
import { applyDemoAction, receptionQueue } from '../../src/preview/preview-model.js'
import { createSystemState } from '../../src/preview/system-model.js'

const state = createSystemState(1800000000000)
const getOrder = (number) => state.orders.find((o) => o.number === number)
const getDraft = (order, patch = {}) => ({ ...RECEPTION_DRAFT, price: order.price || '', charge: '3500', note: '', partName: '', partQuantity: '1', ...patch })
const render = (order, role = 'recepcion', patch = {}) => renderToStaticMarkup(<ReceptionWorkspace order={order} role={role} users={state.users} draft={getDraft(order, patch)} setDraft={() => {}} onAction={() => {}} onExtra={() => {}} onBack={() => {}} />)

describe('Tarea al final de la ficha de Recepción', () => {
  it('mantiene contexto y herramientas antes del formulario y la confirmación', () => {
    const order = getOrder('OS1038'), html = render(order)
    expect(html.indexOf('fp-reception-heading')).toBeLessThan(html.indexOf('reception-issue'))
    expect(html.indexOf('reception-issue')).toBeLessThan(html.indexOf('reception-work'))
    expect(html.indexOf('reception-work')).toBeLessThan(html.indexOf('Herramientas de la orden'))
    expect(html.indexOf('Datos de ingreso')).toBeLessThan(html.indexOf('id="reception-task-form"'))
    expect(html.indexOf('</form>')).toBeLessThan(html.indexOf('<footer'))
    expect(html).toContain('form="reception-task-form"')
    expect(html.match(/<form\b/g)).toHaveLength(1)
    for (const text of [order.issue, order.work, order.phone]) expect(html.split(text)).toHaveLength(2)
    const header = html.match(/<header[\s\S]*?<\/header>/)[0]
    expect(header).not.toContain('Herramientas de la orden')
    expect(header).not.toContain(order.access)
    const details = [...html.matchAll(/<details\b[\s\S]*?<\/details>/g)].map((m) => m[0]).join('')
    expect(details).toContain(order.access)
    expect(details).not.toContain(order.work)
    expect(details).not.toContain(order.issue)
  })
  it.each([
    ['OS1038', 'Presupuestar', 'id="reception-price"'],
    ['OS1024', 'Avisar retiro', 'Registrar aviso al cliente'],
    ['OS1035', 'Registrar respuesta', 'Aprobó el presupuesto'],
    ['OS1029', 'Gestionar repuestos', 'SSD SATA 500 GB'],
    ['OS1020', 'Registrar retiro', 'id="reception-pickup-by"'],
    ['OS1033', 'Registrar regreso', 'Reparación finalizada'],
    ['OS1048', 'Finalizar servicio', 'Finalizar servicio'],
  ])('abre directamente el formulario de %s', (number, title, content) => {
    const html = render(getOrder(number))
    expect(html).toContain(`aria-label="${title}"`)
    expect(html).toContain(content)
  })
  it('muestra patrón, acceso y datos de ingreso sin repetirlos en el encabezado', () => {
    const html = render(getOrder('OS1044'))
    expect(html).toContain('Patrón de desbloqueo: 1, 4, 7, 8, 9')
    expect(html).toContain('Datos de ingreso')
    expect(html).toContain('Tomás Ríos')
    expect(html).not.toContain('fp-technical-order')
  })
  it('mantiene Recepción después de aprobar como administrador', () => {
    const order = getOrder('OS1035'), draft = getDraft(order, { response: 'approve' })
    const action = receptionTask(order, draft)
    const updated = applyDemoAction(order, action.id, action.data, 'admin')
    expect(receptionTask(updated, getDraft(updated)).id).toBeNull()
    const html = render(updated, 'admin')
    expect(html).toContain('Sin pendientes de recepción')
    expect(html).not.toContain('Iniciar reparación')
    expect(html).not.toContain('fp-technical-order')
  })
  it.each(['', '-1', 'Infinity', 'NaN'])('rechaza presupuesto inválido %s sin alterar el borrador', (price) => {
    const draft = getDraft(getOrder('OS1038'), { price })
    expect(receptionTask(getOrder('OS1038'), draft).blocked).toBeTruthy()
    expect(draft.price).toBe(price)
  })
  it('confirma presupuesto y rechazo con importe cero mediante las acciones existentes', () => {
    let order = getOrder('OS1038'), action = receptionTask(order, getDraft(order, { price: '50000' }))
    expect(action.blocked).toBe('')
    order = applyDemoAction(order, action.id, action.data, 'recepcion')
    expect(receptionQueue(order)).toBe('avisar')
    order = applyDemoAction(order, 'notify', {}, 'recepcion')
    action = receptionTask(order, getDraft(order, { response: 'reject', charge: '0' }))
    expect(action.blocked).toBe('')
    order = applyDemoAction(order, action.id, action.data, 'recepcion')
    expect(order.rejectedCharge).toBe(0)
    expect(receptionQueue(order)).toBe('retiros')
  })
  it('valida respuesta, cargo de revisión, notas pendientes y datos de retiro', () => {
    const response = getOrder('OS1035'), pickup = getOrder('OS1020')
    expect(receptionTask(response, getDraft(response)).blocked).toBeTruthy()
    expect(receptionTask(response, getDraft(response, { response: 'reject', charge: '-1' })).blocked).toBeTruthy()
    expect(receptionTask(response, getDraft(response, { response: 'approve', note: 'Pendiente' })).blocked).toContain('notas')
    expect(receptionTask(pickup, getDraft(pickup)).blocked).toContain('retiro físico')
    expect(receptionTask(pickup, getDraft(pickup, { physical: true, pickupBy: 'third', pickupName: 'Ejemplo', pickupDni: '123' })).blocked).toContain('DNI')
    const draft = getDraft(pickup, { physical: true, pickupBy: 'third', pickupName: 'Ejemplo', pickupDni: '12345678', withoutReceipt: true })
    const action = receptionTask(pickup, draft)
    expect(action.blocked).toBe('')
    const delivered = applyDemoAction(pickup, action.id, action.data, 'recepcion')
    expect(delivered.pickup).toMatchObject({ by: 'third', withoutReceipt: true })
    expect(render(delivered)).toContain('Trabajo propuesto · sin realizar')
    expect(render(delivered)).not.toContain('Trabajo realizado')
    expect(render(delivered)).toContain('Importe de retiro')
  })
  it('gestiona repuestos, regreso externo y servicios simples sin abrir pasos intermedios', () => {
    let order = getOrder('OS1029'), action = receptionTask(order, getDraft(order))
    expect(action.id).toBe('partArrived')
    order = applyDemoAction(order, action.id, action.data, 'recepcion')
    expect(receptionTask(order, getDraft(order)).queue).toBeNull()
    order = getOrder('OS1033'); action = receptionTask(order, getDraft(order, { repaired: false }))
    expect(applyDemoAction(order, action.id, action.data, 'admin').status).toBe('recibido')
    order = getOrder('OS1048'); action = receptionTask(order, getDraft(order))
    order = applyDemoAction(order, action.id, action.data, 'recepcion')
    expect(receptionTask(order, getDraft(order)).queue).toBe('avisar')
  })
})
