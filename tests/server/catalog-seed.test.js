import { describe, expect, it } from 'vitest'
import { CATALOG } from '../../server/seed.js'

describe('Categorías del catálogo inicial', () => {
  const types = (brand, model) => CATALOG.filter(entry => entry.brand === brand && entry.models.includes(model)).map(entry => entry.deviceType)
  it('separa celulares, tablets, notebooks y otros equipos de una misma marca', () => {
    expect(types('Samsung', 'Galaxy A15')).toEqual(['Celular'])
    expect(types('Samsung', 'Galaxy Tab S9')).toEqual(['Tablet'])
    expect(types('Samsung', 'Galaxy Book4')).toEqual(['Notebook / PC'])
    expect(types('Samsung', 'Galaxy Watch 7')).toEqual(['Otro'])
    expect(types('Apple', 'iPad 10')).toEqual(['Tablet'])
    expect(types('Lenovo', 'Tab P12')).toEqual(['Tablet'])
  })
})
