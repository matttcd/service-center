import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import OrderSheet from '../../src/components/OrderSheet.jsx'
import { buildOrderHtml } from '../../server/pdf/orderTemplate.js'
import { pdfSignature } from '../../src/utils/pdfPreview.js'

const customer = { fullName: 'Ana', phone: '1155550101', phone2: '1155550102', phone3: '1155550103' }
const order = { id: 'order', orderNumber: 'OS0001', status: 'presupuesto', noContact: true }

it('muestra la comunicación presencial sin ocultar los teléfonos del cliente', () => {
  const html = renderToStaticMarkup(<MemoryRouter><OrderSheet order={order} customer={customer} /></MemoryRouter>)
  expect(html).toContain('Sin medio de comunicación · confirma en el local')
  for (const phone of [customer.phone, customer.phone2, customer.phone3]) expect(html).toContain(phone)
})

it('incluye la comunicación presencial en el PDF, conserva teléfonos e invalida la copia anterior', () => {
  const html = buildOrderHtml(order, customer)
  expect(html).toContain('Sin medio de comunicación · confirma en el local')
  for (const phone of [customer.phone, customer.phone2, customer.phone3]) expect(html).toContain(phone)
  expect(pdfSignature(order, customer)).not.toEqual(pdfSignature({ ...order, noContact: false }, customer))
})
