import bwipjs from 'bwip-js'
import { businessDate } from '../../shared/dates.js'

const esc = (value) => String(value || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export function buildLabelHtml(order, customer, { labelWidthMm: width, labelHeightMm: height }) {
  const barcode = bwipjs.toSVG({ bcid: 'code128', text: order.orderNumber, height: 9, scale: 2, paddingwidth: 10 })
  return `<!doctype html><html lang="es"><meta charset="utf-8"><style>
    @page { size: ${width}mm ${height}mm; margin: 0; }
    * { box-sizing: border-box; } body { margin: 0; font-family: Arial,sans-serif; }
    .label { width: ${width}mm; height: ${height}mm; padding: 2mm; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: ${height < 35 ? '.3' : '.7'}mm; overflow: hidden; line-height: 1.1; }
    svg { width: 100%; height: ${Math.min(11, height * .28)}mm; flex-shrink: 0; }
    strong { font-size: ${height < 35 ? 10 : 13}pt; } p { margin: 0; max-width: 100%; font-size: ${width < 45 ? 6 : 8}pt; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    small { font-size: 6pt; }
  </style><div class="label">${barcode}<strong>${esc(order.orderNumber)}</strong><p>${esc(`${order.brand} ${order.model}`)}</p><p>${esc(customer?.fullName)}</p><small>${esc(businessDate(order.createdAt))}</small></div></html>`
}
