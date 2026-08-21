// ============================================
// OrderPrint: impresión de la orden de servicio (firma del cliente)
// Usa window.print + CSS @media print (body.printing-order / #order-print)
// y descarga de PDF con jsPDF + html2canvas-pro.
// ============================================
import { useEffect, useState } from 'react'
import { Printer, FileDown, X } from 'lucide-react'
import { BRAND_NAME, BRAND_SUBTITLE } from '../utils/brand.js'
import { formatDate, formatMoney, ORDER_STATUS_LABEL } from '../utils/helpers.js'
import { WARRANTY_DAYS } from '../utils/constants.js'
import { PatternPreview } from './PatternPad.jsx'
import { downloadOrderPdf } from '../utils/orderPdf.js'

export default function OrderPrint({ open, order, customer, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    document.body.classList.add('printing-order')
    return () => document.body.classList.remove('printing-order')
  }, [open])

  if (!open || !order) return null

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

      <div className="absolute inset-0 overflow-y-auto p-4 pt-20">
        <div className="mx-auto w-full max-w-2xl">
          <div id="order-print" className="border border-gray-300 bg-white p-8 text-gray-900">
            {/* Encabezado */}
            <div className="flex items-start justify-between border-b-2 border-black pb-3">
              <div>
                <p className="text-lg font-bold leading-tight">{BRAND_NAME}</p>
                <p className="text-xs">{BRAND_SUBTITLE}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-bold uppercase tracking-wide">Orden de servicio</p>
                <p className="text-xl font-bold leading-tight" data-order-number>{order.orderNumber}</p>
                <p className="text-xs">{formatDate(order.createdAt)}</p>
              </div>
            </div>

            {/* Cliente */}
            <div className="border-b border-gray-300 py-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider">Datos del cliente</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                <p>
                  <span className="font-bold">Cliente:</span>{' '}
                  {customer?.fullName || order.customerName}
                </p>
                <p><span className="font-bold">DNI:</span> {customer?.dni || '—'}</p>
                <p>
                  <span className="font-bold">Teléfono:</span>{' '}
                  {[customer?.phone, customer?.phone2, customer?.phone3].filter(Boolean).join(' / ') || '—'}
                </p>
                <p><span className="font-bold">Domicilio:</span> {customer?.address || '—'}</p>
                <p><span className="font-bold">Recibió:</span> {order.receivedByName || '—'}</p>
              </div>
            </div>

            {/* Equipo */}
            <div className="border-b border-gray-300 py-3">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider">Equipo</p>
              <div className="flex items-baseline justify-between">
                <p className="text-sm font-bold">
                  {order.brand} {order.model}
                </p>
                <p className="text-xs">{ORDER_STATUS_LABEL[order.status] || order.status}</p>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-8 gap-y-1 text-xs">
                <p>
                  <span className="font-bold">PIN / contraseña:</span>{' '}
                  {order.pin || '—'}
                </p>
                <p>
                  <span className="font-bold">Accesorios:</span>{' '}
                  {order.accessories || '—'}
                </p>
                <p>
                  <span className="font-bold">Estado del equipo:</span>{' '}
                  {order.conditions || '—'}
                </p>
                <p className="col-span-2">
                  <span className="font-bold">Chequeos / notas generales:</span>{' '}
                  {order.issue || '—'}
                </p>
              </div>
              {order.pattern?.length > 0 && (
                <div className="mt-2 flex items-center gap-4">
                  <p className="text-xs">
                    <span className="font-bold">Patrón de desbloqueo:</span>
                  </p>
                  <PatternPreview value={order.pattern} size={80} />
                </div>
              )}
            </div>

            {/* Presupuesto */}
            <div className="border-t border-gray-300 pt-3 text-xs">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-wider">Presupuesto</p>
              {order.diagnosisType === 'visible' ? (
                <div className="grid grid-cols-2 gap-x-8 gap-y-1">
                  <p>
                    <span className="font-bold">Arreglo a realizar:</span>{' '}
                    <span className="font-semibold">{order.fix || '—'}</span>
                  </p>
                  <p className="text-right">
                    <span className="font-bold">Presupuesto:</span>{' '}
                    <span className="font-bold">{formatMoney(order.price)}</span>
                  </p>
                  {order.advance > 0 && (
                    <p className="col-span-2 text-right">
                      <span className="font-bold">Seña recibida:</span>{' '}
                      <span className="font-semibold">{formatMoney(order.advance)}</span>
                    </p>
                  )}
                </div>
              ) : (
                <p>
                  El equipo ingresó <span className="font-semibold">a revisión técnica</span>. El
                  presupuesto se acuerda con el técnico y se avisa al cliente.
                </p>
              )}
            </div>

            {/* Firma del cliente */}
            <div className="mt-10">
              <p className="flex items-end text-xs">
                <span className="font-bold whitespace-nowrap">Firma:</span>{' '}
                <span className="ml-2 flex-1 border-b border-black" />
              </p>
              <div className="mt-6 flex items-end gap-8 text-xs">
                <p className="flex flex-1 items-end gap-2">
                  <span className="font-bold whitespace-nowrap">Aclaración:</span>
                  <span className="flex-1 border-b border-black" />
                </p>
                <p className="flex w-40 items-end gap-2">
                  <span className="font-bold whitespace-nowrap">DNI:</span>
                  <span className="flex-1 border-b border-black" />
                </p>
              </div>
            </div>

            {/* Condiciones */}
            <p className="mt-8 text-[10px] leading-relaxed text-gray-500">
              El cliente declara recibir el equipo en las condiciones detalladas y autoriza su reparación.
              Se lo avisa por teléfono cuando el arreglo está listo para retirar. Si el presupuesto no se
              acepta, se cobra únicamente la revisión. Este equipo queda cubierto por una garantía de{' '}
              <span className="font-semibold">{WARRANTY_DAYS} días</span> a partir de su entrega, por el
              trabajo realizado.
            </p>
            <p className="mt-2 text-[10px] text-gray-400">
              {BRAND_NAME} · {BRAND_SUBTITLE}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}