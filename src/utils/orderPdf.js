// ============================================
// orderPdf.js: descarga el PDF de la orden desde el endpoint del servidor
// ============================================
import { loadSession } from './storage.js'

export async function downloadOrderPdf({ orderId, customer }) {
  const session = loadSession()
  const headers = {}
  if (session?.token) headers.Authorization = `Bearer ${session.token}`

  const res = await fetch(`/api/orders/${orderId}/pdf`, { headers })

  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(data.error || `Error ${res.status}`)
  }

  const blob = await res.blob()
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safe = (customer?.fullName || 'cliente').toLowerCase().replace(/[^a-z0-9-]+/g, '-')
  a.download = `orden-${safe}.pdf`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}
