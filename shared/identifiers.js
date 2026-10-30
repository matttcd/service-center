export const normalizeDni = (value) => String(value ?? '').replace(/[.\s]/g, '')

export function formatDni(value) {
  const dni = normalizeDni(value)
  return /^\d+$/.test(dni) ? dni.replace(/\B(?=(\d{3})+(?!\d))/g, '.') : dni
}
