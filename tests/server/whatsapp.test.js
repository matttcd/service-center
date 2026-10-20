import { describe, expect, it } from 'vitest'
import { normalizePhone, renderTemplate } from '../../server/whatsapp.js'

describe('WhatsApp - renderTemplate', () => {
  it('reemplaza todas las variables de la plantilla correctamente', () => {
    const template = 'Hola {cliente}, tu {dispositivo} (Orden {orden}) está listo en {local}.'
    const vars = {
      cliente: 'Juan Perez',
      dispositivo: 'Samsung A54',
      orden: 'OS0012',
      local: 'El Gringo Celulares',
    }
    const result = renderTemplate(template, vars)
    expect(result).toBe('Hola Juan Perez, tu Samsung A54 (Orden OS0012) está listo en El Gringo Celulares.')
  })

  it('maneja variables repetidas en la plantilla', () => {
    const template = '{cliente}: confirmamos que {cliente} retira orden {orden}.'
    const vars = { cliente: 'Maria', orden: 'OS0001' }
    const result = renderTemplate(template, vars)
    expect(result).toBe('Maria: confirmamos que Maria retira orden OS0001.')
  })

  it('maneja valores faltantes o nulos sin romper', () => {
    const template = 'Hola {cliente}, orden {orden}.'
    expect(renderTemplate(template, {})).toBe('Hola , orden .')
    expect(renderTemplate(null, {})).toBe('')
    expect(renderTemplate(undefined, {})).toBe('')
  })
})

describe('WhatsApp - normalizePhone (Argentina)', () => {
  it('mantiene teléfonos que ya vienen con prefijo internacional completo (549 + 10 dígitos)', () => {
    expect(normalizePhone('5493704123456')).toBe('5493704123456')
    expect(normalizePhone('+54 9 3704-123456')).toBe('5493704123456')
  })

  it('agrega el 9 a números con 54 pero sin el 9', () => {
    // 54 + 10 dígitos = 12 dígitos total
    expect(normalizePhone('543704123456')).toBe('5493704123456')
  })

  it('antepone 549 a números locales de 10 dígitos', () => {
    expect(normalizePhone('3704123456')).toBe('5493704123456')
    expect(normalizePhone('11 5555 4444')).toBe('5491155554444')
  })

  it('elimina el 0 inicial de código de área si lo tuviera', () => {
    // 03704123456 -> 3704123456 -> 5493704123456
    expect(normalizePhone('03704123456')).toBe('5493704123456')
    expect(normalizePhone('011 5555-4444')).toBe('5491155554444')
  })

  it('devuelve null si no hay dígitos o el número es demasiado corto', () => {
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone(null)).toBeNull()
    expect(normalizePhone(undefined)).toBeNull()
    expect(normalizePhone('12345')).toBeNull()
    expect(normalizePhone('abc-def')).toBeNull()
  })
})
