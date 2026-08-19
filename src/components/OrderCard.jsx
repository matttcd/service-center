// ============================================
// OrderCard: tarjeta de equipo del taller (tamaño grande).
// Reutilizada por el Taller y la página de equipos listos.
// ============================================
import { Bell, BellOff, CheckCircle2, ChevronRight, RotateCcw, Lock } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import Badge from './Badge.jsx'
import TechnicianSelect from './TechnicianSelect.jsx'

function nextStatus(o) {
  switch (o.status) {
    case 'recibido':
      return o.diagnosisType === 'revision' ? 'en_revision' : 'en_reparacion'
    case 'en_revision':
      return 'presupuesto'
    case 'presupuesto':
      return 'en_reparacion'
    case 'en_reparacion':
      return 'terminado'
    default:
      return null
  }
}

function nextLabel(o) {
  switch (o.status) {
    case 'recibido':
      return o.diagnosisType === 'revision' ? 'Revisar' : 'Reparar'
    case 'en_revision':
      return 'Presupuesto'
    case 'presupuesto':
      return 'Reparar'
    case 'en_reparacion':
      return 'Listo'
    default:
      return ''
  }
}

export default function OrderCard({ order, onOpen, onChanged }) {
  const { setOrderStatus } = useData()
  const next = nextStatus(order)

  const move = async (status) => {
    const res = await setOrderStatus(order.id, status)
    if (res.error) alert(res.error)
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(order)}
      onKeyDown={(e) => e.key === 'Enter' && onOpen(order)}
      className="cursor-pointer rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-primary-300 hover:shadow dark:border-slate-800 dark:bg-slate-900 dark:hover:border-primary-500/40"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-primary-600 dark:text-primary-400">{order.orderNumber}</p>
        {order.diagnosisType === 'revision' ? (
          <Badge tone="primary">Revisión</Badge>
        ) : (
          <Badge tone="slate">Reparación</Badge>
        )}
      </div>

      <p className="mt-1 truncate text-base font-semibold text-slate-900 dark:text-white">
        {order.brand} {order.model}
      </p>
      <p className="truncate text-sm text-slate-400">{order.customerName}</p>

      <div className="mt-3">
        <TechnicianSelect order={order} onChanged={onChanged} />
      </div>

      {order.status === 'presupuesto' && (
        <div className="mt-2">
          {order.confirmed ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={14} /> Confirmado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <Lock size={14} /> Sin confirmar
            </span>
          )}
        </div>
      )}
      {order.status === 'terminado' && (
        <div className="mt-2">
          {order.notified ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <Bell size={14} /> Avisado
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <BellOff size={14} /> Sin avisar
            </span>
          )}
        </div>
      )}

      <div className="mt-3 border-t border-slate-100 pt-2.5 dark:border-slate-800">
        {order.status === 'terminado' ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              move('en_reparacion')
            }}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            <RotateCcw size={15} />
            Volver a reparación
          </button>
        ) : order.status === 'presupuesto' && !order.confirmed ? (
          <button
            type="button"
            disabled
            title="El cliente debe confirmar el arreglo antes de reparar"
            className="inline-flex w-full cursor-not-allowed items-center justify-center gap-1 rounded-lg bg-slate-200 px-3 py-2 text-sm font-semibold text-slate-400 dark:bg-slate-800 dark:text-slate-500"
          >
            <Lock size={15} />
            Sin confirmar
          </button>
        ) : (
          next && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                move(next)
              }}
              className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
            >
              {nextLabel(order)}
              <ChevronRight size={15} />
            </button>
          )
        )}
      </div>
    </div>
  )
}