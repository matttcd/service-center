import './env.js'
import { execFile } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { prisma } from './db.js'
import { listBridgePrinters, printPdfToBridge } from './printer/pdf_bridge_client.js'
import { printZplLabel } from './printer.js'

export const printTransport = () => {
  const value = process.env.PRINT_TRANSPORT || (process.platform === 'win32' ? 'windows' : 'bridge')
  if (!['windows', 'bridge'].includes(value)) throw new Error('PRINT_TRANSPORT debe ser windows o bridge.')
  return value
}
export const PRINT_DEFAULTS = { orderPrinter: '', labelPrinter: '', labelFormat: 'pdf', labelWidthMm: 60, labelHeightMm: 40 }

export function validatePrintConfig(input) {
  if (!input || typeof input !== 'object') throw new Error('Configuración de impresión inválida.')
  const value = { ...PRINT_DEFAULTS }
  for (const key of ['orderPrinter', 'labelPrinter']) {
    if (typeof input[key] !== 'string' || input[key].length > 256 || [...input[key]].some((char) => char.charCodeAt(0) < 32)) throw new Error('Nombre de impresora inválido.')
    value[key] = input[key].trim()
  }
  if (!['pdf', 'zpl'].includes(input.labelFormat)) throw new Error('Formato de etiqueta inválido.')
  value.labelFormat = input.labelFormat
  for (const key of ['labelWidthMm', 'labelHeightMm']) {
    const size = Number(input[key])
    if (!Number.isFinite(size) || size < 25 || size > 150) throw new Error('Las medidas de etiqueta deben estar entre 25 y 150 mm.')
    value[key] = Math.round(size * 10) / 10
  }
  return value
}

export async function getPrintConfig() {
  const record = await prisma.config.findUnique({ where: { key: 'printing' } })
  return { ...PRINT_DEFAULTS, ...(printTransport() === 'bridge' ? { labelFormat: 'zpl' } : {}), ...record?.value }
}

export function windowsPrint(payload) {
  const executable = process.env.WINDOWS_PRINT_HELPER || process.env.PYTHON || 'python'
  const args = process.env.WINDOWS_PRINT_HELPER ? [] : ['-X', 'utf8', fileURLToPath(new URL('./printer/windows_print.py', import.meta.url))]
  return new Promise((resolve) => {
    const child = execFile(executable, args, { windowsHide: true, timeout: 70000, maxBuffer: 2 * 1024 * 1024, encoding: 'utf8' }, (error, stdout) => {
      if (error) return resolve({ ok: false, error: error.killed ? 'Impresión sin confirmar. Revisá la cola antes de reimprimir.' : 'El componente de impresión no está disponible. Revisá la instalación.' })
      try { resolve(JSON.parse(stdout)) }
      catch { resolve({ ok: false, error: 'El componente de impresión devolvió una respuesta inválida.' }) }
    })
    child.stdin.on('error', () => {})
    child.stdin.end(JSON.stringify(payload))
  })
}

export async function listPrinters() {
  return printTransport() === 'windows' ? windowsPrint({ action: 'printers' }) : listBridgePrinters()
}

export async function printPdf(buffer, printer, { label = false } = {}) {
  if (buffer.length > 14 * 1024 * 1024) return { ok: false, error: 'El documento supera el límite de impresión de 14 MiB.' }
  const config = await getPrintConfig()
  const selected = printer || (label ? config.labelPrinter : config.orderPrinter)
  if (!selected && printTransport() === 'windows') return { ok: false, error: 'Configurá la impresora en Configuración → Impresoras.' }
  return printTransport() === 'windows'
    ? windowsPrint({ action: 'pdf', pdf: buffer.toString('base64'), printer: selected, settings: label ? 'noscale' : 'fit' })
    : printPdfToBridge(buffer, selected || null)
}

export async function printRawLabel(label, printer) {
  return printTransport() === 'windows' ? windowsPrint({ action: 'zpl', label, printer }) : printZplLabel({ ...label, printer })
}
