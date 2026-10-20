import { describe, expect, it } from 'vitest'
import {
  uid,
  toISODate,
  todayISO,
  parseISO,
  addDays,
  daysBetween,
} from '../../server/helpers.js'

describe('Server Helpers - IDs y Fechas', () => {
  it('uid genera identificadores únicos no vacíos', () => {
    const id1 = uid()
    const id2 = uid()
    expect(id1).toBeTruthy()
    expect(id2).toBeTruthy()
    expect(id1).not.toBe(id2)
  })

  it('toISODate formatea correctamente objetos Date a YYYY-MM-DD', () => {
    const d = new Date(2026, 4, 15) // Mes 4 = mayo
    expect(toISODate(d)).toBe('2026-05-15')
  })

  it('todayISO devuelve una fecha en formato YYYY-MM-DD correspondiente al día actual', () => {
    const today = todayISO()
    expect(/^\d{4}-\d{2}-\d{2}$/.test(today)).toBe(true)
  })

  it('parseISO interpreta fechas ISO en tiempo local', () => {
    const d = parseISO('2026-10-25')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(9) // octubre
    expect(d.getDate()).toBe(25)
  })

  it('addDays añade o resta días a una fecha ISO', () => {
    expect(addDays('2026-01-10', 5)).toBe('2026-01-15')
    expect(addDays('2026-01-10', -3)).toBe('2026-01-07')
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
  })

  it('daysBetween calcula la diferencia exacta en días entre dos fechas ISO', () => {
    expect(daysBetween('2026-05-01', '2026-05-10')).toBe(9)
    expect(daysBetween('2026-05-10', '2026-05-01')).toBe(-9)
    expect(daysBetween('2026-05-01', '2026-05-01')).toBe(0)
  })
})
