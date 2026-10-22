import { useRef, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Check, CheckCheck, CheckCircle2, ChevronDown, ChevronRight,
  ClipboardList, Clock3, Eye, EyeOff, FlaskConical, History, Inbox, MessageSquare,
  MoreHorizontal, Package, Phone, RotateCcw, Save, Search, ShieldCheck, Smartphone,
  StickyNote, UserRound, Wrench, Laptop, Monitor, Gamepad2,
} from 'lucide-react'
import { useNotify } from '../context/notifications.js'
import logo from '../assets/gringologo-modified.png'
import {
  TECHNICIAN, REVIEW_FEE, STATUS_LABELS, TECH_VIEWS, RECEPTION_VIEWS,
  createDemoOrders, queueOrders, nextAction, waitingFor, receptionQueue, applyDemoAction, charges,
} from './preview-model.js'

const money = (value) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value)
const date = (value) => new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(value)
function age(value) {
  const hours = Math.max(0, Math.floor((Date.now() - value) / 3600000))
  return hours >= 24 ? `${Math.floor(hours / 24)} d` : `${hours} h`
}
function DeviceIcon({ type, ...props }) {
  const Icon = { Celular: Smartphone, Notebook: Laptop, Monitor, Consola: Gamepad2 }[type] || Smartphone
  return <Icon {...props} />
}
function Status({ order }) {
  const tone = order.status === 'entregado' || order.status === 'terminado' ? 'green'
    : ['presupuesto', 'falta_repuestos', 'presupuesto_rechazado'].includes(order.status) ? 'amber'
      : order.status === 'recibido' ? 'neutral' : 'blue'
  return <span className={`fp-status fp-status-${tone}`}><span />{STATUS_LABELS[order.status]}</span>
}
function StageTrack({ order }) {
  const stage = { recibido: 0, en_revision: 1, presupuesto: 2, en_reparacion: 3, falta_repuestos: 3, terminado: 4, presupuesto_rechazado: 4, entregado: 5 }[order.status]
  const withoutRepair = order.rejectedCharge !== null
  return <ol className="fp-stages" aria-label="Etapas de la orden">
    {['Ingreso', 'Revisión', 'Presupuesto', 'Reparación', 'Retiro'].map((label, index) => (
      <li key={label} className={index === 3 && withoutRepair ? 'skipped' : index === Math.min(stage, 4) ? 'current' : index < stage ? 'done' : ''} aria-current={index === Math.min(stage, 4) ? 'step' : undefined}>
        <span className="fp-stage-dot">{index === 3 && withoutRepair ? '—' : index < stage ? <Check size={10} /> : index + 1}</span><span>{index === 3 && withoutRepair ? 'Sin reparar' : label}</span>
      </li>
    ))}
  </ol>
}

function OrderWorkspace({ order, role, draft, setDraft, onAction, outsideQueue, onBack }) {
  const [section, setSection] = useState(() => role === 'recepcion' && receptionQueue(order) === 'repuestos' ? 'parts' : 'work')
  const [showAccess, setShowAccess] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [actionForm, setActionForm] = useState(null)
  const [response, setResponse] = useState('')
  const [pickupBy, setPickupBy] = useState('client')
  const [pickupName, setPickupName] = useState('')
  const [pickupDni, setPickupDni] = useState('')
  const [physical, setPhysical] = useState(false)
  const [checked, setChecked] = useState(false)
  const historyRef = useRef(null)
  const bodyRef = useRef(null)
  const own = order.assignedTo === TECHNICIAN
  const technical = role === 'tecnico'
  const canWork = technical && own && ['en_revision', 'en_reparacion'].includes(order.status)
  const canNote = order.status !== 'entregado' && (!technical || own)
  const canRequest = technical && own && ['en_reparacion', 'falta_repuestos'].includes(order.status)
  const workDirty = draft.diagnosis !== order.diagnosis || draft.work !== order.work
  const action = nextAction(order, role)
  const wait = waitingFor(order)
  const bill = charges(order)
  let blocked = ''
  if (action?.id === 'sendQuote' && (!draft.diagnosis.trim() || !draft.work.trim())) blocked = 'Completá el diagnóstico y el trabajo propuesto para enviar.'
  if (action?.id === 'price' && (!draft.price || !Number.isFinite(Number(draft.price)) || Number(draft.price) <= 0)) blocked = 'Ingresá el precio del presupuesto para continuar.'
  if (!technical && order.status === 'presupuesto' && action?.id !== 'price' && Number(draft.price) !== order.price) blocked = 'Guardá el nuevo precio antes de registrar el aviso o la respuesta.'
  if (action?.id === 'finish' && !checked) blocked = 'Confirmá la prueba de funcionamiento antes de finalizar.'
  if (draft.note.trim() || draft.partName.trim()) blocked = 'Guardá la nota o el repuesto que estás escribiendo antes de avanzar.'
  if (actionForm === 'response' && (!response || (response === 'reject' && (draft.charge === '' || !Number.isFinite(Number(draft.charge)) || Number(draft.charge) < 0)))) blocked = 'Elegí la respuesta y confirmá un importe válido, incluso si es cero.'
  if (actionForm === 'pickup' && (!physical || (pickupBy === 'third' && (!pickupName.trim() || !/^\d{6,8}$/.test(pickupDni))))) blocked = 'Confirmá el retiro físico y completá quién recibe el equipo.'

  const runPrimary = () => {
    if (actionForm === 'response') {
      if (onAction(response, { charge: draft.charge })) { setActionForm(null); setResponse('') }
    } else if (actionForm === 'pickup') {
      if (onAction('pickup', { by: pickupBy, name: pickupName, dni: pickupDni, physical })) setActionForm(null)
    } else if (action?.id === 'response' || action?.id === 'pickup') {
      setActionForm(action.id)
      bodyRef.current?.scrollTo({ top: 0, behavior: 'instant' })
    } else if (action) onAction(action.id, { diagnosis: draft.diagnosis, work: draft.work, price: draft.price, id: action.partId })
  }
  const primaryLabel = actionForm === 'response' ? response === 'reject' ? 'Confirmar rechazo' : 'Confirmar aprobación'
    : actionForm === 'pickup' ? 'Confirmar entrega' : action?.label
  const context = order.status === 'entregado' ? 'Entrega registrada. La orden queda disponible para consulta.'
    : blocked || (action?.id === 'claim' ? 'Se asignará a vos y entrará en revisión.'
      : action?.partId ? `Repuesto: ${action.partName}. Se actualizará su estado en esta orden.`
        : action?.id === 'notify' ? 'Registrá el aviso después de comunicarte con el cliente. No se envían mensajes.'
        : !action ? wait?.text || (technical && !own ? 'Asignado a Diego. Podés consultar el equipo.' : 'El técnico está trabajando en este equipo.')
          : action?.id === 'sendQuote' ? 'Se guardará el diagnóstico y aparecerá en los pendientes de recepción.'
            : action?.id === 'finish' ? 'Recepción lo verá en los pendientes de aviso.' : 'El cambio quedará registrado en el historial.')

  const priceEditor = !technical && order.status === 'presupuesto' && !order.confirmed && <div className="fp-price-editor"><label htmlFor="quote-price">Precio del presupuesto</label><div className="fp-currency-input"><span>$</span><input id="quote-price" type="number" min="0" step="0.01" value={draft.price} onChange={(e) => setDraft({ price: e.target.value })} placeholder="Ingresá el importe" /></div>
    {order.price > 0 && Number(draft.price) !== order.price && <button className="fp-button secondary" onClick={() => onAction('price', { price: draft.price })} disabled={!draft.price || Number(draft.price) <= 0 || !Number.isFinite(Number(draft.price))}><Save size={15} />Guardar nuevo precio</button>}
  </div>
  return <article className="fp-order" aria-label={`Orden ${order.number}`}>
    <header className="fp-order-header">
      <button className="fp-back fp-link" onClick={onBack}><ArrowLeft size={16} /> Volver a la cola</button>
      <div className="fp-order-topline"><span className="fp-order-number">{order.number}</span><Status order={order} />
        <details className="fp-more">
          <summary aria-label="Más acciones"><MoreHorizontal size={21} /></summary>
          <div><button onClick={(event) => { setHistoryOpen(true); event.currentTarget.closest('details').open = false; setTimeout(() => historyRef.current?.scrollIntoView({ block: 'nearest' }), 0) }}><History size={15} /> Ver historial</button>
            <button onClick={(event) => { setShowAccess((value) => !value); event.currentTarget.closest('details').open = false }}><Eye size={15} /> {showAccess ? 'Ocultar acceso' : 'Ver acceso del equipo'}</button></div>
        </details>
      </div>
      <h2>{order.brand} {order.model}</h2>
      <div className="fp-order-meta"><span><UserRound size={14} />{order.customer}</span><span><Wrench size={14} />{order.assignedTo ? own ? 'Juan Pérez' : 'Diego Molina' : 'Sin técnico'}</span><span><Clock3 size={14} />Ingresó hace {age(order.createdAt)}</span>{!technical && <span><Phone size={14} />{order.phone}</span>}</div>
      {outsideQueue && <p className="fp-outside"><CheckCheck size={14} />La orden salió de esta cola. Podés seguir consultándola acá.</p>}
    </header>
    <StageTrack order={order} />
    <div className="fp-order-body" ref={bodyRef}>
      {actionForm === 'response' && <section className="fp-action-form" aria-label="Respuesta del cliente">
        <h3>¿Qué respondió el cliente?</h3><p>Presupuesto comunicado: <strong>{money(order.price)}</strong></p>
        <div className="fp-response-options" role="group" aria-label="Respuesta al presupuesto">
          <button className={response === 'approve' ? 'selected' : ''} aria-pressed={response === 'approve'} onClick={() => setResponse('approve')}><CheckCircle2 size={18} />Aprobó el presupuesto</button>
          <button className={response === 'reject' ? 'selected' : ''} aria-pressed={response === 'reject'} onClick={() => setResponse('reject')}>Retira sin reparar</button>
        </div>
        {response === 'reject' && <div className="fp-rejection"><label htmlFor="rejection-charge">Importe de revisión / retiro</label><div className="fp-currency-input"><span>$</span><input id="rejection-charge" type="number" min="0" step="0.01" value={draft.charge} onChange={(e) => setDraft({ charge: e.target.value })} /></div>
          <p>Importe sugerido: {money(REVIEW_FEE)}. Recepción puede cambiarlo o indicar cero.</p><p>El equipo seguirá pendiente de retiro. El presupuesto original se conserva.</p></div>}
      </section>}
      {actionForm === 'pickup' && <section className="fp-action-form" aria-label="Datos de entrega">
        <h3>Registrar el retiro del equipo</h3><p>{order.rejectedCharge !== null ? 'Retiro sin reparación.' : 'Reparación finalizada.'} Importe: <strong>{money(bill.total)}</strong></p>
        <label htmlFor="pickup-by">¿Quién retira?</label><select id="pickup-by" value={pickupBy} onChange={(e) => setPickupBy(e.target.value)}><option value="client">El cliente titular</option><option value="third">Otra persona autorizada</option></select>
        {pickupBy === 'third' && <div className="fp-two-fields"><label>Nombre<input value={pickupName} onChange={(e) => setPickupName(e.target.value)} /></label><label>DNI<input inputMode="numeric" value={pickupDni} onChange={(e) => setPickupDni(e.target.value)} /></label></div>}
        <label className="fp-checkbox"><input type="checkbox" checked={physical} onChange={(e) => setPhysical(e.target.checked)} />Confirmo que el equipo se retira físicamente ahora</label>
      </section>}
      {wait && <div className={`fp-handoff ${wait.ready ? 'ready' : ''}`}>
        {wait.ready ? <CheckCircle2 size={19} /> : <Clock3 size={19} />}<div><strong>{wait.ready ? 'Disponible para continuar' : `En espera · ${wait.owner}`}</strong><p>{wait.text}</p></div>
      </div>}
      {order.status === 'entregado' && <div className="fp-handoff ready"><CheckCircle2 size={21} /><div><strong>Equipo entregado</strong><p>El retiro físico quedó registrado en esta demostración.</p></div></div>}
      {action?.id === 'price' && priceEditor}
      <section className="fp-issue"><span>Falla informada al ingresar</span><p>{order.issue}</p></section>
      <div className="fp-section-tabs" role="tablist" aria-label="Información de la orden">
        {[['work', 'Trabajo', Wrench], ['notes', 'Notas', StickyNote], ['parts', 'Repuestos', Package]].map(([key, label, Icon]) => (
          <button key={key} id={`tab-${key}`} role="tab" tabIndex={section === key ? 0 : -1} aria-selected={section === key} aria-controls={`panel-${key}`} onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const keys = ['work', 'notes', 'parts']
            const position = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (keys.indexOf(section) + (event.key === 'ArrowRight' ? 1 : 2)) % 3
            setSection(keys[position]); event.currentTarget.parentElement.querySelectorAll('[role=tab]')[position].focus()
          }} onClick={() => setSection(key)}><Icon size={15} />{label}{key !== 'work' && <span>{order[key === 'notes' ? 'notes' : 'parts'].length}</span>}</button>
        ))}
      </div>
      <section className="fp-section-content" id={`panel-${section}`} role="tabpanel" aria-labelledby={`tab-${section}`}>
        {section === 'work' && <>
          <div className="fp-section-heading"><h3>Diagnóstico y trabajo</h3>{canWork && <span className={`fp-save-state ${workDirty ? 'dirty' : ''}`}>{workDirty ? 'Borrador sin guardar' : <><Check size={12} /> Guardado</>}</span>}</div>
          <label htmlFor="diagnosis">Diagnóstico del técnico</label>
          {canWork ? <textarea id="diagnosis" rows={2} value={draft.diagnosis} onChange={(e) => setDraft({ diagnosis: e.target.value })} placeholder="Qué encontraste al revisar el equipo…" /> : <p className="fp-read-value">{order.diagnosis || 'El técnico todavía no registró el diagnóstico.'}</p>}
          <label htmlFor="work">Trabajo {order.status === 'terminado' || order.status === 'entregado' ? 'registrado' : 'propuesto'}</label>
          {canWork ? <textarea id="work" rows={2} value={draft.work} onChange={(e) => setDraft({ work: e.target.value })} placeholder="Qué reparación o pruebas necesita…" /> : <p className="fp-read-value">{order.work || 'Se definirá después de la revisión.'}</p>}
          {action?.id === 'finish' && <label className="fp-checkbox fp-test-check"><input type="checkbox" checked={checked} onChange={(e) => setChecked(e.target.checked)} />Realicé la prueba de funcionamiento del trabajo registrado</label>}
          {action?.id !== 'price' && priceEditor}
          <div className="fp-finance"><div><span>{order.rejectedCharge !== null ? 'Importe de retiro' : 'Presupuesto'}</span><strong>{bill.total ? money(bill.total) : order.rejectedCharge === 0 ? money(0) : 'A definir'}</strong></div><div><span>Seña recibida</span><strong>{money(order.advance)}</strong></div><div><span>{bill.balance < 0 ? 'Saldo a favor' : 'Saldo pendiente'}</span><strong>{!bill.total && order.rejectedCharge === null ? '—' : money(Math.abs(bill.balance))}</strong></div></div>
          {order.rejectedCharge !== null && <p className="fp-finance-note">Presupuesto rechazado: {money(order.price)}. {bill.balance < 0 ? 'El saldo a favor debe resolverse con el cliente; no se registró una devolución.' : 'El importe de retiro fue confirmado por recepción.'}</p>}
        </>}
        {section === 'notes' && <>
          <div className="fp-section-heading"><h3>Notas del equipo</h3><span className="fp-muted">Visibles para taller y recepción</span></div>
          {order.notes.length ? <ul className="fp-notes">{order.notes.map((note) => <li key={note.id}><p>{note.text}</p><span>{note.by} · {date(note.at)}</span></li>)}</ul> : <div className="fp-inline-empty"><MessageSquare size={24} /><p>Dejá acá las observaciones para la próxima persona que trabaje con este equipo.</p></div>}
          {canNote && <form onSubmit={(e) => { e.preventDefault(); onAction('note', { text: draft.note }) }}><label htmlFor="new-note">Nueva nota</label><textarea id="new-note" rows={3} value={draft.note} onChange={(e) => setDraft({ note: e.target.value })} placeholder="Una observación útil para continuar el trabajo…" /><button className="fp-button secondary" type="submit" disabled={!draft.note.trim()}><Save size={15} />Guardar nota</button></form>}
        </>}
        {section === 'parts' && <>
          <div className="fp-section-heading"><h3>Repuestos del equipo</h3><span className="fp-muted">Pedido y llegada: recepción</span></div>
          {order.parts.length ? <ul className="fp-parts">{order.parts.map((part) => <li key={part.id}><div className="fp-part-icon"><Package size={19} /></div><div><strong>{part.name}</strong><span>Cantidad: {part.quantity} · {part.status === 'necesario' ? 'Por pedir' : part.status === 'pedido' ? 'Pedido · esperando llegada' : 'Recibido'}</span></div>{!technical && order.status === 'falta_repuestos' && part.status !== 'recibido' && <button className="fp-button secondary" onClick={() => onAction(part.status === 'necesario' ? 'partOrdered' : 'partArrived', { id: part.id })}>{part.status === 'necesario' ? 'Registrar pedido' : 'Registrar llegada'}</button>}{part.status === 'recibido' && <CheckCircle2 size={19} className="fp-green" />}</li>)}</ul> : <div className="fp-inline-empty"><Package size={25} /><p>Este equipo no tiene repuestos solicitados.</p></div>}
          {canRequest && <form className="fp-part-form" onSubmit={(e) => { e.preventDefault(); onAction('requestPart', { name: draft.partName, quantity: draft.partQuantity }) }}><h4>Solicitar un repuesto</h4><div className="fp-part-fields"><label>Repuesto<input value={draft.partName} onChange={(e) => setDraft({ partName: e.target.value })} placeholder="Ej.: módulo de pantalla Moto G84" /></label><label>Cantidad<input type="number" min="1" max="99" value={draft.partQuantity} onChange={(e) => setDraft({ partQuantity: e.target.value })} /></label></div><p className="fp-muted">El equipo quedará en espera y recepción verá el pedido.</p><button type="submit" className="fp-button secondary" disabled={!draft.partName.trim()}><Package size={15} />Solicitar y dejar en espera</button></form>}
        </>}
      </section>
      {!technical && <section className="fp-contact"><div className="fp-avatar">{order.customer.split(' ').map((word) => word[0]).join('')}</div><div><strong>{order.customer}</strong><span><Phone size={13} />{order.phone} <small>Dato ficticio</small></span></div>{order.notified && <span className="fp-contacted"><CheckCheck size={15} />Avisado</span>}</section>}
      <details className="fp-device-details"><summary>Datos de ingreso y acceso<ChevronDown size={15} /></summary><div className="fp-device-grid"><div><span>Accesorios</span><p>{order.accessories}</p></div><div><span>Estado al ingresar</span><p>{order.conditions}</p></div><div><span>Ingreso</span><p>{date(order.createdAt)}</p></div><div><span>Acceso del equipo</span><button className="fp-link" onClick={() => setShowAccess((value) => !value)}>{showAccess ? <EyeOff size={14} /> : <Eye size={14} />}{showAccess ? order.access : 'Ver acceso'}</button></div></div></details>
      {showAccess && <p className="fp-access"><ShieldCheck size={15} />PIN de ejemplo: {order.access}. Ocultalo al terminar de consultarlo.</p>}
      <details className="fp-history" open={historyOpen} onToggle={(e) => setHistoryOpen(e.currentTarget.open)} ref={historyRef}><summary><History size={15} />Historial de la orden<span>{order.history.length}</span><ChevronDown size={15} /></summary><ol>{[...order.history].reverse().map((event, i) => <li key={`${event.at}-${i}`}><span className="fp-history-dot" /><div><p>{event.text}</p><span>{event.by} · {date(event.at)}</span></div></li>)}</ol></details>
    </div>
    <footer className="fp-action-dock"><div className="fp-action-context"><span className={blocked ? 'fp-blocked' : ''}>{context}</span></div><div className="fp-dock-buttons">
      {actionForm && <button className="fp-button secondary" onClick={() => { setActionForm(null); setResponse('') }}>Cancelar</button>}
      {!actionForm && canWork && <button className="fp-button secondary" onClick={() => onAction('saveWork', { diagnosis: draft.diagnosis, work: draft.work })} disabled={!workDirty}><Save size={16} />Guardar</button>}
      {primaryLabel && <button className="fp-button primary" onClick={runPrimary} disabled={!!blocked}>{actionForm === 'pickup' || action?.id === 'finish' ? <Check size={17} /> : <ArrowRight size={17} />}{primaryLabel}</button>}
      {!primaryLabel && <span className="fp-no-action"><Clock3 size={15} />{order.status === 'entregado' ? 'Orden cerrada' : 'Sin acciones pendientes para vos'}</span>}
    </div></footer>
  </article>
}

export default function FlowPreview() {
  const [orders, setOrders] = useState(createDemoOrders)
  const [role, setRole] = useState('tecnico')
  const [views, setViews] = useState({ tecnico: 'mine', recepcion: 'presupuestar' })
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState('demo-OS1042')
  const [drafts, setDrafts] = useState({})
  const [mobileDetail, setMobileDetail] = useState(false)
  const [generation, setGeneration] = useState(0)
  const queueRef = useRef(null)
  const notify = useNotify('success')
  const order = orders.find((item) => item.id === selectedId)
  const view = views[role]
  const list = queueOrders(orders, role, view, search)
  const viewOptions = role === 'tecnico' ? TECH_VIEWS : RECEPTION_VIEWS
  const draft = order ? { diagnosis: order.diagnosis, work: order.work, price: order.price || '', charge: String(REVIEW_FEE), note: '', partName: '', partQuantity: '1', ...drafts[order.id] } : null
  const hasDrafts = Object.values(drafts).some((value) => Object.keys(value).length)

  const changeRole = (next) => {
    if (next === role) return
    setRole(next)
    if (next === 'recepcion') {
      const target = receptionQueue(order || {})
      if (target) setViews((previous) => ({ ...previous, recepcion: target }))
      else setSelectedId(queueOrders(orders, next, views[next], search)[0]?.id || null)
    } else if (order && (order.assignedTo !== TECHNICIAN || ['terminado', 'presupuesto_rechazado', 'entregado'].includes(order.status))) {
      setSelectedId(queueOrders(orders, next, views[next], search)[0]?.id || null)
    }
  }
  const changeView = (next) => {
    setViews((previous) => ({ ...previous, [role]: next }))
    const nextList = queueOrders(orders, role, next, search)
    if (!nextList.some((item) => item.id === selectedId)) setSelectedId(nextList[0]?.id || null)
    setMobileDetail(false)
  }
  const mutate = (action, payload) => {
    try {
      const updated = applyDemoAction(order, action, payload, role)
      setOrders((previous) => previous.map((item) => item.id === order.id ? updated : item))
      const clear = ['saveWork', 'sendQuote', 'finish'].includes(action) ? ['diagnosis', 'work'] : action === 'price' ? ['price'] : action === 'note' ? ['note'] : action === 'requestPart' ? ['partName', 'partQuantity'] : action === 'reject' ? ['charge'] : []
      setDrafts((previous) => { const kept = { ...previous[order.id] }; clear.forEach((key) => delete kept[key]); return { ...previous, [order.id]: kept } })
      notify(updated.history.at(-1).text)
      return true
    } catch (error) { notify({ type: 'error', text: error.message }); return false }
  }
  const reset = () => {
    if (hasDrafts && !window.confirm('¿Reiniciar la demostración y descartar los borradores?')) return
    setOrders(createDemoOrders()); setDrafts({}); setSearch(''); setSelectedId('demo-OS1042'); setRole('tecnico'); setViews({ tecnico: 'mine', recepcion: 'presupuestar' }); setMobileDetail(false)
    setGeneration((previous) => previous + 1)
    queueRef.current?.scrollTo({ top: 0 })
    notify('Demostración reiniciada. Solo se modifican estos datos de ejemplo.')
  }
  const openOrder = (id) => { setSelectedId(id); setMobileDetail(true) }
  const onQueueKey = (event, index) => {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    event.preventDefault()
    const target = event.key === 'Home' ? 0 : event.key === 'End' ? list.length - 1 : Math.max(0, Math.min(list.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))
    queueRef.current?.querySelectorAll('.fp-queue-row')[target]?.focus()
  }
  return <div className="flow-demo">
    <div className="fp-demo-bar"><span><FlaskConical size={15} /><strong>Vista previa</strong><span className="fp-demo-description">Datos ficticios · cambios solo en esta pestaña</span></span><button onClick={reset}><RotateCcw size={14} />Reiniciar demo</button></div>
    <div className="fp-shell">
      <aside className="fp-sidebar"><div className="fp-brand"><img src={logo} alt="" /><div><strong>El Gringo</strong><span>Service Center</span></div></div><div className="fp-navigation"><span>Espacios de trabajo</span><button className={role === 'tecnico' ? 'active' : ''} onClick={() => changeRole('tecnico')}><Wrench size={18} />Taller<ChevronRight size={15} /></button><button className={role === 'recepcion' ? 'active' : ''} onClick={() => changeRole('recepcion')}><ClipboardList size={18} />Recepción<ChevronRight size={15} /></button></div><div className="fp-sidebar-note"><ShieldCheck size={18} /><p>Estás explorando el nuevo flujo con equipos de ejemplo.</p></div><div className="fp-person"><span className="fp-avatar">{role === 'tecnico' ? 'JP' : 'SM'}</span><div><strong>{role === 'tecnico' ? 'Juan Pérez' : 'Sofía Martín'}</strong><span>{role === 'tecnico' ? 'Técnico de taller' : 'Recepción'}</span></div></div></aside>
      <main className="fp-main">
        <header className="fp-page-heading"><div><p>Órdenes de servicio <ChevronRight size={12} />{role === 'tecnico' ? 'Taller' : 'Recepción'}</p><h1>{role === 'tecnico' ? 'Mesa de trabajo' : 'Pendientes de recepción'}</h1><span>{role === 'tecnico' ? 'Elegí un equipo, continuá el trabajo y dejá claro el próximo paso.' : 'Presupuestos, respuestas y retiros. Cada pendiente, en su lugar.'}</span></div><div className="fp-role-switch" role="group" aria-label="Cambiar vista de demostración"><button aria-pressed={role === 'tecnico'} onClick={() => changeRole('tecnico')}><Wrench size={15} />Taller</button><button aria-pressed={role === 'recepcion'} onClick={() => changeRole('recepcion')}><ClipboardList size={15} />Recepción</button></div></header>
        <div className={`fp-workspace ${mobileDetail ? 'fp-show-detail' : ''}`}>
          <section className="fp-queue" aria-label="Cola de equipos"><div className="fp-queue-tools"><div className="fp-queue-title"><h2>{role === 'tecnico' ? 'Equipos del taller' : 'Por hacer'}</h2><span>{list.length} equipo{list.length !== 1 ? 's' : ''}</span></div><label className="fp-search"><Search size={17} /><input aria-label="Buscar equipo" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="N.º, equipo o cliente" />{search && <button aria-label="Limpiar búsqueda" onClick={() => setSearch('')}>×</button>}</label><div className="fp-queue-filters" role="group" aria-label="Filtrar cola">{viewOptions.map(([key, label]) => <button key={key} aria-pressed={view === key} onClick={() => changeView(key)}>{label}<span>{queueOrders(orders, role, key).length}</span></button>)}</div></div>
            <div className="fp-queue-list" ref={queueRef}>{list.length ? list.map((item, index) => {
              const waiting = waitingFor(item)
              return <button key={item.id} data-order={item.number} className={`fp-queue-row ${selectedId === item.id ? 'selected' : ''}`} aria-current={selectedId === item.id ? 'true' : undefined} onClick={() => openOrder(item.id)} onKeyDown={(event) => onQueueKey(event, index)}>
                <div className="fp-row-top"><span>{item.number}</span><span><Clock3 size={11} />{age(item.statusSince)}</span></div><div className="fp-row-device"><DeviceIcon type={item.deviceType} size={19} /><strong>{item.brand} {item.model}</strong><ChevronRight size={14} /></div><p>{item.issue}</p><div className="fp-row-bottom"><Status order={item} />{waiting ? <span className={waiting.ready ? 'fp-green' : ''}>{waiting.ready ? 'Podés continuar' : waiting.owner}</span> : <span>{item.customer.split(' ')[0]}</span>}</div>
              </button>
            }) : <div className="fp-empty"><Inbox size={30} /><h3>{search ? 'Sin coincidencias' : 'Todo al día en esta cola'}</h3><p>{search ? 'Probá otro número, equipo o nombre.' : role === 'tecnico' ? 'Podés buscar un equipo en Sin asignar o consultar Todo el taller.' : 'Elegí otra tarea para continuar.'}</p></div>}</div>
            <div className="fp-queue-footer"><span className="fp-live-dot" />{role === 'tecnico' ? 'Para continuar primero · mayor espera después' : 'Ordenados por tiempo de espera'}</div>
          </section>
          {order ? <OrderWorkspace key={`${generation}-${order.id}-${role}`} order={order} role={role} draft={draft} setDraft={(fields) => setDrafts((previous) => ({ ...previous, [order.id]: { ...previous[order.id], ...fields } }))} onAction={mutate} outsideQueue={!list.some((item) => item.id === order.id)} onBack={() => setMobileDetail(false)} /> : <div className="fp-order fp-empty fp-select-empty"><ClipboardList size={36} /><h2>Elegí un equipo de la cola</h2><p>Acá vas a ver el trabajo, sus notas y la próxima acción.</p><button className="fp-button secondary fp-back" onClick={() => setMobileDetail(false)}><ArrowLeft size={15} />Volver a la cola</button></div>}
        </div>
      </main>
    </div>
  </div>
}
