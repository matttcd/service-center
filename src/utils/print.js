// ============================================
// print.js: impresión de órdenes
//   - printOrderServer: impresión silenciosa en la PC local (Opción B)
//   - listPrinters: impresoras disponibles en la PC local (vía bridge)
// ============================================
import { api } from './api.js'

// Imprime la orden directamente en la impresora de la PC local.
// printer = null -> impresora por defecto del sistema.
export async function printOrderServer(orderId, printer = null) {
  return api(`/orders/${orderId}/print`, { method: 'POST', body: { printer } })
}

// Lista de impresoras instaladas en la PC Windows (print_bridge).
// Devuelve { printers: string[], error: string | null }.
export async function listPrinters() {
  try {
    const data = await api('/printers')
    return { printers: data.printers || [], error: data.error || null }
  } catch (e) {
    return { printers: [], error: e.message || 'No se encontraron impresoras.' }
  }
}
