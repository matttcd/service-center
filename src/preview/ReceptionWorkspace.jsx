import { useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Clock3, Phone, Mail, MapPin, KeyRound, IdCard, Grid3X3, Smartphone, Cable } from 'lucide-react'
import { PatternPreview } from '../components/PatternPad.jsx'
import { OrderTools, Status, ToolWindow } from './OrderWorkspace.jsx'
import { charges } from './preview-model.js'
import { money } from './system-model.js'
import { RECEPTION_DRAFT, receptionTask } from './reception-task.js'

const date = new Intl.DateTimeFormat('es-AR', { dateStyle: 'short', timeStyle: 'short', hourCycle: 'h23' }).format

function ReceptionAmounts({ order, compact = false }) {
  const bill = charges(order)
  if (compact) return <div className="fp-finance-summary">
    <p className="fp-finance-main">{order.rejectedCharge !== null ? 'Importe de retiro' : 'Presupuesto'} <strong>{bill.total || order.rejectedCharge === 0 ? money(bill.total) : 'a definir'}</strong></p>
    <div className="fp-finance-secondary"><p>Seña <strong>{money(order.advance)}</strong></p><p>{bill.balance < 0 ? 'Saldo a favor' : 'Saldo'} <strong>{bill.total || order.rejectedCharge === 0 ? money(Math.abs(bill.balance)) : '—'}</strong></p></div>
    {order.rejectedCharge !== null && <p className="fp-finance-original">Presupuesto rechazado <strong>{money(order.price)}</strong></p>}
  </div>
  return <dl className="fp-finance">{order.rejectedCharge !== null && <div><dt>Presupuesto rechazado</dt><dd>{money(order.price)}</dd></div>}<div><dt>{order.rejectedCharge !== null ? 'Importe de retiro' : 'Presupuesto'}</dt><dd>{bill.total || order.rejectedCharge === 0 ? money(bill.total) : 'A definir'}</dd></div><div><dt>Seña</dt><dd>{money(order.advance)}</dd></div><div><dt>{bill.balance < 0 ? 'Saldo a favor' : 'Saldo pendiente'}</dt><dd>{bill.total || order.rejectedCharge === 0 ? money(Math.abs(bill.balance)) : '—'}</dd></div></dl>
}

export function ReceptionTaskForm({ order, draft, setDraft, onAction, onClose, title }) {
  const task = receptionTask(order, draft)
  const editPrice = task.queue === 'presupuestar' || (task.queue === 'avisar' && order.status === 'presupuesto')
  const showValidation = draft.note?.trim() || draft.partName?.trim() || (task.queue === 'presupuestar' && draft.price !== '') || (task.queue === 'respuesta' && draft.response === 'reject') || (task.queue === 'retiros' && (draft.physical || draft.pickupName || draft.pickupDni))
  return <form id="reception-task-form" className="fp-reception-task" aria-label={title || 'Sin pendientes de recepción'} onSubmit={(event) => { event.preventDefault(); if (task.id && !task.blocked && onAction(task.id, task.data)) onClose() }}>
        <p className="fp-muted">{order.brand} {order.model} · {order.number}</p>
        {['presupuestar', 'avisar', 'respuesta'].includes(task.queue) && <p className="fp-read-value">{order.work || 'Trabajo por definir'}</p>}
        {!editPrice && <ReceptionAmounts order={order} />}
        {editPrice && <div className="fp-reception-price"><div><label htmlFor="reception-price">Precio del presupuesto</label><div className="fp-currency-input"><span aria-hidden="true">$</span><input id="reception-price" type="number" min="0.01" step="0.01" required value={draft.price} onChange={(e) => setDraft({ price: e.target.value })} /></div></div><dl><dt>Seña</dt><dd>{money(order.advance)}</dd></dl></div>}
        {task.queue === 'respuesta' && <><div className="fp-response-options" role="group" aria-label="Respuesta al presupuesto"><button type="button" className={draft.response === 'approve' ? 'selected' : ''} aria-pressed={draft.response === 'approve'} onClick={() => setDraft({ response: 'approve' })}>Aprobó el presupuesto</button><button type="button" className={draft.response === 'reject' ? 'selected' : ''} aria-pressed={draft.response === 'reject'} onClick={() => setDraft({ response: 'reject' })}>Retira sin reparar</button></div>{draft.response === 'reject' && <label>Importe de revisión / retiro<input type="number" min="0" step="0.01" required value={draft.charge} onChange={(e) => setDraft({ charge: e.target.value })} /></label>}</>}
        {task.queue === 'repuestos' && <ul className="fp-reception-parts">{order.parts.map((part) => <li key={part.id}><span>{part.name} · Cantidad: {part.quantity}</span><span>{part.status === 'necesario' ? 'Por pedir' : part.status === 'pedido' ? 'Esperando llegada' : 'Recibido'}</span></li>)}</ul>}
        {task.queue === 'retiros' && <><p>¿Quién retira?</p><div id="reception-pickup-by" className="fp-response-options" role="group" aria-label="¿Quién retira?"><button type="button" className={draft.pickupBy === 'client' ? 'selected' : ''} aria-pressed={draft.pickupBy === 'client'} onClick={() => setDraft({ pickupBy: 'client' })}>El cliente titular</button><button type="button" className={draft.pickupBy === 'third' ? 'selected' : ''} aria-pressed={draft.pickupBy === 'third'} onClick={() => setDraft({ pickupBy: 'third' })}>Otra persona autorizada</button></div>{draft.pickupBy === 'third' && <div className="fp-two-fields"><label>Nombre<input required value={draft.pickupName} onChange={(e) => setDraft({ pickupName: e.target.value })} /></label><label>DNI<input required inputMode="numeric" pattern="[0-9]{6,8}" value={draft.pickupDni} onChange={(e) => setDraft({ pickupDni: e.target.value })} /></label></div>}<label className="fp-checkbox"><input type="checkbox" checked={draft.physical} onChange={(e) => setDraft({ physical: e.target.checked })} />Confirmo que el equipo se retira físicamente ahora</label><label className="fp-checkbox"><input type="checkbox" checked={draft.withoutReceipt} onChange={(e) => setDraft({ withoutReceipt: e.target.checked })} />Retiro sin comprobante</label></>}
        {task.queue === 'externos' && <><p>Técnico externo: {order.externalTech}</p><label className="fp-checkbox"><input type="checkbox" checked={draft.repaired} onChange={(e) => setDraft({ repaired: e.target.checked })} />Reparación finalizada</label></>}
        {task.blocked && showValidation && <p className="fp-action-context fp-blocked" role="status">{task.blocked}</p>}<div className="fp-form-actions"><button className="fp-button secondary" type="button" onClick={onClose}>Cancelar</button><button className="fp-button primary" type="submit" disabled={!!task.blocked}><Check size={16} />{task.label}</button></div>
      </form>
}

export default function ReceptionWorkspace({ order, customer, role, draft: savedDraft, setDraft, onAction, onBack, onExtra, users }) {
  const [taskOpen, setTaskOpen] = useState(false)
  const draft = { ...RECEPTION_DRAFT, ...savedDraft }
  const task = receptionTask(order, draft)
  const title = { presupuestar: 'Presupuestar', avisar: order.status === 'terminado' ? 'Avisar retiro' : 'Avisar presupuesto', respuesta: 'Registrar respuesta', repuestos: 'Gestionar repuestos', retiros: 'Registrar retiro', externos: 'Registrar regreso', simples: 'Finalizar servicio' }[task.queue]
  const person = (id, name) => name || users?.find((user) => user.id === id)?.name || 'Sin registrar'
  const eventInfo = (at, id, name) => [at && date(at), (id || name) && person(id, name)].filter(Boolean).join(' · ')
  const name = customer?.name || order.customer
  return <article className="fp-order fp-reception-order" aria-label={`Orden ${order.number}`}>
    <header className="fp-order-header">
      <button className="fp-back fp-link" onClick={onBack}><ArrowLeft size={18} /><span className="sr-only">Volver a la cola</span></button>
      <div className="fp-reception-identity">
        <div><h2>{order.brand} {order.model}</h2>
          <dl className="fp-reception-header-facts"><div><dt className="sr-only">Orden</dt><dd>{order.number}</dd></div><div><dt className="sr-only">Tipo de dispositivo</dt><dd>{order.deviceType || 'Sin registrar'}</dd></div><div><dt className="sr-only">Tipo de ingreso</dt><dd>{order.isSimpleService ? 'Servicio simple' : order.entry === 'repair' ? 'Reparación definida' : order.entry === 'review' ? 'Para revisión' : 'Sin registrar'}{order.warrantyReturn && ' · Garantía'}</dd></div></dl>
        </div>
      </div>
      <Status order={order} />
      {order.externalTech && <section className="fp-reception-external" aria-label="Técnico externo"><dl><div><dt>Externo</dt><dd>{order.externalTech}</dd></div><div><dt>Envío</dt><dd>{order.externalSentAt ? date(order.externalSentAt) : '—'}</dd></div><div><dt>Regreso</dt><dd>{order.externalReturnAt ? date(order.externalReturnAt) : '—'}</dd></div></dl></section>}
    </header>
    <div className="fp-order-body">
      <div className="fp-reception-secondary"><OrderTools order={order} role={role} draft={draft} setDraft={setDraft} onAction={onAction} onExtra={onExtra} actionsInWindow /></div>
      <div className="fp-reception-context">
        <section aria-labelledby="reception-issue"><h3 id="reception-issue">Falla informada</h3><p className="fp-read-value">{order.issue}</p></section>
        <section className="fp-reception-work" aria-labelledby="reception-work"><h3 id="reception-work">{order.rejectedCharge !== null ? 'Trabajo propuesto · sin realizar' : ['terminado', 'entregado'].includes(order.status) ? 'Trabajo realizado' : 'Trabajo a realizar'}</h3><p className="fp-read-value">{order.work || 'Trabajo por definir'}</p>{order.workAuthor && <p className="fp-work-origin">Por {order.workAuthor.name} · {order.workAuthor.role === 'recepcion' ? 'Recepción' : order.workAuthor.role === 'admin' ? 'Administrador' : 'Técnico'}</p>}</section>
      </div>
      <section className="fp-reception-tracking" aria-labelledby="reception-followup"><h3 id="reception-followup" className="sr-only"><Clock3 size={16} />Seguimiento</h3><dl>
        <div><dt>Ingreso</dt><dd>{date(order.createdAt)}</dd></div><div><dt>Recibió</dt><dd>{person(order.receivedBy, order.receivedByName)}</dd></div>
        <div><dt>Técnico</dt><dd>{order.assignedTo ? person(order.assignedTo) : 'Sin asignar'}</dd></div><div><dt>Aceptado</dt><dd>{order.acceptedAt ? date(order.acceptedAt) : 'Sin aceptar'}</dd></div>
        <div><dt>Aviso al cliente</dt><dd>{order.notified ? 'Avisado' : 'Sin avisar'}{order.notified && <span className="fp-data-event">{eventInfo(order.notifiedAt, order.notifiedBy, order.notifiedByName)}</span>}</dd></div>
        <div><dt>Respuesta</dt><dd>{order.rejectedCharge !== null ? 'Rechazado' : order.confirmed ? 'Aprobado' : 'Sin respuesta'}{order.confirmed && <span className="fp-data-event">{eventInfo(order.confirmedAt, order.confirmedBy, order.confirmedByName)}</span>}</dd></div>
        {(order.repairedBy || order.repairedByName) && <div><dt>Reparó</dt><dd>{person(order.repairedBy, order.repairedByName)}</dd></div>}

        {order.deliveredAt && <><div><dt>Entrega</dt><dd>{eventInfo(order.deliveredAt, order.deliveredBy, order.deliveredByName)}</dd></div><div><dt>Retiró</dt><dd>{order.pickup ? order.pickup.by === 'third' ? `${order.pickup.name} · DNI: ${order.pickup.dni}` : 'Cliente titular' : 'Sin registrar'}</dd></div><div><dt>Comprobante de retiro</dt><dd>{order.pickup ? order.pickup.withoutReceipt ? 'Sin comprobante' : 'Con comprobante' : 'Sin registrar'}</dd></div></>}
      </dl></section>
    </div>
    <aside className="fp-reception-reference" aria-label="Cliente y equipo">
      <section aria-labelledby="reception-customer">
        <div className="fp-reception-customer-identity"><span className="fp-avatar" aria-hidden="true">{name.split(' ').filter(Boolean).slice(0, 2).map((word) => word[0]).join('')}</span><div><h3 id="reception-customer"><span className="sr-only">Cliente: </span>{name}</h3><dl className="fp-reception-customer-id"><div><dt><IdCard size={14} aria-hidden="true" />DNI</dt><dd>{customer?.dni || '—'}</dd></div></dl></div></div>
        <dl className="fp-reception-contacts">
          <div><dt><Phone size={14} />Teléfono</dt><dd>{customer?.phone || order.phone || '—'}</dd></div><div><dt><Phone size={14} aria-hidden="true" />Teléfono 2</dt><dd>{customer?.phone2 || '—'}</dd></div><div><dt><Phone size={14} aria-hidden="true" />Teléfono 3</dt><dd>{customer?.phone3 || '—'}</dd></div>
          <div className="fp-contact-address"><dt><Mail size={14} />Correo</dt><dd>{customer?.email || '—'}</dd></div><div className="fp-contact-address"><dt><MapPin size={14} />Domicilio</dt><dd>{customer?.address || '—'}</dd></div>
        </dl>
      </section>
      <section className="fp-reception-device" aria-labelledby="reception-ingress"><h3 id="reception-ingress" className="sr-only">Acceso y estado</h3><dl>
        <div className="fp-reception-access"><dt><KeyRound size={14} />Contraseña o PIN</dt><dd>{order.noPin ? 'Sin bloqueo' : order.access || 'Sin contraseña informada'}</dd></div>
        <div className="fp-reception-pattern"><dt><Grid3X3 size={14} aria-hidden="true" />Patrón</dt><dd>{!order.noPin && order.pattern?.length > 0 ? <div role="img" aria-label={`Patrón de desbloqueo: ${order.pattern.map((n) => n + 1).join(', ')}`}><PatternPreview value={order.pattern} size={80} /></div> : order.noPin ? 'Sin bloqueo' : '—'}</dd></div>
        <div><dt><Smartphone size={14} aria-hidden="true" />Estado físico</dt><dd>{order.conditions || 'Sin registrar'}</dd></div><div><dt><Cable size={14} aria-hidden="true" />Accesorios</dt><dd>{order.accessories || 'Sin accesorios'}</dd></div>
      </dl></section>

    </aside>
    <footer className="fp-action-dock"><section className="fp-reception-amounts" aria-labelledby="reception-amounts"><h3 id="reception-amounts" className="sr-only">Importes</h3><ReceptionAmounts order={order} compact /></section>{task.id ? <div className="fp-dock-buttons"><button className="fp-button primary" aria-haspopup="dialog" onClick={() => setTaskOpen(true)}>{title}<ArrowRight size={16} /></button></div> : <p className="fp-muted">Sin pendientes de recepción</p>}</footer>
    {taskOpen && task.id && <ToolWindow title={`${title} · ${order.number}`} onClose={() => setTaskOpen(false)}><ReceptionTaskForm order={order} draft={draft} setDraft={setDraft} onAction={onAction} onClose={() => setTaskOpen(false)} title={title} /></ToolWindow>}
  </article>
}
