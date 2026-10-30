import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import OrderQueue from '../../src/components/OrderQueue.jsx'

const state = vi.hoisted(() => ({ orders: [], tab: 'mine', role: 'tecnico' }))
vi.mock('../../src/context/DataContext.jsx', () => ({ useData: () => ({ orders: state.orders, loading: false }) }))
vi.mock('../../src/context/AuthContext.jsx', () => ({ useAuth: () => ({ currentUser: { id: 'tech', role: state.role } }) }))
vi.mock('../../src/context/workspace.js', () => ({ useWorkspaceState: () => [{ tab: state.tab, search: '', scroll: 0 }, () => {}] }))
vi.mock('../../src/pages/OrderDetail.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/OrderForm.jsx', () => ({ default: () => null }))
vi.mock('../../src/components/PrintOrderPanel.jsx', () => ({ default: () => null }))

afterEach(() => vi.restoreAllMocks())

describe('Tiempo de la cola del taller', () => {
  it('muestra el tiempo desde la aprobación aunque conserve estado y fecha de aceptación', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-30T15:00:00Z'))
    state.tab = 'mine'
    state.orders = [{
      id: 'order', brand: 'Samsung', model: 'A15', status: 'presupuesto',
      assignedTo: 'tech', createdAt: '2026-10-29T10:00:00Z', acceptedAt: '2026-10-30T13:00:00Z',
      confirmed: true, history: [
        { at: '2026-10-30T13:00:00Z', status: 'presupuesto' },
        { at: '2026-10-30T14:57:00Z', status: 'presupuesto', note: 'Confirmado por el cliente' },
      ],
    }]
    const html = renderToStaticMarkup(<OrderQueue />)
    expect(html).toContain('title="Última actualización">· hace 3m')
    expect(html).not.toContain('hace 2h')
  })

  it('usa el ingreso cuando no hay historial, también en Sin asignar', () => {
    vi.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-10-30T15:00:00Z'))
    state.tab = 'available'
    state.orders = [{ id: 'order', brand: 'Samsung', model: 'A15', status: 'recibido', createdAt: '2026-10-30T14:50:00Z' }]
    expect(renderToStaticMarkup(<OrderQueue />)).toContain('title="Última actualización">· hace 10m')
  })
})

it('recepción puede consultar el taller sin una pestaña Mis trabajos', () => {
  state.role = 'recepcion'; state.tab = 'all'
  const html = renderToStaticMarkup(<OrderQueue />)
  expect(html).not.toContain('Mis trabajos')
  expect(html).toContain('Sin asignar')
  expect(html).toContain('Todos')
  state.role = 'tecnico'
})
