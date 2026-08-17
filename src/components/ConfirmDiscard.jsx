// ============================================
// ConfirmDiscard: aviso antes de cerrar un modal con cambios sin guardar
// ============================================
import { AlertTriangle } from 'lucide-react'

export default function ConfirmDiscard({ onStay, onDiscard, message }) {
  return (
    <div className="space-y-4">
      <p className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
        <AlertTriangle size={18} className="mt-0.5 shrink-0 text-accent-500" />
        {message || 'Hay cambios sin guardar. Si salís, se perderán.'}
      </p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onStay}
          className="flex-1 rounded-lg border border-slate-300 px-4 py-2.5 font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          Seguir editando
        </button>
        <button
          type="button"
          onClick={onDiscard}
          className="flex-1 rounded-lg bg-red-600 px-4 py-2.5 font-semibold text-white transition hover:bg-red-700"
        >
          Descartar y salir
        </button>
      </div>
    </div>
  )
}