import { useState } from 'react'
import { ArrowRight, Check } from 'lucide-react'
import { OrderTools, ToolWindow } from './OrderWorkspace.jsx'
import { charges } from './preview-model.js'
import { money } from './system-model.js'
import { RECEPTION_DRAFT, receptionTask } from './reception-task.js'
import OrderSheet from './OrderSheet.jsx'

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
  return <><OrderSheet className="fp-reception-order" order={order} customer={customer} users={users} onBack={onBack}
    tools={<OrderTools order={order} role={role} draft={draft} setDraft={setDraft} onAction={onAction} onExtra={onExtra} actionsLabel="Acciones" />}
    footer={<><section className="fp-reception-amounts" aria-labelledby="reception-amounts"><h3 id="reception-amounts" className="sr-only">Importes</h3><ReceptionAmounts order={order} compact /></section>{task.id ? <div className="fp-dock-buttons"><button className="fp-button primary" aria-haspopup="dialog" onClick={() => setTaskOpen(true)}>{title}<ArrowRight size={16} /></button></div> : <p className="fp-muted">Sin pendientes de recepción</p>}</>}>
        <section aria-labelledby="reception-issue"><h3 id="reception-issue">Notas generales</h3><p className="fp-read-value">{order.issue}</p></section>
        <section className="fp-reception-work" aria-labelledby="reception-work"><h3 id="reception-work">{order.rejectedCharge !== null ? 'Trabajo propuesto · sin realizar' : ['terminado', 'entregado'].includes(order.status) ? 'Trabajo realizado' : 'Trabajo a realizar'}</h3><p className="fp-read-value">{order.work || 'Trabajo por definir'}</p>{order.workAuthor && <p className="fp-work-origin">Por {order.workAuthor.name} · {order.workAuthor.role === 'recepcion' ? 'Recepción' : order.workAuthor.role === 'admin' ? 'Administrador' : 'Técnico'}</p>}</section>
  </OrderSheet>
    {taskOpen && task.id && <ToolWindow title={`${title} · ${order.number}`} onClose={() => setTaskOpen(false)}><ReceptionTaskForm order={order} draft={draft} setDraft={setDraft} onAction={onAction} onClose={() => setTaskOpen(false)} title={title} /></ToolWindow>}
  </>
}
