import OrderActionsMenu from '../components/OrderActionsMenu.jsx'
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Printer, Trash2, Check, PackageCheck, Package, RotateCcw, Sticker, Save, Pencil, StickyNote, History, Truck, Wrench } from 'lucide-react'
import { useData } from '../context/DataContext.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { useOrderDraft } from '../context/workspace.js'
import { api } from '../utils/api.js'
import { loadSession } from '../utils/storage.js'
import { useNotify } from '../context/notifications.js'
import Modal from '../components/Modal.jsx'
import OrderSheet from '../components/OrderSheet.jsx'
import TechnicianSelect from '../components/TechnicianSelect.jsx'
import NotesModal from '../components/NotesModal.jsx'
import SparePartsModal from '../components/SparePartsModal.jsx'
import PrintOrderPanel from '../components/PrintOrderPanel.jsx'
import ConfirmModal from '../components/ConfirmModal.jsx'
import PickupModal from '../components/PickupModal.jsx'
import PatternPad from '../components/PatternPad.jsx'
import { ORDER_STATUS_LABEL, ROLE_LABEL, formatDateTime, formatMoney, titleCase } from '../utils/helpers.js'
import { equipmentChanges, equipmentEditRequest, rebaseEquipmentEdit } from '../utils/orderEdits.js'
import { COMMON_FIXES } from '../utils/constants.js'
import { DEVICE_TYPES } from '../../shared/fsm.js'
import { orderAmounts, receptionQueue } from '../../shared/order-workspace.js'

const equipmentFields = ['deviceType', 'brand', 'model', 'pin', 'noPin', 'pattern', 'accessories', 'conditions', 'issue']
const equipmentLabels = { deviceType: 'Tipo de dispositivo', brand: 'Marca', model: 'Modelo', pin: 'Contraseña o PIN', noPin: 'Sin contraseña informada', pattern: 'Patrón', accessories: 'Accesorios', conditions: 'Estado del equipo', issue: 'Notas generales' }
const taskTitles = { presupuestar: 'Presupuestar', avisar: 'Avisar al cliente', respuesta: 'Registrar respuesta', repuestos: 'Gestionar repuestos', retiros: 'Registrar retiro', externos: 'Gestionar externo', simples: 'Finalizar servicio' }

export default function OrderDetail({ orderId, embedded = false, technical, onBack }) {
  const params = useParams()
  const id = orderId || params.id
  const navigate = useNavigate()
  const { currentUser } = useAuth()
  const { orders, customers, loading, config, technicians, catalogLists, setOrderStatus, updateOrder, toggleNotified, confirmOrder, printLabel, deleteOrder, editNote, deleteNote, addSparePart, editSparePart, deleteSparePart } = useData()
  const notify = useNotify('info')
  const [draft, patchDraft] = useOrderDraft(`order:${id}`)
  const [localOrder, setLocalOrder] = useState(null)
  const [fetchError, setFetchError] = useState('')
  const [retry, setRetry] = useState(0)
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const workInput = useRef(null)
  const priceInput = useRef(null)
  const equipmentForm = useRef(null)
  const [windowName, setWindowName] = useState(null)
  const [taskSnapshot, setTaskSnapshot] = useState(null)
  const [printOpen, setPrintOpen] = useState(false)
  const [pickup, setPickup] = useState(null)
  const [confirmation, setConfirmation] = useState(null)
  const order = orders.find((item) => item.id === id) || (localOrder?.id === id ? localOrder : null)
  const customer = customers.find((item) => item.id === order?.customerId) || order?.customer
  const isAdmin = currentUser.role === 'admin'
  const counter = ['admin', 'recepcion'].includes(currentUser.role)
  const own = isAdmin || currentUser.role === 'tecnico' && order?.assignedTo === currentUser.id
  const technicianView = technical ?? currentUser.role === 'tecnico'

  useEffect(() => {
    const active = orders.find((item) => item.id === id)
    if (active) { setLocalOrder(active); return }
    if (loading) return
    let live = true
    setFetchError('')
    api(`/orders/${id}`).then((result) => { if (live) setLocalOrder(result.order) }).catch((error) => { if (live) { setFetchError(error.message); if (error.status === 404) setLocalOrder(null) } })
    return () => { live = false }
  }, [orders, id, loading, retry])

  if (!order) return <div className="ws-order ws-empty"><p>{fetchError || 'Cargando orden…'}</p>{fetchError && <button className="ws-button" onClick={() => setRetry((value) => value + 1)}>Reintentar</button>}</div>

  const run = async (operation, success, after) => {
    if (busyRef.current) return { error: 'Hay una operación en curso.' }
    busyRef.current = true; setBusy(true)
    try {
      const result = await operation()
      if (result?.error) { notify({ type: 'error', text: result.error }); return result }
      if (result?.order) setLocalOrder(result.order)
      if (success) notify({ type: 'success', text: success })
      after?.(result)
      return result || { error: null }
    } catch (error) { notify({ type: 'error', text: error.message }); return { error: error.message } }
    finally { busyRef.current = false; setBusy(false) }
  }
  const status = (next, extras = {}, after) => run(() => setOrderStatus(id, next, extras), next === 'entregado' ? 'Equipo entregado.' : 'Estado actualizado.', after)
  const close = () => setWindowName(null)
  const bill = orderAmounts(order)
  const task = receptionQueue(order)
  const finished = order.status === 'entregado'
  const workLocked = order.diagnosisType === 'revision' && !order.fix?.trim() && (!order.assignedTo || order.status !== 'en_revision')
  const taskDraft = { price: String(order.price || ''), basePrice: taskSnapshot?.price ?? order.price, baseFix: taskSnapshot?.fix ?? order.fix, response: 'approve', charge: String(config.revisionFee ?? 0), external: order.externalTech || catalogLists.externalTechnicians[0] || '', ...draft.task }
  const setTask = (fields) => patchDraft({ task: { ...taskDraft, ...fields } })
  const openTask = (name = task) => {
    setTaskSnapshot({ price: order.price, fix: order.fix })
    if (name === 'retiros') { setPickup({ mode: 'normal' }); return }
    setWindowName(name)
  }
  const completeTask = async (event) => {
    event.preventDefault()
    let result
    if (windowName === 'presupuestar' || windowName === 'precio') result = await run(() => updateOrder(id, { price: Number(taskDraft.price), expected: { price: taskDraft.basePrice, fix: taskDraft.baseFix } }), 'Presupuesto guardado.')
    if (windowName === 'avisar') result = await run(() => toggleNotified(id, true), 'Aviso registrado.')
    if (windowName === 'respuesta') result = taskDraft.response === 'reject' ? await status('presupuesto_rechazado', { rejectedCharge: taskDraft.charge }) : await run(() => confirmOrder(id, true), 'Presupuesto aprobado.')
    if (windowName === 'simples') result = await status('terminado')
    if (windowName === 'externos') result = await status(order.status === 'en_tercero' ? 'recibido' : 'en_tercero', order.status === 'en_tercero' ? {} : { externalTech: taskDraft.external })
    if (result && !result.error) { patchDraft({ task: undefined }); close() }
  }
  const startWorkEdit = () => { if (!draft.work) patchDraft({ work: { value: order.fix || '', base: order.fix || '' } }) }
  const saveWork = () => run(() => updateOrder(id, { fix: draft.work.value, expected: { fix: draft.work.base }, sendToBudget: order.status === 'en_reparacion' && draft.work.value !== draft.work.base }), 'Trabajo guardado.', () => patchDraft({ work: undefined }))
  const startEquipmentEdit = () => {
    if (!draft.equipment) { const fields = Object.fromEntries(equipmentFields.map((key) => [key, order[key]])); patchDraft({ equipment: { fields, base: fields } }) }
    setWindowName('equipo')
  }
  const equipment = draft.equipment?.fields || {}
  const setEquipment = (fields) => patchDraft({ equipment: { ...draft.equipment, fields: { ...equipment, ...fields } } })
  const currentEquipment = Object.fromEntries(equipmentFields.map((key) => [key, order[key]]))
  const equipmentConflicts = draft.equipment ? Object.keys(equipmentChanges(draft.equipment.base, equipment)).filter((key) => JSON.stringify(draft.equipment.base[key]) !== JSON.stringify(order[key])) : []
  const saveEquipment = (event) => {
    event.preventDefault()
    const payload = equipmentEditRequest(draft.equipment.base, equipment)
    for (const key of ['brand', 'model']) if (payload[key] !== undefined) payload[key] = titleCase(payload[key])
    if (payload.deviceType !== undefined && !DEVICE_TYPES.includes(payload.deviceType)) payload.deviceType = titleCase(payload.deviceType)
    if (!Object.keys(payload.expected).length) { patchDraft({ equipment: undefined }); close(); return }
    run(() => updateOrder(id, payload), 'Equipo actualizado.', () => { patchDraft({ equipment: undefined }); close() })
  }
  const printPickup = () => run(async () => {
    const session = loadSession()
    const response = await fetch(`/api/orders/${id}/pickup-pdf`, { headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {} })
    if (!response.ok) throw new Error('No se pudo generar la constancia de retiro.')
    const url = URL.createObjectURL(await response.blob()); window.open(url, '_blank'); setTimeout(() => URL.revokeObjectURL(url), 60000)
  })
  const confirm = (title, operation) => { setConfirmation({ title, operation }) }
  const menu = [
    { label: 'Imprimir orden', Icon: Printer, action: () => setPrintOpen(true) },
    { label: 'Imprimir etiqueta', Icon: Sticker, action: () => run(() => printLabel(id), 'Etiqueta enviada a la cola de impresión.') },
    ...(currentUser.role === 'tecnico' && own && !order.acceptedAt && ['en_revision', 'en_reparacion', 'falta_repuestos'].includes(order.status) ? [{ label: 'Aceptar trabajo', Icon: Check, action: () => run(() => api(`/orders/${id}/assign`, { method: 'POST', body: { userId: currentUser.id, accept: true } }), 'Trabajo aceptado.') }] : []),
    ...(counter && !finished ? [{ label: 'Editar datos del equipo', Icon: Pencil, action: startEquipmentEdit }, ...(!order.rejectedAt ? [{ label: 'Editar presupuesto', Icon: Pencil, action: () => openTask('precio') }] : []), { label: 'Asignar técnico', Icon: Wrench, action: () => setWindowName('tecnico') }, { label: 'Retirar equipo', Icon: PackageCheck, action: () => setPickup({ mode: 'normal', early: true }) }, { label: 'Retirar sin orden', Icon: PackageCheck, action: () => setPickup({ mode: 'sin-orden', early: true }) }] : []),
    ...(counter && order.status === 'recibido' ? [{ label: 'Enviar a tercero', Icon: Truck, action: () => openTask('externos') }] : []),
    ...(counter && ['presupuesto', 'terminado'].includes(order.status) && order.notified ? [{ label: 'Desmarcar aviso', Icon: RotateCcw, action: () => confirm('Desmarcar aviso', () => run(() => toggleNotified(id, false), 'Aviso desmarcado.')) }] : []),
    ...(counter && order.confirmed && order.status === 'presupuesto' ? [{ label: 'Desmarcar aprobación', Icon: RotateCcw, action: () => confirm('Desmarcar aprobación', () => run(() => confirmOrder(id, false), 'Aprobación desmarcada.')) }] : []),
    ...(own && order.status === 'en_reparacion' ? [{ label: 'Esperar repuestos', Icon: Package, action: () => confirm('Esperar repuestos', () => status('falta_repuestos')) }] : []),
    ...(own && order.status === 'terminado' ? [{ label: 'Volver a reparación', Icon: Wrench, action: () => confirm('Volver a reparación', () => status('en_reparacion')) }] : []),
    ...(counter && finished ? [{ label: 'Reimprimir constancia', Icon: Printer, action: printPickup }, { label: 'Reingresar por garantía', Icon: RotateCcw, action: () => confirm('Reingresar por garantía', () => status('recibido')) }] : []),
    ...(isAdmin ? [{ label: 'Eliminar', Icon: Trash2, action: () => confirm('Mover orden a la papelera', () => run(() => deleteOrder(id), 'Orden eliminada.', () => navigate('/ordenes'))) }] : []),
  ]
  let technicalAction
  if (technicianView) {
    const canTake = !order.assignedTo || own
    if (['admin', 'tecnico'].includes(currentUser.role) && canTake && (order.status === 'recibido' || order.status === 'presupuesto' && order.confirmed)) technicalAction = { label: order.diagnosisType === 'revision' && order.status === 'recibido' ? 'Tomar e iniciar revisión' : 'Iniciar reparación', next: order.diagnosisType === 'revision' && order.status === 'recibido' ? 'en_revision' : 'en_reparacion' }
    if (own && order.status === 'en_revision') technicalAction = { label: 'Enviar a recepción', next: 'presupuesto', disabled: !order.fix?.trim() }
    if (own && order.status === 'en_reparacion') technicalAction = { label: 'Finalizar reparación', next: 'terminado' }
    if (own && order.status === 'falta_repuestos') technicalAction = { label: 'Retomar reparación', next: 'en_reparacion' }
  }
  const advanceWork = () => {
    if (!technicalAction) return
    const assignedTo = order.assignedTo || (currentUser.role === 'tecnico' ? currentUser.id : draft.technician)
    if (!assignedTo) { setWindowName('tomar'); return }
    status(technicalAction.next, order.assignedTo ? {} : { assignedTo }, () => { patchDraft({ technician: undefined }); close(); if (technicalAction.next === 'terminado') setPrintOpen(true) })
  }
  const notes = order.notesLog || []
  const parts = order.sparePartsLog || []
  const workEvent = [...(order.history || [])].reverse().find((entry) => entry.note?.startsWith('Arreglo:'))
  const workAuthor = workEvent?.byName || (order.diagnosisType === 'visible' && order.fix ? order.receivedByName : null)
  const workRole = workEvent?.user?.role || (!workEvent ? order.received?.role : null)
  const footer = <>{!technicianView && <section className="ws-finance" aria-label="Importes"><p>{order.rejectedCharge != null ? 'Importe de retiro' : 'Presupuesto'} <strong>{bill.total || order.rejectedCharge === 0 ? formatMoney(bill.total) : 'a definir'}</strong></p><p>Seña <strong>{formatMoney(order.advance)}</strong> · {(order.price || order.rejectedCharge != null) && bill.credit ? 'Saldo a favor' : 'Saldo'} <strong>{bill.total || order.rejectedCharge === 0 ? formatMoney(Math.abs(bill.balance)) : '—'}</strong></p>{order.rejectedCharge != null && <p>Presupuesto rechazado <strong>{formatMoney(order.price)}</strong></p>}</section>}{draft.work ? <button className="ws-button primary" disabled={busy} onClick={saveWork}><Save size={16} />Guardar</button> : technicianView ? technicalAction ? <button className="ws-button primary" disabled={busy || technicalAction.disabled} onClick={advanceWork}>{technicalAction.label}</button> : <p>{finished ? 'Equipo entregado' : order.status === 'presupuesto' ? order.confirmed ? 'Presupuesto aprobado' : 'Presupuesto pendiente' : 'Sin acciones pendientes'}</p> : counter && task ? <button className="ws-button primary" disabled={busy} onClick={() => openTask()}>{taskTitles[task]}</button> : <p>Sin pendientes de recepción</p>}</>

  const sheet = <OrderSheet order={order} customer={customer} technical={technicianView} onBack={onBack || (() => navigate(-1))} footer={footer} tools={<>
    <button onClick={() => setWindowName('notas')}><StickyNote size={16} />Notas {notes.length}</button><button onClick={() => setWindowName('repuestos')}><Package size={16} />Repuestos {parts.length}</button><button onClick={() => setWindowName('historial')}><History size={16} />Historial {order.history?.length || 0}</button>
    <OrderActionsMenu>{menu.map(({ label, Icon, action }) => <button key={label} role="menuitem" disabled={busy} onClick={action}><Icon size={16} />{label}</button>)}</OrderActionsMenu>
  </>}>
    <section><h3>Notas generales</h3><p className="ws-read-value">{order.issue || 'Sin notas generales'}</p></section>
    <section className="ws-work"><div className="ws-section-heading"><h3>{order.rejectedCharge != null ? 'Trabajo propuesto · sin realizar' : ['terminado', 'entregado'].includes(order.status) ? 'Trabajo realizado' : 'Trabajo a realizar'}</h3>{own && !workLocked && !finished && order.status !== 'presupuesto_rechazado' && !draft.work && <button onClick={startWorkEdit}><Pencil size={14} /> Editar</button>}</div>
      {draft.work ? <div className="ws-form">{draft.work.base !== order.fix && <div className="ws-conflict"><p>Trabajo actual: {order.fix || 'Trabajo por definir'}</p><button className="ws-button" disabled={busy} onClick={() => { patchDraft({ work: { ...draft.work, base: order.fix } }); workInput.current?.focus() }}>Conservar mi edición</button></div>}<label>Trabajo a realizar<textarea ref={workInput} value={draft.work.value} onChange={(event) => patchDraft({ work: { ...draft.work, value: event.target.value } })} /></label><div className="flex flex-wrap gap-2">{(catalogLists.fixes.length ? catalogLists.fixes : COMMON_FIXES).map((fix) => <button key={fix} className="ws-button" onClick={() => { const list = draft.work.value.split(',').map((value) => value.trim()).filter(Boolean); patchDraft({ work: { ...draft.work, value: (list.includes(fix) ? list.filter((value) => value !== fix) : list.length < 8 ? [...list, fix] : list).join(', ') } }) }}>{fix}</button>)}</div><div className="ws-buttons"><button className="ws-button" onClick={() => { if (window.confirm('¿Descartar los cambios del trabajo?')) patchDraft({ work: undefined }) }}>Cancelar</button><button className="ws-button primary" disabled={busy} onClick={saveWork}>Guardar</button></div></div> : <p className="ws-read-value">{order.fix || 'Trabajo por definir'}</p>}
      {workAuthor && <p className="ws-work-origin">Por {workAuthor}{workRole && ` · ${ROLE_LABEL[workRole]}`}</p>}
      {order.status === 'falta_repuestos' && <p className="ws-read-value">{parts.filter((part) => part.status !== 'recibido').map((part) => `${part.name} (${part.quantity})`).join(' · ') || 'Espera de repuestos'}</p>}
    </section>
    {order.technicianNotes && !notes.some((note) => note.text === order.technicianNotes) && <section><h3>Notas del técnico</h3><p className="ws-read-value">{order.technicianNotes}</p></section>}
  </OrderSheet>
  return <>{embedded ? sheet : <div className="ws-standalone">{sheet}</div>}
    <PrintOrderPanel open={printOpen} order={order} onClose={() => setPrintOpen(false)} />
    <NotesModal open={windowName === 'notas'} onClose={close} notesLog={notes} isAssignedTech={own && !finished} currentUser={currentUser} draft={draft.notes} onDraftChange={(value) => patchDraft({ notes: value })} onSave={(text) => run(() => updateOrder(id, { note: text }), 'Nota guardada.')} onEdit={(noteId, text) => run(() => editNote(id, noteId, text))} onDelete={(noteId) => run(() => deleteNote(id, noteId))} />
    <SparePartsModal open={windowName === 'repuestos' && !(counter && !own)} onClose={close} sparePartsLog={parts} isAssignedTech={own && !finished} currentUser={currentUser} draft={draft.parts} onDraftChange={(value) => patchDraft({ parts: value })} onSave={(name, quantity) => run(() => addSparePart(id, name, quantity), 'Repuesto agregado.')} onEdit={(partId, fields) => run(() => editSparePart(id, partId, fields))} onDelete={(partId) => run(() => deleteSparePart(id, partId))} />
    <PickupModal open={!!pickup} onClose={() => setPickup(null)} order={order} mode={pickup?.mode || 'normal'} draft={draft.pickup} onDraftChange={(value) => patchDraft({ pickup: value })} onConfirm={(fields) => status('entregado', { ...(pickup?.early ? { retiro: true } : {}), pickup: fields }, () => patchDraft({ pickup: undefined, task: undefined }))} />
    <ConfirmModal open={!!confirmation} onClose={() => setConfirmation(null)} title={confirmation?.title} message="¿Confirmar esta acción?" onConfirm={confirmation?.operation} />
    <Modal open={windowName === 'historial'} onClose={close} title={`Historial · ${order.orderNumber}`}><ol className="ws-history">{[...(order.history || [])].reverse().map((entry, index) => <li key={entry.id || index}><p>{ORDER_STATUS_LABEL[entry.status]}</p><small>{entry.byName} · {formatDateTime(entry.at)}</small>{entry.note && <p>{entry.note}</p>}</li>)}</ol></Modal>
    <Modal open={windowName === 'equipo'} onClose={close} title={`Editar equipo · ${order.orderNumber}`} maxWidth="max-w-2xl"><form className="ws-form" onSubmit={saveEquipment} ref={equipmentForm}>
      {equipmentConflicts.length > 0 && <div className="ws-conflict"><p>Datos actuales</p><dl>{equipmentConflicts.map((key) => <div key={key}><dt>{equipmentLabels[key]}</dt><dd>{Array.isArray(order[key]) ? order[key].map((value) => value + 1).join(', ') : typeof order[key] === 'boolean' ? order[key] ? 'Sí' : 'No' : order[key] || '—'}</dd></div>)}</dl><button type="button" className="ws-button" disabled={busy} onClick={() => { patchDraft({ equipment: rebaseEquipmentEdit(draft.equipment, currentEquipment) }); equipmentForm.current?.querySelector('input:not(:disabled)')?.focus() }}>Conservar mi edición</button></div>}
      <label>Tipo de dispositivo<input list="device-types" required value={equipment.deviceType || ''} onChange={(event) => setEquipment({ deviceType: event.target.value })} /><datalist id="device-types">{DEVICE_TYPES.map((type) => <option key={type}>{type}</option>)}</datalist></label>
      {['brand', 'model', 'pin'].map((key) => <label key={key}>{({ brand: 'Marca', model: 'Modelo', pin: 'Contraseña o PIN' })[key]}<input required={key !== 'pin'} disabled={key === 'pin' && equipment.noPin} value={equipment[key] || ''} onChange={(event) => setEquipment({ [key]: event.target.value })} /></label>)}
      <label className="ws-checkbox"><input type="checkbox" checked={equipment.noPin || false} onChange={(event) => setEquipment({ noPin: event.target.checked, ...(event.target.checked ? { pin: '', pattern: [] } : {}) })} />El cliente no dejó contraseña</label><div><label>Patrón</label><PatternPad value={equipment.pattern || []} onChange={(pattern) => setEquipment({ pattern })} disabled={equipment.noPin} /></div>
      {['accessories', 'conditions', 'issue'].map((key) => <label key={key}>{({ accessories: 'Accesorios', conditions: 'Estado del equipo', issue: 'Notas generales' })[key]}<textarea maxLength={key === 'issue' ? 200 : undefined} value={equipment[key] || ''} onChange={(event) => setEquipment({ [key]: event.target.value })} /></label>)}
      <div className="ws-buttons"><button type="button" className="ws-button" onClick={close}>Cerrar</button><button className="ws-button primary" disabled={busy}>Guardar</button></div>
    </form></Modal>
    <Modal open={['tecnico', 'tomar'].includes(windowName)} onClose={close} title={windowName === 'tomar' ? 'Iniciar trabajo' : 'Asignar técnico'}>{windowName === 'tomar' ? <div className="ws-form"><label>Técnico<select value={draft.technician || ''} onChange={(event) => patchDraft({ technician: event.target.value || undefined })}><option value="">Seleccionar…</option>{technicians.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label><div className="ws-buttons"><button className="ws-button primary" disabled={busy || !draft.technician} onClick={advanceWork}>Iniciar</button></div></div> : <TechnicianSelect order={order} />}</Modal>
    <Modal open={['presupuestar', 'precio', 'avisar', 'respuesta', 'simples', 'externos'].includes(windowName)} onClose={close} title={`${taskTitles[windowName] || 'Presupuesto'} · ${order.orderNumber}`}><form className="ws-form" onSubmit={completeTask}>
      {['presupuestar', 'precio'].includes(windowName) && (taskDraft.basePrice !== order.price || taskDraft.baseFix !== order.fix) && <div className="ws-conflict"><p>Presupuesto actual: {formatMoney(order.price)}</p><p>Trabajo actual: {order.fix || 'Trabajo por definir'}</p><button type="button" className="ws-button" disabled={busy} onClick={() => { setTask({ basePrice: order.price, baseFix: order.fix }); priceInput.current?.focus() }}>Conservar mi importe</button></div>}
      {['presupuestar', 'precio'].includes(windowName) && <label>Presupuesto ($)<input ref={priceInput} type="number" required min={windowName === 'presupuestar' ? '0.01' : '0'} step="0.01" value={taskDraft.price ?? ''} onChange={(event) => setTask({ price: event.target.value })} /></label>}
      {windowName === 'avisar' && <><p>{order.status === 'terminado' ? 'Equipo listo para retirar' : 'Presupuesto'} · {formatMoney(bill.total)}</p><p>{customer?.phone || 'Sin teléfono registrado'}</p></>}
      {windowName === 'respuesta' && <><label>Respuesta<select value={taskDraft.response || 'approve'} onChange={(event) => setTask({ response: event.target.value })}><option value="approve">Aprobó el presupuesto</option><option value="reject">Rechazó el presupuesto</option></select></label>{taskDraft.response === 'reject' && <label>Importe de retiro ($)<input type="number" required min="0" step="0.01" value={taskDraft.charge ?? ''} onChange={(event) => setTask({ charge: event.target.value })} /></label>}</>}
      {windowName === 'externos' && (order.status === 'en_tercero' ? <p>Registrar regreso de {order.externalTech}</p> : <label>Técnico externo<select required value={taskDraft.external || ''} onChange={(event) => setTask({ external: event.target.value })}><option value="">Seleccionar…</option>{catalogLists.externalTechnicians.map((name) => <option key={name}>{name}</option>)}</select></label>)}
      {windowName === 'simples' && <p>Presupuesto {formatMoney(order.price)} · Seña {formatMoney(order.advance)}</p>}
      <div className="ws-buttons"><button type="button" className="ws-button" disabled={busy} onClick={close}>Cerrar</button><button className="ws-button primary" disabled={busy}><Check size={16} />{['presupuestar', 'precio'].includes(windowName) ? 'Guardar presupuesto' : windowName === 'avisar' ? 'Registrar aviso' : windowName === 'externos' ? order.status === 'en_tercero' ? 'Registrar regreso' : 'Enviar' : windowName === 'simples' ? 'Finalizar servicio' : 'Guardar respuesta'}</button></div>
    </form></Modal>
    <Modal open={windowName === 'repuestosGestion' || windowName === 'repuestos' && counter && !own} onClose={close} title={`Gestionar repuestos · ${order.orderNumber}`}><div className="ws-form">{parts.length ? parts.map((part) => <div key={part.id}><p>{part.name} · {part.quantity}</p><div className="ws-buttons"><span>{part.status}</span>{part.status !== 'recibido' && <button className="ws-button" disabled={busy} onClick={() => run(() => editSparePart(id, part.id, { status: part.status === 'necesario' ? 'pedido' : 'recibido' }), 'Repuesto actualizado.')}>{part.status === 'necesario' ? 'Registrar pedido' : 'Registrar llegada'}</button>}</div></div>) : <p>Sin repuestos registrados</p>}</div></Modal>
  </>
}
