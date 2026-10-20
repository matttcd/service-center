import { describe, expect, it } from 'vitest'
import {
  KEEP_UPPER,
  SPECIAL,
  titleCase,
  sentenceCase,
  normalizeList,
} from '../../shared/text.js'

describe('Text - Constantes de Normalización', () => {
  it('KEEP_UPPER debe incluir siglas y tecnologías clave', () => {
    expect(KEEP_UPPER.has('TV')).toBe(true)
    expect(KEEP_UPPER.has('USB')).toBe(true)
    expect(KEEP_UPPER.has('HDMI')).toBe(true)
    expect(KEEP_UPPER.has('4G')).toBe(true)
    expect(KEEP_UPPER.has('5G')).toBe(true)
    expect(KEEP_UPPER.has('PS5')).toBe(true)
  })

  it('SPECIAL debe preservar la capitalización oficial de marcas', () => {
    expect(SPECIAL.IPHONE).toBe('iPhone')
    expect(SPECIAL.SAMSUNG).toBe('Samsung')
    expect(SPECIAL.MOTOROLA).toBe('Motorola')
    expect(SPECIAL.XIAOMI).toBe('Xiaomi')
  })
})

describe('Text - titleCase', () => {
  it('capitaliza nombres y oraciones respetando marcas y siglas', () => {
    expect(titleCase('samsung galaxy s23')).toBe('Samsung Galaxy S23')
    expect(titleCase('cable usb y cargador de iphone')).toBe('Cable USB y Cargador de iPhone')
    expect(titleCase('smart tv led 4k')).toBe('Smart TV LED 4K')
  })

  it('mantiene en minúsculas las palabras de enlace en posiciones no iniciales', () => {
    expect(titleCase('cambio de modulo con pin')).toBe('Cambio de Modulo con Pin')
    expect(titleCase('de moto g a samsung')).toBe('De Moto G a Samsung')
  })

  it('soporta strings vacíos o valores nulos', () => {
    expect(titleCase('')).toBe('')
    expect(titleCase(null)).toBe('')
    expect(titleCase(undefined)).toBe('')
  })
})

describe('Text - sentenceCase', () => {
  it('capitaliza la primera letra de cada oración', () => {
    const input = 'pantalla rota. no enciende el equipo. se probo con cargador usb.'
    const expected = 'Pantalla rota. No enciende el equipo. Se probo con cargador USB.'
    expect(sentenceCase(input)).toBe(expected)
  })

  it('respeta marcas registradas y siglas dentro del texto', () => {
    const input = 'se cambio bateria de iphone. se probo conexion 5G.'
    expect(sentenceCase(input)).toBe('Se cambio bateria de iPhone. Se probo conexion 5G.')
  })
})

describe('Text - normalizeList', () => {
  it('normaliza listas separadas por coma con espaciado limpio', () => {
    const input = 'funda , cargador usb,vidrio templado'
    const expected = 'Funda, Cargador USB, Vidrio Templado'
    expect(normalizeList(input)).toBe(expected)
  })

  it('ignora items vacios generados por comas consecutivas', () => {
    const input = 'funda, , cargador'
    expect(normalizeList(input)).toBe('Funda, Cargador')
  })
})
