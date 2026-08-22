import { useEffect } from 'react'
import { AlertTriangle, Info, X } from 'lucide-react'

let confirmStack = 0

export default function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false, type = 'confirm' }) {
  useEffect(() => {
    if (!open) return
    confirmStack += 1
    const myDepth = confirmStack
    const onKey = (e) => {
      if (e.key === 'Escape' && confirmStack === myDepth) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      confirmStack -= 1
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  if (!open) return null

  const Icon = danger ? AlertTriangle : Info
  const iconColor = danger ? 'text-red-500' : 'text-primary-500'

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <X size={18} />
        </button>
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${danger ? 'bg-red-100 dark:bg-red-500/15' : 'bg-primary-100 dark:bg-primary-500/15'}`}>
            <Icon size={20} className={iconColor} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{title}</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{message}</p>
          </div>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          {type === 'confirm' && (
            <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              {cancelLabel}
            </button>
          )}
          <button
            onClick={() => { onConfirm(); onClose() }}
            className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
              danger ? 'bg-red-600 hover:bg-red-700' : 'bg-primary-600 hover:bg-primary-700'
            }`}
          >
            {type === 'confirm' ? confirmLabel : 'Entendido'}
          </button>
        </div>
      </div>
    </div>
  )
}
