// ============================================
// OrderModal: orden completa con acciones rápidas del técnico.
// Reutilizado por el Taller y la página de equipos listos.
// ============================================
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  RotateCcw,
  Pencil,
  Check,
  Bell,
  BellOff,
  ArrowRight,
  Lock,
  CheckCircle2,
} from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import Badge from './Badge.jsx'
import Modal from './Modal.jsx'
import { PatternPreview } from './PatternPad.jsx'
import {
  ORDER_STATUS_LABEL,
  orderStatusTone,
  formatMoney,
  formatDate,
  formatDateTime,
} from '../utils/helpers.js'

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

export default function OrderModal({ order, onClose }) {
  const navigate = useNavigate()
  const { customers, setOrderStatus, toggleNotified, updateOrder, confirmOrder } = useData()
  const [issue, setIssue] = useState(order?.issue || '')
  const [editingIssue, setEditingIssue] = useState(false)
  const [busy, setBusy] = useState(false)

  const customer = customers.find((c) => c.id === order?.customerId)
  if (!order) return null

  const next = nextStatus(order)

  const doMove = async (status) => {
    setBusy(true)
    const res = await setOrderStatus(order.id, status)
    setBusy(false)
    if (res.error) alert(res.error)
    else onClose()
  }

  const doNotify = async () => {
    setBusy(true)
    const res = await toggleNotified(order.id, !order.notified)
    setBusy(false)
    if (res.error) alert(res.error)
  }

  const doConfirm = async () => {
    setBusy(true)
    const res = await confirmOrder(order.id, !order.confirmed)
    setBusy(false)
    if (res.error) alert(res.error)
  }

  const saveIssue = async () => {
    setEditingIssue(false)
    const v = issue.trim()
    if (v === (order.issue || '')) return
    const res = await updateOrder(order.id, { issue: v })
    if (res.error) alert(res.error)
  }

  const btnPrimary =
    'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50'
  const btnGhost =
    'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'

  return (
    <Modal open onClose={onClose} title={`${order.orderNumber} · ${order.brand} ${order.model}`} maxWidth="max-w-2xl">
      <div className="space-y-5">
        {/* Estado + avisado */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={orderStatusTone(order.status)}>{ORDER_STATUS_LABEL[order.status]}</Badge>
          {order.diagnosisType === 'revision' ? (
            <Badge tone="primary">Revisión</Badge>
          ) : (
            <Badge tone="slate">Reparación</Badge>
          )}
          {['presupuesto', 'terminado'].includes(order.status) && (
            <Badge tone={order.notified ? 'green' : 'yellow'}>
              {order.notified ? 'Avisado' : 'Sin avisar'}
            </Badge>
          )}
        </div>

        {/* Cliente */}
        <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{customer?.fullName || order.customerName}</p>
          <div className="mt-1 grid grid-cols-1 gap-1 text-xs text-slate-500 dark:text-slate-400 sm:grid-cols-2">
            <p>Teléfonos: {[customer?.phone, customer?.phone2, customer?.phone3].filter(Boolean).join(' · ') || '—'}</p>
            <p>DNI: {customer?.dni || '—'}</p>
            <p>Domicilio: {customer?.address || '—'}</p>
            <p>Recibió: {order.receivedByName} · {formatDate(order.createdAt)}</p>
          </div>
        </div>

        {/* Equipo */}
        <div className="grid grid-cols-1 gap-1 text-sm sm:grid-cols-2">
          <p><span className="text-slate-400">PIN / contraseña:</span> {order.pin || '—'}</p>
          <p><span className="text-slate-400">Accesorios:</span> {order.accessories || '—'}</p>
          <p><span className="text-slate-400">Técnico encargado:</span> {order.assignedToName || '—'}</p>
          <p><span className="text-slate-400">Seña:</span> {formatMoney(order.advance)}</p>
        </div>

        {/* Confirmación del arreglo */}
        {order.status === 'presupuesto' && (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="flex items-center gap-2">
              {order.confirmed ? (
                <CheckCircle2 size={18} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <Lock size={18} className="shrink-0 text-amber-600 dark:text-amber-400" />
              )}
              <div>
                <p className={`text-sm font-semibold ${order.confirmed ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-700 dark:text-amber-300'}`}>
                  {order.confirmed ? 'Arreglo confirmado por el cliente' : 'Esperando confirmación del cliente'}
                </p>
                {order.confirmed && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Confirmó {order.confirmedByName || '—'} · {formatDateTime(order.confirmedAt)}
                  </p>
                )}
              </div>
            </div>
            <button onClick={doConfirm} disabled={busy} className={btnGhost}>
              {order.confirmed ? 'Desmarcar' : 'Confirmar arreglo'}
            </button>
          </div>
        )}

        {/* Problema reportado editable */}
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
            Problema reportado
          </label>
          {editingIssue ? (
            <div className="flex items-start gap-1">
              <textarea
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
                rows={2}
                autoFocus
                className="w-full resize-none rounded-lg border border-primary-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none dark:border-primary-500/40 dark:bg-slate-800 dark:text-white"
              />
              <button onClick={saveIssue} className={btnPrimary} title="Guardar">
                <Check size={14} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditingIssue(true)}
              className="group flex w-full items-start gap-1 rounded-lg bg-slate-50 px-3 py-2 text-left text-sm text-slate-600 transition hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <Pencil size={13} className="mt-0.5 shrink-0 text-slate-400 group-hover:text-primary-500" />
              <span>{order.issue || <span className="italic text-slate-400">Sin detalle</span>}</span>
            </button>
          )}
        </div>

        {/* Arreglo / presupuesto */}
        <div className="rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-800">
          <p className="font-semibold text-slate-900 dark:text-white">
            {order.fix || 'Arreglo a definir'}
          </p>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Presupuesto</span>
            <span className="font-bold text-slate-900 dark:text-white">{formatMoney(order.price)}</span>
          </div>
          {order.technicianNotes && (
            <p className="mt-2 border-t border-slate-200 pt-2 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
              <span className="font-semibold">Notas del técnico:</span> {order.technicianNotes}
            </p>
          )}
        </div>

        {/* Patrón */}
        {order.pattern?.length > 0 && (
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-400">Patrón de desbloqueo:</span>
            <PatternPreview value={order.pattern} size={80} />
          </div>
        )}

        {/* Historial */}
        {(order.history || []).length > 0 && (
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-500 dark:text-slate-400">Historial</p>
            <ul className="space-y-1">
              {(order.history || []).map((h, idx) => (
                <li key={idx} className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {ORDER_STATUS_LABEL[h.status] || h.status}
                    {h.note && <span className="ml-1 font-normal">· {h.note}</span>}
                  </span>
                  <span className="whitespace-nowrap">{formatDateTime(h.at)} · {h.byName || '—'}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          {order.status === 'terminado' ? (
            <button onClick={() => doMove('en_reparacion')} disabled={busy} className={btnGhost}>
              <RotateCcw size={14} />
              Volver a reparación
            </button>
          ) : order.status === 'presupuesto' && !order.confirmed ? (
            <button disabled className={`${btnPrimary} !cursor-not-allowed !bg-slate-300 !text-slate-500`} title="El cliente debe confirmar el arreglo antes de reparar">
              <Lock size={14} />
              Reparar
            </button>
          ) : (
            next && (
              <button onClick={() => doMove(next)} disabled={busy} className={btnPrimary}>
                {nextLabel(order)}
                <ChevronRight size={14} />
              </button>
            )
          )}
          {['presupuesto', 'terminado'].includes(order.status) && (
            <button onClick={doNotify} disabled={busy} className={btnGhost}>
              {order.notified ? <BellOff size={14} /> : <Bell size={14} />}
              {order.notified ? 'Desmarcar avisado' : 'Marcar avisado'}
            </button>
          )}
          <button
            onClick={() => navigate(`/ordenes/${order.id}`)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-primary-200 px-3 py-1.5 text-xs font-semibold text-primary-600 transition hover:bg-primary-50 dark:border-primary-500/30 dark:text-primary-400 dark:hover:bg-primary-500/10"
          >
            Ver orden completa
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </Modal>
  )
}