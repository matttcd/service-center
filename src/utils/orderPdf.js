// ============================================
// orderPdf.js: genera el PDF de la orden de servicio
// Misma técnica que el PDF del plan: captura #order-print con
// html2canvas-pro y la corta en páginas A4.
// ============================================
export async function downloadOrderPdf({ customer }) {
  const { jsPDF } = await import('jspdf')
  const { default: html2canvasPro } = await import('html2canvas-pro')

  const el = document.getElementById('order-print')
  if (!el) return

  await document.fonts.ready.catch(() => {})

  const canvas = await html2canvasPro(el, {
    useCORS: true,
    backgroundColor: '#ffffff',
    scale: 2,
    onclone: (doc) => doc.fonts.ready.catch(() => {}),
  })

  const PAGE_W = 210
  const PAGE_H = 297
  const pxPerMm = canvas.width / PAGE_W
  const pagePx = Math.round(PAGE_H * pxPerMm)

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageCanvas = document.createElement('canvas')
  pageCanvas.width = canvas.width

  let first = true
  for (let y = 0; y < canvas.height; y += pagePx) {
    const sliceH = Math.min(pagePx, canvas.height - y)
    pageCanvas.height = sliceH
    pageCanvas.getContext('2d').drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH)

    if (!first) doc.addPage()
    first = false

    doc.addImage(pageCanvas.toDataURL('image/png'), 'PNG', 0, 0, PAGE_W, (sliceH / pagePx) * PAGE_H)
  }

  const safe = `${customer.fullName || 'cliente'}-${orderNumberSafe()}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-')
  doc.save(`orden-${safe}.pdf`)
}

function orderNumberSafe() {
  const el = document.querySelector('#order-print [data-order-number]')
  return el?.textContent || 'sin-numero'
}