export function csvCell(value) {
  let text = String(value ?? '')
  // Una celda entre comillas todavía puede ejecutar fórmulas en Excel.
  if (/^\s*[=+\-@]/.test(text) || /^[\t\r\n]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}
