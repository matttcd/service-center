import { describe, it, expect } from 'vitest'
import { cleanTerm, termsLength } from '../../shared/terms.js'
import { buildOrderHtml } from '../../server/pdf/orderTemplate.js'
import {
  moveArrayItem,
  parseBulkModels,
  termsTextToClauses,
} from '../../src/utils/helpers.js'

it('preserva los formatos de términos y trata el HTML arbitrario como texto en el comprobante', () => {
  const clause = '<b>30 días</b> & <i>vigente</i> <u>desde el retiro</u> <img src=x onerror=alert(1)>'
  const safe = '<strong>30 días</strong> &amp; <em>vigente</em> <u>desde el retiro</u> &lt;img src=x onerror=alert(1)&gt;'
  expect(cleanTerm(clause)).toBe(safe)
  expect(cleanTerm(safe)).toBe(safe)
  expect(termsLength([safe])).toBe('30 días & vigente desde el retiro <img src=x onerror=alert(1)>'.length)
  expect(buildOrderHtml({}, {}, [clause])).toContain(`<li>${safe}</li>`)
  expect(cleanTerm('<strong>Texto')).toBe('<strong>Texto</strong>')
})

describe('moveArrayItem', () => {
  it('moves an item upwards (from higher index to lower)', () => {
    const list = ['A', 'B', 'C', 'D']
    const result = moveArrayItem(list, 2, 1)
    expect(result).toEqual(['A', 'C', 'B', 'D'])
    // Check immutability
    expect(list).toEqual(['A', 'B', 'C', 'D'])
  })

  it('moves an item downwards (from lower index to higher)', () => {
    const list = ['A', 'B', 'C', 'D']
    const result = moveArrayItem(list, 0, 2)
    expect(result).toEqual(['B', 'C', 'A', 'D'])
  })

  it('returns a shallow copy when moving to the same index or out of bounds', () => {
    const list = ['A', 'B', 'C']
    expect(moveArrayItem(list, 1, 1)).toEqual(['A', 'B', 'C'])
    expect(moveArrayItem(list, -1, 1)).toEqual(['A', 'B', 'C'])
    expect(moveArrayItem(list, 1, 99)).toEqual(['A', 'B', 'C'])
  })

  it('handles empty or non-array inputs safely', () => {
    expect(moveArrayItem([], 0, 1)).toEqual([])
    expect(moveArrayItem(null, 0, 1)).toEqual([])
  })
})

describe('termsLength', () => {
  it('sums the lengths of all strings in terms array', () => {
    const terms = [
      'Garantía de 90 días sobre reparaciones.',
      'Equipos no retirados después de 60 días pasan a desguace.',
    ]
    const expected = terms[0].length + terms[1].length
    expect(termsLength(terms)).toBe(expected)
  })

  it('returns 0 for empty or non-array values', () => {
    expect(termsLength([])).toBe(0)
    expect(termsLength(null)).toBe(0)
    expect(termsLength(undefined)).toBe(0)
  })

  it('correctly calculates total for character limit validation (1600 chars)', () => {
    const longClause = 'a'.repeat(800)
    const terms = [longClause, longClause]
    expect(termsLength(terms)).toBe(1600)
    expect(termsLength([...terms, '<strong>x</strong>'])).toBe(1601)
  })
})

describe('parseBulkModels', () => {
  it('parses comma-separated brand and model lines', () => {
    const text = `
      Samsung, Galaxy S24 Ultra
      Apple, iPhone 16 Pro Max
      Xiaomi, Redmi Note 13 Pro
    `
    const parsed = parseBulkModels(text)
    expect(parsed).toEqual([
      { brand: 'Samsung', name: 'Galaxy S24 Ultra' },
      { brand: 'Apple', name: 'iPhone 16 Pro Max' },
      { brand: 'Xiaomi', name: 'Redmi Note 13 Pro' },
    ])
  })

  it('parses tab-separated brand and model lines', () => {
    const text = 'Motorola\tEdge 50 Pro\nMotorola\tMoto G84'
    const parsed = parseBulkModels(text)
    expect(parsed).toEqual([
      { brand: 'Motorola', name: 'Edge 50 Pro' },
      { brand: 'Motorola', name: 'Moto G84' },
    ])
  })

  it('parses space-separated brand and model lines as fallback', () => {
    const text = 'Samsung Galaxy A55 5G\nApple iPhone 15'
    const parsed = parseBulkModels(text)
    expect(parsed).toEqual([
      { brand: 'Samsung', name: 'Galaxy A55 5G' },
      { brand: 'Apple', name: 'iPhone 15' },
    ])
  })

  it('omits blank lines and malformed entries missing brand or model', () => {
    const text = `
      Samsung, Galaxy S23

         
      InvalidOnlyBrand,
      , OnlyModel
      Apple, iPhone 14
    `
    const parsed = parseBulkModels(text)
    expect(parsed).toEqual([
      { brand: 'Samsung', name: 'Galaxy S23' },
      { brand: 'Apple', name: 'iPhone 14' },
    ])
  })

  it('handles empty or non-string inputs safely', () => {
    expect(parseBulkModels('')).toEqual([])
    expect(parseBulkModels(null)).toEqual([])
  })
})

describe('termsTextToClauses', () => {
  it('converts paragraph-separated text into individual clauses', () => {
    const text = `
      Para retirar el equipo debe presentar la orden física.

      La garantía tiene una duración de 30 días corridos.

      Los pagos son exclusivamente en efectivo.
    `
    const clauses = termsTextToClauses(text)
    expect(clauses).toEqual([
      'Para retirar el equipo debe presentar la orden física.',
      'La garantía tiene una duración de 30 días corridos.',
      'Los pagos son exclusivamente en efectivo.',
    ])
  })

  it('strips leading ordinal numbers and bullet symbols automatically', () => {
    const text = `
      1. Primera cláusula sobre retiros.
      2) Segunda cláusula sobre garantía.
      - Tercera cláusula sobre pagos.
      • Cuarta cláusula sobre consultas.
    `
    const clauses = termsTextToClauses(text)
    expect(clauses).toEqual([
      'Primera cláusula sobre retiros.',
      'Segunda cláusula sobre garantía.',
      'Tercera cláusula sobre pagos.',
      'Cuarta cláusula sobre consultas.',
    ])
  })

  it('keeps single and double line breaks as separate clauses', () => {
    expect(termsTextToClauses('Cláusula A\nCláusula B\n\nCláusula C')).toEqual(['Cláusula A', 'Cláusula B', 'Cláusula C'])
  })

  it('handles empty or non-string inputs gracefully', () => {
    expect(termsTextToClauses('')).toEqual([])
    expect(termsTextToClauses(null)).toEqual([])
  })
})
