import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown,
  Clock3, Eye, EyeOff, History, MessageSquare,
  Package, Pencil, Phone, Save, Smartphone,
  StickyNote, UserRound, Laptop, Monitor, Gamepad2, KeyRound, Grid3X3, Cable,
} from 'lucide-react'
import { PatternPreview } from '../components/PatternPad.jsx'
import Modal from '../components/Modal.jsx'
import { TECHNICIAN, STATUS_LABELS, nextAction, waitingFor, charges } from './preview-model.js'

const money = (value) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value)
const date = (value) => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(value)
export function DeviceIcon({ type, ...props }) {
  const Icon = { Celular: Smartphone, Notebook: Laptop, Monitor, Consola: Gamepad2 }[type] || Smartphone
  return <Icon {...props} />
}
export function Status({ order }) {
  const tone = order.status === 'entregado' || order.status === 'terminado' ? 'green'
    : ['presupuesto', 'falta_repuestos', 'presupuesto_rechazado'].includes(order.status) ? 'amber'
      : order.status === 'recibido' ? 'neutral' : 'blue'
  return <span className={`fp-status fp-status-${tone}`}><span />{STATUS_LABELS[order.status]}</span>
}
export function ToolWindow({ title, onClose, children }) {
  const contentRef = useRef(null)
  useEffect(() => {
    const opener = document.activeElement
    const dialog = contentRef.current.closest('[role="dialog"]')
    dialog.setAttribute('aria-labelledby', 'preview-tool-title')
    dialog.tabIndex = -1
    dialog.focus({ preventScroll: true })
    const trapFocus = (event) => {
      if (event.key !== 'Tab') return
      const controls = [...dialog.querySelectorAll('button, input, textarea, select, a[href], [tabindex="0"]')].filter((element) => !element.disabled && element.getClientRects().length)
      const first = controls[0], last = controls.at(-1)
      if (!first) { event.preventDefault(); dialog.focus(); return }
      if (event.shiftKey && (document.activeElement === first || !controls.includes(document.activeElement))) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && (document.activeElement === last || !controls.includes(document.activeElement))) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', trapFocus)
    return () => { document.removeEventListener('keydown', trapFocus); if (opener?.isConnected) opener.focus({ preventScroll: true }) }
  }, [])
  return <Modal open onClose={onClose} title={<span id="preview-tool-title">{title}</span>} maxWidth="max-w-2xl"><div className="fp-tool-content" ref={contentRef}>{children}</div></Modal>
}
export function OrderTools({ order, role, technical = false, draft, setDraft, onAction, onExtra, actionsInWindow = false }) {
  const [tool, setTool] = useState(null)
  const own = role === 'admin' || order.assignedTo === TECHNICIAN
  const canNote = order.status !== 'entregado' && (!technical || own)
  const canRequest = technical && own && ['en_reparacion', 'falta_repuestos'].includes(order.status)
  const runExtra = (type) => { if (actionsInWindow) setTool(null); onExtra(type) }
  const extraActions = <><button onClick={() => runExtra('print')}>Comprobante</button><button onClick={() => runExtra('label')}>Etiqueta</button>{role !== 'tecnico' && order.status !== 'entregado' && <button onClick={() => runExtra('assign')}>Asignar técnico</button>}{['admin', 'recepcion'].includes(role) && ['recibido', 'en_revision', 'presupuesto', 'en_reparacion'].includes(order.status) && <button onClick={() => runExtra('sendExternal')}>Enviar a externo</button>}{['admin', 'recepcion'].includes(role) && order.status === 'entregado' && <button onClick={() => runExtra('warranty')}>Reingresar por garantía</button>}{role === 'admin' && <button onClick={() => runExtra('trash')}>Mover a Papelera</button>}</>
  return <><div className="fp-tool-buttons" role="group" aria-label="Herramientas de la orden">
        {[['notes', 'Notas', StickyNote, order.notes.length, draft.note.trim()], ['parts', 'Repuestos', Package, order.parts.length, draft.partName.trim()], ['history', 'Historial', History, order.history.length, false]].map(([key, label, Icon, count, pending]) => <button key={key} aria-haspopup="dialog" onClick={() => setTool(key)}><Icon size={16} />{label}<span>{count}</span>{pending && <span className="fp-draft-indicator">· Borrador</span>}</button>)}
        {onExtra && (actionsInWindow ? <button aria-haspopup="dialog" onClick={() => setTool('actions')}>Acciones</button> : <details className="fp-more"><summary>Más<ChevronDown size={14} /></summary><div>{extraActions}</div></details>)}
      </div>{tool && <ToolWindow title={`${{ notes: 'Notas', parts: 'Repuestos', history: 'Historial', actions: 'Acciones' }[tool]} · ${order.number}`} onClose={() => setTool(null)}>
        {tool === 'actions' && <div className="fp-response-options">{extraActions}</div>}
        {tool === 'notes' && <div className="fp-section-content">
          {order.notes.length ? <ul className="fp-notes">{order.notes.map((note) => <li key={note.id}><p>{note.text}</p><span>{note.by} · {date(note.at)}</span></li>)}</ul> : <div className="fp-inline-empty"><MessageSquare size={24} /><p>Sin notas.</p></div>}
          {canNote && <form onSubmit={(e) => { e.preventDefault(); onAction('note', { text: draft.note }); e.currentTarget.querySelector('textarea').focus() }}><label htmlFor="new-note">Nueva nota</label><textarea id="new-note" rows={3} value={draft.note} onChange={(e) => setDraft({ note: e.target.value })} placeholder="Una observación útil para continuar el trabajo…" /><button className="fp-button secondary" type="submit" disabled={!draft.note.trim()}><Save size={15} />Guardar nota</button></form>}
        </div>}
        {tool === 'parts' && <div className="fp-section-content">
          {order.parts.length ? <ul className="fp-parts">{order.parts.map((part) => <li key={part.id}><div className="fp-part-icon"><Package size={19} /></div><div><strong>{part.name}</strong><span>Cantidad: {part.quantity} · {part.status === 'necesario' ? 'Por pedir' : part.status === 'pedido' ? 'Pedido · esperando llegada' : 'Recibido'}</span></div>{!technical && order.status === 'falta_repuestos' && part.status !== 'recibido' && <button className="fp-button secondary" onClick={(e) => { onAction(part.status === 'necesario' ? 'partOrdered' : 'partArrived', { id: part.id }); e.currentTarget.closest('[role="dialog"]').focus() }}>{part.status === 'necesario' ? 'Registrar pedido' : 'Registrar llegada'}</button>}{part.status === 'recibido' && <CheckCircle2 size={19} className="fp-green" />}</li>)}</ul> : <div className="fp-inline-empty"><Package size={25} /><p>Sin repuestos.</p></div>}
          {canRequest && <form className="fp-part-form" onSubmit={(e) => { e.preventDefault(); onAction('requestPart', { name: draft.partName, quantity: draft.partQuantity }); e.currentTarget.querySelector('input').focus() }}><h4>Solicitar un repuesto</h4><div className="fp-part-fields"><label>Repuesto<input value={draft.partName} onChange={(e) => setDraft({ partName: e.target.value })} placeholder="Ej.: módulo de pantalla Moto G84" /></label><label>Cantidad<input type="number" min="1" max="99" value={draft.partQuantity} onChange={(e) => setDraft({ partQuantity: e.target.value })} /></label></div><button type="submit" className="fp-button secondary" disabled={!draft.partName.trim()}><Package size={15} />Solicitar repuesto</button></form>}
        </div>}
        {tool === 'history' && <ol className="fp-history">{[...order.history].reverse().map((event, i) => <li key={`${event.at}-${i}`}><p>{event.text}</p>{event.previousWork !== undefined && <p className="fp-history-work">Antes: {event.previousWork || 'Trabajo por definir'}</p>}{event.work !== undefined && <p className="fp-history-work">{event.previousWork !== undefined ? 'Ahora' : 'Trabajo'}: {event.work || 'Trabajo por definir'}</p>}<span>{event.by} · {date(event.at)}</span></li>)}</ol>}
      </ToolWindow>}</>
}

export default function OrderWorkspace({ order, role, technical = role === 'tecnico', draft, setDraft, onAction, onBack, onExtra }) {
  const [showAccess, setShowAccess] = useState(false)
  const [editingWork, setEditingWork] = useState(() => draft.work !== order.work || !order.work)
  const [actionForm, setActionForm] = useState(null)
  const [response, setResponse] = useState('')
  const [pickupBy, setPickupBy] = useState('client')
  const [pickupName, setPickupName] = useState('')
  const [pickupDni, setPickupDni] = useState('')
  const [withoutReceipt, setWithoutReceipt] = useState(false)
  const [physical, setPhysical] = useState(false)
  const bodyRef = useRef(null)
  const own = role === 'admin' || order.assignedTo === TECHNICIAN
  const canWork = technical && own && ['en_revision', 'presupuesto', 'en_reparacion'].includes(order.status)
  const showWorkEditor = canWork && editingWork
  const workDirty = draft.work !== order.work
  const action = nextAction(order, role)
  const wait = waitingFor(order)
  const bill = charges(order)
  let blocked = ''
  if (action?.id === 'sendQuote' && !draft.work.trim()) blocked = 'Definí el tipo de reparación.'
  if (technical && action?.id !== 'sendQuote' && workDirty) blocked = 'Guardá el cambio de reparación antes de continuar.'
  if (action?.id === 'price' && (!draft.price || !Number.isFinite(Number(draft.price)) || Number(draft.price) <= 0)) blocked = 'Ingresá un presupuesto válido.'
  if (!technical && order.status === 'presupuesto' && action?.id !== 'price' && Number(draft.price) !== order.price) blocked = 'Guardá el nuevo precio.'
  if (draft.note.trim() || draft.partName.trim()) blocked = 'Hay notas o repuestos sin guardar.'
  if (actionForm === 'response' && (!response || (response === 'reject' && (draft.charge === '' || !Number.isFinite(Number(draft.charge)) || Number(draft.charge) < 0)))) blocked = 'Completá la respuesta y el importe.'
  if (actionForm === 'pickup' && (!physical || (pickupBy === 'third' && (!pickupName.trim() || !/^\d{6,8}$/.test(pickupDni))))) blocked = 'Completá y confirmá el retiro.'

  const runPrimary = () => {
    if (actionForm === 'response') {
      if (onAction(response, { charge: draft.charge })) { setActionForm(null); setResponse('') }
    } else if (actionForm === 'pickup') {
      if (onAction('pickup', { by: pickupBy, name: pickupName, dni: pickupDni, physical, withoutReceipt })) setActionForm(null)
    } else if (action?.id === 'returnExternal') {
      onExtra?.('returnExternal')
    } else if (action?.id === 'response' || action?.id === 'pickup') {
      setActionForm(action.id)
      bodyRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    } else if (action) onAction(action.id, { work: draft.work, price: draft.price, id: action.partId })
  }
  const primaryLabel = actionForm === 'response' ? response === 'reject' ? 'Confirmar rechazo' : 'Confirmar aprobación'
    : actionForm === 'pickup' ? 'Confirmar entrega' : action?.label
  const priceEditor = !technical && order.status === 'presupuesto' && !order.confirmed && <div className="fp-price-editor"><label htmlFor="quote-price">Precio del presupuesto</label><div className="fp-currency-input"><span>$</span><input id="quote-price" type="number" min="0" step="0.01" value={draft.price} onChange={(e) => setDraft({ price: e.target.value })} placeholder="Ingresá el importe" /></div>
    {order.price > 0 && Number(draft.price) !== order.price && <button className="fp-button secondary" onClick={() => onAction('price', { price: draft.price })} disabled={!draft.price || Number(draft.price) <= 0 || !Number.isFinite(Number(draft.price))}><Save size={15} />Guardar nuevo precio</button>}
  </div>
  return <article className={`fp-order ${technical ? 'fp-technical-order' : ''}`} aria-label={`Orden ${order.number}`}>
    <header className="fp-order-header">
      <button className="fp-back fp-link" onClick={onBack}><ArrowLeft size={16} /> Volver a la cola</button>
      <div className="fp-order-topline"><span className="fp-order-number">{order.number}</span><Status order={order} /></div>
      <h2>{order.brand} {order.model}</h2>
      {(order.warrantyReturn || order.isSimpleService) && <p className="fp-muted">{order.warrantyReturn ? 'Garantía' : 'Servicio simple'}</p>}
      <OrderTools order={order} role={role} technical={technical} draft={draft} setDraft={setDraft} onAction={onAction} onExtra={onExtra} />
      {!technical && <>
        <div className="fp-order-meta"><span><UserRound size={16} />{order.customer}</span><span><Phone size={16} />{order.phone}</span></div>
        <div className="fp-access"><span>Acceso del equipo</span><button className="fp-link" aria-expanded={showAccess} aria-controls="device-access" onClick={() => setShowAccess((value) => !value)}>{showAccess ? <EyeOff size={16} /> : <Eye size={16} />}{showAccess ? 'Ocultar contraseña' : 'Mostrar contraseña'}</button><strong id="device-access" hidden={!showAccess}>{showAccess ? order.access : ''}</strong></div>
      </>}
    </header>
    {technical && <aside className="fp-reference" aria-label="Datos del equipo">
      <div className="fp-reference-client"><span><UserRound size={16} aria-hidden="true" />Cliente</span><p>{order.customer}</p><span className="fp-reference-phone"><Phone size={16} aria-hidden="true" />Teléfono</span><p>{order.phone}</p></div>
      <dl className="fp-equipment-facts">
        <div><dt><KeyRound size={16} aria-hidden="true" />Contraseña o PIN</dt><dd>{order.access || 'Sin contraseña informada'}</dd></div>
        {order.pattern?.length > 0 && <div><dt><Grid3X3 size={16} aria-hidden="true" />Patrón de desbloqueo</dt><dd><div role="img" aria-label={`Patrón de desbloqueo: ${order.pattern.map((point) => point + 1).join(', ')}`}><PatternPreview value={order.pattern} size={112} /></div></dd></div>}
        <div><dt><Smartphone size={16} aria-hidden="true" />Estado físico</dt><dd>{order.conditions || 'Sin registrar'}</dd></div>
        <div><dt><Cable size={16} aria-hidden="true" />Accesorios</dt><dd>{order.accessories || 'Sin accesorios'}</dd></div>
      </dl>
    </aside>}
    <div className="fp-order-body" ref={bodyRef}>
      {actionForm === 'response' && <section className="fp-action-form" aria-label="Respuesta del cliente">
        <h3>¿Qué respondió el cliente?</h3><p>Presupuesto comunicado: <strong>{money(order.price)}</strong></p>
        <div className="fp-response-options" role="group" aria-label="Respuesta al presupuesto">
          <button className={response === 'approve' ? 'selected' : ''} aria-pressed={response === 'approve'} onClick={() => setResponse('approve')}><CheckCircle2 size={18} />Aprobó el presupuesto</button>
          <button className={response === 'reject' ? 'selected' : ''} aria-pressed={response === 'reject'} onClick={() => setResponse('reject')}>Retira sin reparar</button>
        </div>
        {response === 'reject' && <div className="fp-rejection"><label htmlFor="rejection-charge">Importe de revisión / retiro</label><div className="fp-currency-input"><span>$</span><input id="rejection-charge" type="number" min="0" step="0.01" value={draft.charge} onChange={(e) => setDraft({ charge: e.target.value })} /></div>
          </div>}
      </section>}
      {actionForm === 'pickup' && <section className="fp-action-form" aria-label="Datos de entrega">
        <h3>Registrar el retiro del equipo</h3><p>{order.rejectedCharge !== null ? 'Retiro sin reparación.' : 'Reparación finalizada.'} Importe: <strong>{money(bill.total)}</strong></p>
        <label htmlFor="pickup-by">¿Quién retira?</label><select id="pickup-by" value={pickupBy} onChange={(e) => setPickupBy(e.target.value)}><option value="client">El cliente titular</option><option value="third">Otra persona autorizada</option></select>
        {pickupBy === 'third' && <div className="fp-two-fields"><label>Nombre<input value={pickupName} onChange={(e) => setPickupName(e.target.value)} /></label><label>DNI<input inputMode="numeric" value={pickupDni} onChange={(e) => setPickupDni(e.target.value)} /></label></div>}
        <label className="fp-checkbox"><input type="checkbox" checked={physical} onChange={(e) => setPhysical(e.target.checked)} />Confirmo que el equipo se retira físicamente ahora</label>
        <label className="fp-checkbox"><input type="checkbox" checked={withoutReceipt} onChange={(e) => setWithoutReceipt(e.target.checked)} />Retiro sin comprobante</label>
      </section>}
      <section className="fp-issue" aria-labelledby="issue-title"><h3 id="issue-title">Falla informada · Recepción</h3><p>{order.issue}</p></section>
      <section className="fp-work" aria-label="Reparación">
          <div className={technical ? 'fp-work-fields' : undefined}>
            <div><div className="fp-section-heading"><h3 id="work-title">{order.status === 'terminado' || order.status === 'entregado' ? 'Trabajo realizado' : order.rejectedCharge !== null ? 'Trabajo propuesto · sin realizar' : 'Trabajo a realizar'}</h3>{canWork && <button className="fp-button secondary" aria-expanded={showWorkEditor} onClick={() => { if (showWorkEditor) { if (!workDirty || onAction('saveWork', { work: draft.work })) setEditingWork(false) } else setEditingWork(true) }}>{showWorkEditor ? <Save size={14} /> : <Pencil size={14} />}{showWorkEditor ? 'Guardar' : 'Editar'}</button>}</div>
            {showWorkEditor ? <textarea id="work" aria-labelledby="work-title" rows={3} value={draft.work} onChange={(e) => setDraft({ work: e.target.value })} /> : <p className="fp-read-value">{draft.work || 'Trabajo por definir'}</p>}
            {order.workAuthor && <p className="fp-work-origin">{order.workAuthor.role === 'recepcion' ? `Definido en recepción por ${order.workAuthor.name}` : `Actualizado por ${order.workAuthor.name} · ${order.workAuthor.role === 'admin' ? 'Administrador' : 'Técnico'}`}</p>}</div>
          </div>
          {canWork && workDirty && <p className="fp-save-state">Borrador sin guardar</p>}
          {order.status === 'falta_repuestos' && <div className="fp-parts-wait"><Package size={17} /><div><p>{wait.ready ? 'Repuestos recibidos' : 'Repuestos pendientes'}</p><ul>{order.parts.map((part) => <li key={part.id}>{part.name} · {part.status === 'necesario' ? 'Por pedir' : part.status === 'pedido' ? 'Esperando llegada' : 'Recibido'}</li>)}</ul></div></div>}
      </section>
      {!technical && <section className="fp-counter" aria-label="Presupuesto y retiro">
          {priceEditor}
          <div className="fp-finance"><div><span>{order.rejectedCharge !== null ? 'Importe de retiro' : 'Presupuesto'}</span><strong>{bill.total ? money(bill.total) : order.rejectedCharge === 0 ? money(0) : 'A definir'}</strong></div><div><span>Seña recibida</span><strong>{money(order.advance)}</strong></div><div><span>{bill.balance < 0 ? 'Saldo a favor' : 'Saldo pendiente'}</span><strong>{!bill.total && order.rejectedCharge === null ? '—' : money(Math.abs(bill.balance))}</strong></div></div>
          {order.rejectedCharge !== null && <p className="fp-finance-note">Presupuesto rechazado: {money(order.price)}.{bill.balance < 0 && ' Sin devolución registrada.'}</p>}
      </section>}

      {!technical && <details className="fp-disclosure fp-device-details"><summary>Datos de ingreso<ChevronDown size={15} /></summary><div className="fp-device-grid"><div><span>Accesorios</span><p>{order.accessories}</p></div><div><span>Estado físico</span><p>{order.conditions}</p></div><div><span>Ingreso</span><p>{date(order.createdAt)}</p></div><div><span>Técnico</span><p>{order.assignedTo ? own ? 'Juan Pérez' : 'Diego Molina' : 'Sin asignar'}</p></div></div></details>}
    </div>
    <footer className="fp-action-dock">{blocked && <p className="fp-action-context fp-blocked">{blocked}</p>}<div className="fp-dock-buttons">
      {actionForm && <button className="fp-button secondary" onClick={() => { setActionForm(null); setResponse('') }}>Cancelar</button>}
      {primaryLabel && <button className="fp-button primary" onClick={runPrimary} disabled={!!blocked}>{actionForm === 'pickup' || action?.id === 'finish' ? <Check size={17} /> : <ArrowRight size={17} />}{primaryLabel}</button>}
      {!primaryLabel && <span className="fp-no-action"><Clock3 size={15} />{order.status === 'entregado' ? 'Orden cerrada' : 'Sin acciones pendientes'}</span>}
    </div></footer>
  </article>
}

