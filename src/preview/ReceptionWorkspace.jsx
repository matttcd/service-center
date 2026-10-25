import { ArrowLeft, Check } from 'lucide-react'
import { PatternPreview } from '../components/PatternPad.jsx'
import { OrderTools, Status } from './OrderWorkspace.jsx'
import { charges } from './preview-model.js'
import { date, money } from './system-model.js'
import { RECEPTION_DRAFT, receptionTask } from './reception-task.js'

export default function ReceptionWorkspace({ order, customer, role, draft: savedDraft, setDraft, onAction, onBack, onExtra, users }) {
  const draft = { ...RECEPTION_DRAFT, ...savedDraft }
  const task = receptionTask(order, draft)
  const bill = charges(order)
  const title = { presupuestar: 'Presupuestar', avisar: order.status === 'terminado' ? 'Avisar retiro' : 'Avisar presupuesto', respuesta: 'Registrar respuesta', repuestos: 'Gestionar repuestos', retiros: 'Registrar retiro', externos: 'Registrar regreso', simples: 'Finalizar servicio' }[task.queue]
  const showFinance = task.queue !== 'presupuestar'
  const person = (id, name) => name || users?.find((user) => user.id === id)?.name || 'Sin registrar'
  const eventInfo = (at, id, name) => [at && date(at), (id || name) && person(id, name)].filter(Boolean).join(' · ')
  const showValidation = draft.note?.trim() || draft.partName?.trim() || (task.queue === 'presupuestar' && draft.price !== '') || (task.queue === 'respuesta' && draft.response === 'reject') || (task.queue === 'retiros' && (draft.physical || draft.pickupName || draft.pickupDni))
  return <article className="fp-order fp-reception-order" aria-label={`Orden ${order.number}`}>
    <header className="fp-order-header">
      <button className="fp-back fp-link" onClick={onBack}><ArrowLeft size={16} />Volver a la cola</button>
      <div className="fp-reception-heading"><h2>{order.brand} {order.model}<span className="fp-order-number"> · {order.number}</span></h2><Status order={order} /></div>
    </header>
    <div className="fp-order-body">
      <section className="fp-reception-data" aria-labelledby="reception-customer"><h3 id="reception-customer">Cliente</h3><dl className="fp-reception-data-grid">
        <div><dt>Nombre</dt><dd>{customer?.name || order.customer}</dd></div><div><dt>DNI</dt><dd>{customer?.dni || 'Sin registrar'}</dd></div>
        <div><dt>Teléfono</dt><dd>{customer?.phone || order.phone || 'Sin registrar'}</dd></div><div><dt>Teléfono alternativo 1</dt><dd>{customer?.phone2 || 'Sin registrar'}</dd></div><div><dt>Teléfono alternativo 2</dt><dd>{customer?.phone3 || 'Sin registrar'}</dd></div>
        <div><dt>Correo electrónico</dt><dd>{customer?.email || 'Sin registrar'}</dd></div><div className="fp-data-wide"><dt>Domicilio</dt><dd>{customer?.address || 'Sin registrar'}</dd></div>
      </dl></section>
      <section className="fp-reception-data" aria-labelledby="reception-ingress"><h3 id="reception-ingress">Equipo e ingreso</h3><dl className="fp-reception-data-grid">
        <div><dt>Tipo de dispositivo</dt><dd>{order.deviceType || 'Sin registrar'}</dd></div><div><dt>Tipo de ingreso</dt><dd>{order.isSimpleService ? 'Servicio simple' : order.entry === 'repair' ? 'Reparación definida' : order.entry === 'review' ? 'Para revisión' : 'Sin registrar'}{order.warrantyReturn && ' · Garantía'}</dd></div><div><dt>Ingreso</dt><dd>{date(order.createdAt)}</dd></div>
        <div><dt>Recibió</dt><dd>{person(order.receivedBy, order.receivedByName)}</dd></div><div><dt>Técnico encargado</dt><dd>{order.assignedTo ? person(order.assignedTo) : 'Sin asignar'}</dd></div><div><dt>Aceptado por el técnico</dt><dd>{order.acceptedAt ? date(order.acceptedAt) : 'Sin aceptar'}</dd></div>
        <div><dt>Contraseña o PIN</dt><dd>{order.noPin ? 'Sin bloqueo' : order.access || 'Sin contraseña informada'}</dd></div><div><dt>Estado físico</dt><dd>{order.conditions || 'Sin registrar'}</dd></div><div><dt>Accesorios</dt><dd>{order.accessories || 'Sin accesorios'}</dd></div>
        <div className="fp-reception-pattern"><dt>Patrón de desbloqueo</dt><dd>{!order.noPin && order.pattern?.length > 0 ? <div role="img" aria-label={`Patrón de desbloqueo: ${order.pattern.map((n) => n + 1).join(', ')}`}><PatternPreview value={order.pattern} size={112} /></div> : order.noPin ? 'Sin bloqueo' : 'Sin patrón registrado'}</dd></div>
      </dl></section>
      <div className="fp-reception-context">
        <section aria-labelledby="reception-issue"><h3 id="reception-issue">Falla informada</h3><p className="fp-read-value">{order.issue}</p></section>
        <section aria-labelledby="reception-diagnosis"><h3 id="reception-diagnosis">Diagnóstico</h3><p className="fp-read-value">{order.diagnosis || 'Sin diagnóstico registrado'}</p></section>
        <section aria-labelledby="reception-work"><h3 id="reception-work">{order.rejectedCharge !== null ? 'Trabajo propuesto · sin realizar' : ['terminado', 'entregado'].includes(order.status) ? 'Trabajo realizado' : 'Trabajo a realizar'}</h3><p className="fp-read-value">{order.work || 'Trabajo por definir'}</p>{order.workAuthor && <p className="fp-work-origin">{order.workAuthor.role === 'recepcion' ? `Definido en recepción por ${order.workAuthor.name}` : `Actualizado por ${order.workAuthor.name} · ${order.workAuthor.role === 'admin' ? 'Administrador' : 'Técnico'}`}</p>}</section>
      </div>
      <section className="fp-reception-data" aria-labelledby="reception-followup"><h3 id="reception-followup">Seguimiento</h3><dl className="fp-reception-data-grid">
        <div><dt>Aviso al cliente</dt><dd>{order.notified ? 'Avisado' : 'Sin avisar'}{order.notified && <span className="fp-data-event">{eventInfo(order.notifiedAt, order.notifiedBy, order.notifiedByName)}</span>}</dd></div>
        <div><dt>Respuesta al presupuesto</dt><dd>{order.rejectedCharge !== null ? 'Rechazado' : order.confirmed ? 'Aprobado' : 'Sin respuesta'}{order.confirmed && <span className="fp-data-event">{eventInfo(order.confirmedAt, order.confirmedBy, order.confirmedByName)}</span>}</dd></div>
        {(order.repairedBy || order.repairedByName) && <div><dt>Reparó</dt><dd>{person(order.repairedBy, order.repairedByName)}</dd></div>}
        {order.externalTech && <><div><dt>Técnico externo</dt><dd>{order.externalTech}</dd></div><div><dt>Envío a externo</dt><dd>{order.externalSentAt ? date(order.externalSentAt) : 'Sin fecha registrada'}</dd></div><div><dt>Regreso de externo</dt><dd>{order.externalReturnAt ? date(order.externalReturnAt) : 'Sin regreso registrado'}</dd></div></>}
        {order.deliveredAt && <><div><dt>Entrega</dt><dd>{eventInfo(order.deliveredAt, order.deliveredBy, order.deliveredByName)}</dd></div><div><dt>Retiró</dt><dd>{order.pickup ? order.pickup.by === 'third' ? `${order.pickup.name} · DNI: ${order.pickup.dni}` : 'Cliente titular' : 'Sin registrar'}</dd></div><div><dt>Comprobante de retiro</dt><dd>{order.pickup ? order.pickup.withoutReceipt ? 'Sin comprobante' : 'Con comprobante' : 'Sin registrar'}</dd></div></>}
      </dl></section>
      <div className="fp-reception-secondary">
        <OrderTools order={order} role={role} draft={draft} setDraft={setDraft} onAction={onAction} onExtra={onExtra} actionsInWindow />
      </div>
      <form id="reception-task-form" className="fp-reception-task" aria-label={title || 'Sin pendientes de recepción'} onSubmit={(event) => { event.preventDefault(); if (task.id && !task.blocked) onAction(task.id, task.data) }}>
        <h3>{title || 'Sin pendientes de recepción'}</h3>
        {showFinance && <dl className="fp-finance">{order.rejectedCharge !== null && <div><dt>Presupuesto rechazado</dt><dd>{money(order.price)}</dd></div>}<div><dt>{order.rejectedCharge !== null ? 'Importe de retiro' : 'Presupuesto'}</dt><dd>{bill.total || order.rejectedCharge === 0 ? money(bill.total) : 'A definir'}</dd></div><div><dt>Seña</dt><dd>{money(order.advance)}</dd></div><div><dt>{bill.balance < 0 ? 'Saldo a favor' : 'Saldo pendiente'}</dt><dd>{bill.total || order.rejectedCharge === 0 ? money(Math.abs(bill.balance)) : '—'}</dd></div></dl>}
        {task.queue === 'presupuestar' && <div className="fp-reception-price"><div><label htmlFor="reception-price">Precio del presupuesto</label><div className="fp-currency-input"><span aria-hidden="true">$</span><input id="reception-price" type="number" min="0.01" step="0.01" required value={draft.price} onChange={(e) => setDraft({ price: e.target.value })} /></div></div><dl><dt>Seña</dt><dd>{money(order.advance)}</dd></dl></div>}
        {task.queue === 'respuesta' && <><div className="fp-response-options" role="group" aria-label="Respuesta al presupuesto"><button type="button" className={draft.response === 'approve' ? 'selected' : ''} aria-pressed={draft.response === 'approve'} onClick={() => setDraft({ response: 'approve' })}>Aprobó el presupuesto</button><button type="button" className={draft.response === 'reject' ? 'selected' : ''} aria-pressed={draft.response === 'reject'} onClick={() => setDraft({ response: 'reject' })}>Retira sin reparar</button></div>{draft.response === 'reject' && <label>Importe de revisión / retiro<input type="number" min="0" step="0.01" required value={draft.charge} onChange={(e) => setDraft({ charge: e.target.value })} /></label>}</>}
        {task.queue === 'repuestos' && <ul className="fp-reception-parts">{order.parts.map((part) => <li key={part.id}><span>{part.name} · Cantidad: {part.quantity}</span><span>{part.status === 'necesario' ? 'Por pedir' : part.status === 'pedido' ? 'Esperando llegada' : 'Recibido'}</span></li>)}</ul>}
        {task.queue === 'retiros' && <><p>¿Quién retira?</p><div id="reception-pickup-by" className="fp-response-options" role="group" aria-label="¿Quién retira?"><button type="button" className={draft.pickupBy === 'client' ? 'selected' : ''} aria-pressed={draft.pickupBy === 'client'} onClick={() => setDraft({ pickupBy: 'client' })}>El cliente titular</button><button type="button" className={draft.pickupBy === 'third' ? 'selected' : ''} aria-pressed={draft.pickupBy === 'third'} onClick={() => setDraft({ pickupBy: 'third' })}>Otra persona autorizada</button></div>{draft.pickupBy === 'third' && <div className="fp-two-fields"><label>Nombre<input required value={draft.pickupName} onChange={(e) => setDraft({ pickupName: e.target.value })} /></label><label>DNI<input required inputMode="numeric" pattern="[0-9]{6,8}" value={draft.pickupDni} onChange={(e) => setDraft({ pickupDni: e.target.value })} /></label></div>}<label className="fp-checkbox"><input type="checkbox" checked={draft.physical} onChange={(e) => setDraft({ physical: e.target.checked })} />Confirmo que el equipo se retira físicamente ahora</label><label className="fp-checkbox"><input type="checkbox" checked={draft.withoutReceipt} onChange={(e) => setDraft({ withoutReceipt: e.target.checked })} />Retiro sin comprobante</label></>}
        {task.queue === 'externos' && <label className="fp-checkbox"><input type="checkbox" checked={draft.repaired} onChange={(e) => setDraft({ repaired: e.target.checked })} />Reparación finalizada</label>}
      </form>
    </div>
    <footer className="fp-action-dock">{task.blocked && showValidation && <p className="fp-action-context fp-blocked" role="status">{task.blocked}</p>}{task.label && <div className="fp-dock-buttons"><button className="fp-button primary" type="submit" form="reception-task-form" disabled={!!task.blocked}><Check size={16} />{task.label}</button></div>}</footer>
  </article>
}
