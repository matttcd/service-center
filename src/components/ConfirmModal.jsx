import { AlertTriangle, Info } from 'lucide-react'
import Modal from './Modal.jsx'

export default function ConfirmModal({ open, onClose, onConfirm, title, message, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar', danger = false, type = 'confirm' }) {
  const Icon = danger ? AlertTriangle : Info
  const iconColor = danger ? 'text-red-500' : 'text-primary-500'
  return <Modal open={open} onClose={onClose} title={title} maxWidth="max-w-sm" zIndex="z-[70]">
        <div className="flex items-start gap-3">
          <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${danger ? 'bg-red-100 dark:bg-red-500/15' : 'bg-primary-100 dark:bg-primary-500/15'}`}>
            <Icon size={20} className={iconColor} />
          </div>
          <div className="min-w-0 flex-1">
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
  </Modal>
}
