// ============================================
// Modal reutilizable con overlay
// ============================================
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import './Modal.css'

// Contador de modales abiertos: el Escape solo cierra el modal superior,
// así los modales anidados (ej. picker de marca/modelo) no cierran el de afuera.
let modalStack = 0

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg', zIndex = 'z-50', dismissible = true, className = '' }) {
  const panel = useRef(null)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  const dismissibleRef = useRef(dismissible)
  dismissibleRef.current = dismissible
  const opener = useRef(null)
  const titleId = useId()
  const [viewport, setViewport] = useState(null)
  // Cierra con la tecla Escape.
  useEffect(() => {
    if (!open) return
    modalStack += 1
    if (modalStack === 1) document.body.style.overflow = 'hidden'
    const myDepth = modalStack
    if (!panel.current?.contains(document.activeElement)) opener.current = document.activeElement
    const visual = window.visualViewport
    const resize = () => setViewport({ height: visual.height, top: visual.offsetTop })
    if (visual) {
      resize()
      visual.addEventListener('resize', resize)
      visual.addEventListener('scroll', resize)
    }
    const focusable = () => [...(panel.current?.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]') || [])].filter((element) => element.getClientRects().length)
    if (!panel.current?.contains(document.activeElement)) (focusable()[0] || panel.current)?.focus()
    const onKey = (e) => {
      if (modalStack !== myDepth) return
      if (dismissibleRef.current && e.key === 'Escape') { e.stopPropagation(); closeRef.current?.() }
      if (e.key === 'Tab') {
        const nodes = focusable()
        if (!nodes.length) { e.preventDefault(); panel.current?.focus(); return }
        if (e.shiftKey && (document.activeElement === nodes[0] || !panel.current?.contains(document.activeElement))) { e.preventDefault(); nodes.at(-1).focus() }
        else if (!e.shiftKey && (document.activeElement === nodes.at(-1) || !panel.current?.contains(document.activeElement))) { e.preventDefault(); nodes[0].focus() }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      modalStack -= 1
      if (modalStack === 0) document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
      visual?.removeEventListener('resize', resize)
      visual?.removeEventListener('scroll', resize)
      const previous = opener.current
      opener.current = null
      if (previous?.isConnected) previous.focus({ preventScroll: true })
    }
  }, [open])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className={`sc-modal fixed inset-0 ${zIndex} flex items-center justify-center`} style={viewport ? { height: viewport.height, top: viewport.top, bottom: 'auto', '--sc-modal-height': `${viewport.height}px` } : undefined}>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        className={`sc-modal-panel relative flex w-full flex-col ${maxWidth} bg-white shadow-2xl dark:bg-slate-900 ${className}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        ref={panel}
        tabIndex={-1}
        onFocusCapture={(event) => {
          // autoFocus puede ejecutarse antes del efecto de apertura.
          if (!opener.current && !event.currentTarget.contains(event.relatedTarget)) opener.current = event.relatedTarget
        }}
      >
        <div className="sc-modal-heading">
          <h2 id={titleId} className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          {dismissible && <button
            onClick={onClose}
            className="sc-modal-close rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>}
        </div>
        <div className="sc-modal-body">
          {children}
        </div>
      </div>
    </div>,
    document.body
  )
}
