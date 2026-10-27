// ============================================
// Impresión directa y vista previa del mismo PDF generado por el servidor.
// ============================================
import { useNotify } from '../context/notifications.js'
import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react'
import { Loader2, Printer, Monitor, RotateCw, AlertTriangle, FileText } from 'lucide-react'
import Modal from './Modal.jsx'
import { printOrderServer, listPrinters } from '../utils/print.js'
import { loadSession } from '../utils/storage.js'

const PdfPreview = lazy(() => import('./PdfPreview.jsx'))

export default function PrintOrderPanel({ open, order, onClose }) {
  const printerId = useId()
  const [printers, setPrinters] = useState([])
  const [selected, setSelected] = useState('')
  const [loadingPrinters, setLoadingPrinters] = useState(false)
  const [busy, setBusy] = useState(false)
  const inFlight = useRef(false)
  const setNotice = useNotify('success')
  const [pdfFile, setPdfFile] = useState(null)
  const pdfReady = !!pdfFile
  const [pdfError, setPdfError] = useState(null)
  const [printerError, setPrinterError] = useState(null)
  const [retry, setRetry] = useState(0)
  const pdfBlobUrlRef = useRef(null)

  useEffect(() => {
    if (!open || !order) return
    let active = true
    const controller = new AbortController()
    setPdfFile(null)
    setPdfError(null)
    setNotice(null)
    setPrinterError(null)
    setLoadingPrinters(true)

    const session = loadSession()
    const headers = {}
    if (session?.token) headers.Authorization = `Bearer ${session.token}`

    const fetchPdf = fetch(`/api/orders/${order.id}/pdf`, { headers, signal: controller.signal })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || `Error ${res.status}`)
        }
        const blob = await res.blob()
        if (!active) return
        pdfBlobUrlRef.current = URL.createObjectURL(blob)
        setPdfFile(blob)
      })
      .catch((e) => { if (active) setPdfError(e.message || 'No se pudo generar el PDF.') })

    const fetchPrinters = listPrinters()
      .then(({ printers: list, error }) => {
        if (!active) return
        setPrinters(list)
        if (error) setPrinterError(error)
      })
      .catch(() => { if (active) setPrinterError('No se encontraron impresoras.') })
      .finally(() => { if (active) setLoadingPrinters(false) })

    Promise.allSettled([fetchPdf, fetchPrinters])

    return () => {
      active = false
      controller.abort()
      if (pdfBlobUrlRef.current) {
        URL.revokeObjectURL(pdfBlobUrlRef.current)
        pdfBlobUrlRef.current = null
      }
    }
  }, [open, order, retry, setNotice])

  const handleRetry = () => {
    setPdfFile(null)
    setPdfError(null)
    setNotice(null)

    setRetry((value) => value + 1)
  }

  const retryPrinters = async () => {
    setPrinterError(null)
    setLoadingPrinters(true)
    try {
      const { printers: list, error } = await listPrinters()
      setPrinters(list)
      if (error) setPrinterError(error)
    } finally { setLoadingPrinters(false) }
  }

  const handleClose = () => {
    if (pdfBlobUrlRef.current) {
      URL.revokeObjectURL(pdfBlobUrlRef.current)
      pdfBlobUrlRef.current = null
    }
    setPdfFile(null)
    setPdfError(null)
    setSelected('')
    onClose()
  }

  const handleServerPrint = async () => {
    if (inFlight.current || !order) return
    inFlight.current = true
    setBusy(true)
    setNotice(null)
    try {
      const res = await printOrderServer(order.id, selected || null)
      if (res.error) setNotice({ type: 'error', msg: res.error })
      else setNotice({ type: 'success', msg: 'Orden enviada a la cola de impresión.' })
    } catch (e) {
      setNotice({ type: 'error', msg: e.message || 'No se pudo imprimir.' })
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  const handleBrowserPrint = async () => {
    if (inFlight.current || !order || !pdfBlobUrlRef.current) return
    inFlight.current = true
    setBusy(true)
    setNotice(null)
    try {
      const url = pdfBlobUrlRef.current
      const w = window.open(url, '_blank')
      if (!w) {
        throw new Error('Bloqueador de pop-ups activo. Permití ventanas emergentes.')
      }
      w.opener = null
      setNotice({ type: 'success', msg: 'PDF abierto. Usá el botón de impresión del visor para elegir tu impresora.' })
    } catch (e) {
      setNotice({ type: 'error', msg: e.message || 'No se pudo abrir la impresión.' })
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }

  return (
    <Modal open={open} onClose={handleClose} maxWidth="max-w-6xl" title="Imprimir orden de servicio">
      <div className="sc-print">
        <section className="sc-print-preview" aria-label="Vista previa del comprobante">
          <header><h3><FileText size={16} aria-hidden="true" />Vista previa</h3><span>{order?.orderNumber}</span></header>
          <div className="sc-print-document">
            {pdfError ? <div className="sc-print-state" role="alert"><AlertTriangle size={28} /><p>No se pudo generar el PDF.</p><p className="sc-secondary">{pdfError}</p><button className="ws-button" onClick={handleRetry}><RotateCw size={16} />Reintentar</button></div>
              : !pdfReady ? <div className="sc-print-state" role="status"><Loader2 size={28} className="animate-spin" /><p>Generando orden…</p></div>
                : <Suspense fallback={<div className="sc-print-state" role="status"><Loader2 size={28} className="animate-spin" /><p>Cargando vista previa…</p></div>}><PdfPreview file={pdfFile} onRetry={handleRetry} /></Suspense>}
          </div>
        </section>
        <aside className="sc-print-controls">
          <h3><Printer size={16} aria-hidden="true" />Impresión</h3>
          <div className="ws-form"><label htmlFor={printerId}>Impresora
            <select id={printerId} value={selected} onChange={(event) => setSelected(event.target.value)} disabled={busy || loadingPrinters}>
              <option value="">Impresora de órdenes configurada</option>
              {printers.map((printer) => <option key={printer} value={printer}>{printer}</option>)}
            </select>
          </label></div>
          {loadingPrinters && <p className="sc-secondary sc-print-loading" role="status"><Loader2 size={16} className="animate-spin" />Cargando impresoras…</p>}
          {printerError && <div className="sc-print-warning" role="alert"><AlertTriangle size={18} /><div><p>No se pudo cargar la lista de impresoras.</p><button className="ws-button" disabled={busy || loadingPrinters} onClick={retryPrinters}><RotateCw size={15} />Reintentar</button></div></div>}
          <button className="ws-button" onClick={handleBrowserPrint} disabled={busy || !pdfReady}><Monitor size={16} />Abrir PDF para imprimir</button>
        </aside>
        <footer className="sc-print-actions ws-buttons">
          <button className="ws-button" onClick={handleClose}>Cerrar</button>
          <button className="ws-button primary" onClick={handleServerPrint} disabled={busy || !pdfReady || loadingPrinters}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />}Imprimir</button>
        </footer>
      </div>
    </Modal>
  )
}
