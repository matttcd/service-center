import { describe, expect, it } from 'vitest'
import { validatePrintConfig, PRINT_DEFAULTS } from '../../server/printing.js'
import { buildLabelHtml } from '../../server/pdf/labelTemplate.js'

describe('impresión nativa y etiquetas', () => {
  it('conserva colas UNC y normaliza las medidas', () => {
    const value = validatePrintConfig({ ...PRINT_DEFAULTS, orderPrinter: '\\\\mostrador\\A4', labelWidthMm: 60.04 })
    expect(value.orderPrinter).toBe('\\\\mostrador\\A4')
    expect(value.labelWidthMm).toBe(60)
  })
  it('rechaza impresoras con controles y tamaños inválidos', () => {
    for (const changes of [{ orderPrinter: 'HP\ncmd' }, { labelWidthMm: 0 }, { labelHeightMm: Infinity }, { labelFormat: 'comando' }]) {
      expect(() => validatePrintConfig({ ...PRINT_DEFAULTS, ...changes })).toThrow()
    }
  })
  it('la etiqueta usa tamaño físico y escapa el contenido del cliente', () => {
    const html = buildLabelHtml({ orderNumber: 'OS0001', brand: '<script>', model: 'A15', createdAt: '2026-10-19' }, { fullName: 'A & B' }, PRINT_DEFAULTS)
    expect(html).toContain('size: 60mm 40mm')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('A &amp; B')
    expect(html).toContain('<svg')
    expect(html).not.toContain('<script>')
  })
})
