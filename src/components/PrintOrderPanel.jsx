// ============================================
// PrintOrderPanel: impresión directa de la orden.
//   - Opción B: impresión silenciosa en la PC local (elige impresora vía bridge).
//   - Opción A: impresión desde el navegador (cualquier impresora del dispositivo).
// ============================================
import { useEffect, useState } from 'react'
import { Loader2, Printer, Monitor } from 'lucide-react'
import Modal from './Modal.jsx'
import { printOrderServer, listPrinters } from '../utils/print.js'
import { openOrderPdfForPrint } from '../utils/orderPdf.js'

export default function PrintOrderPanel({ open, order, onClose }) {
  const [printers, setPrinters] = useState([])
  const [selected, setSelected] = useState('')
  const [loadingPrinters, setLoadingPrinters] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    if (!open) return
    setNotice(null)
    setLoadingPrinters(true)
    listPrinters()
      .then((list) => {
        setPrinters(list)
        setSelected('')
      })
      .finally(() => setLoadingPrinters(false))
  }, [open])

  const handleServerPrint = async () => {
    if (busy || !order) return
    setBusy(true)
    setNotice(null)
    try {
      const res = await printOrderServer(order.id, selected || null)
      if (res.error) setNotice({ type: 'error', msg: res.error })
      else setNotice({ type: 'success', msg: 'Orden enviada a la impresora.' })
    } catch (e) {
      setNotice({ type: 'error', msg: e.message || 'No se pudo imprimir.' })
    } finally {
      setBusy(false)
    }
  }

  const handleBrowserPrint = async () => {
    if (busy || !order) return
    setBusy(true)
    setNotice(null)
    try {
      await openOrderPdfForPrint({ orderId: order.id })
      setNotice({ type: 'success', msg: 'Abriendo diálogo de impresión del navegador…' })
    } catch (e) {
      setNotice({ type: 'error', msg: e.message || 'No se pudo abrir la impresión.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={onClose} maxWidth="max-w-md" title="Imprimir orden de servicio">
      <div className="space-y-4">
        {/* Selector de impresora (Opción B) */}
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
            Seleccionar impresora
          </label>
          {loadingPrinters ? (
            <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 size={16} className="animate-spin" /> Cargando impresoras…
            </p>
          ) : (
            <select
              value={selected}
              onChange={(e) => setSelected(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">Impresora por defecto del sistema</option>
              {printers.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Opción B: impresión silenciosa */}
        <button
          onClick={handleServerPrint}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-60"
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}
          Imprimir
        </button>

        {/* Opción A: impresión desde el navegador */}
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">o</span>
          <div className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </div>
        <button
          onClick={handleBrowserPrint}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-400 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-60 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
        >
          <Monitor size={16} />
          Imprimir desde este dispositivo…
        </button>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Usa el diálogo del navegador para elegir cualquier impresora conectada a tu PC o celular.
        </p>

        {notice && (
          <p
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              notice.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300'
            }`}
          >
            {notice.msg}
          </p>
        )}
      </div>
    </Modal>
  )
}
