import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { NotificationContext } from '../../src/context/notifications.js'
import NewOrderForm from '../../src/preview/NewOrderForm.jsx'
import { intakeChoices, intakeSuggestions, toggleIntakeChoice } from '../../src/preview/intake-model.js'
import { NEW_ORDER, applySystemAction, createSystemState } from '../../src/preview/system-model.js'
import { DEVICE_TYPES } from '../../shared/fsm.js'
import { COMMON_ACCESSORIES, COMMON_CONDITIONS, COMMON_FIXES } from '../../src/utils/constants.js'

const state = createSystemState(1800000000000)
const render = (patch = {}, demo = state) => renderToStaticMarkup(<NotificationContext.Provider value={{ show() {}, dismiss() {} }}><NewOrderForm state={demo} value={{ ...NEW_ORDER, ...patch }} set={() => {}} onSubmit={() => {}} onClose={() => {}} /></NotificationContext.Provider>)

describe('Ingreso rápido de órdenes en la demo', () => {
  it('usa los tipos, iconos y listas del formulario original sin proveedores de producción', () => {
    const html = render({ entry: 'repair' })
    for (const type of DEVICE_TYPES) expect(html).toContain(`<span>${type}</span>`)
    expect(html.match(/<div class="fp-intake-types"[\s\S]*?<\/fieldset>/)[0].match(/<svg/g)).toHaveLength(DEVICE_TYPES.length)
    for (const choice of [...COMMON_ACCESSORIES, ...COMMON_CONDITIONS, ...COMMON_FIXES]) expect(html).toContain(choice)
    for (const label of ['Marcas frecuentes', 'Modelos frecuentes', 'DNI', 'Domicilio', 'Notas generales', 'Patrón de desbloqueo']) expect(html).toContain(label)
    expect(html).not.toContain('Registrar patrón')
  })
  it('ordena marcas y modelos por uso y no mezcla tipos ni marcas', () => {
    const demo = { settings: { catalog: ['Nokia 3310'] }, orders: [
      { brand: 'Samsung', model: 'A15', deviceType: 'Celular' },
      { brand: 'Apple', model: 'iPhone 11', deviceType: 'Celular' },
      { brand: 'Apple', model: 'iPhone 11', deviceType: 'Celular' },
      { brand: 'Apple', model: 'iPhone 13', deviceType: 'Celular' },
      { brand: 'Apple', model: 'MacBook', deviceType: 'Notebook' },
      { brand: 'Borrada', model: 'Prueba', deviceType: 'Celular', deletedAt: 1 },
    ] }
    const phones = intakeSuggestions(demo, 'Celular', 'Apple')
    expect(phones.brands).toEqual([{ name: 'Apple', count: 3 }, { name: 'Samsung', count: 1 }, { name: 'Nokia', count: 0 }])
    expect(phones.models.map((model) => model.name)).toEqual(['iPhone 11', 'iPhone 13'])
    expect(intakeSuggestions(demo, 'Notebook / PC', 'Apple').models.map((model) => model.name)).toEqual(['MacBook'])
  })
  it('conserva marcas de varias palabras al leer el catálogo de ejemplo', () => {
    const demo = { settings: { catalog: ['Marca Compuesta Modelo B'] }, orders: [{ brand: 'Marca Compuesta', model: 'Modelo A', deviceType: 'Celular' }] }
    expect(intakeSuggestions(demo, 'Celular', 'Marca Compuesta').models.map((model) => model.name)).toEqual(['Modelo A', 'Modelo B'])
  })
  it('marca, desmarca y limita chips sin perder opciones personalizadas', () => {
    expect(intakeChoices(' Funda, Cargador, Funda, ')).toEqual(['Funda', 'Cargador'])
    expect(toggleIntakeChoice('Funda, Adaptador propio', 'Cargador', 3)).toBe('Funda, Adaptador propio, Cargador')
    expect(toggleIntakeChoice('Funda, Adaptador propio', 'Funda', 2)).toBe('Adaptador propio')
    expect(toggleIntakeChoice('Funda, Adaptador propio', 'Cargador', 2)).toBe('Funda, Adaptador propio')
  })
  it('busca clientes por DNI y no ofrece clientes en papelera', () => {
    const customer = state.customers[0], html = render({ customerQuery: customer.dni })
    expect(html).toContain('aria-label="Clientes encontrados"')
    expect(html).toContain(customer.name)
    expect(render({ customerId: customer.id })).toContain(`DNI ${customer.dni}`)
    expect(render({ customerId: customer.id })).not.toContain('Nombre completo')
    const demo = { ...state, customers: state.customers.map((item) => ({ ...item, deletedAt: 1 })) }
    expect(render({ customerQuery: customer.dni }, demo)).not.toContain('Clientes encontrados')
  })
  it('conserva DNI y domicilio nuevos, y recuerda modelos ingresados en las sugerencias', () => {
    const next = applySystemAction(state, 'createOrder', { ...NEW_ORDER, customer: 'Cliente de prueba', dni: '12345678', address: 'Domicilio ficticio 123', phone: '11 5555-9999', brand: 'Marca Nueva', model: 'Modelo Z', issue: 'Revisar carga' }, 'recepcion', 1800000001000)
    expect(next.customers.at(-1)).toMatchObject({ dni: '12345678', address: 'Domicilio ficticio 123' })
    expect(intakeSuggestions(next, 'Celular', 'Marca Nueva').models).toContainEqual({ brand: 'Marca Nueva', name: 'Modelo Z', count: 1 })
    expect(state.customers).not.toHaveLength(next.customers.length)
  })
  it('conserva el tipo personalizado y los datos de recepción al crear la orden', () => {
    const next = applySystemAction(state, 'createOrder', { ...NEW_ORDER, customerId: state.customers[0].id, deviceType: 'Otro', customDeviceType: 'Radio', brand: 'Philips', model: 'AZ', issue: 'Revisar con su fuente', conditions: 'Apagado', accessories: 'Fuente propia', entry: 'repair', work: 'Cambiar conector', price: '10000', advance: '2000' }, 'recepcion')
    expect(next.orders.at(-1)).toMatchObject({ deviceType: 'Radio', conditions: 'Apagado', accessories: 'Fuente propia', work: 'Cambiar conector', price: 10000, advance: 2000, entry: 'repair' })
  })
})
