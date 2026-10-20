import { describe, it, expect } from 'vitest'
import { money, orderDateRange, unlockPattern } from '../../server/validation.js'

describe('validación de datos de órdenes', () => {
  it('no convierte valores inválidos o negativos en importes silenciosamente', () => {
    for (const amount of [-1, Infinity, 'NaN', 'abc', 1e14]) expect(() => money(amount)).toThrow()
    expect(money('1250.50')).toBe(1250.5)
    expect(money(1.234)).toBe(1.23)
  })
  it('incluye todo el último día del filtro en el horario local', () => {
    const range = orderDateRange('2026-10-19', '2026-10-19')
    expect(range.gte.getDate()).toBe(19)
    expect(range.lt.getDate()).toBe(20)
    expect(range.lt.getHours()).toBe(0)
  })
  it('rechaza fechas imposibles e intervalos invertidos', () => {
    expect(() => orderDateRange('2026-02-30')).toThrow()
    expect(() => orderDateRange('2026-11-01', '2026-10-01')).toThrow()
  })
  it('el patrón contiene puntos válidos y distintos', () => {
    expect(unlockPattern([0, 0, 1, 2, -1, 9, '3'])).toEqual([0, 1, 2])
    expect(unlockPattern([0, 1])).toEqual([])
  })
})
