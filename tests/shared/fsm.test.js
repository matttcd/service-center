import { describe, expect, it } from 'vitest'
import {
  ORDER_STATUSES,
  ORDER_STATUS_LABEL,
  DEVICE_TYPES,
  allowedTransitions,
  nextStatus,
  nextStatusLabel,
  canTransitionForRole,
} from '../../shared/fsm.js'

describe('FSM - Estados y Etiquetas', () => {
  it('debe contener los 8 estados oficiales del sistema', () => {
    expect(ORDER_STATUSES).toEqual([
      'recibido',
      'en_revision',
      'presupuesto',
      'en_reparacion',
      'falta_repuestos',
      'terminado',
      'entregado',
      'en_tercero',
    ])
  })

  it('cada estado debe tener su etiqueta en ORDER_STATUS_LABEL', () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_STATUS_LABEL[status]).toBeDefined()
      expect(typeof ORDER_STATUS_LABEL[status]).toBe('string')
      expect(ORDER_STATUS_LABEL[status].length).toBeGreaterThan(0)
    }
  })

  it('debe incluir los tipos de dispositivo esperados', () => {
    expect(DEVICE_TYPES).toContain('Celular')
    expect(DEVICE_TYPES).toContain('Tablet')
    expect(DEVICE_TYPES).toContain('Notebook / PC')
    expect(DEVICE_TYPES).toContain('Smart TV')
    expect(DEVICE_TYPES).toContain('Consola')
  })
})

describe('FSM - allowedTransitions', () => {
  it('para orden recibido con diagnostico de revision pasa a en_revision', () => {
    const order = { status: 'recibido', diagnosisType: 'revision' }
    const transitions = allowedTransitions(order)
    expect(transitions).toEqual(['en_revision', 'entregado', 'en_tercero'])
  })

  it('para orden recibido con falla visible pasa directo a en_reparacion', () => {
    const order = { status: 'recibido', diagnosisType: 'visible' }
    const transitions = allowedTransitions(order)
    expect(transitions).toEqual(['en_reparacion', 'entregado', 'en_tercero'])
  })

  it('para orden recibido con servicio simple permite terminar directo en recepcion', () => {
    const order = { status: 'recibido', isSimpleService: true }
    const transitions = allowedTransitions(order)
    expect(transitions).toEqual(['terminado', 'en_reparacion', 'entregado', 'en_tercero'])
  })

  it('desde en_revision solo puede pasar a presupuesto, entregado o en_tercero', () => {
    const order = { status: 'en_revision' }
    expect(allowedTransitions(order)).toEqual(['presupuesto', 'entregado', 'en_tercero'])
  })

  it('desde presupuesto solo puede pasar a en_reparacion, entregado o en_tercero', () => {
    const order = { status: 'presupuesto' }
    expect(allowedTransitions(order)).toEqual(['en_reparacion', 'entregado', 'en_tercero'])
  })

  it('desde en_reparacion puede avanzar a terminado, retroceder a presupuesto o pausar por repuestos', () => {
    const order = { status: 'en_reparacion' }
    expect(allowedTransitions(order)).toEqual(['terminado', 'presupuesto', 'entregado', 'falta_repuestos', 'en_tercero'])
  })

  it('desde falta_repuestos puede retomar a en_reparacion', () => {
    const order = { status: 'falta_repuestos' }
    expect(allowedTransitions(order)).toEqual(['en_reparacion', 'entregado', 'en_tercero'])
  })

  it('desde terminado puede entregarse, volver a taller o derivar a tercero', () => {
    const order = { status: 'terminado' }
    expect(allowedTransitions(order)).toEqual(['entregado', 'en_reparacion', 'en_tercero'])
  })

  it('desde en_tercero puede reingresar a multiples estados internos', () => {
    const order = { status: 'en_tercero' }
    expect(allowedTransitions(order)).toEqual([
      'recibido',
      'en_revision',
      'presupuesto',
      'en_reparacion',
      'falta_repuestos',
      'terminado',
    ])
  })

  it('desde entregado solo permite reingreso por garantia como recibido', () => {
    const order = { status: 'entregado' }
    expect(allowedTransitions(order)).toEqual(['recibido'])
  })

  it('devuelve array vacio ante un estado invalido o nulo', () => {
    expect(allowedTransitions(null)).toEqual([])
    expect(allowedTransitions({})).toEqual([])
    expect(allowedTransitions({ status: 'desconocido' })).toEqual([])
  })
})

describe('FSM - nextStatus y nextStatusLabel', () => {
  it('obtiene el primer destino valido como siguiente estado', () => {
    expect(nextStatus({ status: 'recibido', diagnosisType: 'revision' })).toBe('en_revision')
    expect(nextStatus({ status: 'recibido', diagnosisType: 'visible' })).toBe('en_reparacion')
    expect(nextStatus({ status: 'recibido', isSimpleService: true })).toBe('terminado')
    expect(nextStatus({ status: 'en_revision' })).toBe('presupuesto')
    expect(nextStatus({ status: 'presupuesto' })).toBe('en_reparacion')
    expect(nextStatus({ status: 'en_reparacion' })).toBe('terminado')
    expect(nextStatus({ status: 'terminado' })).toBe('entregado')
  })

  it('obtiene la etiqueta humana del boton de accion rapida', () => {
    expect(nextStatusLabel({ status: 'recibido', diagnosisType: 'revision' })).toBe('Revisar')
    expect(nextStatusLabel({ status: 'recibido', diagnosisType: 'visible' })).toBe('Reparar')
    expect(nextStatusLabel({ status: 'en_revision' })).toBe('Presupuesto')
    expect(nextStatusLabel({ status: 'presupuesto' })).toBe('Reparar')
    expect(nextStatusLabel({ status: 'en_reparacion' })).toBe('Listo')
  })
})

describe('FSM - canTransitionForRole (Control de acceso por rol)', () => {
  it('recepcion NO puede pasar a en_revision ni en_reparacion', () => {
    const order = { status: 'recibido' }
    expect(canTransitionForRole('en_revision', 'recepcion', order)).toBe(false)
    expect(canTransitionForRole('en_reparacion', 'recepcion', order)).toBe(false)
  })

  it('recepcion SI puede pasar a terminado cuando es un servicio simple', () => {
    const simpleOrder = { status: 'recibido', isSimpleService: true }
    expect(canTransitionForRole('terminado', 'recepcion', simpleOrder)).toBe(true)
  })

  it('recepcion NO puede pasar a terminado una orden comun sin ser servicio simple', () => {
    const normalOrder = { status: 'en_reparacion', isSimpleService: false }
    expect(canTransitionForRole('terminado', 'recepcion', normalOrder)).toBe(false)
  })

  it('tecnico SI puede pasar a en_revision, en_reparacion, falta_repuestos y terminado', () => {
    expect(canTransitionForRole('en_revision', 'tecnico')).toBe(true)
    expect(canTransitionForRole('en_reparacion', 'tecnico')).toBe(true)
    expect(canTransitionForRole('falta_repuestos', 'tecnico')).toBe(true)
    expect(canTransitionForRole('terminado', 'tecnico')).toBe(true)
  })

  it('tecnico puede enviar a presupuesto pero no entregar equipos', () => {
    expect(canTransitionForRole('entregado', 'tecnico')).toBe(false)
    expect(canTransitionForRole('presupuesto', 'tecnico')).toBe(true)
  })

  it('tecnico NO puede derivar ni recibir equipos de talleres terceros', () => {
    expect(canTransitionForRole('en_tercero', 'tecnico')).toBe(false)
    const orderEnTercero = { status: 'en_tercero' }
    expect(canTransitionForRole('recibido', 'tecnico', orderEnTercero)).toBe(false)
  })

  it('admin tiene permisos para todas las transiciones tecnicas y de mostrador', () => {
    expect(canTransitionForRole('en_revision', 'admin')).toBe(true)
    expect(canTransitionForRole('en_reparacion', 'admin')).toBe(true)
    expect(canTransitionForRole('presupuesto', 'admin')).toBe(true)
    expect(canTransitionForRole('terminado', 'admin')).toBe(true)
    expect(canTransitionForRole('entregado', 'admin')).toBe(true)
    expect(canTransitionForRole('en_tercero', 'admin')).toBe(true)
  })
})
