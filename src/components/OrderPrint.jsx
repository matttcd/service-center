// ============================================
// OrderPrint: modal para descargar PDF de la orden (generado server-side con Puppeteer)
// ============================================
import { useState } from 'react'
import { FileDown, X } from 'lucide-react'
import { downloadOrderPdf } from '../utils/orderPdf.js'

export default function OrderPrint({ open, order, customer, onClose }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  if (!open || !order) return null

  const handleDownload = async () => {
    setBusy(true)
    setError('')
    try {
      await downloadOrderPdf({ orderId: order.id, customer })
    } catch {
      setError('No se pudo generar el PDF.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <X size={18} />
        </button>
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary-100 dark:bg-primary-500/15">
            <FileDown size={24} className="text-primary-600 dark:text-primary-400" />
          </div>
          <h3 className="text-base font-bold text-slate-900 dark:text-white">Descargar PDF</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Orden <span className="font-semibold">{order.orderNumber}</span>
          </p>
        </div>
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-600 dark:bg-red-500/10 dark:text-red-400">
            {error}
          </p>
        )}
        <div className="mt-5 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleDownload}
            disabled={busy}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50"
          >
            <FileDown size={16} />
            {busy ? 'Generando...' : 'Descargar'}
          </button>
        </div>
      </div>
    </div>
  )
}
