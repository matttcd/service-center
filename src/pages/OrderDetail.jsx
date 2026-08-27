// ============================================
// OrderDetail: detalle completo de una orden, unificado en un solo elemento
// (mismo esquema visual que el modal del taller y el formulario).
// ============================================
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft, Printer, Trash2, Play, Search, Check, CheckCircle2, FileText,
  PackageCheck, PackageX, RotateCcw, Sticker, Save, Phone, BellRing,
  Lock, Smartphone, User, X, Pencil, MoreVertical, StickyNote, History, ChevronDown,
} from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { api } from '../utils/api.js'
import { loadSession } from '../utils/storage.js'
import Card from '../components/Card.jsx'
import Badge from '../components/Badge.jsx'
import TechnicianSelect from '../components/TechnicianSelect.jsx'
import NotesModal from '../components/NotesModal.jsx'
import OrderPrint from '../components/OrderPrint.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import PickupModal from '../components/PickupModal.jsx'
import PatternPad, { PatternPreview } from '../components/PatternPad.jsx'
import {
  ORDER_STATUS_LABEL,
  orderStatusTone,
  formatDate,
  formatDateTime,
  formatMoney,
  titleCase,
  sentenceCase,
  normalizeList,
} from '../utils/helpers.js'
import { COMMON_FIXES } from '../utils/constants.js'

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
  const { orders, customers, loading, setOrderStatus, updateOrder, toggleNotified, confirmOrder, printLabel, deleteOrder, editNote, deleteNote } = useData()
  const [printing, setPrinting] = useState(false)
  const [busy, setBusy] = useState(null)
  const [notice, setNotice] = useState('')
  const noticeTimer = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [pickupModal, setPickupModal] = useState(null)

  // Edición de equipo
  const [editingEquip, setEditingEquip] = useState(false)
  const [equipBrand, setEquipBrand] = useState('')
  const [equipModel, setEquipModel] = useState('')
  const [equipPin, setEquipPin] = useState('')
  const [equipPattern, setEquipPattern] = useState([])
  const [equipAccessories, setEquipAccessories] = useState('')
  const [equipConditions, setEquipConditions] = useState('')
  const [equipIssue, setEquipIssue] = useState('')

  // Edición de reparación (recepción/admin: técnico + precio)
  const [editingRepair, setEditingRepair] = useState(false)
  const [repairPriceText, setRepairPriceText] = useState('')

  // Edición de arreglo (técnico asignado: fix)
  const [editingFix, setEditingFix] = useState(false)
  const [fixList, setFixList] = useState([])
  const [fixCustom, setFixCustom] = useState('')

  // Notas del técnico
  const [notesModalOpen, setNotesModalOpen] = useState(false)

  // Orden en modo "override" local: cuando el bootstrap deja de traer una orden
  // entregada (las entregadas se filtran para no saturar la red), la seguimos
  // mostrando trayéndola directo por GET /api/orders/:id.
  const [localOrder, setLocalOrder] = useState(null)

  const order = localOrder || orders.find((o) => o.id === id)
  const customer = customers.find((c) => c.id === order?.customerId)
  const role = currentUser?.role
  const isAdmin = role === 'admin'
  const isTech = role === 'tecnico'
  const isCounter = role === 'recepcion' || role === 'admin'
  const isAssignedTech = isTech && order?.assignedTo === currentUser?.id

  useEffect(() => {
    setLocalOrder(null)
    // Si la orden no está en el bootstrap (las entregadas se filtran para no
    // saturar la red), la traemos directo por id para poder seguir viéndola.
    if (!loading && !orders.some((o) => o.id === id)) {
      let active = true
      api(`/orders/${id}`)
        .then((r) => { if (active) setLocalOrder(r.order) })
        .catch(() => { if (active) setLocalOrder(null) })
      return () => { active = false }
    }
  }, [id, loading, orders])

  useEffect(() => {
    if (!order) return
    setEditingEquip(false)
    setEditingRepair(false)
    setEditingFix(false)
    setNotice('')
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
      if (next === 'entregado') {
        showNotice('Equipo entregado.')
        const fresh = await api(`/orders/${order.id}`)
        setLocalOrder(fresh.order)
      } else if (next === 'terminado') showNotice('Equipo marcado como listo. Avisale al cliente.')
      else showNotice('Estado actualizado.')
    } finally {
      setBusy(null)
    }
  }

  const handleRetiro = async () => {
    setBusy('retiro')
    const res = await setOrderStatus(order.id, 'entregado', { retiro: true })
    if (res.error) {
      showNotice(res.error)
    } else {
      showNotice('Equipo retirado por el cliente.')
      const fresh = await api(`/orders/${order.id}`)
      setLocalOrder(fresh.order)
    }
    setBusy(null)
  }

  const handlePrintPickup = async () => {
    try {
      const session = loadSession()
      const headers = {}
      if (session?.token) headers.Authorization = `Bearer ${session.token}`
      const res = await fetch(`/api/orders/${order.id}/pickup-pdf`, { headers })
      if (!res.ok) throw new Error('No se pudo generar el PDF')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      window.open(url, '_blank')
    } catch {
      showNotice('No se pudo generar la constancia de retiro.')
    }
  }

  const handleGarantia = async () => {
    setBusy('recibido')
    const res = await setOrderStatus(order.id, 'recibido')
    showNotice(res.error ? res.error : 'Equipo reingresado por garantía.')
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
    const res = await deleteOrder(order.id)
    if (!res.error) navigate('/ordenes')
    else showNotice(res.error)
  }

  // ─── Equipo: abrir/cerrar edición ───
  const startEditEquip = () => {
    setEquipBrand(order.brand || '')
    setEquipModel(order.model || '')
    setEquipPin(order.pin || '')
    setEquipPattern(order.pattern || [])
    setEquipAccessories(order.accessories || '')
    setEquipConditions(order.conditions || '')
    setEquipIssue(order.issue || '')
    setEditingEquip(true)
  }
  const cancelEditEquip = () => setEditingEquip(false)
  const saveEditEquip = async () => {
    setBusy('equip')
    const res = await updateOrder(order.id, {
      brand: titleCase(equipBrand), model: titleCase(equipModel), pin: equipPin,
      pattern: equipPattern, accessories: equipAccessories, conditions: equipConditions, issue: equipIssue,
    })
    if (!res.error) { setEditingEquip(false); showNotice('Equipo actualizado.') } else showNotice(res.error)
    setBusy(null)
  }

  // ─── Reparación: abrir/cerrar edición (recepción/admin: técnico + precio) ───
  const startEditRepair = () => {
    setRepairPriceText(order.price ? String(order.price) : '')
    setEditingRepair(true)
  }
  const cancelEditRepair = () => setEditingRepair(false)
  const saveEditRepair = async () => {
    setBusy('repair')
    const res = await updateOrder(order.id, { price: Number(repairPriceText) || 0 })
    if (!res.error) { setEditingRepair(false); showNotice('Reparación actualizada.') } else showNotice(res.error)
    setBusy(null)
  }

  // ─── Arreglo: abrir/cerrar edición (técnico asignado: fix) ───
  const startEditFix = () => {
    setFixList((order.fix || '').split(',').map((s) => s.trim()).filter(Boolean))
    setFixCustom('')
    setEditingFix(true)
  }
  const cancelEditFix = () => setEditingFix(false)
  const toggleFix = (name) => setFixList((l) => l.includes(name) ? l.filter((f) => f !== name) : [...l, name])
  const addCustomFix = () => {
    const v = fixCustom.trim()
    if (!v) return
    setFixList((l) => (l.includes(v) ? l : [...l, v]))
    setFixCustom('')
  }
  const saveEditFix = async () => {
    const fix = [...fixList, fixCustom.trim()].filter(Boolean).map((f) => titleCase(f)).join(', ')
    setBusy('fix')
    const res = await updateOrder(order.id, { fix })
    if (!res.error) { setEditingFix(false); showNotice('Tipo de reparación actualizado.') } else showNotice(res.error)
    setBusy(null)
  }

  // ─── Notas del técnico: guardar (append) ───
  const saveNote = async (text) => {
    setBusy('note')
    const res = await updateOrder(order.id, { note: text })
    if (!res.error) showNotice('Nota guardada.'); else showNotice(res.error)
    setBusy(null)
  }

  const btnPrimary =
    'inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-700 disabled:opacity-50'
  const btnGhost =
    'inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
  const btnDisabled =
    'inline-flex items-center gap-1.5 rounded-lg bg-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400'
  const chipReadonly =
    'inline-flex items-center rounded-full border border-slate-400 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200'
  const chipSelected =
    'inline-flex items-center gap-1 rounded-full bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-primary-700'
  const chipIdle =
    'inline-flex items-center gap-1 rounded-full border border-slate-400 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-200 dark:border-slate-500 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600'
  const inputCls =
    'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white'
  const labelCls = 'mb-1 block text-xs font-semibold text-slate-500 dark:text-slate-400'
  const sectionHead =
    'border-b border-slate-200 pb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:border-slate-700'

  const accessories = (order.accessories || '').split(',').map((a) => a.trim()).filter(Boolean)
  const conditions = (order.conditions || '').split(',').map((c) => c.trim()).filter(Boolean)
  const displayedFixes = (order.fix || '').split(',').map((f) => f.trim()).filter(Boolean)
  const notesLog = order.notesLog || []

  const menuItems = []
  if (isCounter && status !== 'entregado') {
    menuItems.push({ key: 'retiro', label: 'Retirar equipo', Icon: PackageCheck, onClick: () => { setMenuOpen(false); setPickupModal({ onConfirm: handleRetiro }) } })
    menuItems.push({ key: 'retiro-sin-orden', label: 'Retirar sin orden', Icon: PackageCheck, onClick: () => { setMenuOpen(false); setPickupModal({ onConfirm: handleRetiro, mode: 'sin-orden' }) } })
  }
  if (isCounter && status === 'entregado') {
    menuItems.push({ key: 'reprint-pickup', label: 'Reimprimir constancia', Icon: Printer, onClick: () => { setMenuOpen(false); handlePrintPickup() } })
  }
  if (isAdmin) {
    menuItems.push({ key: 'delete', label: 'Eliminar', Icon: Trash2, danger: true, onClick: () => { setMenuOpen(false); setConfirm({ title: 'Eliminar orden', message: `¿Eliminar la orden ${order.orderNumber}? Esta acción no se puede deshacer.`, onConfirm: handleDelete, danger: true }) } })
  }

  return (
    <div className="space-y-6">
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
      >
        <ArrowLeft size={16} />
        Volver
      </button>

      {notice && (
        <p className="rounded-lg bg-primary-50 px-3 py-2 text-sm text-primary-700 dark:bg-primary-500/10 dark:text-primary-300">
          {notice}
        </p>
      )}

      <Card className="overflow-hidden">
        {/* Encabezado */}
        <div className="px-6 py-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{order.orderNumber}</h1>
                <Badge tone={order.diagnosisType === 'revision' ? 'primary' : 'slate'}>
                  {order.diagnosisType === 'revision' ? 'Revisión' : 'Reparación'}
                </Badge>
                <Badge tone={orderStatusTone(status)}>{ORDER_STATUS_LABEL[status]}</Badge>
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                <span>Recibió {titleCase(order.receivedByName)} · {formatDate(order.createdAt)}</span>
                {['presupuesto', 'terminado'].includes(status) && (
                  <span className="flex items-center gap-1">
                    {order.notified ? <CheckCircle2 size={13} className="text-emerald-500" /> : <BellRing size={13} className="text-amber-500" />}
                    {order.notified ? 'Avisado' : 'Sin avisar'}
                  </span>
                )}
                {order.confirmed && (
                  <span className="flex items-center gap-1">
                    <CheckCircle2 size={13} className="text-emerald-500" />
                    Confirmado
                  </span>
                )}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={async () => {
                  const res = await printLabel(order.id)
                  showNotice(res.error ? res.error : 'Etiqueta enviada a la impresora.')
                }}
                className={`${btnGhost} !px-3 !py-1.5 !text-xs`}
              >
                <Sticker size={14} />
                Imprimir etiqueta
              </button>
              <button onClick={() => setPrinting(true)} className={`${btnPrimary} !px-3 !py-1.5 !text-xs`}>
                <Printer size={14} />
                Imprimir orden
              </button>
              {menuItems.length > 0 && (
                <div className="relative">
                  <button onClick={() => setMenuOpen(!menuOpen)} className={btnGhost}><MoreVertical size={14} /></button>
                  {menuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                      <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-800">
                        {menuItems.map((item) => (
                          <button key={item.key} onClick={item.onClick} disabled={busy === item.key}
                            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-700 ${item.danger ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>
                            <item.Icon size={14} /> {item.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <div className="flex flex-col gap-1 text-sm">
                <p className="text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400">DNI:</span> {customer?.dni || '—'}
                </p>
                <p className="text-slate-600 dark:text-slate-300">
                  <span className="text-slate-400">Domicilio:</span> {customer?.address || '—'}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Detalles del equipo */}
        <section>
          <div className="px-6 pb-2 pt-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 dark:border-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Detalles del equipo</p>
              {isCounter && status !== 'entregado' && !editingEquip && (
                <button onClick={startEditEquip} className="inline-flex items-center gap-1 rounded-lg border border-primary-200 px-2 py-0.5 text-xs font-semibold text-primary-600 transition hover:bg-primary-50 dark:border-primary-500/30 dark:text-primary-400 dark:hover:bg-primary-500/10">
                  <Pencil size={12} /> Editar
                </button>
              )}
            </div>
          </div>
          <div className="px-6 py-4">
            {editingEquip ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>Marca</label>
                    <input value={equipBrand} onChange={(e) => setEquipBrand(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Modelo</label>
                    <input value={equipModel} onChange={(e) => setEquipModel(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className={labelCls}>PIN / contraseña</label>
                    <input value={equipPin} onChange={(e) => setEquipPin(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Patrón de desbloqueo</label>
                    <PatternPad value={equipPattern} onChange={setEquipPattern} />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Accesorios (separados por coma)</label>
                  <input value={equipAccessories} onChange={(e) => setEquipAccessories(e.target.value)} className={inputCls} placeholder="Funda, cargador..." />
                </div>
                <div>
                  <label className={labelCls}>Estado del equipo (separados por coma)</label>
                  <input value={equipConditions} onChange={(e) => setEquipConditions(e.target.value)} className={inputCls} placeholder="Roto, golpeado..." />
                </div>
                <div>
                  <label className={labelCls}>Chequeos / notas generales</label>
                  <textarea value={equipIssue} onChange={(e) => setEquipIssue(e.target.value)} rows={3} className={inputCls} />
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={saveEditEquip} disabled={busy === 'equip'} className={btnPrimary}><Save size={14} /> Guardar</button>
                  <button onClick={cancelEditEquip} className={btnGhost}>Cancelar</button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2 pb-2 text-base">
                  <Smartphone size={15} className="shrink-0 text-slate-400" />
                  <span className="truncate font-semibold text-slate-900 dark:text-white">
                    {titleCase(order.brand)} {titleCase(order.model)}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className={labelCls}>Con accesorios</label>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {accessories.length > 0 ? (
                          accessories.map((a) => <span key={a} className={chipReadonly}>{a}</span>)
                        ) : <span className="text-sm text-slate-400">Sin accesorios</span>}
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Estado del equipo</label>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        {conditions.length > 0 ? (
                          conditions.map((c) => <span key={c} className={chipReadonly}>{c}</span>)
                        ) : <span className="text-sm text-slate-400">Sin estado registrado</span>}
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Chequeos / notas generales</label>
                      <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {order.issue ? sentenceCase(order.issue) : '—'}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col gap-4">
                    <div>
                      <label className={labelCls}>PIN / contraseña del equipo</label>
                      {order.pin ? (
                        <p className="inline-block rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                          {order.pin}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-400">Sin PIN / contraseña</p>
                      )}
                    </div>
                    <div>
                      <label className={labelCls}>Patrón de desbloqueo</label>
                      <div className="flex items-center py-1">
                        {order.pattern?.length > 0 ? (
                          <PatternPreview value={order.pattern} size={140} className="h-full w-auto" />
                        ) : (
                          <span className="text-sm text-slate-400">Sin patrón configurado</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Reparación */}
        <section>
          <div className="px-6 pb-2 pt-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5 dark:border-slate-700">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">Reparación</p>
              {isCounter && status !== 'entregado' && !editingRepair && (
                <button onClick={startEditRepair} className="inline-flex items-center gap-1 rounded-lg border border-primary-200 px-2 py-0.5 text-xs font-semibold text-primary-600 transition hover:bg-primary-50 dark:border-primary-500/30 dark:text-primary-400 dark:hover:bg-primary-500/10">
                  <Pencil size={12} /> Editar
                </button>
              )}
            </div>
          </div>
          <div className="px-6 py-4">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="space-y-3">
                <div>
                  <label className={labelCls}>Técnico encargado</label>
                  {editingRepair ? (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {isAdmin && <TechnicianSelect order={order} onChanged={() => showNotice('Técnico asignado.')} />}
                      <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                        {order.assignedToName || '—'}
                      </p>
                    </div>
                  ) : (
                    <p className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                      {order.assignedToName || '—'}
                    </p>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <label className={labelCls}>Tipo de reparación</label>
                    {isAssignedTech && !editingFix && ['en_revision', 'presupuesto'].includes(status) && (
                      <button onClick={startEditFix} className="inline-flex items-center gap-1 rounded-lg border border-primary-200 px-2 py-0.5 text-xs font-semibold text-primary-600 transition hover:bg-primary-50 dark:border-primary-500/30 dark:text-primary-400 dark:hover:bg-primary-500/10">
                        <Pencil size={12} /> Editar arreglo
                      </button>
                    )}
                  </div>
                  {editingFix ? (
                    <div className="space-y-3 pt-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {COMMON_FIXES.map((f) => (
                          <button key={f} type="button" onClick={() => toggleFix(f)} className={fixList.includes(f) ? chipSelected : chipIdle}>{f}</button>
                        ))}
                        {fixList.filter((f) => !COMMON_FIXES.includes(f)).map((f) => (
                          <span key={f} className={chipReadonly}>
                            {f}
                            <button type="button" onClick={() => toggleFix(f)} aria-label={`Quitar ${f}`} className="transition hover:text-red-500"><X size={12} /></button>
                          </span>
                        ))}
                        <span className="flex items-center gap-1">
                          <input type="text" value={fixCustom} onChange={(e) => setFixCustom(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomFix() } }}
                            placeholder="Otro arreglo..." className={`${inputCls} !w-36`} />
                          <button type="button" onClick={addCustomFix} className={chipIdle}><Check size={13} /></button>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={saveEditFix} disabled={busy === 'fix'} className={btnPrimary}><Save size={14} /> Guardar</button>
                        <button onClick={cancelEditFix} className={btnGhost}>Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {displayedFixes.length > 0 ? (
                        displayedFixes.map((f) => <span key={f} className={chipReadonly}>{f}</span>)
                      ) : <span className="text-sm text-slate-400">Sin definir</span>}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className={labelCls}>{editingRepair ? 'Presupuesto ($)' : 'Presupuesto'}</label>
                  {editingRepair ? (
                    <input type="number" min="0" step="0.01" value={repairPriceText} onChange={(e) => setRepairPriceText(e.target.value)} className={inputCls} />
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

              <div>
                <label className={labelCls}>Notas del técnico</label>
                <div className="mt-1">
                  <button
                    onClick={() => setNotesModalOpen(true)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                      isAssignedTech
                        ? 'bg-primary-600 text-white hover:bg-primary-700'
                        : 'border border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800'
                    }`}
                  >
                    {!isAssignedTech ? <History size={15} /> : <StickyNote size={15} />}
                    {!isAssignedTech ? `Ver notas${notesLog.length > 0 ? ` (${notesLog.length})` : ''}` : `Agregar nota${notesLog.length > 0 ? ` (${notesLog.length})` : ''}`}
                  </button>
                </div>
              </div>
            </div>

              {editingRepair && (
                <div className="mt-4 flex items-center gap-2">
                  <button onClick={saveEditRepair} disabled={busy === 'repair'} className={btnPrimary}><Save size={14} /> Guardar</button>
                  <button onClick={cancelEditRepair} className={btnGhost}>Cancelar</button>
                </div>
              )}

              {/* Acciones según el estado */}
            <div className="mt-5 flex flex-wrap items-center justify-end gap-2">

              {/* === ACCIONES RECEPCIÓN / ADMIN === */}
              {isCounter && status === 'presupuesto' && !order.notified && !order.price && (
                <p key="no-price" className="flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
                  <FileText size={14} className="text-amber-500" />
                  Cargá el presupuesto antes de avisar al cliente.
                </p>
              )}
              {isCounter && status === 'presupuesto' && !order.notified && order.price && (
                <button key="avisar" onClick={handleNotified} disabled={busy === 'notified'} className={btnPrimary}>
                  <BellRing size={16} />
                  Avisar al cliente
                </button>
              )}
              {isCounter && status === 'presupuesto' && order.notified && !order.confirmed && (
                <div key="confirm" className="flex flex-wrap items-center gap-2">
                  <button onClick={() => setConfirm({ title: 'Confirmar', message: '¿El cliente aprobó el presupuesto?', onConfirm: handleConfirm })} disabled={busy === 'confirm'} className={btnPrimary}>
                    <CheckCircle2 size={16} />
                    Aceptó
                  </button>
                  <button onClick={() => setPickupModal({ onConfirm: () => doStatus('entregado') })} disabled={busy === 'entregado'} className={btnGhost}>
                    Rechazó
                  </button>
                </div>
              )}
              {isCounter && status === 'presupuesto' && order.notified && order.confirmed && (
                <p key="wait" className="flex items-center gap-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
                  <Lock size={14} className="text-amber-500" />
                  Esperando reparación del técnico...
                </p>
              )}
              {isCounter && status === 'terminado' && !order.notified && (
                <button key="avisar2" onClick={handleNotified} disabled={busy === 'notified'} className={btnPrimary}>
                  <BellRing size={16} />
                  Avisar al cliente
                </button>
              )}
              {isCounter && status === 'terminado' && order.notified && (
                <button key="entregar" onClick={() => setPickupModal({ onConfirm: () => doStatus('entregado') })} disabled={busy === 'entregado'} className={btnPrimary}>
                  <PackageCheck size={16} />
                  Entregar al cliente
                </button>
              )}
              {isCounter && status === 'entregado' && (
                <button onClick={() => setConfirm({ title: 'Garantía', message: '¿Reingresar el equipo por garantía? Aparecerá en Entrantes.', onConfirm: handleGarantia })} disabled={busy === 'recibido'} className={btnGhost}>
                  <RotateCcw size={16} />
                  Reingresar por garantía
                </button>
              )}

              {/* === ACCIONES DEL TÉCNICO === */}
              {status === 'recibido' && order.diagnosisType === 'visible' && isTech && (
                <button
                  onClick={() => doStatus('en_reparacion')}
                  disabled={busy === 'en_reparacion' || !order.assignedTo}
                  title={!order.assignedTo ? 'Asigná un técnico antes de iniciar la reparación' : ''}
                  className={!order.assignedTo ? btnDisabled : btnPrimary}
                >
                  <Play size={16} />
                  Iniciar reparación
                </button>
              )}
              {status === 'recibido' && order.diagnosisType === 'revision' && isTech && (
                <button
                  onClick={() => doStatus('en_revision')}
                  disabled={busy === 'en_revision' || !order.assignedTo}
                  title={!order.assignedTo ? 'Asigná un técnico antes de iniciar la revisión' : ''}
                  className={!order.assignedTo ? btnDisabled : btnPrimary}
                >
                  <Search size={16} />
                  Iniciar revisión
                </button>
              )}
              {status === 'en_revision' && isTech && (
                <button
                  onClick={() => doStatus('presupuesto')}
                  disabled={busy === 'presupuesto' || !(order.fix || '').trim()}
                  title={!(order.fix || '').trim() ? 'Registrá al menos una reparación antes de pasar a presupuesto' : ''}
                  className={!(order.fix || '').trim() ? btnDisabled : btnPrimary}
                >
                  <Play size={16} />
                  Cargar presupuesto
                </button>
              )}
              {status === 'presupuesto' && isTech && (
                <button
                  onClick={() => doStatus('en_reparacion')}
                  disabled={busy === 'en_reparacion' || !order.confirmed || !order.assignedTo}
                  title={!order.confirmed ? 'El cliente debe confirmar el arreglo antes de reparar' : !order.assignedTo ? 'Asigná un técnico antes de iniciar la reparación' : ''}
                  className={(!order.confirmed || !order.assignedTo) ? btnDisabled : btnPrimary}
                >
                  <Play size={16} />
                  Aceptó → reparar
                </button>
              )}
              {status === 'en_reparacion' && isTech && (
                <>
                  <button onClick={() => doStatus('terminado')} disabled={busy === 'terminado'} className={btnPrimary}>
                    <CheckCircle2 size={16} />
                    Marcar terminado (listo)
                  </button>
                  <button onClick={() => doStatus('falta_repuestos')} disabled={busy === 'falta_repuestos'} className={btnGhost}>
                    <PackageX size={16} />
                    Falta de repuestos
                  </button>
                </>
              )}
              {status === 'falta_repuestos' && isTech && (
                <button onClick={() => doStatus('en_reparacion')} disabled={busy === 'en_reparacion'} className={btnPrimary}>
                  <Play size={16} />
                  Repuestos llegaron
                </button>
              )}
              {status === 'terminado' && isTech && (
                <button onClick={() => doStatus('en_reparacion')} disabled={busy === 'en_reparacion'} className={btnGhost}>
                  <RotateCcw size={16} />
                  Volver a reparación
                </button>
              )}
            </div>
          </div>
        </section>

        {/* Separador */}
        <div className="mx-6 border-t border-slate-200 dark:border-slate-700" />

        {/* Historial */}
        {(order.history || []).length > 0 && (
          <section className="mb-8">
            <div className="px-6 pb-2 pt-5">
              <button
                onClick={() => setShowHistory((s) => !s)}
                className="flex w-full items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-300"
              >
                <History size={13} />
                Historial
                <ChevronDown size={13} className={`ml-1 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
                <span className="ml-auto text-slate-300 dark:text-slate-600">{order.history.length} eventos</span>
              </button>
            </div>
            {showHistory && (
            <div className="px-6 py-4">
              {(order.history || []).map((h, idx) => {
                const isLast = idx === (order.history || []).length - 1
                return (
                  <div key={idx} className="flex gap-3">
                    <div className="flex w-3 flex-col items-center">
                      <div className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                        isLast ? 'bg-primary-500' : 'bg-slate-300 dark:bg-slate-600'
                      }`} />
                      <div className={`w-px flex-1 ${isLast ? 'bg-transparent' : 'bg-slate-200 dark:bg-slate-700'}`} />
                    </div>
                    <div className={`min-w-0 flex-1 -mt-2 ${isLast ? '' : 'pb-5'}`}>
                      <p className={`text-sm font-semibold ${isLast ? 'text-primary-600 dark:text-primary-400' : 'text-slate-700 dark:text-slate-300'}`}>
                        {ORDER_STATUS_LABEL[h.status] || h.status}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                        {h.byName || '—'} · {formatDateTime(h.at)}
                      </p>
                      {h.note && (
                        <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{h.note}</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            )}
          </section>
        )}
      </Card>

      <OrderPrint open={printing} order={order} customer={customer} onClose={() => setPrinting(false)} />
      <ConfirmModal
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={confirm?.onConfirm}
        title={confirm?.title}
        message={confirm?.message}
        danger={confirm?.danger}
      />
      <PickupModal
        open={!!pickupModal}
        onClose={() => setPickupModal(null)}
        onConfirm={pickupModal?.onConfirm}
        order={order}
        mode={pickupModal?.mode || 'normal'}
      />

      {/* Modal de notas del técnico */}
      <NotesModal
        open={notesModalOpen}
        onClose={() => setNotesModalOpen(false)}
        notesLog={notesLog}
        isAssignedTech={isAssignedTech}
        currentUser={currentUser}
        onSave={saveNote}
        onEdit={(noteId, text) => editNote(order.id, noteId, text)}
        onDelete={(noteId) => deleteNote(order.id, noteId)}
      />
    </div>
  )
}