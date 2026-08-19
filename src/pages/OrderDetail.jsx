// ============================================
// OrderDetail: detalle de una orden (1 dispositivo) + acciones por estado
// ============================================
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Printer,
  Trash2,
  Play,
  Search,
  CheckCircle2,
  PackageCheck,
  RotateCcw,
  Sticker,
  Save,
  Phone,
  BellRing,
  BellOff,
  Lock,
  AlertTriangle,
} from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import TechnicianSelect from '../components/TechnicianSelect.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import OrderPrint from '../components/OrderPrint.jsx'
import { PatternPreview } from '../components/PatternPad.jsx'
import {
  ORDER_STATUS_LABEL,
  orderStatusTone,
  formatDate,
  formatDateTime,
  formatMoney,
} from '../utils/helpers.js'
import { WARRANTY_DAYS } from '../utils/constants.js'

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const { orders, customers, config, setOrderStatus, updateOrder, toggleNotified, confirmOrder, printLabel, deleteOrder } = useData()
  const [printing, setPrinting] = useState(false)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState('')
  const [drafts, setDrafts] = useState({ fix: '', price: '', technicianNotes: '' })

  const order = orders.find((o) => o.id === id)
  const customer = customers.find((c) => c.id === order?.customerId)
  const role = currentUser?.role
  const isTech = role === 'tecnico' || role === 'admin'
  const isCounter = role === 'mostrador' || role === 'admin'
  const revisionFee = config?.revisionFee ?? 0

  useEffect(() => {
    if (!order) return
    setDrafts({
      fix: order.fix || '',
      price: order.price || '',
      technicianNotes: order.technicianNotes || '',
    })
    setNotice('')
    // Solo resetear los borradores cuando cambia la orden (evita pisar ediciones en curso).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order?.id])

  if (!order) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-slate-400">Orden no encontrada.</p>
        <button
          onClick={() => navigate('/ordenes')}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
        >
          <ArrowLeft size={16} />
          Volver a órdenes
        </button>
      </div>
    )
  }

  const status = order.status

  const showNotice = (msg) => {
    setNotice(msg)
    if (msg) window.setTimeout(() => setNotice(''), 6000)
  }

  const doStatus = async (next) => {
    setBusy(next)
    setNotice('')
    try {
      const res = await setOrderStatus(order.id, next)
      if (res.error) return showNotice(res.error)
      if (next === 'terminado') showNotice('Equipo marcado como listo. Avisale al cliente.')
      else if (next === 'entregado') showNotice('Equipo entregado.')
      else showNotice('Estado actualizado.')
    } finally {
      setBusy(null)
    }
  }

  // Carga presupuesto (caso revisión): guarda notas + presupuesto y pasa a "presupuesto".
  const sendBudget = async () => {
    if (Number(drafts.price) <= 0) return showNotice('Cargá el presupuesto antes de pasarlo.')
    setBusy('budget')
    setNotice('')
    try {
      const save = await updateOrder(order.id, {
        fix: drafts.fix,
        price: Number(drafts.price) || 0,
      })
      if (save.error) return showNotice(save.error)
      const res = await setOrderStatus(order.id, 'presupuesto')
      if (res.error) return showNotice(res.error)
      showNotice('Presupuesto cargado. Avisá al cliente para que confirme.')
    } finally {
      setBusy(null)
    }
  }

  const saveNotes = async () => {
    setBusy('notes')
    const res = await updateOrder(order.id, {
      fix: drafts.fix,
      price: Number(drafts.price) || 0,
      technicianNotes: drafts.technicianNotes,
    })
    showNotice(res.error ? res.error : 'Notas y presupuesto guardados.')
    setBusy(null)
  }

  const handleNotified = async () => {
    setBusy('notified')
    const res = await toggleNotified(order.id, !order.notified)
    showNotice(res.error ? res.error : order.notified ? 'Cliente desmarcado como avisado.' : 'Cliente marcado como avisado.')
    setBusy(null)
  }

  const handleConfirm = async () => {
    setBusy('confirm')
    const res = await confirmOrder(order.id, !order.confirmed)
    showNotice(res.error ? res.error : order.confirmed ? 'Confirmación desmarcada.' : 'Arreglo confirmado por el cliente.')
    setBusy(null)
  }

  const handleDelete = async () => {
    if (!window.confirm(`¿Eliminar la orden ${order.orderNumber}?`)) return
    const res = await deleteOrder(order.id)
    if (!res.error) navigate('/ordenes')
    else showNotice(res.error)
  }

  const btnPrimary =
    'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50'
  const btnGhost =
    'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/ordenes')}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft size={16} />
        Volver a órdenes
      </button>

      {/* Encabezado */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{order.orderNumber}</h1>
              <Badge tone={orderStatusTone(status)}>{ORDER_STATUS_LABEL[status]}</Badge>
              <Badge tone={order.notified ? 'green' : 'yellow'}>
                {order.notified ? 'Avisado' : 'Sin avisar'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              {order.brand} {order.model} ·{' '}
              <button
                onClick={() => navigate(`/clientes/${customer?.id}`)}
                className="font-semibold text-primary-600 transition hover:text-primary-700 dark:text-primary-400"
              >
                {customer?.fullName || order.customerName}
              </button>{' '}
              · Recibió {order.receivedByName} · {formatDate(order.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPrinting(true)} className={btnPrimary}>
            <Printer size={14} />
            Imprimir orden
          </button>
          <button onClick={handleDelete} className={`${btnGhost} !text-red-500 hover:!bg-red-50 dark:hover:!bg-red-500/10`}>
            <Trash2 size={14} />
            Eliminar
          </button>
        </div>
      </div>

      {notice && (
        <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
          {notice}
        </p>
      )}

      {/* Aviso al cliente */}
      <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex-1 text-sm">
          {order.notified ? (
            <p className="text-slate-600 dark:text-slate-300">
              <BellRing size={16} className="mr-1.5 inline text-emerald-500" />
              Cliente <span className="font-semibold">avisado</span> por {order.notifiedByName || '—'} el{' '}
              {formatDateTime(order.notifiedAt)}
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <BellOff size={16} className="text-accent-500" />
              Todavía <span className="font-semibold">no se avisó</span> al cliente.
            </p>
          )}
        </div>
        <button onClick={handleNotified} disabled={busy === 'notified'} className={btnGhost}>
          {order.notified ? 'Desmarcar avisado' : 'Marcar avisado'}
        </button>
      </Card>

      {/* Confirmación del arreglo (presupuesto) */}
      {order.status === 'presupuesto' && (
        <Card className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <div className="flex-1 text-sm">
            {order.confirmed ? (
              <p className="text-slate-600 dark:text-slate-300">
                <CheckCircle2 size={16} className="mr-1.5 inline text-emerald-500" />
                Arreglo <span className="font-semibold">confirmado</span> por el cliente ·{' '}
                {order.confirmedByName || '—'} el {formatDateTime(order.confirmedAt)}
              </p>
            ) : (
              <p className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                <Lock size={16} className="text-amber-500" />
                El cliente <span className="font-semibold">aún no confirma</span> el arreglo. Sin confirmación no se puede reparar.
              </p>
            )}
          </div>
          <button onClick={handleConfirm} disabled={busy === 'confirm'} className={btnGhost}>
            {order.confirmed ? 'Desmarcar confirmación' : 'Confirmar arreglo'}
          </button>
        </Card>
      )}

      {/* Datos del cliente */}
      <Card>
        <div className="grid grid-cols-1 gap-3 px-5 py-4 text-sm sm:grid-cols-3">
          <p className="text-slate-600 dark:text-slate-300">
            <span className="text-slate-400">Teléfonos:</span>{' '}
            {[customer?.phone, customer?.phone2, customer?.phone3].filter(Boolean).join(' · ') || '—'}
          </p>
          <p className="text-slate-600 dark:text-slate-300">
            <span className="text-slate-400">DNI:</span> {customer?.dni || '—'}
          </p>
          <p className="text-slate-600 dark:text-slate-300">
            <span className="text-slate-400">Domicilio:</span> {customer?.address || '—'}
          </p>
        </div>
      </Card>

      {/* Dispositivo */}
      <Card>
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <p className="text-lg font-bold text-slate-900 dark:text-white">
            {order.brand} {order.model}
          </p>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {order.diagnosisType === 'revision' ? 'Ingresó a revisión' : 'Problema visible'}
          </p>
        </div>
        <div className="grid grid-cols-1 gap-3 px-5 py-4 text-sm sm:grid-cols-3">
          <p className="text-slate-600 dark:text-slate-300">
            <span className="text-slate-400">PIN / contraseña:</span> {order.pin || '—'}
          </p>
          <p className="text-slate-600 dark:text-slate-300">
            <span className="text-slate-400">Accesorios:</span> {order.accessories || '—'}
          </p>
          <p className="text-slate-600 dark:text-slate-300">
            <span className="text-slate-400">Problema reportado:</span> {order.issue || '—'}
          </p>
        </div>
        {isTech && (
          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 px-5 py-4 text-sm dark:border-slate-800">
            <span className="text-slate-400">Técnico encargado:</span>
            <TechnicianSelect order={order} onChanged={() => showNotice('Técnico asignado.')} />
            {order.assignedTo && (
              <p className="text-xs text-slate-400">{order.assignedToName || '—'}</p>
            )}
          </div>
        )}
        {order.pattern?.length > 0 && (
          <div className="flex items-center gap-3 border-t border-slate-200 px-5 py-4 text-sm dark:border-slate-800">
            <span className="text-slate-400">Patrón de desbloqueo:</span>
            <PatternPreview value={order.pattern} size={80} />
          </div>
        )}
      </Card>

      {/* Presupuesto y notas del técnico */}
      <Card>
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">Presupuesto</h2>
        </div>
        <div className="grid grid-cols-1 gap-4 px-5 py-4 lg:grid-cols-2">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                Arreglo a realizar
              </label>
              <input
                type="text"
                value={drafts.fix}
                onChange={(e) => setDrafts((d) => ({ ...d, fix: e.target.value }))}
                placeholder="Ej: cambio de pantalla"
                className={inputCls}
                disabled={!isTech}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Presupuesto ($)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={drafts.price}
                  onChange={(e) => setDrafts((d) => ({ ...d, price: e.target.value }))}
                  className={inputCls}
                  disabled={!isTech}
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Seña recibida
                </label>
                <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {formatMoney(order.advance)}
                </p>
              </div>
            </div>
            {status === 'presupuesto' && (
              <p className="flex items-start gap-1.5 rounded-lg bg-accent-50 px-3 py-2 text-xs text-accent-700 dark:bg-accent-500/10 dark:text-accent-400">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                Si el cliente no acepta, se cobra solo la revisión ({formatMoney(revisionFee)}).
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400">
              Notas del técnico
            </label>
            <textarea
              value={drafts.technicianNotes}
              onChange={(e) => setDrafts((d) => ({ ...d, technicianNotes: e.target.value }))}
              rows={4}
              placeholder="Diagnóstico, repuestos, qué decirle al cliente..."
              className={inputCls}
              disabled={!isTech}
            />
            {isTech && (
              <button onClick={saveNotes} disabled={busy === 'notes'} className={`${btnPrimary} mt-2`}>
                <Save size={14} />
                Guardar notas y presupuesto
              </button>
            )}
          </div>
        </div>
      </Card>

      {/* Acciones según el estado */}
      <Card className="flex flex-wrap items-center gap-2 p-4">
        {status === 'recibido' && order.diagnosisType === 'visible' && isTech && (
          <button onClick={() => doStatus('en_reparacion')} disabled={busy === 'en_reparacion'} className={btnPrimary}>
            <Play size={14} />
            Iniciar reparación
          </button>
        )}
        {status === 'recibido' && order.diagnosisType === 'revision' && isTech && (
          <button onClick={() => doStatus('en_revision')} disabled={busy === 'en_revision'} className={btnPrimary}>
            <Search size={14} />
            Iniciar revisión
          </button>
        )}
        {status === 'en_revision' && (
          <>
            <p className="flex-1 text-sm text-slate-500 dark:text-slate-400">
              Revisá el equipo, cargá el arreglo y el presupuesto arriba, y pasálo a presupuesto.
            </p>
            {isTech && (
              <button onClick={sendBudget} disabled={busy === 'budget'} className={btnPrimary}>
                <PackageCheck size={14} />
                Cargar presupuesto
              </button>
            )}
          </>
        )}
        {status === 'presupuesto' && (
          <>
            <p className="flex-1 text-sm text-slate-500 dark:text-slate-400">
              ¿Qué decidió el cliente sobre el presupuesto?
            </p>
            {isTech && (
              <button
                onClick={() => doStatus('en_reparacion')}
                disabled={busy === 'en_reparacion' || !order.confirmed}
                title={!order.confirmed ? 'El cliente debe confirmar el arreglo antes de reparar' : ''}
                className={`${btnPrimary} ${!order.confirmed ? '!cursor-not-allowed !bg-slate-300 !text-slate-500' : ''}`}
              >
                <Play size={14} />
                Aceptó → reparar
              </button>
            )}
            {isCounter && (
              <button onClick={() => doStatus('entregado')} disabled={busy === 'entregado'} className={`${btnGhost} !text-emerald-600`}>
                <PackageCheck size={14} />
                Rechazó → entregar (cobra revisión)
              </button>
            )}
          </>
        )}
        {status === 'en_reparacion' && isTech && (
          <button onClick={() => doStatus('terminado')} disabled={busy === 'terminado'} className={btnPrimary}>
            <CheckCircle2 size={14} />
            Marcar terminado (listo)
          </button>
        )}
        {status === 'terminado' && (
          <>
            {isCounter && (
              <button onClick={() => doStatus('entregado')} disabled={busy === 'entregado'} className={btnPrimary}>
                <PackageCheck size={14} />
                Entregar al cliente
              </button>
            )}
            {isTech && (
              <button onClick={() => doStatus('en_reparacion')} disabled={busy === 'en_reparacion'} className={btnGhost}>
                <RotateCcw size={14} />
                Volver a reparación
              </button>
            )}
            <button
              onClick={async () => {
                const res = await printLabel(order.id)
                showNotice(res.error ? res.error : 'Etiqueta enviada a la impresora.')
              }}
              className={btnGhost}
            >
              <Sticker size={14} />
              Imprimir etiqueta
            </button>
          </>
        )}
        {status === 'entregado' && (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-600">
            <Phone size={14} />
            Entregado el {formatDate(order.deliveredAt)} por {order.deliveredByName || '—'} · Garantía{' '}
            {WARRANTY_DAYS} días
          </p>
        )}
      </Card>

      {/* Historial */}
      {(order.history || []).length > 0 && (
        <Card>
          <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <h2 className="font-semibold text-slate-900 dark:text-white">Historial</h2>
          </div>
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {(order.history || []).map((h, idx) => (
              <li key={idx} className="flex items-start justify-between gap-3 px-5 py-3 text-sm">
                <div>
                  <p className="font-semibold text-slate-700 dark:text-slate-200">
                    {ORDER_STATUS_LABEL[h.status] || h.status}
                  </p>
                  {h.note && <p className="text-xs text-slate-500">{h.note}</p>}
                </div>
                <p className="whitespace-nowrap text-xs text-slate-400">
                  {formatDateTime(h.at)} · {h.byName || '—'}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <OrderPrint open={printing} order={order} customer={customer} onClose={() => setPrinting(false)} />
    </div>
  )
}