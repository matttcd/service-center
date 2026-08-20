// ============================================
// OrderModal: orden completa con acciones rápidas del técnico.
// Reutilizado por el Taller y la página de equipos listos.
// ============================================
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  Check,
  Bell,
  BellOff,
  ArrowRight,
  Lock,
  CheckCircle2,
  History,
  Pencil,
  Phone,
  Smartphone,
  User,
  X,
} from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import Badge from './Badge.jsx'
import Modal from './Modal.jsx'
import { PatternPreview } from './PatternPad.jsx'
import { COMMON_FIXES } from '../utils/constants.js'
import {
  ORDER_STATUS_LABEL,
  orderStatusTone,
  formatMoney,
  formatDateTime,
  titleCase,
  sentenceCase,
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

function initials(name) {
  return String(name || '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || '')
    .join('')
}

const chipSelected =
  'inline-flex items-center gap-1 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700'
const chipIdle =
  'inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
const chipReadonly =
  'inline-flex items-center rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 dark:border-slate-700 dark:text-slate-300'

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:text-slate-600 disabled:opacity-80 dark:disabled:text-slate-300'
const labelCls = 'mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300'

export default function OrderModal({ order, onClose }) {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const { customers, setOrderStatus, toggleNotified, updateOrder, confirmOrder } = useData()
  const [fixList, setFixList] = useState(() => (order?.fix || '').split(',').map((s) => s.trim()).filter(Boolean))
  const [customFix, setCustomFix] = useState('')
  const [priceText, setPriceText] = useState(order?.price ? String(order.price) : '')
  const [techNotes, setTechNotes] = useState(order?.technicianNotes || '')
  const [busy, setBusy] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const canBudget = currentUser?.role === 'admin'
  const [editingWork, setEditingWork] = useState(() => order?.diagnosisType === 'revision' && !order?.fix && canBudget)

  // Resincroniza el estado local cuando la orden cambia por fuera (SSE/otra
  // pestaña). No pisa ediciones en curso: solo re-sincroniza si no hay cambios.
  const prevSync = useRef(null)
  useEffect(() => {
    if (!order) return
    const prev = prevSync.current
    prevSync.current = order
    if (!prev || prev.id !== order.id) {
      setFixList((order.fix || '').split(',').map((s) => s.trim()).filter(Boolean))
      setCustomFix('')
      setPriceText(order.price ? String(order.price) : '')
      setTechNotes(order.technicianNotes || '')
      setEditingWork(order.diagnosisType === 'revision' && !order.fix && canBudget)
      return
    }
    const notesClean = (techNotes.trim() || '') === (order.technicianNotes || '')
    const priceClean = Math.abs((Number(priceText) || 0) - (order.price || 0)) <= 0.001
    const fixClean = [...fixList, customFix.trim()].filter(Boolean).join(', ') === (order.fix || '')
    if (notesClean && priceClean && fixClean) {
      setTechNotes(order.technicianNotes || '')
      setPriceText(order.price ? String(order.price) : '')
      setFixList((order.fix || '').split(',').map((s) => s.trim()).filter(Boolean))
      setCustomFix('')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order])

  if (!order) return null

  const customer = customers.find((c) => c.id === order?.customerId)
  const next = nextStatus(order)
  const fixValue = [...fixList, customFix.trim()].filter(Boolean).join(', ')
  const displayedFixes = (order.fix || '').split(',').map((s) => s.trim()).filter(Boolean)
  const lockedBudget = order.status === 'presupuesto' && !order.confirmed

  const notesDirty = (techNotes.trim() || '') !== (order.technicianNotes || '')
  const workDirty =
    fixValue !== (order.fix || '') ||
    Math.abs((Number(priceText) || 0) - (order.price || 0)) > 0.001
  const dirty = notesDirty || (editingWork && workDirty)

  const savePending = async () => {
    const fields = { technicianNotes: sentenceCase(techNotes.trim()) }
    let workChanged = false
    if (editingWork) {
      fields.fix = fixValue.split(',').map((s) => titleCase(s.trim())).filter(Boolean).join(', ')
      fields.price = Number(priceText) || 0
      workChanged = workDirty
    }
    if (!workChanged && !notesDirty) return { error: null }
    const res = await updateOrder(order.id, fields)
    if (res.error) return res
    if (workChanged && order.confirmed) {
      const c = await confirmOrder(order.id, false)
      if (c.error) return c
    }
    if (editingWork) setEditingWork(false)
    return { error: null }
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

  const saveOnly = async () => {
    setBusy(true)
    const res = await savePending()
    setBusy(false)
    if (res.error) alert(res.error)
  }

  const finish = async () => {
    setBusy(true)
    // Si el presupuesto ya estaba confirmado y se editó el trabajo, guardar
    // desmarca la confirmación: no se puede avanzar sin reconfirmar.
    const wasConfirmedBudget = order.status === 'presupuesto' && order.confirmed
    const changedBudget = editingWork && workDirty
    const saved = await savePending()
    if (saved.error) {
      setBusy(false)
      alert(saved.error)
      return
    }
    if (wasConfirmedBudget && changedBudget) {
      setBusy(false)
      alert('El presupuesto cambió: la confirmación quedó desmarcada. Confirmá el arreglo de nuevo antes de reparar.')
      return
    }
    const res = await setOrderStatus(order.id, next)
    setBusy(false)
    if (res.error) alert(res.error)
    else onClose()
  }

  const startEdit = () => {
    setFixList((order.fix || '').split(',').map((s) => s.trim()).filter(Boolean))
    setCustomFix('')
    setPriceText(order.price ? String(order.price) : '')
    setEditingWork(true)
  }

  const cancelEdit = () => {
    setFixList((order.fix || '').split(',').map((s) => s.trim()).filter(Boolean))
    setCustomFix('')
    setPriceText(order.price ? String(order.price) : '')
    setEditingWork(false)
  }

  const toggleFix = (name) =>
    setFixList((list) => (list.includes(name) ? list.filter((f) => f !== name) : [...list, name]))

  const onAddCustomFix = () => {
    const v = customFix.trim()
    if (!v) return
    setFixList((list) => (list.includes(v) ? list : [...list, v]))
    setCustomFix('')
  }

  const btnPrimary =
    'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50'
  const btnGhost =
    'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'

  const phones = [customer?.phone, customer?.phone2, customer?.phone3].filter(Boolean)
  const accessories = (order.accessories || '').split(',').map((a) => a.trim()).filter(Boolean)
  const conditions = (order.conditions || '').split(',').map((c) => c.trim()).filter(Boolean)

  // Para pasar a "Presupuesto" hace falta un monto cargado.
  const effectivePrice = editingWork ? Number(priceText) || 0 : order.price || 0
  const missingBudget = order.status === 'en_revision' && effectivePrice <= 0

  return (
    <Modal open onClose={onClose} title={`${order.orderNumber} · ${order.brand} ${order.model}`} maxWidth="max-w-3xl">
      <div className="space-y-6">
        {/* Estado */}
        <div className="flex flex-wrap items-center gap-2">
          {order.diagnosisType === 'revision' ? (
            <Badge tone="primary">Revisión</Badge>
          ) : (
            <Badge tone="slate">Reparación</Badge>
          )}
          <Badge tone={orderStatusTone(order.status)}>{ORDER_STATUS_LABEL[order.status]}</Badge>
          {['presupuesto', 'terminado'].includes(order.status) && (
            <Badge tone={order.notified ? 'green' : 'yellow'}>
              {order.notified ? 'Avisado' : 'Sin avisar'}
            </Badge>
          )}
          {order.confirmed && <Badge tone="green">Confirmado</Badge>}
        </div>

        {/* Cliente (solo nombre + teléfono) */}
        <section>
          <p className="border-b border-slate-200 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700">
            Cliente
          </p>
          <div className="flex items-center gap-3 pt-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-600 dark:bg-primary-500/15 dark:text-primary-400">
              {initials(customer?.fullName || order.customerName)}
            </div>
            <div className="min-w-0">
              <p className="flex items-center gap-1.5 truncate text-lg font-bold text-slate-900 dark:text-white">
                <User size={16} className="shrink-0 text-slate-400" />
                {customer?.fullName || order.customerName}
              </p>
              {phones.length > 0 && (
                <p className="flex items-center gap-1.5 text-base text-slate-500 dark:text-slate-400">
                  <Phone size={14} className="shrink-0" />
                  {phones.join(' · ')}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* Detalles del equipo */}
        <section>
          <p className="mb-3 border-b border-slate-200 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700">
            Detalles del equipo
          </p>
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
                    <span className="text-base text-slate-400">Sin accesorios</span>
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
                    <span className="text-base text-slate-400">Sin estado registrado</span>
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
                  <span className="text-base text-slate-400">Sin patrón configurado</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block">
              <span className={labelCls}>Seña recibida</span>
              <p className="rounded-lg bg-slate-100 px-3 py-2 text-base font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {formatMoney(order.advance)}
              </p>
            </label>
            <label className="block">
              <span className={labelCls}>Técnico encargado</span>
              <p className="rounded-lg bg-slate-100 px-3 py-2 text-base font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                {order.assignedToName || '—'}
              </p>
            </label>
          </div>

          <div className="mt-3">
            <label className={labelCls}>Chequeos / notas generales</label>
            <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-base text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              {order.issue || '—'}
            </p>
          </div>
        </section>

        {/* Confirmación del arreglo */}
        {order.status === 'presupuesto' && (
          <div className="flex flex-wrap items-center justify-between gap-3">
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
                {!order.confirmed && !order.notified && (
                  <p className="text-xs text-slate-400 dark:text-slate-500">
                    Avisá al cliente antes de confirmar el arreglo.
                  </p>
                )}
              </div>
            </div>
            <button onClick={doConfirm} disabled={busy} className={btnGhost} title={!order.confirmed && !order.notified ? 'Avisá al cliente antes de confirmar el arreglo' : ''}>
              {order.confirmed ? 'Desmarcar' : 'Confirmar arreglo'}
            </button>
          </div>
        )}

        {/* Reparación */}
        <section>
          <p className="mb-3 border-b border-slate-200 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700">
            Reparación
          </p>

          {/* Arreglo y presupuesto */}
          {editingWork ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className={labelCls}>Tipo de arreglo</span>
                <button type="button" onClick={cancelEdit} disabled={busy} className={`${btnGhost} !px-2 !py-1`}>
                  Cancelar
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {COMMON_FIXES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => toggleFix(f)}
                    className={fixList.includes(f) ? chipSelected : chipIdle}
                  >
                    {f}
                  </button>
                ))}
                {fixList.filter((f) => !COMMON_FIXES.includes(f)).map((f) => (
                  <span key={f} className="inline-flex items-center gap-1 rounded-full border border-slate-300 bg-primary-50 px-3 py-1.5 text-xs font-semibold text-primary-700 dark:border-primary-500/30 dark:bg-primary-500/10 dark:text-primary-300">
                    {f}
                    <button type="button" onClick={() => toggleFix(f)} aria-label={`Quitar ${f}`} className="transition hover:text-red-500">
                      <X size={12} />
                    </button>
                  </span>
                ))}
                <span className="flex items-center gap-1">
                  <input
                    type="text"
                    value={customFix}
                    onChange={(e) => setCustomFix(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onAddCustomFix() } }}
                    placeholder="Otro arreglo..."
                    className={`${inputCls} max-w-[10rem]`}
                  />
                  <button type="button" onClick={onAddCustomFix} className={chipIdle}>
                    <Check size={13} />
                  </button>
                </span>
              </div>
              <div className="max-w-xs">
                <label className={labelCls}>Presupuesto ($)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={priceText}
                  onChange={(e) => setPriceText(e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              {displayedFixes.length > 0 ? (
                displayedFixes.map((f) => (
                  <span key={f} className={chipReadonly}>{f}</span>
                ))
              ) : (
                <span className={chipReadonly}>Sin definir</span>
              )}
              <span className="text-lg font-bold text-slate-900 dark:text-white">{formatMoney(order.price)}</span>
              {canBudget && (
              <button
                type="button"
                onClick={startEdit}
                className="inline-flex items-center gap-1 rounded-lg border border-primary-200 px-2 py-0.5 text-xs font-semibold text-primary-600 transition hover:bg-primary-50 dark:border-primary-500/30 dark:text-primary-400 dark:hover:bg-primary-500/10"
              >
                <Pencil size={12} />
                Editar
              </button>
            )}
            </div>
          )}

          {/* Notas del técnico */}
          <label className="mt-4 block">
            <span className={labelCls}>Notas del técnico</span>
            <textarea
              value={techNotes}
              onChange={(e) => setTechNotes(e.target.value)}
              rows={3}
              placeholder="Repuestos usados, diagnóstico, qué decirle al cliente..."
              className={`${inputCls} resize-none`}
            />
          </label>

          </section>

        {/* Historial */}
        {(order.history || []).length > 0 && (
<section>
            <button
              onClick={() => setShowHistory((s) => !s)}
              className="flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
            >
              <History size={13} />
              Historial
              <span className="ml-auto text-slate-300 dark:text-slate-600">{order.history.length} eventos</span>
            </button>
            {showHistory && (
              <ul className="mt-2">
                {(order.history || []).map((h, idx) => (
                  <li key={idx} className="flex items-center justify-between gap-3 py-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">
                      {ORDER_STATUS_LABEL[h.status] || h.status}
                      {h.note && <span className="ml-1 font-normal">· {h.note}</span>}
                    </span>
                    <span className="whitespace-nowrap">{formatDateTime(h.at)} · {h.byName || '—'}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Acciones */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
          {['presupuesto', 'terminado'].includes(order.status) && (
            <button onClick={doNotify} disabled={busy} className={btnGhost}>
              {order.notified ? <BellOff size={14} /> : <Bell size={14} />}
              {order.notified ? 'Desmarcar avisado' : 'Marcar avisado'}
            </button>
          )}
          {dirty && (
            <button onClick={saveOnly} disabled={busy} className={btnGhost}>
              <Check size={14} />
              Guardar
            </button>
          )}
          <button
            onClick={() => navigate(`/ordenes/${order.id}`)}
            className="inline-flex items-center gap-2 rounded-lg border border-primary-200 px-4 py-2.5 text-sm font-semibold text-primary-600 transition hover:bg-primary-50 dark:border-primary-500/30 dark:text-primary-400 dark:hover:bg-primary-500/10"
          >
            Ver orden completa
            <ArrowRight size={16} />
          </button>
          {next && (next !== 'presupuesto' || canBudget) && (
            <button
              onClick={finish}
              disabled={busy || lockedBudget || missingBudget}
              className={`ml-auto ${lockedBudget || missingBudget ? '!cursor-not-allowed !bg-slate-300 !text-slate-500' : ''} ${btnPrimary} !px-5 !py-2.5 !text-sm`}
              title={lockedBudget ? 'El cliente debe confirmar el arreglo antes de reparar' : missingBudget ? 'Cargá el arreglo y el presupuesto primero' : ''}
            >
              {lockedBudget || missingBudget ? <Lock size={15} /> : <ChevronRight size={15} />}
              {nextLabel(order)}
            </button>
          )}
        </div>
      </div>
    </Modal>
  )
}