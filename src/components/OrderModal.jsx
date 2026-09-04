// ============================================
// OrderModal: orden completa con acciones rápidas del técnico.
// Reutilizado por el Taller y la página de Terminados.
// ============================================
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ChevronRight,
  ChevronDown,
  Check,
  Bell,
  BellOff,
  ArrowRight,
  Lock,
  CheckCircle2,
  History,
  Pencil,
  Phone,
  StickyNote,
  User,
  X,
} from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import Badge from './Badge.jsx'
import ConfirmModal from './ConfirmModal.jsx'
import PrintOrderPanel from './PrintOrderPanel.jsx'
import Modal from './Modal.jsx'
import NotesModal from './NotesModal.jsx'
import TechnicianSelect from './TechnicianSelect.jsx'
import { PatternPreview } from './PatternPad.jsx'
import {
  ORDER_STATUS_LABEL,
  orderStatusTone,
  formatMoney,
  formatDateTime,
  titleCase,
} from '../utils/helpers.js'
import { nextStatus, nextStatusLabel } from '../../shared/fsm.js'

const FIX_FALLBACK = ['Cambio de pantalla', 'Cambio de módulo', 'Cambio de batería', 'Pin de carga', 'Micrófono', 'Parlante', 'Botón de encendido', 'Flex', 'Software', 'Limpieza']



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
  'inline-flex items-center gap-1 rounded-full border border-slate-400 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
const chipReadonly =
  'inline-flex items-center rounded-full border border-slate-400 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200'

const inputCls =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white disabled:text-slate-600 disabled:opacity-80 dark:disabled:text-slate-300'
const labelCls = 'mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300'

export default function OrderModal({ order, onClose }) {
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const { customers, setOrderStatus, toggleNotified, updateOrder, confirmOrder, editNote, deleteNote, catalogLists } = useData()
  const fixOptions = catalogLists?.fixes?.length ? catalogLists.fixes : FIX_FALLBACK
  const [fixList, setFixList] = useState(() => (order?.fix || '').split(',').map((s) => s.trim()).filter(Boolean))
  const [customFix, setCustomFix] = useState('')
  const [priceText, setPriceText] = useState(order?.price ? String(order.price) : '')
  const [techValue, setTechValue] = useState(order?.assignedTo || '')
  const [busy, setBusy] = useState(false)
  const [alertModal, setAlertModal] = useState(null)
  const [printOpen, setPrintOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [notesModalOpen, setNotesModalOpen] = useState(false)
  const canBudget = ['recepcion', 'admin'].includes(currentUser?.role)
  const canEditWork = ['tecnico', 'admin'].includes(currentUser?.role)
  const isReadOnly = !['tecnico'].includes(currentUser?.role)
  // Para órdenes a revisión, el tipo de reparación no se puede definir hasta que
  // haya un técnico asignado y la orden esté en "en_revision".
  const fixLocked =
    order?.diagnosisType === 'revision' &&
    !(order?.fix || '').trim() &&
    (!order?.assignedTo || order?.status !== 'en_revision')
  const [editingWork, setEditingWork] = useState(() => canEditWork && !isReadOnly && !order?.fix && !fixLocked)

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
      setTechValue(order.assignedTo || '')
      setEditingWork(canEditWork && !isReadOnly && !order.fix && !fixLocked)
      return
    }
    const priceClean = Math.abs((Number(priceText) || 0) - (order.price || 0)) <= 0.001
    const fixClean = [...fixList, customFix.trim()].filter(Boolean).join(', ') === (order.fix || '')
    if (priceClean && fixClean && techValue === (order.assignedTo || '')) {
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
  const missingTech = (next === 'en_reparacion' || next === 'en_revision') && !techValue

  const workDirty =
    fixValue !== (order.fix || '') ||
    Math.abs((Number(priceText) || 0) - (order.price || 0)) > 0.001
  const dirty = editingWork && workDirty
  const wantsPresupuesto = order.status === 'en_reparacion' && editingWork && workDirty
  const effectiveNext = wantsPresupuesto ? 'presupuesto' : next
  const effectiveLabel = wantsPresupuesto ? 'Presupuestar' : nextStatusLabel(order)

  const savePending = async () => {
    const fields = {}
    let workChanged = false
    if (editingWork) {
      fields.fix = fixValue.split(',').map((s) => titleCase(s.trim())).filter(Boolean).join(', ')
      if (canBudget) fields.price = Number(priceText) || 0
      workChanged = workDirty
    }
    if (!workChanged) return { error: null }
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
    if (res.error) setAlertModal(res.error)
  }

  const doConfirm = async () => {
    setBusy(true)
    const res = await confirmOrder(order.id, !order.confirmed)
    setBusy(false)
    if (res.error) setAlertModal(res.error)
  }

  const saveNote = async (text) => {
    const res = await updateOrder(order.id, { note: text })
    if (res.error) setAlertModal(res.error)
  }

  const saveOnly = async () => {
    setBusy(true)
    const res = await savePending()
    setBusy(false)
    if (res.error) setAlertModal(res.error)
  }

  const finish = async () => {
    setBusy(true)
    const wasConfirmedBudget = order.status === 'presupuesto' && order.confirmed
    const changedBudget = editingWork && workDirty
    const saved = await savePending()
    if (saved.error) {
      setBusy(false)
      setAlertModal(saved.error)
      return
    }
    if (wasConfirmedBudget && changedBudget) {
      setBusy(false)
      setAlertModal('El presupuesto cambió: la confirmación quedó desmarcada. Confirmá el arreglo de nuevo antes de reparar.')
      return
    }
    const extras = techValue !== (order.assignedTo || '') ? { assignedTo: techValue } : {}
    const res = await setOrderStatus(order.id, effectiveNext, extras)
    setBusy(false)
    if (res.error) setAlertModal(res.error)
    else {
      if (effectiveNext === 'terminado') {
        setPrintOpen(true)
      } else {
        onClose()
      }
    }
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
    setFixList((list) => (list.includes(name) ? list.filter((f) => f !== name) : list.length >= 8 ? list : [...list, name]))

  const onAddCustomFix = () => {
    const v = customFix.trim()
    if (!v) return
    setFixList((list) => (list.includes(v) || list.length >= 8 ? list : [...list, v]))
    setCustomFix('')
  }

  const btnPrimary =
    'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50'
  const btnGhost =
    'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'

  const phones = [customer?.phone, customer?.phone2, customer?.phone3].filter(Boolean)
  const accessories = (order.accessories || '').split(',').map((a) => a.trim()).filter(Boolean)
  const conditions = (order.conditions || '').split(',').map((c) => c.trim()).filter(Boolean)
  const notesLog = order.notesLog || []

  // Para pasar de "En revisión" a "Presupuesto" hace falta al menos una reparación registrada.
  const hasRepair = (fixValue || order.fix || '').trim().length > 0
  const missingRepair = order.status === 'en_revision' && next === 'presupuesto' && !hasRepair

  return (
    <>
    <Modal
      open
      onClose={onClose}
      maxWidth="max-w-3xl"
      title={
        <span className="flex flex-wrap items-center gap-2">
          <span>{order.orderNumber} · {order.brand} {order.model}</span>
          <span className="text-xs text-slate-400">{order.deviceType || 'Celular'}</span>
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
        </span>
      }
    >
      <div className="space-y-6">

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

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div className="flex flex-col gap-4">
              <div>
                <label className={labelCls}>PIN / contraseña del equipo</label>
                {order.noPin ? (
                  <p className="text-sm italic text-slate-400">El cliente no proporcionó contraseña</p>
                ) : (
                  <input type="text" value={order.pin || ''} readOnly disabled className={inputCls} placeholder="—" />
                )}
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
            {canBudget && (
              <button onClick={doConfirm} disabled={busy} className={btnGhost} title={!order.confirmed && !order.notified ? 'Avisá al cliente antes de confirmar el arreglo' : ''}>
                {order.confirmed ? 'Desmarcar' : 'Confirmar arreglo'}
              </button>
            )}
          </div>
        )}

        {/* Reparación */}
        <section>
          <p className="mb-3 border-b border-slate-200 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700">
            Reparación
          </p>

          {/* Técnico y arreglo */}
          <div className="flex flex-col gap-3 md:flex-row md:gap-4">
            {!isReadOnly && (
            <div className="md:w-48 md:shrink-0">
              <span className={labelCls}>Técnico encargado</span>
              <div className="mt-1">
                <TechnicianSelect order={order} value={techValue} onChange={setTechValue} />
              </div>
              {['en_revision', 'en_reparacion'].includes(order.status) && (
              <div className="mt-3">
                <span className={labelCls}>Notas del técnico</span>
                <div className="mt-1">
                  <button
                    onClick={() => setNotesModalOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-primary-700"
                  >
                    <StickyNote size={15} />
                    Agregar nota{notesLog.length > 0 ? ` (${notesLog.length})` : ''}
                  </button>
                </div>
              </div>
              )}
            </div>
            )}

          {/* Arreglo */}
          <div className="flex-1 min-w-0">
              {editingWork ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <span className={labelCls}>Tipo de reparación</span>
                    <button type="button" onClick={cancelEdit} disabled={busy} className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-2 py-1 text-xs font-semibold text-red-600 transition hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-500/10">
                      <X size={13} /> Cancelar
                    </button>
                  </div>
                  {canEditWork && !isReadOnly && (
                  <div className="flex flex-wrap items-center gap-2">
                    {fixOptions.map((f) => (
                      <button
                        key={f}
                        type="button"
                        onClick={() => toggleFix(f)}
                        className={fixList.includes(f) ? chipSelected : chipIdle}
                      >
                        {f}
                      </button>
                    ))}
                    {fixList.filter((f) => !fixOptions.includes(f)).map((f) => (
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
                  )}
                  {canBudget && !isReadOnly && (
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
                  )}
                  <div className="mt-1">
                    <button
                      type="button"
                      onClick={saveOnly}
                      disabled={busy || !workDirty}
                      className={btnPrimary}
                    >
                      <Check size={14} />
                      Guardar
                    </button>
                  </div>
                </div>
              ) : (
                (order.status !== 'recibido' || order.assignedTo) && (
                <div>
                  <span className={labelCls}>Tipo de reparación</span>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    {displayedFixes.length > 0 ? (
                      displayedFixes.map((f) => (
                        <span key={f} className={chipReadonly}>{f}</span>
                      ))
                    ) : fixLocked ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                        <Lock size={12} /> Asigná un técnico y pasá a revisión
                      </span>
                    ) : (
                      <span className={chipReadonly}>Sin definir</span>
                    )}
                    {!fixLocked && (canEditWork || canBudget) && !isReadOnly && ['en_revision', 'en_reparacion'].includes(order.status) && (
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
                  {(Number(order.price) > 0 || Number(order.advance) > 0) && (
                    <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      {Number(order.price) > 0 && (
                        <label className="block">
                          <span className={labelCls}>Presupuesto</span>
                          <p className="rounded-lg bg-slate-100 px-3 py-2 text-base font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {formatMoney(order.price)}
                          </p>
                        </label>
                      )}
                      {Number(order.advance) > 0 && (
                        <label className="block">
                          <span className={labelCls}>Seña</span>
                          <p className="rounded-lg bg-slate-100 px-3 py-2 text-base font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {formatMoney(order.advance)}
                          </p>
                        </label>
                      )}
                    </div>
                  )}
                </div>
                )
              )}
            </div>
          </div>

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
              <ChevronDown size={13} className={`ml-1 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
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
          {canBudget && !isReadOnly && ['presupuesto', 'terminado'].includes(order.status) && (
            <button onClick={doNotify} disabled={busy} className={btnGhost}>
              {order.notified ? <BellOff size={14} /> : <Bell size={14} />}
              {order.notified ? 'Desmarcar avisado' : 'Marcar avisado'}
            </button>
          )}
          <button
            onClick={() => navigate(`/ordenes/${order.id}`)}
            className="inline-flex items-center gap-2 rounded-lg border border-primary-200 px-4 py-2.5 text-sm font-semibold text-primary-600 transition hover:bg-primary-50 dark:border-primary-500/30 dark:text-primary-400 dark:hover:bg-primary-500/10"
          >
            Ver orden completa
            <ArrowRight size={16} />
          </button>
          {effectiveNext && !isReadOnly && (
            <button
              onClick={finish}
              disabled={busy || lockedBudget || missingRepair || missingTech}
              className={`ml-auto ${lockedBudget || missingRepair || missingTech ? '!cursor-not-allowed !bg-slate-300 !text-slate-500' : ''} ${btnPrimary} !px-5 !py-2.5 !text-sm`}
              title={lockedBudget ? 'El cliente debe confirmar el arreglo antes de reparar' : missingTech ? 'Asigná un técnico antes de iniciar la reparación' : missingRepair ? 'Registrá al menos una reparación antes de pasar a presupuesto' : ''}
            >
              {lockedBudget || missingRepair || missingTech ? <Lock size={15} /> : <ChevronRight size={15} />}
              {effectiveLabel}
            </button>
          )}
        </div>
      </div>
    </Modal>
    <ConfirmModal
      open={!!alertModal}
      onClose={() => setAlertModal(null)}
      onConfirm={() => setAlertModal(null)}
      title="Aviso"
      message={alertModal}
      type="alert"
    />
    <NotesModal
      open={notesModalOpen}
      onClose={() => setNotesModalOpen(false)}
      notesLog={notesLog}
      isAssignedTech={!isReadOnly}
      currentUser={currentUser}
      onSave={saveNote}
      onEdit={(noteId, text) => editNote(order.id, noteId, text)}
      onDelete={(noteId) => deleteNote(order.id, noteId)}
    />
    <PrintOrderPanel
      open={printOpen}
      order={order}
      customer={customer}
      onClose={() => { setPrintOpen(false); onClose() }}
    />
    </>
  )
}