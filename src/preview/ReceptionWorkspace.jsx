import { ArrowLeft, Check, ChevronDown, Phone, UserRound } from 'lucide-react'
import { PatternPreview } from '../components/PatternPad.jsx'
import { OrderTools, Status } from './OrderWorkspace.jsx'
import { charges } from './preview-model.js'
import { date, money } from './system-model.js'
import { RECEPTION_DRAFT, receptionTask } from './reception-task.js'

export default function ReceptionWorkspace({ order, role, draft: savedDraft, setDraft, onAction, onBack, onExtra, users }) {
  const draft = { ...RECEPTION_DRAFT, ...savedDraft }
  const task = receptionTask(order, draft)
  const bill = charges(order)
  const title = { presupuestar: 'Presupuestar', avisar: order.status === 'terminado' ? 'Avisar retiro' : 'Avisar presupuesto', respuesta: 'Registrar respuesta', repuestos: 'Gestionar repuestos', retiros: 'Registrar retiro', externos: 'Registrar regreso', simples: 'Finalizar servicio' }[task.queue]
  const showFinance = ['avisar', 'respuesta', 'retiros', 'simples'].includes(task.queue) || (task.queue === 'externos' && bill.total > 0) || (!task.queue && (bill.total > 0 || order.advance > 0 || order.rejectedCharge === 0))
  const showValidation = draft.note?.trim() || draft.partName?.trim() || (task.queue === 'presupuestar' && draft.price !== '') || (task.queue === 'respuesta' && draft.response === 'reject') || (task.queue === 'retiros' && (draft.physical || draft.pickupName || draft.pickupDni))
  return <article className="fp-order fp-reception-order" aria-label={`Orden ${order.number}`}>
    <header className="fp-order-header">
      <button className="fp-back fp-link" onClick={onBack}><ArrowLeft size={16} />Volver a la cola</button>
      <div className="fp-reception-heading"><h2>{order.brand} {order.model}<span className="fp-order-number"> · {order.number}</span></h2><Status order={order} /></div>
      <div className="fp-order-meta"><span><UserRound size={15} />{order.customer}</span><span><Phone size={15} />Teléfono: {order.phone}</span>{(order.warrantyReturn || order.isSimpleService) && <span>{order.warrantyReturn ? 'Garantía' : 'Servicio simple'}</span>}</div>
    </header>
    <div className="fp-order-body">
      <div className="fp-reception-context">
        <section aria-labelledby="reception-issue"><h3 id="reception-issue">Falla informada</h3><p className="fp-read-value">{order.issue}</p></section>
        <section aria-labelledby="reception-work"><h3 id="reception-work">{order.rejectedCharge !== null ? 'Trabajo propuesto · sin realizar' : ['terminado', 'entregado'].includes(order.status) ? 'Trabajo realizado' : 'Trabajo a realizar'}</h3><p className="fp-read-value">{order.work || 'Trabajo por definir'}</p>{order.workAuthor && <p className="fp-work-origin">{order.workAuthor.role === 'recepcion' ? `Definido en recepción por ${order.workAuthor.name}` : `Actualizado por ${order.workAuthor.name} · ${order.workAuthor.role === 'admin' ? 'Administrador' : 'Técnico'}`}</p>}</section>
        <details className="fp-diagnosis"><summary>Ver diagnóstico<ChevronDown size={15} /></summary><p className="fp-read-value">{order.diagnosis || 'Sin diagnóstico registrado'}</p></details>
      </div>
      <div className="fp-reception-secondary">
        <OrderTools order={order} role={role} draft={draft} setDraft={setDraft} onAction={onAction} onExtra={onExtra} />
        <details className="fp-disclosure fp-reception-ingress"><summary>Datos de ingreso<ChevronDown size={15} /></summary><dl className="fp-device-grid"><div><dt>Contraseña o PIN</dt><dd>{order.access || 'Sin contraseña informada'}</dd></div>{order.pattern?.length > 0 && <div><dt>Patrón de desbloqueo</dt><dd><div role="img" aria-label={`Patrón de desbloqueo: ${order.pattern.map((n) => n + 1).join(', ')}`}><PatternPreview value={order.pattern} size={112} /></div></dd></div>}<div><dt>Estado físico</dt><dd>{order.conditions || 'Sin registrar'}</dd></div><div><dt>Accesorios</dt><dd>{order.accessories || 'Sin accesorios'}</dd></div><div><dt>Ingreso</dt><dd>{date(order.createdAt)}</dd></div><div><dt>Técnico</dt><dd>{users?.find((user) => user.id === order.assignedTo)?.name || 'Sin asignar'}</dd></div></dl></details>
      </div>
      <form id="reception-task-form" className="fp-reception-task" aria-label={title || 'Sin pendientes de recepción'} onSubmit={(event) => { event.preventDefault(); if (task.id && !task.blocked) onAction(task.id, task.data) }}>
        <h3>{title || 'Sin pendientes de recepción'}</h3>
        {showFinance && <dl className="fp-finance"><div><dt>{order.rejectedCharge !== null ? 'Importe de retiro' : 'Presupuesto'}</dt><dd>{bill.total || order.rejectedCharge === 0 ? money(bill.total) : 'A definir'}</dd></div><div><dt>Seña</dt><dd>{money(order.advance)}</dd></div><div><dt>{bill.balance < 0 ? 'Saldo a favor' : 'Saldo pendiente'}</dt><dd>{bill.total || order.rejectedCharge === 0 ? money(Math.abs(bill.balance)) : '—'}</dd></div></dl>}
        {task.queue === 'presupuestar' && <div className="fp-reception-price"><div><label htmlFor="reception-price">Precio del presupuesto</label><div className="fp-currency-input"><span aria-hidden="true">$</span><input id="reception-price" type="number" min="0.01" step="0.01" required value={draft.price} onChange={(e) => setDraft({ price: e.target.value })} /></div></div><dl><dt>Seña</dt><dd>{money(order.advance)}</dd></dl></div>}
        {task.queue === 'respuesta' && <><div className="fp-response-options" role="group" aria-label="Respuesta al presupuesto"><button type="button" className={draft.response === 'approve' ? 'selected' : ''} aria-pressed={draft.response === 'approve'} onClick={() => setDraft({ response: 'approve' })}>Aprobó el presupuesto</button><button type="button" className={draft.response === 'reject' ? 'selected' : ''} aria-pressed={draft.response === 'reject'} onClick={() => setDraft({ response: 'reject' })}>Retira sin reparar</button></div>{draft.response === 'reject' && <label>Importe de revisión / retiro<input type="number" min="0" step="0.01" required value={draft.charge} onChange={(e) => setDraft({ charge: e.target.value })} /></label>}</>}
        {task.queue === 'repuestos' && <ul className="fp-reception-parts">{order.parts.map((part) => <li key={part.id}><span>{part.name} · Cantidad: {part.quantity}</span><span>{part.status === 'necesario' ? 'Por pedir' : part.status === 'pedido' ? 'Esperando llegada' : 'Recibido'}</span></li>)}</ul>}
        {task.queue === 'retiros' && <><label htmlFor="reception-pickup-by">¿Quién retira?</label><select id="reception-pickup-by" value={draft.pickupBy} onChange={(e) => setDraft({ pickupBy: e.target.value })}><option value="client">El cliente titular</option><option value="third">Otra persona autorizada</option></select>{draft.pickupBy === 'third' && <div className="fp-two-fields"><label>Nombre<input required value={draft.pickupName} onChange={(e) => setDraft({ pickupName: e.target.value })} /></label><label>DNI<input required inputMode="numeric" pattern="[0-9]{6,8}" value={draft.pickupDni} onChange={(e) => setDraft({ pickupDni: e.target.value })} /></label></div>}<label className="fp-checkbox"><input type="checkbox" checked={draft.physical} onChange={(e) => setDraft({ physical: e.target.checked })} />Confirmo que el equipo se retira físicamente ahora</label><label className="fp-checkbox"><input type="checkbox" checked={draft.withoutReceipt} onChange={(e) => setDraft({ withoutReceipt: e.target.checked })} />Retiro sin comprobante</label></>}
        {task.queue === 'externos' && <><p>Técnico externo: {order.externalTech}</p><label className="fp-checkbox"><input type="checkbox" checked={draft.repaired} onChange={(e) => setDraft({ repaired: e.target.checked })} />Reparación finalizada</label></>}
      </form>
    </div>
    <footer className="fp-action-dock">{task.blocked && showValidation && <p className="fp-action-context fp-blocked" role="status">{task.blocked}</p>}{task.label && <div className="fp-dock-buttons"><button className="fp-button primary" type="submit" form="reception-task-form" disabled={!!task.blocked}><Check size={16} />{task.label}</button></div>}</footer>
  </article>
}
