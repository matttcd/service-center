import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ReceptionWorkspace, { ReceptionTaskForm } from '../../src/preview/ReceptionWorkspace.jsx'
import { RECEPTION_DRAFT, receptionTask } from '../../src/preview/reception-task.js'
import { applyDemoAction, receptionQueue } from '../../src/preview/preview-model.js'
import { applySystemAction, createSystemState } from '../../src/preview/system-model.js'

const state = createSystemState(1800000000000)
const getOrder = (number) => state.orders.find((o) => o.number === number)
const getDraft = (order, patch = {}) => ({ ...RECEPTION_DRAFT, price: order.price || '', charge: '3500', note: '', partName: '', partQuantity: '1', ...patch })
const render = (order, role = 'recepcion', patch = {}, customer = state.customers.find((c) => c.id === order.customerId)) => renderToStaticMarkup(<ReceptionWorkspace order={order} customer={customer} role={role} users={state.users} draft={getDraft(order, patch)} setDraft={() => {}} onAction={() => {}} onExtra={() => {}} onBack={() => {}} />)

describe('Ficha informativa y tareas en ventana de Recepción', () => {
  it.each([
    ['OS1038', {}, ['Presupuesto a definir', 'Seña $ 0', 'Saldo —']],
    ['OS1035', {}, ['Presupuesto $ 45.000', 'Seña $ 0', 'Saldo $ 45.000']],
    ['OS1044', {}, ['Presupuesto $ 65.000', 'Seña $ 20.000', 'Saldo $ 45.000']],
    ['OS1020', {}, ['Importe de retiro $ 3.500', 'Seña $ 5.000', 'Saldo a favor $ 1.500', 'Presupuesto rechazado $ 30.000']],
    ['OS1020', { rejectedCharge: 0, advance: 0 }, ['Importe de retiro $ 0', 'Seña $ 0', 'Saldo $ 0', 'Presupuesto rechazado $ 30.000']],
    ['OS1020', { rejectedCharge: 0 }, ['Importe de retiro $ 0', 'Saldo a favor $ 5.000', 'Presupuesto rechazado $ 30.000']],
  ])('resume los importes de %s sin alterar los cálculos con %j', (number, patch, values) => {
    const footer = render({ ...getOrder(number), ...patch }).match(/<footer[\s\S]*?<\/footer>/)[0]
    const text = footer.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
    expect(footer).toContain('fp-finance-summary')
    for (const value of values) expect(text).toContain(value)
  })
  it('permite ajustar el presupuesto antes del nuevo aviso, sin avisar el importe anterior', () => {
    const order = { ...getOrder('OS1035'), notified: false }
    expect(receptionTask(order, getDraft(order))).toMatchObject({ id: 'notify' })
    expect(receptionTask(order, getDraft(order, { price: '78000' }))).toMatchObject({ id: 'price', label: 'Guardar presupuesto', data: { price: '78000' } })
    expect(receptionTask(order, getDraft(order, { price: '-1' })).blocked).toBeTruthy()
    const form = renderToStaticMarkup(<ReceptionTaskForm order={order} draft={getDraft(order, { price: '78000' })} setDraft={() => {}} onAction={() => {}} onClose={() => {}} />)
    expect(form).toContain('id="reception-price"')
    expect(form).toContain('Guardar presupuesto')
    expect(form).not.toContain('Registrar aviso al cliente')
  })
  it('mantiene todos los datos visibles y abre la tarea desde el pie sin formulario en la ficha', () => {
    const order = getOrder('OS1038'), html = render(order)
    expect(html.indexOf('fp-reception-identity')).toBeGreaterThan(0)
    expect(html.indexOf('fp-reception-identity')).toBeLessThan(html.indexOf('reception-issue'))
    expect(html.indexOf('reception-issue')).toBeLessThan(html.indexOf('reception-work'))
    expect(html.indexOf('Herramientas de la orden')).toBeLessThan(html.indexOf('reception-customer'))
    expect(html).not.toMatch(/<(form|input|textarea|select)\b/)
    expect(html).not.toContain('reception-task-form')
    expect(html.match(/<footer[\s\S]*?<\/footer>/)[0]).toContain('aria-haspopup="dialog"')
    expect(html.match(/<footer[\s\S]*?<\/footer>/)[0]).not.toContain('disabled')
    expect(html).toContain('Importes')
    for (const text of [order.issue, order.work, order.phone]) expect(html.split(text)).toHaveLength(2)
    const header = html.match(/<header[\s\S]*?<\/header>/)[0]
    expect(header).not.toContain('Herramientas de la orden')
    expect(header).not.toContain(order.access)
    expect(html).not.toMatch(/<(details|summary|select)\b/)
    expect(html).toContain(order.access)
    expect(html).not.toContain('reception-diagnosis')
  })
  it.each([
    ['OS1038', 'Presupuestar', 'id="reception-price"'],
    ['OS1024', 'Avisar retiro', 'Registrar aviso al cliente'],
    ['OS1035', 'Registrar respuesta', 'Aprobó el presupuesto'],
    ['OS1029', 'Gestionar repuestos', 'SSD SATA 500 GB'],
    ['OS1020', 'Registrar retiro', 'id="reception-pickup-by"'],
    ['OS1033', 'Registrar regreso', 'Reparación finalizada'],
    ['OS1048', 'Finalizar servicio', 'Finalizar servicio'],
  ])('conserva el formulario de %s para su ventana', (number, title, content) => {
    const order = getOrder(number), html = render(order)
    const form = renderToStaticMarkup(<ReceptionTaskForm order={order} draft={getDraft(order)} title={title} setDraft={() => {}} onAction={() => {}} onClose={() => {}} />)
    expect(html.match(/<footer[\s\S]*?<\/footer>/)[0]).toContain(title)
    expect(form).toContain(`aria-label="${title}"`)
    expect(form).toContain(content)
    expect(form).toContain('Cancelar')
    expect(form).toContain('type="submit"')
    expect(form).not.toContain('fp-finance-summary')
  })
  it('muestra patrón, acceso y datos de ingreso sin repetirlos en el encabezado', () => {
    const html = render(getOrder('OS1044'))
    expect(html).toContain('Patrón de desbloqueo: 1, 4, 7, 8, 9')
    expect(html).toContain('Acceso y estado')
    expect(html).toContain('Tomás Ríos')
    expect(html).not.toContain('fp-technical-order')
  })
  it('muestra todos los datos de cliente guardados, con campos vacíos explícitos', () => {
    const order = getOrder('OS1038'), customer = state.customers.find((c) => c.id === order.customerId), html = render(order)
    for (const value of [customer.name, customer.dni, customer.phone, customer.phone2, customer.phone3, customer.email, customer.address]) expect(html.split(value)).toHaveLength(2)
    for (const label of ['DNI', 'Teléfono', 'Teléfono 2', 'Teléfono 3', 'Correo', 'Domicilio', 'Tipo de dispositivo', 'Tipo de ingreso', 'Ingreso', 'Recibió', 'Técnico', 'Contraseña o PIN', 'Estado físico', 'Accesorios', 'Patrón', 'Aviso al cliente', 'Respuesta']) expect(html).toMatch(new RegExp(`<dt[^>]*>(?:<svg[\\s\\S]*?</svg>)?${label}</dt>`))
    expect(render(order, 'recepcion', {}, { name: 'Cliente nuevo', phone: order.phone })).toContain('—')
    expect(render({ ...order, noPin: true, access: '' })).toContain('Sin bloqueo')
    expect(render({ ...order, noPin: true, access: '' })).not.toContain('Sin contraseña informada')
  })
  it('centraliza el equipo y deja cliente y seguimiento en el lateral sin duplicar datos', () => {
    const order = getOrder('OS1044'), html = render(order)
    const reference = html.match(/<aside[\s\S]*?<\/aside>/)[0]
    const body = html.slice(html.indexOf('<div class="fp-order-body">'), html.indexOf('<aside'))
    for (const value of [order.customer, order.phone]) expect(reference).toContain(value)
    for (const value of [order.issue, order.work, order.access, order.conditions, order.accessories]) {
      expect(reference).not.toContain(value)
      expect(body).toContain(value)
      expect(html.split(value)).toHaveLength(2)
    }
    expect(body).toContain('Patrón de desbloqueo: 1, 4, 7, 8, 9')
    expect(body).not.toContain('fp-reception-tracking')
    expect(reference).not.toContain('fp-reception-device')
    expect(reference).toContain('fp-reception-tracking')
    for (const label of ['Ingreso', 'Recibió', 'Técnico', 'Aceptado', 'Aviso al cliente', 'Respuesta']) expect(reference).toContain(`<dt>${label}</dt>`)
    expect(html.match(/<header[\s\S]*?<\/header>/)[0]).toContain(order.deviceType)
    expect(html).toContain('aria-label="Cliente y seguimiento"')
  })
  it('mantiene el técnico externo y las fechas visibles sin abrir la tarea', () => {
    const order = { ...getOrder('OS1033'), externalSentAt: 1800000000000, externalReturnAt: 1800000060000 }
    const html = render(order), header = html.match(/<header[\s\S]*?<\/header>/)[0]
    expect(header).toContain(order.externalTech)
    expect(header).toMatch(/<dt>Envío<\/dt><dd>(?!—)[^<]+<\/dd>/)
    expect(header).toMatch(/<dt>Regreso<\/dt><dd>(?!—)[^<]+<\/dd>/)
    expect(html.split(order.externalTech)).toHaveLength(2)
    expect(html).not.toContain('reception-task-form')
  })
  it('consulta el cliente vigente y conserva DNI y teléfonos al editar otros datos', () => {
    const order = getOrder('OS1038'), customer = state.customers.find((c) => c.id === order.customerId)
    const updated = applySystemAction(state, 'customer', { id: customer.id, name: 'Marcos actualizado', phone: customer.phone, email: customer.email, address: 'Dirección actualizada' }, 'recepcion')
    const saved = updated.customers.find((c) => c.id === customer.id)
    expect(saved).toMatchObject({ dni: customer.dni, phone2: customer.phone2, phone3: customer.phone3 })
    const html = render(order, 'recepcion', {}, saved)
    expect(html).toContain('Marcos actualizado')
    expect(html).toContain('Dirección actualizada')
    expect(html).not.toContain(customer.address)
  })
  it('conserva el ingreso sin bloqueo y registra los datos de seguimiento de la demo', () => {
    const now = 1800000000000
    const created = applySystemAction(state, 'createOrder', { customerId: state.customers[0].id, brand: 'Equipo', model: 'De prueba', issue: 'No inicia', noPin: true, entry: 'review' }, 'recepcion', now).orders.at(-1)
    expect(created).toMatchObject({ noPin: true, entry: 'review', receivedByName: 'Sofía Martín' })
    let order = applyDemoAction(getOrder('OS1038'), 'price', { price: '50000' }, 'recepcion', now)
    order = applyDemoAction(order, 'notify', {}, 'recepcion', now)
    order = applyDemoAction(order, 'approve', {}, 'recepcion', now + 1)
    expect(order).toMatchObject({ notifiedAt: now, notifiedByName: 'Sofía · Recepción', confirmedAt: now + 1, confirmedByName: 'Sofía · Recepción' })
    const html = render(order)
    expect(html).toContain('Avisado')
    expect(html).toContain('Aprobado')
    expect(html).toContain('Sofía · Recepción')
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
    expect(delivered.deliveredByName).toBe('Sofía · Recepción')
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
    const returned = applyDemoAction(order, action.id, action.data, 'admin', 1800000000000)
    expect(returned.status).toBe('recibido')
    expect(returned.externalReturnAt).toBe(1800000000000)
    order = getOrder('OS1048'); action = receptionTask(order, getDraft(order))
    order = applyDemoAction(order, action.id, action.data, 'recepcion')
    expect(receptionTask(order, getDraft(order)).queue).toBe('avisar')
  })
})
