import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NotificationContext } from '../../src/context/notifications.js'
import FlowPreview from '../../src/preview/FlowPreview.jsx'
import { createDemoOrders } from '../../src/preview/preview-model.js'

describe('Ficha de consulta del taller', () => {
  afterEach(() => vi.unstubAllGlobals())
  it('abre con los datos técnicos visibles, fuera de los desplegables', () => {
    const order = createDemoOrders().find((item) => item.number === 'OS1042')
    const html = renderToStaticMarkup(<NotificationContext.Provider value={{ show() {}, dismiss() {} }}><MemoryRouter initialEntries={['/taller']}><FlowPreview /></MemoryRouter></NotificationContext.Provider>)
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
    expect(disclosures).toContain('Comprobante')
    expect(html).toContain('Falla informada · Recepción')
    expect(html).toContain('Diagnóstico · Técnico')
    expect(html).toContain('Actualizado por Juan · Técnico')
    const header = html.match(/<header class="fp-order-header"[\s\S]*?<\/header>/)[0]
    const technical = html.match(/<section class="fp-work"[\s\S]*?<\/section>/)[0]
    expect(header).not.toContain('Editar')
    expect(technical).toMatch(/<button\b[^>]*>[\s\S]*?Editar<\/button>/)
    expect(html).not.toContain('Guardar cambios')
    expect(html).not.toContain('Se guardará el diagnóstico')
    expect(html).not.toContain('Estás explorando el nuevo flujo')
    expect(html).not.toContain('Elegí un equipo, continuá el trabajo')
  })
  it('inicia según el tema del sistema sin necesitar la preferencia de producción', () => {
    vi.stubGlobal('window', { matchMedia: (query) => ({ matches: query === '(prefers-color-scheme: dark)' }) })
    const html = renderToStaticMarkup(<NotificationContext.Provider value={{ show() {}, dismiss() {} }}><MemoryRouter initialEntries={['/taller']}><FlowPreview /></MemoryRouter></NotificationContext.Provider>)
    expect(html).toContain('data-theme="dark"')
    expect(html).toContain('aria-label="Activar modo claro"')
  })
  it.each(['/recepcion', '/ordenes', '/terminados', '/clientes', '/clientes/client-0', '/resumen', '/metricas', '/actividad', '/usuarios', '/copias', '/papelera', '/configuracion', '/acceso'])('renderiza la pantalla %s sin proveedores de producción', (path) => {
    const html = renderToStaticMarkup(<NotificationContext.Provider value={{ show() {}, dismiss() {} }}><MemoryRouter initialEntries={[path]}><FlowPreview /></MemoryRouter></NotificationContext.Provider>)
    expect(html).toContain('Perfil de demostración')
    expect(html).not.toContain('Pantalla no disponible')
    expect(html).not.toContain('undefined')
  })
})
