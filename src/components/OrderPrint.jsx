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
          <div id="order-print" className="rounded-xl bg-white p-8 text-slate-900 shadow-lg">
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
                <p className="text-xs font-semibold uppercase tracking-wide text-primary-200">Orden de servicio</p>
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
              <p><span className="text-slate-500">DNI:</span> {customer?.dni || '—'}</p>
              <p>
                <span className="text-slate-500">Teléfono:</span>{' '}
                {[customer?.phone, customer?.phone2, customer?.phone3].filter(Boolean).join(' · ') || '—'}
              </p>
              <p>
                <span className="text-slate-500">Domicilio:</span> {customer?.address || '—'}
              </p>
              <p><span className="text-slate-500">Recibió:</span> {order.receivedByName || '—'}</p>
            </div>

            {/* Equipo */}
            <div className="mt-5 rounded-lg border border-slate-300 p-4 text-sm">
              <div className="flex items-start justify-between">
                <p className="text-base font-bold">
                  {order.brand} {order.model}
                </p>
                <span className="rounded-full bg-slate-200 px-3 py-0.5 text-xs font-semibold text-slate-700">
                  {ORDER_STATUS_LABEL[order.status] || order.status}
                </span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1">
                <p>
                  <span className="text-slate-500">PIN / contraseña:</span>{' '}
                  {order.pin || '—'}
                </p>
                <p>
                  <span className="text-slate-500">Accesorios:</span>{' '}
                  {order.accessories || '—'}
                </p>
                <p>
                  <span className="text-slate-500">Estado del equipo:</span>{' '}
                  {order.conditions || '—'}
                </p>
                <p className="col-span-2">
                  <span className="text-slate-500">Chequeos / notas generales:</span>{' '}
                  {order.issue || '—'}
                </p>
              </div>
              {order.pattern?.length > 0 && (
                <div className="mt-3 flex items-center gap-4">
                  <p className="text-sm">
                    <span className="text-slate-500">Patrón de desbloqueo:</span>
                  </p>
                  <PatternPreview value={order.pattern} size={80} />
                </div>
              )}
            </div>

            {/* Presupuesto */}
            <div className="mt-4 rounded-lg bg-slate-100 px-4 py-3 text-sm">
              {order.diagnosisType === 'visible' ? (
                <div className="grid grid-cols-2 gap-x-6 gap-y-1">
                  <p>
                    <span className="text-slate-500">Arreglo a realizar:</span>{' '}
                    <span className="font-semibold">{order.fix || '—'}</span>
                  </p>
                  <p className="text-right">
                    <span className="text-slate-500">Presupuesto:</span>{' '}
                    <span className="font-bold">{formatMoney(order.price)}</span>
                  </p>
                  {order.advance > 0 && (
                    <p className="col-span-2 text-right">
                      <span className="text-slate-500">Seña recibida:</span>{' '}
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

            {/* Firmas */}
            <div className="mt-10 grid grid-cols-2 gap-10 text-center">
              <div>
                <div className="mb-14 border-b border-slate-700" />
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Firma del cliente</p>
              </div>
              <div>
                <div className="mb-14 border-b border-slate-700" />
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Firma del encargado</p>
              </div>
            </div>

            {/* Condiciones */}
            <p className="mt-8 text-[11px] leading-relaxed text-slate-500">
              El cliente declara recibir el equipo en las condiciones detalladas y autoriza su reparación.
              Se lo avisa por teléfono cuando el arreglo está listo para retirar. Si el presupuesto no se
              acepta, se cobra únicamente la revisión. Este equipo queda cubierto por una garantía de{' '}
              <span className="font-semibold">{WARRANTY_DAYS} días</span> a partir de su entrega, por el
              trabajo realizado.
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