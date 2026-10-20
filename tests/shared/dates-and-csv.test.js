import { describe, it, expect } from 'vitest'
import { businessDate } from '../../shared/dates.js'
import { csvCell } from '../../shared/csv.js'
import { orderQuery } from '../../src/utils/orderQuery.js'

describe('fechas del local', () => {
  it('una orden de las 23:30 de Argentina pertenece al día anterior al UTC', () => {
    expect(businessDate('2026-10-20T02:30:00Z')).toBe('2026-10-19')
    expect(businessDate('2026-10-20T03:00:00Z')).toBe('2026-10-20')
  })
  it('conserva fechas sin horario y tolera campos ausentes', () => {
    expect(businessDate('2026-10-19')).toBe('2026-10-19')
    expect(businessDate(null)).toBe('')
    expect(businessDate('no-es-fecha')).toBe('')
  })
})
describe('exportación CSV', () => {
  it('evita que datos del cliente se ejecuten como fórmulas', () => {
    for (const input of ['=1+1', '+HYPERLINK("url")', '-1+1', '@SUM(A1)', '  =2', '\tvalor']) expect(csvCell(input)).toMatch(/^"'/)
    expect(csvCell('Cliente "Ejemplo", SA')).toBe('"Cliente ""Ejemplo"", SA"')
  })
  it('comparte los mismos filtros entre tabla y exportación', () => {
    const query = orderQuery({ status: 'all', brand: 'Samsung', onlyNotConfirmed: true, q: 'Juan', limit: 1000, offset: 0, customerId: '123' })
    expect(query.has('status')).toBe(false)
    expect(query.get('brand')).toBe('Samsung')
    expect(query.get('customerId')).toBe('123')
    expect(query.get('onlyNotConfirmed')).toBe('1')
    expect(query.get('offset')).toBe('0')
  })
})
