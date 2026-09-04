// ============================================
// PrintOrderPanel: impresión directa de la orden.
//   - Opción B: impresión silenciosa en la PC local (elige impresora vía bridge).
//   - Opción A: impresión desde el navegador (cualquier impresora del dispositivo).
// ============================================
import { useEffect, useRef, useState } from 'react'
import { Loader2, Printer, Monitor, RotateCw } from 'lucide-react'
import Modal from './Modal.jsx'
import { printOrderServer, listPrinters } from '../utils/print.js'
import { loadSession } from '../utils/storage.js'

export default function PrintOrderPanel({ open, order, onClose }) {
  const [printers, setPrinters] = useState([])
  const [selected, setSelected] = useState('')
  const [loadingPrinters, setLoadingPrinters] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState(null)
  const [pdfReady, setPdfReady] = useState(false)
  const [pdfError, setPdfError] = useState(null)
  const pdfBlobUrlRef = useRef(null)

  useEffect(() => {
    if (!open || !order) return
    setPdfReady(false)
    setPdfError(null)
    setNotice(null)
    setLoadingPrinters(true)

    const session = loadSession()
    const headers = {}
    if (session?.token) headers.Authorization = `Bearer ${session.token}`

    const fetchPdf = fetch(`/api/orders/${order.id}/pdf`, { headers })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `Error ${res.status}`)
        }
        const blob = await res.blob()
        pdfBlobUrlRef.current = URL.createObjectURL(blob)
        setPdfReady(true)
      })
      .catch((e) => setPdfError(e.message || 'No se pudo generar el PDF.'))

    const fetchPrinters = listPrinters()
      .then((list) => {
        setPrinters(list)
        setSelected('')
      })
      .catch(() => {})
      .finally(() => setLoadingPrinters(false))

    Promise.allSettled([fetchPdf, fetchPrinters])

    return () => {
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current)
        pdfBlobUrlRef.current = null
      }
    }
  }, [open, order])

  const handleRetry = () => {
    setPdfReady(false)
    setPdfError(null)
    setNotice(null)

    const session = loadSession()
    const headers = {}
    if (session?.token) headers.Authorization = `Bearer ${session.token}`

    fetch(`/api/orders/${order.id}/pdf`, { headers })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `Error ${res.status}`)
        }
        const blob = await res.blob()
        pdfBlobUrlRef.current = URL.createObjectURL(blob)
        setPdfReady(true)
      })
      .catch((e) => setPdfError(e.message || 'No se pudo generar el PDF.'))
  }

  const handleClose = () => {
    if (pdfBlobUrlRef.current) {
      URL.revokeObjectURL(pdfBlobUrlRef.current)
      pdfBlobUrlRef.current = null
    }
    setPdfReady(false)
    setPdfError(null)
    onClose()
  }

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
    if (busy || !order || !pdfBlobUrlRef.current) return
    setBusy(true)
    setNotice(null)
    try {
      const url = pdfBlobUrlRef.current
      const w = window.open('', '_blank')
      if (!w) {
        throw new Error('Bloqueador de pop-ups activo. Permití ventanas emergentes.')
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
      setNotice({ type: 'success', msg: 'Abriendo diálogo de impresión del navegador…' })
    } catch (e) {
      setNotice({ type: 'error', msg: e.message || 'No se pudo abrir la impresión.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} maxWidth="max-w-md" title="Imprimir orden de servicio">
      <div className="space-y-4">
        {pdfError ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <p className="text-sm font-medium text-red-600 dark:text-red-400">
              No se pudo generar el PDF.
            </p>
            <button
              onClick={handleRetry}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              <RotateCw size={15} /> Reintentar
            </button>
          </div>
        ) : !pdfReady ? (
          <div className="flex flex-col items-center justify-center gap-3 py-12">
            <Loader2 size={32} className="animate-spin text-primary-500" />
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Generando orden…
            </p>
          </div>
        ) : (
          <>
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
          </>
        )}
      </div>
    </Modal>
  )
}
