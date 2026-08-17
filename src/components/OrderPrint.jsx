// ============================================
// OrderPrint: impresión de la orden de servicio (firma del cliente)
// Usa window.print + CSS @media print (body.printing-order / #order-print)
// y descarga de PDF con jsPDF + html2canvas-pro.
// ============================================
import { useEffect, useState } from 'react'
import { Printer, FileDown, X } from 'lucide-react'
import { BRAND_NAME, BRAND_SUBTITLE } from '../utils/brand.js'
import { formatDate, formatMoney, ITEM_STATUS_LABEL } from '../utils/helpers.js'
import { downloadOrderPdf } from '../utils/orderPdf.js'

export default function OrderPrint({ open, order, customer, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Marca el body para que el CSS solo imprima #order-print.
  useEffect(() => {
    if (!open) return
    document.body.classList.add('printing-order')
    return () => document.body.classList.remove('printing-order')
  }, [open])

  if (!open || !order) return null

  const totalCost = (order.items || []).reduce((s, i) => s + (i.priceEstimate || 0), 0)
  const totalAdvance = (order.items || []).reduce((s, i) => s + (i.advance || 0), 0)

  const handleDownload = async () => {
    setBusy(true)
    setError('')
    try {
      await downloadOrderPdf({ customer })
    } catch {
      setError('No se pudo generar el PDF. Probá con "Imprimir".')
    } finally {
      setBusy(false)
    }
  }

  const btnCls =
    'inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

      {/* Barra de acciones (no se imprime) */}
      <div className="order-print-hide fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 shadow backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
        <button onClick={() => window.print()} className={btnCls}>
          <Printer size={16} />
          Imprimir
        </button>
        <button onClick={handleDownload} disabled={busy} className={btnCls}>
          <FileDown size={16} />
          {busy ? 'Generando...' : 'Descargar PDF'}
        </button>
        {error && <span className="text-sm text-red-600">{error}</span>}
        <button
          onClick={onClose}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <X size={16} />
          Cerrar
        </button>
      </div>

      {/* Área imprimible */}
      <div className="absolute inset-0 overflow-y-auto p-4 pt-20">
        <div className="mx-auto w-full max-w-2xl">
          <div
            id="order-print"
            className="rounded-xl bg-white p-8 text-slate-900 shadow-lg"
          >
            {/* Encabezado */}
            <div className="flex items-start justify-between rounded-lg bg-primary-600 px-5 py-4 text-white">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-400 text-primary-600">
                  <span className="text-3xl font-black leading-none">G</span>
                </div>
                <div>
                  <p className="text-base font-bold leading-tight">{BRAND_NAME}</p>
                  <p className="text-xs text-primary-100">{BRAND_SUBTITLE}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-200">
                  Orden de servicio
                </p>
                <p className="text-xl font-black" data-order-number>{order.orderNumber}</p>
                <p className="text-xs text-primary-100">{formatDate(order.createdAt)}</p>
              </div>
            </div>

            {/* Cliente */}
            <div className="mt-5 grid grid-cols-2 gap-x-6 gap-y-1 text-sm">
              <p>
                <span className="text-slate-500">Cliente:</span>{' '}
                <span className="font-semibold">{customer?.fullName || order.customerName}</span>
              </p>
              <p>
                <span className="text-slate-500">DNI:</span> {customer?.dni || '—'}
              </p>
              <p>
                <span className="text-slate-500">Teléfono:</span>{' '}
                {customer?.phone || '—'} {customer?.phone2 ? `· ${customer.phone2}` : ''}
              </p>
              <p>
                <span className="text-slate-500">Recibió:</span>{' '}
                {order.receivedByName || '—'}
              </p>
            </div>

            {/* Equipos */}
            <table className="mt-5 w-full border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-slate-700 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2 pr-2 font-semibold">#</th>
                  <th className="py-2 pr-2 font-semibold">Equipo</th>
                  <th className="py-2 pr-2 font-semibold">IMEI</th>
                  <th className="py-2 pr-2 font-semibold">Problema reportado</th>
                  <th className="py-2 pr-2 text-right font-semibold">Costo</th>
                  <th className="py-2 text-right font-semibold">Seña</th>
                </tr>
              </thead>
              <tbody>
                {(order.items || []).map((it, idx) => (
                  <tr key={it.id} className="border-b border-slate-200 align-top">
                    <td className="py-2 pr-2">{idx + 1}</td>
                    <td className="py-2 pr-2 font-semibold">
                      {it.brand} {it.model}
                      {it.accessories ? (
                        <div className="text-xs font-normal text-slate-500">
                          Accesorios: {it.accessories}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-2 pr-2 text-slate-600">{it.imei || '—'}</td>
                    <td className="py-2 pr-2 text-slate-700">{it.issueDescription || '—'}</td>
                    <td className="py-2 pr-2 text-right">{formatMoney(it.priceEstimate)}</td>
                    <td className="py-2 text-right">{formatMoney(it.advance)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-700 font-bold">
                  <td className="py-2 pr-2" colSpan={4}>Totales</td>
                  <td className="py-2 pr-2 text-right">{formatMoney(totalCost)}</td>
                  <td className="py-2 text-right">{formatMoney(totalAdvance)}</td>
                </tr>
              </tfoot>
            </table>

            {/* Firmas */}
            <div className="mt-10 grid grid-cols-2 gap-10 text-center">
              <div>
                <div className="mb-14 border-b border-slate-700" />
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Firma del cliente
                </p>
              </div>
              <div>
                <div className="mb-14 border-b border-slate-700" />
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Firma del encargado
                </p>
              </div>
            </div>

            {/* Condiciones */}
            <p className="mt-8 text-[11px] leading-relaxed text-slate-500">
              El cliente declara recibir el/los equipo(s) en las condiciones detalladas y autoriza su
              reparación. Se acuerda avisar por WhatsApp cuando el/los equipo(s) esté/n listo(s) para
              retirar. Estado actual:{' '}
              {(order.items || []).map((i) => `${i.brand} ${i.model} (${ITEM_STATUS_LABEL[i.status] || i.status})`).join(', ') || '—'}
            </p>
            <p className="mt-2 text-[11px] text-slate-400">
              {BRAND_NAME} · {BRAND_SUBTITLE}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}