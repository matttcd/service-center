import { describe, expect, it } from 'vitest'

// Helper de cálculo de saldo financiero
function calculateOrderBalance(price, advance) {
  const p = Math.max(0, Number(price) || 0)
  const a = Math.max(0, Number(advance) || 0)
  return {
    price: p,
    advance: a,
    balance: Math.max(0, p - a),
    isFullyPaid: a >= p && p > 0,
    hasPendingBalance: p > a,
  }
}

// Helper de validación de entrega / retiro
function validatePickupData({ pickupBy, pickupName, pickupDni }) {
  if (pickupBy === 'tercero') {
    if (!pickupName || !String(pickupName).trim()) {
      return { valid: false, error: 'Debe ingresar el nombre del tercero autorizado.' }
    }
    if (!pickupDni || !String(pickupDni).trim()) {
      return { valid: false, error: 'Debe ingresar el DNI del tercero autorizado.' }
    }
  }
  return { valid: true, error: null }
}

// Helper de ciclo de vida de repuestos
const VALID_SPARE_PART_STATUSES = ['necesario', 'pedido', 'recibido']

function validateSparePart({ name, quantity, status }) {
  if (!name || !String(name).trim()) {
    return { valid: false, error: 'El nombre del repuesto es obligatorio.' }
  }
  const q = Number(quantity)
  if (!Number.isInteger(q) || q < 1) {
    return { valid: false, error: 'La cantidad debe ser un número entero mayor o igual a 1.' }
  }
  if (!VALID_SPARE_PART_STATUSES.includes(status)) {
    return { valid: false, error: `Estado de repuesto inválido. Permitidos: ${VALID_SPARE_PART_STATUSES.join(', ')}` }
  }
  return { valid: true, error: null }
}

// Helper de evaluación de validez de garantía (30 días corridos)
function isWarrantyValid(deliveredAt, currentDate = new Date(), warrantyDays = 30) {
  if (!deliveredAt) return false
  const deliveredTime = new Date(deliveredAt).getTime()
  const currentTime = new Date(currentDate).getTime()
  if (Number.isNaN(deliveredTime) || Number.isNaN(currentTime)) return false
  const diffDays = (currentTime - deliveredTime) / (1000 * 60 * 60 * 24)
  return diffDays >= 0 && diffDays <= warrantyDays
}

// Helper de purga de papelera
function isEligibleForPermanentPurge(deletedAt, currentDate = new Date(), retentionDays = 30) {
  if (!deletedAt) return false
  const delTime = new Date(deletedAt).getTime()
  const nowTime = new Date(currentDate).getTime()
  const diffMs = nowTime - delTime
  return diffMs > retentionDays * 24 * 60 * 60 * 1000
}

describe('Domain - Cálculo Financiero de Saldos de Orden', () => {
  it('calcula saldo pendiente cuando el adelanto es menor que el precio', () => {
    const calc = calculateOrderBalance(50000, 20000)
    expect(calc.balance).toBe(30000)
    expect(calc.isFullyPaid).toBe(false)
    expect(calc.hasPendingBalance).toBe(true)
  })

  it('marca orden como totalmente pagada cuando el adelanto cubre el precio total', () => {
    const calc = calculateOrderBalance(35000, 35000)
    expect(calc.balance).toBe(0)
    expect(calc.isFullyPaid).toBe(true)
    expect(calc.hasPendingBalance).toBe(false)
  })

  it('no genera saldos negativos si el adelanto es mayor por error', () => {
    const calc = calculateOrderBalance(10000, 15000)
    expect(calc.balance).toBe(0)
    expect(calc.isFullyPaid).toBe(true)
  })

  it('maneja valores vacíos, nulos o no numéricos de forma segura', () => {
    const calc = calculateOrderBalance(null, undefined)
    expect(calc.price).toBe(0)
    expect(calc.advance).toBe(0)
    expect(calc.balance).toBe(0)
  })
})

describe('Domain - Validación de Retiro y Entrega', () => {
  it('retiro por titular es válido sin exigir nombre ni DNI de tercero', () => {
    const res = validatePickupData({ pickupBy: 'cliente', pickupName: '', pickupDni: '' })
    expect(res.valid).toBe(true)
    expect(res.error).toBeNull()
  })

  it('retiro por tercero exige obligatoriamente nombre del tercero', () => {
    const res = validatePickupData({ pickupBy: 'tercero', pickupName: '', pickupDni: '38123456' })
    expect(res.valid).toBe(false)
    expect(res.error).toContain('nombre del tercero')
  })

  it('retiro por tercero exige obligatoriamente DNI del tercero', () => {
    const res = validatePickupData({ pickupBy: 'tercero', pickupName: 'Carlos Gómez', pickupDni: '' })
    expect(res.valid).toBe(false)
    expect(res.error).toContain('DNI del tercero')
  })

  it('retiro por tercero con nombre y DNI completos es válido', () => {
    const res = validatePickupData({
      pickupBy: 'tercero',
      pickupName: 'Carlos Gómez',
      pickupDni: '38123456',
    })
    expect(res.valid).toBe(true)
    expect(res.error).toBeNull()
  })
})

describe('Domain - Gestión y Validación de Repuestos', () => {
  it('valida repuesto correcto en estado necesario', () => {
    const res = validateSparePart({ name: 'Módulo pantalla OLED', quantity: 1, status: 'necesario' })
    expect(res.valid).toBe(true)
  })

  it('valida repuestos en estados pedido y recibido', () => {
    expect(validateSparePart({ name: 'Batería BN56', quantity: 2, status: 'pedido' }).valid).toBe(true)
    expect(validateSparePart({ name: 'Batería BN56', quantity: 2, status: 'recibido' }).valid).toBe(true)
  })

  it('rechaza repuesto con nombre vacío', () => {
    const res = validateSparePart({ name: '   ', quantity: 1, status: 'necesario' })
    expect(res.valid).toBe(false)
    expect(res.error).toContain('nombre del repuesto')
  })

  it('rechaza cantidades menores a 1 o fraccionarias', () => {
    expect(validateSparePart({ name: 'Pin de carga', quantity: 0, status: 'necesario' }).valid).toBe(false)
    expect(validateSparePart({ name: 'Pin de carga', quantity: -1, status: 'necesario' }).valid).toBe(false)
    expect(validateSparePart({ name: 'Pin de carga', quantity: 1.5, status: 'necesario' }).valid).toBe(false)
  })

  it('rechaza estados de repuesto no oficiales', () => {
    const res = validateSparePart({ name: 'Flex', quantity: 1, status: 'cancelado' })
    expect(res.valid).toBe(false)
    expect(res.error).toContain('Estado de repuesto inválido')
  })
})

describe('Domain - Garantías de Reparación (30 Días)', () => {
  const baseDate = new Date('2026-05-15T12:00:00Z')

  it('garantía es válida a los 10 días de la entrega', () => {
    const deliveredAt = new Date('2026-05-05T12:00:00Z')
    expect(isWarrantyValid(deliveredAt, baseDate)).toBe(true)
  })

  it('garantía es válida exactamente en el día 30', () => {
    const deliveredAt = new Date('2026-04-15T12:00:00Z')
    expect(isWarrantyValid(deliveredAt, baseDate)).toBe(true)
  })

  it('garantía expira a los 31 días de la entrega', () => {
    const deliveredAt = new Date('2026-04-14T11:59:00Z')
    expect(isWarrantyValid(deliveredAt, baseDate)).toBe(false)
  })

  it('devuelve falso si no hay fecha de entrega', () => {
    expect(isWarrantyValid(null, baseDate)).toBe(false)
  })
})

describe('Domain - Purga y Retención de Papelera (30 Días)', () => {
  const now = new Date('2026-06-01T00:00:00Z')

  it('registro eliminado hace 10 días permanece en papelera (no purgable)', () => {
    const deletedAt = new Date('2026-05-22T00:00:00Z')
    expect(isEligibleForPermanentPurge(deletedAt, now)).toBe(false)
  })

  it('registro eliminado hace 35 días es elegible para purga permanente', () => {
    const deletedAt = new Date('2026-04-25T00:00:00Z')
    expect(isEligibleForPermanentPurge(deletedAt, now)).toBe(true)
  })

  it('registro activo (sin deletedAt) no es purgable', () => {
    expect(isEligibleForPermanentPurge(null, now)).toBe(false)
  })
})
