export function money(value, label = 'El importe') {
  const amount = Number(value ?? 0)
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e12) {
    throw Object.assign(new Error(`${label} debe ser un número válido, positivo o cero.`), { status: 400 })
  }
  return Math.round(amount * 100) / 100
}

export function orderDateRange(from, to) {
  const parse = (value) => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value))
    if (!match) throw Object.assign(new Error('Fecha inválida.'), { status: 400 })
    const [, y, m, d] = match.map(Number)
    const date = new Date(y, m - 1, d)
    if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) {
      throw Object.assign(new Error('Fecha inválida.'), { status: 400 })
    }
    return date
  }
  const range = {}
  if (from) range.gte = parse(from)
  if (to) { range.lt = parse(to); range.lt.setDate(range.lt.getDate() + 1) }
  if (range.gte && range.lt && range.gte >= range.lt) throw Object.assign(new Error('Rango de fechas inválido.'), { status: 400 })
  return range
}

export function unlockPattern(value) {
  const unique = Array.isArray(value) ? [...new Set(value.filter((n) => Number.isInteger(n) && n >= 0 && n < 9))].slice(0, 9) : []
  return unique.length >= 3 ? unique : []
}
