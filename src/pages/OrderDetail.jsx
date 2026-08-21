// ============================================
// OrderDetail: detalle completo de una orden, unificado en un solo elemento
// (mismo esquema visual que el modal del taller y el formulario).
// ============================================
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  Printer,
  Trash2,
  Play,
  Search,
  Check,
  CheckCircle2,
  PackageCheck,
  RotateCcw,
  Sticker,
  Save,
  Phone,
  BellRing,
  BellOff,
  Lock,
  Smartphone,
  User,
  X,
  Pencil,
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
  titleCase,
  sentenceCase,
  addDays,
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
  const { orders, customers, setOrderStatus, updateOrder, toggleNotified, confirmOrder, printLabel, deleteOrder } = useData()
  const [printing, setPrinting] = useState(false)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState('')
  const noticeTimer = useRef(null)
  const [technicianNotes, setTechnicianNotes] = useState('')
  const [budgetFixList, setBudgetFixList] = useState([])
  const [budgetCustomFix, setBudgetCustomFix] = useState('')
  const [budgetPriceText, setBudgetPriceText] = useState('')
  const [editingBudget, setEditingBudget] = useState(false)

  const order = orders.find((o) => o.id === id)
  const customer = customers.find((c) => c.id === order?.customerId)
  const role = currentUser?.role
  const isAdmin = role === 'admin'
  const isTech = role === 'tecnico' || role === 'admin'
  const isCounter = role === 'mostrador' || role === 'admin'
  const canBudget = ['mostrador', 'admin'].includes(role)

  useEffect(() => {
    if (!order) return
    setTechnicianNotes(order.technicianNotes || '')
    setBudgetFixList((order.fix || '').split(',').map((s) => s.trim()).filter(Boolean))
    setBudgetPriceText(order.price ? String(order.price) : '')
    setBudgetCustomFix('')
    setEditingBudget(false)
    setNotice('')
    // Solo resetear la nota cuando cambia la orden (evita pisar ediciones en curso).
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
    if (noticeTimer.current) clearTimeout(noticeTimer.current)
    setNotice(msg)
    if (msg) noticeTimer.current = window.setTimeout(() => setNotice(''), 6000)
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

  const handleRetiro = async () => {
    if (!window.confirm('¿Confirmás que el cliente retiró el equipo?')) return
    setBusy('retiro')
    const res = await setOrderStatus(order.id, 'entregado', { retiro: true })
    showNotice(res.error ? res.error : 'Equipo retirado por el cliente.')
    setBusy(null)
  }

  const handleGarantia = async () => {
    if (!window.confirm('¿Volver a reparar el equipo por garantía?')) return
    setBusy('en_reparacion')
    const res = await setOrderStatus(order.id, 'en_reparacion')
    showNotice(res.error ? res.error : 'Equipo en reparación por garantía.')
    setBusy(null)
  }

  const saveNotes = async () => {
    setBusy('notes')
    const res = await updateOrder(order.id, {
      technicianNotes: sentenceCase(technicianNotes),
    })
    showNotice(res.error ? res.error : 'Notas guardadas.')
    setBusy(null)
  }

  const toggleBudgetFix = (name) =>
    setBudgetFixList((list) => (list.includes(name) ? list.filter((f) => f !== name) : [...list, name]))

  const addBudgetCustomFix = () => {
    const v = budgetCustomFix.trim()
    if (!v) return
    setBudgetFixList((list) => (list.includes(v) ? list : [...list, v]))
    setBudgetCustomFix('')
  }

  const startEditBudget = () => {
    setBudgetFixList((order.fix || '').split(',').map((s) => s.trim()).filter(Boolean))
    setBudgetPriceText(order.price ? String(order.price) : '')
    setBudgetCustomFix('')
    setEditingBudget(true)
  }

  const cancelEditBudget = () => {
    setBudgetFixList((order.fix || '').split(',').map((s) => s.trim()).filter(Boolean))
    setBudgetPriceText(order.price ? String(order.price) : '')
    setBudgetCustomFix('')
    setEditingBudget(false)
  }

  const saveBudget = async () => {
    const fix = [...budgetFixList, budgetCustomFix.trim()].filter(Boolean).map((f) => titleCase(f)).join(', ')
    const price = Number(budgetPriceText) || 0
    setBusy('budget')
    const res = await updateOrder(order.id, { fix, price })
    if (!res.error) {
      setEditingBudget(false)
      showNotice('Presupuesto guardado.')
    } else showNotice(res.error)
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
  const chipReadonly =
    'inline-flex items-center rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300'
  const chipSelected =
    'inline-flex items-center gap-1 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700'
  const chipIdle =
    'inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
  const labelCls = 'mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400'
  const sectionHead =
    'border-b border-slate-200 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700'

  const accessories = (order.accessories || '').split(',').map((a) => a.trim()).filter(Boolean)
  const conditions = (order.conditions || '').split(',').map((c) => c.trim()).filter(Boolean)
  const displayedFixes = (order.fix || '').split(',').map((f) => f.trim()).filter(Boolean)

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
                <Badge tone={order.diagnosisType === 'revision' ? 'primary' : 'slate'}>
                  {order.diagnosisType === 'revision' ? 'Revisión' : 'Reparación'}
                </Badge>
                <Badge tone={orderStatusTone(status)}>{ORDER_STATUS_LABEL[status]}</Badge>
                {['presupuesto', 'terminado'].includes(status) && (
                  <Badge tone={order.notified ? 'green' : 'yellow'}>
                    {order.notified ? 'Avisado' : 'Sin avisar'}
                  </Badge>
                )}
                {order.confirmed && <Badge tone="green">Confirmado</Badge>}
              </div>
              <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                Recibió {titleCase(order.receivedByName)} · {formatDate(order.createdAt)}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
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
                {titleCase(order.brand)} {titleCase(order.model)}
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
                {order.issue ? sentenceCase(order.issue) : '—'}
              </p>
            </div>
          </div>
        </section>

        {/* Reparación */}
        <section>
          <div className="px-6 pb-2 pt-5">
            <p className={sectionHead}>Reparación</p>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label className={labelCls}>Arreglo a realizar</label>
                    {['en_revision', 'presupuesto'].includes(status) && canBudget && !editingBudget && (
                      <button
                        type="button"
                        onClick={startEditBudget}
                        className="inline-flex items-center gap-1 rounded-lg border border-primary-200 px-2 py-0.5 text-xs font-semibold text-primary-600 transition hover:bg-primary-50 dark:border-primary-500/30 dark:text-primary-400 dark:hover:bg-primary-500/10"
                      >
                        <Pencil size={12} />
                        Editar presupuesto
                      </button>
                    )}
                  </div>

                  {editingBudget ? (
                    <div className="space-y-3 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {COMMON_FIXES.map((f) => (
                          <button key={f} type="button" onClick={() => toggleBudgetFix(f)}
                            className={budgetFixList.includes(f) ? chipSelected : chipIdle}>
                            {f}
                          </button>
                        ))}
                        {budgetFixList.filter((f) => !COMMON_FIXES.includes(f)).map((f) => (
                          <span key={f} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300">
                            {f}
                            <button type="button" onClick={() => toggleBudgetFix(f)} aria-label={`Quitar ${f}`} className="transition hover:text-red-500">
                              <X size={12} />
                            </button>
                          </span>
                        ))}
                        <span className="flex items-center gap-1">
                          <input
                            type="text"
                            value={budgetCustomFix}
                            onChange={(e) => setBudgetCustomFix(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBudgetCustomFix() } }}
                            placeholder="Otro arreglo..."
                            className={`${inputCls} !w-36`}
                          />
                          <button type="button" onClick={addBudgetCustomFix} className={chipIdle}>
                            <Check size={13} />
                          </button>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {displayedFixes.length > 0 ? (
                        displayedFixes.map((f) => (
                          <span key={f} className={chipReadonly}>
                            {f}
                          </span>
                        ))
                      ) : (
                        <span className="text-sm text-slate-400">Sin definir</span>
                      )}
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>{editingBudget ? 'Presupuesto ($)' : 'Presupuesto'}</label>
                    {editingBudget ? (
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={budgetPriceText}
                        onChange={(e) => setBudgetPriceText(e.target.value)}
                        className={inputCls}
                      />
                    ) : (
                      <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {formatMoney(order.price)}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className={labelCls}>Seña recibida</label>
                    <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {formatMoney(order.advance)}
                    </p>
                  </div>
                </div>
                {editingBudget && (
                  <div className="flex items-center gap-2 pt-1">
                    <button onClick={saveBudget} disabled={busy === 'budget'} className={btnPrimary}>
                      <Save size={14} />
                      Guardar presupuesto
                    </button>
                    <button type="button" onClick={cancelEditBudget} className={btnGhost}>
                      Cancelar
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className={labelCls}>Notas del técnico</label>
                <textarea
                  value={technicianNotes}
                  onChange={(e) => setTechnicianNotes(e.target.value)}
                  rows={6}
                  placeholder="Diagnóstico, repuestos, qué decirle al cliente..."
                  className={inputCls}
                  disabled={!isTech}
                />
                {isTech && (
                  <button onClick={saveNotes} disabled={busy === 'notes'} className={`${btnPrimary} mt-2`}>
                    <Save size={14} />
                    Guardar notas
                  </button>
                )}
              </div>
            </div>

            {/* Acciones según el estado */}
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">

              {/* === BOTÓN INTELIGENTE (empleado / mostrador) === */}
              {isCounter && (() => {
                if (status === 'presupuesto') {
                  if (!order.notified) {
                    return (
                      <button onClick={handleNotified} disabled={busy === 'notified'} className={btnPrimary}>
                        <BellRing size={14} />
                        Avisar al cliente
                      </button>
                    )
                  }
                  if (!order.confirmed) {
                    return (
                      <div className="flex flex-wrap items-center gap-2">
                        <button onClick={handleConfirm} disabled={busy === 'confirm'} className={btnPrimary}>
                          <CheckCircle2 size={14} />
                          Confirmar arreglo
                        </button>
                        <button onClick={() => doStatus('entregado')} disabled={busy === 'entregado' || !order.notified} className={btnGhost}>
                          No aprobó → entregar
                        </button>
                      </div>
                    )
                  }
                  return (
                    <p className="flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
                      <Lock size={14} className="text-amber-500" />
                      Esperando reparación del técnico...
                    </p>
                  )
                }
                if (status === 'terminado') {
                  if (!order.notified) {
                    return (
                      <button onClick={handleNotified} disabled={busy === 'notified'} className={btnPrimary}>
                        <BellRing size={14} />
                        Avisar al cliente
                      </button>
                    )
                  }
                  return (
                    <button onClick={() => doStatus('entregado')} disabled={busy === 'entregado'} className={`${btnPrimary} !text-emerald-600`}>
                      <PackageCheck size={14} />
                      Entregar al cliente
                    </button>
                  )
                }
                return null
              })()}

              {/* "Cliente retiró el equipo" (cualquier estado no entregado) */}
              {isCounter && status !== 'entregado' && (
                <button onClick={handleRetiro} disabled={busy === 'retiro'} className={btnGhost}>
                  <PackageCheck size={14} />
                  Cliente retiró el equipo
                </button>
              )}

              {/* === ACCIONES DEL TÉCNICO === */}
              {status === 'recibido' && order.diagnosisType === 'visible' && isTech && (
                <button
                  onClick={() => doStatus('en_reparacion')}
                  disabled={busy === 'en_reparacion' || !order.assignedTo}
                  title={!order.assignedTo ? 'Asigná un técnico antes de iniciar la reparación' : ''}
                  className={`${btnPrimary} ${!order.assignedTo ? '!cursor-not-allowed !bg-slate-300 !text-slate-500' : ''}`}
                >
                  <Play size={14} />
                  Iniciar reparación
                </button>
              )}
              {status === 'recibido' && order.diagnosisType === 'revision' && isTech && (
                <button
                  onClick={() => doStatus('en_revision')}
                  disabled={busy === 'en_revision' || !order.assignedTo}
                  title={!order.assignedTo ? 'Asigná un técnico antes de iniciar la revisión' : ''}
                  className={`${btnPrimary} ${!order.assignedTo ? '!cursor-not-allowed !bg-slate-300 !text-slate-500' : ''}`}
                >
                  <Search size={14} />
                  Iniciar revisión
                </button>
              )}
              {status === 'en_revision' && (canBudget || isTech) && (
                <button
                  onClick={() => doStatus('presupuesto')}
                  disabled={busy === 'presupuesto' || !(order.fix || '').trim()}
                  title={!(order.fix || '').trim() ? 'Registrá al menos una reparación antes de pasar a presupuesto' : ''}
                  className={`${btnPrimary} ${!(order.fix || '').trim() ? '!cursor-not-allowed !bg-slate-300 !text-slate-500' : ''}`}
                >
                  <Play size={14} />
                  Cargar presupuesto
                </button>
              )}
              {status === 'presupuesto' && isTech && (
                <button
                  onClick={() => doStatus('en_reparacion')}
                  disabled={busy === 'en_reparacion' || !order.confirmed || !order.assignedTo}
                  title={!order.confirmed ? 'El cliente debe confirmar el arreglo antes de reparar' : !order.assignedTo ? 'Asigná un técnico antes de iniciar la reparación' : ''}
                  className={`${btnPrimary} ${(!order.confirmed || !order.assignedTo) ? '!cursor-not-allowed !bg-slate-300 !text-slate-500' : ''}`}
                >
                  <Play size={14} />
                  Aceptó → reparar
                </button>
              )}
              {status === 'en_reparacion' && isTech && (
                <>
                  <button onClick={() => doStatus('terminado')} disabled={busy === 'terminado'} className={btnPrimary}>
                    <CheckCircle2 size={14} />
                    Marcar terminado (listo)
                  </button>
                  {canBudget && (
                    <button onClick={() => doStatus('presupuesto')} disabled={busy === 'presupuesto'} className={btnGhost}>
                      <RotateCcw size={14} />
                      Volver a presupuesto
                    </button>
                  )}
                </>
              )}
              {status === 'terminado' && isTech && (
                <button onClick={() => doStatus('en_reparacion')} disabled={busy === 'en_reparacion'} className={btnGhost}>
                  <RotateCcw size={14} />
                  Volver a reparación
                </button>
              )}
              {status === 'entregado' && isTech && (
                <button onClick={handleGarantia} disabled={busy === 'en_reparacion'} className={btnGhost}>
                  <RotateCcw size={14} />
                  Volver a reparación (garantía)
                </button>
              )}
            </div>
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
      </Card>

      <OrderPrint open={printing} order={order} customer={customer} onClose={() => setPrinting(false)} />
    </div>
  )
}