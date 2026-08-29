// ============================================
// pdf_bridge_client.js: envía un PDF al print_bridge.py (Windows) para
// impresión silenciosa. Espejo de zpl_printer.py pero para PDFs.
// ============================================
import net from 'node:net'

const BRIDGE_HOST = process.env.PRINT_BRIDGE_HOST || 'host.docker.internal'
const BRIDGE_PORT = Number(process.env.PRINT_BRIDGE_PORT || 9200)

function sendPayload(payload) {
  return new Promise((resolve) => {
    let socket
    try {
      socket = new net.Socket()
      socket.setTimeout(10000)
      socket.connect(BRIDGE_PORT, BRIDGE_HOST, () => {
        const data = Buffer.from(JSON.stringify(payload), 'utf-8')
        const lenBuf = Buffer.alloc(4)
        lenBuf.writeUInt32BE(data.length, 0)
        socket.write(lenBuf)
        socket.write(data)
      })
    } catch (e) {
      resolve({ ok: false, error: `No se pudo conectar al print bridge (${e.message}).` })
      return
    }

    let buf = Buffer.alloc(0)
    socket.on('data', (chunk) => {
      buf = Buffer.concat([buf, chunk])
      if (buf.length >= 4) {
        const len = buf.readUInt32BE(0)
        if (buf.length >= 4 + len) {
          try {
            const resp = JSON.parse(buf.slice(4, 4 + len).toString('utf-8'))
            resolve({ ok: !!resp.ok, error: resp.error || null, printers: resp.printers || null })
          } catch {
            resolve({ ok: false, error: 'Respuesta inválida del print bridge.' })
          }
          socket.destroy()
        }
      }
    })
    socket.on('timeout', () => {
      resolve({ ok: false, error: 'Timeout al conectar con el print bridge.' })
      socket.destroy()
    })
    socket.on('error', (e) => {
      resolve({ ok: false, error: `Print bridge no disponible (${e.message}).` })
    })
    socket.on('close', () => {
      if (buf.length < 4) resolve({ ok: false, error: 'Print bridge cerró la conexión.' })
    })
  })
}

// Imprime un PDF (Buffer) en la impresora indicada (null = default del sistema).
export async function printPdfToBridge(pdfBuffer, printerName = null) {
  const base64 = pdfBuffer.toString('base64')
  return sendPayload({ pdf: base64, printer: printerName || null })
}

// Solicita la lista de impresoras disponibles en la PC Windows.
export async function listBridgePrinters() {
  const res = await sendPayload({ action: 'printers' })
  if (!res.ok) return { ok: false, printers: [], error: res.error }
  return { ok: true, printers: res.printers || [], error: null }
}
