const deviceType = (type) => type === 'Notebook' ? 'Notebook / PC' : type

export const intakeChoices = (value = '') => [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]

export function toggleIntakeChoice(value, choice, limit) {
  const items = intakeChoices(value)
  return (items.includes(choice) ? items.filter((item) => item !== choice) : items.length < limit ? [...items, choice] : items).join(', ')
}

export function intakeSuggestions(state, type, brand) {
  const models = new Map()
  for (const order of state.orders) {
    if (order.deletedAt || deviceType(order.deviceType) !== type) continue
    const key = `${order.brand}\n${order.model}`
    const item = models.get(key) || { brand: order.brand, name: order.model, count: 0 }
    item.count += 1
    models.set(key, item)
  }
  // shortcut: el catálogo de ejemplo sin tipo contiene teléfonos; usar el catálogo tipado al integrar la API.
  if (type === 'Celular') for (const entry of state.settings.catalog) {
    const knownBrand = [...new Set(state.orders.map((order) => order.brand))].sort((a, b) => b.length - a.length).find((name) => entry.startsWith(`${name} `))
    const maker = knownBrand || entry.split(' ')[0], name = entry.slice(maker.length).trim()
    if (name && !models.has(`${maker}\n${name}`)) models.set(`${maker}\n${name}`, { brand: maker, name, count: 0 })
  }
  const brands = new Map()
  for (const model of models.values()) brands.set(model.brand, (brands.get(model.brand) || 0) + model.count)
  const byUse = (a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es')
  return {
    brands: [...brands].map(([name, count]) => ({ name, count })).sort(byUse),
    models: [...models.values()].filter((model) => model.brand === brand).sort(byUse),
  }
}
