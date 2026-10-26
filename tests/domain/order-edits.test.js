import { expect, it } from 'vitest'
import { changedFields, equipmentEditRequest, rebaseEquipmentEdit } from '../../src/utils/orderEdits.js'

it('editar el PIN no sobrescribe cambios independientes del equipo desde otra PC', () => {
  const base = { brand: 'Samsung', pin: '1234', pattern: [0, 1, 2] }
  const fields = { ...base, pin: '4321' }
  expect(equipmentEditRequest(base, fields)).toEqual({ pin: '4321', pattern: [0, 1, 2], expected: { pin: '1234', pattern: [0, 1, 2] } })
  const current = { brand: 'Motorola', pin: '8888', pattern: [0, 3, 6] }
  const rebased = rebaseEquipmentEdit({ base, fields }, current)
  expect(rebased.fields).toEqual({ brand: 'Motorola', pin: '4321', pattern: [0, 1, 2] })
  expect(equipmentEditRequest(rebased.base, rebased.fields)).toEqual({ pin: '4321', pattern: [0, 1, 2], expected: { pin: '8888', pattern: [0, 3, 6] } })
})

it('conserva la coherencia del acceso al revisar un conflicto con la opción sin contraseña', () => {
  const base = { pin: '1234', noPin: false, pattern: [0, 1, 2] }
  const current = { pin: '', noPin: true, pattern: [] }
  const rebased = rebaseEquipmentEdit({ base, fields: { ...base, pin: '4321' } }, current)
  expect(rebased.fields).toEqual({ pin: '4321', noPin: false, pattern: [0, 1, 2] })
  expect(equipmentEditRequest(rebased.base, rebased.fields)).toEqual({ pin: '4321', noPin: false, pattern: [0, 1, 2], expected: current })
})

it('compara el contenido de patrones y omite campos sin modificar', () => {
  expect(changedFields({ pin: '1234', pattern: [0, 1, 2] }, { pin: '1234', pattern: [0, 1, 2] })).toEqual({})
  expect(equipmentEditRequest({ pattern: [0, 1, 2] }, { pattern: [0, 3, 6] })).toEqual({ pattern: [0, 3, 6], expected: { pattern: [0, 1, 2] } })
})
