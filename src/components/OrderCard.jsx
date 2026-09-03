// ============================================
// OrderCard: card compacta para el taller.
// Muestra modelo + cliente + badge + tiempo. Toda acción va al modal.
// ============================================
import Badge from './Badge.jsx'
import { timeSinceStatus } from '../utils/helpers.js'
import { Smartphone, Tablet, Laptop, Monitor, Gamepad2, Printer, HelpCircle } from 'lucide-react'

const DEVICE_TYPE_ICONS = {
  'Celular': Smartphone,
  'Tablet': Tablet,
  'Notebook / PC': Laptop,
  'Smart TV': Monitor,
  'Consola': Gamepad2,
  'Impresora': Printer,
  'Otro': HelpCircle,
}

export default function OrderCard({ order, onOpen }) {
  const DeviceIcon = DEVICE_TYPE_ICONS[order.deviceType] || Smartphone
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(order)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(order)}
      className="cursor-pointer rounded-xl border border-slate-300 bg-white p-3 transition hover:border-primary-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-primary-500/40"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-slate-900 dark:text-white">
            <DeviceIcon size={13} className="shrink-0 text-slate-400" />
            {order.brand} {order.model}
          </p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">
            {order.customerName}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-0.5">
          {order.warrantyReturn ? (
            <Badge tone="orange">Garantía</Badge>
          ) : order.status === 'presupuesto' ? (
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
