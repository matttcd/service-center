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

// Abre el PDF en una ventana/iframe y dispara el diálogo de impresión del
// navegador (Opción A: permite elegir cualquier impresora del dispositivo).
export async function openOrderPdfForPrint({ orderId }) {
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

  return new Promise((resolve, reject) => {
    const w = window.open('', '_blank')
    if (!w) {
      window.URL.revokeObjectURL(url)
      reject(new Error('Bloqueador de pop-ups activo. Permití ventanas emergentes.'))
      return
    }
    w.document.open()
    w.document.write(
      `<!doctype html><html><head><title>Imprimir orden</title>` +
      `<style>@media print { body { margin: 0; } }</style></head>` +
      `<body style="margin:0"><iframe src="${url}" style="width:100%;height:100vh;border:0"></iframe>` +
      `<script>window.onload=function(){setTimeout(function(){window.focus();window.print();},400);};` +
      `window.addEventListener('afterprint',function(){window.close();});</script>` +
      `</body></html>`
    )
    w.document.close()
    // Resolución best-effort: el usuario controla el diálogo.
    setTimeout(() => resolve(), 600)
  })
}
