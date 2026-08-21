// ============================================
// OrderCard: tarjeta de equipo del taller (tamaño grande).
// Reutilizada por el Taller y la página de equipos listos.
// ============================================
import { useState } from 'react'
import { Bell, BellOff, CheckCircle2, ChevronRight, RotateCcw, Lock } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { nextStatus, nextStatusLabel } from '../../shared/fsm.js'
import Badge from './Badge.jsx'
import TechnicianSelect from './TechnicianSelect.jsx'



export default function OrderCard({ order, onOpen, onChanged }) {
  const { setOrderStatus, toggleNotified, confirmOrder } = useData()
  const { currentUser } = useAuth()
  const [busy, setBusy] = useState(null)
  const next = nextStatus(order)
  const isEmployee = ['mostrador', 'admin'].includes(currentUser?.role)

  const move = async (status) => {
    if (busy) return
    setBusy(status)
    const res = await setOrderStatus(order.id, status)
    if (res.error) alert(res.error)
    setBusy(null)
  }

  const markNotified = async () => {
    if (busy) return
    setBusy('notified')
    const res = await toggleNotified(order.id, true)
    if (res.error) alert(res.error)
    setBusy(null)
  }

  const confirm = async () => {
    if (busy) return
    setBusy('confirm')
    const res = await confirmOrder(order.id, true)
    if (res.error) alert(res.error)
    setBusy(null)
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
      <p className="truncate text-sm text-slate-500 dark:text-slate-400">
        {order.conditions ? <span className="font-semibold text-amber-600 dark:text-amber-400">{order.conditions}</span> : 'Sin estado registrado'}
      </p>
      <p className="mt-0.5 line-clamp-2 text-sm font-medium text-slate-600 dark:text-slate-300">
        {order.fix || 'Arreglo sin definir'}
      </p>
      <p className="mt-1 truncate text-sm text-slate-400">{order.customerName}</p>

      <div className="mt-3">
        <TechnicianSelect order={order} onChanged={onChanged} />
      </div>

      {order.status === 'presupuesto' && (
        <div className="mt-2">
          {order.confirmed ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={14} /> Confirmado
            </span>
          ) : (order.price || 0) > 0 ? (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={14} /> Cotizado ${order.price}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
              <Lock size={14} /> Sin cotizar
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
          isEmployee ? (
            <div className="flex flex-col gap-2">
              {!order.notified && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    markNotified()
                  }}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Bell size={15} />
                  Marcar avisado
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  confirm()
                }}
                disabled={busy === 'confirm' || !order.notified || (order.price || 0) <= 0}
                title={!order.notified ? 'Avisá al cliente antes de confirmar el arreglo' : (order.price || 0) <= 0 ? 'Cargá el presupuesto antes de confirmar' : ''}
                className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500"
              >
                <Lock size={15} />
                Confirmar arreglo
              </button>
            </div>
          ) : (
            <span className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-400 dark:bg-slate-800 dark:text-slate-500">
              <Lock size={15} />
              Esperando confirmación del cliente
            </span>
          )
        ) : (
          next && (
            <button
              type="button"
              disabled={busy === next}
              onClick={(e) => {
                e.stopPropagation()
                move(next)
              }}
              className="inline-flex w-full items-center justify-center gap-1 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
            >
              {nextStatusLabel(order)}<ChevronRight size={15} />
            </button>
          )
        )}
      </div>
    </div>
  )
}