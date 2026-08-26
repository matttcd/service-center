// ============================================
// Modal reutilizable con overlay
// ============================================
import { useEffect } from 'react'
import { X } from 'lucide-react'

// Contador de modales abiertos: el Escape solo cierra el modal superior,
// así los modales anidados (ej. picker de marca/modelo) no cierran el de afuera.
let modalStack = 0

export default function Modal({ open, onClose, title, children, maxWidth = 'max-w-lg', zIndex = 'z-50' }) {
  // Cierra con la tecla Escape.
  useEffect(() => {
    if (!open) return
    modalStack += 1
    if (modalStack === 1) document.body.style.overflow = 'hidden'
    const myDepth = modalStack
    const onKey = (e) => {
      if (e.key === 'Escape' && modalStack === myDepth) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      modalStack -= 1
      if (modalStack === 0) document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={`fixed inset-0 ${zIndex} flex items-center justify-center p-0 md:p-4`}>
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Panel */}
      <div
        className={`relative flex h-full w-full flex-col ${maxWidth} rounded-none bg-white p-6 shadow-2xl dark:bg-slate-900 md:h-auto md:max-h-[90vh] md:rounded-2xl`}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
            aria-label="Cerrar"
          >
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
