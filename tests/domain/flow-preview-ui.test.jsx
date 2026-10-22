import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NotificationContext } from '../../src/context/notifications.js'
import FlowPreview from '../../src/preview/FlowPreview.jsx'
import { createDemoOrders } from '../../src/preview/preview-model.js'

describe('Ficha de consulta del taller', () => {
  it('abre con los datos técnicos visibles, fuera de los desplegables', () => {
    const order = createDemoOrders().find((item) => item.number === 'OS1042')
    const html = renderToStaticMarkup(<NotificationContext.Provider value={{ show() {}, dismiss() {} }}><FlowPreview /></NotificationContext.Provider>)
    const disclosures = [...html.matchAll(/<details\b[^>]*>[\s\S]*?<\/details>/g)].join('')
    for (const value of [order.customer, order.phone, order.access, order.conditions, order.accessories, order.issue, order.diagnosis, order.work]) {
      expect(html).toContain(value)
      expect(disclosures).not.toContain(value)
    }
    expect(html).not.toContain('Mostrar contraseña')
    expect(html).not.toContain('Ver diagnóstico')
  })
})
