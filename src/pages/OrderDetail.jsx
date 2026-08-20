// ============================================
// OrderDetail: detalle completo de una orden, unificado en un solo elemento
// (mismo esquema visual que el modal del taller y el formulario).
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
  Plus,
  X,
  Smartphone,
  User,
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
import { WARRANTY_DAYS, COMMON_FIXES } from '../utils/constants.js'

function initials(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('')
}

export default function OrderDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const { orders, customers, config, setOrderStatus, updateOrder, toggleNotified, confirmOrder, printLabel, deleteOrder } = useData()
  const [printing, setPrinting] = useState(false)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState('')
  const [drafts, setDrafts] = useState({ fix: [], price: '', technicianNotes: '' })
  const [customFix, setCustomFix] = useState('')

  const order = orders.find((o) => o.id === id)
  const customer = customers.find((c) => c.id === order?.customerId)
  const role = currentUser?.role
  const isAdmin = role === 'admin'
  const isTech = role === 'tecnico' || role === 'admin'
  const isCounter = role === 'mostrador' || role === 'admin'
  const revisionFee = config?.revisionFee ?? 0

  useEffect(() => {
    if (!order) return
    setDrafts({
      fix: (order.fix || '').split(',').map((s) => s.trim()).filter(Boolean),
      price: order.price || '',
      technicianNotes: order.technicianNotes || '',
    })
    setCustomFix('')
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
        fix: [...drafts.fix, customFix.trim()].filter(Boolean).join(', '),
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
      fix: [...drafts.fix, customFix.trim()].filter(Boolean).join(', '),
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
  const chipSelected =
    'inline-flex items-center gap-1 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50'
  const chipIdle =
    'inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
  const chipReadonly =
    'inline-flex items-center rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300'
  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
  const labelCls = 'mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400'
  const sectionHead =
    'border-b border-slate-200 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700'

  const accessories = (order.accessories || '').split(',').map((a) => a.trim()).filter(Boolean)
  const conditions = (order.conditions || '').split(',').map((c) => c.trim()).filter(Boolean)

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate('/ordenes')}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft size={16} />
        Volver a órdenes
      </button>

      {notice && (
        <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
          {notice}
        </p>
      )}

      <Card className="overflow-hidden">
        {/* Encabezado */}
        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{order.orderNumber}</h1>
                <Badge tone={orderStatusTone(status)}>{ORDER_STATUS_LABEL[status]}</Badge>
                <Badge tone={order.diagnosisType === 'revision' ? 'primary' : 'slate'}>
                  {order.diagnosisType === 'revision' ? 'Revisión' : 'Reparación'}
                </Badge>
                <Badge tone={order.notified ? 'green' : 'yellow'}>
                  {order.notified ? 'Avisado' : 'Sin avisar'}
                </Badge>
                {order.confirmed && <Badge tone="green">Confirmado</Badge>}
              </div>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
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
            <div className="flex shrink-0 items-center gap-2">
              <button onClick={() => setPrinting(true)} className={btnPrimary}>
                <Printer size={14} />
                Imprimir orden
              </button>
              {isAdmin && (
                <button onClick={handleDelete} className={`${btnGhost} !text-red-500 hover:!bg-red-50 dark:hover:!bg-red-500/10`}>
                  <Trash2 size={14} />
                  Eliminar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Cliente */}
        <section>
          <div className="px-6 pb-2 pt-5">
            <p className={sectionHead}>Cliente</p>
          </div>
          <div className="px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-600 dark:bg-primary-500/15 dark:text-primary-400">
                {initials(customer?.fullName || order.customerName)}
              </div>
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 truncate text-lg font-bold text-slate-900 dark:text-white">
                  <User size={16} className="shrink-0 text-slate-400" />
                  <button
                    onClick={() => navigate(`/clientes/${customer?.id}`)}
                    className="truncate text-primary-600 transition hover:text-primary-700 dark:text-primary-400"
                  >
                    {customer?.fullName || order.customerName}
                  </button>
                </p>
                <p className="flex items-center gap-1.5 text-base text-slate-500 dark:text-slate-400">
                  <Phone size={14} className="shrink-0" />
                  {[customer?.phone, customer?.phone2, customer?.phone3].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
              <p className="text-slate-600 dark:text-slate-300">
                <span className="text-slate-400">DNI:</span> {customer?.dni || '—'}
              </p>
              <p className="text-slate-600 dark:text-slate-300">
                <span className="text-slate-400">Domicilio:</span> {customer?.address || '—'}
              </p>
            </div>
          </div>
        </section>

        {/* Detalles del equipo */}
        <section>
          <div className="px-6 pb-2 pt-5">
            <p className={sectionHead}>Detalles del equipo</p>
          </div>
          <div className="px-6 py-4">
            <div className="flex items-center gap-2 pb-2 text-base">
              <Smartphone size={15} className="shrink-0 text-slate-400" />
              <span className="truncate font-semibold text-slate-900 dark:text-white">
                {order.brand} {order.model}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="flex flex-col gap-4">
                <div>
                  <label className={labelCls}>PIN / contraseña del equipo</label>
                  <input type="text" value={order.pin || ''} readOnly disabled className={inputCls} placeholder="—" />
                </div>
                <div>
                  <label className={labelCls}>Con accesorios</label>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {accessories.length > 0 ? (
                      accessories.map((a) => (
                        <span key={a} className={chipReadonly}>
                          {a}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">Sin accesorios</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Estado del equipo</label>
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {conditions.length > 0 ? (
                      conditions.map((c) => (
                        <span key={c} className={chipReadonly}>
                          {c}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-slate-400">Sin estado registrado</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col">
                <label className={labelCls}>Patrón de desbloqueo</label>
                <div className="flex flex-1 items-center py-1">
                  {order.pattern?.length > 0 ? (
                    <PatternPreview value={order.pattern} size={140} className="h-full w-auto" />
                  ) : (
                    <span className="text-sm text-slate-400">Sin patrón configurado</span>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={labelCls}>Seña recibida</label>
                <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                  {formatMoney(order.advance)}
                </p>
              </div>
              <div>
                <label className={labelCls}>Técnico encargado</label>
                {isTech ? (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <TechnicianSelect order={order} onChanged={() => showNotice('Técnico asignado.')} />
                    {order.assignedTo && (
                      <p className="text-xs text-slate-400">{order.assignedToName || '—'}</p>
                    )}
                  </div>
                ) : (
                  <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    {order.assignedToName || '—'}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-3">
              <label className={labelCls}>Chequeos / notas generales</label>
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {order.issue || '—'}
              </p>
            </div>
          </div>
        </section>

        {/* Aviso al cliente */}
        <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800 sm:flex-row sm:items-center">
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
        </div>

        {/* Confirmación del arreglo (presupuesto) */}
        {order.status === 'presupuesto' && (
          <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-4 dark:border-slate-800 sm:flex-row sm:items-center">
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
          </div>
        )}

        {/* Reparación */}
        <section>
          <div className="px-6 pb-2 pt-5">
            <p className={sectionHead}>Reparación</p>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Arreglo a realizar</label>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    {COMMON_FIXES.map((f) => (
                      <button
                        key={f}
                        type="button"
                        disabled={!isTech}
                        onClick={() => setDrafts((d) => ({ ...d, fix: d.fix.includes(f) ? d.fix.filter((x) => x !== f) : [...d.fix, f] }))}
                        className={drafts.fix.includes(f) ? chipSelected : chipIdle}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={customFix}
                      onChange={(e) => setCustomFix(e.target.value)}
                      placeholder="Otro arreglo..."
                      className={inputCls}
                      disabled={!isTech}
                    />
                    <button
                      type="button"
                      disabled={!isTech}
                      onClick={() => {
                        const v = customFix.trim()
                        if (!v) return
                        setDrafts((d) => ({ ...d, fix: d.fix.includes(v) ? [...d.fix] : [...d.fix, v] }))
                        setCustomFix('')
                      }}
                      className={chipIdle}
                    >
                      <Plus size={13} />
                    </button>
                  </div>
                  {[...drafts.fix, customFix.trim()].filter(Boolean).length > 0 && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      {drafts.fix.map((f) => (
                        <span key={f} className="inline-flex items-center gap-1 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white">
                          {f}
                          {isTech && (
                            <button type="button" onClick={() => setDrafts((d) => ({ ...d, fix: d.fix.filter((x) => x !== f) }))} aria-label="Quitar arreglo">
                              <X size={12} />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Presupuesto ($)</label>
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
                    <label className={labelCls}>Seña recibida</label>
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
                <label className={labelCls}>Notas del técnico</label>
                <textarea
                  value={drafts.technicianNotes}
                  onChange={(e) => setDrafts((d) => ({ ...d, technicianNotes: e.target.value }))}
                  rows={6}
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

            {/* En revisión: carga de presupuesto */}
            {status === 'en_revision' && (
              <div className="mt-4 flex flex-col gap-3 rounded-xl bg-primary-50 px-4 py-3 dark:bg-primary-500/10 sm:flex-row sm:items-center sm:justify-between">
                <p className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                  <Search size={15} className="shrink-0 text-primary-500" />
                  Revisá el equipo, cargá el arreglo y el presupuesto arriba, y pasálo a presupuesto.
                </p>
                {isTech && (
                  <button onClick={sendBudget} disabled={busy === 'budget'} className={btnPrimary}>
                    <PackageCheck size={14} />
                    Cargar presupuesto
                  </button>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Historial */}
        {(order.history || []).length > 0 && (
          <section>
            <div className="px-6 pb-2 pt-5">
              <p className={sectionHead}>Historial</p>
            </div>
            <ul className="px-6 py-4">
              {(order.history || []).map((h, idx) => (
                <li key={idx} className="flex items-start justify-between gap-3 py-1.5 text-sm">
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
          </section>
        )}

        {/* Acciones según el estado */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-6 py-4 dark:border-slate-800">
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
                <button
                  onClick={() => doStatus('entregado')}
                  disabled={busy === 'entregado' || !order.notified}
                  title={!order.notified ? 'Marcá primero al cliente como avisado antes de entregar el equipo' : ''}
                  className={`${btnGhost} !text-emerald-600 ${!order.notified ? '!cursor-not-allowed !opacity-50' : ''}`}
                >
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
                <button
                  onClick={() => doStatus('entregado')}
                  disabled={busy === 'entregado' || !order.notified}
                  title={!order.notified ? 'Marcá primero al cliente como avisado antes de entregar el equipo' : ''}
                  className={`${btnPrimary} ${!order.notified ? '!cursor-not-allowed !bg-slate-300 !text-slate-500' : ''}`}
                >
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
        </div>
      </Card>

      <OrderPrint open={printing} order={order} customer={customer} onClose={() => setPrinting(false)} />
    </div>
  )
}