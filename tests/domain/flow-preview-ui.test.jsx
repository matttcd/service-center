import { afterEach, describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NotificationContext } from '../../src/context/notifications.js'
import FlowPreview from '../../src/preview/FlowPreview.jsx'
import { createDemoOrders } from '../../src/preview/preview-model.js'

describe('Ficha de consulta del taller', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('abre con los datos técnicos visibles, fuera de los desplegables', () => {
    const order = createDemoOrders().find((item) => item.number === 'OS1042')
    const html = renderToStaticMarkup(<NotificationContext.Provider value={{ show() {}, dismiss() {} }}><FlowPreview /></NotificationContext.Provider>)
    const disclosures = [...html.matchAll(/<details\b[^>]*>[\s\S]*?<\/details>/g)].join('')
    const reference = html.match(/<aside\b[^>]*aria-label="Datos del equipo"[\s\S]*?<\/aside>/)?.[0] || ''
    for (const value of [order.customer, order.phone, order.access, order.conditions, order.accessories]) {
      expect(reference).toContain(value)
      expect(html.split(value)).toHaveLength(2)
    }
    for (const value of [order.customer, order.phone, order.access, order.conditions, order.accessories, order.issue, order.diagnosis, order.work]) {
      expect(html).toContain(value)
      expect(disclosures).not.toContain(value)
    }
    expect(html).not.toContain('Mostrar contraseña')
    expect(html).not.toContain('Ver diagnóstico')
    expect(html).toContain('aria-label="Herramientas de la orden"')
    expect(html.match(/aria-haspopup="dialog"/g)).toHaveLength(3)
    expect(html).not.toContain('<details')
    expect(html).toContain('Falla informada · Recepción')
    expect(html).toContain('Diagnóstico · Técnico')
    expect(html).toContain('Actualizado por Juan · Técnico')
  })
  it('inicia según el tema del sistema sin necesitar la preferencia de producción', () => {
    vi.stubGlobal('window', { matchMedia: (query) => ({ matches: query === '(prefers-color-scheme: dark)' }) })
    const html = renderToStaticMarkup(<NotificationContext.Provider value={{ show() {}, dismiss() {} }}><FlowPreview /></NotificationContext.Provider>)
    expect(html).toContain('data-theme="dark"')
    expect(html).toContain('aria-label="Activar modo claro"')
  })
})
