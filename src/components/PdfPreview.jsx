import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Loader2, RotateCw } from 'lucide-react'
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

GlobalWorkerOptions.workerSrc = workerUrl

export default function PdfPreview({ file, onRetry }) {
  const pages = useRef(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  useEffect(() => {
    let cancelled = false, task
    const container = pages.current
    container.replaceChildren()
    setLoading(true)
    setError(false)
    const render = async () => {
      const data = new Uint8Array(await file.arrayBuffer())
      if (cancelled) return
      task = getDocument({ data, isEvalSupported: false })
      const pdf = await task.promise
      for (let number = 1; number <= pdf.numPages; number++) {
        const page = await pdf.getPage(number)
        if (cancelled) return
        const viewport = page.getViewport({ scale: 2 })
        const canvas = document.createElement('canvas')
        canvas.width = Math.ceil(viewport.width)
        canvas.height = Math.ceil(viewport.height)
        canvas.setAttribute('role', 'img')
        canvas.setAttribute('aria-label', `Página ${number} de ${pdf.numPages}`)
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
        if (cancelled) return
        container.append(canvas)
      }
      setLoading(false)
    }
    render().catch(() => { if (!cancelled) { setLoading(false); setError(true) } })
    return () => { cancelled = true; task?.destroy(); container.replaceChildren() }
  }, [file])
  return <div className="sc-pdf-viewer">
    <div className="sc-pdf-pages" ref={pages} tabIndex={0} aria-label="Páginas del comprobante" aria-busy={loading} />
    {loading && <div className="sc-print-state sc-pdf-message" role="status"><Loader2 size={28} className="animate-spin" /><p>Cargando vista previa…</p></div>}
    {error && <div className="sc-print-state sc-pdf-message" role="alert"><AlertTriangle size={28} /><p>No se pudo mostrar la vista previa.</p><button className="ws-button" onClick={onRetry}><RotateCw size={16} />Reintentar</button></div>}
  </div>
}
