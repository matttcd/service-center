export function changedFields(base, values) {
  return Object.fromEntries(Object.entries(values).filter(([key, value]) => JSON.stringify(value) !== JSON.stringify(base[key])))
}

export function equipmentEditRequest(base, values) {
  const fields = equipmentChanges(base, values)
  return { ...fields, expected: Object.fromEntries(Object.keys(fields).map((key) => [key, base[key]])) }
}

export function rebaseEquipmentEdit(draft, current) {
  return { base: current, fields: { ...current, ...equipmentChanges(draft.base, draft.fields) } }
}

export function equipmentChanges(base, values) {
  const fields = changedFields(base, values)
  const access = ['pin', 'noPin', 'pattern']
  // El PIN, el patrón y la opción sin contraseña forman un único acceso.
  if (access.some((key) => key in fields)) for (const key of access) if (key in values) fields[key] = values[key]
  return fields
}
