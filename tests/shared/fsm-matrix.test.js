import { describe, expect, it } from 'vitest'
import {
  ORDER_STATUSES,
  allowedTransitions,
  canTransitionForRole,
} from '../../shared/fsm.js'

describe('FSM Matrix - Matriz Completa de Transiciones (64 pares)', () => {
  // Mapa esperado de transiciones permitidas según estado y configuración
  const getExpected = (from, order = {}) => {
    switch (from) {
      case 'recibido':
        if (order.isSimpleService) return ['terminado', 'en_reparacion', 'entregado', 'en_tercero']
        return order.diagnosisType === 'revision'
          ? ['en_revision', 'entregado', 'en_tercero']
          : ['en_reparacion', 'entregado', 'en_tercero']
      case 'en_revision':
        return ['presupuesto', 'entregado', 'en_tercero']
      case 'presupuesto':
        return ['en_reparacion', 'entregado', 'en_tercero']
      case 'en_reparacion':
        return ['terminado', 'presupuesto', 'entregado', 'falta_repuestos', 'en_tercero']
      case 'falta_repuestos':
        return ['en_reparacion', 'entregado', 'en_tercero']
      case 'terminado':
        return ['entregado', 'en_reparacion', 'en_tercero']
      case 'en_tercero':
        return ['recibido', 'en_revision', 'presupuesto', 'en_reparacion', 'falta_repuestos', 'terminado']
      case 'entregado':
        return ['recibido']
      default:
        return []
    }
  }

  // 1. Probar cada estado origen contra los 8 estados destino (orden estándar con diagnóstico de revisión)
  describe('Diagnóstico de revisión estándar', () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        const order = { status: from, diagnosisType: 'revision', isSimpleService: false }
        const allowed = allowedTransitions(order)
        const expectedList = getExpected(from, order)
        const shouldBeAllowed = expectedList.includes(to)

        it(`${from} -> ${to} debe ser ${shouldBeAllowed ? 'PERMITIDO' : 'BLOQUEADO'}`, () => {
          expect(allowed.includes(to)).toBe(shouldBeAllowed)
        })
      }
    }
  })

  // 2. Probar orden con falla visible (pasa directo a reparación, no a revisión)
  describe('Diagnóstico visible vs revisión', () => {
    it('recibido con falla visible NO puede pasar a en_revision', () => {
      const order = { status: 'recibido', diagnosisType: 'visible' }
      expect(allowedTransitions(order)).not.toContain('en_revision')
      expect(allowedTransitions(order)).toContain('en_reparacion')
    })

    it('recibido con revisión NO puede pasar directo a en_reparacion', () => {
      const order = { status: 'recibido', diagnosisType: 'revision' }
      expect(allowedTransitions(order)).not.toContain('en_reparacion')
      expect(allowedTransitions(order)).toContain('en_revision')
    })
  })

  // 3. Probar orden de servicio simple
  describe('Servicio simple', () => {
    it('recibido con isSimpleService=true permite terminar de inmediato en mostrador', () => {
      const order = { status: 'recibido', isSimpleService: true }
      expect(allowedTransitions(order)).toContain('terminado')
      expect(allowedTransitions(order)).toContain('en_reparacion')
      expect(allowedTransitions(order)).toContain('entregado')
      expect(allowedTransitions(order)).toContain('en_tercero')
    })
  })
})

describe('FSM Matrix - Matriz de Permisos por Rol en Transiciones', () => {
  it('admin tiene autorización total para todas las transiciones operativas', () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransitionForRole(status, 'admin', { status: 'recibido' })).toBe(true)
    }
  })

  it('roles no reconocidos o nulos no tienen permisos para ninguna acción de taller o mostrador', () => {
    const invalidRoles = ['invitado', 'externo', null, undefined]
    for (const role of invalidRoles) {
      expect(canTransitionForRole('en_revision', role)).toBe(false)
      expect(canTransitionForRole('en_reparacion', role)).toBe(false)
      expect(canTransitionForRole('presupuesto', role)).toBe(false)
      expect(canTransitionForRole('terminado', role)).toBe(false)
      expect(canTransitionForRole('entregado', role)).toBe(false)
      expect(canTransitionForRole('falta_repuestos', role)).toBe(false)
      expect(canTransitionForRole('en_tercero', role)).toBe(false)
    }
  })

  it('recepcion puede derivar a taller externo y recibir de taller externo', () => {
    expect(canTransitionForRole('en_tercero', 'recepcion')).toBe(true)
    expect(canTransitionForRole('recibido', 'recepcion', { status: 'en_tercero' })).toBe(true)
  })

  it('tecnico tiene prohibido enviar o recibir equipos de talleres externos', () => {
    expect(canTransitionForRole('en_tercero', 'tecnico')).toBe(false)
    expect(canTransitionForRole('recibido', 'tecnico', { status: 'en_tercero' })).toBe(false)
    expect(canTransitionForRole('terminado', 'tecnico', { status: 'en_tercero' })).toBe(false)
  })

  it('recepcion puede terminar una orden recibida solo si es servicio simple', () => {
    const simpleOrder = { status: 'recibido', isSimpleService: true }
    const normalOrder = { status: 'recibido', isSimpleService: false }
    expect(canTransitionForRole('terminado', 'recepcion', simpleOrder)).toBe(true)
    expect(canTransitionForRole('terminado', 'recepcion', normalOrder)).toBe(false)
  })

  it('recepcion puede avanzar a presupuesto y entregado', () => {
    expect(canTransitionForRole('presupuesto', 'recepcion')).toBe(true)
    expect(canTransitionForRole('entregado', 'recepcion')).toBe(true)
  })

  it('tecnico puede enviar diagnóstico a presupuesto pero no entregar al cliente', () => {
    expect(canTransitionForRole('presupuesto', 'tecnico')).toBe(true)
    expect(canTransitionForRole('entregado', 'tecnico')).toBe(false)
  })
})
