// ============================================
// Impresora de etiquetas: puente Node -> Python (ZPL por USB)
// ============================================
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SCRIPT = path.join(__dirname, 'printer', 'zpl_printer.py')
const PYTHON = process.env.PYTHON || 'python'

// Llama al helper Python que imprime la etiqueta ZPL. Devuelve { ok } o
// { ok: false, error }. La impresora (Zebra/Godex por USB) debe estar
// instalada en la PC que corre el servidor.
export function printZplLabel({ orderNumber, model, customerName, date }) {
  return new Promise((resolve) => {
    const args = [
      SCRIPT,
      '--order', String(orderNumber || ''),
      '--model', String(model || ''),
      '--customer', String(customerName || ''),
      '--date', String(date || ''),
    ]
    const child = spawn(PYTHON, args, { windowsHide: true })
    let stdout = ''
    let stderr = ''
    child.stdout.on('data', (d) => (stdout += d))
    child.stderr.on('data', (d) => (stderr += d))
    child.on('error', (err) => {
      resolve({
        ok: false,
        error: `No se pudo ejecutar Python para imprimir la etiqueta (${err.message}). Verificá que Python esté instalado.`,
      })
    })
    child.on('close', (code) => {
      try {
        const parsed = JSON.parse(stdout)
        resolve(parsed.ok ? { ok: true } : { ok: false, error: parsed.error || 'Error al imprimir.' })
      } catch {
        const detail = stderr.trim() || `salida inesperada (código ${code})`
        resolve({ ok: false, error: `La impresora respondió con error: ${detail}` })
      }
    })
  })
}