// ============================================
// OrderCard: card compacta para el taller.
// Muestra modelo + cliente + badge + tiempo. Toda acción va al modal.
// ============================================
import Badge from './Badge.jsx'
import { timeSinceStatus } from '../utils/helpers.js'

export default function OrderCard({ order, onOpen }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(order)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(order)}
      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-3 transition hover:border-primary-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-primary-500/40"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {order.brand} {order.model}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {order.customerName}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {order.status === 'presupuesto' ? (
            order.confirmed ? (
              <Badge tone="green">Confirmado</Badge>
            ) : (
              <Badge tone="yellow">Sin confirmar</Badge>
            )
          ) : order.diagnosisType === 'revision' ? (
            <Badge tone="primary">Revisión</Badge>
          ) : (
            <Badge tone="slate">Reparación</Badge>
          )}
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            {timeSinceStatus(order, order.status)}
          </span>
        </div>
      </div>
    </div>
  )
}
