import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import OrderDetail from '../../src/pages/OrderDetail.jsx'

const state = vi.hoisted(() => ({ role: 'tecnico', order: null }))
vi.mock('../../src/context/AuthContext.jsx', () => ({ useAuth: () => ({ currentUser: { id: 'tech', role: state.role } }) }))
vi.mock('../../src/context/DataContext.jsx', () => ({ useData: () => ({ orders: [state.order], customers: [], technicians: [], config: {}, catalogLists: { fixes: [], externalTechnicians: [] } }) }))
vi.mock('../../src/context/workspace.js', () => ({ useOrderDraft: () => [{}, () => {}] }))
vi.mock('../../src/context/notifications.js', () => ({ useNotify: () => () => {} }))
vi.mock('../../src/components/PrintOrderPanel.jsx', () => ({ default: () => null }))

const render = (role, status, fields = {}) => {
  state.role = role
  state.order = { id: 'order', customerId: 'customer', orderNumber: 'OS1001', brand: 'Samsung', model: 'A15', status, assignedTo: 'tech', acceptedAt: '2026-10-30T12:00:00Z', fix: 'Cambiar módulo', ...fields }
  return renderToStaticMarkup(<MemoryRouter><OrderDetail orderId="order" /></MemoryRouter>)
}

describe('Acciones de la ficha por perfil', () => {
  it.each([
    ['en_reparacion', {}, 'Esperar repuestos'],
    ['terminado', {}, 'Volver a reparación'],
    ['en_revision', { acceptedAt: null }, 'Aceptar trabajo'],
  ])('conserva %s como botones directos, sin menú ni impresión para el técnico', (status, fields, label) => {
    const html = render('tecnico', status, fields)
    expect(html).not.toContain('aria-haspopup="menu"')
    expect(html).not.toContain('Imprimir')
    expect(html).toContain('ws-technical-actions')
    expect(html).toContain(label)
  })
  it('no muestra operaciones de otro técnico', () => {
    const html = render('tecnico', 'en_reparacion', { assignedTo: 'other' })
    expect(html).not.toContain('ws-technical-actions')
    expect(html).not.toContain('Esperar repuestos')
  })
  it.each(['admin', 'recepcion'])('conserva el menú para %s', role => {
    expect(render(role, 'en_reparacion')).toContain('aria-haspopup="menu"')
  })
})
